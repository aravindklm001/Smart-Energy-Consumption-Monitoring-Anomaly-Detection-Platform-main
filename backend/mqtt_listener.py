import paho.mqtt.client as mqtt
import json, os, time
from influxdb_client import InfluxDBClient, Point
from influxdb_client.client.write_api import SYNCHRONOUS
from dotenv import load_dotenv
from models.isolation_forest import EnergyAnomalyDetector
from models.autoencoder import AutoencoderDetector
from co2_calculator import calculate

load_dotenv()

try:
    influx = InfluxDBClient(
        url=os.getenv("INFLUX_URL", "http://localhost:8086"),
        token=os.getenv("INFLUX_TOKEN", "my-super-secret-token"),
        org=os.getenv("INFLUX_ORG", "energyorg"),
    )
    write_api = influx.write_api(write_options=SYNCHRONOUS)
    _influx_available = True
except Exception as e:
    write_api = None
    _influx_available = False

iso_detector = EnergyAnomalyDetector()
ae_detector  = AutoencoderDetector()
latest_events = []

def on_message(client, userdata, msg):
    try:
        data = json.loads(msg.payload)
    except Exception:
        return

    voltage = float(data.get("voltage_V") or data.get("voltage") or 220.0)
    current = float(data.get("current_A") or data.get("current") or 3.5)
    power   = float(data.get("power_W") or (data.get("kwh", 0.05) * 60 * 1000) or 750.0)
    freq    = float(data.get("frequency_Hz") or 50.0)
    pf      = float(data.get("power_factor") or 0.95)
    kwh     = float(data.get("kwh") or (power * (2.0 / 3600.0) / 1000.0))

    # Update models
    iso_detector.add_reading(voltage, current, power, freq, pf)
    ae_detector.add_and_train(voltage, current, power, freq, pf)

    iso = iso_detector.predict(voltage, current, power, freq, pf)
    ae  = ae_detector.predict(voltage, current, power, freq, pf)
    co2 = calculate(kwh)

    both_ready = iso["iso_ready"] and ae["ae_ready"]
    one_ready  = iso["iso_ready"] or ae["ae_ready"]

    if both_ready:
        is_anomaly = iso["iso_anomaly"] and ae["ae_anomaly"]
    elif one_ready:
        is_anomaly = iso["iso_anomaly"] or ae["ae_anomaly"]
    else:
        is_anomaly = False

    # Optional InfluxDB write
    if _influx_available and write_api is not None:
        try:
            point = (
                Point("energy_reading")
                .tag("sensor_id", data.get("sensor_id", "sim_sensor"))
                .field("kwh", kwh)
                .field("voltage", voltage)
                .field("current", current)
                .field("power", power)
                .field("anomaly", int(is_anomaly))
                .field("iso_score", iso["iso_score"])
                .field("ae_error", ae["reconstruction_error"])
                .field("ae_threshold", ae["ae_threshold"] or 0.0)
                .field("co2_kg", co2["co2_kg"])
                .field("cost_eur", co2["cost_eur"])
            )
            write_api.write(bucket=os.getenv("INFLUX_BUCKET", "energy"), record=point)
        except Exception:
            pass

    event = {
        **data,
        "voltage_V":           voltage,
        "current_A":           current,
        "power_W":             power,
        "frequency_Hz":        freq,
        "power_factor":        pf,
        "is_anomaly":          is_anomaly,
        "iso_anomaly":         iso["iso_anomaly"],
        "iso_score":           iso["iso_score"],
        "iso_ready":           iso["iso_ready"],
        "ae_anomaly":          ae["ae_anomaly"],
        "reconstruction_error": ae["reconstruction_error"],
        "ae_threshold":        ae["ae_threshold"],
        "ae_ready":            ae["ae_ready"],
        **co2
    }
    latest_events.append(event)
    if len(latest_events) > 100:
        latest_events.pop(0)

def start_listener():
    client = mqtt.Client()
    client.on_message = on_message
    broker = os.getenv("MQTT_BROKER", "localhost")
    port = int(os.getenv("MQTT_PORT", 1883))
    try:
        client.connect(broker, port, keepalive=60)
        client.subscribe(os.getenv("MQTT_TOPIC", "energy/sensors"))
        print(f"MQTT listener successfully subscribed to {broker}:{port}")
        client.loop_forever()
    except Exception as e:
        print(f"MQTT listener idle ({e}) — embedded simulation engine active.")