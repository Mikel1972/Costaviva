#!/usr/bin/env python3
"""scripts/oleaje-camaras/boyas-copernicus.py

Últimas medidas de oleaje (Hm0, dirección, periodo de pico) de las boyas del
Cantábrico, Galicia y Portugal desde Copernicus Marine In Situ TAC
(2026-10-08). Es la "verdad de terreno" de la calibración de las cámaras
(scripts/oleaje-camaras/calibracion.mjs). Sin IA.

Producto: INSITU_IBI_PHYBGCWAV_DISCRETE_MYNRT_013_033 (DOI 10.48670/moi-00043),
dataset cmems_obs-ins_ibi_phybgcwav_mynrt_na_irr, carpeta "latest" (un NetCDF
por plataforma y día, se publica con 1-3 h de retraso). Las boyas de Puertos
del Estado (Pasaia II, Bilbao II, Gijón, Langosteira, Bilbao-Vizcaya, Peñas,
Estaca de Bares, Villano, Silleiro) llegan REDISTRIBUIDAS por Copernicus, con
su licencia: la de Copernicus Marine permite uso comercial ("for any
purpose") con atribución "Generated using E.U. Copernicus Marine Service
Information" + DOI (comprobado el 2026-10-08 en
https://marine.copernicus.eu/user-corner/service-commitments-and-licence; el
producto In Situ está en el catálogo principal, no en la lista de productos de
terceros). La API directa de Puertos del Estado (poem.puertos.es) NO está
autorizada para uso comercial: por eso ya no se usa aquí.

Los ficheros "native" se leen por HTTPS del almacenamiento público de
Copernicus (s3.waw3-1.cloudferro.com/mdl-native-03), sin cuenta. Si
Copernicus cambia la ruta, el script deja la boya en null y lo dice en el log
(nunca inventa un valor).

Uso: python boyas-copernicus.py --salida boyas.json [--horas 6]
"""
import argparse
import json
import os
import sys
import tempfile
import urllib.request
from datetime import datetime, timedelta, timezone

BASE = ("https://s3.waw3-1.cloudferro.com/mdl-native-03/native/"
        "INSITU_IBI_PHYBGCWAV_DISCRETE_MYNRT_013_033/"
        "cmems_obs-ins_ibi_phybgcwav_mynrt_na_irr_202311/latest")

# id de plataforma en Copernicus -> nombre y posición (la del propio NetCDF
# manda; esta es solo para el log). Las "coast" son costeras (<100 m), las
# numéricas 6200xxx de Puertos del Estado son exteriores (aguas profundas).
# Desde 2026-10-08 también son las boyas del MAPA de la app (BOYAS de
# functions/prevision.js, campo `copernicus`): las 26 de Puertos del Estado,
# todas redistribuidas en este producto IBI (incluidas las del Mediterráneo
# y Canarias, comprobado una a una con platform_name).
BOYAS = {
    "PasaiaII-coast-buoy": "Pasaia II (costera)",
    "Donostia-buoy": "Donostia (Euskalmet, exterior)",
    "Bilbao-coast-buoy": "Bilbao II (costera)",
    "6200024": "Bilbao-Vizcaya (exterior)",
    "Gijon-coast-buoy": "Gijón (costera)",
    "6200025": "Cabo de Peñas (exterior)",
    "6200082": "Estaca de Bares (exterior)",
    "6201070": "Langosteira II (costera)",
    "6200083": "Villano-Sisargas (exterior)",
    "6200084": "Cabo Silleiro (exterior)",
    "Leixoes-coast-buoy": "Leixões (costera)",
    "6200085": "Golfo de Cádiz (exterior)",
    "Tarifa-coast-buoy": "Tarifa (costera)",
    "6101404": "Algeciras-Pta. Carnero (costera)",
    "Ceuta-coast-buoy": "Ceuta (costera)",
    "Malaga-coast-buoy": "Málaga (costera)",
    "6100198": "Cabo de Gata (exterior)",
    "6100417": "Cabo de Palos (exterior)",
    "6100280": "Tarragona (exterior)",
    "Tarragona-coast-buoy": "Tarragona (costera)",
    "Barcelona-coast-buoy": "Barcelona II (costera)",
    "6100196": "Cabo de Begur (exterior)",
    "6100430": "Dragonera (exterior)",
    "6100197": "Mahón (exterior)",
    "LasPalmas-coast-buoy": "Las Palmas Este (costera)",
    "Tenerife-coast-buoy": "Santa Cruz de Tenerife (costera)",
    "1300130": "Gran Canaria (exterior)",
    "1300131": "Tenerife Sur (exterior)",
}

