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
from datetime import datetime, timedelta

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


class _Campo:
    """Mínimo de un DataArray de xarray para elegir_clorofila (sin xarray)."""
    dims = ()

    def __init__(self, por_dia, lats, lons):
        self.por_dia, self.lats, self.lons = por_dia, lats, lons
        self.values = None

    def sel(self, time):
        c = _Campo(self.por_dia, self.lats, self.lons)
        c.values = self.por_dia[str(np.datetime_as_string(time, unit="D"))]
        return c

    def load(self):
        return self

    def __getitem__(self, k):
        return type("V", (), {"values": self.lats if k == "latitude" else self.lons})


class _DS(dict):
    pass


def _ds(dias, vacios=()):
    """Clorofila sintética de varios días (vacío = casi todo NaN) con flags."""
    lats, lons = LATS, np.arange(C) * P
    chl, fl = {}, {}
    for k, d in enumerate(dias):
        v = mar(0.3 + 0.1 * k)
        if d in vacios:
            v[:] = np.nan
        chl[d], fl[d] = v, np.zeros((F, C))
    ds = _DS(CHL=_Campo(chl, lats, lons), flags=_Campo(fl, lats, lons))
    ds["time"] = type("T", (), {"values": np.array([np.datetime64(f"{d}T00:00:00") for d in dias])})
    return ds


class Historico(unittest.TestCase):
    """El histórico hacia atrás (--desde/--hasta) elige los días de
    clorofila igual que la pasada diaria de ese día: el día D (o el último con
    datos hasta 5 días antes) y los previos del compuesto, nunca días
    posteriores a D."""

    DIAS = ["2026-03-%02d" % d for d in range(1, 16)]

    def diaria(self, ds, d):
        # La pasada diaria del día D solo veía hasta D.
        t = ds["time"].values
        return dc.elegir_clorofila(ds, t[t <= np.datetime64(f"{d}T00:00:00")][::-1], True)

    def historico(self, ds, d):
        b = dc.BloqueReal.__new__(dc.BloqueReal)
        b.abiertos, b.sin = {("clorofila", d): (ds, True, {"dataset": "falso"})}, {}
        return b.clorofila(d)

    def test_igual_que_la_pasada_diaria(self):
        ds = _ds(self.DIAS, vacios={"2026-03-10"})
        for d in ("2026-03-08", "2026-03-10", "2026-03-12"):
            h, q = self.historico(ds, d), self.diaria(ds, d)
            self.assertEqual(h[0], q[0], d)
            self.assertEqual([p[0] for p in h[5]], [p[0] for p in q[5]], d)
        h = self.historico(ds, "2026-03-12")
        self.assertEqual(h[0], "2026-03-12")
        self.assertEqual([p[0] for p in h[5]], ["2026-03-11", "2026-03-09", "2026-03-08"])
        # Día vacío: el último con datos, y nunca uno posterior.
        h = self.historico(ds, "2026-03-10")
        self.assertEqual(h[0], "2026-03-09")
        self.assertTrue(all(p[0] < "2026-03-10" for p in h[5]))
        self.assertEqual(len(h[5]) + 1, dc.FRENTES["dias_clorofila"])

    def test_construir_frentes_es_el_calculo_de_la_pasada_diaria(self):
        hoy = dc.prueba_dia("clorofila", "2026-03-05", 4)
        j, h, est = dc.construir_frentes(hoy, dc.prueba_dia("temperatura-agua", "2026-03-05", 4),
                                         dc.prueba_dia("corrientes", "2026-03-05", 4), True)
        self.assertEqual(j["fecha_clorofila"], "2026-03-05")
        self.assertEqual(j["fecha_clorofila_desde"], "2026-03-04" if est["dias_clorofila"] > 1 else "2026-03-05")
        self.assertEqual(h["fecha_clorofila_desde"], j["fecha_clorofila_desde"])
        self.assertEqual(j["umbrales"]["umbral_temp_c_km"], dc.FRENTES["umbral_temp_c_km"])
        self.assertIn("min_celdas_frente", j["umbrales"])


