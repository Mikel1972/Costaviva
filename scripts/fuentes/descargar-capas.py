#!/usr/bin/env python3
"""scripts/fuentes/descargar-capas.py

Capas del mapa de clorofila y temperatura del agua (2026-10-08, fase 2 de
fuentes gratuitas, aprobado por Mikel). Sin IA. Deja dos JSON pequeños en
Supabase Storage (bucket público fuentes-gratuitas) que index.html pinta como
capas activables (🌿 Clorofila, 🌡 Temperatura del agua):

  capas/clorofila.json         clorofila-a de satélite (último día disponible)
  capas/temperatura-agua.json  temperatura de superficie del modelo IBI (hoy, 12 UTC)
  capas/frentes.json           〰 frentes de clorofila y térmicos, convergencia y flechas
                               de corriente (ver "Frentes y corrientes" más abajo); también
                               la capa 🌊 Corriente (corriente.velocidad: fuerza en 1/18°)
  capas/historico/frentes-AAAA-MM-DD.json  copia diaria compacta para el aprendizaje

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
        variables=variable if isinstance(variable, list) else [variable],
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
    """Devuelve (fecha, lats, lons, CHL, observado). `observado` = 1 donde el
    satélite vio el agua ese día y 0 donde el productor interpoló (nubes),
    sacado de la variable `flags` del mismo dataset (máscara 2 =
    INTERPOLATED, máscara 1 = LAND; metadatos STAC del dataset, consultados
    el 2026-10-09). Si un día faltara `flags`, observado = None y los frentes
    de clorofila salen sin máscara de nubes (se dice en el JSON)."""
    d = CAPAS["clorofila"]
    hoy = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    rango = ((hoy - timedelta(days=10)).strftime("%Y-%m-%dT00:00:00"), hoy.strftime("%Y-%m-%dT00:00:00"))
    try:
        ds = abrir(d["dataset"], [d["variable"], "flags"], *rango)
        con_flags = True
    except Exception as e:  # noqa: BLE001 — sin flags se sigue, avisando
        print(f"::warning::clorofila: no se pudo pedir `flags` ({e}); frentes sin máscara de nubes")
        ds = abrir(d["dataset"], d["variable"], *rango)
        con_flags = False
    tiempos = ds["time"].values
    # El último día con datos de verdad (el NRT a veces publica el día con
    # casi todo vacío): se baja hasta 5 días si hace falta. Nunca se rellena.
    for t in tiempos[::-1][:5]:
        da = superficie(ds[d["variable"]]).sel(time=t).load()
        v = da.values
        if np.isfinite(v).mean() > 0.2:
            obs = None
            if con_flags:
                fl = np.nan_to_num(superficie(ds["flags"]).sel(time=t).load().values, nan=0).astype(np.int64)
                obs = np.where(np.isfinite(v), ((fl & 2) == 0).astype(np.float64), np.nan)
            return str(np.datetime_as_string(t, unit="D")), da["latitude"].values, da["longitude"].values, v, obs
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


def corrientes_real():
    """Corriente superficial media del día SIN marea (IBI, dataset
    cmems_mod_ibi_phy-cur_anfc_detided-0.027deg_P1D-m, uo_detided /
    vo_detided, m/s; mismo producto y DOI que la temperatura). Sin la marea
    porque en la plataforma la corriente de marea de una hora concreta
    taparía la circulación que junta el alimento."""
    hoy = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    s = hoy.strftime("%Y-%m-%dT%H:%M:%S")
    ds = abrir(CORRIENTE["dataset"], ["uo_detided", "vo_detided"], s, s)
    u = superficie(ds["uo_detided"]).isel(time=0).load()
    v = superficie(ds["vo_detided"]).isel(time=0).load().values
    if np.isfinite(u.values).mean() < 0.2:
        raise SystemExit("::error::corrientes: el modelo no trae datos para hoy")
    return hoy.strftime("%Y-%m-%d"), u["latitude"].values, u["longitude"].values, u.values, v


def prueba(nombre):
    d = CAPAS.get(nombre, {})
    paso_nativo = 1 / 96 if nombre == "clorofila" else 1 / 36
    lats = np.arange(CAJA["sur"], CAJA["norte"], paso_nativo) + paso_nativo / 2
    lons = np.arange(CAJA["oeste"], CAJA["este"], paso_nativo) + paso_nativo / 2
    la2, lo2 = np.meshgrid(lats, lons, indexing="ij")
    tierra = (la2 > 37) & (la2 < 43.2) & (lo2 > -8.8) & (lo2 < -0.5)
    hoy = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if nombre == "clorofila":
        # Fondo suave + una "lengua" verde al este de 6 O (frente de clorofila).
        v = 10 ** (np.sin(la2) + np.cos(lo2) * 0.5 - 0.5 + 0.6 * np.tanh((lo2 + 6) / 0.05))
    elif nombre == "corrientes":
        # Remolino ciclónico en el golfo de Bizkaia (centro 45 N, 5 O) más
        # una deriva al este: hay convergencia y divergencia en sus bordes.
        dy, dx = la2 - 45.0, (lo2 + 5.0) * np.cos(np.radians(45))
        r2 = dx ** 2 + dy ** 2
        k = 0.4 * np.exp(-r2 / 0.5)
        u = np.where(tierra, np.nan, -dy * k + 0.05 - 3 * dx * k)
        v = np.where(tierra, np.nan, dx * k - 3 * dy * k)
        return hoy, lats, lons, u, v
    else:
        # Gradiente norte-sur + un frente térmico a 44,5 N.
        v = 30 - (la2 - 26) * 0.6 - 1.5 * np.tanh((la2 - 44.5) / 0.1)
    v = np.where(tierra, np.nan, v)
    if nombre == "clorofila":
        # Una "nube" (interpolado) al oeste de Galicia para probar la máscara.
        obs = np.where(np.isfinite(v), np.where((la2 > 43.5) & (la2 < 44.5) & (lo2 > -12) & (lo2 < -10), 0.0, 1.0), np.nan)
        return hoy, lats, lons, v, obs
    return hoy, lats, lons, v


# ---------------------------------------------------------------------------
# 〰 Frentes y corrientes (2026-10-09, pedido de Mikel). Sin IA y sin datos
# nuevos de pago: clorofila (con su máscara de nubes), temperatura y corriente
# de IBI que ya se bajan aquí, en una malla común de 1/18° (~5-6 km).
#
# Método (Belkin y O'Reilly 2009, simplificado; ver CLAUDE.md):
#   1. Filtro de mediana 3x3 (quita el ruido de píxel sin borrar el borde).
#   2. Gradiente de Sobel en unidades físicas (por km): de log10(CHL) para la
#      clorofila (varía en órdenes de magnitud) y de la temperatura.
#   3. Umbral: frente de clorofila si |∇log10 CHL| ≥ 0,03 por km (la
#      clorofila se duplica en ~10 km); frente térmico si |∇T| ≥ 0,05 °C/km
#      (medio grado en 10 km). Más bajos que en imágenes de 1 km (Chang y
#      Cornillon 2015 llaman "fuertes" a > 0,2 K/km y "débiles" a < 0,1),
#      porque la malla de ~5 km suaviza los gradientes. Se afinan con el
#      primer mes de datos reales (el script imprime el % de celdas).
#   4. Convergencia de la corriente: -(∂u/∂x + ∂v/∂y) ≥ 0,1·f (f, parámetro
#      de Coriolis). Donde la corriente converge se acumula lo que flota y
#      el plancton (D'Asaro et al. 2018, PNAS). |δ|/f es la medida estándar
#      (McWilliams 2016); 0,1·f es "notable" a esta resolución.
# Máscaras: tierra (255); franja costera de 5 km donde la clorofila del
# satélite no es fiable (aguas "caso 2": sedimentos y materia orgánica de
# ríos; IOCCG 2000, informe 3) y celdas donde el satélite no vio el agua ese
# día (nubes: `flags` INTERPOLATED en más de la mitad de la celda). En esas
# celdas no hay frente de clorofila ni nivel de clorofila; el térmico y la
# convergencia sí (vienen del modelo).
#
# Código por celda (un byte): bit 0 frente de clorofila, bit 1 frente
# térmico, bit 2 convergencia, bits 3-4 nivel de clorofila (0 sin dato,
# 1 baja < 0,2 mg/m³, 2 moderada, 3 alta ≥ 2 mg/m³: posible bloom; clases de
# Antoine et al. 1996 adaptadas), bit 5 franja costera, bit 6 nubes;
# 255 = tierra o sin ningún dato. Lo decodifica assets/js/frentes.js.
# ---------------------------------------------------------------------------
CORRIENTE = {
    "producto": "IBI_ANALYSISFORECAST_PHY_005_001",
    "dataset": "cmems_mod_ibi_phy-cur_anfc_detided-0.027deg_P1D-m",
    "doi": "10.48670/moi-00027",
}
FRENTES = {
    "paso": 1 / 18,
    "umbral_chl_log10_km": 0.03,
    "umbral_temp_c_km": 0.05,
    "umbral_convergencia_f": 0.1,
    "costa_km": 5.0,
    "min_observado": 0.5,
    "niveles_chl": [0.2, 2.0],
    "flechas_cada": 3,            # una flecha cada 3 celdas = 1/6° (~15-18 km)
    "escala_corriente_ms": 0.02,  # byte de corriente: 0,02 m/s por unidad
}
BIT = {"frente_clorofila": 1, "frente_termico": 2, "convergencia": 4, "costa": 32, "nubes": 64}
DESPL_NIVEL = 3
OMEGA = 7.2921e-5


def _vecinos(a):
    """Las 9 copias desplazadas (3x3) de `a`, con NaN fuera del borde."""
    p = np.pad(a, 1, constant_values=np.nan)
    f, c = a.shape
    return [p[1 + di:1 + di + f, 1 + dj:1 + dj + c] for di in (-1, 0, 1) for dj in (-1, 0, 1)]


def mediana3(a):
    """Mediana 3x3 que ignora los NaN; donde el centro es NaN sigue NaN."""
    import warnings
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)
        m = np.nanmedian(np.stack(_vecinos(a)), axis=0)
    return np.where(np.isfinite(a), m, np.nan)


def km_celda(lats, paso):
    """(dx, dy) en km de una celda por fila (fila 0 = norte)."""
    return paso * 111.32 * np.cos(np.radians(lats))[:, None], paso * 110.57


def sobel_km(a, lats, paso):
    """|∇a| por km con Sobel; NaN si falta algún vecino (borde de tierra o
    de nubes: ahí no se inventa un frente)."""
    v = _vecinos(a)  # orden: (-1,-1) (-1,0) (-1,1) (0,-1) (0,0) (0,1) (1,-1) (1,0) (1,1)
    gx = ((v[2] + 2 * v[5] + v[8]) - (v[0] + 2 * v[3] + v[6]))
    gy = ((v[0] + 2 * v[1] + v[2]) - (v[6] + 2 * v[7] + v[8]))  # norte - sur
    dx, dy = km_celda(lats, paso)
    return np.hypot(gx / (8 * dx), gy / (8 * dy))


def convergencia_f(u, v, lats, paso):
    """-(∂u/∂x + ∂v/∂y) / f con diferencias centradas (adimensional)."""
    vu, vv = _vecinos(u), _vecinos(v)
    dx, dy = km_celda(lats, paso)
    dudx = (vu[5] - vu[3]) / (2 * dx * 1000)
    dvdy = (vv[1] - vv[7]) / (2 * dy * 1000)  # fila 0 = norte
    f = 2 * OMEGA * np.sin(np.radians(lats))[:, None]
    return -(dudx + dvdy) / f


def cerca_de(mascara, lats, paso, radio_km):
    """Celdas a radio_km o menos (centro a centro) de alguna celda de `mascara`."""
    dx, dy = km_celda(lats, paso)
    dxm = float(np.min(dx))
    ni, nj = int(np.ceil(radio_km / dy)), int(np.ceil(radio_km / dxm))
    salida = np.zeros_like(mascara, dtype=bool)
    p = np.pad(mascara, ((ni, ni), (nj, nj)), constant_values=False)
    f, c = mascara.shape
    for di in range(-ni, ni + 1):
        for dj in range(-nj, nj + 1):
            # con el dx más estrecho (fila más al norte) el radio se cubre de
            # sobra en todas las filas: la franja nunca sale más estrecha
            if np.hypot(di * dy, dj * dxm) > radio_km:
                continue
            salida |= p[ni + di:ni + di + f, nj + dj:nj + dj + c]
    return salida


def calcular_frentes(chl, observado, temp, u, v, lats, cfg=FRENTES):
    """Todas las entradas en la misma malla (fila 0 = norte). Devuelve
    (códigos uint8, estadísticas)."""
    paso = cfg["paso"]
    tierra_modelo = ~np.isfinite(temp) & ~np.isfinite(u)
    tierra = tierra_modelo & ~np.isfinite(chl)
    costa = cerca_de(tierra_modelo, lats, paso, cfg["costa_km"]) & ~tierra
    obs = np.ones_like(chl) if observado is None else np.nan_to_num(observado, nan=0.0)
    nubes = np.isfinite(chl) & ~costa & (obs < cfg["min_observado"])
    chl_ok = np.isfinite(chl) & (chl > 0) & ~costa & ~nubes
    with np.errstate(divide="ignore", invalid="ignore"):
        lchl = np.where(chl_ok, np.log10(np.where(chl_ok, chl, 1)), np.nan)
    g_chl = sobel_km(mediana3(lchl), lats, paso)
    g_t = sobel_km(mediana3(temp), lats, paso)
    conv = convergencia_f(u, v, lats, paso)
    with np.errstate(invalid="ignore"):
        f_chl = np.nan_to_num(g_chl) >= cfg["umbral_chl_log10_km"]
        f_t = np.nan_to_num(g_t) >= cfg["umbral_temp_c_km"]
        f_conv = np.nan_to_num(conv) >= cfg["umbral_convergencia_f"]
    b1, b2 = cfg["niveles_chl"]
    nivel = np.where(~chl_ok, 0, np.where(chl < b1, 1, np.where(chl < b2, 2, 3))).astype(np.uint8)
    cod = (f_chl * BIT["frente_clorofila"] + f_t * BIT["frente_termico"] + f_conv * BIT["convergencia"]
           + (nivel << DESPL_NIVEL) + costa * BIT["costa"] + nubes * BIT["nubes"]).astype(np.uint8)
    cod[tierra] = 255
    mar = ~tierra
    n = max(1, int(mar.sum()))
    est = {
        "celdas_mar": int(mar.sum()),
        "pct_frente_clorofila": round(100 * float((f_chl & mar).sum()) / n, 2),
        "pct_frente_termico": round(100 * float((f_t & mar).sum()) / n, 2),
        "pct_ambos": round(100 * float((f_chl & f_t & mar).sum()) / n, 2),
        "pct_convergencia": round(100 * float((f_conv & mar).sum()) / n, 2),
        "pct_nubes": round(100 * float(nubes.sum()) / n, 2),
        "pct_costa": round(100 * float(costa.sum()) / n, 2),
    }
    return cod, est


def byte_corriente(x, escala):
    """Componente con signo (m/s) -> byte (127 = 0; 255 = sin dato)."""
    x = np.asarray(x, dtype=np.float64)
    b = np.full(x.shape, 255, dtype=np.uint8)
    ok = np.isfinite(x)
    b[ok] = np.clip(np.rint(x[ok] / escala) + 127, 0, 254).astype(np.uint8)
    return b


def bytes_velocidad(u, v, escala):
    """Fuerza de la corriente (m/s) en la malla entera -> un byte por celda
    (escala m/s por unidad, 0-254; 255 = tierra o sin dato). La usan la capa
    🌊 Corriente (manchas, en frentes.json) y el histórico del aprendizaje."""
    vel = np.hypot(u, v)
    b = np.full(vel.shape, 255, dtype=np.uint8)
    ok = np.isfinite(vel)
    b[ok] = np.clip(np.rint(vel[ok] / escala), 0, 254).astype(np.uint8)
    return b


def bloques(a, k):
    """Media de bloques k x k ignorando NaN (para las flechas)."""
    import warnings
    f, c = a.shape
    f2, c2 = f // k, c // k
    x = a[:f2 * k, :c2 * k].reshape(f2, k, c2, k)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)
        return np.nanmean(x, axis=(1, 3))


def salida_frentes(fechas, cod, u, v, est, sin_mascara_nubes, cfg=FRENTES):
    filas, cols = cod.shape
    k = cfg["flechas_cada"]
    ub, vb = bloques(u, k), bloques(v, k)
    esc = cfg["escala_corriente_ms"]
    return {
        "v": 1,
        "capa": "frentes",
        "fecha": fechas["corriente"],
        "fecha_clorofila": fechas["clorofila"],
        "fecha_temperatura": fechas["temperatura"],
        "generado_en": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "atribucion": ATRIBUCION,
        "doi": CAPAS["clorofila"]["doi"],
        "dois": [CAPAS["clorofila"]["doi"], CORRIENTE["doi"]],
        "datasets": [CAPAS["clorofila"]["dataset"], CAPAS["temperatura-agua"]["dataset"], CORRIENTE["dataset"]],
        **CAJA,
        "paso": cfg["paso"],
        "filas": filas,
        "columnas": cols,
        "umbrales": {k2: cfg[k2] for k2 in ("umbral_chl_log10_km", "umbral_temp_c_km", "umbral_convergencia_f", "costa_km", "min_observado", "niveles_chl")},
        "bits": {**BIT, "nivel_desplazamiento": DESPL_NIVEL},
        "nubes": "sin_mascara" if sin_mascara_nubes else "flags",
        "estadisticas": est,
        "datos": base64.b64encode(cod.tobytes()).decode("ascii"),
        "corriente": {
            "paso": cfg["paso"] * k, "filas": ub.shape[0], "columnas": ub.shape[1], "escala_ms": esc,
            "u": base64.b64encode(byte_corriente(ub, esc).tobytes()).decode("ascii"),
            "v": base64.b64encode(byte_corriente(vb, esc).tobytes()).decode("ascii"),
            # 🌊 Corriente (2026-10-09): fuerza en la malla de los códigos
            # (1/18°, misma paso/filas/columnas que "datos"), para pintar las
            # manchas con más detalle que las flechas. ~+40 kB con compresión.
            "escala_velocidad_ms": esc,
            "velocidad": base64.b64encode(bytes_velocidad(u, v, esc).tobytes()).decode("ascii"),
        },
    }


def historico_frentes(j, u, v, cfg=FRENTES):
    """Copia diaria compacta para el aprendizaje semanal (zlib + base64):
    códigos y velocidad de la corriente en la malla entera. ~50-80 kB/día."""
    import zlib
    b = bytes_velocidad(u, v, cfg["escala_corriente_ms"])
    cod = base64.b64decode(j["datos"])
    h = {k: j[k] for k in ("v", "fecha", "fecha_clorofila", "fecha_temperatura", "generado_en", "norte", "sur", "oeste", "este", "paso", "filas", "columnas", "umbrales", "bits", "nubes", "estadisticas")}
    h["capa"] = "frentes-historico"
    h["escala_velocidad_ms"] = cfg["escala_corriente_ms"]
    h["codigos_zlib"] = base64.b64encode(zlib.compress(cod, 9)).decode("ascii")
    h["velocidad_zlib"] = base64.b64encode(zlib.compress(b.tobytes(), 9)).decode("ascii")
    return h


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--salida", required=True)
    ap.add_argument("--prueba", action="store_true")
    a = ap.parse_args()
    if not a.prueba and not (os.environ.get("COPERNICUSMARINE_SERVICE_USERNAME") and os.environ.get("COPERNICUSMARINE_SERVICE_PASSWORD")):
        print("::error::Faltan COPERNICUSMARINE_SERVICE_USERNAME / _PASSWORD (cuenta gratuita de Copernicus Marine)")
        raise SystemExit(1)
    os.makedirs(os.path.join(a.salida, "capas", "historico"), exist_ok=True)
    nativos = {}
    for nombre, fuente in (("clorofila", clorofila_real), ("temperatura-agua", temperatura_real)):
        t0 = time.time()
        r = prueba(nombre) if a.prueba else fuente()
        fecha, lats, lons, v = r[:4]
        nativos[nombre] = r
        media = rejilla(lats, lons, v, CAPAS[nombre]["paso"], log=CAPAS[nombre]["escala"]["tipo"] == "log10")
        j = salida_capa(nombre, fecha, media)
        j["prueba"] = bool(a.prueba)
        ruta = os.path.join(a.salida, "capas", f"{nombre}.json")
        with open(ruta, "w", encoding="utf-8") as fh:
            json.dump(j, fh, separators=(",", ":"))
        con_dato = float(np.isfinite(media).mean())
        print(f"capa {nombre}: {fecha}, {j['filas']}x{j['columnas']}, {con_dato:.0%} con dato, "
              f"{os.path.getsize(ruta) / 1e3:.0f} kB, {time.time() - t0:.0f} s")

    # Frentes y corrientes: si fallan, las dos capas de arriba ya están
    # escritas (el workflow las sube igual) y el paso sale en rojo.
    try:
        t0 = time.time()
        paso = FRENTES["paso"]
        fc, la, lo, chl_n, obs_n = nativos["clorofila"]
        ft, lat_t, lon_t, t_n = nativos["temperatura-agua"]
        fu, lat_u, lon_u, u_n, v_n = prueba("corrientes") if a.prueba else corrientes_real()
        chl = rejilla(la, lo, chl_n, paso, log=True)
        obs = None if obs_n is None else rejilla(la, lo, obs_n, paso)
        temp = rejilla(lat_t, lon_t, t_n, paso)
        u = rejilla(lat_u, lon_u, u_n, paso)
        v = rejilla(lat_u, lon_u, v_n, paso)
        filas = chl.shape[0]
        lats = CAJA["norte"] - (np.arange(filas) + 0.5) * paso
        cod, est = calcular_frentes(chl, obs, temp, u, v, lats)
        j = salida_frentes({"clorofila": fc, "temperatura": ft, "corriente": fu}, cod, u, v, est, obs is None)
        j["prueba"] = bool(a.prueba)
        ruta = os.path.join(a.salida, "capas", "frentes.json")
        with open(ruta, "w", encoding="utf-8") as fh:
            json.dump(j, fh, separators=(",", ":"))
        h = historico_frentes(j, u, v)
        ruta_h = os.path.join(a.salida, "capas", "historico", f"frentes-{fu}.json")
        with open(ruta_h, "w", encoding="utf-8") as fh:
            json.dump(h, fh, separators=(",", ":"))
        print(f"capa frentes: {fu} (clorofila {fc}), {j['filas']}x{j['columnas']}, {est}, "
              f"{os.path.getsize(ruta) / 1e3:.0f} kB + histórico {os.path.getsize(ruta_h) / 1e3:.0f} kB, {time.time() - t0:.0f} s")
        if est["pct_frente_clorofila"] > 25 or est["pct_frente_termico"] > 25:
            print("::warning::frentes: más del 25 % del mar sale como frente; revisar los umbrales (CLAUDE.md, capas)")
    except SystemExit:
        raise
    except Exception as e:  # noqa: BLE001
        print(f"::error::frentes: {e}")
        raise SystemExit(1)


if __name__ == "__main__":
    main()
