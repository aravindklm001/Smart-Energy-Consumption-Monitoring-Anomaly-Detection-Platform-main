import time
import os
import csv
import json
import random
import threading
from typing import Dict, Any, List, Optional, Callable
from database import (
    get_settings, get_appliances, set_appliance_status,
    save_reading, save_event, get_recent_readings, clear_simulation_data
)
from models.isolation_forest import EnergyAnomalyDetector
from models.autoencoder import AutoencoderDetector
from co2_calculator import calculate_step_energy

CSV_DATA_FILE = os.path.join(os.path.dirname(__file__), "..", "energy_readings.csv")

class SimulationEngine:
    def __init__(self):
        self.is_running = False
        self.interval = 2.0
        self.dataset_rows: List[Dict[str, Any]] = []
        self.current_idx = 0
        self.injected_override: Optional[Dict[str, Any]] = None
        
        self.iso_detector = EnergyAnomalyDetector()
        self.ae_detector = AutoencoderDetector()
        
        self.subscribers: List[Callable[[Dict[str, Any]], None]] = []
        self._thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self.lock = threading.Lock()

        # Cumulative counters
        self.total_kwh = 0.0
        self.total_cost_eur = 0.0
        self.total_co2_kg = 0.0
        self.total_saving_eur = 0.0
        self.anomalies_detected_count = 0
        self.last_reading: Optional[Dict[str, Any]] = None

        self._load_dataset()

    def _load_dataset(self):
        """Loads synthetic energy_readings.csv into memory."""
        if not os.path.exists(CSV_DATA_FILE):
            print(f"Dataset {CSV_DATA_FILE} not found; will generate inline fallback.")
            return

        rows = []
        try:
            with open(CSV_DATA_FILE, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for r in reader:
                    rows.append({
                        "timestamp": float(r["timestamp"]),
                        "voltage_V": float(r["voltage_V"]),
                        "current_A": float(r["current_A"]),
                        "power_W": float(r["power_W"]),
                        "frequency_Hz": float(r["frequency_Hz"]),
                        "power_factor": float(r["power_factor"]),
                        "appliance_id": r.get("appliance_id", "APP-01"),
                        "operating_status": r.get("operating_status", "ON")
                    })
            self.dataset_rows = rows
            print(f"SimulationEngine: loaded {len(self.dataset_rows)} records from {CSV_DATA_FILE}")
        except Exception as e:
            print(f"Error reading dataset: {e}")

    def subscribe(self, callback: Callable[[Dict[str, Any]], None]):
        with self.lock:
            if callback not in self.subscribers:
                self.subscribers.append(callback)

    def unsubscribe(self, callback: Callable[[Dict[str, Any]], None]):
        with self.lock:
            if callback in self.subscribers:
                self.subscribers.remove(callback)

    def _broadcast(self, data: Dict[str, Any]):
        for cb in list(self.subscribers):
            try:
                cb(data)
            except Exception:
                pass

    def classify_voltage(self, voltage: float, lower_limit: float = 200.0, upper_limit: float = 240.0) -> Dict[str, Any]:
        """
        Exact voltage classification logic:
        If voltage < 200 V: status = LOW VOLTAGE
        If 200 V <= voltage <= 240 V: status = NORMAL
        If voltage > 240 V: status = HIGH VOLTAGE
        At exactly 200 V and 240 V, status must be NORMAL.
        """
        if voltage < lower_limit:
            status = "LOW VOLTAGE"
            severity = "CRITICAL" if voltage < (lower_limit - 15) else "WARNING"
        elif voltage > upper_limit:
            status = "HIGH VOLTAGE"
            severity = "CRITICAL" if voltage > (upper_limit + 10) else "WARNING"
        else:
            status = "NORMAL"
            severity = "NORMAL"

        return {
            "status": status,
            "severity": severity
        }

    def evaluate_appliances_risk(self, voltage: float) -> List[Dict[str, Any]]:
        """
        Evaluates risk for each appliance based on operating status, voltage, and rated voltage range.
        """
        appliances = get_appliances()
        evaluated = []

        for app in appliances:
            status = app.get("operating_status", "ON")
            v_min = float(app.get("v_min", 200.0))
            v_max = float(app.get("v_max", 240.0))
            name = app.get("name", "Unknown")

            if status == "OFF":
                risk = "PROTECTED"
                reason = "Simulated load is switched OFF and isolated from the active supply circuit."
                action = "Maintain simulated disconnection until voltage normalizes."
            else:
                if voltage < v_min:
                    is_severe = voltage < (v_min - 15)
                    risk = "HIGH RISK" if is_severe else "WARNING"
                    reason = f"Voltage ({voltage:.1f} V) is below rated minimum threshold ({v_min:.0f} V). Risk of motor stall or thermal overload."
                    action = f"Simulated OFF recommended for {name} to prevent undervoltage damage."
                elif voltage > v_max:
                    is_severe = voltage > (v_max + 10)
                    risk = "HIGH RISK" if is_severe else "WARNING"
                    reason = f"Voltage ({voltage:.1f} V) exceeds rated maximum threshold ({v_max:.0f} V). Risk of dielectric breakdown or surge damage."
                    action = f"Trigger simulated overvoltage trip for {name} immediately."
                else:
                    risk = "SAFE"
                    reason = f"Voltage ({voltage:.1f} V) is within safe specified range ({v_min:.0f} V - {v_max:.0f} V)."
                    action = "Normal operation."

            evaluated.append({
                **app,
                "risk_category": risk,
                "reason": reason,
                "recommended_action": action
            })

        return evaluated

    def generate_ai_explanation(
        self,
        voltage: float,
        v_class: str,
        ref_v: float,
        upper_v: float,
        lower_v: float,
        iso_res: Dict[str, Any],
        ae_res: Dict[str, Any],
        affected_apps: List[Dict[str, Any]],
        curr: float,
        pf: float,
        freq: float
    ) -> str:
        """
        Dynamically generates a context-aware engineering explanation for the current reading.
        Never hardcoded; references actual measured readings, thresholds, AI scores, and appliance risks.
        """
        dev_v = voltage - ref_v
        dev_pct = (dev_v / ref_v) * 100.0
        at_risk_names = [a["name"] for a in affected_apps if a["risk_category"] in ("HIGH RISK", "WARNING")]

        if v_class == "HIGH VOLTAGE":
            names_str = ", ".join(at_risk_names[:3]) if at_risk_names else "connected equipment"
            return (
                f"High voltage detected: {voltage:.1f} V. The configured upper limit is {upper_v:.0f} V. "
                f"The supply is {dev_v:+.1f} V ({dev_pct:+.1f}%) above the {ref_v:.0f} V reference. "
                f"{len(at_risk_names)} appliance(s) ({names_str}) have been flagged for input-range review. "
                f"Check their rated specifications and inspect the supply condition."
            )
        elif v_class == "LOW VOLTAGE":
            names_str = ", ".join(at_risk_names[:3]) if at_risk_names else "connected equipment"
            return (
                f"Low voltage detected: {voltage:.1f} V. The configured lower limit is {lower_v:.0f} V. "
                f"The supply is {dev_v:+.1f} V ({dev_pct:+.1f}%) below the {ref_v:.0f} V reference. "
                f"{len(at_risk_names)} appliance(s) ({names_str}) are exposed to undervoltage stress. "
                f"Motorized appliances may experience inductive overheating; review simulated isolation."
            )
        elif iso_res["iso_anomaly"] or ae_res["ae_anomaly"]:
            flagged = iso_res.get("flagged_feature") or ae_res.get("flagged_feature") or "electrical signature"
            return (
                f"Supply voltage is nominal at {voltage:.1f} V (within {lower_v:.0f}V–{upper_v:.0f}V limits). "
                f"However, AI anomaly detection flagged an unusual multidimensional pattern primarily in {flagged} "
                f"(Current: {curr:.2f}A, Power Factor: {pf:.2f}, Freq: {freq:.2f}Hz). "
                f"Isolation Forest score: {iso_res['iso_score']}, AE reconstruction error: {ae_res['reconstruction_error']}. "
                f"Inspect load balance and power factor compensation."
            )
        else:
            return (
                f"Nominal operating conditions: Supply voltage is {voltage:.1f} V ({dev_v:+.1f} V from {ref_v:.0f} V reference). "
                f"Grid frequency is stable at {freq:.2f} Hz with {pf:.2f} power factor. "
                f"Both Isolation Forest and Autoencoder models confirm normal distribution. "
                f"All {len(affected_apps)} appliances operating within rated tolerances."
            )

    def step(self) -> Dict[str, Any]:
        """Executes one simulation step, updates models, logs reading and events, returns step payload."""
        settings = get_settings()
        ref_v = settings.get("reference_voltage", 220.0)
        lower_v = settings.get("lower_threshold", 200.0)
        upper_v = settings.get("upper_threshold", 240.0)
        tariff = settings.get("electricity_tariff", 0.32)
        co2_factor = settings.get("co2_emissions_factor", 0.380)

        # 1. Get raw reading from dataset or injection
        with self.lock:
            if self.injected_override:
                raw_v = float(self.injected_override.get("voltage", 220.0))
                raw_curr = float(self.injected_override.get("current", 4.5))
                raw_p = float(self.injected_override.get("power", raw_v * raw_curr * 0.95))
                raw_freq = float(self.injected_override.get("frequency", 50.0))
                raw_pf = float(self.injected_override.get("power_factor", 0.95))
                app_id = self.injected_override.get("appliance_id", "SIM-INJECT")
                op_status = self.injected_override.get("operating_status", "ON")
            elif self.dataset_rows:
                row = self.dataset_rows[self.current_idx % len(self.dataset_rows)]
                self.current_idx = (self.current_idx + 1) % len(self.dataset_rows)
                raw_v = float(row["voltage_V"])
                raw_curr = float(row["current_A"])
                raw_p = float(row["power_W"])
                raw_freq = float(row["frequency_Hz"])
                raw_pf = float(row["power_factor"])
                app_id = row.get("appliance_id", "APP-01")
                op_status = row.get("operating_status", "ON")
            else:
                raw_v = round(random.uniform(218.0, 222.0), 1)
                raw_freq = 50.0
                raw_pf = 0.95
                raw_p = 500.0
                raw_curr = round(raw_p / (raw_v * raw_pf), 2)
                app_id = "APP-01"
                op_status = "ON"

        # 2. Adjust power load based on active appliances in database
        appliances = get_appliances()
        active_app_power = sum(a["rated_power_W"] for a in appliances if a["operating_status"] == "ON")
        total_power_w = max(50.0, raw_p + (active_app_power * 0.15))
        current_a = round(total_power_w / (raw_v * max(0.2, raw_pf)), 2)

        # 3. Voltage classification
        classification_res = self.classify_voltage(raw_v, lower_v, upper_v)
        v_class = classification_res["status"]
        severity = classification_res["severity"]
        dev_v = round(raw_v - ref_v, 2)
        dev_pct = round((dev_v / ref_v) * 100.0, 2)

        # 4. AI ML Anomaly Detection (Isolation Forest + Autoencoder)
        self.iso_detector.add_reading(raw_v, current_a, total_power_w, raw_freq, raw_pf)
        self.ae_detector.add_and_train(raw_v, current_a, total_power_w, raw_freq, raw_pf)
        iso_pred = self.iso_detector.predict(raw_v, current_a, total_power_w, raw_freq, raw_pf)
        ae_pred = self.ae_detector.predict(raw_v, current_a, total_power_w, raw_freq, raw_pf)

        is_ai_anomaly = bool(iso_pred["iso_anomaly"] or ae_pred["ae_anomaly"])

        # 5. Energy and environmental calculations
        step_energy = calculate_step_energy(total_power_w, self.interval, tariff, co2_factor)
        step_kwh = step_energy["step_kwh"]

        self.total_kwh += step_kwh
        self.total_cost_eur += step_energy["cost_eur"]
        self.total_co2_kg += step_energy["co2_kg"]
        self.total_saving_eur += step_energy["potential_saving_eur"]

        if v_class != "NORMAL" or is_ai_anomaly:
            self.anomalies_detected_count += 1

        # 6. Appliance risk analysis
        evaluated_apps = self.evaluate_appliances_risk(raw_v)
        at_risk_apps = [a for a in evaluated_apps if a["risk_category"] in ("HIGH RISK", "WARNING")]

        # 7. AI dynamic explanation
        ai_explanation = self.generate_ai_explanation(
            raw_v, v_class, ref_v, upper_v, lower_v,
            iso_pred, ae_pred, evaluated_apps,
            current_a, raw_pf, raw_freq
        )
        self.latest_ai_explanation = ai_explanation

        ts = time.time()
        reading_payload = {
            "timestamp": ts,
            "voltage_V": raw_v,
            "current_A": current_a,
            "power_W": round(total_power_w, 1),
            "frequency_Hz": raw_freq,
            "power_factor": raw_pf,
            "appliance_id": app_id,
            "operating_status": op_status,
            "voltage_classification": v_class,
            "severity": severity,
            "deviation_v": dev_v,
            "deviation_pct": dev_pct,
            "reference_voltage": ref_v,
            "lower_threshold": lower_v,
            "upper_threshold": upper_v,
            "is_ai_anomaly": is_ai_anomaly,
            "iso_anomaly": iso_pred["iso_anomaly"],
            "iso_score": iso_pred["iso_score"],
            "iso_flagged": iso_pred["flagged_feature"],
            "ae_anomaly": ae_pred["ae_anomaly"],
            "ae_error": ae_pred["reconstruction_error"],
            "ae_threshold": ae_pred["ae_threshold"],
            "ae_flagged": ae_pred["flagged_feature"],
            "step_kwh": step_kwh,
            "total_kwh": round(self.total_kwh, 6),
            "co2_kg": round(step_energy["co2_kg"], 6),
            "total_co2_kg": round(self.total_co2_kg, 4),
            "cost_eur": round(step_energy["cost_eur"], 6),
            "total_cost_eur": round(self.total_cost_eur, 3),
            "total_saving_eur": round(self.total_saving_eur, 3),
            "appliances_at_risk_count": len(at_risk_apps),
            "appliances": evaluated_apps,
            "ai_explanation": ai_explanation,
            "is_simulated": True,
            "simulation_label": "SIMULATED DATA - NO PHYSICAL SENSORS CONNECTED"
        }

        self.last_reading = reading_payload

        # Save to SQLite
        save_reading(reading_payload)

        # Log event if an anomaly or alert occurred
        if v_class != "NORMAL" or is_ai_anomaly:
            event_type = "VOLTAGE_ALERT" if v_class != "NORMAL" else "AI_ANOMALY"
            ai_str = f"ISO={iso_pred['iso_anomaly']}, AE={ae_pred['ae_anomaly']} ({iso_pred['flagged_feature']})"
            risk_exp = f"{v_class}: {dev_v:+.1f}V from {ref_v}V. {len(at_risk_apps)} appliances at risk." if v_class != "NORMAL" else f"AI Anomaly: {iso_pred.get('explanation')}"
            rec_act = "Verify supply voltage regulators and switch sensitive appliances to Simulated OFF." if v_class != "NORMAL" else "Inspect reactive power / harmonics on branch circuit."

            save_event({
                "timestamp": ts,
                "event_type": event_type,
                "voltage_V": raw_v,
                "current_A": current_a,
                "classification": v_class,
                "ai_anomaly_result": ai_str,
                "affected_appliances": [a["name"] for a in at_risk_apps],
                "risk_explanation": risk_exp,
                "recommended_action": rec_act,
                "protection_action": ""
            })

        self._broadcast(reading_payload)
        return reading_payload

    def start_simulation(self):
        """Starts real-time 2-second simulation background loop."""
        with self.lock:
            if self.is_running:
                return
            self.is_running = True
            self._stop_event.clear()

        def _run():
            while not self._stop_event.is_set():
                try:
                    self.step()
                except Exception as e:
                    print(f"Simulation step error: {e}")
                if self._stop_event.wait(timeout=self.interval):
                    break

        self._thread = threading.Thread(target=_run, daemon=True)
        self._thread.start()
        print("SimulationEngine started.")

    def pause_simulation(self):
        with self.lock:
            self.is_running = False
            self._stop_event.set()
        print("SimulationEngine paused.")

    def reset_simulation(self):
        self.pause_simulation()
        with self.lock:
            self.current_idx = 0
            self.injected_override = None
            self.total_kwh = 0.0
            self.total_cost_eur = 0.0
            self.total_co2_kg = 0.0
            self.total_saving_eur = 0.0
            self.anomalies_detected_count = 0
            clear_simulation_data()
        self.load_sample_dataset()
        print("SimulationEngine reset to initial state.")

    def load_sample_dataset(self):
        """Loads and pre-populates SQLite with initial sample dataset rows so dashboard is never empty."""
        with self.lock:
            self.current_idx = 0
            self.injected_override = None
            self._load_dataset()
            clear_simulation_data()

        if not self.dataset_rows:
            return []

        # Pre-seed recent 30 rows from dataset into SQLite
        seed_count = min(30, len(self.dataset_rows))
        settings = get_settings()
        ref_v = settings.get("reference_voltage", 220.0)
        lower_v = settings.get("lower_threshold", 200.0)
        upper_v = settings.get("upper_threshold", 240.0)
        tariff = settings.get("electricity_tariff", 0.32)
        co2_factor = settings.get("co2_emissions_factor", 0.380)

        seeded = []
        for i in range(seed_count):
            row = self.dataset_rows[i]
            v = float(row["voltage_V"])
            curr = float(row["current_A"])
            p = float(row["power_W"])
            freq = float(row["frequency_Hz"])
            pf = float(row["power_factor"])
            c_res = self.classify_voltage(v, lower_v, upper_v)
            dev_v = round(v - ref_v, 2)
            dev_pct = round((dev_v / ref_v) * 100.0, 2)
            step_e = calculate_step_energy(p, 2.0, tariff, co2_factor)

            record = {
                "timestamp": float(row["timestamp"]),
                "voltage_V": v,
                "current_A": curr,
                "power_W": p,
                "frequency_Hz": freq,
                "power_factor": pf,
                "appliance_id": row["appliance_id"],
                "operating_status": row["operating_status"],
                "voltage_classification": c_res["status"],
                "deviation_v": dev_v,
                "deviation_pct": dev_pct,
                "is_ai_anomaly": 0,
                "iso_anomaly": 0,
                "iso_score": 0.45,
                "ae_anomaly": 0,
                "ae_error": 0.02,
                "co2_kg": step_e["co2_kg"],
                "cost_eur": step_e["cost_eur"],
                "kwh": step_e["step_kwh"]
            }
            save_reading(record)
            seeded.append(record)

        # Run one step so engine state has latest reading
        self.step()
        return seeded

    def inject(self, scenario: str, custom_voltage: Optional[float] = None):
        """
        Injects deterministic demonstration scenarios:
        - HIGH_VOLTAGE (248.0 V or custom)
        - LOW_VOLTAGE (185.0 V or custom)
        - CURRENT_ANOMALY (220.0 V, 22.5 A surge)
        - NORMAL (220.0 V)
        """
        with self.lock:
            if scenario == "HIGH_VOLTAGE":
                v = custom_voltage if custom_voltage is not None else 248.0
                self.injected_override = {
                    "voltage": v,
                    "current": 6.8,
                    "power": round(v * 6.8 * 0.94, 1),
                    "frequency": 50.02,
                    "power_factor": 0.94,
                    "appliance_id": "SIM-INJECT-HV",
                    "operating_status": "ON"
                }
            elif scenario == "LOW_VOLTAGE":
                v = custom_voltage if custom_voltage is not None else 185.0
                self.injected_override = {
                    "voltage": v,
                    "current": 4.1,
                    "power": round(v * 4.1 * 0.92, 1),
                    "frequency": 49.95,
                    "power_factor": 0.92,
                    "appliance_id": "SIM-INJECT-LV",
                    "operating_status": "ON"
                }
            elif scenario == "CURRENT_ANOMALY":
                v = 220.0
                self.injected_override = {
                    "voltage": v,
                    "current": 22.5,
                    "power": 4500.0,
                    "frequency": 48.20,
                    "power_factor": 0.45,
                    "appliance_id": "SIM-INJECT-SURGE",
                    "operating_status": "ON"
                }
            elif scenario == "NORMAL":
                self.injected_override = None
            else:
                self.injected_override = None

        # Execute immediate step with injected parameter
        return self.step()

    def toggle_appliance(self, appliance_id: str, new_status: str) -> Dict[str, Any]:
        """
        Simulates appliance ON/OFF toggle:
        - Updates operating status in DB
        - Removes/restores load
        - Records protection event
        - Returns updated appliance & load details
        """
        updated = set_appliance_status(appliance_id, new_status)
        last_v = self.last_reading["voltage_V"] if self.last_reading else 220.0
        last_curr = self.last_reading["current_A"] if self.last_reading else 0.0

        action_desc = f"Simulated {new_status} triggered for {updated['name']} ({appliance_id}). Rated load ({updated['rated_power_W']} W) {'connected to' if new_status == 'ON' else 'removed from'} active simulation."

        save_event({
            "timestamp": time.time(),
            "event_type": "PROTECTION_ACTION",
            "voltage_V": last_v,
            "current_A": last_curr,
            "classification": self.classify_voltage(last_v)["status"],
            "ai_anomaly_result": "Appliance state modification",
            "affected_appliances": [updated["name"]],
            "risk_explanation": f"Operator requested simulated {new_status} action.",
            "recommended_action": "Monitoring supply voltage continuity.",
            "protection_action": action_desc
        })

        # Recalculate immediate step
        self.step()

        return {
            "appliance": updated,
            "message": f"Successfully set {updated['name']} to Simulated {new_status}. Simulated load recalculated.",
            "disclaimer": "Simulated control action only. No physical electrical disconnection performed."
        }

engine = SimulationEngine()
