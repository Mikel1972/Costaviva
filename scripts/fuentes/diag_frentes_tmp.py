#!/usr/bin/env python3
"""TEMPORAL (se borra antes de fusionar): diagnóstico de 〰 Frentes con datos
reales. No escribe en el bucket: deja un .npz en --salida para el artifact."""
import importlib.util, json, os, sys, traceback
from datetime import datetime, timedelta, timezone
import numpy as np

spec = importlib.util.spec_from_file_location("dc", os.path.join(os.path.dirname(__file__), "descargar-capas.py"))
dc = importlib.util.module_from_spec(spec); spec.loader.exec_module(dc)
salida = sys.argv[1]
os.makedirs(salida, exist_ok=True)
P = dc.FRENTES["paso"]
out = {}
def caja_bizkaia(a, lats_n, lons_n):
    la2, lo2 = np.meshgrid(lats_n, lons_n, indexing="ij")
    return (la2 > 43.3) & (la2 < 46) & (lo2 > -6) & (lo2 < -1)

def info_malla(nombre, lats, lons):
    lats = np.asarray(lats, dtype=np.float64); lons = np.asarray(lons, dtype=np.float64)
    print(f"[{nombre}] lat {lats[0]:.6f}..{lats[-1]:.6f} n={lats.size} paso={np.diff(lats).mean():.7f} (min {np.diff(lats).min():.7f} max {np.diff(lats).max():.7f}) dtype={np.asarray(lats).dtype}")
    print(f"[{nombre}] lon {lons[0]:.6f}..{lons[-1]:.6f} n={lons.size} paso={np.diff(lons).mean():.7f}")
    f = np.floor((dc.CAJA["norte"] - lats) / P).astype(int)
    c = np.floor((lons - dc.CAJA["oeste"]) / P).astype(int)
    nf = np.bincount(f[(f >= 0) & (f < 360)], minlength=360)
    nc = np.bincount(c[(c >= 0) & (c < 432)], minlength=432)
    print(f"[{nombre}] filas nativas por fila de salida: {dict(zip(*np.unique(nf, return_counts=True)))}; columnas: {dict(zip(*np.unique(nc, return_counts=True)))}")
    print(f"[{nombre}] filas de salida con 0 nativas: {np.where(nf == 0)[0][:40].tolist()}")
    print(f"[{nombre}] filas de salida con !=moda: {[(int(i), round(dc.CAJA['norte'] - (i + .5) * P, 3), int(nf[i])) for i in np.where(nf != np.bincount(nf).argmax())[0][:40]]}")

try:
    d = dc.CAPAS["clorofila"]
    hoy = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    ds = dc.abrir(d["dataset"], [d["variable"], "flags"], (hoy - timedelta(days=10)).strftime("%Y-%m-%dT00:00:00"), hoy.strftime("%Y-%m-%dT00:00:00"))
    print("flags attrs:", dict(ds["flags"].attrs))
    print("CHL attrs:", {k: v for k, v in ds["CHL"].attrs.items() if k in ("units", "long_name")})
    tiempos = ds["time"].values
    print("tiempos:", [str(np.datetime_as_string(t, unit="D")) for t in tiempos])
    lats_c = ds["latitude"].values; lons_c = ds["longitude"].values
    info_malla("clorofila", lats_c, lons_c)
    mb = caja_bizkaia(None, lats_c, lons_c)
    dias = []
    for t in tiempos[::-1][:7]:
        fe = str(np.datetime_as_string(t, unit="D"))
        v = dc.superficie(ds["CHL"]).sel(time=t).load().values
        fl = dc.superficie(ds["flags"]).sel(time=t).load().values
        fin = np.isfinite(v)
        fli = np.nan_to_num(fl, nan=-1).astype(np.int64)
        vals, cnt = np.unique(fli[fin], return_counts=True)
        obs = np.where(fin, ((fli & 2) == 0).astype(np.float64), np.nan)
        print(f"[chl {fe}] finito {fin.mean():.3f}; valores de flags en mar: {dict(zip(vals.tolist()[:20], cnt.tolist()[:20]))}; observado mar {np.nanmean(obs):.3f}; observado Bizkaia {np.nanmean(np.where(mb, obs, np.nan)):.3f}")
        if fin.mean() <= 0.2:
            continue
        out[f"chl_{fe}"] = dc.rejilla(lats_c, lons_c, v, P, log=True).astype(np.float32)
        out[f"obs_{fe}"] = dc.rejilla(lats_c, lons_c, obs, P).astype(np.float32)
        dias.append(fe)
    out["dias_chl"] = np.array(dias)
except Exception:
    traceback.print_exc()

def temp(dataset, var, hora):
    hoy = datetime.now(timezone.utc).replace(hour=hora, minute=0, second=0, microsecond=0)
    s = hoy.strftime("%Y-%m-%dT%H:%M:%S")
    ds = dc.abrir(dataset, var, s, s)
    print(f"[{dataset}] dims {dict(ds.sizes)}")
    da = dc.superficie(ds[var]).isel(time=0).load()
    info_malla(dataset, da["latitude"].values, da["longitude"].values)
    return da["latitude"].values, da["longitude"].values, da.values

for nombre, dataset, var, hora in (
    ("t12", "cmems_mod_ibi_phy_anfc_0.027deg-2D_PT1H-m", "thetao", 12),
    ("t03", "cmems_mod_ibi_phy_anfc_0.027deg-2D_PT1H-m", "thetao", 3),
    ("tdia", "cmems_mod_ibi_phy-temp_anfc_0.027deg-3D_P1D-m", "thetao", 0),
    ("tdia_b", "cmems_mod_ibi_phy_anfc_0.027deg-3D_P1D-m", "thetao", 0),
):
    try:
        la, lo, v = temp(dataset, var, hora)
        out[nombre] = dc.rejilla(la, lo, v, P).astype(np.float32)
        mb = caja_bizkaia(None, la, lo)
        print(f"[{nombre}] finito {np.isfinite(v).mean():.3f}")
    except Exception as e:
        print(f"[{nombre}] {dataset}: {type(e).__name__}: {str(e)[:300]}")
try:
    fu, la, lo, u, v = dc.corrientes_real()
    info_malla("corriente", la, lo)
    out["u"] = dc.rejilla(la, lo, u, P).astype(np.float32)
    out["v"] = dc.rejilla(la, lo, v, P).astype(np.float32)
except Exception:
    traceback.print_exc()
np.savez_compressed(os.path.join(salida, "frentes-diag.npz"), **out)
print("claves:", list(out))
