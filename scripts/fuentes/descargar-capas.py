#!/usr/bin/env python3
"""scripts/fuentes/descargar-capas.py

Capas del mapa de clorofila y temperatura del agua (2026-10-08, fase 2 de
fuentes gratuitas, aprobado por Mikel). Sin IA. Deja dos JSON pequeños en
Supabase Storage (bucket público fuentes-gratuitas) que index.html pinta como
capas activables (🌿 Clorofila, 🌡 Temperatura del agua):

  capas/clorofila.json         clorofila-a de satélite (último día disponible)
  capas/temperatura-agua.json  temperatura de superficie del modelo IBI (hoy, 12 UTC)

Productos (IDs comprobados con `copernicusmarine describe`, 2026-10-08):
  OCEANCOLOUR_ATL_BGC_L4_NRT_009_116 (DOI 10.48670/moi-00288)
    "Atlantic Ocean Colour (Copernicus-GlobColour), Bio-Geo-Chemical, L4
    (daily interpolated) from Satellite Observations (Near Real Time)"
    dataset cmems_obs-oc_atl_bgc-plankton_nrt_l4-gapfree-multi-1km_P1D,
    variable CHL (mg m-3), 1 km, 20-66 N, 46 W-13 E. Es OBSERVACIÓN de
    satélite; "gapfree" = los huecos por nubes están interpolados por el
    productor (se dice en la leyenda).
  IBI_ANALYSISFORECAST_PHY_005_001 (DOI 10.48670/moi-00027)
    dataset cmems_mod_ibi_phy_anfc_0.027deg-2D_PT1H-m, variable thetao (°C).
  Licencia de Copernicus Marine (la misma de la fase 1, cláusula 2.2: uso
  comercial permitido; 2.4: crédito "Generated using E.U. Copernicus Marine
  Service Information" + DOI, visible).

Formato (compacto, sin PNG: el bucket solo admite JSON):
  { v: 1, capa, variable, unidad, fecha, generado_en, atribucion, doi,
    dataset, norte, sur, oeste, este, paso, filas, columnas,
    escala: { tipo: "log10", min, max } | { tipo: "lineal", min, paso },
    datos: base64 de filas*columnas bytes, fila 0 = la del norte;
           255 = sin dato (tierra o sin observación) }
  Valor de un byte b (0-254):
    log10:  10 ** (min + b * (max - min) / 254)
    lineal: min + b * paso
  Cada celda de salida es la media de las celdas nativas que caen dentro
  (para la clorofila, media de log10, que es como se promedia).

Uso:
  python descargar-capas.py --salida dir
  python descargar-capas.py --prueba --salida dir   (sintético, sin red)
"""
import argparse
import base64
import json
import os
import time
from datetime import datetime, timedelta, timezone

import numpy as np

CAJA = {"norte": 46.0, "sur": 26.0, "oeste": -19.0, "este": 5.0}
ATRIBUCION = "Generated using E.U. Copernicus Marine Service Information"

CAPAS = {
    "clorofila": {
        "producto": "OCEANCOLOUR_ATL_BGC_L4_NRT_009_116",
        "dataset": "cmems_obs-oc_atl_bgc-plankton_nrt_l4-gapfree-multi-1km_P1D",
        "variable": "CHL",
        "doi": "10.48670/moi-00288",
        "unidad": "mg/m³",
        "paso": 1 / 24,          # ~4,6 km
        "escala": {"tipo": "log10", "min": -2.0, "max": 2.0},   # 0,01-100 mg/m³
        "origen": "satélite (L4, huecos por nubes interpolados por el productor)",
    },
    "temperatura-agua": {
        "producto": "IBI_ANALYSISFORECAST_PHY_005_001",
        "dataset": "cmems_mod_ibi_phy_anfc_0.027deg-2D_PT1H-m",
        "variable": "thetao",
        "doi": "10.48670/moi-00027",
        "unidad": "°C",
        "paso": 1 / 18,          # ~6 km
        "escala": {"tipo": "lineal", "min": 0.0, "paso": 0.125},  # 0-31,75 °C
        "origen": "modelo IBI (análisis y previsión), 12:00 UTC",
    },
}


