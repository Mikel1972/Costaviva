"""test/capas_nz_test.py — capas del mar de Nueva Zelanda (fase 2 de NZ,
2026-10-09) en scripts/fuentes/descargar-capas.py. Sin red.

Comprueba que --region nz cambia caja, datasets y umbrales (Copernicus
GLOBAL, 1/12°), que escribe en capas/nz/, que la convergencia no cambia de
signo en el hemisferio sur y que España sigue exactamente igual.
Lo corre tests.yml (`python -I test/capas_nz_test.py`).
"""
import contextlib
import importlib.util
import io
import json
import os
import sys
import tempfile
import unittest

import numpy as np

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RUTA = os.path.join(RAIZ, "scripts", "fuentes", "descargar-capas.py")


def cargar():
    spec = importlib.util.spec_from_file_location("dc_nz", RUTA)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def leer(ruta):
    with open(ruta, encoding="utf-8") as fh:
        return json.load(fh)


def ejecutar(dc, *args):
    viejo = sys.argv
    sys.argv = ["descargar-capas.py", *args]
    try:
        with contextlib.redirect_stdout(io.StringIO()):
            dc.main()
    finally:
        sys.argv = viejo


class RegionNZ(unittest.TestCase):
    def test_config_de_nz(self):
        dc = cargar()
        es = {"caja": dict(dc.CAJA), "chl": dc.CAPAS["clorofila"]["dataset"], "frentes": dict(dc.FRENTES)}
        dc.usar_region("nz")
        self.assertEqual(dc.CAJA, {"norte": -28.0, "sur": -54.0, "oeste": 162.0, "este": 186.0})
        # El doble de superficie que la caja anterior (14° x 14°), cruzando el
        # antimeridiano con oeste < este (longitudes 162..186, no -174).
        self.assertLess(dc.CAJA["oeste"], dc.CAJA["este"])
        lado = lambda c: (c["norte"] - c["sur"]) * (c["este"] - c["oeste"])
        self.assertGreaterEqual(lado(dc.CAJA) / (14 * 14), 2)
        self.assertEqual(dc.CAPAS["clorofila"]["dataset"], "cmems_obs-oc_glo_bgc-plankton_nrt_l4-gapfree-multi-4km_P1D")
        self.assertEqual(dc.CAPAS["temperatura-agua"]["dataset"], "cmems_mod_glo_phy_anfc_0.083deg_PT1H-m")
        self.assertEqual(dc.CORRIENTE["dataset"], "cmems_mod_glo_phy-cur_anfc_0.083deg_P1D-m")
        self.assertEqual(dc.CORRIENTE["variables"], ["uo", "vo"])
        self.assertAlmostEqual(dc.FRENTES["paso"], 1 / 12)
        # Umbrales de gradiente: 2/3 de los de España (celdas 1/12° frente a 1/18°).
        for k in ("umbral_chl_log10_km", "umbral_temp_c_km", "umbral_convergencia_f"):
            self.assertAlmostEqual(dc.FRENTES[k] / es["frentes"][k], 2 / 3, delta=0.02, msg=k)
        self.assertEqual(dc.REGION_ACTUAL["hora_utc_temperatura"], 0)
        # Y de vuelta a España, todo como estaba.
        dc.usar_region("es")
        self.assertEqual(dc.CAJA, es["caja"])
        self.assertEqual(dc.CAPAS["clorofila"]["dataset"], es["chl"])
        self.assertEqual(dc.FRENTES, es["frentes"])
        self.assertEqual(dc.CORRIENTE["variables"], ["uo_detided", "vo_detided"])

    def test_convergencia_mismo_signo_en_el_sur(self):
        dc = cargar()
        n = 9
        x = np.arange(n) - n // 2
        # Flujo que converge hacia el centro (u = -x, v = +y con fila 0 = norte).
        u = np.tile(-x * 0.05, (n, 1)).astype(float)
        v = np.tile((x * 0.05)[:, None], (1, n)).astype(float)
        norte = dc.convergencia_f(u, v, 40.0 - np.arange(n) * 0.1, 1 / 12)
        sur = dc.convergencia_f(u, v, -40.0 - np.arange(n) * 0.1, 1 / 12)
        self.assertGreater(norte[4, 4], 0)
        self.assertGreater(sur[4, 4], 0)

    def test_prueba_nz_escribe_capas_nz(self):
        dc = cargar()
        with tempfile.TemporaryDirectory() as d:
            ejecutar(dc, "--prueba", "--region", "nz", "--salida", d)
            base = os.path.join(d, "capas", "nz")
            self.assertEqual(sorted(os.listdir(base)), ["clorofila.json", "frentes.json", "historico", "temperatura-agua.json"])
            self.assertFalse(os.path.exists(os.path.join(d, "capas", "frentes.json")), "no pisa las capas de España")
            for nombre in ("clorofila", "temperatura-agua", "frentes"):
                j = leer(os.path.join(base, f"{nombre}.json"))
                self.assertEqual(j["region"], "nz")
                self.assertEqual((j["norte"], j["sur"], j["oeste"], j["este"]), (-28.0, -54.0, 162.0, 186.0))
                self.assertTrue(j["prueba"])
            fr = leer(os.path.join(base, "frentes.json"))
            self.assertIn("cmems_mod_glo_phy-cur_anfc_0.083deg_P1D-m", fr["datasets"])
            self.assertEqual(fr["umbrales"]["umbral_temp_c_km"], 0.053)
            for k in ("pct_frente_clorofila", "pct_frente_termico"):
                self.assertLess(fr["estadisticas"][k], 25)
            t = leer(os.path.join(base, "temperatura-agua.json"))
            self.assertEqual(t["doi"], "10.48670/moi-00016")
            self.assertEqual((t["filas"], t["columnas"]), (312, 288))

    def test_malla_glo_en_los_bordes_sin_huecos(self):
        """Caso real (2026-10-11, primera pasada de NZ): los puntos de GLO caen
        en los bordes de las celdas de 1/12° (coordenadas float32) y una de
        cada tres filas salía vacía: 57 % de temperatura con dato, 35 % de
        "franja costera" y 0,0 % de frentes de todo tipo."""
        dc = cargar()
        dc.usar_region("nz")
        # La caja cruza el antimeridiano (162-186 E): las longitudes pueden
        # llegar ya desplazadas por el toolbox (162..186) o tal cual vienen en
        # GLO (-180..179,92); las dos tienen que dar la rejilla entera.
        for dt, desplazadas in ((np.float32, True), (np.float64, True), (np.float32, False)):
            lats = (np.arange(-80 * 12, 90 * 12 + 1) / 12).astype(dt)
            lons = (np.arange(-180 * 12, 180 * 12) / 12).astype(dt)
            lats = lats[(lats >= -54.1) & (lats <= -27.9)]
            lons = lons[(lons >= 161.9) | (lons <= -173.9)]
            if desplazadas:
                lons = np.sort(np.where(lons < 0, lons + 360, lons)).astype(dt)
            la2, lo2 = np.meshgrid(lats.astype(float), np.where(lons < 0, lons + 360.0, lons).astype(float), indexing="ij")
            # Mar entero con un frente térmico a 42 S y una corriente que converge.
            t = 14 + 2 * np.tanh((la2 + 42) / 0.15)
            m = dc.rejilla(lats, lons, t, 1 / 12)
            self.assertEqual(int(np.isnan(m).sum()), 0, dt.__name__)
            u = dc.rejilla(lats, lons, -0.3 * np.tanh((lo2 - 172) / 0.3), 1 / 12)
            v = dc.rejilla(lats, lons, np.zeros_like(t), 1 / 12)
            chl = dc.rejilla(lats, lons, 10 ** (0.6 * np.tanh((lo2 - 170) / 0.1)), 1 / 12, log=True)
            filas = m.shape[0]
            lat_c = dc.CAJA["norte"] - (np.arange(filas) + 0.5) / 12
            _, est = dc.calcular_frentes(chl, None, m, u, v, lat_c)
            self.assertEqual(est["pct_costa"], 0.0, dt.__name__)
            self.assertGreater(est["pct_frente_termico"], 0, dt.__name__)
            self.assertGreater(est["pct_frente_clorofila"], 0, dt.__name__)
            self.assertGreater(est["pct_convergencia"], 0, dt.__name__)

    def test_espana_sin_cambios(self):
        dc = cargar()
        with tempfile.TemporaryDirectory() as d:
            ejecutar(dc, "--prueba", "--salida", d)
            j = leer(os.path.join(d, "capas", "frentes.json"))
            self.assertNotIn("region", j)
            self.assertEqual((j["norte"], j["sur"], j["oeste"], j["este"]), (46.0, 26.0, -19.0, 5.0))
            self.assertFalse(os.path.exists(os.path.join(d, "capas", "nz")))

    def test_historico_nz_aun_no(self):
        dc = cargar()
        with contextlib.redirect_stdout(io.StringIO()), self.assertRaises(SystemExit):
            viejo = sys.argv
            sys.argv = ["x", "--prueba", "--region", "nz", "--salida", "/tmp/no", "--desde", "2026-10-01", "--hasta", "2026-10-02"]
            try:
                dc.main()
            finally:
                sys.argv = viejo


if __name__ == "__main__":
    unittest.main()
