#!/usr/bin/env python3
"""scripts/fuentes/descargar-ibi.py

Descarga el modelo IBI (Iberia-Biscay-Ireland) de Copernicus Marine para los
spots y las boyas de Costaviva y deja JSON compactos con la forma que lee
functions/_lib/copernicus-mar.js (2026-10-08). Sin IA.

Productos (comprobados con `copernicusmarine describe`, 2026-10-08):
  IBI_ANALYSISFORECAST_WAV_005_005 (DOI 10.48670/moi-00025)
    dataset cmems_mod_ibi_wav_anfc_0.027deg_PT1H-i  (horario, instantáneo)
    VHM0 altura significativa (m) · VMDR dirección media de donde viene (°)
    VTM10 periodo medio (s) · VTPK periodo de pico (s)
  IBI_ANALYSISFORECAST_PHY_005_001 (DOI 10.48670/moi-00027)
    dataset cmems_mod_ibi_phy_anfc_0.027deg-2D_PT1H-m (horario, medias)
    thetao temperatura de superficie (°C) · zos nivel del mar sobre el
    geoide (m, CON marea: el producto tiene aparte versiones "detided")
    uo/vo corriente de superficie (m/s)
Dominio: 26-56 N, 19 W - 5 E (cubre península, Baleares, Canarias y Madeira;
NO Azores). Rejilla 1/36° (~3 km). Previsión a 10 días.

Cómo se descarga poco: el servicio "arco-time-series" guarda los datos en
bloques de 16x16 celdas y ~140 días; solo se leen los bloques donde caen los
puntos. La máscara de mar sale de UN instante del servicio "arco-geo-series"
(un bloque con todo el dominio).

Credenciales: COPERNICUSMARINE_SERVICE_USERNAME / _PASSWORD (el toolbox las
lee solo; en el workflow vienen de los secrets COPERNICUSMARINE_USERNAME /
COPERNICUSMARINE_PASSWORD). Sin ellas el workflow falla en rojo.

Uso:
  python descargar-ibi.py --puntos puntos.json --salida dir [--dias-atras 10]
  python descargar-ibi.py --prueba --puntos puntos.json --salida dir
     (datos sintéticos, sin red ni cuenta: comprueba el formato de salida)
"""
import argparse
import json
import math
import os
from datetime import datetime, timedelta, timezone

import numpy as np

DS_OLA = "cmems_mod_ibi_wav_anfc_0.027deg_PT1H-i"
VARS_OLA = ["VHM0", "VMDR", "VTM10", "VTPK"]
DS_FIS = "cmems_mod_ibi_phy_anfc_0.027deg-2D_PT1H-m"
VARS_FIS = ["thetao", "zos", "uo", "vo"]
BLOQUE = 16          # tamaño de bloque espacial del servicio arco-time-series
SUBMUESTREO = 4      # celdas extra para ubicaciones personalizadas: 1 de cada 4
RADIO_SPOT = 0.25    # grados: celda de mar más cercana al spot
RADIO_FIS = 0.15     # grados: celda física más cercana a la celda de oleaje


def clave_caja(lat, lon):
    # Igual que claveCaja() de functions/_lib/copernicus-mar.js
    return f"{math.floor(lat * 2)}_{math.floor(lon * 2)}"


def abrir(dataset_id, variables, servicio, inicio=None, fin=None):
    import copernicusmarine
    return copernicusmarine.open_dataset(
        dataset_id=dataset_id,
        variables=variables,
        start_datetime=inicio,
        end_datetime=fin,
        service=servicio,
    )


def superficie(da):
    for d in ("depth", "elevation"):
        if d in da.dims:
            da = da.isel({d: 0})
    return da


def mascara(ds_geo, var, instante):
    """Matriz booleana (lat, lon) de celdas con dato en un instante."""
    da = superficie(ds_geo[var]).sel(time=instante, method="nearest")
    return np.isfinite(da.values)


