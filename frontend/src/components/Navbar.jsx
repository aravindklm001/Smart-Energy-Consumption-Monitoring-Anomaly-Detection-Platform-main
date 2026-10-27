import React from "react";

export default function Navbar({
  activeTab,
  setActiveTab,
  simulationRunning,
  connected,
  theme,
  setTheme,
  latestReading,
  settings
}) {
  const tabs = [
    { id: "dashboard", label: "Overview Dashboard", icon: "⚡" },
    { id: "appliances", label: "Appliance Protection", icon: "🛡️" },
    { id: "events", label: "Anomaly Feed & History", icon: "🚨" },
    { id: "reports", label: "Analytics & Reports", icon: "📊" },
    { id: "settings", label: "Settings", icon: "⚙️" },
  ];

  const isLight = theme === "light";

  // Voltage Thresholds & Alert Status
  const lowerThreshold = settings?.lower_threshold ?? 200.0;
  const upperThreshold = settings?.upper_threshold ?? 240.0;
  const currentVoltage = latestReading?.voltage_V != null ? Number(latestReading.voltage_V) : 220.0;

  const isHighAlert = currentVoltage > upperThreshold;
  const isLowAlert = currentVoltage < lowerThreshold;
  const isAlert = isHighAlert || isLowAlert;

  return (
    <header style={{
      background: isLight ? "#ffffff" : "#0f1422",
      borderBottom: `1px solid ${isLight ? "#e2e8f0" : "#1e293b"}`,
      padding: "1rem 2rem",
      position: "sticky",
      top: 0,
      zIndex: 100,
      boxShadow: isLight ? "0 1px 4px rgba(0,0,0,0.04)" : "none",
      transition: "background 0.2s, border-color 0.2s"
    }}>
      <div style={{
        maxWidth: 1400,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: "1rem"
      }}>
        {/* Top Header Row */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "1rem"
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <div style={{
                background: "linear-gradient(135deg, #0284c7, #0ea5e9)",
                color: "#ffffff",
                padding: "8px 12px",
                borderRadius: "10px",
                boxShadow: "0 2px 10px rgba(14, 165, 233, 0.3)",
                fontSize: "1.25rem"
              }}>
                ⚡
              </div>
              <div>
                <h1 style={{
                  fontSize: "1.25rem",
                  fontWeight: 800,
                  letterSpacing: "-0.02em",
                  color: isLight ? "#0f172a" : "#f8fafc",
                  margin: 0
                }}>
                  Energy Anomaly Monitor
                </h1>
                <p style={{ fontSize: "0.78rem", color: isLight ? "#475569" : "#94a3b8", margin: "2px 0 0" }}>
                  AI-Powered Smart Energy Monitoring, Voltage Anomaly Detection & Appliance Protection
                </p>
              </div>
            </div>
          </div>

          {/* Right Header Section: Top Right Alert Indication & Status Badges */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            {/* TOP RIGHT CORNER ALERT INDICATION BADGE */}
            <div
              className={`top-right-alert-indicator ${
                isHighAlert ? "alert-high" : isLowAlert ? "alert-low" : "alert-normal"
              }`}
              title={
                isHighAlert
                  ? `CRITICAL ALERT: Voltage (${currentVoltage.toFixed(1)}V) exceeds safe upper limit of ${upperThreshold}V!`
                  : isLowAlert
                  ? `WARNING ALERT: Voltage (${currentVoltage.toFixed(1)}V) dropped below safe lower limit of ${lowerThreshold}V!`
                  : `NORMAL STATUS: Voltage (${currentVoltage.toFixed(1)}V) is within safe operational limits (${lowerThreshold}V - ${upperThreshold}V).`
              }
              id="top-right-alert-badge"
            >
              <span className="indicator-dot" />
              <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                  <span style={{ fontSize: "0.85rem" }}>
                    {isHighAlert ? "🚨" : isLowAlert ? "⚠️" : "🟢"}
                  </span>
                  <span style={{ fontWeight: 800, letterSpacing: "0.02em" }}>
                    {isHighAlert ? "HIGH VOLTAGE ALERT" : isLowAlert ? "LOW VOLTAGE ALERT" : "VOLTAGE: NORMAL"}
                  </span>
                </div>
                <div style={{
                  fontSize: "0.72rem",
                  fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: 600,
                  opacity: 0.95
                }}>
                  {currentVoltage.toFixed(1)} V {" "}
                  {isHighAlert
                    ? `(+${(currentVoltage - upperThreshold).toFixed(1)}V Over)`
                    : isLowAlert
                    ? `(${(currentVoltage - lowerThreshold).toFixed(1)}V Under)`
                    : `(${lowerThreshold}V - ${upperThreshold}V)`}
                </div>
              </div>
            </div>

            {/* Mandatory Simulated Data Badge */}
            <div style={{
              background: isLight ? "#fffbeb" : "rgba(245, 158, 11, 0.12)",
              border: `1px solid ${isLight ? "#fde68a" : "rgba(245, 158, 11, 0.35)"}`,
              color: isLight ? "#b45309" : "#fbbf24",
              padding: "0.35rem 0.75rem",
              borderRadius: "20px",
              fontSize: "0.72rem",
              fontWeight: 700,
              letterSpacing: "0.03em",
              display: "flex",
              alignItems: "center",
              gap: "0.4rem"
            }}>
              <span>⚠️</span>
              <span>SIMULATED DATA - NO PHYSICAL SENSORS CONNECTED</span>
            </div>

            {/* Simulation Status */}
            <div style={{
              background: simulationRunning
                ? (isLight ? "#ecfdf5" : "rgba(16, 185, 129, 0.15)")
                : (isLight ? "#f1f5f9" : "rgba(100, 116, 139, 0.15)"),
              border: `1px solid ${
                simulationRunning
                  ? (isLight ? "#a7f3d0" : "rgba(16, 185, 129, 0.4)")
                  : (isLight ? "#cbd5e1" : "rgba(100, 116, 139, 0.3)")
              }`,
              color: simulationRunning ? (isLight ? "#047857" : "#34d399") : (isLight ? "#475569" : "#94a3b8"),
              padding: "0.35rem 0.75rem",
              borderRadius: "20px",
              fontSize: "0.72rem",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: "0.4rem"
            }}>
              <span style={{
                width: 7, height: 7, borderRadius: "50%",
                background: simulationRunning ? "#10b981" : "#64748b",
                display: "inline-block"
              }} />
              <span>SIMULATION: {simulationRunning ? "ACTIVE (2s)" : "PAUSED"}</span>
            </div>

            {/* Connection Status */}
            <div style={{
              background: connected
                ? (isLight ? "#f0f9ff" : "rgba(6, 182, 212, 0.12)")
                : (isLight ? "#fef2f2" : "rgba(239, 68, 68, 0.12)"),
              border: `1px solid ${
                connected
                  ? (isLight ? "#bae6fd" : "rgba(6, 182, 212, 0.3)")
                  : (isLight ? "#fecaca" : "rgba(239, 68, 68, 0.3)")
              }`,
              color: connected ? (isLight ? "#0284c7" : "#38bdf8") : (isLight ? "#dc2626" : "#f87171"),
              padding: "0.35rem 0.75rem",
              borderRadius: "20px",
              fontSize: "0.72rem",
              fontWeight: 600,
            }}>
              {connected ? "🟢 Backend Synced" : "🟡 Local Simulation"}
            </div>

            {/* Theme Toggle Button */}
            <button
              onClick={() => setTheme(isLight ? "dark" : "light")}
              className="btn btn-secondary"
              style={{
                fontSize: "0.75rem",
                padding: "0.35rem 0.75rem",
                borderRadius: "20px"
              }}
              title={`Switch to ${isLight ? "Dark" : "White"} Theme`}
            >
              <span>{isLight ? "🌙 Dark Mode" : "☀️ White Theme"}</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav style={{
          display: "flex",
          gap: "0.5rem",
          overflowX: "auto",
          paddingBottom: "2px"
        }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`nav-tab ${activeTab === tab.id ? "active" : ""}`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}
