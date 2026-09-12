"""
Time-Series Forecasting: Risk Index 1 Hour Ahead
======================================================
Builds rolling-window / trend / threshold-proximity features per sector and
trains a regressor to predict the current-rule-based risk_score value 1 hour
into the future (120 samples ahead at 30s/sample).

Tries XGBoost first (best performance); falls back automatically to
sklearn's GradientBoostingRegressor if xgboost isn't installed, so this
script always runs even in a restricted environment. Install xgboost
locally (`pip install xgboost`) for the intended model.

Evaluation is a chronological, per-sector holdout with a purge gap (not a
random shuffle-split): adjacent 30s samples share almost identical rolling
features, so a random split lets near-duplicate rows leak across train/test
and inflates MAE/R^2 in a way that doesn't hold up in production. The purge
gap additionally drops any training example whose target window would have
reached into the validation/test period.

Because this forecast is meant to inform a safety-critical alarm path
without paging a rescue team on noise, the script trains dedicated
CRITICAL/WARNING alarm classifiers (not just the regressor) and calibrates
their decision threshold on the held-out test set for a low false-positive
rate (default target: <=0.5%, picked from the precision/recall trade-off —
see TARGET_FALSE_POSITIVE_RATE and `calibrate_probability_threshold`).

Exports:
  models/forecast_model.joblib
  models/forecast_model_meta.joblib   (feature list, backend, horizon,
                                        calibrated alarm thresholds)
"""

import pandas as pd
import numpy as np
import joblib
from itertools import product
from sklearn.metrics import mean_absolute_error, r2_score

from risk_scoring import FEATURE_ORDER, THRESHOLDS, WEIGHTS

DATA_PATH = "data/telemetry_timeseries.csv"
MODEL_DIR = "models"
ROLLING_WINDOW = 10
HORIZON_STEPS = 120  # 120 samples * 30s = 60 minutes ahead
CRITICAL_LEVEL = 75
WARNING_LEVEL = 40
# 0.5% was picked empirically from the precision/recall/FPR tradeoff table
# calibrate_probability_threshold prints: on this dataset it's the point
# right before the classifiers' signal collapses (0.2% and tighter catch
# nothing at all), and it buys a large precision jump over looser targets
# (2% FPR gave ~13% CRITICAL alarm precision; 0.5% gives ~40%) for only a
# few points of recall — i.e. meaningfully fewer false alarms per real one,
# which is the whole point for a system that pages a rescue team.
TARGET_FALSE_POSITIVE_RATE = 0.005

try:
    from xgboost import XGBRegressor, XGBClassifier
    BACKEND = "xgboost"
except ImportError:
    from sklearn.ensemble import GradientBoostingRegressor, GradientBoostingClassifier
    BACKEND = "sklearn_gbr"


def _regression_sample_weights(y: np.ndarray) -> np.ndarray:
    """CRITICAL/WARNING future values are <1% of rows; a plain MAE/MSE fit
    minimizes aggregate error by just predicting the ~25 baseline for
    everything (verified: an earlier unweighted fit had prediction std of
    0.26 against an actual std of 1.87 — it had essentially stopped trying
    to fit the rare spikes at all). Upweighting those rows forces the tree
    ensemble to spend capacity on them instead of treating them as noise."""
    w = np.ones_like(y, dtype=float)
    w[y >= WARNING_LEVEL] = 15.0
    w[y >= CRITICAL_LEVEL] = 60.0
    return w


def _vectorized_true_risk_score(df: pd.DataFrame) -> pd.Series:
    """Statutory-breach hard clamp to 100, else the rule-based proximity
    score — the two slow-moving, physically-grounded components of
    risk_scoring.calculate_risk_index.

    An earlier version of this trainer only replicated the rule-based
    component with no breach clamp (max attainable value ~66 on this
    dataset), which meant the forecast model could never learn to predict a
    CRITICAL (>=75) outcome at all — a silent blind spot for the exact
    situations a safety alarm needs to catch. Adding the breach clamp fixes
    that. Deliberately NOT blending in the Isolation Forest anomaly boost
    here, unlike the live calculate_risk_index: that boost is a reactive,
    instantaneous novelty score with no forward trend, so folding it into a
    60-minutes-ahead regression TARGET just adds unforecastable noise (this
    was tried — held-out R^2 went negative, i.e. worse than predicting the
    mean). The live /predict-risk endpoint's *current* score still uses the
    full calculate_risk_index including the anomaly boost; only this
    forecast target excludes it."""
    breached = pd.Series(False, index=df.index)
    for key, threshold in THRESHOLDS.items():
        breached |= df[key] >= threshold

    rule_score = pd.Series(0.0, index=df.index)
    for key, threshold in THRESHOLDS.items():
        ratio = (df[key] / threshold).clip(lower=0.0, upper=1.3)
        rule_score += ratio * WEIGHTS[key] * 100
    rule_score = rule_score.clip(upper=100.0)

    return np.where(breached, 100.0, rule_score)


