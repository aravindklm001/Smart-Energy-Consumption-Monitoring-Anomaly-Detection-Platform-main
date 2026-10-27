import sys
import os

# Ensure backend directory is in sys.path
sys.path.insert(0, os.path.dirname(__file__))

from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import asyncio
import io
import csv
import time
import json
import threading

from database import (
    init_db, get_settings, update_setting, get_appliances,
    set_appliance_status, get_recent_readings, get_events,
    get_connection
)
from simulation_engine import engine

# Pydantic models for request validation
class SettingUpdate(BaseModel):
    reference_voltage: Optional[float] = None
    lower_threshold: Optional[float] = None
    upper_threshold: Optional[float] = None
    simulation_interval: Optional[float] = None
    electricity_tariff: Optional[float] = None
    co2_emissions_factor: Optional[float] = None

class InjectRequest(BaseModel):
    scenario: str
    custom_voltage: Optional[float] = None

class ApplianceToggleRequest(BaseModel):
    operating_status: str

# Active WebSocket connections list
connected_clients: List[WebSocket] = []
clients_lock = threading.Lock()

def ws_broadcaster(reading: Dict[str, Any]):
    """Called by simulation_engine whenever a new reading arrives."""
    payload = json.dumps(reading)
    with clients_lock:
        to_remove = []
        for ws in connected_clients:
            try:
                # Use asyncio schedule or fire-and-forget
                asyncio.run_coroutine_threadsafe(ws.send_text(payload), app_loop)
            except Exception:
                to_remove.append(ws)
        for dead_ws in to_remove:
            if dead_ws in connected_clients:
                connected_clients.remove(dead_ws)

app_loop = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global app_loop
    app_loop = asyncio.get_running_loop()
    
    # 1. Initialize SQLite Database
    init_db()

    # 2. Pre-seed sample dataset if database has 0 readings
    readings = get_recent_readings(5)
    if len(readings) == 0:
        print("Initializing database with baseline sample dataset...")
        engine.load_sample_dataset()

    # 3. Register engine broadcast hook
    engine.subscribe(ws_broadcaster)

    # 4. Ensure an initial reading exists so connecting clients immediately receive data
    if not engine.last_reading:
        engine.step()


    # 4. Try optional background MQTT listener (graceful if broker is offline)
    try:
        from mqtt_listener import start_listener
        mqtt_thread = threading.Thread(target=start_listener, daemon=True)
        mqtt_thread.start()
    except Exception as e:
        print(f"MQTT listener not started: {e}")

    yield

    engine.unsubscribe(ws_broadcaster)
    engine.pause_simulation()

app = FastAPI(
    title="AI-Powered Smart Energy Monitoring & Anomaly Detection Platform",
    description="Software simulation platform for voltage classification, AI anomaly detection, and appliance protection.",
    version="2.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {
        "status": "healthy",
        "simulation_running": engine.is_running,
        "disclaimer": "SIMULATED DATA - NO PHYSICAL SENSORS CONNECTED"
    }

@app.get("/api/status")
def get_system_status():
    settings = get_settings()
    recent = get_recent_readings(1)
    last_r = recent[-1] if recent else engine.last_reading
    appliances = engine.evaluate_appliances_risk(last_r["voltage_V"] if last_r else 220.0)
    at_risk = sum(1 for a in appliances if a["risk_category"] in ("HIGH RISK", "WARNING"))

    return {
        "simulation_status": "RUNNING" if engine.is_running else "PAUSED",
        "is_running": engine.is_running,
        "interval_seconds": engine.interval,
        "last_reading": last_r,
        "settings": settings,
        "total_kwh": round(engine.total_kwh, 6),
        "total_cost_inr": round(engine.total_cost_eur, 2),
        "total_cost_eur": round(engine.total_cost_eur, 2),
        "currency": "INR",
        "currency_symbol": "₹",
        "total_co2_kg": round(engine.total_co2_kg, 4),
        "total_saving_inr": round(engine.total_saving_eur, 2),
        "total_saving_eur": round(engine.total_saving_eur, 2),
        "anomalies_detected": engine.anomalies_detected_count,
        "appliances_at_risk": at_risk,
        "ai_explanation": getattr(engine, "latest_ai_explanation", "System nominal."),
        "label": "SIMULATED DATA - NO PHYSICAL SENSORS CONNECTED"
    }

@app.get("/api/readings")
def get_readings(limit: int = Query(100, ge=1, le=500)):
    return get_recent_readings(limit)

