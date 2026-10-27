import React, { useState } from "react";

export default function SettingsPanel({
  settings,
  onSaveSettings,
  appliances
}) {
  const [formData, setFormData] = useState({
    reference_voltage: settings?.reference_voltage || 220.0,
    lower_threshold: settings?.lower_threshold || 200.0,
    upper_threshold: settings?.upper_threshold || 240.0,
    simulation_interval: settings?.simulation_interval || 2.0,
    electricity_tariff: settings?.electricity_tariff || 8.00,
    co2_emissions_factor: settings?.co2_emissions_factor || 0.380,
    contamination: settings?.contamination || 0.08,
  });

  const [statusMsg, setStatusMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: parseFloat(value) || 0
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorMsg(null);
    setStatusMsg(null);

    // Strict validation
    if (formData.reference_voltage < 100 || formData.reference_voltage > 400) {
      setErrorMsg("Reference voltage must be between 100 V and 400 V.");
      return;
    }
    if (formData.lower_threshold < 50 || formData.lower_threshold >= formData.reference_voltage) {
      setErrorMsg("Lower threshold must be greater than 50 V and strictly less than reference voltage.");
      return;
    }
    if (formData.upper_threshold <= formData.reference_voltage || formData.upper_threshold > 500) {
      setErrorMsg("Upper threshold must be strictly greater than reference voltage and at most 500 V.");
      return;
    }
    if (formData.simulation_interval < 0.2 || formData.simulation_interval > 30) {
      setErrorMsg("Simulation interval must be between 0.2 seconds and 30 seconds.");
      return;
    }
    if (formData.electricity_tariff <= 0) {
      setErrorMsg("Electricity tariff must be positive.");
      return;
    }
    if (formData.co2_emissions_factor <= 0) {
      setErrorMsg("CO2 emissions factor must be positive.");
      return;
    }

    onSaveSettings(formData);
    setStatusMsg("Settings saved and operational thresholds synchronized across simulation engine.");
    setTimeout(() => setStatusMsg(null), 4000);
  };

  const handleResetDefaults = () => {
    const defaults = {
      reference_voltage: 220.0,
      lower_threshold: 200.0,
      upper_threshold: 240.0,
      simulation_interval: 2.0,
      electricity_tariff: 8.00,
      co2_emissions_factor: 0.380,
      contamination: 0.08,
    };
    setFormData(defaults);
    onSaveSettings(defaults);
    setStatusMsg("Restored factory demonstration thresholds (220V ref, 200V min, 240V max).");
    setTimeout(() => setStatusMsg(null), 4000);
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", marginBottom: "2rem" }}>
      <div className="industrial-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <h2 style={{ fontSize: "1.2rem", fontWeight: 800, margin: 0, color: "var(--text-main)" }}>
              Simulation & Threshold Configuration
            </h2>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: "4px 0 0" }}>
              Fine-tune electrical safety boundaries, interval timers, emissions benchmarks, and AI hyper-parameters
            </p>
          </div>

          <button
            type="button"
            onClick={handleResetDefaults}
            className="btn btn-secondary"
            style={{ fontSize: "0.8rem" }}
          >
            Reset Defaults
          </button>
        </div>

        {errorMsg && (
          <div style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#b91c1c",
            padding: "0.75rem 1rem",
            borderRadius: "8px",
            fontSize: "0.85rem",
            marginBottom: "1rem"
          }}>
            ⚠️ {errorMsg}
          </div>
        )}

        {statusMsg && (
          <div style={{
            background: "#ecfdf5",
            border: "1px solid #a7f3d0",
            color: "#047857",
            padding: "0.75rem 1rem",
            borderRadius: "8px",
            fontSize: "0.85rem",
            marginBottom: "1rem"
          }}>
            ✅ {statusMsg}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Section 1: Voltage Boundaries */}
          <div style={{ marginBottom: "1.5rem" }}>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#0284c7", marginBottom: "0.75rem", textTransform: "uppercase", letterSpacing: "0.03em" }}>
              1. Electrical Supply & Voltage Thresholds
            </h3>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "var(--text-dim)", marginBottom: "4px" }}>
                  Reference Voltage (V)
                </label>
                <input
                  type="number"
                  step="0.5"
                  name="reference_voltage"
                  value={formData.reference_voltage}
                  onChange={handleChange}
                  className="form-input"
                />
                <span style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>Nominal standard (default 220.0 V)</span>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "var(--text-dim)", marginBottom: "4px" }}>
                  Lower Threshold (V)
                </label>
                <input
                  type="number"
                  step="0.5"
                  name="lower_threshold"
                  value={formData.lower_threshold}
                  onChange={handleChange}
                  className="form-input"
                />
                <span style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>Values below this trigger LOW VOLTAGE (default 200.0 V)</span>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "var(--text-dim)", marginBottom: "4px" }}>
                  Upper Threshold (V)
                </label>
                <input
                  type="number"
                  step="0.5"
                  name="upper_threshold"
                  value={formData.upper_threshold}
                  onChange={handleChange}
                  className="form-input"
                />
                <span style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>Values above this trigger HIGH VOLTAGE (default 240.0 V)</span>
              </div>
            </div>
          </div>

          {/* Section 2: Engine & Analytics */}
          <div style={{ marginBottom: "1.5rem" }}>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#0284c7", marginBottom: "0.75rem", textTransform: "uppercase", letterSpacing: "0.03em" }}>
              2. Simulation Cadence & Economic Factors
            </h3>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "var(--text-dim)", marginBottom: "4px" }}>
                  Simulation Interval (seconds)
                </label>
                <input
                  type="number"
                  step="0.5"
                  name="simulation_interval"
                  value={formData.simulation_interval}
                  onChange={handleChange}
                  className="form-input"
                />
                <span style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>Cadence between consecutive readings (default 2.0 s)</span>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "var(--text-dim)", marginBottom: "4px" }}>
                  Electricity Tariff (₹ / kWh)
                </label>
                <input
                  type="number"
                  step="0.25"
                  name="electricity_tariff"
                  value={formData.electricity_tariff}
                  onChange={handleChange}
                  className="form-input"
                />
                <span style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>Base domestic/commercial tariff (default ₹8.00)</span>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "var(--text-dim)", marginBottom: "4px" }}>
                  CO₂ Factor (kg CO₂ / kWh)
                </label>
                <input
                  type="number"
                  step="0.005"
                  name="co2_emissions_factor"
                  value={formData.co2_emissions_factor}
                  onChange={handleChange}
                  className="form-input"
                />
                <span style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>Grid emission factor (default 0.380 kg CO₂/kWh)</span>
              </div>
            </div>
          </div>

          {/* Section 3: AI Configuration */}
          <div style={{ marginBottom: "1.5rem" }}>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#0284c7", marginBottom: "0.75rem", textTransform: "uppercase", letterSpacing: "0.03em" }}>
              3. Machine Learning Sensitivity
            </h3>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "var(--text-dim)", marginBottom: "4px" }}>
                  Isolation Forest Contamination Rate
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max="0.25"
                  name="contamination"
                  value={formData.contamination}
                  onChange={handleChange}
                  className="form-input"
                />
                <span style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>Proportion of expected statistical outliers (default 0.08)</span>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ padding: "0.65rem 1.5rem" }}
            >
              Save Configuration
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