def cuantizar(valores, escala):
    """float (NaN = sin dato) -> uint8 (255 = sin dato)."""
    v = np.asarray(valores, dtype=np.float64)
    salida = np.full(v.shape, 255, dtype=np.uint8)
    ok = np.isfinite(v)
    if escala["tipo"] == "log10":
        ok &= v > 0
        with np.errstate(divide="ignore", invalid="ignore"):
            b = (np.log10(np.where(ok, v, 1)) - escala["min"]) / (escala["max"] - escala["min"]) * 254
    else:
        b = (np.where(ok, v, 0) - escala["min"]) / escala["paso"]
    salida[ok] = np.clip(np.rint(b[ok]), 0, 254).astype(np.uint8)
    return salida


def descuantizar(b, escala):
    """Inverso de cuantizar (lo mismo que hace index.html), para tests."""
    b = np.asarray(b, dtype=np.float64)
    if escala["tipo"] == "log10":
        v = 10 ** (escala["min"] + b * (escala["max"] - escala["min"]) / 254)
    else:
        v = escala["min"] + b * escala["paso"]
    return np.where(b == 255, np.nan, v)


def rejilla(lats, lons, valores, paso, log=False):
    """Media por celda de salida (fila 0 = norte) de una rejilla nativa."""
    filas = int(round((CAJA["norte"] - CAJA["sur"]) / paso))
    cols = int(round((CAJA["este"] - CAJA["oeste"]) / paso))
    la2, lo2 = np.meshgrid(lats, lons, indexing="ij")
    v = np.asarray(valores, dtype=np.float64)
    ok = np.isfinite(v) & (la2 < CAJA["norte"]) & (la2 >= CAJA["sur"]) & (lo2 >= CAJA["oeste"]) & (lo2 < CAJA["este"])
    if log:
        ok &= v > 0
    f = np.floor((CAJA["norte"] - la2[ok]) / paso).astype(np.int64)
    c = np.floor((lo2[ok] - CAJA["oeste"]) / paso).astype(np.int64)
    dentro = (f >= 0) & (f < filas) & (c >= 0) & (c < cols)
    idx = f[dentro] * cols + c[dentro]
    x = v[ok][dentro]
    if log:
        x = np.log10(x)
    suma = np.bincount(idx, weights=x, minlength=filas * cols)
    n = np.bincount(idx, minlength=filas * cols)
    with np.errstate(invalid="ignore", divide="ignore"):
        media = np.where(n > 0, suma / np.maximum(n, 1), np.nan)
    if log:
        media = np.where(np.isfinite(media), 10 ** media, np.nan)
    return media.reshape(filas, cols)


def salida_capa(nombre, fecha, media):
    d = CAPAS[nombre]
    datos = cuantizar(media, d["escala"])
    filas, cols = datos.shape
    return {
        "v": 1,
        "capa": nombre,
        "variable": d["variable"],
        "unidad": d["unidad"],
        "origen": d["origen"],
        "fecha": fecha,
        "generado_en": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "atribucion": ATRIBUCION,
        "doi": d["doi"],
        "producto": d["producto"],
        "dataset": d["dataset"],
        **CAJA,
        "paso": d["paso"],
        "filas": filas,
        "columnas": cols,
        "escala": d["escala"],
        "datos": base64.b64encode(datos.tobytes()).decode("ascii"),
    }


def abrir(dataset_id, variable, inicio=None, fin=None):
    import copernicusmarine
    return copernicusmarine.open_dataset(
        dataset_id=dataset_id,
        variables=[variable],
        minimum_latitude=CAJA["sur"], maximum_latitude=CAJA["norte"],
        minimum_longitude=CAJA["oeste"], maximum_longitude=CAJA["este"],
        start_datetime=inicio, end_datetime=fin,
        service="arco-geo-series",
    )


def superficie(da):
    for d in ("depth", "elevation"):
        if d in da.dims:
            da = da.isel({d: 0})
    return da


