#!/usr/bin/env python3
"""scripts/fuentes/descargar-era5.py

Tiempo PASADO para el diario (2026-10-08, fase 2 de fuentes gratuitas,
aprobado por Mikel). Sin IA y SIN CUENTA: lee el reanálisis ERA5 de la copia
pública ARCO-ERA5 de Google Cloud (Zarr en
https://storage.googleapis.com/gcp-public-data-arco-era5/ar/full_37-1h-0p25deg-chunk-1.zarr-v3),
que no pide registro ni clave.

Licencia (verificada 2026-10-08):
  - ERA5 en el Climate Data Store: licencia "CC-BY" (api del catálogo:
    "license": "CC-BY-4.0"); desde el 2 de julio de 2025 la "Licence to use
    Copernicus Products" del CDS se sustituyó por CC BY 4.0 (foro de ECMWF).
    CC BY 4.0 permite uso comercial con atribución. Cita: DOI
    10.24381/cds.adbb2d47 (Hersbach et al., ERA5 hourly data on single levels).
  - ARCO-ERA5 (github.com/google-research/arco-era5): "Yes, you can use our
    ERA5 data according to the terms of the Copernicus license" y, para uso
    comercial, "provide acknowledgement to the Copernicus Climate Change
    Service according to the Copernicus Licence".
  Crédito que pinta la app (functions/_lib/era5.js): "Contiene información
  modificada del Servicio de Cambio Climático de Copernicus (C3S) <año>" +
  CC BY 4.0 + DOI.

Retraso: ERA5T (la versión preliminar) llega con ~6 días de retraso
(atributo valid_time_stop_era5t del Zarr). Los días más recientes NO tienen
dato: la app los deja en blanco, nunca los inventa.

Qué guarda (bucket público fuentes-gratuitas):
  pasado/<AAAA-MM-DD>/<caja>.json   un día UTC (24 h) de las celdas de 0,25°
                                    de una caja de 1° (caja = floor(lat)_floor(lon))
                                    con costa de España o Portugal
  pasado/indice.json                fechas guardadas y hasta dónde llega ERA5T
Formato de cada día:
  { v: 1, fuente: "era5", fecha, inicio: "<fecha>T00:00:00Z", horas: 24,
    generado_en, atribucion, doi, puntos: [{ lat, lon, ws, wd, p, t, c, pr }] }
  ws viento a 10 m (m/s) · wd de donde viene (°) · p presión a nivel del mar
  (hPa) · t temperatura a 2 m (°C) · c nubosidad total (%) · pr precipitación
  ACUMULADA EN LA HORA QUE TERMINA a esa hora (mm), como el tp de ERA5.

Cada hora de cada variable es un trozo del Zarr con el mundo entero (~2,3 MB
comprimido): un día son 144 trozos, ~330 MB de descarga y 10-30 s en un
runner de GitHub (medido: ~5 s por día en GitHub Actions, ~1 MB por día en el
bucket). Se descargan como mucho --max-dias días por ejecución.

Uso:
  python descargar-era5.py --salida dir [--indice-url URL] [--dias 30] [--max-dias 7]
  python descargar-era5.py --prueba --salida dir     (sintético, sin red)
"""
import argparse
import json
import math
import os
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta, timezone

import numpy as np

ZARR = "https://storage.googleapis.com/gcp-public-data-arco-era5/ar/full_37-1h-0p25deg-chunk-1.zarr-v3"
ORIGEN_TIEMPO = datetime(1900, 1, 1, tzinfo=timezone.utc)   # "hours since 1900-01-01"
VARIABLES = {
    "u": "10m_u_component_of_wind",
    "v": "10m_v_component_of_wind",
    "p": "mean_sea_level_pressure",
    "t": "2m_temperature",
    "pr": "total_precipitation",
    "c": "total_cloud_cover",
}
ATRIBUCION = "Contiene información modificada del Servicio de Cambio Climático de Copernicus (C3S)"
DOI = "10.24381/cds.adbb2d47"
# Cajas (lat_min, lat_max, lon_min, lon_max) en grados -180..180.
ZONAS = [
    (35.0, 44.25, -10.25, 4.75),   # península, Baleares, Ceuta y Melilla
    (27.25, 29.75, -18.5, -13.0),  # Canarias
    (32.25, 33.5, -17.5, -16.0),   # Madeira
]
HILOS = 16


