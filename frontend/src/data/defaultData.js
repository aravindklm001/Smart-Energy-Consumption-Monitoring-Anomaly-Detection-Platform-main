// Default pre-loaded sample dataset and appliance configuration

export const DEFAULT_APPLIANCES = [
  { id: "APP-01", name: "Refrigerator", rated_power_W: 150, v_min: 200, v_max: 240, operating_status: "ON", category: "Inductive / Compressor" },
  { id: "APP-02", name: "Air conditioner", rated_power_W: 1800, v_min: 210, v_max: 240, operating_status: "ON", category: "Heavy Inductive" },
  { id: "APP-03", name: "Television", rated_power_W: 120, v_min: 180, v_max: 240, operating_status: "ON", category: "Consumer Electronics" },
  { id: "APP-04", name: "Water pump", rated_power_W: 1100, v_min: 200, v_max: 240, operating_status: "ON", category: "Inductive Motor" },
  { id: "APP-05", name: "Laptop charger", rated_power_W: 65, v_min: 100, v_max: 240, operating_status: "ON", category: "Wide-Range SMPS" },
  { id: "APP-06", name: "LED bulb", rated_power_W: 15, v_min: 180, v_max: 250, operating_status: "ON", category: "Lighting" },
  { id: "APP-07", name: "Washing machine", rated_power_W: 750, v_min: 205, v_max: 240, operating_status: "ON", category: "Motor / Agitator" },
  { id: "APP-08", name: "Desktop computer", rated_power_W: 350, v_min: 200, v_max: 240, operating_status: "ON", category: "Computing SMPS" },
];

export const INITIAL_SETTINGS = {
  reference_voltage: 220.0,
  lower_threshold: 200.0,
  upper_threshold: 240.0,
  simulation_interval: 2.0,
  electricity_tariff: 8.00,
  co2_emissions_factor: 0.380,
  contamination: 0.08,
};

// Generates 30 initial sample points immediately so graphs are never empty upon page load
export function generateInitialReadings() {
  const baseTime = Math.floor(Date.now() / 1000) - (30 * 2);
  const rows = [];
  
  for (let i = 0; i < 30; i++) {
    const ts = baseTime + (i * 2);
    let v = 219.0 + (Math.sin(i / 2) * 2.5);
    let freq = 50.0 + (Math.cos(i) * 0.05);
    let pf = 0.94 + (Math.sin(i / 3) * 0.02);
    let p = 650.0 + (Math.sin(i / 1.5) * 120);

    // Add a couple of realistic demo fluctuations
    if (i === 12) {
      v = 185.0; // Low voltage demo
    } else if (i === 13) {
      v = 192.0;
    } else if (i === 22) {
      v = 248.0; // High voltage demo
    } else if (i === 23) {
      v = 245.0;
    } else if (i === 27) {
      pf = 0.45; // AI anomaly demo
      p = 1450.0;
    }

    v = Number(v.toFixed(1));
    freq = Number(freq.toFixed(2));
    pf = Number(pf.toFixed(2));
    p = Number(p.toFixed(1));
    const curr = Number((p / (v * pf)).toFixed(2));

    let v_class = "NORMAL";
    let severity = "NORMAL";
    if (v < 200.0) {
      v_class = "LOW VOLTAGE";
      severity = v < 185 ? "CRITICAL" : "WARNING";
    } else if (v > 240.0) {
      v_class = "HIGH VOLTAGE";
      severity = v > 248 ? "CRITICAL" : "WARNING";
    }

    const dev_v = Number((v - 220.0).toFixed(1));
    const dev_pct = Number(((dev_v / 220.0) * 100).toFixed(1));
    const is_ai_anomaly = (pf < 0.6 || i === 27);
    const step_kwh = Number(((p * (2.0 / 3600)) / 1000).toFixed(8));

    rows.push({
      id: i + 1,
      timestamp: ts,
      time: new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      voltage_V: v,
      current_A: curr,
      power_W: p,
      frequency_Hz: freq,
      power_factor: pf,
      appliance_id: DEFAULT_APPLIANCES[i % DEFAULT_APPLIANCES.length].id,
      operating_status: "ON",
      voltage_classification: v_class,
      severity,
      deviation_v: dev_v,
      deviation_pct: dev_pct,
      is_ai_anomaly,
      iso_anomaly: is_ai_anomaly,
      iso_score: is_ai_anomaly ? -0.24 : 0.42,
      ae_anomaly: is_ai_anomaly,
      ae_error: is_ai_anomaly ? 0.38 : 0.03,
      step_kwh,
      kwh: step_kwh,
      co2_kg: Number((step_kwh * 0.380).toFixed(6)),
      cost_eur: Number((step_kwh * 0.32).toFixed(6)),
      total_kwh: Number((step_kwh * (i + 1)).toFixed(6)),
      is_simulated: true,
      simulation_label: "SIMULATED DATA - NO PHYSICAL SENSORS CONNECTED"
    });
  }
  return rows;
}