def clorofila_real():
    d = CAPAS["clorofila"]
    hoy = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    ds = abrir(d["dataset"], d["variable"], (hoy - timedelta(days=10)).strftime("%Y-%m-%dT00:00:00"), hoy.strftime("%Y-%m-%dT00:00:00"))
    tiempos = ds["time"].values
    # El último día con datos de verdad (el NRT a veces publica el día con
    # casi todo vacío): se baja hasta 5 días si hace falta. Nunca se rellena.
    for t in tiempos[::-1][:5]:
        da = superficie(ds[d["variable"]]).sel(time=t).load()
        v = da.values
        if np.isfinite(v).mean() > 0.2:
            return str(np.datetime_as_string(t, unit="D")), da["latitude"].values, da["longitude"].values, v
    raise SystemExit("::error::clorofila: ningún día reciente con datos")


def temperatura_real():
    d = CAPAS["temperatura-agua"]
    hoy12 = datetime.now(timezone.utc).replace(hour=12, minute=0, second=0, microsecond=0)
    s = hoy12.strftime("%Y-%m-%dT%H:%M:%S")
    ds = abrir(d["dataset"], d["variable"], s, s)
    da = superficie(ds[d["variable"]]).isel(time=0).load()
    v = da.values
    if np.isfinite(v).mean() < 0.2:
        raise SystemExit("::error::temperatura del agua: el modelo no trae datos para hoy")
    return hoy12.strftime("%Y-%m-%d"), da["latitude"].values, da["longitude"].values, v


def prueba(nombre):
    d = CAPAS[nombre]
    paso_nativo = 1 / 96 if nombre == "clorofila" else 1 / 36
    lats = np.arange(CAJA["sur"], CAJA["norte"], paso_nativo) + paso_nativo / 2
    lons = np.arange(CAJA["oeste"], CAJA["este"], paso_nativo) + paso_nativo / 2
    la2, lo2 = np.meshgrid(lats, lons, indexing="ij")
    tierra = (la2 > 37) & (la2 < 43.2) & (lo2 > -8.8) & (lo2 < -0.5)
    if nombre == "clorofila":
        v = 10 ** (np.sin(la2) + np.cos(lo2) * 0.5 - 0.5)
    else:
        v = 30 - (la2 - 26) * 0.6
    v = np.where(tierra, np.nan, v)
    return datetime.now(timezone.utc).strftime("%Y-%m-%d"), lats, lons, v


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--salida", required=True)
    ap.add_argument("--prueba", action="store_true")
    a = ap.parse_args()
    if not a.prueba and not (os.environ.get("COPERNICUSMARINE_SERVICE_USERNAME") and os.environ.get("COPERNICUSMARINE_SERVICE_PASSWORD")):
        print("::error::Faltan COPERNICUSMARINE_SERVICE_USERNAME / _PASSWORD (cuenta gratuita de Copernicus Marine)")
        raise SystemExit(1)
    os.makedirs(os.path.join(a.salida, "capas"), exist_ok=True)
    for nombre, fuente in (("clorofila", clorofila_real), ("temperatura-agua", temperatura_real)):
        t0 = time.time()
        fecha, lats, lons, v = prueba(nombre) if a.prueba else fuente()
        media = rejilla(lats, lons, v, CAPAS[nombre]["paso"], log=CAPAS[nombre]["escala"]["tipo"] == "log10")
        j = salida_capa(nombre, fecha, media)
        j["prueba"] = bool(a.prueba)
        ruta = os.path.join(a.salida, "capas", f"{nombre}.json")
        with open(ruta, "w", encoding="utf-8") as fh:
            json.dump(j, fh, separators=(",", ":"))
        con_dato = float(np.isfinite(media).mean())
        print(f"capa {nombre}: {fecha}, {j['filas']}x{j['columnas']}, {con_dato:.0%} con dato, "
              f"{os.path.getsize(ruta) / 1e3:.0f} kB, {time.time() - t0:.0f} s")


if __name__ == "__main__":
    main()
