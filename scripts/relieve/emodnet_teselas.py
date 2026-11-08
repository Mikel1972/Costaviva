#!/usr/bin/env python3
"""Teselas de relieve (formato terrarium) de EMODnet Bathymetry para la vista 3D.

2026-11-08, Mikel: "haz lo de EMODnet para el fondo". Las Terrain Tiles de
AWS solo traen batimetría gruesa (ETOPO) y hasta zoom 10; EMODnet DTM 2024
(CC BY 4.0) da el fondo del mar y la tierra cada ~115 m en aguas europeas,
Canarias, Madeira y Azores incluidas.

Sin IA y una sola vez (o cuando EMODnet publique un DTM nuevo): lo lanza
relieve-emodnet.yml a mano.
  1. Descarga por WCS (GeoTIFF float32, 1/960 de grado) trozos de 2° x 2° de
     cada zona de ZONAS.
  2. Para cada tesela de zoom ZOOM_MIN..ZOOM_MAX que toca la zona, muestrea
     la altura (bilineal) en cada píxel en Web Mercator y la codifica en
     terrarium (alto + 32768 = R*256 + G + B/256). Donde EMODnet no tiene
     dato (fuera de la zona o sin cobertura), la tesela de AWS de ese mismo
     sitio.
  3. Las deja en <salida>/<z>/<x>/<y>.png para subirlas al bucket público.

Uso: python3 emodnet_teselas.py <salida> [zona ...]
Lo puro (codificar, coordenadas de tesela) se prueba en test/relieve-emodnet.test.js
(misma fórmula en assets/js/vista-3d.js).
"""
import io
import math
import os
import sys
import urllib.request

import numpy as np
import tifffile
from PIL import Image

WCS = ("https://ows.emodnet-bathymetry.eu/wcs?service=WCS&version=2.0.1&request=GetCoverage"
       "&coverageId=emodnet__mean&format=image/tiff&subset=Lat({s},{n})&subset=Long({o},{e})")
AWS = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"
UA = {"User-Agent": "Costaviva-relieve/1.0 (+https://costaviva.org)"}

# [sur, oeste, norte, este]. Las mismas en assets/js/vista-3d.js (ZONAS_EMODNET).
ZONAS = {
    "iberia": [35.0, -10.5, 46.5, 5.0],
    "canarias": [27.4, -18.5, 29.6, -13.2],
    "madeira": [32.3, -17.4, 33.2, -16.2],
    "azores": [36.8, -31.5, 39.8, -24.8],
}
ZOOM_MIN, ZOOM_MAX = 5, 10
TROZO = 2.0


def baja(url):
    for intento in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=180) as r:
                return r.read()
        except Exception as e:  # red: se reintenta
            if intento == 3:
                raise
            print(f"  reintento {intento + 1}: {e}", flush=True)


def trozo_emodnet(s, o, n, e):
    """GeoTIFF de EMODnet -> (array, lon0, lat0, paso). PixelIsArea, esquina NO."""
    tif = tifffile.TiffFile(io.BytesIO(baja(WCS.format(s=s, n=n, o=o, e=e))))
    p = tif.pages[0]
    m = p.tags["ModelTransformationTag"].value
    a = p.asarray().astype(np.float32)
    a[(a < -12000) | (a > 9000)] = np.nan  # sin dato
    return a, m[3], m[7], m[0]


def tesela_lonlat(z, x, y):
    """Longitudes y latitudes de los centros de los 256x256 píxeles."""
    n = 2 ** z
    px = (np.arange(256) + 0.5) / 256
    lon = (x + px) / n * 360 - 180
    lat = np.degrees(np.arctan(np.sinh(math.pi * (1 - 2 * (y + px) / n))))
    return np.meshgrid(lon, lat)


def teselas_de(zona, z):
    s, o, n, e = zona
    k = 2 ** z
    x0, x1 = int((o + 180) / 360 * k), int((e + 180) / 360 * k)
    fy = lambda la: int((1 - math.asinh(math.tan(math.radians(la))) / math.pi) / 2 * k)
    return [(x, y) for x in range(x0, x1 + 1) for y in range(fy(n), fy(s) + 1)]


def terrarium(alto):
    # Al metro: el canal azul (decimales) queda a 0 y el PNG pesa ~4 veces menos.
    v = np.clip(np.round(np.nan_to_num(alto, nan=0.0)), -32768, 32767) + 32768
    r = np.floor(v / 256)
    g = np.floor(v - r * 256)
    b = np.floor((v - np.floor(v)) * 256)
    return np.dstack([r, g, b]).astype(np.uint8)


def desde_terrarium(rgb):
    rgb = rgb.astype(np.float64)
    return rgb[..., 0] * 256 + rgb[..., 1] + rgb[..., 2] / 256 - 32768


def muestrear(trozos, lon, lat):
    alto = np.full(lon.shape, np.nan, dtype=np.float32)
    for a, lon0, lat0, paso in trozos:
        c = (lon - lon0) / paso - 0.5
        f = (lat0 - lat) / paso - 0.5
        dentro = (c >= 0) & (f >= 0) & (c <= a.shape[1] - 1) & (f <= a.shape[0] - 1) & np.isnan(alto)
        if not dentro.any():
            continue
        cc, ff = c[dentro], f[dentro]
        c0, f0 = np.floor(cc).astype(int), np.floor(ff).astype(int)
        c1, f1 = np.minimum(c0 + 1, a.shape[1] - 1), np.minimum(f0 + 1, a.shape[0] - 1)
        dc, df = cc - c0, ff - f0
        v = (a[f0, c0] * (1 - dc) * (1 - df) + a[f0, c1] * dc * (1 - df)
             + a[f1, c0] * (1 - dc) * df + a[f1, c1] * dc * df)
        alto[dentro] = v
    return alto


def main():
    salida = sys.argv[1]
    nombres = sys.argv[2:] or list(ZONAS)
    hechas = set()
    for nombre in nombres:
        s, o, n, e = ZONAS[nombre]
        trozos = []
        la = s
        while la < n:
            lo = o
            while lo < e:
                print(f"{nombre}: EMODnet {la:.1f},{lo:.1f}", flush=True)
                trozos.append(trozo_emodnet(la, lo, min(la + TROZO, n), min(lo + TROZO, e)))
                lo += TROZO
            la += TROZO
        for z in range(ZOOM_MIN, ZOOM_MAX + 1):
            lista = [t for t in teselas_de(ZONAS[nombre], z) if (z, *t) not in hechas]
            print(f"{nombre}: zoom {z}, {len(lista)} teselas", flush=True)
            for x, y in lista:
                lon, lat = tesela_lonlat(z, x, y)
                alto = muestrear(trozos, lon, lat)
                if np.isnan(alto).any():
                    try:
                        aws = desde_terrarium(np.asarray(Image.open(io.BytesIO(baja(AWS.format(z=z, x=x, y=y)))).convert("RGB")))
                        alto = np.where(np.isnan(alto), aws, alto)
                    except Exception as ex:
                        print(f"  AWS {z}/{x}/{y}: {ex}", flush=True)
                d = os.path.join(salida, str(z), str(x))
                os.makedirs(d, exist_ok=True)
                Image.fromarray(terrarium(alto)).save(os.path.join(d, f"{y}.png"), optimize=True)
                hechas.add((z, x, y))
        del trozos
    print(f"Hechas {len(hechas)} teselas en {salida}")


if __name__ == "__main__":
    main()