# ---------------------------------------------------------------------------
# Histórico: elección de dataset por cobertura real (2026-10-09, primer
# lanzamiento: el NRT de clorofila solo guardaba ~10 días y la pasada abortó
# con CoordinatesOutOfDatasetBounds). Sin red: coberturas y datasets falsos.
# ---------------------------------------------------------------------------
NRT_CHL = dc.HISTORICO_DATASETS["clorofila"][0]["dataset"]
MY_CHL = dc.HISTORICO_DATASETS["clorofila"][1]["dataset"]
ANFC_T = dc.HISTORICO_DATASETS["temperatura"][0]["dataset"]
MY_T = dc.HISTORICO_DATASETS["temperatura"][1]["dataset"]
ANFC_C = dc.HISTORICO_DATASETS["corriente"][0]["dataset"]
MY_C = dc.HISTORICO_DATASETS["corriente"][1]["dataset"]
# Las coberturas reales del 2026-10-09 (copernicusmarine describe).
COB = {NRT_CHL: ("2026-09-29", "2026-10-08"), MY_CHL: ("1997-10-01", "2026-10-01"),
       ANFC_T: ("2024-10-18", "2026-10-18"), MY_T: ("1993-01-01", "2026-06-16"),
       ANFC_C: ("2024-10-15", "2026-10-17"), MY_C: ("1993-01-01", "2026-06-15")}


def cobertura(dsid):
    return COB.get(dsid)


class EleccionDataset(unittest.TestCase):
    def test_archivo_para_el_pasado_y_nrt_si_cubre(self):
        e = lambda v, d: (dc.elegir_dataset(v, d, cobertura) or {}).get("dataset")  # noqa: E731
        self.assertEqual(e("clorofila", "2026-01-01"), MY_CHL)
        self.assertEqual(e("clorofila", "2026-10-01"), MY_CHL, "el NRT no tiene los días previos del compuesto")
        self.assertEqual(e("clorofila", "2026-10-08"), NRT_CHL, "solo el NRT cubre el día")
        self.assertEqual(e("temperatura", "2026-01-01"), ANFC_T, "el análisis de IBI guarda desde 2024-10-18")
        self.assertEqual(e("temperatura", "2024-01-01"), MY_T)
        self.assertEqual(e("corriente", "2024-01-01"), MY_C)
        self.assertIsNone(e("clorofila", "1990-01-01"))
        self.assertIsNone(e("clorofila", "2026-10-09"), "más allá de todo: ninguno")
        self.assertIsNone(dc.elegir_dataset("clorofila", "2026-01-01", lambda d: None), "cobertura desconocida: no se usa")


