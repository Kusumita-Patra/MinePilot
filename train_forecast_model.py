"""
Time-Series Forecasting: Risk Index 15 Minutes Ahead
======================================================
Builds rolling-window rate-of-change features per sector and trains a
regressor to predict the current-rule-based risk_score value 15 minutes
into the future (30 samples ahead at 30s/sample).

Tries XGBoost first (best performance); falls back automatically to
sklearn's GradientBoostingRegressor if xgboost isn't installed, so this
script always runs even in a restricted environment. Install xgboost
locally (`pip install xgboost`) for the intended model.

Exports:
  models/forecast_model.joblib
  models/forecast_model_meta.joblib   (feature list + which backend was used)
"""

import pandas as pd
import numpy as np
import joblib
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, r2_score

from risk_scoring import FEATURE_ORDER, THRESHOLDS, WEIGHTS

DATA_PATH = "data/telemetry_timeseries.csv"
MODEL_DIR = "models"
ROLLING_WINDOW = 10
HORIZON_STEPS = 30  # 30 samples * 30s = 15 minutes ahead

try:
    from xgboost import XGBRegressor
    BACKEND = "xgboost"
except ImportError:
    from sklearn.ensemble import GradientBoostingRegressor
    BACKEND = "sklearn_gbr"


def _vectorized_rule_score(df: pd.DataFrame) -> pd.Series:
    """Vectorized equivalent of risk_scoring.rule_based_component, applied to
    an entire DataFrame at once (the row-wise .apply() version is far too
    slow at 100k+ rows)."""
    score = pd.Series(0.0, index=df.index)
    for key, threshold in THRESHOLDS.items():
        ratio = (df[key] / threshold).clip(lower=0.0, upper=1.3)
        score += ratio * WEIGHTS[key] * 100
    return score.clip(upper=100.0)


def build_dataset(df: pd.DataFrame):
    df = df.sort_values(["sector_id", "timestamp"]).copy()

    # target: rule-based risk_score computed from ground-truth thresholds
    df["risk_score_now"] = _vectorized_rule_score(df)

    feature_cols = list(FEATURE_ORDER)
    for col in FEATURE_ORDER:
        grp = df.groupby("sector_id")[col]
        df[f"{col}_roll_mean"] = grp.transform(lambda s: s.rolling(ROLLING_WINDOW, min_periods=1).mean())
        df[f"{col}_roll_std"] = grp.transform(lambda s: s.rolling(ROLLING_WINDOW, min_periods=1).std().fillna(0))
        df[f"{col}_rate"] = grp.transform(lambda s: s.diff().fillna(0))
        feature_cols += [f"{col}_roll_mean", f"{col}_roll_std", f"{col}_rate"]

    # shift target backward per-sector so row t's features predict risk at t+HORIZON
    df["risk_score_future"] = df.groupby("sector_id")["risk_score_now"].shift(-HORIZON_STEPS)
    df = df.dropna(subset=["risk_score_future"])

    X = df[feature_cols].values
    y = df["risk_score_future"].values
    return X, y, feature_cols


def main():
    df = pd.read_csv(DATA_PATH, parse_dates=["timestamp"])
    X, y, feature_cols = build_dataset(df)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, shuffle=True
    )

    print(f"Training backend: {BACKEND}")
    if BACKEND == "xgboost":
        model = XGBRegressor(
            n_estimators=300,
            max_depth=5,
            learning_rate=0.05,
            subsample=0.8,
            colsample_bytree=0.8,
            random_state=42,
            n_jobs=-1,
        )
    else:
        # sklearn's GBR is far slower than xgboost with no early stopping /
        # histogram binning, so we trim trees for the fallback path. Install
        # xgboost for the full 300-estimator model described in the brief.
        model = GradientBoostingRegressor(
            n_estimators=120, max_depth=4, learning_rate=0.08, random_state=42
        )

    model.fit(X_train, y_train)
    preds = model.predict(X_test)

    mae = mean_absolute_error(y_test, preds)
    r2 = r2_score(y_test, preds)
    print(f"15-min-ahead risk forecast -> MAE: {mae:.2f} points, R^2: {r2:.3f}")

    joblib.dump(model, f"{MODEL_DIR}/forecast_model.joblib")
    joblib.dump({"feature_cols": feature_cols, "backend": BACKEND, "horizon_steps": HORIZON_STEPS},
                f"{MODEL_DIR}/forecast_model_meta.joblib")
    print(f"Saved -> {MODEL_DIR}/forecast_model.joblib (+ meta)")


if __name__ == "__main__":
    main()
