#!/usr/bin/env python3
"""scripts/fuentes/descargar-ibi.py

Descarga el modelo IBI (Iberia-Biscay-Ireland) de Copernicus Marine para los
spots y las boyas de Costaviva Y PARA TODA LA FRANJA COSTERA de España y
Portugal (península, Baleares, Canarias, Ceuta, Melilla y Madeira), y deja
JSON compactos con la forma que lee functions/_lib/copernicus-mar.js. Sin IA.

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

Franja costera (fase 2, 2026-10-08): para que una ubicación personalizada en
CUALQUIER punto de la costa tenga datos de mar, se guardan las celdas de mar
a menos de ~RADIO_COSTA_KM de tierra dentro de ZONAS (España y Portugal; se
recortan Francia, Marruecos atlántico y Argelia). Para no multiplicar el
tamaño se toma UNA celda por cada cuadro de PASO_COSTA x PASO_COSTA celdas
(~8 km): la más pegada a la costa de ese cuadro. Así la celda guardada más
cercana a cualquier punto de costa queda a pocos km.

Cómo se descarga: el servicio "arco-time-series" guarda los datos en bloques
de 16x16 celdas y ~140 días; se lee bloque a bloque (solo los bloques que
tienen alguna celda elegida), en paralelo y con memoria acotada. La máscara de
mar sale de UN instante del servicio "arco-geo-series" (un bloque con todo el
dominio).

Credenciales: COPERNICUSMARINE_SERVICE_USERNAME / _PASSWORD (el toolbox las
lee solo; en el workflow vienen de los secrets COPERNICUSMARINE_USERNAME /
COPERNICUSMARINE_PASSWORD). Sin ellas el workflow falla en rojo.

Uso:
  python descargar-ibi.py --puntos puntos.json --salida dir [--dias-atras 10]
  python descargar-ibi.py --prueba --puntos puntos.json --salida dir
     (datos sintéticos, sin red ni cuenta: comprueba el formato de salida)
  --sin-costa   solo spots y boyas (lo de la fase 1)
"""
import argparse
import json
import math
import os
import time
from datetime import datetime, timedelta, timezone

import numpy as np

DS_OLA = "cmems_mod_ibi_wav_anfc_0.027deg_PT1H-i"
VARS_OLA = ["VHM0", "VMDR", "VTM10", "VTPK"]
DS_FIS = "cmems_mod_ibi_phy_anfc_0.027deg-2D_PT1H-m"
VARS_FIS = ["thetao", "zos", "uo", "vo"]
BLOQUE = 16          # tamaño de bloque espacial del servicio arco-time-series
RADIO_SPOT = 0.25    # grados: celda de mar más cercana al spot
RADIO_FIS = 0.15     # grados: celda física más cercana a la celda de oleaje
RADIO_COSTA_KM = 20  # franja costera guardada
PASO_COSTA = 3       # una celda por cuadro de 3x3 celdas (~8 km)
LOTE_BLOQUES = 30    # bloques de 16x16 por tanda de descarga

# Cajas (lat_min, lat_max, lon_min, lon_max) con costa de España o Portugal.
ZONAS = [
    (35.1, 44.0, -10.0, 4.6),    # península, Baleares, Ceuta y Melilla
    (27.4, 29.6, -18.4, -13.2),  # Canarias
    (32.3, 33.3, -17.5, -16.0),  # Madeira (y Porto Santo)
    (29.9, 30.3, -16.1, -15.7),  # Islas Salvajes (PT)
]
# Costas ajenas dentro de esas cajas: (condición) -> fuera.
EXCLUSIONES = [
    lambda la, lo: (lo > -1.6) & (la < 37.3),     # Argelia
    # Marruecos atlántico. OJO: solo al este de -12 (bug visto en real el
    # 2026-10-08: sin ese límite se comía Canarias y Madeira enteras).
    lambda la, lo: (lo < -6.0) & (lo > -12.0) & (la < 35.75),
    lambda la, lo: (lo > -1.75) & (la > 43.45),   # Francia atlántica
    lambda la, lo: (lo > 3.0) & (la > 42.45),     # Francia mediterránea
]