def celda_cercana(lats, lons, masc, lat, lon, radio):
    """Índices (iy, ix) de la celda válida más cercana dentro de `radio`°."""
    iy0 = int(np.argmin(np.abs(lats - lat)))
    ix0 = int(np.argmin(np.abs(lons - lon)))
    paso = abs(float(lats[1] - lats[0]))
    n = int(math.ceil(radio / paso)) + 1
    y0, y1 = max(0, iy0 - n), min(len(lats), iy0 + n + 1)
    x0, x1 = max(0, ix0 - n), min(len(lons), ix0 + n + 1)
    sub = masc[y0:y1, x0:x1]
    if not sub.any():
        return None
    yy, xx = np.nonzero(sub)
    la = lats[y0 + yy]
    lo = lons[x0 + xx]
    d2 = (la - lat) ** 2 + ((lo - lon) * math.cos(math.radians(lat))) ** 2
    k = int(np.argmin(d2))
    if math.sqrt(d2[k]) > radio:
        return None
    return int(y0 + yy[k]), int(x0 + xx[k])


def extraer(ds_ts, variables, iys, ixs, inicio, horas):
    """Series horarias [variable][punto][hora] en el eje inicio..inicio+horas."""
    import xarray as xr
    if not iys:
        return {v: np.full((0, horas), np.nan) for v in variables}
    sel = ds_ts[variables].isel(
        latitude=xr.DataArray(iys, dims="p"), longitude=xr.DataArray(ixs, dims="p")
    )
    sel = sel.sel(time=slice(np.datetime64(inicio.replace(tzinfo=None)),
                             np.datetime64((inicio + timedelta(hours=horas - 1)).replace(tzinfo=None))))
    sel = sel.load()
    eje = np.array([np.datetime64((inicio + timedelta(hours=h)).replace(tzinfo=None), "ns") for h in range(horas)])
    salida = {}
    for v in variables:
        da = superficie(sel[v]).transpose("p", "time")
        # Reindexado exacto por hora: si una hora no está, NaN (nunca se rellena).
        tiempos = da["time"].values.astype("datetime64[h]").astype("datetime64[ns]")
        m = np.full((len(iys), horas), np.nan)
        idx = {t: i for i, t in enumerate(eje)}
        vals = da.values
        for j, t in enumerate(tiempos):
            i = idx.get(t)
            if i is not None:
                m[:, i] = vals[:, j]
        salida[v] = m
    return salida


def redondear(arr, dec):
    return [None if not np.isfinite(x) else (int(round(float(x))) if dec == 0 else round(float(x), dec)) for x in arr]


