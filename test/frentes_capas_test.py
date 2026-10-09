"""test/frentes_capas_test.py — cálculo de 〰 Frentes en Python
(scripts/fuentes/descargar-capas.py). Sin red: mallas sintéticas pequeñas.

Lo corre tests.yml (`python -I -m unittest test/frentes_capas_test.py`).
Caso real que lo motivó (2026-10-09, Mikel desde el iPhone: "no me aparece
el combinado de clorofila"): con un solo día de satélite el golfo de Bizkaia
salía entero bajo nubes (nada verde ni morado) y el umbral térmico de 0,05
°C/km pintaba de naranja los bordes suaves del modelo en líneas de una celda.
"""
import importlib.util
import os
import unittest

import numpy as np

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_spec = importlib.util.spec_from_file_location("dc", os.path.join(RAIZ, "scripts", "fuentes", "descargar-capas.py"))
dc = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(dc)

F, C = 30, 30
P = dc.FRENTES["paso"]
LATS = 44.0 - (np.arange(F) + 0.5) * P   # golfo de Bizkaia
KM = P * 110.57                          # km de una celda (N-S)


def mar(valor=0.0):
    return np.full((F, C), valor, dtype=np.float64)


def campos_base():
    """Mar entero, temperatura y corriente sin gradiente."""
    return mar(18.0), mar(0.1), mar(0.0)


def clorofila_con_borde():
    """Clorofila que se multiplica por 4 al cruzar la columna 15 (frente)."""
    chl = mar(0.3)
    chl[:, 15:] = 1.2
    return chl


def contar(cod, bit):
    return int(((cod != 255) & ((cod & bit) > 0)).sum())


class Compuesto(unittest.TestCase):
    def test_nubes_hoy_usa_el_dia_anterior(self):
        temp, u, v = campos_base()
        chl = clorofila_con_borde()
        nube = mar(0.0)  # hoy: nada observado
        cod, est = dc.calcular_frentes(chl, nube, temp, u, v, LATS)
        self.assertEqual(contar(cod, dc.BIT["frente_clorofila"]), 0)
        self.assertGreater(est["pct_nubes"], 90)
        cod2, est2 = dc.calcular_frentes(chl, nube, temp, u, v, LATS, previos=[(chl, mar(1.0))])
        self.assertGreater(contar(cod2, dc.BIT["frente_clorofila"]), 0, "el frente visto ayer tiene que salir")
        self.assertLess(est2["pct_nubes"], 1)
        self.assertEqual(est2["dias_clorofila"], 2)
        self.assertGreater(est2["pct_clorofila_dias_previos"], 90)

    def test_la_costura_entre_dias_no_inventa_frente(self):
        temp, u, v = campos_base()
        hoy, ayer = mar(0.3), mar(1.2)        # niveles distintos cada día
        obs_hoy = mar(0.0)
        obs_hoy[:, :15] = 1.0                 # hoy se ve la mitad oeste
        cod, est = dc.calcular_frentes(hoy, obs_hoy, temp, u, v, LATS, previos=[(ayer, mar(1.0))])
        self.assertEqual(contar(cod, dc.BIT["frente_clorofila"]), 0)
        self.assertEqual(est["pct_nubes"], 0)

    def test_hoy_manda_sobre_ayer(self):
        temp, u, v = campos_base()
        sin_borde = mar(0.3)
        cod, est = dc.calcular_frentes(sin_borde, mar(1.0), temp, u, v, LATS, previos=[(clorofila_con_borde(), mar(1.0))])
        self.assertEqual(contar(cod, dc.BIT["frente_clorofila"]), 0)
        self.assertEqual(est["dias_clorofila"], 1)

    def test_doble_cuando_coinciden(self):
        temp, u, v = campos_base()
        temp[:, 15:] += 1.5  # salto térmico en el mismo sitio que el de clorofila
        chl = clorofila_con_borde()
        cod, est = dc.calcular_frentes(chl, mar(0.0), temp, u, v, LATS, previos=[(chl, mar(1.0))])
        self.assertGreater(est["pct_ambos"], 0)


class Termico(unittest.TestCase):
    def rampa(self, grados_km):
        temp, u, v = campos_base()
        temp = temp + grados_km * KM * np.arange(F)[:, None]
        cod, _ = dc.calcular_frentes(mar(0.3), mar(1.0), temp, u, v, LATS)
        return contar(cod, dc.BIT["frente_termico"])

    def test_umbral(self):
        self.assertEqual(dc.FRENTES["umbral_temp_c_km"], 0.08)
        self.assertEqual(self.rampa(0.06), 0, "un borde suave (0,6 °C en 10 km) no es frente")
        self.assertGreater(self.rampa(0.1), 0)

    def test_frente_de_menos_de_3_celdas_fuera(self):
        m = np.zeros((F, C), dtype=bool)
        m[5, 5] = True             # suelta
        m[8, 8] = m[9, 9] = True   # dos en diagonal
        m[20, 20:24] = True        # cuatro seguidas
        q = dc.quitar_pequenos(m, dc.FRENTES["min_celdas_frente"])
        self.assertFalse(q[5, 5] or q[8, 8] or q[9, 9])
        self.assertTrue(q[20, 20:24].all())
        self.assertEqual(int(q.sum()), 4)

    def test_tierra_no_da_frente(self):
        temp, u, v = campos_base()
        temp[:, 20:] = np.nan
        u[:, 20:] = np.nan
        v[:, 20:] = np.nan
        chl = mar(0.3)
        chl[:, 20:] = np.nan
        cod, _ = dc.calcular_frentes(chl, mar(1.0), temp, u, v, LATS)
        self.assertEqual(contar(cod, dc.BIT["frente_termico"]), 0)
        self.assertTrue((cod[:, 20:] == 255).all())


class Salida(unittest.TestCase):
    def test_fechas_del_compuesto_en_el_json(self):
        temp, u, v = campos_base()
        chl = clorofila_con_borde()
        cod, est = dc.calcular_frentes(chl, mar(0.0), temp, u, v, LATS, previos=[(chl, mar(1.0))])
        j = dc.salida_frentes({"clorofila": "2026-10-07", "clorofila_desde": "2026-10-06", "temperatura": "2026-10-09", "corriente": "2026-10-09"}, cod, u, v, est, False)
        self.assertEqual(j["fecha_clorofila_desde"], "2026-10-06")
        self.assertEqual(j["umbrales"]["dias_clorofila"], 5)
        self.assertEqual(dc.historico_frentes(j, u, v)["fecha_clorofila_desde"], "2026-10-06")


if __name__ == "__main__":
    unittest.main()
