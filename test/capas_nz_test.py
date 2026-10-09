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
        self.assertEqual(dc.CAJA, {"norte": -34.0, "sur": -48.0, "oeste": 165.0, "este": 179.0})
        # Sin cruzar el antimeridiano.
        self.assertLess(dc.CAJA["oeste"], dc.CAJA["este"])
        self.assertLessEqual(dc.CAJA["este"], 180)
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
                self.assertEqual((j["norte"], j["sur"], j["oeste"], j["este"]), (-34.0, -48.0, 165.0, 179.0))
                self.assertTrue(j["prueba"])
            fr = leer(os.path.join(base, "frentes.json"))
            self.assertIn("cmems_mod_glo_phy-cur_anfc_0.083deg_P1D-m", fr["datasets"])
            self.assertEqual(fr["umbrales"]["umbral_temp_c_km"], 0.053)
            for k in ("pct_frente_clorofila", "pct_frente_termico"):
                self.assertLess(fr["estadisticas"][k], 25)
            t = leer(os.path.join(base, "temperatura-agua.json"))
            self.assertEqual(t["doi"], "10.48670/moi-00016")
            self.assertEqual((t["filas"], t["columnas"]), (168, 168))

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
