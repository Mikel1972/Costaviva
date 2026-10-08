# Observaciones abiertas (GBIF / iNaturalist)

Lo rellena `.github/workflows/observaciones.yml` (semanal, sin IA) con
`scripts/observaciones/descargar.mjs`. Para qué: **validar el índice de pesca**
con observaciones reales (especie, fecha, hora, sitio) cruzadas con las
condiciones de mar de ese momento. No se muestra nada de esto en la app.

## Ficheros

| Fichero | Contenido | Uso |
|---|---|---|
| `comercial/AAAA.json` | Registros CC0 y CC BY | Se pueden usar en Costaviva. Los CC BY, con atribución (`autor` + conjunto de datos). |
| `no-comercial/AAAA.json` | Registros CC BY-NC | **Solo referencia interna.** Nunca en la app ni en nada que se venda, tampoco para calibrar el índice (es parte del producto de pago). |
| `ATRIBUCION.md` | Conjuntos de datos, publicadores, licencias y DOI | Atribución exigida por las licencias y por el acuerdo de GBIF. |
| `recuento.json` | Cuántos registros había en GBIF y cuántos se guardaron, por especie | Control. |

Se descartan: sin licencia (todos los derechos reservados) y cualquier -ND.

Campos de cada fila: `id` (`gbif:<gbifID>`), `src` (`inat`/`gbif`), `ds`
(datasetKey), `e` (id de especie en `especies.json`), `sci`, `f` (fecha UTC),
`h` (hora UTC o `null` si la fuente no da hora con zona), `lat`/`lon`, `oc`
(posición ocultada), `inc_km`, `spot` y `km` (spot más cercano, máx. 25 km),
`reg`, `base` (basisOfRecord), `lic`, `autor` (solo si la licencia exige
atribución), `url` (observación de iNaturalist) y `c` (condiciones: oleaje,
periodo, temperatura del agua, presión y su tendencia de 3 h, viento, etc.,
con `fuente`).

## Privacidad de los observadores

- **Coordenadas ocultadas nunca se afinan.** iNaturalist oculta la posición de
  taxones amenazados y la de quien lo pide (en GBIF llega como
  `informationWithheld: "Coordinate uncertainty increased to 27661m to protect
  threatened taxon"`; pasa, por ejemplo, con la lubina en parte del
  Mediterráneo). Esas filas se guardan con `oc: true` y redondeadas a 0,2°
  (≈ 20 km), no a más precisión. No se cruza con otras fuentes para intentar
  recuperar el punto real.
- Las demás se guardan a 0,01° (≈ 1 km): basta para casarlas con un spot.
- El nombre del observador solo se guarda cuando la licencia obliga a citarlo
  (CC BY, CC BY-NC), tal como lo publica GBIF (`rightsHolder`).

## Condiciones de uso comprobadas (2026-10-08)

- **API de iNaturalist** (cabecera de
  https://api.inaturalist.org/v1/swagger.json): "The API is intended to
  support application development, not data scraping. For pre-generated data
  exports, see https://www.inaturalist.org/pages/developers"; "we throttle API
  usage to a max of 100 requests per minute, though we ask that you try to keep
  it to 60 requests per minute or lower, and to keep under 10,000 requests per
  day". **Por eso las observaciones de iNaturalist se toman de GBIF** (conjunto
  "iNaturalist Research-grade Observations", doi:10.15468/ab3s5x), que es su
  exportación oficial, y no de su API. Esa exportación solo incluye registros
  CC0, CC BY y CC BY-NC (los CC BY-SA y los "todos los derechos reservados" no
  llegan a GBIF). Las páginas de www.inaturalist.org devuelven un reto de
  Cloudflare a peticiones automáticas: no se rascan.
- **API de GBIF** (https://techdocs.gbif.org/en/openapi/, apartado "Rate
  limits"): "we highly recommend you set the HTTP User-Agent to a URL or email
  address"; "Rapid or numerous queries to search APIs may be rate limited ...
  you will receive an HTTP 429 error, and you should reduce your query rate or
  use the download API"; "If a script will take more than 15 minutes using the
  occurrence search APIs it will be usually be faster ... to request a
  download instead"; "Scripted use of www.GBIF.org, including scraping ... may
  be blocked". El script: User-Agent con contacto (`OBSERVACIONES_CONTACTO` o
  `METNO_CONTACTO`), una petición cada ~0,4 s, se para ante un 429, nunca toca
  www.gbif.org. La pasada semanal (2 años) tarda ~1-2 min. La carga inicial de
  muchos años puede acercarse a los 15 min: si pasa de ahí, hacerla con la API
  de descargas (necesita cuenta de GBIF, y da además un DOI para citar).
- **Acuerdo de usuario de datos de GBIF** (https://www.gbif.org/terms/data-user;
  la web de GBIF bloquea la lectura automática, citado del curso oficial
  https://docs.gbif.org/course-introduction-to-gbif/en/data-publisher-visibility-and-recognition.html):
  "Users must comply with the terms and conditions included in the licence
  selected by each Data Publisher"; "the identifier of ownership of data must
  be retained with every data record shared onward for reuse"; "Users must
  publicly acknowledge, following the scientific convention of citing
  sources". Aquí: cada fila conserva `id` (gbifID), `ds` y `lic`, y
  `ATRIBUCION.md` lista los conjuntos.
- **Licencias**: CC0 y CC BY 4.0 permiten uso comercial (CC BY con
  atribución). CC BY-NC 4.0 no: "NonCommercial — You may not use the material
  for commercial purposes" (https://creativecommons.org/licenses/by-nc/4.0/).

## Volumen real (2026-10-08)

Pasada de prueba de 2025 (España + Portugal, a ≤ 25 km de un spot): 247
registros comerciales y 3.087 no comerciales. Lo usable comercialmente es
~7 %: casi todo iNaturalist está en CC BY-NC. Detalle por especie en el
informe de la sesión y en `recuento.json`.