@app.post("/api/simulation/start")
def start_simulation():
    engine.start_simulation()
    return {"status": "started", "is_running": True}

@app.post("/api/simulation/pause")
def pause_simulation():
    engine.pause_simulation()
    return {"status": "paused", "is_running": False}

@app.post("/api/simulation/reset")
def reset_simulation():
    engine.reset_simulation()
    return {"status": "reset", "is_running": False}

@app.post("/api/simulation/step")
def step_simulation():
    reading = engine.step()
    return reading

@app.post("/api/simulation/inject")
def inject_scenario(payload: InjectRequest):
    reading = engine.inject(payload.scenario, payload.custom_voltage)
    return reading

@app.post("/api/simulation/load-dataset")
def reload_dataset():
    engine.load_sample_dataset()
    return {"status": "sample dataset loaded", "count": len(engine.dataset_rows)}

@app.get("/api/appliances")
def list_appliances():
    last_v = engine.last_reading["voltage_V"] if engine.last_reading else 220.0
    return engine.evaluate_appliances_risk(last_v)

@app.post("/api/appliances/{appliance_id}/toggle")
def toggle_appliance(appliance_id: str, payload: ApplianceToggleRequest):
    valid_statuses = ["ON", "OFF"]
    if payload.operating_status not in valid_statuses:
        raise HTTPException(status_code=400, detail="Invalid status. Must be ON or OFF.")
    result = engine.toggle_appliance(appliance_id, payload.operating_status)
    return result

@app.get("/api/events")
def list_events(filter_type: Optional[str] = Query("ALL"), limit: int = Query(100, ge=1, le=500)):
    return get_events(filter_type, limit)

@app.get("/events")
def legacy_events(limit: int = 50):
    """Backwards compatibility for legacy frontend endpoint."""
    return get_events("ALL", limit)

@app.get("/api/events/export")
def export_events_csv():
    events = get_events("ALL", 1000)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Timestamp", "Time_ISO", "Event_Type", "Voltage_V", "Current_A",
        "Classification", "AI_Anomaly_Result", "Affected_Appliances",
        "Risk_Explanation", "Recommended_Action", "Protection_Action"
    ])
    for e in events:
        t_iso = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(e.get("timestamp", time.time())))
        writer.writerow([
            e.get("timestamp"),
            t_iso,
            e.get("event_type"),
            e.get("voltage_V"),
            e.get("current_A"),
            e.get("classification"),
            e.get("ai_anomaly_result"),
            json.dumps(e.get("affected_appliances", [])),
            e.get("risk_explanation"),
            e.get("recommended_action"),
            e.get("protection_action")
        ])
    output.seek(0)
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=energy_events_export.csv"}
    )

@app.get("/api/reports/summary")
def get_report_summary():
    readings = get_recent_readings(500)
    events = get_events("ALL", 500)
    if not readings:
        return {"error": "No records in reporting period"}

    voltages = [r["voltage_V"] for r in readings]
    min_v = round(min(voltages), 1)
    max_v = round(max(voltages), 1)
    avg_v = round(sum(voltages) / len(voltages), 1)

    hv_count = sum(1 for r in readings if r.get("voltage_classification") == "HIGH VOLTAGE")
    lv_count = sum(1 for r in readings if r.get("voltage_classification") == "LOW VOLTAGE")
    ai_count = sum(1 for r in readings if r.get("is_ai_anomaly") == 1)
    prot_count = sum(1 for e in events if e.get("event_type") == "PROTECTION_ACTION")

    total_kwh = sum(r.get("kwh", 0.0) for r in readings)
    total_cost = sum(r.get("cost_eur", 0.0) for r in readings)
    total_co2 = sum(r.get("co2_kg", 0.0) for r in readings)

    appliances = engine.evaluate_appliances_risk(avg_v)

    return {
        "period": "Current Simulation Run",
        "readings_count": len(readings),
        "min_voltage_V": min_v,
        "max_voltage_V": max_v,
        "avg_voltage_V": avg_v,
        "high_voltage_events": hv_count,
        "low_voltage_events": lv_count,
        "ai_anomaly_count": ai_count,
        "simulated_protection_actions": prot_count,
        "total_energy_kwh": round(total_kwh, 4),
        "estimated_cost_eur": round(total_cost, 2),
        "estimated_co2_kg": round(total_co2, 3),
        "appliances_summary": appliances,
        "recommended_follow_up": (
            "1. Inspect automatic voltage regulation if high/low voltage events exceed 5% of total readings. "
            "2. Verify reactive power compensation for low power-factor signatures. "
            "3. Ensure simulated protection isolation policies are maintained for sensitive compressor and heating loads."
        ),
        "disclaimer": "Simulated evaluation report - generated for demonstration and engineering analysis only."
    }

