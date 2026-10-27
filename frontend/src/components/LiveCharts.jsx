import React, { useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ReferenceLine, ResponsiveContainer, CartesianGrid, Legend,
  BarChart, Bar, AreaChart, Area
} from "recharts";

// Custom dot to highlight abnormal readings in the voltage chart
const CustomizedDot = (props) => {
  const { cx, cy, payload } = props;
  if (!cx || !cy) return null;

  const isAnomaly = payload.voltage_V < 200 || payload.voltage_V > 240 || payload.is_ai_anomaly;
  if (!isAnomaly) return null;

  const fill = payload.voltage_V > 240 ? "#dc2626" : payload.voltage_V < 200 ? "#d97706" : "#7c3aed";
  return (
    <circle
      cx={cx}
      cy={cy}
      r={5}
      fill={fill}
      stroke="#ffffff"
      strokeWidth={2}
    />
  );
};

export default function LiveCharts({ readings, settings }) {
  const s = settings || { reference_voltage: 220, lower_threshold: 200, upper_threshold: 240 };
  const chartData = readings.length > 0 ? readings.slice(-40) : [];

  // Compute voltage distribution buckets for histogram
  const distributionData = useMemo(() => {
    if (!readings || readings.length === 0) return [];
    const buckets = {
      "<200V (Low)": 0,
      "200-210V": 0,
      "210-220V": 0,
      "220-230V": 0,
      "230-240V": 0,
      ">240V (High)": 0,
    };

    readings.forEach((r) => {
      const v = r.voltage_V;
      if (v < 200) buckets["<200V (Low)"]++;
      else if (v < 210) buckets["200-210V"]++;
      else if (v < 220) buckets["210-220V"]++;
      else if (v < 230) buckets["220-230V"]++;
      else if (v <= 240) buckets["230-240V"]++;
      else buckets[">240V (High)"]++;
    });

    return Object.entries(buckets).map(([bin, count]) => ({
      bin,
      count,
      fill: bin.includes("Low") ? "#d97706" : bin.includes("High") ? "#dc2626" : "#059669",
    }));
  }, [readings]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", marginBottom: "1.5rem" }}>
      {/* 1. Primary Voltage vs Time Chart */}
      <div className="industrial-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
          <div>
            <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: 0, color: "var(--text-main)" }}>
              Live Supply Voltage vs. Time
            </h3>
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: "2px 0 0" }}>
              Real-time trajectory with reference line (220V), lower limit (200V), and upper limit (240V)
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", fontSize: "0.75rem" }}>
            <span style={{ display: "flex", alignItems: "center", gap: "4px", color: "#0284c7", fontWeight: 600 }}>
              <span style={{ width: 10, height: 2, background: "#0284c7" }} /> Ref: 220V
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: "4px", color: "#d97706", fontWeight: 600 }}>
              <span style={{ width: 10, height: 2, background: "#d97706" }} /> Min: 200V
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: "4px", color: "#dc2626", fontWeight: 600 }}>
              <span style={{ width: 10, height: 2, background: "#dc2626" }} /> Max: 240V
            </span>
          </div>
        </div>

        <div style={{ width: "100%", height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="time" tick={{ fontSize: 11, fill: "#64748b" }} interval="preserveStartEnd" />
              <YAxis
                domain={[160, 270]}
                tick={{ fontSize: 11, fill: "#64748b" }}
                label={{ value: "Volts (V)", angle: -90, position: "insideLeft", fill: "#64748b", fontSize: 11 }}
              />
              <Tooltip
                contentStyle={{
                  background: "#ffffff",
                  borderColor: "#cbd5e1",
                  borderRadius: 8,
                  fontSize: 12,
                  color: "#0f172a",
                  boxShadow: "0 4px 14px rgba(0,0,0,0.1)",
                }}
                labelStyle={{ color: "#475569", fontWeight: 600 }}
                formatter={(val, name) => [`${val} V`, name === "voltage_V" ? "Measured Voltage" : name]}
              />
              <Legend verticalAlign="top" height={36} iconType="plainline" />

              {/* Lower Limit 200V */}
              <ReferenceLine
                y={s.lower_threshold || 200}
                stroke="#d97706"
                strokeDasharray="4 3"
                strokeWidth={1.5}
                label={{ value: "Lower Threshold (200V)", position: "insideBottomLeft", fill: "#d97706", fontSize: 10, fontWeight: 600 }}
              />

              {/* Reference 220V */}
              <ReferenceLine
                y={s.reference_voltage || 220}
                stroke="#0284c7"
                strokeDasharray="6 2"
                strokeWidth={1.5}
                label={{ value: "Reference (220V)", position: "insideTopLeft", fill: "#0284c7", fontSize: 10, fontWeight: 600 }}
              />

              {/* Upper Limit 240V */}
              <ReferenceLine
                y={s.upper_threshold || 240}
                stroke="#dc2626"
                strokeDasharray="4 3"
                strokeWidth={1.5}
                label={{ value: "Upper Threshold (240V)", position: "insideTopRight", fill: "#dc2626", fontSize: 10, fontWeight: 600 }}
              />

              <Line
                type="monotone"
                dataKey="voltage_V"
                name="Voltage (V)"
                stroke="#0284c7"
                strokeWidth={2.5}
                dot={<CustomizedDot />}
                activeDot={{ r: 7, fill: "#0284c7" }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 2. Dual Row: Active Power/Energy Chart + Voltage Distribution Histogram */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))",
        gap: "1.5rem"
      }}>
        {/* Active Power (W) and Cumulative kWh */}
        <div className="industrial-card">
          <div style={{ marginBottom: "1rem" }}>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 700, margin: 0, color: "var(--text-main)" }}>
              Active Load Power & Consumption
            </h3>
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: "2px 0 0" }}>
              Simulated aggregate power draw across connected appliances
            </p>
          </div>

          <div style={{ width: "100%", height: 230 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="powerGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="time" tick={{ fontSize: 11, fill: "#64748b" }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} label={{ value: "Watts (W)", angle: -90, position: "insideLeft", fill: "#64748b", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: "#ffffff", borderColor: "#cbd5e1", borderRadius: 8, fontSize: 12, color: "#0f172a" }}
                  formatter={(val) => [`${val} W`, "Active Power"]}
                />
                <Area type="monotone" dataKey="power_W" stroke="#2563eb" strokeWidth={2} fillOpacity={1} fill="url(#powerGrad)" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Voltage Distribution Histogram */}
        <div className="industrial-card">
          <div style={{ marginBottom: "1rem" }}>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 700, margin: 0, color: "var(--text-main)" }}>
              Voltage Distribution Histogram
            </h3>
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: "2px 0 0" }}>
              Sample frequency distribution across operational voltage bands
            </p>
          </div>

          <div style={{ width: "100%", height: 230 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={distributionData} margin={{ top: 10, right: 15, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="bin" tick={{ fontSize: 10, fill: "#475569" }} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                <Tooltip
                  contentStyle={{ background: "#ffffff", borderColor: "#cbd5e1", borderRadius: 8, fontSize: 12, color: "#0f172a" }}
                  formatter={(val) => [`${val} readings`, "Count"]}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
