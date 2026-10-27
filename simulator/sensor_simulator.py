import paho.mqtt.client as mqtt
import json, time, os, random
import pandas as pd
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

BROKER = os.getenv("MQTT_BROKER", "localhost")
PORT   = int(os.getenv("MQTT_PORT", 1883))
TOPIC  = os.getenv("MQTT_TOPIC", "energy/sensors")
SPEED  = float(os.getenv("SIM_SPEED", 2.0))  # seconds between readings

ENERGY_READINGS_FILE = os.path.join(os.path.dirname(__file__), "..", "energy_readings.csv")
UCI_DATA_FILE = os.path.join(os.path.dirname(__file__), "household_power_consumption.txt")

print("=" * 65)
print("  ENERGY SENSOR SOFTWARE SIMULATOR")
print("  SIMULATED DATA - NO PHYSICAL SENSORS CONNECTED")
print("=" * 65)

# Connect to MQTT with exception handling
client = mqtt.Client()
connected = False
try:
    client.connect(BROKER, PORT)
    connected = True
    print(f"Connected to MQTT broker at {BROKER}:{PORT}")
except Exception as e:
    print(f"[!] Warning: Could not connect to MQTT broker at {BROKER}:{PORT} ({e}).")
    print("  You can launch the MQTT broker using: python run_broker.py")
    print("  Note: The Web Dashboard also features an embedded simulation engine!")

# Load dataset: prioritize energy_readings.csv
if os.path.exists(ENERGY_READINGS_FILE):
    print(f"Loading synthetic dataset: {ENERGY_READINGS_FILE}")
    df = pd.read_csv(ENERGY_READINGS_FILE)
    use_synthetic = True
else:
    print(f"Loading UCI dataset: {UCI_DATA_FILE}")
    df = pd.read_csv(UCI_DATA_FILE, sep=";", low_memory=False, na_values=["?"])
    df.dropna(inplace=True)
    df["Global_active_power"] = pd.to_numeric(df["Global_active_power"])
    df["Voltage"] = pd.to_numeric(df["Voltage"])
    df["Global_intensity"] = pd.to_numeric(df["Global_intensity"])
    df["kwh"] = df["Global_active_power"] / 60.0
    use_synthetic = False

print(f"Dataset loaded: {len(df):,} simulated readings ready.")
print("Starting simulation replay (Ctrl+C to stop)...\n")

for i, row in df.iterrows():
    if use_synthetic:
        reading = {
            "timestamp": time.time(),
            "voltage_V": round(float(row["voltage_V"]), 1),
            "current_A": round(float(row["current_A"]), 2),
            "power_W": round(float(row["power_W"]), 1),
            "frequency_Hz": round(float(row["frequency_Hz"]), 2),
            "power_factor": round(float(row["power_factor"]), 2),
            "appliance_id": str(row["appliance_id"]),
            "operating_status": str(row["operating_status"]),
            "kwh": round(float(row["power_W"]) * (SPEED / 3600.0) / 1000.0, 6),
            "simulation_label": "SIMULATED DATA - NO PHYSICAL SENSORS CONNECTED"
        }
    else:
        reading = {
            "timestamp": time.time(),
            "voltage_V": round(float(row["Voltage"]), 1),
            "current_A": round(float(row["Global_intensity"]), 2),
            "power_W": round(float(row["Global_active_power"]) * 1000.0, 1),
            "frequency_Hz": 50.0,
            "power_factor": 0.95,
            "appliance_id": "UCI_HOUSEHOLD",
            "operating_status": "ON",
            "kwh": round(float(row["kwh"]), 4),
            "simulation_label": "SIMULATED DATA - NO PHYSICAL SENSORS CONNECTED"
        }

    payload = json.dumps(reading)
    if connected:
        try:
            client.publish(TOPIC, payload)
        except Exception:
            pass

    v_class = "NORMAL"
    if reading["voltage_V"] < 200: v_class = "LOW VOLTAGE"
    elif reading["voltage_V"] > 240: v_class = "HIGH VOLTAGE"

    print(f"[{time.strftime('%H:%M:%S')}] V={reading['voltage_V']:.1f}V ({v_class}) | "
          f"I={reading['current_A']:.2f}A | P={reading['power_W']:.0f}W | PF={reading['power_factor']:.2f}", flush=True)

    time.sleep(SPEED)

print("Simulation complete.")