from sklearn.ensemble import IsolationForest
import numpy as np
import math

# Feature order: [voltage_V, current_A, power_W, frequency_Hz, power_factor]
FEATURE_NAMES = ["voltage_V", "current_A", "power_W", "frequency_Hz", "power_factor"]

class EnergyAnomalyDetector:
    def __init__(self, contamination: float = 0.08, n_baseline: int = 400):
        self.contamination = contamination
        self.model = IsolationForest(
            contamination=contamination,
            random_state=42,
            n_estimators=100,
            max_samples="auto"
        )
        self.buffer = []
        self.trained = False
        self.samples_since_retrain = 0
        self.retrain_every = 50

        # Baseline stats for explanation
        self.baseline_means = np.array([220.0, 3.8, 800.0, 50.0, 0.95])
        self.baseline_stds = np.array([3.0, 2.5, 450.0, 0.1, 0.03])

        # Pre-train with synthetic normal baseline data so model is immediately operational
        self._initialize_baseline(n_baseline)

    def _initialize_baseline(self, n_samples: int):
        """Train on documented nominal synthetic operating baseline."""
        np.random.seed(42)
        v = np.random.normal(220.0, 2.5, n_samples)
        freq = np.random.normal(50.0, 0.05, n_samples)
        pf = np.random.normal(0.95, 0.02, n_samples)
        # Power between 150W and 2000W
        power = np.random.uniform(200.0, 1800.0, n_samples)
        # Current = P / (V * PF)
        current = power / (v * pf)

        baseline_data = np.column_stack([v, current, power, freq, pf])
        for row in baseline_data[:100]:
            self.buffer.append(list(row))

        self.model.fit(baseline_data)
        self.trained = True
        self.baseline_means = baseline_data.mean(axis=0)
        self.baseline_stds = baseline_data.std(axis=0) + 1e-6

    def add_reading(self, voltage: float, current: float, power: float, frequency: float, power_factor: float):
        vals = [voltage, current, power, frequency, power_factor]
        if not all(math.isfinite(x) for x in vals):
            return

        self.buffer.append(vals)
        if len(self.buffer) > 500:
            self.buffer.pop(0)

        self.samples_since_retrain += 1
        if self.samples_since_retrain >= self.retrain_every and len(self.buffer) >= 50:
            self.model.fit(np.array(self.buffer))
            self.samples_since_retrain = 0

    def predict(self, voltage: float, current: float, power: float, frequency: float, power_factor: float) -> dict:
        vals = [voltage, current, power, frequency, power_factor]
        if not all(math.isfinite(x) for x in vals):
            return {
                "iso_anomaly": False,
                "iso_score": 0.0,
                "iso_ready": True,
                "flagged_feature": "None",
                "explanation": "Invalid non-finite input received"
            }

        X = np.array([vals])
        score = float(self.model.score_samples(X)[0])
        is_anomaly = bool(self.model.predict(X)[0] == -1)

        # Determine feature with largest z-score divergence for explanation
        z_scores = np.abs((np.array(vals) - self.baseline_means) / self.baseline_stds)
        top_idx = int(np.argmax(z_scores))
        top_feature = FEATURE_NAMES[top_idx]
        top_z = float(z_scores[top_idx])

        explanation = ""
        if is_anomaly:
            explanation = f"ML Isolation Forest flagged multidimensional deviation primarily in {top_feature} (z-score: {top_z:.2f})."
        else:
            explanation = "Readings align with multi-feature baseline distribution."

        return {
            "iso_anomaly": is_anomaly,
            "iso_score": round(score, 4),
            "iso_ready": True,
            "flagged_feature": top_feature if is_anomaly else "None",
            "explanation": explanation
        }