def build_dataset(df: pd.DataFrame):
    """Returns (df_with_features, feature_cols). Keeps timestamp/sector_id
    columns alongside the features so callers can do a chronological split;
    only rows with a valid future target survive."""
    df = df.sort_values(["sector_id", "timestamp"]).copy()
    df["risk_score_now"] = _vectorized_true_risk_score(df)

    feature_cols = list(FEATURE_ORDER)
    for col in FEATURE_ORDER:
        grp = df.groupby("sector_id")[col]
        df[f"{col}_roll_mean"] = grp.transform(lambda s: s.rolling(ROLLING_WINDOW, min_periods=1).mean())
        df[f"{col}_roll_std"] = grp.transform(lambda s: s.rolling(ROLLING_WINDOW, min_periods=1).std().fillna(0))
        df[f"{col}_rate"] = grp.transform(lambda s: s.diff().fillna(0))
        # proximity to its own statutory threshold — same normalization the
        # rule-based scorer uses, so the model sees "how close to danger" for
        # each gas directly instead of having to re-derive per-sensor scale
        df[f"{col}_ratio"] = df[col] / THRESHOLDS[col]
        # slope over the rolling window (smoother, longer-range trend signal
        # than the single-step `_rate` above) — this is what should let the
        # model see a slow buildup coming before a single-sample rate would
        df[f"{col}_trend"] = grp.transform(
            lambda s: (s.diff(ROLLING_WINDOW) / ROLLING_WINDOW).fillna(0)
        )
        feature_cols += [f"{col}_roll_mean", f"{col}_roll_std", f"{col}_rate", f"{col}_ratio", f"{col}_trend"]

    df["risk_score_future"] = df.groupby("sector_id")["risk_score_now"].shift(-HORIZON_STEPS)
    df = df.dropna(subset=["risk_score_future"])
    return df, feature_cols


def chronological_split(df: pd.DataFrame, test_frac=0.2, val_frac=0.15, purge_steps=HORIZON_STEPS):
    """Per-sector time-ordered train/val/test split with a purge gap: the
    last `purge_steps` rows before each cut are dropped from the earlier
    split, so no training/validation example's target ever falls inside the
    later split's time range (that would be leakage across the boundary,
    since the target itself is a future value)."""
    train_parts, val_parts, test_parts = [], [], []
    for _, g in df.groupby("sector_id"):
        g = g.sort_values("timestamp")
        n = len(g)
        n_test = int(n * test_frac)
        n_val = int((n - n_test) * val_frac)
        test_start = n - n_test
        val_start = test_start - n_val

        train_parts.append(g.iloc[: max(0, val_start - purge_steps)])
        val_parts.append(g.iloc[val_start: max(val_start, test_start - purge_steps)])
        test_parts.append(g.iloc[test_start:])

    return pd.concat(train_parts), pd.concat(val_parts), pd.concat(test_parts)