def clave_caja(lat, lon):
    # Igual que claveCajaEra5() de functions/_lib/era5.js
    return f"{math.floor(lat)}_{math.floor(lon)}"


def leer(url, intentos=4):
    for i in range(intentos):
        try:
            with urllib.request.urlopen(url, timeout=60) as r:
                return r.read()
        except Exception as e:
            if i == intentos - 1:
                raise
            print(f"::warning::{url}: {e}; reintento")
            time.sleep(3 * (i + 1))


def decodificar(datos, dtype, forma=None):
    import numcodecs
    a = np.frombuffer(numcodecs.Blosc().decode(datos), dtype=dtype)
    return a.reshape(forma) if forma else a


def indice_hora(dt):
    return int((dt - ORIGEN_TIEMPO).total_seconds() // 3600)


def seleccion(lats, lons):
    """Índices (iy, ix) de las celdas dentro de ZONAS. lons en 0..360."""
    lon180 = np.where(lons > 180, lons - 360, lons)
    sel = []
    for iy, la in enumerate(lats):
        for ix, lo in enumerate(lon180):
            if any(a <= la <= b and c <= lo <= d for a, b, c, d in ZONAS):
                sel.append((iy, ix, float(la), float(lo)))
    return sel


def cajas_costeras(sel, lsm):
    """Cajas de 1° con costa: alguna celda mixta o tierra y mar a la vez."""
    por_caja = {}
    for k, (iy, ix, la, lo) in enumerate(sel):
        por_caja.setdefault(clave_caja(la, lo), []).append(float(lsm[iy, ix]))
    salida = set()
    for clave, valores in por_caja.items():
        v = np.array(valores)
        if ((v > 0.05) & (v < 0.95)).any() or ((v >= 0.5).any() and (v < 0.5).any()):
            salida.add(clave)
    return salida


def dia_real(fecha, sel):
    """{var: array (24, n_celdas)} de un día UTC desde el Zarr público."""
    i0 = indice_hora(datetime(fecha.year, fecha.month, fecha.day, tzinfo=timezone.utc))
    iys = np.array([s[0] for s in sel])
    ixs = np.array([s[1] for s in sel])
    trabajos = [(k, h) for k in VARIABLES for h in range(24)]

    def uno(tr):
        k, h = tr
        a = decodificar(leer(f"{ZARR}/{VARIABLES[k]}/{i0 + h}.0.0"), "<f4", (721, 1440))
        return k, h, a[iys, ixs].copy()

    salida = {k: np.full((24, len(sel)), np.nan, dtype=np.float32) for k in VARIABLES}
    with ThreadPoolExecutor(HILOS) as ex:
        for k, h, vals in ex.map(uno, trabajos):
            salida[k][h] = vals
    return salida


def red(arr, dec):
    return [None if not np.isfinite(x) else (int(round(float(x))) if dec == 0 else round(float(x), dec)) for x in arr]


def puntos_dia(datos, sel, indices):
    """Lista de puntos (formato del fichero) para los índices de `sel`."""
    puntos = []
    for j in indices:
        u, v = datos["u"][:, j].astype(np.float64), datos["v"][:, j].astype(np.float64)
        with np.errstate(invalid="ignore"):
            ws = np.hypot(u, v)
            wd = (np.degrees(np.arctan2(-u, -v)) + 360) % 360   # de donde viene
        puntos.append({
            "lat": sel[j][2], "lon": sel[j][3],
            "ws": red(ws, 1),
            "wd": red(wd, 0),
            "p": red(datos["p"][:, j] / 100.0, 1),
            "t": red(datos["t"][:, j] - 273.15, 1),
            "c": red(np.clip(datos["c"][:, j], 0, 1) * 100.0, 0),
            "pr": red(np.maximum(datos["pr"][:, j], 0) * 1000.0, 2),
        })
    return puntos


def escribir_dia(salida, fecha, datos, sel, cajas, prueba=False):
    fecha_s = fecha.isoformat()
    por_caja = {}
    for j, (_, _, la, lo) in enumerate(sel):
        clave = clave_caja(la, lo)
        if clave in cajas:
            por_caja.setdefault(clave, []).append(j)
    carpeta = os.path.join(salida, "pasado", fecha_s)
    os.makedirs(carpeta, exist_ok=True)
    total = 0
    for clave, indices in por_caja.items():
        j = {
            "v": 1, "fuente": "era5", "fecha": fecha_s, "inicio": f"{fecha_s}T00:00:00Z", "horas": 24,
            "generado_en": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "atribucion": ATRIBUCION, "doi": DOI, "prueba": prueba,
            "puntos": puntos_dia(datos, sel, indices),
        }
        ruta = os.path.join(carpeta, f"{clave}.json")
        with open(ruta, "w", encoding="utf-8") as fh:
            json.dump(j, fh, separators=(",", ":"))
        total += os.path.getsize(ruta)
    return len(por_caja), total


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--salida", required=True)
    ap.add_argument("--indice-url", default="", help="pasado/indice.json público, para no repetir días")
    ap.add_argument("--dias", type=int, default=30, help="ventana hacia atrás desde el último día de ERA5T")
    ap.add_argument("--max-dias", type=int, default=7, help="días como mucho por ejecución")
    ap.add_argument("--prueba", action="store_true")
    a = ap.parse_args()
    t0 = time.time()

    if a.prueba:
        lats = np.arange(90, -90.25, -0.25)
        lons = np.arange(0, 360, 0.25)
        lsm = np.zeros((721, 1440))
        la2, lo2 = np.meshgrid(lats, np.where(lons > 180, lons - 360, lons), indexing="ij")
        lsm[(la2 > 37) & (la2 < 43.25) & (lo2 > -9) & (lo2 < -0.5)] = 1
        hasta = date.today() - timedelta(days=6)
    else:
        attrs = json.loads(leer(f"{ZARR}/.zattrs"))
        hasta = date.fromisoformat(attrs["valid_time_stop_era5t"][:10])
        lats = decodificar(leer(f"{ZARR}/latitude/0"), "<f4")
        lons = decodificar(leer(f"{ZARR}/longitude/0"), "<f4")
        # Máscara tierra/mar (invariable): un trozo cualquiera reciente.
        lsm = decodificar(leer(f"{ZARR}/land_sea_mask/{indice_hora(datetime(hasta.year, hasta.month, hasta.day, tzinfo=timezone.utc))}.0.0"), "<f4", (721, 1440))

    sel = seleccion(lats, lons)
    cajas = cajas_costeras(sel, lsm)

    hechas = set()
    if a.indice_url and not a.prueba:
        try:
            hechas = set(json.loads(leer(a.indice_url, intentos=2)).get("fechas", []))
        except Exception as e:
            print(f"Sin índice previo ({e}): se empieza de cero")
    pendientes = [hasta - timedelta(days=d) for d in range(a.dias)]
    pendientes = [f for f in pendientes if f.isoformat() not in hechas][: (1 if a.prueba else a.max_dias)]

    total_bytes = 0
    for f in sorted(pendientes):
        t = time.time()
        if a.prueba:
            rng = np.random.default_rng(1)
            datos = {k: rng.random((24, len(sel))).astype(np.float32) for k in VARIABLES}
            datos["p"] = datos["p"] * 3000 + 100000
            datos["t"] = datos["t"] * 10 + 283
            datos["pr"] = datos["pr"] / 1000
        else:
            datos = dia_real(f, sel)
        n, b = escribir_dia(a.salida, f, datos, sel, cajas, a.prueba)
        total_bytes += b
        hechas.add(f.isoformat())
        print(f"ERA5 {f}: {n} cajas, {b / 1e3:.0f} kB, {time.time() - t:.0f} s")

    os.makedirs(os.path.join(a.salida, "pasado"), exist_ok=True)
    indice = {
        "v": 1, "fuente": "era5", "generado_en": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "era5t_hasta": hasta.isoformat(), "fechas": sorted(hechas), "cajas": sorted(cajas),
        "atribucion": ATRIBUCION, "doi": DOI,
    }
    with open(os.path.join(a.salida, "pasado", "indice.json"), "w", encoding="utf-8") as fh:
        json.dump(indice, fh, separators=(",", ":"))
    print(f"ERA5: {len(sel)} celdas en zona, {len(cajas)} cajas con costa, {len(pendientes)} días nuevos, "
          f"{total_bytes / 1e6:.1f} MB, {time.time() - t0:.0f} s; ERA5T hasta {hasta}")


if __name__ == "__main__":
    main()
