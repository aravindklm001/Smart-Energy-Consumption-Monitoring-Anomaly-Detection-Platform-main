import React from "react";

export default function AIExplanationCard({ reading, explanation }) {
  const r = reading || {};

  const isoScore = r.iso_score !== undefined ? r.iso_score : 0.42;
  const isoAnomaly = !!r.iso_anomaly;
  const aeError = r.ae_error !== undefined ? r.ae_error : 0.025;
  const aeThreshold = r.ae_threshold !== undefined ? r.ae_threshold : 0.15;
  const aeAnomaly = !!r.ae_anomaly;
  const isRuleAlert = r.voltage_classification && r.voltage_classification !== "NORMAL";
  const isAiAnomaly = !!r.is_ai_anomaly;

  return (
    <div className="industrial-card" style={{
      marginBottom: "1.5rem",
      borderColor: isAiAnomaly || isRuleAlert ? "rgba(220, 38, 38, 0.4)" : "var(--border-subtle)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", marginBottom: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <div style={{
            background: "#f3e8ff",
            color: "#7c3aed",
            padding: "6px 10px",
            borderRadius: "8px",
            fontSize: "1.2rem",
            border: "1px solid #ddd6fe"
          }}>
            🧠
          </div>
          <div>
            <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: 0, color: "var(--text-main)" }}>
              AI Anomaly Detection & Contextual Explanation Engine
            </h3>
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: "2px 0 0" }}>
              Ensemble Machine Learning (Scikit-Learn Isolation Forest + PyTorch Deep Autoencoder)
            </p>
          </div>
        </div>

        {/* Dual Classification Status Badges */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
          <span className={`badge ${isRuleAlert ? "badge-critical" : "badge-normal"}`}>
            Rule Alert: {isRuleAlert ? r.voltage_classification : "NORMAL (200-240V)"}
          </span>
          <span className={`badge ${isAiAnomaly ? "badge-critical" : "badge-normal"}`}>
            ML Model: {isAiAnomaly ? "ANOMALY FLAGGED" : "NOMINAL SIGNATURE"}
          </span>
        </div>
      </div>

      {/* Dynamic Text Explanation Panel */}
      <div style={{
        background: "var(--bg-secondary)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "8px",
        padding: "1rem 1.25rem",
        marginBottom: "1rem",
        borderLeft: isRuleAlert || isAiAnomaly ? "4px solid #dc2626" : "4px solid #059669"
      }}>
        <div style={{ fontSize: "0.72rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 700, marginBottom: "0.4rem" }}>
          Dynamic System Diagnostics & Safety Advisory:
        </div>
        <p style={{
          fontSize: "0.92rem",
          color: "var(--text-main)",
          lineHeight: 1.6,
          margin: 0,
          fontFamily: "'Plus Jakarta Sans', sans-serif"
        }}>
          {explanation || r.ai_explanation || "Nominal electrical conditions. All models report healthy supply parameters."}
        </p>
      </div>

      {/* Model Performance & Telemetry Breakdown */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        gap: "1rem"
      }}>
        {/* Isolation Forest Card */}
        <div style={{ background: "var(--bg-secondary)", padding: "0.85rem 1rem", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#0284c7" }}>
              🌲 Isolation Forest (Scikit-learn)
            </span>
            <span className={`badge ${isoAnomaly ? "badge-critical" : "badge-normal"}`} style={{ fontSize: "0.65rem" }}>
              {isoAnomaly ? "Anomaly" : "Normal"}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.82rem" }}>
            <span style={{ color: "var(--text-dim)" }}>Anomaly Score:</span>
            <span className="font-mono" style={{ fontWeight: 700, color: isoScore < 0 ? "#dc2626" : "#059669" }}>
              {isoScore.toFixed(4)}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.75rem", marginTop: "4px" }}>
            <span style={{ color: "var(--text-dim)" }}>Contamination Rate:</span>
            <span style={{ color: "var(--text-muted)" }}>0.08 (calibrated baseline)</span>
          </div>
          <div style={{ fontSize: "0.72rem", color: "var(--text-dim)", marginTop: "6px" }}>
            Flags multivariate outliers across [V, I, P, Freq, PF]
          </div>
        </div>

        {/* PyTorch Autoencoder Card */}
        <div style={{ background: "var(--bg-secondary)", padding: "0.85rem 1rem", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#7c3aed" }}>
              ⚡ PyTorch Autoencoder
            </span>
            <span className={`badge ${aeAnomaly ? "badge-critical" : "badge-normal"}`} style={{ fontSize: "0.65rem" }}>
              {aeAnomaly ? "Recon Alert" : "Recon OK"}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.82rem" }}>
            <span style={{ color: "var(--text-dim)" }}>Reconstruction Error (MSE):</span>
            <span className="font-mono" style={{ fontWeight: 700, color: aeError > aeThreshold ? "#dc2626" : "#059669" }}>
              {aeError.toFixed(4)}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.75rem", marginTop: "4px" }}>
            <span style={{ color: "var(--text-dim)" }}>3-Sigma Error Threshold:</span>
            <span className="font-mono" style={{ color: "var(--text-muted)" }}>{aeThreshold.toFixed(4)}</span>
          </div>
          <div style={{ fontSize: "0.72rem", color: "var(--text-dim)", marginTop: "6px" }}>
            Learns compressed representations of normal operational manifolds
          </div>
        </div>
      </div>
    </div>
  );
}
