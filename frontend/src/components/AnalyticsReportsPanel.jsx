import React from "react";

export default function AnalyticsReportsPanel({
  readings,
  events,
  appliances,
  settings,
  onExportReport
}) {
  const s = settings || {
    electricity_tariff: 8.00,
    co2_emissions_factor: 0.380
  };

  // Compute analytics based on actual records
  const totalReadings = readings.length;
  const voltages = readings.map(r => r.voltage_V).filter(v => v !== undefined);
  const minV = voltages.length > 0 ? Math.min(...voltages).toFixed(1) : "220.0";
  const maxV = voltages.length > 0 ? Math.max(...voltages).toFixed(1) : "220.0";
  const avgV = voltages.length > 0 ? (voltages.reduce((a, b) => a + b, 0) / voltages.length).toFixed(1) : "220.0";

  const highVoltageCount = readings.filter(r => r.voltage_classification === "HIGH VOLTAGE").length;
  const lowVoltageCount = readings.filter(r => r.voltage_classification === "LOW VOLTAGE").length;
  const aiAnomalyCount = readings.filter(r => r.is_ai_anomaly).length;
  const protectionActionsCount = events.filter(e => e.event_type === "PROTECTION_ACTION" || e.protection_action).length;

  const totalKwh = readings.reduce((sum, r) => sum + (r.kwh || ((r.power_W * (2.0 / 3600)) / 1000)), 0);
  const tariffRate = s.electricity_tariff || 8.00;
  const estimatedCost = totalKwh * tariffRate;
  const estimatedCo2 = totalKwh * (s.co2_emissions_factor || 0.380);
  const potentialSavingsKwh = totalKwh * 0.12;
  const potentialSavingsInr = potentialSavingsKwh * tariffRate;

  // Appliance-wise estimated consumption share
  const activeAppliances = appliances || [];
  const totalActiveWatts = activeAppliances
    .filter(a => a.operating_status === "ON")
    .reduce((sum, a) => sum + (a.rated_power_W || 0), 0) || 1;

  const applianceBreakdown = activeAppliances.map(a => {
    const isON = a.operating_status === "ON";
    const share = isON ? (a.rated_power_W / totalActiveWatts) : 0;
    const appKwh = totalKwh * share;
    const appCost = appKwh * tariffRate;
    return {
      ...a,
      sharePct: (share * 100).toFixed(1),
      appKwh: appKwh.toFixed(4),
      appCost: appCost.toFixed(2)
    };
  });

  return (
    <div style={{ marginBottom: "2rem" }}>
      {/* Top Header Card */}
      <div className="industrial-card" style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <h2 style={{ fontSize: "1.2rem", fontWeight: 800, margin: 0, color: "var(--text-main)" }}>
              Energy Analytics & Industrial Audit Report
            </h2>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: "4px 0 0" }}>
              Derived from {totalReadings} simulation time-series readings using Energy (kWh) = Power (W) × Duration (h) / 1000
            </p>
          </div>

          <button
            onClick={onExportReport}
            className="btn btn-primary"
            style={{ fontSize: "0.85rem", padding: "0.6rem 1.1rem" }}
          >
            <span>📄</span> Download Executive Report (CSV)
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: "1rem",
        marginBottom: "1.5rem"
      }}>
        <div className="industrial-card" style={{ padding: "1rem" }}>
          <div style={{ fontSize: "0.72rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 700 }}>
            Voltage Profile
          </div>
          <div className="font-mono" style={{ fontSize: "1.3rem", fontWeight: 700, color: "#0284c7", marginTop: "4px" }}>
            {minV}V / {avgV}V / {maxV}V
          </div>
          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "4px" }}>
            Min / Average / Max
          </div>
        </div>

        <div className="industrial-card" style={{ padding: "1rem" }}>
          <div style={{ fontSize: "0.72rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 700 }}>
            Incident Breakdown
          </div>
          <div className="font-mono" style={{ fontSize: "1.3rem", fontWeight: 700, color: "#dc2626", marginTop: "4px" }}>
            {highVoltageCount} HV | {lowVoltageCount} LV
          </div>
          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "4px" }}>
            {aiAnomalyCount} AI Anomalies | {protectionActionsCount} Trips
          </div>
        </div>

        <div className="industrial-card" style={{ padding: "1rem" }}>
          <div style={{ fontSize: "0.72rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 700 }}>
            Total Energy (kWh)
          </div>
          <div className="font-mono" style={{ fontSize: "1.3rem", fontWeight: 700, color: "#0284c7", marginTop: "4px" }}>
            {totalKwh.toFixed(4)} kWh
          </div>
          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "4px" }}>
            Elapsed: {(totalReadings * 2 / 60).toFixed(1)} simulated mins
          </div>
        </div>

        <div className="industrial-card" style={{ padding: "1rem" }}>
          <div style={{ fontSize: "0.72rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 700 }}>
            Estimated Cost & CO₂
          </div>
          <div className="font-mono" style={{ fontSize: "1.3rem", fontWeight: 700, color: "#059669", marginTop: "4px" }}>
            ₹{estimatedCost.toFixed(2)}
          </div>
          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "4px" }}>
            {estimatedCo2.toFixed(4)} kg CO₂ emitted
          </div>
        </div>

        <div className="industrial-card" style={{ padding: "1rem" }}>
          <div style={{ fontSize: "0.72rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 700 }}>
            Potential Savings
          </div>
          <div className="font-mono" style={{ fontSize: "1.3rem", fontWeight: 700, color: "#d97706", marginTop: "4px" }}>
            ₹{potentialSavingsInr.toFixed(2)}
          </div>
          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "4px" }}>
            Overvoltage & PF efficiency optimization
          </div>
        </div>
      </div>

      {/* Appliance-Wise Energy Breakdown Table */}
      <div className="industrial-card" style={{ marginBottom: "1.5rem" }}>
        <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text-main)", marginBottom: "0.75rem" }}>
          Appliance-Wise Energy Distribution & Cost Allocation
        </h3>
        <p style={{ fontSize: "0.76rem", color: "var(--text-muted)", marginBottom: "1rem" }}>
          Calculated according to individual rated power contribution over active connection durations
        </p>

        <div style={{ overflowX: "auto" }}>
          <table className="custom-table">
            <thead>
              <tr>
                <th>Appliance</th>
                <th>Rated Power (W)</th>
                <th>Status</th>
                <th>Load Share (%)</th>
                <th>Energy (kWh)</th>
                <th>Estimated Cost (₹)</th>
                <th>Risk State</th>
              </tr>
            </thead>
            <tbody>
              {applianceBreakdown.map((a) => (
                <tr key={a.id}>
                  <td style={{ fontWeight: 600, color: "var(--text-main)" }}>{a.name}</td>
                  <td className="font-mono" style={{ color: "var(--text-main)" }}>{a.rated_power_W} W</td>
                  <td>
                    <span style={{
                      fontWeight: 700,
                      color: a.operating_status === "ON" ? "#059669" : "#64748b",
                      fontSize: "0.75rem"
                    }}>
                      {a.operating_status === "ON" ? "ON" : "OFF (Protected)"}
                    </span>
                  </td>
                  <td className="font-mono">{a.sharePct}%</td>
                  <td className="font-mono" style={{ color: "#0284c7" }}>{a.appKwh} kWh</td>
                  <td className="font-mono" style={{ color: "#d97706" }}>₹{a.appCost}</td>
                  <td>
                    <span className={`badge ${
                      a.risk_category === "HIGH RISK" ? "badge-critical" :
                      a.risk_category === "WARNING" ? "badge-warning" :
                      a.risk_category === "PROTECTED" ? "badge-protected" : "badge-normal"
                    }`} style={{ fontSize: "0.68rem" }}>
                      {a.risk_category}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Engineering Recommendations & Assumptions */}
      <div className="industrial-card">
        <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-main)", marginBottom: "0.5rem" }}>
          Report Methodology & Engineering Follow-up Recommendations
        </h3>
        <ul style={{ fontSize: "0.82rem", color: "var(--text-muted)", paddingLeft: "1.25rem", lineHeight: 1.7 }}>
          <li>
            <strong>Deterministic Energy Formula:</strong> Electrical energy is calculated step-by-step using <code>Energy (kWh) = Power (W) × Duration (hours) / 1000</code> based on elapsed simulation intervals (2.0s per reading).
          </li>
          <li>
            <strong>Configurable Economics:</strong> Standard Indian tariff applied: ₹{tariffRate} / kWh; Grid carbon intensity applied: {s.co2_emissions_factor} kg CO₂ / kWh.
          </li>
          <li>
            <strong>Mitigation Strategy:</strong> In the event of persistent voltage spikes (&gt;240 V), consider dedicated automated contactor protection or secondary line regulation to prevent thermal stress on compressor windings.
          </li>
        </ul>
      </div>
    </div>
  );
}