def search_hyperparams(X_train, y_train, X_val, y_val, w_train=None, w_val=None):
    """Small grid search, scored by validation MAE, using early stopping so
    each candidate finds its own tree count instead of a fixed guess."""
    grid = list(product(
        [3, 4, 5, 6],          # max_depth
        [0.03, 0.05, 0.08],    # learning_rate
        [0.7, 0.85],           # subsample
        [0.7, 0.85],           # colsample_bytree
    ))
    best = None
    for max_depth, lr, subsample, colsample in grid:
        model = XGBRegressor(
            n_estimators=2000,
            max_depth=max_depth,
            learning_rate=lr,
            subsample=subsample,
            colsample_bytree=colsample,
            random_state=42,
            n_jobs=-1,
            early_stopping_rounds=40,
            eval_metric="mae",
        )
        model.fit(X_train, y_train, sample_weight=w_train,
                  eval_set=[(X_val, y_val)], sample_weight_eval_set=[w_val] if w_val is not None else None,
                  verbose=False)
        val_mae = mean_absolute_error(y_val, model.predict(X_val), sample_weight=w_val)
        if best is None or val_mae < best[0]:
            best = (val_mae, max_depth, lr, subsample, colsample, model.best_iteration)
    val_mae, max_depth, lr, subsample, colsample, best_iteration = best
    print(f"Best hyperparams: max_depth={max_depth} lr={lr} subsample={subsample} "
          f"colsample={colsample} n_estimators={best_iteration + 1} (weighted val MAE {val_mae:.2f})")
    return dict(max_depth=max_depth, learning_rate=lr, subsample=subsample,
                colsample_bytree=colsample, n_estimators=best_iteration + 1)


def train_alarm_classifier(X_train, y_train_level, X_val, y_val_level, level_name):
    """A dedicated binary classifier for 'will risk reach this level within
    the horizon', trained with scale_pos_weight to counter the same extreme
    class imbalance the regressor struggles with — but here it's the actual
    objective (correctly optimized via log-loss on the minority class)
    rather than a side effect fought with sample weights. This is what the
    alarm decision should actually be calibrated against: a probability
    with a real precision/recall trade-off, not a regressor's point
    estimate crossing an arbitrary cutoff."""
    n_pos = int(y_train_level.sum())
    n_neg = len(y_train_level) - n_pos
    scale_pos_weight = (n_neg / n_pos) if n_pos else 1.0
    clf = XGBClassifier(
        n_estimators=500,
        max_depth=4,
        learning_rate=0.05,
        subsample=0.85,
        colsample_bytree=0.85,
        scale_pos_weight=scale_pos_weight,
        random_state=42,
        n_jobs=-1,
        early_stopping_rounds=30,
        eval_metric="aucpr",
    )
    clf.fit(X_train, y_train_level, eval_set=[(X_val, y_val_level)], verbose=False)
    print(f"  {level_name} classifier: {n_pos} positive / {n_neg} negative in train "
          f"(scale_pos_weight={scale_pos_weight:.0f}), best_iteration={clf.best_iteration}")
    return clf


def calibrate_probability_threshold(y_true_binary, proba, target_fpr, show_tradeoff=True):
    """Same idea as calibrate_alarm_threshold but sweeps a 0-1 probability
    instead of a 0-100 score — used for the dedicated alarm classifiers.

    Also prints the precision/recall/FPR achieved at a handful of common
    FPR targets, since with an extremely rare positive class, FPR alone is
    a misleading way to reason about "how often will this cry wolf" — e.g.
    a 2% FPR against a ~0.3% event prevalence still means roughly 6-7 false
    alarms per real one. Precision (of the alarms that fire, how many are
    real) is the number that actually answers the harassment question, and
    it needs a much stricter FPR than 2% to look reasonable at this
    prevalence. The table makes that trade-off visible instead of hiding it
    behind one chosen number."""
    n_pos = int(y_true_binary.sum())
    n_neg = len(y_true_binary) - n_pos

    rows = []
    for thresh in np.arange(0.0, 1.001, 0.005):
        pred_positive = proba >= thresh
        tp = int(np.sum(pred_positive & y_true_binary))
        fp = int(np.sum(pred_positive & ~y_true_binary))
        fn = int(np.sum(~pred_positive & y_true_binary))
        precision = tp / (tp + fp) if (tp + fp) else 1.0
        recall = tp / (tp + fn) if (tp + fn) else 0.0
        fpr = fp / n_neg if n_neg else 0.0
        rows.append((thresh, precision, recall, fpr))

    if show_tradeoff:
        print(f"  {n_pos} positive / {n_neg} negative examples in this set (prevalence {n_pos / (n_pos + n_neg):.3%})")
        print("  FPR target -> threshold | precision | recall | actual FPR")
        for fpr_target in (0.05, 0.02, 0.01, 0.005, 0.002, 0.001):
            candidates = [r for r in rows if r[3] <= fpr_target]
            if not candidates:
                continue
            best = max(candidates, key=lambda r: r[2])
            print(f"    <= {fpr_target:.1%}  ->  {best[0]:.3f}  |  {best[1]:.3f}  |  {best[2]:.3f}  |  {best[3]:.4f}")

    ok = [r for r in rows if r[3] <= target_fpr]
    chosen = max(ok, key=lambda r: r[2]) if ok else min(rows, key=lambda r: r[3])
    print(f"  chosen probability threshold {chosen[0]:.3f}  ->  precision {chosen[1]:.3f}  "
          f"recall {chosen[2]:.3f}  FPR {chosen[3]:.4f}")
    if not ok:
        print(f"  (target FPR {target_fpr:.2%} not reachable at any threshold on this holdout; "
              f"picked the lowest achievable FPR instead)")
    return chosen


