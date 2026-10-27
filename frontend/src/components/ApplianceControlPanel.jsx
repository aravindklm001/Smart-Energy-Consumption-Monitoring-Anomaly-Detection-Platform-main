import React, { useState } from "react";

export default function ApplianceControlPanel({
  appliances,
  onToggleStatus,
  currentVoltage
}) {
  const [toastMessage, setToastMessage] = useState(null);

  const handleToggle = async (appId, newStatus) => {
    const res = await onToggleStatus(appId, newStatus);
    const app = appliances.find(a => a.id === appId);
    const name = app ? app.name : appId;
    setToastMessage({
      title: `Simulated ${newStatus} Executed`,
      body: `Set ${name} to Simulated ${newStatus}. Connected load updated. (Simulated control only).`
    });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const getRiskBadge = (risk) => {
    switch (risk) {
      case "HIGH RISK":
        return <span className="badge badge-critical">HIGH RISK</span>;
      case "WARNING":
        return <span className="badge badge-warning">WARNING</span>;
      case "PROTECTED":
        return <span className="badge badge-protected">PROTECTED (OFF)</span>;
      default:
        return <span className="badge badge-normal">SAFE</span>;
    }
  };

  const totalConnectedWatts = appliances
    .filter(a => a.operating_status === "ON")
    .reduce((sum, a) => sum + (a.rated_power_W || 0), 0);

  const atRiskCount = appliances.filter(a => a.risk_category === "HIGH RISK" || a.risk_category === "WARNING").length;

  return (
    <div style={{ marginBottom: "2rem" }}>
      {/* Toast Confirmation */}
      {toastMessage && (
        <div className="toast-notice">
          <span style={{ fontSize: "1.4rem" }}>🛡️</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--text-main)" }}>
              {toastMessage.title}
            </div>
            <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
              {toastMessage.body}
            </div>
          </div>
        </div>
      )}

      {/* Top Banner / Summary */}
      <div className="industrial-card" style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <h2 style={{ fontSize: "1.2rem", fontWeight: 800, margin: 0, color: "var(--text-main)" }}>
              Appliance Protection & Simulated Load Management
            </h2>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: "4px 0 0" }}>
              Dynamic risk assessment based on appliance rated input voltage specifications and live supply voltage ({currentVoltage?.toFixed(1) || 220} V)
            </p>
          </div>

          <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ background: "var(--bg-secondary)", padding: "0.5rem 0.85rem", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
              <span style={{ fontSize: "0.72rem", color: "var(--text-dim)", textTransform: "uppercase" }}>Active Connected Load: </span>
              <span className="font-mono" style={{ fontWeight: 700, color: "#0284c7", marginLeft: "4px" }}>
                {totalConnectedWatts} W
              </span>
            </div>

            <div style={{ background: "var(--bg-secondary)", padding: "0.5rem 0.85rem", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
              <span style={{ fontSize: "0.72rem", color: "var(--text-dim)", textTransform: "uppercase" }}>Appliances at Risk: </span>
              <span className="font-mono" style={{ fontWeight: 700, color: atRiskCount > 0 ? "#dc2626" : "#059669", marginLeft: "4px" }}>
                {atRiskCount} / {appliances.length}
              </span>
            </div>
          </div>
        </div>

        {/* Clear Engineering Disclaimer */}
        <div style={{
          marginTop: "1rem",
          padding: "0.75rem 1rem",
          background: "var(--bg-secondary)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "6px",
          fontSize: "0.76rem",
          color: "var(--text-muted)",
          display: "flex",
          gap: "0.5rem",
          alignItems: "center"
        }}>
          <span>⚠️</span>
          <span>
            <strong>Simulated Protection Protocol:</strong> Controls simulate virtual load disconnection in software. Voltage monitoring continues uninterrupted even after an appliance load is switched OFF. Voltage deviations flag operating risk, but do not imply physical hardware damage has occurred.
          </span>
        </div>
      </div>

      {/* Appliances Grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(310px, 1fr))",
        gap: "1.25rem"
      }}>
        {appliances.map((app) => {
          const isOn = app.operating_status === "ON";
          const isAtRisk = app.risk_category === "HIGH RISK" || app.risk_category === "WARNING";

          return (
            <div
              key={app.id}
              className={`industrial-card ${isAtRisk && isOn ? "border-glow-rose" : ""}`}
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                background: "var(--bg-card)",
                opacity: isOn ? 1 : 0.85,
                borderColor: isAtRisk && isOn ? "#fca5a5" : "var(--border-subtle)"
              }}
            >
              <div>
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
                  <div>
                    <span style={{ fontSize: "0.7rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 700 }}>
                      {app.id}
                    </span>
                    <h3 style={{ fontSize: "1.05rem", fontWeight: 700, margin: "2px 0 0", color: "var(--text-main)" }}>
                      {app.name}
                    </h3>
                  </div>
                  {getRiskBadge(app.risk_category)}
                </div>

                {/* Specs Box */}
                <div style={{
                  background: "var(--bg-secondary)",
                  padding: "0.65rem 0.85rem",
                  borderRadius: "6px",
                  fontSize: "0.78rem",
                  border: "1px solid var(--border-subtle)",
                  marginBottom: "0.85rem"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <span style={{ color: "var(--text-dim)" }}>Rated Power:</span>
                    <span className="font-mono" style={{ fontWeight: 600, color: "#0284c7" }}>{app.rated_power_W} W</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <span style={{ color: "var(--text-dim)" }}>Rated Input Voltage:</span>
                    <span className="font-mono" style={{ fontWeight: 600, color: "var(--text-main)" }}>
                      {app.v_min} V – {app.v_max} V
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-dim)" }}>Simulated Status:</span>
                    <span style={{ fontWeight: 700, color: isOn ? "#059669" : "#64748b" }}>
                      {isOn ? "CONNECTED (ON)" : "DISCONNECTED (OFF)"}
                    </span>
                  </div>
                </div>

                {/* Risk Explanation */}
                <div style={{ marginBottom: "0.85rem", fontSize: "0.76rem" }}>
                  <div style={{ color: "var(--text-dim)", fontWeight: 700, textTransform: "uppercase", fontSize: "0.68rem", marginBottom: "2px" }}>
                    Risk Evaluation:
                  </div>
                  <p style={{ color: isAtRisk && isOn ? "#b91c1c" : "var(--text-muted)", margin: 0, lineHeight: 1.4 }}>
                    {app.reason || "Operational within rated tolerance."}
                  </p>
                </div>

                {/* Recommended Action */}
                <div style={{ marginBottom: "1rem", fontSize: "0.76rem" }}>
                  <div style={{ color: "var(--text-dim)", fontWeight: 700, textTransform: "uppercase", fontSize: "0.68rem", marginBottom: "2px" }}>
                    Recommended Action:
                  </div>
                  <p style={{ color: "#0284c7", margin: 0, lineHeight: 1.4 }}>
                    {app.recommended_action || "Maintain current operating state."}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{
                display: "flex",
                gap: "0.5rem",
                paddingTop: "0.75rem",
                borderTop: "1px solid var(--border-subtle)"
              }}>
                {isOn ? (
                  <button
                    onClick={() => handleToggle(app.id, "OFF")}
                    className="btn btn-danger"
                    style={{ flex: 1, padding: "0.45rem", fontSize: "0.8rem" }}
                    title="Simulate load disconnect to protect appliance"
                  >
                    <span>🛡️</span> Simulated OFF (Trip)
                  </button>
                ) : (
                  <button
                    onClick={() => handleToggle(app.id, "ON")}
                    className="btn btn-success"
                    style={{ flex: 1, padding: "0.45rem", fontSize: "0.8rem" }}
                    title="Simulate load reconnect"
                  >
                    <span>🔌</span> Simulated ON (Restore)
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
