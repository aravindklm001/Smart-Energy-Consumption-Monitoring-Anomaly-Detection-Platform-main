import React from "react";

export default function VoltageClassificationCard({ reading, settings }) {
  const r = reading || {};
  const s = settings || { reference_voltage: 220.0, lower_threshold: 200.0, upper_threshold: 240.0 };

  const voltage = r.voltage_V !== undefined ? r.voltage_V : 220.0;
  const refV = s.reference_voltage || 220.0;
  const lowerV = s.lower_threshold || 200.0;
  const upperV = s.upper_threshold || 240.0;

  // Exact rule evaluation
  let status = "NORMAL";
  let severity = "NORMAL";
  if (voltage < lowerV) {
    status = "LOW VOLTAGE";
    severity = voltage < (lowerV - 15) ? "CRITICAL" : "WARNING";
  } else if (voltage > upperV) {
    status = "HIGH VOLTAGE";
    severity = voltage > (upperV + 10) ? "CRITICAL" : "WARNING";
  } else {
    status = "NORMAL";
    severity = "NORMAL";
  }

  const devV = Number((voltage - refV).toFixed(1));
  const devPct = Number(((devV / refV) * 100).toFixed(2));
  const timeStr = r.timestamp ? new Date(r.timestamp * 1000).toLocaleTimeString() : new Date().toLocaleTimeString();

  const getStatusBadge = () => {
    if (status === "HIGH VOLTAGE") return <span className="badge badge-critical">HIGH VOLTAGE</span>;
    if (status === "LOW VOLTAGE") return <span className="badge badge-warning">LOW VOLTAGE</span>;
    return <span className="badge badge-normal">NORMAL</span>;
  };

  const getSeverityBadge = () => {
    if (severity === "CRITICAL") return <span className="badge badge-critical">SEVERITY: CRITICAL</span>;
    if (severity === "WARNING") return <span className="badge badge-warning">SEVERITY: WARNING</span>;
    return <span className="badge badge-normal">SEVERITY: NORMAL</span>;
  };

  // Calculate percentage indicator on [160V, 280V] range for visual bar
  const minRange = 160;
  const maxRange = 280;
  const clampedV = Math.max(minRange, Math.min(maxRange, voltage));
  const needlePct = ((clampedV - minRange) / (maxRange - minRange)) * 100;
  const lowerPct = ((lowerV - minRange) / (maxRange - minRange)) * 100;
  const upperPct = ((upperV - minRange) / (maxRange - minRange)) * 100;
  const refPct = ((refV - minRange) / (maxRange - minRange)) * 100;

  return (
    <div className="industrial-card" style={{ marginBottom: "1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", marginBottom: "1rem" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "1.2rem" }}>⚡</span>
            <h2 style={{ fontSize: "1.05rem", fontWeight: 700, margin: 0, color: "var(--text-main)" }}>
              Supply Voltage Classification & Deviation Analysis
            </h2>
          </div>
          <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", margin: "4px 0 0" }}>
            Deterministic rule engine assessing grid power quality and boundary compliance
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {getStatusBadge()}
          {getSeverityBadge()}
        </div>
      </div>

      {/* Primary Metrics Grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        gap: "0.75rem",
        background: "var(--bg-secondary)",
        padding: "1rem",
        borderRadius: "8px",
        border: "1px solid var(--border-subtle)",
        marginBottom: "1.25rem"
      }}>
        <div>
          <div style={{ fontSize: "0.72rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 600 }}>
            Measured Voltage
          </div>
          <div className="font-mono" style={{
            fontSize: "1.6rem", fontWeight: 700,
            color: status === "HIGH VOLTAGE" ? "#dc2626" : status === "LOW VOLTAGE" ? "#d97706" : "#059669"
          }}>
            {voltage.toFixed(1)} V
          </div>
          <div style={{ fontSize: "0.7rem", color: "var(--text-dim)" }}>
            Observed at {timeStr}
          </div>
        </div>

        <div>
          <div style={{ fontSize: "0.72rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 600 }}>
            Configured Reference
          </div>
          <div className="font-mono" style={{ fontSize: "1.6rem", fontWeight: 700, color: "#0284c7" }}>
            {refV.toFixed(1)} V
          </div>
          <div style={{ fontSize: "0.7rem", color: "var(--text-dim)" }}>
            Nominal standard baseline
          </div>
        </div>

        <div>
          <div style={{ fontSize: "0.72rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 600 }}>
            Voltage Deviation
          </div>
          <div className="font-mono" style={{
            fontSize: "1.6rem", fontWeight: 700,
            color: Math.abs(devV) > 20 ? "#dc2626" : Math.abs(devV) > 10 ? "#d97706" : "#059669"
          }}>
            {devV > 0 ? `+${devV}` : devV} V
          </div>
          <div style={{ fontSize: "0.7rem", color: "var(--text-dim)" }}>
            {devPct > 0 ? `+${devPct}` : devPct}% of reference
          </div>
        </div>

        <div>
          <div style={{ fontSize: "0.72rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 600 }}>
            Threshold Limits
          </div>
          <div className="font-mono" style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--text-main)", marginTop: "4px" }}>
            <span style={{ color: "#d97706" }}>{lowerV.toFixed(0)} V</span>
            <span style={{ color: "var(--text-dim)", margin: "0 6px" }}>to</span>
            <span style={{ color: "#dc2626" }}>{upperV.toFixed(0)} V</span>
          </div>
          <div style={{ fontSize: "0.7rem", color: "var(--text-dim)" }}>
            [200.0V & 240.0V: NORMAL]
          </div>
        </div>
      </div>

      {/* Visual Voltage Scale Bar */}
      <div style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "var(--text-dim)", marginBottom: "4px" }}>
          <span>160 V (Severe Undervoltage)</span>
          <span style={{ color: "#d97706", fontWeight: 600 }}>Lower Limit ({lowerV}V)</span>
          <span style={{ color: "#0284c7", fontWeight: 600 }}>Reference ({refV}V)</span>
          <span style={{ color: "#dc2626", fontWeight: 600 }}>Upper Limit ({upperV}V)</span>
          <span>280 V (Severe Overvoltage)</span>
        </div>

        <div style={{
          position: "relative",
          height: 18,
          background: "#e2e8f0",
          borderRadius: 9,
          overflow: "hidden",
          border: "1px solid var(--border-subtle)"
        }}>
          {/* Low Voltage Zone */}
          <div style={{
            position: "absolute", left: 0, width: `${lowerPct}%`, height: "100%",
            background: "#fef3c7"
          }} />

          {/* Normal Zone */}
          <div style={{
            position: "absolute", left: `${lowerPct}%`, width: `${upperPct - lowerPct}%`, height: "100%",
            background: "#d1fae5"
          }} />

          {/* High Voltage Zone */}
          <div style={{
            position: "absolute", left: `${upperPct}%`, right: 0, height: "100%",
            background: "#fee2e2"
          }} />

          {/* Reference Line Marker */}
          <div style={{
            position: "absolute", left: `${refPct}%`, width: 2, height: "100%",
            background: "#0284c7"
          }} />

          {/* Current Needle Marker */}
          <div style={{
            position: "absolute",
            left: `calc(${needlePct}% - 5px)`,
            width: 10,
            height: "100%",
            background: "#0f172a",
            borderRadius: 5,
            boxShadow: "0 0 6px rgba(0,0,0,0.3)",
            transition: "left 0.3s ease"
          }} />
        </div>
      </div>

      {/* Mandatory Engineering Safety Disclaimer */}
      <div style={{
        background: "var(--bg-secondary)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "6px",
        padding: "0.6rem 0.85rem",
        fontSize: "0.75rem",
        color: "var(--text-muted)",
        display: "flex",
        alignItems: "center",
        gap: "0.5rem"
      }}>
        <span>ℹ️</span>
        <span>
          <strong>Engineering Note:</strong> The reference voltage (220 V) and operating limits (200 V – 240 V) are configurable demonstration thresholds for simulated testing, not a substitute for applicable national electrical safety standards (e.g., IEC 60038 / EN 50160).
        </span>
      </div>
    </div>
  );
}
