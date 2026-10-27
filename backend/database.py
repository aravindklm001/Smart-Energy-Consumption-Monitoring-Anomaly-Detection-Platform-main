import sqlite3
import os
import time
import json
from typing import List, Dict, Any, Optional

DB_PATH = os.path.join(os.path.dirname(__file__), "energy_monitor.db")

DEFAULT_APPLIANCES = [
    {"id": "APP-01", "name": "Refrigerator", "rated_power_W": 150.0, "v_min": 200.0, "v_max": 240.0, "operating_status": "ON"},
    {"id": "APP-02", "name": "Air conditioner", "rated_power_W": 1800.0, "v_min": 210.0, "v_max": 240.0, "operating_status": "ON"},
    {"id": "APP-03", "name": "Television", "rated_power_W": 120.0, "v_min": 180.0, "v_max": 240.0, "operating_status": "ON"},
    {"id": "APP-04", "name": "Water pump", "rated_power_W": 1100.0, "v_min": 200.0, "v_max": 240.0, "operating_status": "ON"},
    {"id": "APP-05", "name": "Laptop charger", "rated_power_W": 65.0, "v_min": 100.0, "v_max": 240.0, "operating_status": "ON"},
    {"id": "APP-06", "name": "LED bulb", "rated_power_W": 15.0, "v_min": 180.0, "v_max": 250.0, "operating_status": "ON"},
    {"id": "APP-07", "name": "Washing machine", "rated_power_W": 750.0, "v_min": 205.0, "v_max": 240.0, "operating_status": "ON"},
    {"id": "APP-08", "name": "Desktop computer", "rated_power_W": 350.0, "v_min": 200.0, "v_max": 240.0, "operating_status": "ON"},
]

DEFAULT_SETTINGS = {
    "reference_voltage": 220.0,
    "lower_threshold": 200.0,
    "upper_threshold": 240.0,
    "simulation_interval": 2.0,
    "electricity_tariff": 8.00,
    "co2_emissions_factor": 0.380,
    "contamination": 0.08,
}

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    c = conn.cursor()

    # Readings table
    c.execute("""
    CREATE TABLE IF NOT EXISTS readings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp REAL,
        voltage_V REAL,
        current_A REAL,
        power_W REAL,
        frequency_Hz REAL,
        power_factor REAL,
        appliance_id TEXT,
        operating_status TEXT,
        voltage_classification TEXT,
        deviation_v REAL,
        deviation_pct REAL,
        is_ai_anomaly INTEGER,
        iso_anomaly INTEGER,
        iso_score REAL,
        ae_anomaly INTEGER,
        ae_error REAL,
        co2_kg REAL,
        cost_eur REAL,
        kwh REAL
    )
    """)

    # Events table
    c.execute("""
    CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp REAL,
        event_type TEXT,
        voltage_V REAL,
        current_A REAL,
        classification TEXT,
        ai_anomaly_result TEXT,
        affected_appliances TEXT,
        risk_explanation TEXT,
        recommended_action TEXT,
        protection_action TEXT
    )
    """)

    # Appliances table
    c.execute("""
    CREATE TABLE IF NOT EXISTS appliances (
        id TEXT PRIMARY KEY,
        name TEXT,
        rated_power_W REAL,
        v_min REAL,
        v_max REAL,
        operating_status TEXT
    )
    """)

    # Settings table
    c.execute("""
    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value REAL
    )
    """)

    conn.commit()

    # Populate default appliances if empty
    c.execute("SELECT COUNT(*) FROM appliances")
    if c.fetchone()[0] == 0:
        for app in DEFAULT_APPLIANCES:
            c.execute(
                "INSERT INTO appliances (id, name, rated_power_W, v_min, v_max, operating_status) VALUES (?, ?, ?, ?, ?, ?)",
                (app["id"], app["name"], app["rated_power_W"], app["v_min"], app["v_max"], app["operating_status"])
            )
        conn.commit()

    # Populate default settings if empty
    c.execute("SELECT COUNT(*) FROM settings")
    if c.fetchone()[0] == 0:
        for k, v in DEFAULT_SETTINGS.items():
            c.execute("INSERT INTO settings (key, value) VALUES (?, ?)", (k, v))
        conn.commit()

    conn.close()

def get_settings() -> Dict[str, float]:
    conn = get_connection()
    c = conn.cursor()
    c.execute("SELECT key, value FROM settings")
    rows = c.fetchall()
    conn.close()
    settings = dict(DEFAULT_SETTINGS)
    for r in rows:
        settings[r["key"]] = float(r["value"])
    return settings

def update_setting(key: str, value: float):
    conn = get_connection()
    c = conn.cursor()
    c.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", (key, value))
    conn.commit()
    conn.close()