def _falso(dias, horas=False, vars_=("CHL", "flags"), n=12):
    """Dataset falso de pocos puntos (fila 0 = sur, como Copernicus)."""
    lats = np.linspace(43.0, 45.0, n)
    lons = np.linspace(-6.0, -2.0, n)
    campos = {}
    for v in vars_:
        por = {}
        for k, d in enumerate(dias):
            if v == "flags":
                por[d] = np.zeros((n, n))
            elif v == "CHL":
                x = np.full((n, n), 0.3 + 0.01 * k)
                x[:, n // 2:] = 1.5
                por[d] = x
            elif v == "thetao":
                por[d] = np.tile(np.linspace(14, 18, n)[:, None], (1, n))
            else:
                por[d] = np.full((n, n), 0.1)
        campos[v] = _Campo(por, lats, lons)
    ds = _DS(**campos)
    ds["time"] = type("T", (), {"values": np.array([np.datetime64(f"{d}T{'12' if horas else '00'}:00:00") for d in dias])})
    return ds


class HistoricoSinAbortar(unittest.TestCase):
    """La pasada mira la cobertura antes de pedir, nunca pide fuera de ella y
    salta con aviso lo que ningún dataset cubre; lo demás se escribe."""

    def setUp(self):
        self.pedidos = []
        self.orig = dc.abrir, dc.cobertura_real

        def abrir(dsid, variable, ini, fin):
            self.pedidos.append((dsid, ini[:10], fin[:10]))
            c0, c1 = COB[dsid]
            if ini[:10] < c0 or fin[:10] > c1:
                raise RuntimeError(f"CoordinatesOutOfDatasetBounds {dsid} {ini} {fin}")
            d0 = datetime.strptime(ini[:10], "%Y-%m-%d")
            n = (datetime.strptime(fin[:10], "%Y-%m-%d") - d0).days + 1
            dias = [(d0 + timedelta(days=k)).strftime("%Y-%m-%d") for k in range(n)]
            vs = variable if isinstance(variable, list) else [variable]
            return _falso(dias, horas=(vs == ["thetao"]), vars_=vs)

        dc.abrir = abrir
        dc.cobertura_real = cobertura

    def tearDown(self):
        dc.abrir, dc.cobertura_real = self.orig

    def test_bloque_respeta_cobertura(self):
        b = dc.BloqueReal(["2026-09-30", "2026-10-01", "2026-10-08", "2026-10-09"], cobertura)
        for dsid, ini, fin in self.pedidos:
            self.assertTrue(COB[dsid][0] <= ini and fin <= COB[dsid][1], (dsid, ini, fin))
        self.assertEqual(b.datasets("2026-10-01")["clorofila"], MY_CHL)
        self.assertEqual(b.datasets("2026-10-08")["clorofila"], NRT_CHL)
        self.assertEqual(b.sin.get("2026-10-09"), ["clorofila"])
        r = b.clorofila("2026-10-01")
        self.assertEqual(r[0], "2026-10-01")
        self.assertTrue(all(p[0] < "2026-10-01" for p in r[5]))
        self.assertIsNone(b.clorofila("2026-10-09"))

    def test_la_pasada_salta_lo_que_no_cubre_y_escribe_lo_demas(self):
        import contextlib
        import io
        import json
        import tempfile
        with tempfile.TemporaryDirectory() as tmp:
            a = type("A", (), dict(desde="2026-10-07", hasta="2026-10-10", salida=tmp, prueba=False, bloque=10,
                                   max_dias=150, max_minutos=60, existentes_url=None))
            out = io.StringIO()
            with contextlib.redirect_stdout(out):
                dc.historico(a)
            log = out.getvalue()
            hechos = sorted(os.listdir(os.path.join(tmp, "capas", "historico")))
            self.assertEqual(hechos, ["frentes-2026-10-07.json", "frentes-2026-10-08.json"])
            self.assertIn("ningún dataset cubre clorofila", log)
            with open(os.path.join(tmp, "capas", "historico", "frentes-2026-10-07.json")) as fh:
                h = json.load(fh)
            self.assertEqual(h["datasets_historico"]["clorofila"], NRT_CHL)
            self.assertEqual(h["fecha"], "2026-10-07")

    def test_un_bloque_que_falla_no_tumba_la_pasada(self):
        import contextlib
        import io
        import tempfile

        def roto(*_a, **_k):
            raise RuntimeError("servidor caído")

        with tempfile.TemporaryDirectory() as tmp:
            dc.abrir = roto
            a = type("A", (), dict(desde="2026-10-07", hasta="2026-10-08", salida=tmp, prueba=False, bloque=1,
                                   max_dias=150, max_minutos=60, existentes_url=None))
            with contextlib.redirect_stdout(io.StringIO()):
                with self.assertRaises(SystemExit):  # nada escrito: en rojo, pero tras recorrer todo
                    dc.historico(a)


if __name__ == "__main__":
    unittest.main()