UA = {"User-Agent": "CostavivaBoyasBot/1.0 (+https://costaviva.org)"}


def descargar(url, destino):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r, open(destino, "wb") as f:
        f.write(r.read())


def serie(nc, var, n):
    import numpy as np
    if var not in nc.variables:
        return [None] * n
    v = nc.variables[var][:]
    a = np.ma.filled(v.astype(float), np.nan)
    if a.ndim > 1:  # (TIME, DEPTH): la medida está en una sola profundidad
        a = np.nanmax(np.where(np.isfinite(a), a, -np.inf), axis=1)
        a[~np.isfinite(a)] = np.nan
    qc_name = var + "_QC"
    if qc_name in nc.variables:
        q = np.ma.filled(nc.variables[qc_name][:].astype(float), np.nan)
        if q.ndim > 1:
            q = np.nanmin(np.where(np.isfinite(q), q, np.inf), axis=1)
        a = np.where(np.isin(q, [1, 2]), a, np.nan)  # 1 bueno, 2 probablemente bueno
    return [None if not np.isfinite(x) else round(float(x), 2) for x in a]


def leer(fichero, horas):
    import netCDF4
    nc = netCDF4.Dataset(fichero)
    t = netCDF4.num2date(nc.variables["TIME"][:], nc.variables["TIME"].units, only_use_cftime_datetimes=False)
    n = len(t)
    hs, dr, tp, te = serie(nc, "VHM0", n), serie(nc, "VMDR", n), serie(nc, "VTPK", n), serie(nc, "TEMP", n)
    lat = float(nc.variables["LATITUDE"][:].mean())
    lon = float(nc.variables["LONGITUDE"][:].mean())
    limite = datetime.now(timezone.utc) - timedelta(hours=horas)
    puntos = []
    for i in range(n):
        ti = t[i].replace(tzinfo=timezone.utc)
        if ti >= limite and hs[i] is not None:
            puntos.append({"hora": ti.isoformat().replace("+00:00", "Z"), "hs": hs[i], "dir": dr[i], "tp": tp[i], "temp": te[i]})
    return {"lat": round(lat, 4), "lon": round(lon, 4), "serie": puntos}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--salida", required=True)
    ap.add_argument("--horas", type=float, default=6)
    args = ap.parse_args()
    hoy = datetime.now(timezone.utc)
    dias = [hoy.strftime("%Y%m%d")]
    if hoy.hour < args.horas + 3:  # de madrugada, la serie empieza en el fichero de ayer
        dias.insert(0, (hoy - timedelta(days=1)).strftime("%Y%m%d"))
    salida = {}
    with tempfile.TemporaryDirectory() as tmp:
        for pid, nombre in BOYAS.items():
            res = {"id": pid, "nombre": nombre, "serie": []}
            for dia in dias:
                f = os.path.join(tmp, f"{pid}_{dia}.nc")
                try:
                    descargar(f"{BASE}/{dia}/IR_TS_MO_{pid}_{dia}.nc", f)
                    d = leer(f, args.horas)
                    res.update(lat=d["lat"], lon=d["lon"])
                    res["serie"] += d["serie"]
                except Exception as e:  # noqa: BLE001 — una boya que falla no tumba las demás
                    print(f"  {pid} {dia}: {e}", file=sys.stderr)
            res["ultima"] = res["serie"][-1] if res["serie"] else None
            salida[pid] = res
            u = res["ultima"]
            print(f"{'✓' if u else '✗'} {nombre}: {u['hs'] if u else '-'} m {u['hora'] if u else ''}")
    salida["generado_en"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    salida["_atribucion"] = "Generated using E.U. Copernicus Marine Service Information; https://doi.org/10.48670/moi-00043"
    with open(args.salida, "w", encoding="utf-8") as f:
        json.dump(salida, f, ensure_ascii=False)
    if not any(isinstance(v, dict) and v.get("ultima") for k, v in salida.items() if not k.startswith("_")):
        print("::warning::Ninguna boya de Copernicus con dato reciente")


if __name__ == "__main__":
    main()