@app.get("/api/reports/export")
def export_full_report_csv():
    summary = get_report_summary()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ENERGY ANOMALY MONITOR - EXECUTIVE SIMULATION REPORT"])
    writer.writerow(["Generated At", time.strftime('%Y-%m-%d %H:%M:%S')])
    writer.writerow(["Disclaimer", "SIMULATED DATA - NO PHYSICAL SENSORS CONNECTED"])
    writer.writerow([])
    writer.writerow(["Metric", "Value"])
    writer.writerow(["Total Readings Evaluated", summary.get("readings_count")])
    writer.writerow(["Minimum Voltage (V)", summary.get("min_voltage_V")])
    writer.writerow(["Maximum Voltage (V)", summary.get("max_voltage_V")])
    writer.writerow(["Average Voltage (V)", summary.get("avg_voltage_V")])
    writer.writerow(["High-Voltage Events Count", summary.get("high_voltage_events")])
    writer.writerow(["Low-Voltage Events Count", summary.get("low_voltage_events")])
    writer.writerow(["AI Anomaly Count", summary.get("ai_anomaly_count")])
    writer.writerow(["Simulated Protection Actions", summary.get("simulated_protection_actions")])
    writer.writerow(["Total Energy (kWh)", summary.get("total_energy_kwh")])
    writer.writerow(["Estimated Electricity Cost (EUR)", summary.get("estimated_cost_eur")])
    writer.writerow(["Estimated CO2 Emissions (kg)", summary.get("estimated_co2_kg")])
    writer.writerow([])
    writer.writerow(["Recommended Follow-up Actions", summary.get("recommended_follow_up")])

    output.seek(0)
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=energy_simulation_report.csv"}
    )

@app.get("/api/settings")
def get_all_settings():
    return get_settings()

@app.post("/api/settings")
def save_settings(settings: SettingUpdate):
    if settings.reference_voltage is not None:
        if settings.reference_voltage <= 0 or settings.reference_voltage > 500:
            raise HTTPException(status_code=400, detail="Invalid reference voltage.")
        update_setting("reference_voltage", settings.reference_voltage)

    if settings.lower_threshold is not None:
        if settings.lower_threshold <= 50 or settings.lower_threshold >= 300:
            raise HTTPException(status_code=400, detail="Invalid lower threshold.")
        update_setting("lower_threshold", settings.lower_threshold)

    if settings.upper_threshold is not None:
        if settings.upper_threshold <= 100 or settings.upper_threshold >= 500:
            raise HTTPException(status_code=400, detail="Invalid upper threshold.")
        update_setting("upper_threshold", settings.upper_threshold)

    if settings.simulation_interval is not None:
        if settings.simulation_interval < 0.2 or settings.simulation_interval > 60:
            raise HTTPException(status_code=400, detail="Interval must be between 0.2s and 60s.")
        update_setting("simulation_interval", settings.simulation_interval)
        engine.interval = settings.simulation_interval

    if settings.electricity_tariff is not None:
        update_setting("electricity_tariff", max(0.01, settings.electricity_tariff))

    if settings.co2_emissions_factor is not None:
        update_setting("co2_emissions_factor", max(0.01, settings.co2_emissions_factor))

    return get_settings()

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    with clients_lock:
        connected_clients.append(ws)

    # Immediately send the latest reading if available so client never starts empty
    if engine.last_reading:
        try:
            await ws.send_text(json.dumps(engine.last_reading))
        except Exception:
            pass

    try:
        while True:
            # Keep socket alive and accept incoming messages (e.g. ping/commands)
            msg = await ws.receive_text()
            try:
                cmd = json.loads(msg)
                action = cmd.get("action")
                if action == "STEP":
                    engine.step()
                elif action == "START":
                    engine.start_simulation()
                elif action == "PAUSE":
                    engine.pause_simulation()
                elif action == "RESET":
                    engine.reset_simulation()
            except Exception:
                pass
    except WebSocketDisconnect:
        pass
    finally:
        with clients_lock:
            if ws in connected_clients:
                connected_clients.remove(ws)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)