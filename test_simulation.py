import unittest
import sys
import os

# Add backend directory to sys.path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))

from database import init_db, get_settings, get_appliances
from simulation_engine import SimulationEngine
from co2_calculator import calculate_step_energy

class TestEnergySimulation(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_db()
        cls.engine = SimulationEngine()

    def test_voltage_boundary_conditions(self):
        """
        Verify required voltage boundary tests:
        199.9 V = LOW VOLTAGE
        200 V = NORMAL
        220 V = NORMAL
        240 V = NORMAL
        240.1 V = HIGH VOLTAGE
        """
        c_199_9 = self.engine.classify_voltage(199.9, lower_limit=200.0, upper_limit=240.0)
        self.assertEqual(c_199_9["status"], "LOW VOLTAGE", f"Expected LOW VOLTAGE at 199.9V, got {c_199_9['status']}")

        c_200 = self.engine.classify_voltage(200.0, lower_limit=200.0, upper_limit=240.0)
        self.assertEqual(c_200["status"], "NORMAL", f"Expected NORMAL at 200V, got {c_200['status']}")

        c_220 = self.engine.classify_voltage(220.0, lower_limit=200.0, upper_limit=240.0)
        self.assertEqual(c_220["status"], "NORMAL", f"Expected NORMAL at 220V, got {c_220['status']}")

        c_240 = self.engine.classify_voltage(240.0, lower_limit=200.0, upper_limit=240.0)
        self.assertEqual(c_240["status"], "NORMAL", f"Expected NORMAL at 240V, got {c_240['status']}")

        c_240_1 = self.engine.classify_voltage(240.1, lower_limit=200.0, upper_limit=240.0)
        self.assertEqual(c_240_1["status"], "HIGH VOLTAGE", f"Expected HIGH VOLTAGE at 240.1V, got {c_240_1['status']}")

    def test_sample_dataset_loading(self):
        """Verify sample dataset is loaded properly."""
        self.engine.load_sample_dataset()
        self.assertGreater(len(self.engine.dataset_rows), 0, "Dataset should have loaded rows.")

    def test_high_low_voltage_injection(self):
        """Test deterministic injection of high and low voltage."""
        # High voltage injection (248V)
        reading_hv = self.engine.inject("HIGH_VOLTAGE", 248.0)
        self.assertEqual(reading_hv["voltage_V"], 248.0)
        self.assertEqual(reading_hv["voltage_classification"], "HIGH VOLTAGE")
        self.assertGreater(reading_hv["deviation_v"], 0)

        # Low voltage injection (185V)
        reading_lv = self.engine.inject("LOW_VOLTAGE", 185.0)
        self.assertEqual(reading_lv["voltage_V"], 185.0)
        self.assertEqual(reading_lv["voltage_classification"], "LOW VOLTAGE")
        self.assertLess(reading_lv["deviation_v"], 0)

        # Normal injection (220V)
        reading_norm = self.engine.inject("NORMAL")
        self.assertEqual(reading_norm["voltage_classification"], "NORMAL")

    def test_ai_anomaly_detection_multidimensional(self):
        """Verify ML anomaly models detect non-voltage anomalies (e.g. low PF / surge at normal 220V)."""
        # Isolation Forest prediction on abnormal feature at 220V
        pred = self.engine.iso_detector.predict(
            voltage=220.0,
            current=25.0, # Massive current surge
            power=5500.0,
            frequency=48.2, # Unstable frequency
            power_factor=0.45 # Severe reactive power drop
        )
        self.assertTrue(pred["iso_ready"])
        self.assertTrue(pred["iso_anomaly"], "Expected Isolation Forest to flag severe multidimensional spike.")

    def test_appliance_risk_analysis(self):
        """Test appliance risk categories based on voltage."""
        # At 250V (High Voltage)
        apps_hv = self.engine.evaluate_appliances_risk(250.0)
        # Appliances with v_max=240 should be WARNING or HIGH RISK
        flagged = [a for a in apps_hv if a["risk_category"] in ("HIGH RISK", "WARNING")]
        self.assertGreater(len(flagged), 0, "Should have flagged appliances at 250V.")

        # At 180V (Low Voltage)
        apps_lv = self.engine.evaluate_appliances_risk(180.0)
        flagged_lv = [a for a in apps_lv if a["risk_category"] in ("HIGH RISK", "WARNING")]
        self.assertGreater(len(flagged_lv), 0, "Should have flagged appliances at 180V.")

    def test_simulated_appliance_controls(self):
        """Test Simulated ON and Simulated OFF controls and load recalculation."""
        # Toggle Refrigerator OFF
        res_off = self.engine.toggle_appliance("APP-01", "OFF")
        self.assertEqual(res_off["appliance"]["operating_status"], "OFF")

        # Appliance should now evaluate as PROTECTED
        apps = self.engine.evaluate_appliances_risk(250.0)
        ref_app = next(a for a in apps if a["id"] == "APP-01")
        self.assertEqual(ref_app["risk_category"], "PROTECTED")

        # Toggle back to ON
        res_on = self.engine.toggle_appliance("APP-01", "ON")
        self.assertEqual(res_on["appliance"]["operating_status"], "ON")

    def test_energy_calculation_equation(self):
        """Verify: Energy (kWh) = Power (W) * Duration (hours) / 1000."""
        # 1000 W for 2 seconds = 1000 * (2 / 3600) / 1000 = 2 / 3600 = 0.0005555... kWh
        e = calculate_step_energy(power_w=1000.0, duration_seconds=2.0, price_per_kwh=0.32, co2_factor=0.380)
        expected_kwh = (1000.0 * (2.0 / 3600.0)) / 1000.0
        self.assertAlmostEqual(e["step_kwh"], expected_kwh, places=6)
        self.assertAlmostEqual(e["cost_eur"], expected_kwh * 0.32, places=6)
        self.assertAlmostEqual(e["co2_kg"], expected_kwh * 0.380, places=6)

if __name__ == "__main__":
    unittest.main()
