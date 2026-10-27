# Energy & Emissions Analytics Engine
# Formula: Energy (kWh) = Power (W) * Duration (hours) / 1000
# Cost = Energy (kWh) * Tariff (₹/kWh)
# CO2  = Energy (kWh) * Emission Factor (kg CO2/kWh)

DEFAULT_CO2_FACTOR = 0.380    # kg CO2/kWh
DEFAULT_PRICE_PER_KWH = 8.00  # INR / kWh (Standard commercial/domestic baseline tariff in India)
BASELINE_EFFICIENCY_KWH_STEP = 0.0002

def calculate_step_energy(
    power_w: float,
    duration_seconds: float = 2.0,
    price_per_kwh: float = DEFAULT_PRICE_PER_KWH,
    co2_factor: float = DEFAULT_CO2_FACTOR
) -> dict:
    """
    Computes electrical energy and associated environmental metrics for a discrete simulation interval.
    """
    duration_hours = duration_seconds / 3600.0
    step_kwh = (power_w * duration_hours) / 1000.0
    co2_kg = step_kwh * co2_factor
    cost_inr = step_kwh * price_per_kwh
    
    excess_kwh = max(0.0, step_kwh - BASELINE_EFFICIENCY_KWH_STEP)
    potential_saving_inr = excess_kwh * price_per_kwh
    potential_saving_co2_kg = excess_kwh * co2_factor

    return {
        "step_kwh": round(step_kwh, 8),
        "co2_kg": round(co2_kg, 6),
        "cost_inr": round(cost_inr, 6),
        "cost_eur": round(cost_inr, 6), # backwards-compatibility alias
        "potential_saving_inr": round(potential_saving_inr, 6),
        "potential_saving_eur": round(potential_saving_inr, 6),
        "potential_saving_co2_kg": round(potential_saving_co2_kg, 6),
    }

def calculate(kwh: float, price_per_kwh: float = DEFAULT_PRICE_PER_KWH, co2_factor: float = DEFAULT_CO2_FACTOR) -> dict:
    """Convenience converter for an existing kWh quantity."""
    co2_kg = round(kwh * co2_factor, 6)
    cost_inr = round(kwh * price_per_kwh, 4)
    return {
        "total_kwh": round(kwh, 6),
        "co2_kg": co2_kg,
        "cost_inr": cost_inr,
        "cost_eur": cost_inr,
        "potential_saving_inr": round(max(0.0, kwh * 0.15) * price_per_kwh, 4),
        "potential_saving_eur": round(max(0.0, kwh * 0.15) * price_per_kwh, 4),
        "potential_saving_co2_kg": round(max(0.0, kwh * 0.15) * co2_factor, 6),
    }