import torch
import torch.nn as nn
import numpy as np
import math

FEATURE_NAMES = ["voltage_V", "current_A", "power_W", "frequency_Hz", "power_factor"]

class Autoencoder(nn.Module):
    def __init__(self, input_dim=5, latent_dim=2):
        super().__init__()
        self.encoder = nn.Sequential(
            nn.Linear(input_dim, 16), nn.ReLU(),
            nn.Linear(16, 8), nn.ReLU(),
            nn.Linear(8, latent_dim)
        )
        self.decoder = nn.Sequential(
            nn.Linear(latent_dim, 8), nn.ReLU(),
            nn.Linear(8, 16), nn.ReLU(),
            nn.Linear(16, input_dim)
        )

    def forward(self, x):
        return self.decoder(self.encoder(x))

class AutoencoderDetector:
    def __init__(self, n_baseline: int = 400):
        self.model = Autoencoder(input_dim=5, latent_dim=2)
        self.optimizer = torch.optim.Adam(self.model.parameters(), lr=0.005)
        self.buffer = []
        self.mean = np.array([220.0, 3.8, 800.0, 50.0, 0.95], dtype=np.float32)
        self.std  = np.array([3.0, 2.5, 450.0, 0.1, 0.03], dtype=np.float32)
        self.recent_errors = []
        self.threshold = 0.15
        self.trained = False

        self._initialize_baseline(n_baseline)

    def _normalize(self, arr: np.ndarray) -> np.ndarray:
        return (arr - self.mean) / (self.std + 1e-6)

    def _initialize_baseline(self, n_samples: int):
        """Train autoencoder on synthetic normal baseline to learn reconstruction of nominal patterns."""
        np.random.seed(42)
        torch.manual_seed(42)
        v = np.random.normal(220.0, 2.5, n_samples)
        freq = np.random.normal(50.0, 0.05, n_samples)
        pf = np.random.normal(0.95, 0.02, n_samples)
        power = np.random.uniform(200.0, 1800.0, n_samples)
        current = power / (v * pf)

        raw = np.column_stack([v, current, power, freq, pf]).astype(np.float32)
        self.mean = raw.mean(axis=0)
        self.std  = raw.std(axis=0) + 1e-6

        X = torch.tensor(self._normalize(raw), dtype=torch.float32)

        # Train for 40 epochs on baseline
        criterion = nn.MSELoss()
        for epoch in range(40):
            self.optimizer.zero_grad()
            reconstructed = self.model(X)
            loss = criterion(reconstructed, X)
            loss.backward()
            self.optimizer.step()

        # Compute dynamic threshold based on 3-sigma rule: mean + 3 * std
        with torch.no_grad():
            reconstructed = self.model(X)
            errors = ((reconstructed - X) ** 2).mean(dim=1).numpy()
            self.recent_errors = errors.tolist()
            self.threshold = float(np.mean(errors) + 3.0 * np.std(errors))
            self.trained = True

    def add_and_train(self, voltage: float, current: float, power: float, frequency: float, power_factor: float):
        vals = [voltage, current, power, frequency, power_factor]
        if not all(math.isfinite(x) for x in vals):
            return

        self.buffer.append(vals)
        if len(self.buffer) > 500:
            self.buffer.pop(0)

        if len(self.buffer) >= 30:
            raw = np.array(self.buffer[-60:], dtype=np.float32)
            X = torch.tensor(self._normalize(raw), dtype=torch.float32)
            self.optimizer.zero_grad()
            reconstructed = self.model(X)
            loss = nn.MSELoss()(reconstructed, X)
            loss.backward()
            self.optimizer.step()

    def predict(self, voltage: float, current: float, power: float, frequency: float, power_factor: float) -> dict:
        vals = [voltage, current, power, frequency, power_factor]
        if not all(math.isfinite(x) for x in vals):
            return {
                "ae_anomaly": False,
                "reconstruction_error": 0.0,
                "ae_threshold": round(self.threshold, 4),
                "ae_ready": True,
                "flagged_feature": "None"
            }

        raw = np.array([vals], dtype=np.float32)
        norm_val = self._normalize(raw)
        x = torch.tensor(norm_val, dtype=torch.float32)

        with torch.no_grad():
            recon = self.model(x)
            per_feature_error = ((recon - x) ** 2).squeeze(0).numpy()
            total_error = float(per_feature_error.mean())

        top_feat_idx = int(np.argmax(per_feature_error))
        top_feat = FEATURE_NAMES[top_feat_idx]

        is_anomaly = bool(total_error > self.threshold)
        return {
            "ae_anomaly": is_anomaly,
            "reconstruction_error": round(total_error, 4),
            "ae_threshold": round(self.threshold, 4),
            "ae_ready": True,
            "flagged_feature": top_feat if is_anomaly else "None"
        }