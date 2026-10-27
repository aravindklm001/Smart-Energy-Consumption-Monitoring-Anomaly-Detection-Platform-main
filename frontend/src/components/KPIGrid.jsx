import React from "react";

export default function KPIGrid({
  latestReading,
  totalReadingsCount,
  anomaliesCount,
  atRiskCount,
  cumulativeKwh,
  estimatedCost,
  estimatedCo2,
  simulationRunning
}) {
  const r = latestReading || {};

  const voltage = r.voltage_V !== undefined ? `${r.voltage_V.toFixed(1)} V` : "220.0 V";
  const current = r.current_A !== undefined ? `${r.current_A.toFixed(2)} A` : "3.80 A";
  const power = r.power_W !== undefined ? `${r.power_W.toFixed(0)} W` : "800 W";
  const frequency = r.frequency_Hz !== undefined ? `${r.frequency_Hz.toFixed(2)} Hz` : "50.00 Hz";
  const powerFactor = r.power_factor !== undefined ? `${r.power_factor.toFixed(2)}` : "0.95";
  const vClass = r.voltage_classification || "NORMAL";
  const devV = r.deviation_v !== undefined ? `${r.deviation_v > 0 ? "+" : ""}${r.deviation_v} V` : "0.0 V";

  const getVoltageColor = () => {
    if (vClass === "HIGH VOLTAGE") return "#dc2626";
    if (vClass === "LOW VOLTAGE") return "#d97706";
    return "#059669";
  };

  const kpis = [
    {
      title: "Current Voltage",
      value: voltage,
      sublabel: `${vClass} (${devV})`,
      color: getVoltageColor(),
      icon: "⚡",
      badge: vClass
    },
    {
      title: "Current Load",
      value: current,
      sublabel: "Simulated draw",
      color: "#0284c7",
      icon: "🔌"
    },
    {
      title: "Active Power",
      value: power,
      sublabel: "Connected appliances",
      color: "#0f766e",
      icon: "💡"
    },
    {
      title: "Grid Frequency",
      value: frequency,
      sublabel: "50 Hz nominal",
      color: "#7c3aed",
      icon: "〰️"
    },
    {
      title: "Power Factor",
      value: powerFactor,
      sublabel: r.power_factor < 0.7 ? "Low PF (Reactive)" : "Lagging / Nominal",
      color: r.power_factor < 0.7 ? "#d97706" : "#059669",
      icon: "📐"
    },
    {
      title: "Energy Consumption",
      value: `${(cumulativeKwh || 0).toFixed(4)} kWh`,
      sublabel: "Simulated accumulated",
      color: "#0369a1",
      icon: "🔋"
    },
    {
      title: "Total Readings",
      value: totalReadingsCount || 0,
      sublabel: "Sample time-series points",
      color: "var(--text-main)",
      icon: "📊"
    },
    {
      title: "Anomalies Detected",
      value: anomaliesCount || 0,
      sublabel: "Voltage & AI flagged",
      color: anomaliesCount > 0 ? "#dc2626" : "#059669",
      icon: "🚨"
    },
    {
      title: "Appliances at Risk",
      value: atRiskCount || 0,
      sublabel: atRiskCount > 0 ? "Review input tolerances" : "All operating in band",
      color: atRiskCount > 0 ? "#d97706" : "#059669",
      icon: "🛡️"
    },
    {
      title: "Estimated Cost",
      value: `₹${(estimatedCost || 0).toFixed(2)}`,
      sublabel: "@ ₹8.00 / kWh tariff",
      color: "#b45309",
      icon: "₹"
    },
    {
      title: "Estimated CO₂",
      value: `${(estimatedCo2 || 0).toFixed(4)} kg`,
      sublabel: "@ 0.380 kg CO₂/kWh",
      color: "#059669",
      icon: "🌱"
    },
    {
      title: "Simulation Status",
      value: simulationRunning ? "RUNNING" : "PAUSED",
      sublabel: "Interval: 2.0s tick",
      color: simulationRunning ? "#059669" : "#64748b",
      icon: "⏱️"
    }
  ];

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
      gap: "1rem",
      marginBottom: "1.5rem"
    }}>
      {kpis.map((kpi, idx) => (
        <div key={idx} className="industrial-card" style={{ padding: "1rem 1.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.76rem", fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
              {kpi.title}
            </span>
            <span style={{ fontSize: "1.1rem" }}>{kpi.icon}</span>
          </div>

          <div className="font-mono" style={{ fontSize: "1.5rem", fontWeight: 700, color: kpi.color, lineHeight: 1.2 }}>
            {kpi.value}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.4rem" }}>
            <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
              {kpi.sublabel}
            </span>
            {kpi.badge && (
              <span className={`badge ${
                kpi.badge === "NORMAL" ? "badge-normal" : kpi.badge === "HIGH VOLTAGE" ? "badge-critical" : "badge-warning"
              }`} style={{ fontSize: "0.65rem", padding: "0.15rem 0.45rem" }}>
                {kpi.badge}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