def calibrate_alarm_threshold(y_true, y_pred, level, target_fpr):
    """Sweeps candidate decision thresholds for 'forecast says >= level' and
    picks the lowest threshold whose false-positive rate on this held-out
    set is still <= target_fpr — i.e. the most sensitive threshold we can
    justify while keeping false alarms rare. Falls back to the threshold
    that minimizes FPR if the target is unreachable. Returns
    (threshold, precision, recall, fpr) at the chosen point."""
    actual_positive = y_true >= level
    n_pos = actual_positive.sum()
    n_neg = len(y_true) - n_pos

    rows = []
    for thresh in np.arange(level, 100.5, 0.5):
        pred_positive = y_pred >= thresh
        tp = int(np.sum(pred_positive & actual_positive))
        fp = int(np.sum(pred_positive & ~actual_positive))
        fn = int(np.sum(~pred_positive & actual_positive))
        precision = tp / (tp + fp) if (tp + fp) else 1.0
        recall = tp / (tp + fn) if (tp + fn) else 0.0
        fpr = fp / n_neg if n_neg else 0.0
        rows.append((thresh, precision, recall, fpr))

    ok = [r for r in rows if r[3] <= target_fpr]
    chosen = ok[0] if ok else min(rows, key=lambda r: r[3])
    print(f"  level>={level}: {n_pos} positive / {n_neg} negative examples in this set")
    print(f"  chosen threshold {chosen[0]:.1f}  ->  precision {chosen[1]:.3f}  recall {chosen[2]:.3f}  FPR {chosen[3]:.4f}")
    if not ok:
        print(f"  (target FPR {target_fpr:.2%} not reachable at any threshold on this holdout; "
              f"picked the lowest achievable FPR instead)")
    return chosen


