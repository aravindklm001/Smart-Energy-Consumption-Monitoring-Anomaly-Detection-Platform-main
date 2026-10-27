import React, { useState, useEffect, useRef, useCallback } from "react";
import Navbar from "./components/Navbar";
import KPIGrid from "./components/KPIGrid";
import SimulationBar from "./components/SimulationBar";
import VoltageClassificationCard from "./components/VoltageClassificationCard";
import LiveCharts from "./components/LiveCharts";
import AIExplanationCard from "./components/AIExplanationCard";
import ApplianceControlPanel from "./components/ApplianceControlPanel";
import EventLogPanel from "./components/EventLogPanel";
import AnalyticsReportsPanel from "./components/AnalyticsReportsPanel";
import SettingsPanel from "./components/SettingsPanel";
import {
  DEFAULT_APPLIANCES,
  INITIAL_SETTINGS,
  generateInitialReadings
} from "./data/defaultData";

const API_BASE = "http://localhost:8000";
const WS_URL = "ws://localhost:8000/ws";

export default function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [connected, setConnected] = useState(false);
  const [simulationRunning, setSimulationRunning] = useState(false);
  const [theme, setTheme] = useState("light"); // White theme by default

  // Core Data States - Pre-seeded with realistic dataset so dashboard never starts empty
  const [readings, setReadings] = useState(() => generateInitialReadings());
  const [events, setEvents] = useState([]);
  const [appliances, setAppliances] = useState(() => DEFAULT_APPLIANCES);
  const [settings, setSettings] = useState(() => INITIAL_SETTINGS);
  const [latestExplanation, setLatestExplanation] = useState(
    "Nominal operating conditions. All models report healthy supply parameters within configured limits (200V - 240V)."
  );

  const wsRef = useRef(null);
  const localTimerRef = useRef(null);
  const evaluatedAppliancesRef = useRef([]);

  // Synchronize theme to body class
  useEffect(() => {
    document.body.className = theme === "dark" ? "theme-dark" : "theme-light";
  }, [theme]);

  // Latest reading reference
  const latestReading = readings.length > 0 ? readings[readings.length - 1] : null;

  // Derive metrics
  const cumulativeKwh = readings.reduce((acc, r) => acc + (r.kwh || 0.0003), 0);
  const estimatedCost = cumulativeKwh * (settings.electricity_tariff || 8.00);
  const estimatedCo2 = cumulativeKwh * (settings.co2_emissions_factor || 0.380);
  const anomaliesCount = readings.filter(r => r.voltage_classification !== "NORMAL" || r.is_ai_anomaly).length;

  // Evaluate appliance risks based on latest reading
  const evaluatedAppliances = appliances.map(app => {
    const v = latestReading?.voltage_V || 220.0;
    const isOn = app.operating_status === "ON";
    let risk = "SAFE";
    let reason = `Operating within safe voltage bounds (${app.v_min}V – ${app.v_max}V).`;
    let action = "Normal operation.";

    if (!isOn) {
      risk = "PROTECTED";
      reason = "Simulated load is disconnected from the active supply circuit.";
      action = "Maintain simulated isolation until supply stabilizes.";
    } else if (v < app.v_min) {
      risk = v < app.v_min - 15 ? "HIGH RISK" : "WARNING";
      reason = `Voltage (${v.toFixed(1)}V) is below appliance minimum rated input (${app.v_min}V). Inductive loads may stall and overheat.`;
      action = `Switch ${app.name} to Simulated OFF to mitigate thermal risk.`;
    } else if (v > app.v_max) {
      risk = v > app.v_max + 10 ? "HIGH RISK" : "WARNING";
      reason = `Voltage (${v.toFixed(1)}V) exceeds appliance maximum rated input (${app.v_max}V). Risk of dielectric and surge stress.`;
      action = `Trigger simulated overvoltage disconnect for ${app.name} immediately.`;
    }

    return {
      ...app,
      risk_category: risk,
      reason,
      recommended_action: action
    };
  });

  // Keep ref up to date without triggering callback recreation
  evaluatedAppliancesRef.current = evaluatedAppliances;

  const atRiskCount = evaluatedAppliances.filter(a => a.risk_category === "HIGH RISK" || a.risk_category === "WARNING").length;

  // Stable handler for incoming readings
  const handleNewReading = useCallback((d) => {
    const ts = d.timestamp || Date.now() / 1000;
    const timeStr = new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const formatted = {
      ...d,
      time: timeStr,
      kwh: d.step_kwh || d.kwh || 0.0003,
    };

    setReadings(prev => [...prev.slice(-99), formatted]);

    if (d.ai_explanation) {
      setLatestExplanation(d.ai_explanation);
    }

    // If reading is anomalous, append to events
    if (d.voltage_classification !== "NORMAL" || d.is_ai_anomaly) {
      const atRiskNames = (evaluatedAppliancesRef.current || [])
        .filter(a => a.risk_category === "HIGH RISK" || a.risk_category === "WARNING")
        .map(a => a.name);

      const newEvent = {
        timestamp: ts,
        event_type: d.voltage_classification !== "NORMAL" ? "VOLTAGE_ALERT" : "AI_ANOMALY",
        voltage_V: d.voltage_V,
        current_A: d.current_A,
        classification: d.voltage_classification,
        ai_anomaly_result: `ISO=${d.iso_anomaly || false}, AE=${d.ae_anomaly || false}`,
        affected_appliances: atRiskNames,
        risk_explanation: d.ai_explanation || `${d.voltage_classification} observed.`,
        recommended_action: "Review supply regulation.",
        protection_action: ""
      };
      setEvents(prev => [newEvent, ...prev.slice(0, 150)]);
    }
  }, []);

  // Connect WebSocket - stable callback
  const connectWebSocket = useCallback(() => {
    try {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        return;
      }
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleNewReading(data);
        } catch (e) {
          console.error("WS Parse error", e);
        }
      };

      ws.onclose = () => {
        setConnected(false);
      };

      ws.onerror = () => {
        setConnected(false);
      };
    } catch (e) {
      setConnected(false);
    }
  }, [handleNewReading]);

  // Initial mount: load data from backend exactly once
  useEffect(() => {
    fetch(`${API_BASE}/api/status`)
      .then(res => res.json())
      .then(status => {
        setSimulationRunning(status.is_running);
        if (status.settings) setSettings(status.settings);
        if (status.ai_explanation) setLatestExplanation(status.ai_explanation);
      })
      .catch(() => {});

    fetch(`${API_BASE}/api/readings?limit=40`)
      .then(res => res.json())
      .then(data => {
        if (data && data.length > 0) {
          const formatted = data.map(d => ({
            ...d,
            time: new Date(d.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          }));
          setReadings(formatted);
        }
      })
      .catch(() => {});

    fetch(`${API_BASE}/api/appliances`)
      .then(res => res.json())
      .then(data => {
        if (data && data.length > 0) setAppliances(data);
      })
      .catch(() => {});

    fetch(`${API_BASE}/api/events?limit=50`)
      .then(res => res.json())
      .then(data => {
        if (data && data.length > 0) setEvents(data);
      })
      .catch(() => {});

    connectWebSocket();

    return () => {
      if (wsRef.current) wsRef.current.close();
      if (localTimerRef.current) clearInterval(localTimerRef.current);
    };
  }, [connectWebSocket]);

  // Local fallback simulation step generator
  const runLocalStep = useCallback((overrideScenario = null, customV = null) => {
    const refV = settings.reference_voltage || 220.0;
    const lowerV = settings.lower_threshold || 200.0;
    const upperV = settings.upper_threshold || 240.0;
    const tariff = settings.electricity_tariff || 8.00;
    const co2Factor = settings.co2_emissions_factor || 0.380;

    let v = 220.0 + (Math.random() * 4 - 2);
    let freq = 50.0 + (Math.random() * 0.1 - 0.05);
    let pf = 0.95;
    let curr = 4.2;

    if (overrideScenario === "HIGH_VOLTAGE") {
      v = customV !== null ? customV : 248.0;
      curr = 6.8;
    } else if (overrideScenario === "LOW_VOLTAGE") {
      v = customV !== null ? customV : 185.0;
      curr = 4.0;
    } else if (overrideScenario === "CURRENT_ANOMALY") {
      v = 220.0;
      curr = 22.5;
      pf = 0.45;
      freq = 48.2;
    } else if (overrideScenario === "NORMAL") {
      v = customV !== null ? customV : 220.0;
    }

    const totalActivePower = appliances
      .filter(a => a.operating_status === "ON")
      .reduce((s, a) => s + (a.rated_power_W || 0), 0);

    const powerW = Math.max(100, (v * curr * pf) + (totalActivePower * 0.1));
    const stepKwh = (powerW * (2.0 / 3600)) / 1000;

    let vClass = "NORMAL";
    let severity = "NORMAL";
    if (v < lowerV) {
      vClass = "LOW VOLTAGE";
      severity = v < lowerV - 15 ? "CRITICAL" : "WARNING";
    } else if (v > upperV) {
      vClass = "HIGH VOLTAGE";
      severity = v > upperV + 10 ? "CRITICAL" : "WARNING";
    }

    const devV = Number((v - refV).toFixed(1));
    const devPct = Number(((devV / refV) * 100).toFixed(1));
    const isAiAnomaly = pf < 0.6 || curr > 18.0;

    const dynamicExp = vClass === "HIGH VOLTAGE"
      ? `High voltage detected: ${v.toFixed(1)} V. The configured upper limit is ${upperV.toFixed(0)} V. The supply is ${devV > 0 ? "+" : ""}${devV} V (${devPct > 0 ? "+" : ""}${devPct}%) above the ${refV.toFixed(0)} V reference. Several appliances flagged for input-range review.`
      : vClass === "LOW VOLTAGE"
      ? `Low voltage detected: ${v.toFixed(1)} V. The configured lower limit is ${lowerV.toFixed(0)} V. The supply is ${devV} V (${devPct}%) below reference. Check motor loads for undervoltage thermal stress.`
      : isAiAnomaly
      ? `Supply voltage is nominal at ${v.toFixed(1)} V, but multidimensional AI anomaly flagged unusual current surge (${curr.toFixed(1)}A) or low power factor (${pf.toFixed(2)}).`
      : `Nominal operating conditions: Supply voltage is ${v.toFixed(1)} V. Frequency is ${freq.toFixed(2)} Hz. All appliances operating safely within configured limits.`;

    const payload = {
      timestamp: Date.now() / 1000,
      voltage_V: Number(v.toFixed(1)),
      current_A: Number(curr.toFixed(2)),
      power_W: Number(powerW.toFixed(1)),
      frequency_Hz: Number(freq.toFixed(2)),
      power_factor: Number(pf.toFixed(2)),
      voltage_classification: vClass,
      severity,
      deviation_v: devV,
      deviation_pct: devPct,
      reference_voltage: refV,
      lower_threshold: lowerV,
      upper_threshold: upperV,
      is_ai_anomaly: isAiAnomaly,
      iso_anomaly: isAiAnomaly,
      iso_score: isAiAnomaly ? -0.28 : 0.44,
      ae_anomaly: isAiAnomaly,
      ae_error: isAiAnomaly ? 0.35 : 0.02,
      ae_threshold: 0.15,
      step_kwh: stepKwh,
      kwh: stepKwh,
      cost_eur: stepKwh * tariff,
      co2_kg: stepKwh * co2Factor,
      ai_explanation: dynamicExp,
      is_simulated: true,
      simulation_label: "SIMULATED DATA - NO PHYSICAL SENSORS CONNECTED"
    };

    handleNewReading(payload);
  }, [settings, appliances, handleNewReading]);

  // Simulation Controls Handlers
  const handleStartSimulation = async () => {
    setSimulationRunning(true);

    // 1. Tell backend to start simulation
    try {
      await fetch(`${API_BASE}/api/simulation/start`, { method: "POST" });
    } catch (e) {}

    // 2. Send via WS if open
    try {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ action: "START" }));
      }
    } catch (e) {}

    // 3. If backend is not connected, use local timer
    if (!connected) {
      if (localTimerRef.current) clearInterval(localTimerRef.current);
      localTimerRef.current = setInterval(() => {
        runLocalStep();
      }, 2000);
    }
  };

  const handlePauseSimulation = async () => {
    // Immediately set state to paused
    setSimulationRunning(false);

    // Stop local timer if running
    if (localTimerRef.current) {
      clearInterval(localTimerRef.current);
      localTimerRef.current = null;
    }

    // Tell backend to pause simulation
    try {
      await fetch(`${API_BASE}/api/simulation/pause`, { method: "POST" });
    } catch (e) {}

    // Send via WS if open
    try {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ action: "PAUSE" }));
      }
    } catch (e) {}
  };

  const handleResetSimulation = async () => {
    await handlePauseSimulation();

    try {
      await fetch(`${API_BASE}/api/simulation/reset`, { method: "POST" });
    } catch (e) {}

    setReadings(generateInitialReadings());
    setEvents([]);
  };

  const handleStepSimulation = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/simulation/step`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        handleNewReading(data);
        return;
      }
    } catch (e) {}
    runLocalStep();
  };

  const handleLoadDataset = async () => {
    // 1. Pause any running simulation first
    await handlePauseSimulation();

    // 2. Instruct backend to reload the dataset and re-seed SQLite
    try {
      const res = await fetch(`${API_BASE}/api/simulation/load-dataset`, { method: "POST" });
      if (res.ok) {
        // Fetch fresh readings from backend
        const readingsRes = await fetch(`${API_BASE}/api/readings?limit=40`);
        if (readingsRes.ok) {
          const data = await readingsRes.json();
          if (data && data.length > 0) {
            const formatted = data.map(d => ({
              ...d,
              time: new Date(d.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            }));
            setReadings(formatted);
            return;
          }
        }
      }
    } catch (e) {}

    // Fallback: reload initial dataset generator
    setReadings(generateInitialReadings());
  };

  const handleInject = async (scenario, customV = null) => {
    try {
      const res = await fetch(`${API_BASE}/api/simulation/inject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario, custom_voltage: customV })
      });
      if (res.ok) {
        const data = await res.json();
        handleNewReading(data);
        return;
      }
    } catch (e) {}
    runLocalStep(scenario, customV);
  };

  const handleToggleAppliance = async (appId, newStatus) => {
    try {
      const res = await fetch(`${API_BASE}/api/appliances/${appId}/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operating_status: newStatus })
      });
      if (res.ok) {
        const data = await res.json();
        setAppliances(prev => prev.map(a => a.id === appId ? { ...a, operating_status: newStatus } : a));
        return data;
      }
    } catch (e) {}

    // Local toggle fallback
    setAppliances(prev => prev.map(a => a.id === appId ? { ...a, operating_status: newStatus } : a));
    const targetApp = appliances.find(a => a.id === appId);
    const newEvent = {
      timestamp: Date.now() / 1000,
      event_type: "PROTECTION_ACTION",
      voltage_V: latestReading?.voltage_V || 220.0,
      current_A: latestReading?.current_A || 0,
      classification: latestReading?.voltage_classification || "NORMAL",
      ai_anomaly_result: "Local state update",
      affected_appliances: [targetApp?.name || appId],
      risk_explanation: `Operator manually switched ${targetApp?.name} to Simulated ${newStatus}.`,
      recommended_action: "Monitoring circuit continuity.",
      protection_action: `Simulated ${newStatus} applied. Connected load updated.`
    };
    setEvents(prev => [newEvent, ...prev]);
    return { success: true };
  };

  const handleSaveSettings = async (newSettings) => {
    setSettings(newSettings);
    try {
      await fetch(`${API_BASE}/api/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSettings)
      });
    } catch (e) {}
  };

  const handleExportEventsCsv = () => {
    window.open(`${API_BASE}/api/events/export`, "_blank");
  };

  const handleExportReportCsv = () => {
    window.open(`${API_BASE}/api/reports/export`, "_blank");
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)" }}>
      {/* Navigation Header */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        simulationRunning={simulationRunning}
        connected={connected}
        theme={theme}
        setTheme={setTheme}
        latestReading={latestReading}
        settings={settings}
      />

      {/* Main Content Area */}
      <main style={{ maxWidth: 1400, margin: "0 auto", padding: "1.5rem" }}>
        {/* Simulation Control Bar */}
        <SimulationBar
          simulationRunning={simulationRunning}
          onStart={handleStartSimulation}
          onPause={handlePauseSimulation}
          onReset={handleResetSimulation}
          onStep={handleStepSimulation}
          onLoadDataset={handleLoadDataset}
          onInject={handleInject}
          currentVoltage={latestReading?.voltage_V}
        />

        {/* Tab 1: Overview Dashboard */}
        {activeTab === "dashboard" && (
          <div>
            <KPIGrid
              latestReading={latestReading}
              totalReadingsCount={readings.length}
              anomaliesCount={anomaliesCount}
              atRiskCount={atRiskCount}
              cumulativeKwh={cumulativeKwh}
              estimatedCost={estimatedCost}
              estimatedCo2={estimatedCo2}
              simulationRunning={simulationRunning}
            />

            <VoltageClassificationCard
              reading={latestReading}
              settings={settings}
            />

            <LiveCharts
              readings={readings}
              settings={settings}
            />

            <AIExplanationCard
              reading={latestReading}
              explanation={latestExplanation}
            />
          </div>
        )}

        {/* Tab 2: Appliance Protection Simulator */}
        {activeTab === "appliances" && (
          <ApplianceControlPanel
            appliances={evaluatedAppliances}
            onToggleStatus={handleToggleAppliance}
            currentVoltage={latestReading?.voltage_V}
          />
        )}

        {/* Tab 3: Anomaly Feed & Event Audit History */}
        {activeTab === "events" && (
          <EventLogPanel
            events={events}
            onExportCsv={handleExportEventsCsv}
          />
        )}

        {/* Tab 4: Energy Analytics & Audit Reports */}
        {activeTab === "reports" && (
          <AnalyticsReportsPanel
            readings={readings}
            events={events}
            appliances={evaluatedAppliances}
            settings={settings}
            onExportReport={handleExportReportCsv}
          />
        )}

        {/* Tab 5: Configuration Settings */}
        {activeTab === "settings" && (
          <SettingsPanel
            settings={settings}
            onSaveSettings={handleSaveSettings}
            appliances={appliances}
          />
        )}
      </main>
    </div>
  );
}