def datos_prueba(puntos, inicio, horas):
    """Datasets sintéticos con la misma estructura que los reales."""
    import xarray as xr
    rng = np.random.default_rng(1)
    lats = np.arange(26.0, 46.0, 0.0277786)
    lons = np.arange(-19.0, 5.0, 0.0277786)
    tiempos = np.array([np.datetime64((inicio + timedelta(hours=h)).replace(tzinfo=None), "ns") for h in range(horas)])
    tierra = np.zeros((len(lats), len(lons)), dtype=bool)
    # Tierra al sur-este de cada punto (la costa queda al lado del punto).
    for p in puntos:
        iy = int(np.argmin(np.abs(lats - p["lat"])))
        ix = int(np.argmin(np.abs(lons - p["lon"])))
        tierra[max(0, iy - 3):iy + 1, ix:ix + 4] = True

    def ds(variables, lat_off=0.0):
        datos = {}
        for v in variables:
            a = rng.random((len(tiempos), len(lats), len(lons)), dtype=np.float32)
            a[:, tierra] = np.nan
            datos[v] = (("time", "latitude", "longitude"), a)
        return xr.Dataset(datos, coords={"time": tiempos, "latitude": lats + lat_off, "longitude": lons})

    return ds(VARS_OLA), ds(VARS_FIS, 0.01)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--puntos", required=True, help="JSON [{id, tipo, lat, lon}] (spots y boyas)")
    ap.add_argument("--salida", required=True)
    ap.add_argument("--dias-atras", type=int, default=10)
    ap.add_argument("--dias-adelante", type=int, default=10)
    ap.add_argument("--prueba", action="store_true")
    a = ap.parse_args()

    puntos = json.load(open(a.puntos, encoding="utf-8"))
    hoy = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    inicio = hoy - timedelta(days=a.dias_atras)
    horas = (a.dias_atras + a.dias_adelante + 1) * 24
    fin = inicio + timedelta(hours=horas - 1)

    if a.prueba:
        horas = 72
        fin = inicio + timedelta(hours=horas - 1)
        ola, fis = datos_prueba(puntos, inicio, horas)
        ola_geo, ola_ts, fis_geo, fis_ts = ola, ola, fis, fis
        instante = np.datetime64(inicio.replace(tzinfo=None))
    else:
        if not (os.environ.get("COPERNICUSMARINE_SERVICE_USERNAME") and os.environ.get("COPERNICUSMARINE_SERVICE_PASSWORD")):
            print("::error::Faltan COPERNICUSMARINE_SERVICE_USERNAME / _PASSWORD (cuenta gratuita de Copernicus Marine)")
            raise SystemExit(1)
        ini_s = inicio.strftime("%Y-%m-%dT%H:%M:%S")
        fin_s = fin.strftime("%Y-%m-%dT%H:%M:%S")
        ola_ts = abrir(DS_OLA, VARS_OLA, "arco-time-series", ini_s, fin_s)
        fis_ts = abrir(DS_FIS, VARS_FIS, "arco-time-series", ini_s, fin_s)
        ahora_s = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:00:00")
        ola_geo = abrir(DS_OLA, ["VHM0"], "arco-geo-series", ahora_s, ahora_s)
        fis_geo = abrir(DS_FIS, ["zos"], "arco-geo-series", ahora_s, ahora_s)
        instante = np.datetime64(ahora_s)

    lat_o, lon_o = ola_ts["latitude"].values, ola_ts["longitude"].values
    lat_f, lon_f = fis_ts["latitude"].values, fis_ts["longitude"].values
    masc_o = mascara(ola_geo, "VHM0", instante)
    masc_f = mascara(fis_geo, "zos", instante)
    # La máscara sale del servicio geo-series: debe tener la misma rejilla.
    assert masc_o.shape == (len(lat_o), len(lon_o)), "rejilla de oleaje distinta entre servicios"
    assert masc_f.shape == (len(lat_f), len(lon_f)), "rejilla física distinta entre servicios"

    # 1) Celda de oleaje de cada spot/boya y celdas extra de su mismo bloque.
    salida_puntos = []   # (dict base, iy_o, ix_o)
    celdas = {}          # (iy, ix) -> dict base
    for p in puntos:
        c = celda_cercana(lat_o, lon_o, masc_o, p["lat"], p["lon"], RADIO_SPOT)
        if c is None:
            print(f"::warning::sin celda de mar de oleaje para {p['id']}")
            continue
        salida_puntos.append((p, c))
        if p.get("tipo") != "spot":
            continue
        celdas[c] = None
        by, bx = c[0] // BLOQUE * BLOQUE, c[1] // BLOQUE * BLOQUE
        for iy in range(by, min(by + BLOQUE, len(lat_o)), SUBMUESTREO):
            for ix in range(bx, min(bx + BLOQUE, len(lon_o)), SUBMUESTREO):
                if masc_o[iy, ix]:
                    celdas[(iy, ix)] = None

    todas = [c for _, c in salida_puntos] + list(celdas.keys())
    # 2) Celda física más cercana a cada celda de oleaje.
    fis_idx = []
    for (iy, ix) in todas:
        f = celda_cercana(lat_f, lon_f, masc_f, float(lat_o[iy]), float(lon_o[ix]), RADIO_FIS)
        fis_idx.append(f)

    # 3) Extracción (solo los bloques donde caen los puntos).
    ola = extraer(ola_ts, VARS_OLA, [c[0] for c in todas], [c[1] for c in todas], inicio, horas)
    con_fis = [i for i, f in enumerate(fis_idx) if f is not None]
    fis_parcial = extraer(fis_ts, VARS_FIS, [fis_idx[i][0] for i in con_fis], [fis_idx[i][1] for i in con_fis], inicio, horas)
    fis = {v: np.full((len(todas), horas), np.nan) for v in VARS_FIS}
    for k, i in enumerate(con_fis):
        for v in VARS_FIS:
            fis[v][i] = fis_parcial[v][k]

    def columnas(i):
        uo, vo = fis["uo"][i], fis["vo"][i]
        with np.errstate(invalid="ignore"):
            cv = np.hypot(uo, vo) * 3.6
            cd = (np.degrees(np.arctan2(uo, vo)) + 360) % 360
        return {
            "wh": redondear(ola["VHM0"][i], 2),
            "wd": redondear(ola["VMDR"][i], 0),
            "wp": redondear(ola["VTM10"][i], 1),
            "wpp": redondear(ola["VTPK"][i], 1),
            "sst": redondear(fis["thetao"][i], 2),
            "sl": redondear(fis["zos"][i], 3),
            "cv": redondear(cv, 2),
            "cd": redondear(cd, 0),
        }

    cabecera = {
        "v": 1,
        "fuente": "copernicus-ibi",
        "atribucion": "Generated using E.U. Copernicus Marine Service Information",
        "dois": ["10.48670/moi-00025", "10.48670/moi-00027"],
        "datasets": {"ola": DS_OLA, "fisica": DS_FIS},
        "generado_en": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "inicio": inicio.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "horas": horas,
        "prueba": bool(a.prueba),
    }

    os.makedirs(os.path.join(a.salida, "mar", "celdas"), exist_ok=True)
    spots = []
    for n, (p, c) in enumerate(salida_puntos):
        f = fis_idx[n]
        spots.append({
            "id": p["id"], "tipo": p.get("tipo", "spot"), "lat": p["lat"], "lon": p["lon"],
            "celda_ola": [round(float(lat_o[c[0]]), 4), round(float(lon_o[c[1]]), 4)],
            "celda_fisica": None if f is None else [round(float(lat_f[f[0]]), 4), round(float(lon_f[f[1]]), 4)],
            **columnas(n),
        })
    with open(os.path.join(a.salida, "mar", "spots.json"), "w", encoding="utf-8") as fh:
        json.dump({**cabecera, "puntos": spots}, fh, separators=(",", ":"))

    cajas = {}
    base = len(salida_puntos)
    for k, (iy, ix) in enumerate(celdas.keys()):
        la, lo = round(float(lat_o[iy]), 4), round(float(lon_o[ix]), 4)
        cajas.setdefault(clave_caja(la, lo), []).append({
            "id": f"c{la}_{lo}", "tipo": "celda", "lat": la, "lon": lo, **columnas(base + k),
        })
    for clave, lista in cajas.items():
        with open(os.path.join(a.salida, "mar", "celdas", f"{clave}.json"), "w", encoding="utf-8") as fh:
            json.dump({**cabecera, "puntos": lista}, fh, separators=(",", ":"))

    sin_ola = sum(1 for s in spots if all(v is None for v in s["wh"]))
    print(f"IBI: {len(spots)} spots/boyas, {len(celdas)} celdas en {len(cajas)} cajas, {horas} h desde {cabecera['inicio']}")
    if sin_ola > len(spots) * 0.1:
        print(f"::error::{sin_ola} puntos sin ningún dato de oleaje")
        raise SystemExit(1)


if __name__ == "__main__":
    main()