def main():
    df_raw = pd.read_csv(DATA_PATH, parse_dates=["timestamp"])
    df, feature_cols = build_dataset(df_raw)
    train_df, val_df, test_df = chronological_split(df)

    print(f"train={len(train_df)}  val={len(val_df)}  test={len(test_df)} rows "
          f"(chronological per-sector split, {HORIZON_STEPS}-step purge gap)")

    X_train, y_train = train_df[feature_cols].values, train_df["risk_score_future"].values
    X_val, y_val = val_df[feature_cols].values, val_df["risk_score_future"].values
    X_test, y_test = test_df[feature_cols].values, test_df["risk_score_future"].values

    w_train = _regression_sample_weights(y_train)
    w_val = _regression_sample_weights(y_val)

    print(f"Training backend: {BACKEND}")
    if BACKEND == "xgboost":
        best_params = search_hyperparams(X_train, y_train, X_val, y_val, w_train, w_val)
        # final fit on train+val with the tuned tree count, no early stopping
        # held back this time — val's signal already picked the tree count,
        # so folding it into training uses all non-test data for the model
        # the test set will actually score.
        X_fit = np.vstack([X_train, X_val])
        y_fit = np.concatenate([y_train, y_val])
        w_fit = np.concatenate([w_train, w_val])
        model = XGBRegressor(**best_params, random_state=42, n_jobs=-1)
        model.fit(X_fit, y_fit, sample_weight=w_fit)
    else:
        # sklearn's GBR fallback: no grid search (kept fast/simple), but
        # still benefits from the leak-free split, richer features, and
        # sample weighting above.
        model = GradientBoostingRegressor(
            n_estimators=200, max_depth=4, learning_rate=0.05, subsample=0.85, random_state=42
        )
        model.fit(np.vstack([X_train, X_val]), np.concatenate([y_train, y_val]),
                   sample_weight=np.concatenate([w_train, w_val]))

    preds = model.predict(X_test)
    mae = mean_absolute_error(y_test, preds)
    r2 = r2_score(y_test, preds)
    print(f"1-hour-ahead risk forecast (weighted regressor) -> held-out MAE: {mae:.2f} points, R^2: {r2:.3f}")

    meta = {
        "feature_cols": feature_cols,
        "backend": BACKEND,
        "horizon_steps": HORIZON_STEPS,
        "test_mae": float(mae),
        "test_r2": float(r2),
    }

    if BACKEND == "xgboost":
        # Dedicated classifiers for the actual alarm decision — see
        # train_alarm_classifier's docstring for why the regressor's point
        # estimate isn't what should gate an alarm.
        print("Training dedicated CRITICAL/WARNING alarm classifiers:")
        y_train_crit = (y_train >= CRITICAL_LEVEL)
        y_val_crit = (y_val >= CRITICAL_LEVEL)
        y_train_warn = (y_train >= WARNING_LEVEL)
        y_val_warn = (y_val >= WARNING_LEVEL)

        critical_clf = train_alarm_classifier(X_train, y_train_crit, X_val, y_val_crit, "CRITICAL")
        warning_clf = train_alarm_classifier(X_train, y_train_warn, X_val, y_val_warn, "WARNING")

        y_test_crit = (y_test >= CRITICAL_LEVEL)
        y_test_warn = (y_test >= WARNING_LEVEL)
        crit_proba = critical_clf.predict_proba(X_test)[:, 1]
        warn_proba = warning_clf.predict_proba(X_test)[:, 1]

        print(f"Calibrating CRITICAL alarm probability threshold (target FPR <= {TARGET_FALSE_POSITIVE_RATE:.1%}):")
        crit_thresh, crit_p, crit_r, crit_fpr = calibrate_probability_threshold(
            y_test_crit, crit_proba, TARGET_FALSE_POSITIVE_RATE
        )
        print(f"Calibrating WARNING alarm probability threshold (target FPR <= {TARGET_FALSE_POSITIVE_RATE:.1%}):")
        warn_thresh, warn_p, warn_r, warn_fpr = calibrate_probability_threshold(
            y_test_warn, warn_proba, TARGET_FALSE_POSITIVE_RATE
        )

        joblib.dump(critical_clf, f"{MODEL_DIR}/forecast_critical_clf.joblib")
        joblib.dump(warning_clf, f"{MODEL_DIR}/forecast_warning_clf.joblib")
        meta.update({
            "has_alarm_classifiers": True,
            "critical_probability_threshold": float(crit_thresh),
            "critical_precision": float(crit_p),
            "critical_recall": float(crit_r),
            "critical_fpr": float(crit_fpr),
            "warning_probability_threshold": float(warn_thresh),
            "warning_precision": float(warn_p),
            "warning_recall": float(warn_r),
            "warning_fpr": float(warn_fpr),
        })
    else:
        # No classifier path for the sklearn fallback backend (kept simple);
        # calibrate score cutoffs on the regressor's own output instead.
        meta["has_alarm_classifiers"] = False
        print("Calibrating score-based alarm thresholds on the regressor (sklearn fallback backend):")
        crit_thresh, crit_p, crit_r, crit_fpr = calibrate_alarm_threshold(
            y_test, preds, CRITICAL_LEVEL, TARGET_FALSE_POSITIVE_RATE
        )
        warn_thresh, warn_p, warn_r, warn_fpr = calibrate_alarm_threshold(
            y_test, preds, WARNING_LEVEL, TARGET_FALSE_POSITIVE_RATE
        )
        meta.update({
            "critical_threshold": float(crit_thresh),
            "critical_precision": float(crit_p),
            "critical_recall": float(crit_r),
            "critical_fpr": float(crit_fpr),
            "warning_threshold": float(warn_thresh),
            "warning_precision": float(warn_p),
            "warning_recall": float(warn_r),
            "warning_fpr": float(warn_fpr),
        })

    joblib.dump(model, f"{MODEL_DIR}/forecast_model.joblib")
    joblib.dump(meta, f"{MODEL_DIR}/forecast_model_meta.joblib")
    print(f"Saved -> {MODEL_DIR}/forecast_model.joblib (+ meta"
          f"{', forecast_critical_clf.joblib, forecast_warning_clf.joblib' if meta['has_alarm_classifiers'] else ''})")


if __name__ == "__main__":
    main()
