"""
Multi-variate Anomaly Detection Training
==========================================
Trains an Isolation Forest on correlated sensor features (+ rolling
rate-of-change) to catch subtle out-of-distribution patterns that simple
threshold rules miss (e.g. a slow simultaneous drift across 3 gases, none
of which individually crosses its threshold yet).

Exports:
  models/isolation_forest.joblib
  models/feature_scaler.joblib
"""

import pandas as pd
import numpy as np
import joblib
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import classification_report, roc_auc_score

from risk_scoring import FEATURE_ORDER

DATA_PATH = "data/telemetry_timeseries.csv"
MODEL_DIR = "models"
ROLLING_WINDOW = 10  # samples (~5 min at 30s interval)


def build_features(df: pd.DataFrame) -> pd.DataFrame:
    """Base readings + rolling mean/std/rate-of-change per sector, to give
    the model temporal context beyond a single instantaneous reading."""
    df = df.sort_values(["sector_id", "timestamp"]).copy()
    feats = [df[FEATURE_ORDER]]

    for col in FEATURE_ORDER:
        grp = df.groupby("sector_id")[col]
        roll_mean = grp.transform(lambda s: s.rolling(ROLLING_WINDOW, min_periods=1).mean())
        roll_std = grp.transform(lambda s: s.rolling(ROLLING_WINDOW, min_periods=1).std().fillna(0))
        rate = grp.transform(lambda s: s.diff().fillna(0))
        feats.append(roll_mean.rename(f"{col}_roll_mean"))
        feats.append(roll_std.rename(f"{col}_roll_std"))
        feats.append(rate.rename(f"{col}_rate"))

    return pd.concat(feats, axis=1)


def main():
    df = pd.read_csv(DATA_PATH, parse_dates=["timestamp"])
    features = build_features(df)
    labels = df["is_anomaly"].values

    # Train mostly on normal data (Isolation Forest is unsupervised, but we
    # bias the training set toward normal operation as is standard practice).
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(features.values)

    contamination = max(0.01, min(0.10, labels.mean()))
    model = IsolationForest(
        n_estimators=200,
        contamination=contamination,
        max_samples="auto",
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X_scaled)

    # Evaluate: IsolationForest.predict -> 1 normal, -1 anomaly
    preds = model.predict(X_scaled)
    pred_anomaly = (preds == -1).astype(int)

    print("=== Isolation Forest evaluation vs injected anomaly labels ===")
    print(classification_report(labels, pred_anomaly, target_names=["normal", "anomaly"]))

    scores = -model.decision_function(X_scaled)  # higher = more anomalous
    try:
        auc = roc_auc_score(labels, scores)
        print(f"ROC-AUC (anomaly score vs ground truth): {auc:.3f}")
    except ValueError:
        pass

    # NOTE: only the base FEATURE_ORDER columns (instantaneous reading) are
    # used at inference time via risk_scoring.anomaly_component, since a live
    # request may not carry full rolling history. Retrain a lightweight
    # base-features-only model for that exact use case:
    base_scaler = StandardScaler()
    X_base = base_scaler.fit_transform(features[FEATURE_ORDER].values)
    base_model = IsolationForest(
        n_estimators=200, contamination=contamination, random_state=42, n_jobs=-1
    )
    base_model.fit(X_base)

    joblib.dump(base_model, f"{MODEL_DIR}/isolation_forest.joblib")
    joblib.dump(base_scaler, f"{MODEL_DIR}/feature_scaler.joblib")
    print(f"\nSaved -> {MODEL_DIR}/isolation_forest.joblib, {MODEL_DIR}/feature_scaler.joblib")


if __name__ == "__main__":
    main()