def get_appliances() -> List[Dict[str, Any]]:
    conn = get_connection()
    c = conn.cursor()
    c.execute("SELECT id, name, rated_power_W, v_min, v_max, operating_status FROM appliances")
    rows = c.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def set_appliance_status(appliance_id: str, status: str) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    c = conn.cursor()
    c.execute("UPDATE appliances SET operating_status = ? WHERE id = ?", (status, appliance_id))
    conn.commit()
    c.execute("SELECT id, name, rated_power_W, v_min, v_max, operating_status FROM appliances WHERE id = ?", (appliance_id,))
    row = c.fetchone()
    conn.close()
    return dict(row) if row else None

def save_reading(r: Dict[str, Any]):
    conn = get_connection()
    c = conn.cursor()
    c.execute("""
    INSERT INTO readings (
        timestamp, voltage_V, current_A, power_W, frequency_Hz, power_factor,
        appliance_id, operating_status, voltage_classification, deviation_v, deviation_pct,
        is_ai_anomaly, iso_anomaly, iso_score, ae_anomaly, ae_error, co2_kg, cost_eur, kwh
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        r.get("timestamp", time.time()),
        r.get("voltage_V", 220.0),
        r.get("current_A", 0.0),
        r.get("power_W", 0.0),
        r.get("frequency_Hz", 50.0),
        r.get("power_factor", 0.95),
        r.get("appliance_id", ""),
        r.get("operating_status", "ON"),
        r.get("voltage_classification", "NORMAL"),
        r.get("deviation_v", 0.0),
        r.get("deviation_pct", 0.0),
        int(r.get("is_ai_anomaly", 0)),
        int(r.get("iso_anomaly", 0)),
        r.get("iso_score", 0.0),
        int(r.get("ae_anomaly", 0)),
        r.get("ae_error", 0.0),
        r.get("co2_kg", 0.0),
        r.get("cost_eur", 0.0),
        r.get("kwh", 0.0)
    ))
    conn.commit()
    conn.close()

def save_event(event: Dict[str, Any]):
    conn = get_connection()
    c = conn.cursor()
    affected = event.get("affected_appliances", [])
    if isinstance(affected, list):
        affected_str = json.dumps(affected)
    else:
        affected_str = str(affected)

    c.execute("""
    INSERT INTO events (
        timestamp, event_type, voltage_V, current_A, classification,
        ai_anomaly_result, affected_appliances, risk_explanation,
        recommended_action, protection_action
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        event.get("timestamp", time.time()),
        event.get("event_type", "VOLTAGE_ALERT"),
        event.get("voltage_V", 0.0),
        event.get("current_A", 0.0),
        event.get("classification", "NORMAL"),
        event.get("ai_anomaly_result", ""),
        affected_str,
        event.get("risk_explanation", ""),
        event.get("recommended_action", ""),
        event.get("protection_action", "")
    ))
    conn.commit()
    conn.close()

def get_recent_readings(limit: int = 100) -> List[Dict[str, Any]]:
    conn = get_connection()
    c = conn.cursor()
    c.execute("SELECT * FROM readings ORDER BY id DESC LIMIT ?", (limit,))
    rows = c.fetchall()
    conn.close()
    # return in chronological order
    return [dict(r) for r in reversed(rows)]

def get_events(filter_type: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
    conn = get_connection()
    c = conn.cursor()
    if filter_type and filter_type != "ALL":
        if filter_type == "HIGH_VOLTAGE":
            c.execute("SELECT * FROM events WHERE classification = 'HIGH VOLTAGE' ORDER BY id DESC LIMIT ?", (limit,))
        elif filter_type == "LOW_VOLTAGE":
            c.execute("SELECT * FROM events WHERE classification = 'LOW VOLTAGE' ORDER BY id DESC LIMIT ?", (limit,))
        elif filter_type == "AI_ANOMALIES":
            c.execute("SELECT * FROM events WHERE event_type = 'AI_ANOMALY' OR ai_anomaly_result LIKE '%Anomaly%' ORDER BY id DESC LIMIT ?", (limit,))
        elif filter_type == "PROTECTION_ACTIONS":
            c.execute("SELECT * FROM events WHERE event_type = 'PROTECTION_ACTION' OR protection_action != '' ORDER BY id DESC LIMIT ?", (limit,))
        else:
            c.execute("SELECT * FROM events ORDER BY id DESC LIMIT ?", (limit,))
    else:
        c.execute("SELECT * FROM events ORDER BY id DESC LIMIT ?", (limit,))

    rows = c.fetchall()
    conn.close()
    res = []
    for r in rows:
        d = dict(r)
        try:
            d["affected_appliances"] = json.loads(d["affected_appliances"])
        except Exception:
            pass
        res.append(d)
    return res

def clear_simulation_data():
    conn = get_connection()
    c = conn.cursor()
    c.execute("DELETE FROM readings")
    c.execute("DELETE FROM events")
    conn.commit()
    conn.close()