def zona_interes(la, lo):
    """Máscara (o bool) de la franja de interés: España y Portugal."""
    la, lo = np.asarray(la, dtype=float), np.asarray(lo, dtype=float)
    dentro = np.zeros(np.broadcast(la, lo).shape, dtype=bool)
    for a, b, c, d in ZONAS:
        dentro |= (la >= a) & (la <= b) & (lo >= c) & (lo <= d)
    for excl in EXCLUSIONES:
        dentro &= ~excl(la, lo)
    return dentro


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
    return np.isfinite(np.asarray(da.values))


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


def dilatar(m):
    """Dilatación binaria de 8 vecinos (sin scipy)."""
    s = m.copy()
    s[1:, :] |= m[:-1, :]
    s[:-1, :] |= m[1:, :]
    s[:, 1:] |= m[:, :-1]
    s[:, :-1] |= m[:, 1:]
    s[1:, 1:] |= m[:-1, :-1]
    s[1:, :-1] |= m[:-1, 1:]
    s[:-1, 1:] |= m[1:, :-1]
    s[:-1, :-1] |= m[1:, 1:]
    return s


def celdas_costeras(lats, lons, masc, radio_km=RADIO_COSTA_KM, paso=PASO_COSTA):
    """Celdas de mar de la franja costera: [(iy, ix, anillo)].

    anillo = distancia a tierra en celdas (1 = pegada a la costa). Una celda
    por cuadro de `paso` x `paso`: la de menor anillo (la más costera).
    Tierra = celdas sin dato dentro del dominio del modelo.
    """
    km_celda = abs(float(lats[1] - lats[0])) * 111.0
    n = max(1, int(math.ceil(radio_km / km_celda)))
    anillo = np.zeros(masc.shape, dtype=np.int16)
    frente = ~masc
    for k in range(1, n + 1):
        nuevo = dilatar(frente)
        anillo[nuevo & ~frente & masc] = k
        frente = nuevo
    elegibles = (anillo > 0) & zona_interes(lats[:, None], lons[None, :])
    salida = []
    ny, nx = masc.shape
    for by in range(0, ny, paso):
        for bx in range(0, nx, paso):
            sub = elegibles[by:by + paso, bx:bx + paso]
            if not sub.any():
                continue
            an = np.where(sub, anillo[by:by + paso, bx:bx + paso], 9999)
            k = int(np.argmin(an))
            iy, ix = by + k // an.shape[1], bx + k % an.shape[1]
            salida.append((iy, ix, int(anillo[iy, ix])))
    return salida


