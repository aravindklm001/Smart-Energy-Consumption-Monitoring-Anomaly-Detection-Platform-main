import React, { useState } from "react";

export default function EventLogPanel({ events, onExportCsv }) {
  const [activeFilter, setActiveFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const filters = [
    { id: "ALL", label: "All Events" },
    { id: "HIGH_VOLTAGE", label: "⚡ High Voltage" },
    { id: "LOW_VOLTAGE", label: "🔻 Low Voltage" },
    { id: "AI_ANOMALIES", label: "🧠 AI Anomalies" },
    { id: "PROTECTION_ACTIONS", label: "🛡️ Protection Actions" },
  ];

  const filteredEvents = events.filter((e) => {
    // 1. Tab filter
    if (activeFilter === "HIGH_VOLTAGE" && e.classification !== "HIGH VOLTAGE") return false;
    if (activeFilter === "LOW_VOLTAGE" && e.classification !== "LOW VOLTAGE") return false;
    if (activeFilter === "AI_ANOMALIES" && e.event_type !== "AI_ANOMALY" && !e.ai_anomaly_result?.includes("Anomaly")) return false;
    if (activeFilter === "PROTECTION_ACTIONS" && e.event_type !== "PROTECTION_ACTION" && !e.protection_action) return false;

    // 2. Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        (e.classification && e.classification.toLowerCase().includes(q)) ||
        (e.ai_anomaly_result && e.ai_anomaly_result.toLowerCase().includes(q)) ||
        (e.risk_explanation && e.risk_explanation.toLowerCase().includes(q)) ||
        (e.protection_action && e.protection_action.toLowerCase().includes(q)) ||
        (JSON.stringify(e.affected_appliances || "").toLowerCase().includes(q));
      if (!match) return false;
    }

    return true;
  });

  const formatTimestamp = (ts) => {
    if (!ts) return "--";
    return new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="industrial-card" style={{ marginBottom: "2rem" }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "1rem",
        marginBottom: "1.25rem"
      }}>
        <div>
          <h2 style={{ fontSize: "1.15rem", fontWeight: 800, margin: 0, color: "var(--text-main)" }}>
            Live Anomaly Feed & Event Audit Log
          </h2>
          <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", margin: "2px 0 0" }}>
            Comprehensive time-stamped incident journal powered by SQLite audit persistence
          </p>
        </div>

        {/* Export CSV Button */}
        <button
          onClick={onExportCsv}
          className="btn btn-primary"
          style={{ fontSize: "0.82rem" }}
          title="Download full incident history as CSV"
        >
          <span>📥</span> Export Events as CSV
        </button>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "0.75rem",
        marginBottom: "1rem",
        paddingBottom: "1rem",
        borderBottom: "1px solid var(--border-subtle)"
      }}>
        {/* Filter Pills */}
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
          {filters.map((f) => (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id)}
              className={`btn ${activeFilter === f.id ? "btn-primary" : "btn-secondary"}`}
              style={{ fontSize: "0.76rem", padding: "0.4rem 0.75rem" }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div style={{ maxWidth: 260, width: "100%" }}>
          <input
            type="text"
            placeholder="Search events, appliances..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="form-input"
            style={{ fontSize: "0.8rem", padding: "0.4rem 0.75rem" }}
          />
        </div>
      </div>

      {/* Event Records Table */}
      <div style={{ overflowX: "auto" }}>
        {filteredEvents.length === 0 ? (
          <div style={{ padding: "3rem 1rem", textAlign: "center", color: "var(--text-dim)" }}>
            <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📋</div>
            <p style={{ fontSize: "0.88rem", margin: 0 }}>No matching events in the audit log.</p>
            <p style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginTop: "4px" }}>
              Events are registered automatically when voltage breaches limits, AI models flag signatures, or simulated protection trips occur.
            </p>
          </div>
        ) : (
          <table className="custom-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Voltage (V)</th>
                <th>Current (A)</th>
                <th>Classification</th>
                <th>AI Detection</th>
                <th>Affected Equipment</th>
                <th>Risk Explanation</th>
                <th>Recommended Action</th>
                <th>Protection Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.slice(0, 100).map((e, idx) => {
                const affected = Array.isArray(e.affected_appliances)
                  ? e.affected_appliances.join(", ")
                  : typeof e.affected_appliances === "string"
                  ? e.affected_appliances
                  : "--";

                return (
                  <tr key={idx}>
                    <td className="font-mono" style={{ whiteSpace: "nowrap", color: "var(--text-muted)" }}>
                      {formatTimestamp(e.timestamp)}
                    </td>
                    <td className="font-mono" style={{
                      fontWeight: 700,
                      color: e.voltage_V > 240 ? "#dc2626" : e.voltage_V < 200 ? "#d97706" : "#059669"
                    }}>
                      {e.voltage_V ? `${e.voltage_V.toFixed(1)} V` : "--"}
                    </td>
                    <td className="font-mono" style={{ color: "var(--text-main)" }}>
                      {e.current_A ? `${e.current_A.toFixed(2)} A` : "--"}
                    </td>
                    <td>
                      <span className={`badge ${
                        e.classification === "HIGH VOLTAGE"
                          ? "badge-critical"
                          : e.classification === "LOW VOLTAGE"
                          ? "badge-warning"
                          : "badge-normal"
                      }`} style={{ fontSize: "0.68rem" }}>
                        {e.classification || "NORMAL"}
                      </span>
                    </td>
                    <td style={{ fontSize: "0.76rem", color: "#7c3aed", maxWidth: 160 }}>
                      {e.ai_anomaly_result || "Nominal"}
                    </td>
                    <td style={{ fontSize: "0.76rem", color: "var(--text-main)", fontWeight: 500, maxWidth: 150 }}>
                      {affected || "None"}
                    </td>
                    <td style={{ fontSize: "0.76rem", color: "var(--text-muted)", maxWidth: 220 }}>
                      {e.risk_explanation || "--"}
                    </td>
                    <td style={{ fontSize: "0.76rem", color: "#0284c7", maxWidth: 180 }}>
                      {e.recommended_action || "--"}
                    </td>
                    <td style={{ fontSize: "0.76rem", color: e.protection_action ? "#059669" : "var(--text-dim)", maxWidth: 180, fontWeight: e.protection_action ? 600 : 400 }}>
                      {e.protection_action || "None"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
