import React, { useState } from "react";

export default function SimulationBar({
  simulationRunning,
  onStart,
  onPause,
  onReset,
  onStep,
  onLoadDataset,
  onInject,
  currentVoltage
}) {
  const [customVoltage, setCustomVoltage] = useState(250);
  const [showCustomModal, setShowCustomModal] = useState(false);

  return (
    <div className="industrial-card" style={{
      marginBottom: "1.5rem",
      padding: "1rem 1.25rem"
    }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "1rem"
      }}>
        {/* Playback Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
          <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", marginRight: "0.25rem" }}>
            Engine Controls:
          </span>

          {!simulationRunning ? (
            <button
              onClick={onStart}
              className="btn btn-primary"
              style={{ background: "linear-gradient(135deg, #10b981, #059669)", borderColor: "#059669" }}
              title="Start automatic 2-second simulation loop"
            >
              <span>▶</span> Start Simulation
            </button>
          ) : (
            <button
              onClick={onPause}
              className="btn btn-amber"
              title="Pause simulation timer"
            >
              <span>⏸</span> Pause Simulation
            </button>
          )}

          <button
            onClick={onStep}
            className="btn btn-secondary"
            title="Advance exactly one simulation step"
          >
            <span>⏭</span> Step (+1)
          </button>

          <button
            onClick={onReset}
            className="btn btn-secondary"
            title="Reset simulation to initial state"
          >
            <span>🔄</span> Reset
          </button>

          <button
            onClick={onLoadDataset}
            className="btn btn-secondary"
            title="Reload energy_readings.csv synthetic dataset"
          >
            <span>📁</span> Load Sample Dataset
          </button>
        </div>

        {/* Deterministic Injection Scenarios */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
          <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", marginRight: "0.25rem" }}>
            Inject Scenarios:
          </span>

          <button
            onClick={() => onInject("HIGH_VOLTAGE", 248.0)}
            className="btn btn-danger"
            title="Inject deterministic High Voltage (248.0 V)"
          >
            <span>⚡</span> High Voltage (248 V)
          </button>

          <button
            onClick={() => onInject("LOW_VOLTAGE", 185.0)}
            className="btn btn-amber"
            title="Inject deterministic Low Voltage (185.0 V)"
          >
            <span>🔻</span> Low Voltage (185 V)
          </button>

          <button
            onClick={() => onInject("CURRENT_ANOMALY")}
            className="btn btn-secondary"
            style={{ color: "#7c3aed", borderColor: "#ddd6fe" }}
            title="Inject multi-feature AI anomaly: 22.5A surge + low power factor 0.45"
          >
            <span>〰️</span> Current Anomaly
          </button>

          <button
            onClick={() => onInject("NORMAL", 220.0)}
            className="btn btn-success"
            title="Return to nominal 220.0 V baseline"
          >
            <span>🟢</span> Return to Normal (220 V)
          </button>

          <button
            onClick={() => setShowCustomModal(!showCustomModal)}
            className="btn btn-secondary"
            style={{ fontSize: "0.8rem", padding: "0.55rem 0.75rem" }}
            title="Configure custom injection voltage"
          >
            <span>⚙️ Custom</span>
          </button>
        </div>
      </div>

      {/* Custom Voltage Injection Drawer */}
      {showCustomModal && (
        <div style={{
          marginTop: "1rem",
          paddingTop: "1rem",
          borderTop: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          flexWrap: "wrap"
        }}>
          <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
            Configure Injected Voltage:
          </span>
          <input
            type="range"
            min="160"
            max="280"
            step="1"
            value={customVoltage}
            onChange={(e) => setCustomVoltage(Number(e.target.value))}
            style={{ flex: "1", maxWidth: 280, accentColor: "#0284c7" }}
          />
          <div className="font-mono" style={{ fontSize: "1rem", fontWeight: 700, color: customVoltage > 240 ? "#dc2626" : customVoltage < 200 ? "#d97706" : "#059669", minWidth: 65 }}>
            {customVoltage} V
          </div>
          <button
            onClick={() => {
              if (customVoltage > 240) onInject("HIGH_VOLTAGE", customVoltage);
              else if (customVoltage < 200) onInject("LOW_VOLTAGE", customVoltage);
              else onInject("NORMAL", customVoltage);
            }}
            className="btn btn-primary"
            style={{ padding: "0.4rem 0.85rem", fontSize: "0.8rem" }}
          >
            Apply Injected Voltage
          </button>
          <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
            (Boundary tests: 199.9V, 200V, 220V, 240V, 240.1V)
          </span>
        </div>
      )}
    </div>
  );
}