def extraer(ds_ts, variables, celdas, inicio, horas, lote=LOTE_BLOQUES):
    """Series horarias {variable: array (n_celdas, horas)} en el eje
    inicio..inicio+horas-1. Una hora que no esté en el modelo queda NaN
    (nunca se rellena).

    Se pide con indexado vectorial de puntos (dask descarga cada trozo del
    Zarr una sola vez aunque caigan varios puntos en él), por tandas de
    `lote` bloques de 16x16 vecinos para tener memoria acotada y progreso.
    Medido (2026-10-08): pedir bloque a bloque en hilos era ~10 veces más
    lento, porque cada petición volvía a bajar trozos ya bajados."""
    import xarray as xr
    n = len(celdas)
    salida = {v: np.full((n, horas), np.nan, dtype=np.float32) for v in variables}
    if not n:
        return salida, 0
    grupos = {}
    for k, (iy, ix) in enumerate(celdas):
        grupos.setdefault((iy // BLOQUE, ix // BLOQUE), []).append(k)
    claves = sorted(grupos)
    t0 = np.datetime64(inicio.replace(tzinfo=None), "ns")
    t1 = np.datetime64((inicio + timedelta(hours=horas - 1)).replace(tzinfo=None), "ns")
    base = t0.astype("datetime64[h]")
    t_ini = time.time()
    for a in range(0, len(claves), lote):
        ks = [k for c in claves[a:a + lote] for k in grupos[c]]
        iys = [celdas[k][0] for k in ks]
        ixs = [celdas[k][1] for k in ks]
        for intento in range(3):
            try:
                sel = ds_ts[variables].isel(
                    latitude=xr.DataArray(iys, dims="p"), longitude=xr.DataArray(ixs, dims="p")
                ).sel(time=slice(t0, t1)).load()
                break
            except Exception as e:  # red: reintento con espera
                if intento == 2:
                    raise
                print(f"::warning::tanda {a}: {e}; reintento", flush=True)
                time.sleep(10 * (intento + 1))
        tiempos = sel["time"].values.astype("datetime64[h]")
        idx_t = (tiempos - base).astype(int)
        ok = (idx_t >= 0) & (idx_t < horas)
        for v in variables:
            arr = superficie(sel[v]).transpose("p", "time").values
            salida[v][np.ix_(ks, idx_t[ok])] = arr[:, ok]
        hechos = min(a + lote, len(claves))
        print(f"  {hechos}/{len(claves)} bloques, {time.time() - t_ini:.0f} s", flush=True)
    return salida, len(claves)


def redondear(arr, dec):
    return [None if not np.isfinite(x) else (int(round(float(x))) if dec == 0 else round(float(x), dec)) for x in arr]


def datos_prueba(puntos, inicio, horas):
    """Datasets sintéticos (dask, perezosos) con la misma estructura que los
    reales. Tierra: un rectángulo "península", una "isla" y un cuadrado
    alrededor de cada punto (la costa queda al lado del punto)."""
    import dask.array as da_
    import xarray as xr
    lats = np.arange(26.0, 46.0, 0.0277786)
    lons = np.arange(-19.0, 5.0, 0.0277786)
    tiempos = np.array([np.datetime64((inicio + timedelta(hours=h)).replace(tzinfo=None), "ns") for h in range(horas)])
    tierra = np.zeros((len(lats), len(lons)), dtype=bool)
    tierra[np.ix_((lats > 37.0) & (lats < 43.2), (lons > -8.8) & (lons < -0.5))] = True
    tierra[np.ix_((lats > 28.0) & (lats < 28.6), (lons > -16.9) & (lons < -16.1))] = True
    for p in puntos:
        iy = int(np.argmin(np.abs(lats - p["lat"])))
        ix = int(np.argmin(np.abs(lons - p["lon"])))
        tierra[max(0, iy - 3):iy + 1, ix:ix + 4] = True
    mar = da_.from_array(~tierra, chunks=(BLOQUE, BLOQUE))

    def ds(variables, lat_off=0.0):
        datos = {}
        for i, v in enumerate(variables):
            a = da_.random.default_rng(i).random((len(tiempos), len(lats), len(lons)), chunks=(horas, BLOQUE, BLOQUE)).astype(np.float32)
            a = da_.where(mar[None, :, :], a, np.float32(np.nan))
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
    ap.add_argument("--sin-costa", action="store_true")
    a = ap.parse_args()
    t_inicio = time.time()

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
        instante = np.datetime64(inicio.replace(tzinfo=None), "ns")
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

    # 1) Celda de oleaje de cada spot/boya.
    salida_puntos = []   # (dict base, (iy, ix))
    for p in puntos:
        c = celda_cercana(lat_o, lon_o, masc_o, p["lat"], p["lon"], RADIO_SPOT)
        if c is None:
            print(f"::warning::sin celda de mar de oleaje para {p['id']}")
            continue
        salida_puntos.append((p, c))

    # 2) Franja costera.
    costa = [] if a.sin_costa else celdas_costeras(lat_o, lon_o, masc_o)
    if costa and not a.prueba:
        # Cada zona (península, Canarias, Madeira, Salvajes) tiene que tener
        # celdas: si una sale vacía es un fallo, no un dato.
        for (z1, z2, z3, z4) in ZONAS:
            n = sum(1 for iy, ix, _ in costa if z1 <= lat_o[iy] <= z2 and z3 <= lon_o[ix] <= z4)
            print(f"IBI: zona {z1}-{z2} N, {z3}-{z4} E: {n} celdas costeras", flush=True)
            if n == 0:
                print(f"::error::zona {z1}-{z2} N, {z3}-{z4} E sin celdas costeras")
                raise SystemExit(1)
    celdas_costa = [(iy, ix) for iy, ix, _ in costa]
    anillos = [an for _, _, an in costa]

    todas = [c for _, c in salida_puntos] + celdas_costa
    # 3) Celda física más cercana a cada celda de oleaje.
    fis_idx = [celda_cercana(lat_f, lon_f, masc_f, float(lat_o[iy]), float(lon_o[ix]), RADIO_FIS) for (iy, ix) in todas]

    # 4) Extracción bloque a bloque.
    print(f"IBI: {len(salida_puntos)} spots/boyas y {len(celdas_costa)} celdas costeras; descargando…", flush=True)
    print(f"IBI: trozos dask oleaje {ola_ts[VARS_OLA[0]].chunks}", flush=True)
    t_ext = time.time()
    ola, bloques_o = extraer(ola_ts, VARS_OLA, todas, inicio, horas)
    con_fis = [i for i, f in enumerate(fis_idx) if f is not None]
    fis_parcial, bloques_f = extraer(fis_ts, VARS_FIS, [fis_idx[i] for i in con_fis], inicio, horas)
    fis = {v: np.full((len(todas), horas), np.nan, dtype=np.float32) for v in VARS_FIS}
    for k, i in enumerate(con_fis):
        for v in VARS_FIS:
            fis[v][i] = fis_parcial[v][k]
    t_ext = time.time() - t_ext

    def columnas(i):
        uo, vo = fis["uo"][i].astype(np.float64), fis["vo"][i].astype(np.float64)
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
    ruta_spots = os.path.join(a.salida, "mar", "spots.json")
    with open(ruta_spots, "w", encoding="utf-8") as fh:
        json.dump({**cabecera, "puntos": spots}, fh, separators=(",", ":"))

    cajas = {}
    base = len(salida_puntos)
    for k, (iy, ix) in enumerate(celdas_costa):
        la, lo = round(float(lat_o[iy]), 4), round(float(lon_o[ix]), 4)
        cajas.setdefault(clave_caja(la, lo), []).append({
            "id": f"c{la}_{lo}", "tipo": "celda", "anillo": anillos[k], "lat": la, "lon": lo, **columnas(base + k),
        })
    tam_max = 0
    total = os.path.getsize(ruta_spots)
    for clave, lista in cajas.items():
        ruta = os.path.join(a.salida, "mar", "celdas", f"{clave}.json")
        with open(ruta, "w", encoding="utf-8") as fh:
            json.dump({**cabecera, "puntos": lista}, fh, separators=(",", ":"))
        tam = os.path.getsize(ruta)
        tam_max = max(tam_max, tam)
        total += tam

    sin_ola = sum(1 for s in spots if all(v is None for v in s["wh"]))
    print(f"IBI: {len(spots)} spots/boyas, {len(celdas_costa)} celdas costeras en {len(cajas)} cajas, "
          f"{horas} h desde {cabecera['inicio']}")
    print(f"IBI: bloques leídos oleaje={bloques_o} física={bloques_f}; extracción {t_ext:.0f} s; total {time.time() - t_inicio:.0f} s")
    print(f"IBI: spots.json {os.path.getsize(ruta_spots) / 1e6:.2f} MB; caja mayor {tam_max / 1e6:.2f} MB; total {total / 1e6:.1f} MB")
    if tam_max > 30 * 1024 * 1024:
        print("::error::una caja pasa de 30 MB (límite del bucket)")
        raise SystemExit(1)
    if sin_ola > len(spots) * 0.1:
        print(f"::error::{sin_ola} puntos sin ningún dato de oleaje")
        raise SystemExit(1)


if __name__ == "__main__":
    main()
