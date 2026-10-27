import csv
import time
import random

appliances = [
    {"id": "APP-01", "name": "Refrigerator", "power": 150, "v_min": 200, "v_max": 240},
    {"id": "APP-02", "name": "Air conditioner", "power": 1800, "v_min": 210, "v_max": 240},
    {"id": "APP-03", "name": "Television", "power": 120, "v_min": 180, "v_max": 240},
    {"id": "APP-04", "name": "Water pump", "power": 1100, "v_min": 200, "v_max": 240},
    {"id": "APP-05", "name": "Laptop charger", "power": 65, "v_min": 100, "v_max": 240},
    {"id": "APP-06", "name": "LED bulb", "power": 15, "v_min": 180, "v_max": 250},
    {"id": "APP-07", "name": "Washing machine", "power": 750, "v_min": 205, "v_max": 240},
    {"id": "APP-08", "name": "Desktop computer", "power": 350, "v_min": 200, "v_max": 240},
]

rows = []
base_time = int(time.time()) - (120 * 2)

for i in range(120):
    ts = base_time + (i * 2)
    app = appliances[i % len(appliances)]
    
    # Baseline normal values
    v = round(random.uniform(218.0, 222.5), 1)
    freq = round(random.uniform(49.92, 50.08), 2)
    pf = round(random.uniform(0.92, 0.98), 2)
    status = "ON" if random.random() > 0.1 else "OFF"
    
    base_load = 450 + random.uniform(-20, 20)
    if status == "ON":
        p = round(base_load + app["power"] * random.uniform(0.9, 1.05), 1)
    else:
        p = round(base_load, 1)

    # Injected test events & edge cases
    if i == 15:
        # Boundary test: exactly 200.0 V
        v = 200.0
    elif i == 16:
        # Boundary test: 199.9 V (LOW VOLTAGE)
        v = 199.9
    elif 17 <= i <= 22:
        # Low voltage event
        v = 185.0 if i == 19 else round(random.uniform(182.0, 192.0), 1)
    elif i == 40:
        # Reference test: exactly 220.0 V
        v = 220.0
    elif i == 60:
        # Boundary test: exactly 240.0 V (NORMAL)
        v = 240.0
    elif i == 61:
        # Boundary test: 240.1 V (HIGH VOLTAGE)
        v = 240.1
    elif 62 <= i <= 68:
        # High voltage event
        v = 248.0 if i == 64 else round(random.uniform(244.0, 252.0), 1)
    elif 85 <= i <= 88:
        # AI anomaly 1: Normal voltage (220.5V) but poor power factor (0.42)
        v = 220.5
        pf = 0.42
        p = round(base_load * 2.8, 1)
    elif 98 <= i <= 101:
        # AI anomaly 2: Severe current surge & frequency dip (48.15Hz)
        v = 221.0
        freq = 48.15
        p = round(base_load + 2600.0, 1)
    elif 110 <= i <= 112:
        # AI anomaly 3: High frequency fluctuation (51.45Hz) & PF drop
        v = 224.0
        pf = 0.58
        freq = 51.45

    curr = round(p / (v * pf), 2)
    
    rows.append({
        "timestamp": ts,
        "voltage_V": v,
        "current_A": curr,
        "power_W": p,
        "frequency_Hz": freq,
        "power_factor": pf,
        "appliance_id": app["id"],
        "operating_status": status
    })

fieldnames = ["timestamp", "voltage_V", "current_A", "power_W", "frequency_Hz", "power_factor", "appliance_id", "operating_status"]

# Write to root
with open("energy_readings.csv", "w", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(rows)

# Also write to frontend/public for direct client load
with open("frontend/public/energy_readings.csv", "w", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(rows)

print(f"Generated {len(rows)} records in energy_readings.csv and frontend/public/energy_readings.csv")
