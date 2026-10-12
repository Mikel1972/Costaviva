# scripts/fuentes/tierra-osm.py
# Polígonos de tierra para recortar las capas del mar (2026-10-12, Mikel: "al
# poner la capa de temperatura, la tierra queda detrás de la capa"). Sin IA.
#
# Fuente: OpenStreetMap land polygons simplificados de osmdata.openstreetmap.de
# (simplified-land-polygons-complete-3857.zip, ~24 MB), © OpenStreetMap
# contributors, ODbL (la misma atribución que ya lleva el mapa base).
# Se recortan a la caja de las capas del mar de cada región (es: 26..46 N,
# -19..5; nz: 54..28 S, 162..186 E, con lo que pasa del 180 desplazado +360),
# se simplifican y se escriben en assets/datos/tierra/<región>.geojson.
#
# Uso (necesita pyshp y shapely):
#   curl -O https://osmdata.openstreetmap.de/download/simplified-land-polygons-complete-3857.zip && unzip ...
#   python3 scripts/fuentes/tierra-osm.py <dir_con_pyshp_y_shapely> <simplified_land_polygons.shp> 0.003
#   (escribe tierra-es.geojson y tierra-nz.geojson en el directorio actual)
import sys, json, math
sys.path.insert(0, sys.argv[1])
import shapefile
from shapely.geometry import shape, box, mapping
from shapely.ops import transform, unary_union
from shapely import set_precision
R = 6378137.0
def inv(x, y, z=None):
    lon = x / R * 180 / math.pi
    lat = (2 * math.atan(math.exp(y / R)) - math.pi / 2) * 180 / math.pi
    return lon, lat
CAJAS = {"es": (26, 46, -19, 5), "nz": (-54, -28, 162, 186)}
TOL = float(sys.argv[3])
sf = shapefile.Reader(sys.argv[2])
partes = {k: [] for k in CAJAS}
for sr in sf.iterShapeRecords():
    xmin, ymin, xmax, ymax = sr.shape.bbox
    lo0, la0 = inv(xmin, ymin); lo1, la1 = inv(xmax, ymax)
    for k, (s, n, o, e) in CAJAS.items():
        for d in ((0, 360) if k == "nz" else (0,)):
            if la1 < s or la0 > n or lo1 + d < o or lo0 + d > e: continue
            g = transform(lambda x, y, z=None: tuple(v + (d if i == 0 else 0) for i, v in enumerate(inv(x, y))), shape(sr.shape.__geo_interface__))
            g = g.intersection(box(o, s, e, n))
            if not g.is_empty: partes[k].append(g)
for k, gs in partes.items():
    u = unary_union(gs).simplify(TOL, preserve_topology=True)
    u = set_precision(u, 0.0005)
    polys = [p for p in (u.geoms if hasattr(u, "geoms") else [u]) if p.geom_type == "Polygon" and not p.is_empty]
    coords = [[[ [round(x, 4), round(y, 4)] for x, y in ring.coords] for ring in [p.exterior, *p.interiors]] for p in polys]
    out = {"type": "FeatureCollection", "region": k, "fuente": "OpenStreetMap land polygons (osmdata.openstreetmap.de, simplified)", "atribucion": "© OpenStreetMap contributors (ODbL)", "simplificado_grados": TOL,
           "features": [{"type": "Feature", "properties": {}, "geometry": {"type": "MultiPolygon", "coordinates": coords}}]}
    t = json.dumps(out, separators=(",", ":"))
    open(f"tierra-{k}.geojson", "w").write(t + "\n")
    print(k, len(polys), "polígonos", len(t) // 1024, "KB")
