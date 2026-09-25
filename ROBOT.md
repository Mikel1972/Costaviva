# ROBOT.md — bitácora del robot de datos de Costaviva

Este archivo lo mantiene el robot de investigación/auditoría de datos que
corre en sesiones programadas contra este repo. Cada pasada añade una
entrada fechada en la sección que corresponda — nunca se borra el
historial anterior, solo se añade. Es historial puro: las reglas
estables del robot viven en [`ROBOT_REGLAS.md`](ROBOT_REGLAS.md), léelas
antes de actuar.

---

## Fuentes nuevas

### 2026-08-31

**Bloqueada por red — no se pudo investigar de verdad.** Esta sesión
programada corre en un entorno remoto (Claude Code on the web) cuya
política de red saliente solo permite un conjunto reducido de dominios de
infraestructura (GitHub, npm, PyPI, la propia API de Anthropic). Cualquier
petición directa a un dominio de datos externo — `open-meteo.com`,
`poem.puertos.es`, `aemet.es`, `aa.usno.navy.mil`, o cualquier candidato
nuevo (SAIH, URA, webcams) — es rechazada por el proxy de salida con
`403` antes de llegar al destino. Comprobado con `curl` directo:

```
$ curl -sS -o /dev/null -w "example.com: %{http_code}\n" https://example.com --max-time 10
curl: (56) CONNECT tunnel failed, response 403
example.com: 000
```

Y lo mismo con la herramienta `WebFetch` (que usa su propia ruta de red,
no la del navegador del usuario):

```
WebFetch → https://marine-api.open-meteo.com/...
{"error_type":"EGRESS_BLOCKED","domain":"marine-api.open-meteo.com",
 "message":"Access to marine-api.open-meteo.com is blocked by the
 network egress proxy."}
```

`WebSearch` sí funciona (usa un backend de búsqueda propio de Anthropic,
no la red saliente de la sesión), así que pude buscar candidatos por
título/URL, pero no pude verificarlos con una petición real — y la
instrucción explícita de esta tarea es no dar nada por hecho sin
comprobarlo. Por eso esta pasada no propone ni integra ninguna fuente
nueva: sería violar la norma de "nunca inventar" hacerlo sin haber visto
una respuesta real.

**Candidatos encontrados por búsqueda, sin verificar (pendientes de
comprobar el día que la red lo permita):**
- Caudal de ríos: EAA/URA (Agencia Vasca del Agua) y el SAIH de la
  Diputación Foral de Bizkaia publican estaciones de aforo en tiempo
  real para las cuencas de Lea, Oka, Butroe y Nervión — que son
  justo los ríos que ya están en el mapa con `caudal: null`
  (ver `index.html`, sección RÍOS). No he podido localizar ni probar
  una URL de API concreta y estable esta vez.
- Boyas: `portus.puertos.es/PortusData/rtChart` aparece en varias
  búsquedas como front de gráficos en tiempo real de Puertos del Estado
  (viento, presión, temperatura del agua) para la boya 2136 — podría ser
  una fuente complementaria a la que ya usamos (`poem.puertos.es/portus/
  StationData`), pero no he podido comprobar su forma de respuesta.
- Webcams para Lekeitio, Plentzia y Getxo (que faltan en
  `functions/webcam/[slug].js`): no se ha podido buscar ni verificar
  nada esta pasada.

**Propuesta para el usuario:** para que estas pasadas programadas puedan
cumplir de verdad la norma de "solo datos comprobados con curl/WebFetch",
la política de red saliente del entorno de esta rutina necesita permitir
al menos estos dominios de solo lectura: `open-meteo.com` y
`marine-api.open-meteo.com`, `poem.puertos.es` (y quizá `portus.puertos.es`),
`aemet.es` / `www.aemet.es`, `aa.usno.navy.mil`, y los dominios de
fuentes candidatas que se vayan identificando (Euskadi.eus/URA, SAIH
Bizkaia). Eso se configura en los ajustes de red del entorno de esta
sesión programada (ver la documentación de Claude Code on the web); no es
algo que yo pueda cambiar desde dentro de la sesión.

### 2026-08-31 (segunda pasada, misma fecha)

**La red mejoró respecto a la pasada anterior de hoy, pero sigue siendo
parcial — no es una lista negra fija de este proyecto, es una política de
red del entorno que deja pasar unos dominios y bloquea otros sin patrón
evidente.** Comprobado con `curl` real (dos intentos cada uno, resultado
idéntico ambas veces):

```
$ curl -sS -o /dev/null -w "%{http_code}\n" https://marine-api.open-meteo.com
400   (respuesta real del servidor a GET / sin parámetros — dominio OK)
$ curl -sS -o /dev/null -w "%{http_code}\n" https://poem.puertos.es
200
$ curl -sS -o /dev/null -w "%{http_code}\n" https://aa.usno.navy.mil/api/rstt/oneday?...
200
$ curl -sS -o /dev/null -w "%{http_code}\n" https://pyscada.isurki.com/.../bakio.1.snap.last.thumb.jpeg
200 (764906 bytes, JPEG válido)
$ curl -sS -o /dev/null -w "%{http_code}\n" https://detectia.net/img/webcam-sopelana-azti3.webp
200 (117346 bytes, WebP válido)

$ curl -sS -o /dev/null -w "%{http_code}\n" https://www.aemet.es
curl: (56) CONNECT tunnel failed, response 403   ← bloqueado por el proxy de salida
$ curl -sS -o /dev/null -w "%{http_code}\n" https://www.kostasystem.com
curl: (56) CONNECT tunnel failed, response 403   ← bloqueado (webcam de Mundaka)
$ curl -sS -o /dev/null -w "%{http_code}\n" https://www.euskadi.eus
curl: (56) CONNECT tunnel failed, response 403   ← bloqueado, 3/3 intentos
$ curl -sS -o /dev/null -w "%{http_code}\n" https://www.uragentzia.euskadi.eus
curl: (56) CONNECT tunnel failed, response 403   ← bloqueado
$ curl -sS -o /dev/null -w "%{http_code}\n" https://opendata.euskadi.eus
curl: (56) CONNECT tunnel failed, response 403   ← bloqueado
$ curl -sS -o /dev/null -w "%{http_code}\n" https://www.webcamtaxi.com
curl: (56) CONNECT tunnel failed, response 403   ← bloqueado
```

**Fuentes candidatas encontradas por WebSearch pero SIN verificar** (el
dominio está bloqueado desde este entorno, así que no se pueden integrar
sin violar la norma de "nunca dar nada por hecho sin comprobarlo"):
- **Caudal de ríos — Agencia Vasca del Agua (URA)**: existe una página
  "Datos de estaciones de aforo" en `uragentzia.euskadi.eus` y un catálogo
  de APIs REST en `opendata.euskadi.eus` (Open Data Euskadi), que según
  los resultados de búsqueda sí publica datos de calidad/cantidad de agua
  en JSON. Encajaría bien con los ríos que ya están en el mapa con
  `caudal: null` (Lea, Oka, Butroe, Nervión...) — pero todo el dominio
  `*.euskadi.eus` está bloqueado desde aquí, así que no he podido ver una
  URL de endpoint real ni la forma de su JSON. Sigue pendiente.
- **Webcam de Lekeitio**: varios agregadores turísticos (Webcamtaxi,
  SkylineWebcams, Worldcam, "Turismo Live") dicen tener cámara del puerto
  de Lekeitio, pero (a) todos esos dominios están bloqueados desde aquí
  para comprobar si sirven una imagen estática hotlinkable o solo un
  reproductor de vídeo con DRM/token, y (b) el patrón que usa este
  proyecto (`functions/webcam/[slug].js`) necesita una URL de imagen
  directa, no un iframe de terceros — habría que confirmarlo antes de
  integrar nada.
- **Webcam de Plentzia**: igual — varios sitios (surf30.net,
  camarastrafico.com.es, escueladesurfsopelana.com) la mencionan, mismo
  problema de dominios bloqueados para comprobar la URL directa.
- Getxo: no salió ningún candidato claro en esta búsqueda.

**No se integra nada nuevo esta pasada** porque ningún candidato pasó la
prueba de "URL comprobada con una petición real" — es la misma norma que
ya se aplicó la pasada anterior, solo que ahora la razón es un bloqueo
por dominio concreto, no un bloqueo total de la red.

**Propuesta actualizada para el usuario:** para poder cerrar caudal de
ríos y las webcams que faltan, la política de red de este entorno
necesitaría permitir además `*.euskadi.eus` (o al menos
`uragentzia.euskadi.eus` y `opendata.euskadi.eus`) y, si se quiere
comprobar hotlinking de imagen directa, los dominios concretos de
cualquier candidato de webcam que se decida investigar (no una lista
genérica de agregadores turísticos, que cambian). El resto de fuentes ya
integradas (Open-Meteo, Puertos del Estado, USNO) sí son alcanzables
ahora mismo.

### 2026-08-31 (tercera pasada, misma fecha)

**La red hoy es sensiblemente mejor que en las dos pasadas anteriores del
mismo día** — incluso `www.aemet.es` y `*.euskadi.eus` responden ahora
(`301`, redirección real, no bloqueo). Aun así, dos dominios concretos que
hacían falta para cerrar los candidatos más prometedores siguen bloqueados.
Nada se integra esta pasada porque ningún candidato completó la
verificación de extremo a extremo, pero hay dos pistas concretas y
accionables que no había antes:

- **Caudal de ríos — visor oficial de URA localizado y parcialmente
  verificado.** La página informativa
  (`https://www.uragentzia.euskadi.eus/datos-de-estaciones-de-aforo/webura00-contents/es/`,
  HTTP 200) enlaza al visor real:
  `https://www.uragentzia.euskadi.eus/visor-de-estaciones-de-aforo/webura00-minima/es/`
  (comprobado con `curl`, HTTP 200). Ese visor carga un `<iframe>` con un
  Esri ArcGIS Web AppBuilder:
  `https://www.geo.euskadi.eus/geoestudioa/apps/webappviewer/index.html?id=405399e081f040efb36a9548b2c88db4`
  — que es donde vive el Feature Service/Map Service REST con los datos
  reales de caudal. Pero tanto `geo.euskadi.eus`/`www.geo.euskadi.eus`
  como `services.arcgis.com` están bloqueados por el proxy de salida
  (`curl: (56) CONNECT tunnel failed, response 403`, comprobado 2 veces
  cada uno; lo mismo con `WebFetch`: `EGRESS_BLOCKED`). Es decir, el
  dominio "informativo" pasa pero el dominio donde vive el dato en sí
  sigue sin ser alcanzable — no se puede ver la forma del JSON ni
  confirmar qué ríos concretos cubre (Lea, Oka, Butroe, Nervión), así que
  no se integra nada todavía.
- **Boyas costeras más cercanas — red de Euskalmet identificada.**
  Euskalmet (Agencia Vasca de Meteorología) mantiene boyas propias en
  Bilbao, Bermeo, Ondarroa, Getaria, Pasaia y Hondarribia — mucho más
  cerca de los spots del mapa que las boyas de Puertos del Estado que ya
  usamos (2136 Bilbao-Vizcaya está mar adentro). Una boya en Bermeo u
  Ondarroa sería un dato de calibración más relevante para
  Bakio/Mundaka/Lekeitio que la boya actual. Están expuestas vía la API
  REST de Open Data Euskadi (`opendata.euskadi.eus`, alcanzable, HTTP
  200), pero **piden API key** — hay que registrarse en
  `https://api.euskadi.eus/opendata-apikey/` (o contactar con
  `opendata@euskadi.eus`, según su propia documentación). Esto no es algo
  que el robot pueda hacer solo — necesita que el usuario registre una
  cuenta/API key. Queda como propuesta, no como código.
- **Aviso de mantenimiento sobre la boya que ya usamos.** De paso se ha
  visto que `poem.puertos.es` ahora sirve una Swagger UI oficial
  (`https://poem.puertos.es` → HTML con `<title>POEM</title>` y
  `swagger-ui`) que exige login OAuth (`identidadmf.puertos.es`) para ver
  la documentación/API soportada. El endpoint que usa nuestro código,
  `/portus/StationData`, **sigue funcionando sin login** (confirmado con
  `curl`, ver auditoría de hoy) pero no está claro si es parte de la API
  nueva y soportada o un endpoint legado que podría dejar de funcionar sin
  aviso. No es una acción para hoy, solo una nota de riesgo a vigilar en
  próximas auditorías.
- **Webcams Lekeitio/Plentzia/Getxo — sigue sin resolverse.** La mayoría de
  dominios candidatos (`skylinewebcams.com`, `webcamtaxi.com`,
  `camaramar.com`, `camarasdgt.es`, `camarastrafico.com.es`,
  `meteosurfcanarias.com`, `surf30.net`, `eitb.eus`, `getxo.eus`,
  `urlekeitio.com`) siguen bloqueados o devuelven `403` directo.
  `es.windfinder.com` sí es alcanzable (HTTP 200) y tiene una página de
  webcam de Lekeitio, pero es una SPA renderizada en cliente — el HTML
  crudo que devuelve `curl` no contiene ninguna URL de imagen directa
  (`.jpg`/`.webp`), solo assets de la propia web. No sirve para el patrón
  de `functions/webcam/[slug].js` (necesita una URL de imagen hotlinkable,
  no una app de JS). Nada nuevo que integrar.

**Propuesta para el usuario:** dos acciones concretas desbloquearían fuentes
reales ya localizadas — (1) permitir `geo.euskadi.eus`/`www.geo.euskadi.eus`
y `services.arcgis.com` en la política de red de este entorno para poder
inspeccionar el Feature Service real de caudal de ríos de URA, y (2)
registrar una API key gratuita de Open Data Euskadi
(`https://api.euskadi.eus/opendata-apikey/`) para poder consultar las boyas
de Euskalmet (Bermeo/Ondarroa/Bilbao), que son más representativas de los
spots que la boya actual de mar abierto.

### 2026-09-07

**`geo.euskadi.eus` y `services.arcgis.com` ya son alcanzables hoy** — la
petición de la pasada anterior (2026-08-31) ya no hace falta, la red de hoy
deja pasar ambos dominios sin problema. Esto permitió completar la
investigación del Feature Service de caudal de ríos de URA que quedó a
medias, con URLs reales comprobadas de principio a fin:

- **Localizado el MapServer real de URA, sin necesidad de API key.**
  Siguiendo la cadena visor→iframe→config de la app ArcGIS Web AppBuilder
  (`https://www.geo.euskadi.eus/geoestudioa/sharing/content/items/
  405399e081f040efb36a9548b2c88db4/data?f=json`, HTTP 200) se llega al
  webmap real (`.../items/801a2792f5e041f8bfcf22d9a962bbcb/data?f=json`,
  HTTP 200), que apunta a la capa
  `https://www.geo.euskadi.eus/geoeuskadi/rest/services/V06GIS/URA_CAS_EUS/MapServer/23`
  ("Estaciones de aforo de aguas superficiales") — un servicio REST público
  de solo lectura, **sin API key**, que responde JSON estándar de ArcGIS.
  Consultado con `.../query?where=1=1&outFields=*&geometry=-3.15,43.1,-2.3,43.5
  &geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects
  &outSR=4326&f=json` (HTTP 200, 80 estaciones reales devueltas con nombre,
  gestor, código URA y coordenadas) en la zona del mapa — cubre justo los
  ríos que ya tenemos con `caudal: null` (Lea, Oka, Butroe, Nervión...):
  ejemplos reales cerca de esos cauces son "Aulestia" (Lea), "Muxika" (Oka),
  "Gatika" (Butroe), "Abusu"/"Areta"/"Sangroniz" (cuenca del Nervión).
- **Por qué NO se integra el dato de caudal en sí todavía — verificado, no
  es apto para "ahora mismo".** Cada estación con datos tiene dos campos
  `Q_MED_DIA`/`Q_DIEZMINU` que no son el número de caudal sino una URL a un
  ZIP (ej. `https://uragentzia.euskadi.eus/.../diezminutales/
  C005_Gatika_Caudal_Diezminutal.zip`, HTTP 200, ~2MB, comprobado
  descargando y descomprimiendo de verdad). Dentro hay un `.dat` con
  formato CSV real por 10 minutos (`FECHA,CAUDAL (m3/s)` —
  `2026-04-01 00:00,1.908`, etc.) — pero el último mes publicado dentro del
  ZIP de hoy es **abril de 2026**, es decir con **~5 meses de retraso**, no
  en tiempo real pese al nombre "diezminutal". Mostrarlo en el mapa como si
  fuera el caudal de "ahora" sería engañoso; mostrarlo con su fecha real
  ("último dato: abril 2026") sería honesto pero de poca utilidad práctica
  para alguien mirando el estado del mar hoy, y descomprimir un ZIP de 2MB
  por estación en una Cloudflare Pages Function sin bundler/librería external
  tampoco es el integración "sencilla" que pide la norma de esta tarea —
  por eso queda como propuesta, no como código.
- **Lo que sí encaja en "bajo riesgo y fácil" pero se deja como propuesta
  por prudencia, no por bloqueo técnico:** las coordenadas y nombres reales
  de las 80 estaciones (sin caudal, solo posición) sí se podrían usar para
  sustituir las posiciones *aproximadas* que tiene hoy `RIOS` en
  `index.html` (la nota de la UI ya dice "posiciones aproximadas, sin datos
  reales todavía") por las posiciones *reales* de estaciones oficiales más
  cercanas a cada río. No lo hago en esta pasada porque emparejar cada
  estación con el río/tramo correcto de nuestro mapa (cabecera/medio/
  desembocadura) a partir del nombre de municipio requiere criterio
  geográfico caso por caso — un error de asociación (asignar una estación
  al río equivocado) sería peor que dejar la posición aproximada actual, y
  la instrucción de esta tarea es no arriesgar una etiqueta "real" que
  pueda estar mal. Quede como tarea concreta para una próxima pasada (o
  para el usuario), con el endpoint ya localizado y verificado arriba.
- **Webcams Lekeitio/Plentzia/Getxo: sigue sin resolverse, mismo motivo que
  pasadas anteriores.** Con la red de hoy pude buscar más candidatos
  (`escueladesurfsopelana.com/plentzia-webcam`, `surfingarage.com`,
  `camaramar.com`) pero los tres dominos siguen bloqueados por el proxy de
  salida (`curl: (56) CONNECT tunnel failed, response 403`, y lo mismo con
  `WebFetch`: `EGRESS_BLOCKED`) — no se puede ver si sirven una imagen
  directa hotlinkable o solo un reproductor de terceros. Nada nuevo que
  integrar.

**Propuesta para el usuario:** (1) confirmar si merece la pena que una
próxima pasada dedique tiempo a emparejar manualmente las estaciones URA
reales (endpoint ya verificado arriba) con cada uno de los 6 ríos del mapa
para al menos mostrar posición real en vez de aproximada (sin caudal,
seguiría en `null`); (2) el caudal en sí, dado el retraso de ~5 meses de los
ZIPs de URA, probablemente no merece la pena mostrarlo con la etiqueta
"ahora" — si se quisiera igualmente, habría que decidir explícitamente
mostrar la fecha real del dato ("último dato: abril 2026") en vez de
disfrazarlo de actual, y valorar si una Cloudflare Function puede
descomprimir ZIP sin dependencias (Workers no traen `unzip` nativo).

### 2026-09-13 22:57 UTC (pasada buscadora — webcams para spots sin cámara)

**Objetivo de la pasada:** buscar cámaras/webcams nuevas para spots que
todavía no tienen ninguna. Primero comprobé qué dominios de webcam son
alcanzables de verdad desde este runner (la egress de estas sesiones es
selectiva, ver 2026-08-31): `meteogalicia.gal` y las de AZTI
(`detectia.net`, `kostasystem.com`) responden `200` con imagen real;
`cantabria.es/ftp_webcam` está **bloqueado** (`HTTP 000`), así que
cualquier cámara del Gobierno de Cantabria (p.ej. Santander/El Sardinero)
no se puede verificar desde aquí y no la propongo sin comprobarla —
regla de "nunca una URL sin verificar".

**Hallazgo real — dos spots que estaban sin cámara desde el principio
ya tienen fuente directa verificada** (Lekeitio y Getxo/Ereaga, ambos en
`SPOTS` de `index.html` sin webcam; ver la nota "sin fuente identificada
todavía" en `functions/webcam/[slug].js` y las pasadas 2026-08-31 y
2026-09-07 que no pudieron resolverlas porque entonces los dominios de
AZTI estaban bloqueados por la egress). Hoy `detectia.net` sí es
alcanzable — mismo proveedor (AZTI) que ya se usa para Sopelana
(`webcam-sopelana-azti3.webp`) — y encontré imagen JPEG/WebP directa,
descargada y comprobada de verdad (no un placeholder ni un reproductor
de terceros):

| spot (slug) | URL verificada | resultado real |
|---|---|---|
| Lekeitio (`lekeitio`) | `https://detectia.net/img/webcam-lekeitio.webp` | `200`, `image/webp`, WebP VP8 real 1280×720, ~82 KB |
| Getxo/Ereaga (`getxo`) | `https://detectia.net/img/webcam-ereaga.webp` | `200`, `image/webp`, WebP VP8 real 1280×720, ~38 KB |

Método: probé el patrón de nombres del proveedor ya conocido
(`webcam-<lugar>[-aztiN].webp`) contra el endpoint alcanzable; un nombre
inexistente devuelve `404` limpio (no una imagen-placeholder), así que un
`200` con `image/webp` y dimensiones reales confirma que la cámara
existe. `file` sobre la descarga confirma "Web/P image, VP8 encoding,
1280x720" en ambas.

**Plentzia sigue sin resolverse:** probé varias variantes del nombre en
`detectia.net` (`plentzia`, `plencia`, `gorliz`, con y sin sufijo
`-aztiN`) y todas dan `404`. No hay fuente directa verificada para
Plentzia en este proveedor; queda igual que hasta ahora (sin cámara).

**Galicia (los 2 spots sin cámara: A Guarda y Sanxenxo):** MeteoGalicia
es la fuente de las cámaras gallegas que ya tenemos, pero su lista JSON
oficial
(`https://servizos.meteogalicia.gal/mgrss/observacion/jsonCamaras.action`)
devuelve hoy `{"listaCamaras":[]}` (vacía, aunque las imágenes ya
integradas siguen respondiendo `200`), así que no pude enumerar
autoritativamente cámaras nuevas por ahí. Probé nombres de carpeta
plausibles para A Guarda y Sanxenxo/Portonovo contra el patrón
`.../datosred/camaras/MeteoGalicia/<Name>/ultima.jpg` y todos dieron
`404`; el foro de referencia (totalwind) tampoco lista cámara de MeteoGalicia
para esos dos municipios. Sin fuente verificable → no propongo nada para
Galicia esta pasada.

**Por qué esto queda como PROPUESTA y no como código commiteado:**
integrar Lekeitio y Getxo exige tocar `functions/webcam/[slug].js`
(añadir 2 entradas al mapa `WEBCAMS`) y `index.html` (añadir `lekeitio`
y `getxo` a `SPOTS_CON_WEBCAM`). Tocar `functions/` cae, por la red de
seguridad de `ROBOT_REGLAS.md`, en cuarentena: no se aplica directo, se
propone. **Cambio propuesto, listo para que el usuario lo aplique** (no
añadir a `SPOTS_CON_LECTURA_VISUAL` sin antes mirar el encuadre real de
cada cámara, tal como pide el comentario de ese array):

```js
// functions/webcam/[slug].js — dentro del objeto WEBCAMS, junto a sopelana
// AZTI (detectia.net), mismo proveedor que Sopelana. Verificado 2026-09-13.
lekeitio: "https://detectia.net/img/webcam-lekeitio.webp",
getxo:    "https://detectia.net/img/webcam-ereaga.webp",
```

```js
// index.html — añadir a SPOTS_CON_WEBCAM
"lekeitio", "getxo",
```

**Firmado:** robot buscador de fuentes (pasada de webcams), 2026-09-13
22:57 UTC.

### 2026-09-14 08:14 UTC (pasada buscadora — webcams para spots sin cámara)

**Objetivo de la pasada:** misma tarea que la del 2026-09-13 22:57 UTC —
buscar cámaras nuevas para spots fijos que aún no tienen ninguna
(Sanxenxo, A Guarda, Santander, Plentzia y el resto de la costa atlántica
portuguesa/andaluza/canaria). Priorizados los dos gallegos y los dos del
Cantábrico porque ya usamos sus proveedores (MeteoGalicia, Gobierno de
Cantabria) y una cámara del mismo proveedor es la integración más barata
y fiable.

**Hallazgo nuevo respecto a la pasada anterior — la lista JSON oficial de
MeteoGalicia vuelve a estar poblada.** El 2026-09-13 esa lista
(`https://servizos.meteogalicia.gal/mgrss/observacion/jsonCamaras.action`)
devolvía `{"listaCamaras":[]}` (vacía), así que aquella pasada no pudo
enumerar cámaras gallegas de forma autoritativa y tuvo que descartar
Sanxenxo/A Guarda a base de probar nombres de carpeta (404). **Hoy la
lista trae 33 cámaras reales** (descargada de verdad desde este runner,
`meteogalicia.gal` es alcanzable, ver 2026-09-13) — así que ahora la
comprobación es autoritativa, no por sondeo:

- **Sanxenxo:** NO tiene cámara de MeteoGalicia (los `concello` costeros
  más cercanos con cámara son Poio/Castrove, Marín/Aguete y Bueu/Ons —
  ninguno es Sanxenxo). Confirmado contra la lista completa.
- **A Guarda:** NO tiene cámara de MeteoGalicia (la más al sur de la
  lista es Baiona, que ya usamos). Confirmado contra la lista completa.

Conclusión para los dos spots fijos gallegos sin cámara: **siguen sin
fuente**, igual que hasta ahora, pero ahora está confirmado con la lista
oficial en vez de por 404-probing.

**Cámaras gallegas nuevas verificadas que NO corresponden a ningún spot
fijo actual** (aparecen hoy en la lista oficial; las 4 marcadas las
descargué de verdad con `curl`, `200 image/jpeg` + `file` = JPEG real, el
resto salen de la misma lista JSON autoritativa con el patrón de URL ya
conocido):

| concello | carpeta MeteoGalicia | verificado a mano |
|---|---|---|
| Burela | `Burela` | ✅ 200, image/jpeg, ~67 KB, JPEG real |
| Viveiro (Penedo do Galo) | `Penedodogalo` | ✅ 200, image/jpeg, ~151 KB, JPEG real |
| Cariño | `Carinho` | ✅ 200, image/jpeg, ~227 KB, JPEG real |
| Cedeira (Punta Candieira) | `PuntaCandieira` | ✅ 200, image/jpeg, ~95 KB, JPEG real |
| Narón/Ferrol (Aldea Nova) | `AldeaNova` | — (en lista JSON) |
| Arteixo (Langosteira) | `Langosteira` | — (en lista JSON) |
| Ribeira (illa de Sálvora) | `Salvora` | — (en lista JSON) |
| Vilanova de Arousa (Corón) | `Coron` | — (en lista JSON) |
| Marín (Aguete) | `Aguete2` | — (en lista JSON) |
| Bueu (praia de Ons) | `Onsplaya` | — (en lista JSON) |
| Poio (Castrove) | `Castrove` | — (en lista JSON) |

**Esto NO se integra ni se propone como código**: ninguna de estas
cámaras es de un spot que ya exista en `SPOTS` (`index.html`) —
integrarlas significaría **añadir spots nuevos a la app**, que es una
decisión de producto (regla general de `ROBOT_REGLAS.md`: frontend/mapa/
producto → proponer, nunca implementar). Se dejan aquí solo como lista de
candidatos verificados por si el usuario decide en algún momento ampliar
la cobertura gallega (norte de Lugo y Ferrolterra, hoy sin ningún spot).
Patrón de URL para la imagen a tamaño completo, igual que las gallegas ya
integradas: `https://www.meteogalicia.gal/datosred/camaras/MeteoGalicia/<carpeta>/ultima.jpg`
(la lista JSON da `miniUltima.jpg`, la miniatura; usar `ultima.jpg` como
hacen las entradas actuales de `functions/webcam/[slug].js`).

**Santander / El Sardinero:** confirmado que existe una cámara del
**Gobierno de Cantabria** (`cantabria.es/webcams`) — el MISMO proveedor
que ya proxyeamos para Suances, Castro, Laredo, San Vicente, Comillas y
Santoña — además de las 4 de la Autoridad Portuaria de Santander
(`puertosantander.es`). Pero `cantabria.es` **sigue sin ser alcanzable
para verificar la URL directa de la imagen** desde la infraestructura de
esta pasada (`ECONNREFUSED` a `195.235.112.12:443`; la pasada del
2026-09-13 ya lo vio bloqueado con `HTTP 000`). Sin poder descargar la
imagen real, no propongo una URL concreta — sería inventarla. **Pista
firme para una comprobación manual:** la cámara del Sardinero cuelga de
`https://www.cantabria.es/webcams` con el mismo esquema
`cantabria.es/ftp_webcam/<nombre>-New-<id>.jpg` que las 6 cántabras ya
integradas; falta solo confirmar `<nombre>` y `<id>` reales abriendo esa
página desde un navegador normal.

**Plentzia:** sin novedad respecto a la pasada anterior. Solo aparecen
agregadores de terceros (leonoticias, surf-forecast, escueladesurfsopelana)
y una cámara IP en crudo de una escuela de surf
(`http://62.99.56.33:81/jpg/1/image.jpg`) — no es un proveedor
institucional estable como los que usamos (AZTI, MeteoGalicia, Gobierno
de Cantabria, Turisme CV, SOCIB), así que no la propongo. AZTI
(`detectia.net`) no tiene cámara de Plentzia (comprobado 2026-09-13).
Queda sin cámara.

**Resultado neto de la pasada:** ninguna webcam nueva integrable para un
spot fijo existente. Sí un dato nuevo y autoritativo: la lista oficial de
MeteoGalicia vuelve a responder poblada y confirma que Sanxenxo y A
Guarda no tienen cámara propia, más 11 cámaras costeras gallegas
verificadas disponibles como candidatas solo si se decide añadir spots
nuevos. Sin cambios de código (y cualquier integración de webcam tocaría
`functions/webcam/[slug].js`, que por la red de seguridad de
`ROBOT_REGLAS.md` sería propuesta, no commit directo, de todos modos).

**Firmado:** robot buscador de fuentes (pasada de webcams), 2026-09-14
08:14 UTC.

### 2026-09-14 15:18 UTC (pasada buscadora — mareas y oleaje)

**Hallazgo verificable para la responsabilidad de "mar de fondo"
(swell), ver `ROBOT_REGLAS.md`:** la propia Marine API de Open-Meteo,
que ya usamos en `functions/prevision.js` para el oleaje total, expone
directamente las variables de solo-mar-de-fondo `swell_wave_height`,
`swell_wave_period` y `swell_wave_direction` — no hacía falta buscar una
fuente nueva ni montar un modelo de propagación por batimetría desde
cero para tener una primera aproximación del swell. Verificado con una
petición real hoy (Pasaia II, 43.36,-1.89, 14:00 UTC):
`swell_wave_height` 0.9 m, `swell_wave_period` 8.45 s, frente a
`wave_height` total de 0.92 m. Es el mismo modelo (no una boya real) que
ya calibramos contra Puertos del Estado, así que hereda la misma
desviación por zona que estamos midiendo abajo — pero da el desglose
mar-de-viento / mar-de-fondo gratis, sin credenciales ni cuota extra
(cuenta contra la misma cuota por-ubicación de Open-Meteo ya conocida,
ver `ROBOT_REGLAS.md`). **Solo propuesta, no implementado**: mostrar u
usar el swell en el índice de mar cambia lo que se le enseña al usuario
como fiable, así que sigue la regla de "producto → proponer, no
implementar". Si se retoma la idea de mar de fondo, este es el primer
peldaño más barato antes de nada de batimetría/propagación.

**Alternativa más completa, anotada pero NO verificada con HTTP (exige
alta/credenciales):** Copernicus Marine
(`data.marine.copernicus.eu`) publica productos de oleaje globales y
regionales con componentes de swell primario/secundario (altura y
periodo medios) — producto global `GLOBAL_ANALYSISFORECAST_WAV_001_027`
(3-horario, 10 días) y regionales del noroeste atlántico y Mediterráneo
(horarios, 7 días). Más rico que Open-Meteo (separa swell primario y
secundario), pero requiere registro y su acceso no es un `GET` REST
simple (toolbox/subsetting), así que no se comprobó en vivo esta pasada
— queda como candidata de segundo nivel solo si el swell de Open-Meteo
se queda corto. También revisado el conjunto **SIMAR** de Puertos del
Estado (oleaje modelado histórico+predicción, descarga CSV) como posible
alternativa/contraste al modelo de Open-Meteo — mismo caso: no es una
API REST limpia, queda anotada, no verificada esta pasada.

**Firmado:** robot buscador de fuentes (pasada de mareas y oleaje),
2026-09-14 15:18 UTC.

### 2026-09-14 19:37 UTC (pasada buscadora — corrientes marinas por zona)

**Qué se buscó:** fuentes de corrientes marinas por zona que mejoren lo
que ya tenemos. Hoy la corriente sale del modelo global de Open-Meteo
Marine API (`ocean_current_velocity` / `ocean_current_direction` en
`functions/prevision.js`, líneas ~489-572) — es un modelo por
coordenada, igual para toda la costa, sin observación real. La búsqueda
iba orientada a fuentes de OBSERVACIÓN real (radar de alta frecuencia) y
a modelos regionales de más resolución.

**Hallazgo verificado con petición HTTP real (candidato de primer
nivel):** la red de radar de alta frecuencia (HF) de **Puertos del
Estado** (REDRAD, tecnología CODAR) mide corrientes superficiales reales
por hora en zonas concretas de la costa — Galicia (rejilla 6 km,
INTECMAR/Xunta), canal de Ibiza (SOCIB, rejilla 3 km) y delta del Ebro
(sitios Salou/Alfacada/Vinaroz). Lo importante para nosotros: esos datos
se publican de forma legible por máquina en **ERDDAP de EMODnet
Physics**, que sí es un servicio REST simple (`.json`/`.csv` por
lat/lon/tiempo, sin toolbox raro). Verificado en vivo hoy:
`https://erddap.emodnet-physics.eu/erddap/info/HFRADAR_IBIZA_Totals/index.html`
responde y describe un dataset real de corrientes totales del canal de
Ibiza (fuente SOCIB), con variables `EWCT` (componente E-O) y `NSCT`
(componente N-S), resolución horaria, cobertura declarada desde
2019-02-01 hasta mediados de 2026. También confirmado por búsqueda el
catálogo THREDDS de Puertos del Estado (`opendap.puertos.es/thredds/`,
carpeta NW_Iberian) y el de INTECMAR (`opendap.intecmar.gal/thredds/`,
`HFR-Galicia-UI_*.nc`) para Galicia.

**Candidato de segundo nivel (modelo regional, NO verificado con HTTP —
exige alta/credenciales):** Copernicus Marine, producto
`IBI_ANALYSISFORECAST_PHY_005_001` (Atlantic-Iberian Biscay Irish, NEMO
1/36°, ~2.8 km) — da corrientes superficiales horarias de previsión a 10
días para todo el golfo de Bizkaia e Iberia atlántica, con mucha más
resolución que el modelo global de Open-Meteo y cubriendo TODA la costa
NO/N (no solo las zonas con radar). Igual que ya se anotó para el swell
(entrada de las 15:18 de hoy), su acceso no es un `GET` REST limpio
(requiere registro y toolbox/subsetting), así que no se pudo comprobar en
vivo esta pasada — queda anotado, no verificado.

**Por qué solo propuesta, no implementación** (ver `ROBOT_REGLAS.md`):
integrar cualquiera de estas dos fuentes tocaría `functions/prevision.js`
(por encima del límite de volumen para aplicar directo) y, sobre todo, es
una decisión de producto — el radar HF solo cubre 3 zonas concretas
(Ibiza, Galicia, Ebro), no los ~95 spots fijos, así que habría que
decidir cómo mezclar "corriente observada real donde hay radar" con "el
modelo de Open-Meteo en el resto" sin confundir al usuario sobre qué es
observación y qué es modelo. Eso cambia lo que se le muestra como fiable
→ regla general "producto → proponer, no implementar". No se ha tocado
código.

**Propuesta concreta para el usuario, si se retoma:** empezar por el
canal de Ibiza vía ERDDAP de EMODnet (es la fuente más fácil de
consumir, REST puro, ya verificada hoy) como PRUEBA de concepto de
"corriente observada real por radar" para los spots de esa zona,
etiquetándola claramente como observación de radar HF (distinta del
modelo). Antes de proponer un factor o mezcla, calibrar la lectura del
radar contra el `ocean_current_velocity` de Open-Meteo en esos mismos
puntos y anotarlo en `CALIBRACION.jsonl` (mismo patrón que oleaje y
coeficiente de marea). Ojo con la cuota: ERDDAP no tiene la cuota
por-ubicación de Open-Meteo, pero conviene cachear igual (patrón ya
existente en `/prevision`).

**Firmado:** robot buscador de fuentes (pasada de corrientes marinas),
2026-09-14 19:37 UTC.

---

### 2026-09-14 21:03 UTC (pasada buscadora — migración y cría de especies)

Investigación con `WebSearch` de las épocas de migración y los rangos de
temperatura de reproducción/cría/reposo de las 7 especies ya conocidas
por la app (`ESPECIES` en `diario.html`: Lubina, Sargo, Abadejo, Calamar/
chipirón, Congrio, Bonito del norte, Txitxarro/verdel). Objetivo: tener
un dato distinto del rango de PESCA que ya usa `indicePesca` — cuándo
cada especie está desovando/en reposo (menos pescable o vedada de facto)
frente a cuándo está activa y cerca de costa. **Todo esto es propuesta,
nunca cambio directo a `ESPECIES` ni a `indicePesca`** (regla de
`ROBOT_REGLAS.md`, sec. "Buenas prácticas de otras apps y biología de
especies") — es un dato que se le muestra al usuario como fiable.

**Ficha por especie (época de desove / temperatura / patrón migratorio),
solo lo que las fuentes dieron claro y verificable — donde una fuente no
dio cifra fiable, se deja en blanco, nunca se inventa:**

| Especie | Desove | Temp. reproducción | Migración / patrón |
|---|---|---|---|
| **Lubina** (*D. labrax*) | Invierno; Atlántico ~dic–jun según latitud (Bretaña abr–may, Irlanda hasta jun; Mediterráneo ene–mar) | Óptimo 12–14 °C; huevos raros bajo 8,5–9 °C o sobre 15 °C | Se agrupa para el desove alejándose algo de costa en la fría; vuelve a costa/estuarios en primavera-verano |
| **Sargo** (*D. sargus*) | Primavera-verano (algunas fuentes ene–mar en el Atlántico) | Sin cifra fiable de temperatura de puesta | Costero, sedentario; hermafrodita proterándrico, madura ~2 años/17 cm |
| **Abadejo** (*P. pollachius*) | Feb–may (según latitud; ene–jun en agregaciones) | Sin cifra fiable | Se congrega en cardúmenes para desovar a 100–150 m; el resto del año más solitario |
| **Calamar/chipirón** (*L. vulgaris*) | Dos pulsos: primavera y verano | Eclosión 25–45 días según temperatura (sin umbral de puesta claro) | Se acerca a costa a desovar (busca sustrato donde fijar las puestas); ciclo de vida ~1 año |
| **Congrio** (*C. conger*) | Verano–otoño | Sin cifra fiable | Semélparo: migra a alta mar y desova a 2.000–3.000 m una sola vez y muere; adultos costeros 50–500 m fuera del desove |
| **Bonito del norte** (*T. alalunga*) | Prim–verano, pero **fuera de la zona**: mar de los Sargazos, aguas >25 °C | Tolera 9,5–25,2 °C; en el Cantábrico es migración TRÓFICA, no de puesta | Sube por la fachada atlántica al Golfo de Vizcaya en verano tras anchoa/chicharro; vuelve a invernar a Azores en otoño |
| **Txitxarro/verdel** — verdel = caballa (*S. scombrus*) | Atlántico may–jul (Mediterráneo mar–abr); desove mar–jun en aguas someras cerca de costa | Óptimo ~10 °C, aguas frías-templadas | Inverna profundo (~200 m) y remonta a superficie/costa en primavera-verano en grandes bancos |
| **Txitxarro** — jurel/chicharro (*T. trachurus*) | Primavera-verano, en aguas abiertas | Prefiere aguas templadas-cálidas (sin cifra exacta) | Forma grandes bancos; migra a capas superficiales/costeras con el calor |

**Nota sobre el `ESPECIES` actual**: la entrada "Txitxarro / verdel"
mezcla dos peces distintos con biología parecida pero no idéntica —
*Trachurus trachurus* (jurel/chicharro, familia Carangidae) y *Scomber
scombrus* (caballa/verdel, familia Scombridae). Los dos desovan en
primavera-verano y remontan a costa con el calor, así que a efectos de
"temporada" se comportan parecido, pero si algún día se separan en dos
entradas convendría no arrastrar la mezcla. **No lo toco** — es una
decisión de contenido para el usuario.

**Patrón útil que sale de juntar las 7**: casi todas (lubina, sargo,
abadejo, verdel, jurel, calamar) desovan en el arco invierno→verano y
muchas se ALEJAN de costa o bajan a profundidad justo entonces (abadejo
a 100–150 m, verdel invernando a 200 m, congrio a miles de metros),
volviendo a costa/superficie cuando el agua templa. Es decir: el pico de
desove suele coincidir con MENOR disponibilidad para el pescador de
costa, no mayor. El bonito es el caso opuesto y limpio: en el Golfo de
Vizcaya nunca está reproduciéndose (desova en el Sargazo), su presencia
aquí es puramente trófica de verano→otoño — un dato de "temporada de
paso" muy concreto y fácil de mostrar.

**Propuesta concreta, para que el usuario decida (sin implementar nada):**
1. Añadir a cada objeto de `ESPECIES` un campo informativo opcional
   (p.ej. `desove: { meses: [...], nota }` y/o `presencia`/`temporada`)
   con lo de la tabla de arriba, mostrado SOLO como texto informativo en
   el `<details>` por especie de `index.html` ("¿Qué esperamos pescar
   hoy?") — nunca como número que se sume al índice todavía.
2. Como mucho, un modificador SUAVE y bien etiquetado de `indicePesca`:
   restar un poco cuando la especie está en pleno desove lejos de costa
   (menos pescable desde tierra) o marcar "temporada de paso" para el
   bonito. Cualquier peso concreto tendría que calibrarse y confirmarse
   igual que los umbrales de `indiceMar` (que ya se documentan como
   criterio de diseño, no fuente oficial). No propongo cifras de peso
   aquí a propósito: sin capturas reales contra las que calibrar sería
   inventar, justo lo que prohíbe la regla.
3. Antes de dar por buena cualquier cifra de temperatura para el índice,
   contrastarla con una segunda fuente por especie (aquí solo la lubina
   y el verdel traen umbral numérico claro; sargo/abadejo/jurel se
   quedaron sin cifra fiable de temperatura de puesta — pendiente de más
   búsqueda antes de usarlas para nada cuantitativo).

**Verificación HTTP real hecha en esta pasada**: la cifra de la lubina
(desove en invierno; huevos raros bajo 8,5–9 °C o sobre 15 °C) se
confirmó con una petición directa a Wikipedia
(`es.wikipedia.org/wiki/Dicentrarchus_labrax`), no solo con el resumen
del buscador. Fishipedia (`fishipedia.es`) devolvió `403` a la petición
directa — sus datos quedan solo como referencia del buscador, sin
verificar en crudo.

Fuentes consultadas (todas vía `WebSearch`, salvo la de Wikipedia ya
citada, verificada con `WebFetch`):
- Wikipedia ES: *Dicentrarchus labrax*, *Scomber scombrus*, *Trachurus
  trachurus*, *Loligo vulgaris*.
- Fishipedia (`fishipedia.es`) para lubina, sargo, caballa y jurel
  (referencia del buscador, no verificada en crudo por el `403`).
- Fichas divulgativas: animalesbiologia.com, cienciaybiologia.com,
  aquaportail.com, wastemagazine.es, atlasdeanimales.com,
  pellagofio.es (congrio semélparo), mariskito.com y aipeces.com
  (costera del bonito en el Cantábrico).

**Sin cambios en código** — investigación de contenido, propuesta pura.

**Firmado:** robot buscador de fuentes (pasada de migración y cría de
especies), 2026-09-14 21:03 UTC.

---

### 2026-09-15 13:00 UTC (pasada buscadora — migración y cría, cierre de huecos de temperatura)

Continuación directa de la pasada del 2026-09-14 21:03 UTC (misma
responsabilidad "migración y cría de especies"). Aquella dejó cuatro
huecos EXPLÍCITOS de "sin cifra fiable de temperatura de puesta":
**sargo, abadejo, calamar/chipirón y jurel**. Esta pasada fue a por
esos cuatro en concreto con `WebSearch`, verificando en crudo con
peticiones HTTP reales las cifras numéricas antes de darlas por buenas
(regla de `ROBOT_REGLAS.md`: nunca proponer un dato cuantitativo sin
comprobarlo). Sigue siendo **propuesta pura, sin tocar `ESPECIES` ni
`indicePesca`**.

**Resultado por hueco:**

| Especie | Temperatura de puesta encontrada | ¿Verificada en crudo? |
|---|---|---|
| **Sargo** (*D. sargus*) | Desova mar–may cuando el agua sube de **15 °C a 18 °C** (Golfo de Túnez); en acuicultura pone entre 11,5–24,4 °C pero con **mayor fecundidad a 17,5–20,4 °C**. La temporada se alarga al bajar la latitud. | **Sí** — `WebFetch` a `en.wikipedia.org/wiki/Sargo`: "spawned from March to May, sexual activity began as the water temperature rose from 15 °C to 18 °C". |
| **Calamar/chipirón** (*L. vulgaris*) | Desarrollo del huevo **12–22 °C** (26–45 días según temperatura); **por debajo de 10 °C los huevos no se desarrollan y mueren**. Esto acota el desove costero al final del invierno/primavera solo donde el fondo no baja de ~10 °C. | **Sí** — `WebFetch` al artículo de *ICES Journal of Marine Science* (Oxford Academic, `academic.oup.com/icesjms/article/79/6/1918/6633838`): "egg development ... takes between 26 and 45 days at 12–22 °C" y "do not develop and die at 10 °C". |
| **Abadejo** (*P. pollachius*) | Búsqueda apunta a desove a **8–10 °C** (feb–may, a profundidad, aguas offshore con fondo duro). | **NO** — no se pudo confirmar en crudo: Wikipedia EN de *P. pollachius* no da la cifra, FishBase tampoco. La cifra sale solo de resúmenes del buscador (seafishpool.com y similares). **Ojo a no confundir con *P. virens*** (carbonero/pollock, especie DISTINTA) — parte de los resultados eran de esa. Queda como referencia sin verificar, NO como dato fiable. |
| **Jurel** (*T. trachurus*) | **Sigue sin cifra de temperatura de puesta** tras esta búsqueda. Lo que sí se confirma: temporada de puesta muy larga (hasta ~8 meses, varía con la geografía); en el Mediterráneo oriental dos picos (feb–abr y jul–sep); la temperatura y el fotoperiodo influyen en la maduración, pero ninguna fuente da un rango en °C. | Hueco explícito, no se cierra. |

**Balance:** de los 4 huecos, **2 quedan cerrados y verificados en crudo
(sargo y calamar)**, 1 con dato solo de buscador y sin verificar
(abadejo), 1 sigue abierto (jurel). Sumado a lo de la pasada anterior
(lubina y verdel/caballa ya traían umbral verificado), ya hay **cuatro
especies de las siete con rango de temperatura de reproducción
verificado**: lubina (óptimo 12–14 °C, huevos raros bajo 8,5–9 °C o
sobre 15 °C), verdel/caballa (~10 °C), sargo (15–18 °C al subir) y
calamar (12–22 °C, muere bajo 10 °C).

**Propuesta (idéntica en espíritu a la del 2026-09-14, ahora con más
casillas rellenas):** si el usuario decide añadir un campo informativo
de temporada/temperatura de reproducción a `ESPECIES`, ya hay cuatro
especies con cifra defendible. Para cualquier uso CUANTITATIVO en
`indicePesca` (no solo texto informativo) sigue haciendo falta calibrar
el peso contra capturas reales — no propongo cifras de peso, sería
inventar. Abadejo y jurel deben quedar sin cifra de temperatura hasta
encontrar una fuente verificable en crudo, mismo criterio de "null mejor
que inventado".

**Fuentes** (todas por `WebSearch`, más las dos verificadas en crudo con
`WebFetch` ya citadas en la tabla): Scientia Marina (CSIC) y Wikipedia EN
para *Diplodus sargus*; *ICES Journal of Marine Science* (Oxford
Academic), ResearchGate y ScienceDirect para *Loligo vulgaris*;
seafishpool.com, animaldiversity.org (este último de *P. virens*, ojo) y
FishBase para *Pollachius pollachius*; Wageningen UR, ResearchGate y
PMC (revisión en el Mediterráneo oriental marroquí) para *Trachurus
trachurus*.

**Sin cambios en código** — investigación de contenido, propuesta pura.

**Firmado:** robot buscador de fuentes (pasada de migración y cría de
especies), 2026-09-15 13:00 UTC.

---

### 2026-09-15 20:26 UTC (pasada buscadora — migración y cría, verificación en crudo de los 2 huecos abiertos)

Tercera pasada de la misma responsabilidad ("migración y cría de
especies"). Las dos anteriores (2026-09-14 21:03 y 2026-09-15 13:00 UTC)
dejaron **dos huecos explícitos sin cerrar**: la temperatura de puesta
del **abadejo** (*P. pollachius*, solo dato de buscador sin verificar) y
la del **jurel** (*T. trachurus*, sin ninguna cifra en °C). Esta pasada
fue a por esos dos en concreto, intentando confirmarlos con peticiones
HTTP reales (`WebFetch`) antes de darlos por buenos — sigue siendo
**propuesta pura, sin tocar `ESPECIES` ni `indicePesca`** (regla de
`ROBOT_REGLAS.md`).

**Resultado por hueco:**

- **Abadejo (*P. pollachius*) — SIGUE SIN CERRARSE.** La cifra de "desove
  a 8–10 °C, marzo–mayo, en profundidad" vuelve a salir en varios
  resúmenes del buscador, pero **no se pudo confirmar en crudo**: la
  página real de FishBase (`fishbase.se/summary/pollachius-pollachius`,
  verificada con `WebFetch`) **no da temperatura de puesta** — solo banda
  geográfica templada (72°N–36°N) y rango de profundidad (40–200 m,
  normalmente 40–100 m). La ficha institucional del HELCOM Red List
  (`helcom.fi/.../HELCOM-Red-List-Pollachius-pollachius.pdf`) es un PDF
  comprimido del que `WebFetch` no pudo extraer texto legible. El
  "preferido térmico" que da FishBase por modelo (7–11,9 °C, media
  8,9 °C) es un ESTIMADO de ocurrencia, no una temperatura de puesta, y
  además tampoco aparece en la página resumen en crudo. **Conclusión:
  igual que en la pasada del 2026-09-15 13:00 — el 8–10 °C del abadejo
  queda como referencia de buscador, NO como dato fiable.** Ojo repetido:
  no confundir con *P. virens* (carbonero), que contamina parte de los
  resultados.
- **Jurel (*T. trachurus*) — temperatura en °C SIGUE SIN APARECER**, pero
  se cierra un dato distinto y **verificado en crudo, directamente
  relevante para nuestra zona**: la página real de FishBase
  (`fishbase.se/summary/Trachurus-trachurus.html`, `WebFetch`) dice
  literalmente que el stock oeste *"spawns in a belt from the Biscay to
  Ireland in early spring"* y el del Mar del Norte *"in the southern
  North Sea in summer"*, con rango de profundidad 0–1050 m (normalmente
  100–200 m). Es decir: para el Golfo de Vizcaya / Cantábrico (justo la
  zona de `ESPECIES` por defecto), la puesta del jurel es a **principios
  de primavera en una franja Vizcaya→Irlanda** — más preciso que el
  "primavera-verano en aguas abiertas" que teníamos, y confirmado en
  fuente primaria, no en resumen. La cifra de temperatura en °C sigue sin
  fuente verificable (Wikipedia, Wageningen, la revisión de ResearchGate
  —403 al fetch— y la del Mediterráneo oriental hablan de que temperatura
  y fotoperiodo influyen, pero ninguna da un rango numérico). Hueco de
  temperatura del jurel: **sigue abierto**, no se inventa.

**Dato de contexto útil que confirma la coherencia de zona**: el artículo
de *Scientia Marina* (CSIC) sobre el destino de huevos y larvas de
caballa (*S. scombrus*), jurel (*T. trachurus*) y sardina en el **Golfo
de Vizcaya** aparece como fuente real (indexado en
`scientiamarina.revistas.csic.es`) — respalda que caballa y jurel
efectivamente desovan en nuestra zona en primavera, coherente con lo de
FishBase. No se cita como cifra de temperatura porque no la aporta en el
resumen accesible.

**Balance acumulado de las 3 pasadas** (sin cambios respecto al recuento
de la del 2026-09-15 13:00 en cuanto a temperatura): siguen siendo
**cuatro de siete** especies con rango de temperatura de reproducción
verificado en crudo — lubina (12–14 °C óptimo; huevos raros bajo
8,5–9 °C o sobre 15 °C), verdel/caballa (~10 °C), sargo (15–18 °C al
subir) y calamar (12–22 °C, mueren bajo 10 °C). Abadejo y jurel siguen
**sin cifra de temperatura fiable** y deben quedarse en blanco si algún
día se añade el campo, mismo criterio "null mejor que inventado". Lo
nuevo de esta pasada es de tipo geográfico-estacional (no térmico):
puesta del jurel confirmada en Vizcaya→Irlanda a principios de
primavera.

**Propuesta (sin implementar nada, idéntica en espíritu a las dos
anteriores):** si el usuario decide añadir a `ESPECIES` un campo
informativo opcional (p.ej. `desove: { meses, zona, nota }`), el jurel ya
puede llevar "puesta principal a comienzos de primavera, franja Golfo de
Vizcaya→Irlanda (FishBase)" como texto informativo verificado, aunque sin
temperatura numérica. Cualquier uso CUANTITATIVO en `indicePesca` sigue
necesitando calibración contra capturas reales — no propongo pesos, sería
inventar.

**Verificaciones HTTP reales de esta pasada** (`WebFetch`):
`fishbase.se/summary/pollachius-pollachius` (abadejo: sin temp de puesta,
solo profundidad y banda geográfica) y
`fishbase.se/summary/Trachurus-trachurus.html` (jurel: puesta
Vizcaya→Irlanda en primavera temprana, confirmada). El PDF de HELCOM y la
revisión de ResearchGate del jurel devolvieron contenido no legible / 403
respectivamente — sus datos quedan solo como referencia de buscador.

**Sin cambios en código** — investigación de contenido, propuesta pura;
solo esta entrada en `ROBOT.md`.

**Firmado:** robot buscador de fuentes (pasada de migración y cría de
especies), 2026-09-15 20:26 UTC.

---

### 2026-09-17 20:15 UTC (pasada buscadora — migración y cría, cuarta pasada)

Cuarta pasada de la misma responsabilidad. Las tres anteriores (2026-09-14
21:03, 2026-09-15 13:00 y 2026-09-15 20:26 UTC) dejaron dos huecos
explícitos: la temperatura de reproducción del **abadejo** (*P.
pollachius*) sin verificar en crudo, y la del **jurel** (*T. trachurus*)
sin ninguna cifra en °C (aunque con la puesta ya situada en
Vizcaya→Irlanda a inicios de primavera). Esta pasada fue a por esos dos
huecos con `WebSearch`/`WebFetch`, con ángulos de búsqueda distintos a
los ya probados. **Sigue siendo propuesta pura, sin tocar `ESPECIES` ni
`indicePesca`** (regla de `ROBOT_REGLAS.md`).

**Abadejo — sigue SIN CERRARSE, y esta vez con una advertencia añadida.**
`WebSearch` devolvió cifras muy concretas (desova a 8, 10 o 12 °C, óptimo
8–10 °C; producción de huevos por kg de 599.612±249.545 a 8 °C,
323.230±136.796 a 10 °C y 26.068±35.989 a 12 °C), atribuidas a un estudio
real de IFREMER (Suquet, Petton, Normant, Dosdat, Gaignon — *"First
rearing attempts of pollack, Pollachius pollachius"*, *Aquatic Living
Resources* 9, 1996, pp. 103–106). **No se pudo verificar en crudo ninguna
de esas cifras**: el PDF del propio artículo
(`alr-journal.org/articles/alr/pdf/1996/02/alr96203.pdf`) da `403`; la
página del resumen del mismo journal, también `403`; ResearchGate y
Academia.edu (con el texto completo del mismo estudio), también `403`;
el libro/informe de IFREMER en Archimer
(`archimer.ifremer.fr/doc/00715/82752/87574.pdf`, 32 páginas, dominio
oficial) resultó ser un PDF escaneado (imagen), sin texto extraíble —
solo pudo confirmarse de ahí que "*Le lieu jaune pond au printemps*"
(desova en primavera) y una temperatura de CRECIMIENTO en cautividad
(13–18 °C), no de puesta. **Aviso explícito para futuras pasadas**: las
cifras de huevos/kg tan precisas que da el resumen de `WebSearch` no
deben darse por buenas solo por parecer reales — sin poder confirmarlas
contra el texto original, no se puede descartar que sean una síntesis
del motor de búsqueda a partir de fragmentos indexados de un PDF que ni
siquiera el propio `WebFetch` puede leer directamente. Se mantiene el
hueco en blanco, mismo criterio de las tres pasadas anteriores.

**Congrio — comprobado un posible atajo, descartado por el mismo motivo
que ya se documentó para el abadejo.** FishBase da una "temperatura
preferida" de 4,4–14,4 °C (media 8,7 °C) para *Conger conger*, pero es un
modelo de temperatura de OCURRENCIA (dónde se le encuentra normalmente),
no una temperatura de puesta documentada — mismo tipo de confusión que ya
se señaló para el abadejo en la pasada del 2026-09-15 20:26 UTC (el
7–11,9 °C de FishBase ahí tampoco era temperatura de puesta). Con el
desove del congrio ocurriendo a 2.000–3.000 m de profundidad (agua
profunda, térmicamente muy estable), es razonable que no exista ninguna
medición real de "temperatura de puesta" en la literatura accesible —
sigue sin cifra fiable, y no se propone la cifra de FishBase para evitar
el mismo error de categoría.

**Jurel — cifra en °C sigue sin aparecer, pero se encuentra un dato
distinto, nuevo y verificado en crudo, más útil que un umbral fijo**: el
proyecto europeo Urban Klima 2050 (LIFE18 IPC 000001,
`urbanklima2050.eu/es/indicador-especies-marinas/`, verificado con
`WebFetch` directo) cita textualmente: *"En años en los que la
temperatura del mar es más caliente, el chicharro avanza su época de
desove unos 12 días por grado de calentamiento"* — atribuido a Chust, G.,
F. G. Taboada, P. Alvarez y L. Ibaibarriaga (2023), *"Species
acclimatization pathways: Latitudinal shifts and timing adjustments to
track ocean warming"*, *Ecological Indicators* 146:109752 (autores de
AZTI, mismo centro de investigación del Golfo de Bizkaia que ya salió en
la pasada del 2026-09-14 23:31 UTC para presión). El resumen del propio
estudio (visto solo vía `WebSearch`, sin poder acceder al texto completo
— ScienceDirect y ResearchGate dieron `403`, el repositorio abierto de
AZTI en `dspace.aztidata.es` dio `500`) añade un matiz cualitativo
relevante sin cifra: el jurel tiene un "nicho térmico reproductivo más
estrecho" que la caballa/verdel (*S. scombrus*), lo que ata su puesta más
rígidamente a una combinación concreta de latitud y fecha, mientras que
la caballa (nicho más ancho) puede desovar de forma casi sincronizada en
un rango geográfico mucho mayor — coherente con que la caballa ya tenía
umbral de temperatura verificado (~10 °C) y el jurel no. Esta parte
cualitativa NO se verificó en crudo contra el texto completo del
artículo, solo contra la síntesis de `WebSearch` — tratarla como
referencia, no como dato cerrado, si se usa en el futuro.

**Balance acumulado (4 pasadas)**: siguen siendo **cuatro de siete**
especies con temperatura de reproducción verificada en crudo (lubina,
verdel/caballa, sargo, calamar). Abadejo y congrio se quedan sin cifra de
puesta fiable — con la lección añadida de no confundir "temperatura
preferida/de ocurrencia" (FishBase) con "temperatura de puesta" para
ninguna especie futura. El jurel gana un dato de fenología climática real
y verificado (12 días de adelanto de desove por °C de calentamiento) que
puede mostrarse como texto informativo aunque siga sin umbral numérico de
temperatura.

**Propuesta (sin implementar nada)**: si el usuario decide añadir un
campo informativo de reproducción a `ESPECIES`, el jurel puede llevar el
dato de sensibilidad climática de Chust et al. 2023 como nota de interés
("su época de puesta se adelanta con el calentamiento del mar, ~12 días
por grado, según AZTI") en vez de un rango de temperatura fijo. Ningún
uso cuantitativo en `indicePesca` todavía — seguiría haciendo falta
calibrar contra capturas reales, y esta cifra en concreto (días de
adelanto) no es directamente un input de `indicePesca` de todos modos.

**Sin cambios en código** — investigación de contenido, propuesta pura;
solo esta entrada en `ROBOT.md`.

**Firmado:** robot buscador de fuentes (pasada de migración y cría de
especies), 2026-09-17 20:15 UTC.

---

### 2026-09-14 23:31 UTC (pasada buscadora — presión atmosférica e histórico por zona)

**Qué se buscó:** fuentes de presión atmosférica y, sobre todo, de
**histórico de presión por zona** que mejoren lo que ya tenemos. Hoy la
presión de cada spot sale del modelo de Open-Meteo (`pressure_msl` en
`/prevision`) y el "histórico" se construye desde cero, hora a hora, con
el cron `presion-historico.yml` escribiendo en la tabla
`presion_historico` — es decir, la tendencia real solo tiene tanta
profundidad como tiempo lleve corriendo ese cron (arrancó el
2026-09-12), y un spot recién añadido no tiene pasado ninguno. La
búsqueda iba a fuentes que permitieran **rellenar histórico real hacia
atrás** (backfill) o dar presión observada por estación.

**Nota de entorno:** a diferencia de las pasadas de agosto (bloqueadas
por el proxy de red, ver 2026-08-31), esta corre en un runner con salida
de red abierta a dominios de datos — se pudo verificar todo con
peticiones HTTP reales, no solo por búsqueda.

**Hallazgo verificado con petición HTTP real (candidato de primer
nivel) — Open-Meteo Historical Weather API (archivo ERA5):**
`https://archive-api.open-meteo.com/v1/archive` devuelve `pressure_msl`
y `surface_pressure` horarios (hPa) para cualquier coordenada, con
reanálisis ERA5 desde 1940. Verificado en vivo hoy para un punto del
Cantábrico (43.41°N, 2.68°W):

```
GET archive-api.open-meteo.com/v1/archive?latitude=43.41&longitude=-2.68
    &start_date=2026-08-01&end_date=2026-08-01
    &hourly=pressure_msl,surface_pressure&timezone=Europe/Madrid
→ 200, pressure_msl[0:6] = [1020.6, 1020.6, 1020.0, 1019.7, 1019.2, 1018.9] hPa
```

Sin autenticación, licencia CC BY 4.0, mismo formato JSON que la API de
forecast que ya usamos. **Utilidad concreta**: permitiría hacer backfill
real de `presion_historico` para todos los spots (fijos y nuevos) de
golpe, en vez de esperar días/semanas a que el cron horario acumule
tendencia — la tendencia de presión es justo una de las variables que
`ROBOT_REGLAS.md` (sección "Variables adicionales para el índice de
pesca") apunta como candidata a mejorar `indicePesca`.

**Segundo endpoint verificado — Historical Forecast API (pasado
reciente):** `https://historical-forecast-api.open-meteo.com/v1/forecast`
respondió `200` para `pressure_msl` del 5 al 10 de septiembre de 2026.
Es el complemento del anterior: el archivo ERA5 tiene ~5 días de latencia
(el reanálisis final no está disponible al instante), así que para la
franja de "los últimos días" conviene esta API (que reconstruye el pasado
reciente de las propias corridas del modelo) y el archivo ERA5 para lo
más antiguo. Para la tendencia corta que le interesa a un pescador
(subiendo/bajando en las últimas 24-48h) basta con la forecast que ya
tenemos; el backfill histórico es lo que aportarían estas dos.

**Fuente de presión OBSERVADA (no modelo), ya parcialmente en casa —
AEMET OpenData "Climatologías diarias":** confirmado por la propia
documentación de AEMET que OpenData sirve series diarias validadas por
estación (hasta 5 años por descarga, algunas estaciones desde 1920),
incluida presión — más de 945 estaciones. Es observación real, no
reanálisis. **No se pudo probar en vivo esta pasada**: la petición exige
la `AEMET_API_KEY`, que vive solo como secreto en Cloudflare Pages y no
está disponible en este runner (`AEMET_API_KEY` ausente en el entorno,
comprobado). Ya usamos AEMET para observación horaria de presión/
precipitación de 25 estaciones (`ESTACIONES_AEMET` en
`functions/prevision.js`); el endpoint de climatologías diarias sería la
vía para su **histórico** observado, complementario al reanálisis de
Open-Meteo.

**Aviso de cuota (regla de `ROBOT_REGLAS.md`, sección de cuota
Open-Meteo):** el archivo de Open-Meteo cuenta contra la misma cuota
diaria por-ubicación (10.000/día en el plan gratuito). Un backfill de
~95 spots × muchos días de golpe gastaría mucha cuota — habría que
hacerlo por lotes/una vez, con caché, y sin colisionar con el cron
horario que ya consume cuota. No es gratis "de una", tenerlo en cuenta
al dimensionar.

**Por qué solo propuesta, no implementación** (ver `ROBOT_REGLAS.md`):
integrarlo tocaría `functions/` (un endpoint de backfill nuevo o cambios
en `registrar-presion.js`) y/o una migración de `supabase/`, ambos por
encima del límite de volumen para aplicar directo; además, usar la
tendencia de presión como modificador de `indicePesca` es una decisión
de producto (cambia un dato que se le muestra al usuario como fiable).
No se ha tocado código.

**Propuesta concreta para el usuario, si se retoma:**
1. Script/endpoint de backfill único (protegido con `CRON_SECRET`, mismo
   patrón que `/registrar-presion`) que, por lotes y con caché, rellene
   `presion_historico` hacia atrás desde `archive-api` para todos los
   spots — dándole a la tendencia de presión profundidad real desde el
   día uno de cada spot, no solo desde que arrancó el cron.
2. Combinar archivo ERA5 (histórico antiguo) + historical-forecast-api
   (últimos ~5 días, por la latencia de ERA5) para no dejar hueco.
3. Más adelante, cruzar con las climatologías diarias de AEMET como
   histórico OBSERVADO por estación cercana (requiere usar la
   `AEMET_API_KEY` desde una function, no desde este runner).

**Fuentes:** [Open-Meteo Historical Weather API](https://open-meteo.com/en/docs/historical-weather-api),
[Open-Meteo Historical Forecast API](https://open-meteo.com/en/docs/historical-forecast-api),
[AEMET OpenData](https://www.aemet.es/en/datos_abiertos/AEMET_OpenData).

**Firmado:** robot buscador de fuentes (pasada de presión atmosférica e
histórico por zona), 2026-09-14 23:31 UTC.

### 2026-09-15 13:33 UTC (pasada buscadora — presión atmosférica e histórico por zona)

**Qué se buscó y por qué:** la pasada anterior de este mismo tema
(2026-09-14 23:31 UTC, justo arriba) ya cubrió a fondo el **reanálisis
por coordenada** (Open-Meteo Historical Weather API / archivo ERA5 +
Historical Forecast API, ambos verificados en vivo) y dejó apuntada
AEMET "Climatologías diarias" como histórico OBSERVADO por estación en
España (sin poder probarla, requiere `AEMET_API_KEY`). Para no repetir,
esta pasada fue a por el **hueco que quedaba abierto ahí**: presión
**observada** (no modelo/reanálisis) por estación en la **costa
portuguesa** — el proyecto cubre España **y Portugal** enteros
(`ROBOT_REGLAS.md`), y hasta ahora la única fuente de observación real
de presión en casa es AEMET, que es solo España.

**Nota de entorno:** este runner sí tiene salida de red a dominios de
datos (a diferencia de las pasadas de agosto, ver 2026-08-31) — todo lo
de abajo se verificó con peticiones HTTP reales, no solo por búsqueda.

**Hallazgo verificado con petición HTTP real (candidato de primer nivel)
— IPMA Open Data (Instituto Português do Mar e da Atmosfera):** dos
endpoints JSON, **sin autenticación**, que juntos dan presión observada
por estación en Portugal continental + Azores + Madeira:

1. Observaciones horarias:
   `https://api.ipma.pt/open-data/observation/meteorology/stations/observations.json`
   → JSON anidado, primer nivel = fecha-hora ISO (`"2026-09-14T15:00"`),
   segundo nivel = `idEstacao`, tercer nivel = objeto con
   `temperatura`, `humidade`, `intensidadeVentoKM`, `radiacao` y
   **`pressao`** (hPa). Valor centinela de dato ausente: `-99.0`
   (mismo criterio "sin dato" que ya usamos). Verificado en vivo hoy:
   estación `1210881` (Olhão, EPPO, Algarve) → `pressao: 1020.3` real;
   también `1210883` (1020.7) y `1200535` (1020.2) en el mismo sello de
   tiempo.
2. Catálogo de estaciones:
   `https://api.ipma.pt/open-data/observation/meteorology/stations/stations.json`
   → GeoJSON con `idEstacao` + coordenadas (`geometry.coordinates`
   `[lon, lat]`) + `localEstacao`. Verificado en vivo: ~280 estaciones;
   ej. `idEstacao 1210881` = "Olhão, EPPO" en `[-7.821, 37.033]`. Es lo
   que permite mapear cada `idEstacao` de las observaciones a
   coordenadas y elegir la estación costera más cercana a cada spot
   portugués — mismo patrón exacto que `ESTACIONES_AEMET` en
   `functions/prevision.js` (código de estación + coordenadas curadas,
   marcador propio, sin dato inventado si la lectura es `-99.0`).

**Encaje con lo que ya hay:** IPMA sería el equivalente portugués de las
25 `ESTACIONES_AEMET` que ya se pintan (🌧) en `index.html` — misma
naturaleza (observación real horaria de presión/precipitación/viento por
estación), rellenando la mitad portuguesa del mapa que AEMET no cubre.
Para el **histórico** observado en Portugal, la vía sería la misma que se
apuntó para AEMET: además del endpoint horario de arriba (solo tiempo
presente), IPMA publica series diarias por estación en su portal de
datos — no verificado en vivo esta pasada porque el endpoint horario ya
demuestra la fuente y el catálogo, y el histórico diario merece su propia
comprobación de formato antes de prometer nada.

**Puertos del Estado — histórico de presión costera (revisado, NO
integrable trivialmente):** confirmado por su propia documentación que
las boyas REDEXT/REDCOS miden presión atmosférica (hPa) y que PORTUS
tiene una sección de "Datos Históricos" con descarga. **Pero** el acceso
es un servicio de descarga por formulario/petición (`bancodatos.puertos.es`,
ficheros de texto tabulados), no una API JSON limpia por coordenada como
IPMA u Open-Meteo — no se pudo verificar una URL estable de respuesta
directa esta pasada. Además, ya tenemos 26 boyas de Puertos del Estado
en tiempo real (`BOYAS` en `functions/prevision.js`) rozando el límite
de 50 sub-peticiones de Cloudflare (ver `ROBOT_REGLAS.md`), así que
sumar histórico de esa misma fuente por ahí no es la vía. Queda anotado
como fuente real existente pero de integración no trivial, no como
candidato inmediato.

**Aviso de cuota:** IPMA sirve TODAS las estaciones en **una sola
petición** (un JSON con todas las lecturas de la última hora), igual que
el patrón bulk de AEMET (`observacion/convencional/todas`) — así que a
diferencia de Open-Meteo (que cuenta por ubicación, ver `ROBOT_REGLAS.md`)
aquí una llamada cubre todo Portugal sin multiplicar cuota. Bien para el
patrón de una function que cachea la respuesta.

**Por qué solo propuesta, no implementación** (ver `ROBOT_REGLAS.md`):
integrar IPMA tocaría `functions/prevision.js` (nueva
`ESTACIONES_IPMA` + `datosEstacionesIpma()` a estilo de la de AEMET, más
exponerlo en `/prevision`) y `index.html` (marcador nuevo en el mapa) —
por encima del límite de volumen para aplicar directo, y `index.html` es
UI que ve el usuario. No se ha tocado código.

**Propuesta concreta para el usuario, si se retoma:**
1. Curar `ESTACIONES_IPMA` (código `idEstacao` + coordenadas del
   catálogo, verificados uno a uno con una petición real antes de
   escribirlos, igual que se hizo con `ESTACIONES_AEMET`), priorizando
   las estaciones costeras cercanas a los spots portugueses.
2. `datosEstacionesIpma()` en `functions/prevision.js` que lea el
   endpoint bulk, descarte `-99.0` (sin dato → no se pinta, nunca
   inventar), y lo exponga en `/prevision` como `estacionesIpma`.
3. Reutilizar el mismo marcador 🌧 / modal de detalle de AEMET en
   `index.html` para no duplicar UI.
4. Histórico portugués: pendiente de comprobar el formato de las series
   diarias de IPMA en una pasada futura, análogo a lo pendiente con las
   climatologías diarias de AEMET.

**Fuentes:** [IPMA — API open data](https://api.ipma.pt/),
[IPMA — observações estações (JSON)](https://api.ipma.pt/open-data/observation/meteorology/stations/observations.json),
[Puertos del Estado — datos históricos (PORTUS)](https://portus.puertos.es/Portus/html/info/infohist.html).

**Firmado:** robot buscador de fuentes (pasada de presión atmosférica e
histórico por zona), 2026-09-15 13:33 UTC.

### 2026-09-15 08:20 UTC (pasada buscadora — webcams para spots sin cámara)

**Objetivo de la pasada:** misma tarea recurrente que las del 2026-09-13
22:57 y 2026-09-14 08:14 UTC — buscar cámaras nuevas para spots fijos sin
cámara. Como aquellas dos ya cubrieron a fondo el Cantábrico (AZTI,
Gobierno de Cantabria) y Galicia (lista oficial de MeteoGalicia), esta
pasada abrió tres zonas todavía sin explorar en las pasadas anteriores:
**Canarias, Andalucía y la costa atlántica portuguesa** (que hoy no tiene
ni una sola cámara integrada, pese a tener 15 spots fijos).

**Red sí alcanzable desde este runner** (a diferencia del entorno
nocturno remoto, ver 2026-08-31): `example.com` `200`, `meteogalicia.gal`
`302`. **`cantabria.es` sigue sin ser alcanzable** (timeout puro a los
20 s pidiendo una de las imágenes ya integradas,
`suances-New-85.jpg`) — mismo bloqueo que vieron las pasadas del
2026-09-13/14, así que sigo sin poder verificar la cámara de Santander/El
Sardinero (la pista firme de aquellas pasadas queda igual de válida, y
igual de pendiente de comprobación manual desde un navegador normal).

**Canarias (Las Palmas / Las Canteras, El Médano, etc.):** solo aparecen
agregadores de terceros (SkylineWebcams, webcamtaxi, canariaslife,
miplayadelascanteras) — el mismo tipo de fuente que las pasadas
anteriores ya descartaron por no ser institucional y no dar una URL de
imagen hotlinkable. Comprobado en vivo con `WebFetch` sobre
`miplayadelascanteras.com/webcam-de-la-cicer-hd/`: es una SPA, el stream
se carga por JavaScript, no hay `.m3u8`/`.jpg`/`img src` en el HTML
servido. Sin fuente institucional con imagen directa. Queda sin cámara.

**Andalucía (Cádiz, Conil, Chipiona):** la web institucional **Puertos de
Andalucía** (`puertosdeandalucia.es`) tiene ficha de cada puerto pero
**ninguna cámara embebida** — comprobado en vivo con `WebFetch` sobre la
ficha del Puerto de Conil: solo datos de contacto y concesionario, ningún
feed de imagen/vídeo. El resto de resultados son agregadores (Skyline,
lacostadecadiz, andalucialive). Sin fuente institucional con imagen
directa. Queda sin cámara.

**Portugal (Nazaré, Ericeira, Peniche, Cascais, Matosinhos...):** la red
de referencia es **Beachcam** (hoy operada por MEO,
`beachcam.meo.pt`). **Hallazgo nuevo y útil: Beachcam es ahora un
servicio de pago** ("Beachcam+", 3,49 €/mes) — `WebFetch` a la página de
la cámara de Nazaré (Praia do Norte) devuelve **`403 Forbidden`**. Los
antiguos streams HLS públicos de Beachcam
(`http://video-auth1.iol.pt:1935/beachcam/<playa>/chunks.m3u8`, que aún
aparecen en listas IPTV de terceros en GitHub) están **muertos**:
probados dos en vivo (`nazareparadonorte`, `lagide`) → timeout puro, el
servidor legacy ya no sirve. **Conclusión para todos los spots
portugueses: no hay fuente gratuita/hotlinkable viable hoy** — la fuente
natural (Beachcam) se ha cerrado tras un muro de pago. Anotado
expresamente para que futuras pasadas no vuelvan a perseguir Beachcam ni
sus URLs HLS heredadas.

**Resultado neto de la pasada: sin novedades integrables.** Ninguna
webcam nueva para un spot fijo existente en Canarias, Andalucía ni
Portugal — todas las fuentes encontradas son agregadores de terceros sin
imagen directa, fichas institucionales sin cámara, o (Beachcam) un
servicio que pasó a ser de pago y responde `403`. Sin cambios de código
(y cualquier integración de webcam tocaría `functions/webcam/[slug].js`,
que por la red de seguridad de `ROBOT_REGLAS.md` sería propuesta, no
commit directo, de todos modos).

**Fuentes:** [Puertos de Andalucía — Puerto de Conil](https://www.puertosdeandalucia.es/puertos/puertos/cadiz/puerto-de-conil),
[Mi Playa de Las Canteras — webcam La Cícer](https://miplayadelascanteras.com/webcam-de-la-cicer-hd/),
[Beachcam MEO — Livecams](https://beachcam.meo.pt/livecams/).

**Firmado:** robot buscador de fuentes (pasada de webcams), 2026-09-15
08:20 UTC.

### 2026-09-15 09:18 UTC (pasada buscadora — verificación de DIGIPESCA/RiuNet como fuente de precio en lonja)

**Qué se buscó:** verificar en real la fuente candidata DIGIPESCA
(`digipesca.webs.upv.es`, Universitat Politècnica de València) que el
usuario apuntó el 2026-09-15 en `ROBOT_REGLAS.md` — comprobar con
peticiones reales qué contiene de verdad (especie, zona, mes, precio en
lonja), si el acceso es abierto sin registro, y si sirve para su idea de
usar el precio/volumen en lonja como señal indirecta de la mejor época
de pesca de una especie. Aplicando SIEMPRE las dos advertencias ya
documentadas allí: separar bajura/altura, y cruzar con hábitos/costumbres
reales de captura de la especie antes de dar por buena cualquier lectura.

**Qué se encontró (verificado con `WebFetch`/`WebSearch` reales, no de
memoria):**

- **La base de datos existe y es real.** El proyecto DIGIPESCA
  ("Digitalización y valorización de la pesca en el Mediterráneo
  español", financiado por el Ministerio de Agricultura vía fondos Next
  Generation) publicó en 2023 un conjunto de **12 bases de datos**, unas
  400.000 variables cada una, ~5 millones de datos en total, sobre ventas
  en lonjas.
- **Campos que trae (confirmado en 3 fuentes independientes):** por cada
  especie, **cantidad, precio medio y facturación**, desglosado **por
  lonja y por mes**, a lo largo de **12 años (2010–2021)**. Esto encaja
  casi exactamente con lo que pedía la idea del usuario (especie · zona ·
  mes · precio).
- **Acceso:** descrito como "de libre uso y acceso"; las bases están
  subidas al repositorio institucional de la UPV (**RiuNet**) y
  enlazadas desde la web del proyecto. Ninguna fuente menciona registro
  obligatorio. **Salvedad honesta:** NO conseguí llegar al fichero
  descargable en sí en esta pasada — el `handle` concreto de RiuNet no
  aparece en ninguna de las páginas divulgativas, `digipesca.webs.upv.es/datos/`
  da 404, y el buscador simple de RiuNet no respondió por `WebFetch`. Así
  que "acceso abierto sin registro" está confirmado solo a nivel de lo que
  dicen las notas de prensa, **no comprobado con una descarga real del
  dataset**. Antes de integrar nada haría falta localizar el `handle`
  exacto en RiuNet (buscar "Digipesca" / "lonjas" en el buscador del
  repositorio, o pedir el enlace directo al contacto del proyecto,
  `proyectodigipesca@gmail.com`) y bajar un fichero de verdad para
  confirmar formato (¿CSV/Excel?), licencia y que efectivamente no pide
  login.

**Problema de fondo que hace esta fuente poco útil para ESTA app (el
hallazgo más importante de la pasada):** la cobertura geográfica es
**Mediterráneo español + Atlántico de Andalucía** (confirmado
explícitamente en 3 fuentes). **NO cubre el Cantábrico ni Galicia**, que
es justo donde está la inmensa mayoría de los spots fijos y de los
usuarios de Costaviva (Euskadi, Cantabria, Asturias, Galicia). Una
señal de "precio en lonja de esta especie este mes" sacada de lonjas de
Valencia, Almería o Cádiz no dice nada fiable sobre la actividad de pesca
en Bermeo o Lekeitio. Esto por sí solo ya desaconseja integrarla como
señal para el índice de pesca tal cual está la app hoy.

**Cruces obligatorios de `ROBOT_REGLAS.md`, para dejar constancia de que
se aplicaron (aunque la fuente ya se descarta por lo geográfico):**

1. **Bajura vs altura:** el dato es "precio/volumen en la lonja X", es
   decir *puerto de venta*, no *zona de captura*. Para especies de altura
   (`zona: "mar adentro"` en `ESPECIES`: Bonito del norte, Dentón, Urta,
   Medregal…) el pez puede haberse capturado a cientos de km del puerto
   donde se vendió, así que su precio de lonja NO sirve como proxy de
   "hay actividad de esta especie cerca de esta costa". Solo tendría
   sentido, como mucho, para especies de bajura (`zona: "costa"`).
2. **Usos y costumbres reales de captura:** además, "abundante+barato en
   lonja este mes" tampoco implica "se puede pescar de costa" — muchas
   especies de bajura se capturan sobre todo desde embarcación o en
   fondos profundos cercanos, poco realistas a lanzado desde la orilla
   (el ejemplo del pargo del propio usuario). El dato de lonja por sí
   solo no distingue esto.

**Conclusión / propuesta (solo propuesta, no se toca `ESPECIES` ni
`indicePesca`, tal como manda la regla):** DIGIPESCA es una fuente real,
seria y con exactamente los campos que la idea necesitaba (especie · lonja
· mes · precio/cantidad, 2010–2021), pero **no es directamente aprovechable
para Costaviva por dos motivos**: (a) no cubre la costa cantábrica/gallega
donde está el grueso de la app, y (b) aun donde sí cubre, traducir precio
de lonja en "mejor época/lugar de pesca" exige los dos cruces de arriba
(bajura/altura + hábitos reales de captura), que la propia base no aporta.
**Recomendación:** dejarla anotada como referencia útil solo si en el
futuro la app se expandiera al Mediterráneo/Andalucía, y en ese caso
usarla únicamente para una *climatología mensual por especie de bajura*
(qué meses hay históricamente más volumen/precio más bajo de una especie
de costa en una lonja concreta), nunca como dato "en vivo" (es un
histórico estático 2010–2021) y nunca sin el cruce de hábitos de captura.
Para el Cantábrico habría que buscar el equivalente en las estadísticas de
lonja de cada CCAA (p. ej. datos de lonjas del Gobierno Vasco / Azti,
Xunta de Galicia) — pendiente de una pasada futura, no investigado hoy.

**Fuentes:** [DIGIPESCA — web del proyecto (UPV)](https://digipesca.webs.upv.es/),
[Nota del proyecto: ~5 millones de datos de lonjas](https://digipesca.webs.upv.es/en/2023/08/investigadoras-del-proyecto-digipesca-crean-una-base-con-casi-5-millones-de-datos-sobre-las-lonjas-de-pescado-del-mediterraneo-espanol/),
[UPV Campus Gandia — nota de prensa](https://www.upv.es/contenidos/CGANDIA/noticiaf_1226881i.html),
[Pasión por el Mar — cobertura de la base de datos](https://www.pasionporelmar.com/es/noticia/sabes-que-pescado-se-vende-en-la-lonja-y-cuanto-cuesta-/4493).

**Firmado:** robot buscador de fuentes (pasada de verificación de fuente
de lonja/DIGIPESCA), 2026-09-15 09:18 UTC.

---

### 2026-09-15 09:30 UTC (pasada buscadora — caudal de ríos por zona y estaciones de monte, España y Portugal)

**Qué se buscó:** (1) una fuente abierta y automatizable de caudal de
los ríos vascos de `RIOS` en `index.html` (los 6 de Bizkaia — Lea, Oka,
Estepona/Zarraga, Butroe, Arroyo Sopelana, Nervión — que hoy salen con
`caudal: null` porque URA/Bizkaia bloquea el acceso automático, ver el
comentario en `functions/prevision.js`); (2) estaciones de monte con
precipitación/presión real (estilo `ESTACIONES_AEMET`) para toda la
costa de **España y Portugal**, no solo Euskadi.

---

**HALLAZGO PRINCIPAL — IPMA (Portugal), fuente nueva verificada en vivo,
PROPUESTA (no aplicada).** Costaviva cubre España y Portugal pero hoy
no tiene NINGUNA fuente de datos portuguesa integrada (ni estaciones
meteo ni caudal). El Instituto Português do Mar e da Atmosfera (IPMA)
publica una API abierta, sin registro ni token, con observación horaria
de sus estaciones — el equivalente portugués exacto de `ESTACIONES_AEMET`:

- Estaciones (GeoJSON, id + nombre + coordenadas):
  `https://api.ipma.pt/open-data/observation/meteorology/stations/stations.json`
- Observaciones horarias (últimas 24 h):
  `https://api.ipma.pt/open-data/observation/meteorology/stations/observations.json`

**Verificado con petición real hoy 2026-09-15 ~09:30 UTC**: el endpoint
de observaciones devolvió `200 application/json` (~1,0 MB), con 24
marcas horarias (última `2026-09-15T08:00`, es decir dato de hace <1 h)
y 222 estaciones en la última hora. Estructura: objeto indexado por
timestamp → objeto indexado por `idEstacao` → medida con los campos
`pressao` (hPa), `precAcumulada` (mm), `temperatura` (°C), `humidade`
(%), `intensidadeVentoKM` (km/h), `idDireccVento`, `radiacao`. **Valor
ausente = `-99.0`** (hay que tratarlo como `null`, nunca como dato real
— algunas estaciones traen presión pero no precipitación y viceversa).

**Estaciones costeras portuguesas ya verificadas con dato reciente
real** (presión/precipitación no nulos en la pasada de hoy), listas para
una lista curada tipo `ESTACIONES_AEMET` que cubra toda la costa
atlántica portuguesa de norte a sur:

| idEstacao | estación | lat | lon | pres (hPa) hoy |
|---|---|---|---|---|
| 1200551 | Viana Castelo, Chafé | 41.6489 | -8.8046 | 1023.7 |
| 1200545 | Porto, Pedras Rubras (Aeródromo) | 41.2335 | -8.6813 | 1023.7 |
| 1210702 | Aveiro (Universidade) | 40.6353 | -8.6596 | 1023.8 |
| 1200531 | Cabo Carvoeiro (Peniche) | 39.3800 | -9.4074 | 1023.7 |
| 1200535 | Lisboa (Geofísico) | 38.7191 | -9.1497 | 1022.4 |
| 1200541 | Sines | 37.9545 | -8.8383 | 1021.9 |
| 1200533 | Sagres | 37.0128 | -8.9491 | 1021.8 |
| 1200554 | Faro (Aeródromo) | 37.0166 | -7.9720 | 1021.8 |
| 1210878 | Portimão (Aeródromo) | 37.1492 | -8.5814 | 1021.7 |
| 1210883 | Tavira | 37.1217 | -7.6205 | 1022.0 |

(Además hay más candidatas con dato de precipitación pero sin presión —
Cabo da Roca, Cabo Raso, Figueira da Foz, Torres Vedras — a incluir solo
para el campo que sí traigan.)

**Por qué es PROPUESTA y no cambio directo**: integrarlo toca
`functions/prevision.js` (nueva constante `ESTACIONES_IPMA` + una función
`datosEstacionesIpma()` a estilo `datosEstacionesAemet()`, expuesta en
`/prevision`) y `index.html` (marcador 🌧 propio para Portugal, igual
que el de AEMET) — muy por encima del límite de volumen de
`ROBOT_REGLAS.md` y con dos ficheros de `functions/`/frontend, así que
queda en cuarentena para que el usuario lo revise. Notas de diseño para
cuando se implemente: la API trae las 222 estaciones de golpe en una
sola petición HTTP (no una por estación, así que no aplica el problema
de cuota por ubicación de Open-Meteo — es una sola descarga), conviene
cachearla igual que ya se cachea `/prevision`; y el IPMA pide (términos
de uso) avisar por email a `webmaster@ipma.pt` del uso que se le da al
servicio — decisión del usuario si se hace, no la puede hacer el robot.

---

**Hueco de los ríos vascos (Bizkaia): sin fuente abierta nueva — sigue
bloqueado en el mismo sitio ya documentado.** Comprobado en esta pasada:

- El caudal en tiempo real de los ríos de Bizkaia solo se publica de
  forma automatizable a través de la **API REST de Euskalmet**
  (`opendata.euskadi.eus/api-euskalmet/`), que **requiere API key** — la
  misma key de Euskalmet que `CLAUDE.md` ya documenta como pendiente (el
  email con la key nunca llegó, en gestión manual de Open Data Euskadi).
  No hay atajo abierto: el hueco de Bizkaia sigue dependiendo de esa key,
  tal como ya estaba anotado. No se propone nada nuevo aquí.
- **Gipuzkoa** (Diputación Foral, red distinta de Bizkaia) sí tiene
  página de datos en tiempo real de ~23 estaciones de aforo
  (`gipuzkoa.eus/.../unean-uneko-datuak`), pero es un portlet Liferay sin
  endpoint JSON expuesto en el HTML — no automatizable sin inspeccionar
  las llamadas internas del navegador, que este robot no puede hacer de
  forma fiable. El dataset de Open Data Euskadi "Estaciones de aforos de
  los ríos de Gipuzkoa" (`api.gipuzkoairekia.eus/dataset/recurso/...`) es
  de frecuencia **anual** y solo describe qué parámetros mide cada
  estación (metadatos), NO da el caudal actual — no sirve para tiempo
  real. (Nota: si algún día se resuelve la key de Euskalmet, esa misma
  API cubriría también las estaciones de Gipuzkoa, que ahora tiene spots
  costeros nuevos — Deba, Zarautz, Orio, Hondarribia — cuyos ríos
  Deba/Urola/Oria/Bidasoa quedarían enriquecibles.)

**Lead sin verificar para caudal de ríos de Portugal (SNIRH/APA)**: el
Sistema Nacional de Informação de Recursos Hídricos (`snirh.apambiente.pt`)
publica datos hidrométricos (nivel/caudal) de los ríos portugueses de
forma libre y gratuita, y hay un dataset asociado en
`dados.gov.pt` ("Rede de estações hidrométricas (SNIRH)"). **No
verificado en esta pasada**: el portal devolvió `403` a la petición
automática (bloquea user-agents de bot), así que no se localizó todavía
un patrón de URL de exportación de la serie de una estación concreta.
Queda como candidato a investigar en una próxima pasada de caudal —
igual que se hizo con las 4 confederaciones hidrográficas españolas ya
integradas (Cantábrico/Júcar/Segura/Galicia), habría que dar con el
endpoint real de datos y verificarlo con una petición de verdad antes de
proponer nada.

**Fuentes:**
[IPMA — API open data (observación meteorología)](https://api.ipma.pt/),
[URA — Datos de estaciones de aforo](https://www.uragentzia.euskadi.eus/datos-de-estaciones-de-aforo/webura00-contents/es/),
[Euskalmet — API Rest (Open Data Euskadi)](https://opendata.euskadi.eus/api-euskalmet/-/api-de-euskalmet/),
[Gipuzkoa — Datos en tiempo real (Obras Hidráulicas)](https://www.gipuzkoa.eus/es/web/obrahidraulikoak/hidrologia-eta-kalitatea/unean-uneko-datuak),
[SNIRH — APA (Portugal)](https://snirh.apambiente.pt/),
[Rede de estações hidrométricas (SNIRH) — dados.gov.pt](https://dados.gov.pt/pt/datasets/rede-de-estacoes-hidrometricas-snirh/).

**Firmado:** robot buscador de fuentes (pasada de caudal de ríos y
estaciones de monte, España y Portugal), 2026-09-15 09:30 UTC.

### 2026-09-15 10:14 UTC (pasada buscadora — cámaras de imagen fija que rotan/PTZ y muestran tierra en vez de mar)

**Objetivo de la pasada:** el bug real reportado por el usuario (ver
`ROBOT_REGLAS.md`, sección añadida 2026-09-15) — vio una webcam de
**imagen fija** mostrando solo playa/tierra en vez del mar, probable
cámara física que rota/PTZ entre encuadres. Auditar las ~40 entradas de
`WEBCAMS` en `functions/webcam/[slug].js` para, por proveedor,
comprobar: (1) si documenta que la cámara es rotativa/PTZ, y (2) si su
URL/API admite pedir un preset/encuadre concreto apuntando al mar. Sin
visión artificial (ya se descartó ese enfoque el 2026-09-15).

**Hallazgo principal — la mayor parte de nuestras cámaras son FIJAS por
diseño, no pueden rotar:** una porción grande de la lista pertenece a la
familia de **videometría costera** (KOSTASystem de AZTI, SIRENA, y el
sistema MOBIMS/BEAMON de SOCIB). Esta tecnología hace fotogrametría de
la costa (extracción de línea de orilla, timex, etc.), lo que **exige un
punto de vista estable** — una cámara que se moviera invalidaría el
análisis. Confirmado en la documentación de los propios proveedores
(AZTI/KOSTASystem: "cámaras que capturan desde un punto de vista fijo
tratado con técnicas fotogramétricas"; SOCIB/MOBIMS: sistema de 5
cámaras fijas por estación, cada una cubriendo un sector `c01`–`c05`).
Entran aquí, y por tanto **no son candidatas al bug**:
- Mundaka (`kostasystem.com`).
- Sopelana, Lekeitio, Getxo (`detectia.net`, AZTI — mismo KOSTASystem).
- Bakio (`pyscada.isurki.com`, la propia URL contiene `sirena/aditu` —
  es una estación SIRENA).
- Cala Millor, Son Bou, Muro (`apps.socib.es/beamon`, SOCIB/MOBIMS).

Detalle útil de SOCIB para el futuro: cada estación BEAMON expone varias
cámaras fijas (`c01`…`c05`), cada una a un sector distinto. Usamos `c01`.
Si algún día `c01` de un spot enseñara demasiada playa, se podría
cambiar el código a otro sector fijo que mire más al mar — **pero eso
exige inspección visual de qué sector es cuál**, así que no se cambia a
ciegas (nunca se toca sin verificar cuál apunta al mar).

**Proveedores donde NO se pudo descartar PTZ, pero que tampoco ofrecen
preset por URL:** MeteoGalicia (9 cámaras: Baiona, A Coruña, Camariñas,
Cangas, Corrubedo, Ribadeo, Ons, Portosín, Cíes), Gobierno de Cantabria
(6: Suances, Castro Urdiales, Laredo, San Vicente, Comillas, Santoña) y
Turisme Comunitat Valenciana (28 cámaras de playa). Buscada
documentación de tipo de cámara (PTZ/rotación) en cada proveedor sin
encontrar una fuente clara que lo confirme ni lo descarte. Lo **decisivo
para la tarea**: ninguna de las tres familias expone un parámetro de
preset/posición en la URL — todas sirven un **único "último frame"** por
cámara (`.../ultima.jpg`, `.../<nombre>-New-<n>.jpg`,
`.../webcam_mini.png`). Aunque alguna de estas cámaras fuera físicamente
PTZ y cayera a veces mirando a tierra, **no hay URL de preset
documentada y verificable** para fijarla al mar. Por la regla explícita
de `ROBOT_REGLAS.md` (nunca inventar un parámetro no documentado ni
verificado), no se propone ningún cambio de URL para estas.

**Resultado neto: sin cambios de código.** No se encontró ninguna URL de
preset/encuadre real y verificable para ninguna cámara, y ninguna de las
cámaras de imagen fija de nuestra lista resultó ser demostrablemente PTZ
con encuadre configurable por URL. La mayoría (familia videometría/
SIRENA/KOSTASystem/SOCIB) son fijas por diseño y quedan descartadas como
causa del bug.

**Limitación conocida y siguiente paso más útil:** el usuario no indicó
QUÉ webcam concreta vio mostrando tierra. Sin ese dato no se puede
reproducir el caso exacto ni saber si es una de las de MeteoGalicia/
Cantabria/Valencia (las únicas no-fijas-por-diseño). **Recomendación
registrada para el usuario:** si anota el slug de la cámara que mostró
tierra, la próxima pasada puede centrarse en ese proveedor concreto (y,
si es PTZ sin preset, la conclusión sería reemplazar esa cámara por otra
fuente estable, no intentar fijar un encuadre inexistente).

**Fuentes:** [AZTI — KOSTASystem: Videometry and coastal applications](https://www.azti.es/en/productos/kostasystem-videometry-and-coastal-applications/),
[SOCIB BEAMON — About us](https://help.beamon.socib.es/home/about-us),
[SOCIB BEAMON — Cala Millor (cámaras c01–c05)](https://apps.socib.es/beamon/filtering?station=clm&group=clm&cameras=c05&product=snapshot),
[MeteoGalicia — Servicio de panel de cámaras web (PDF)](https://www.meteogalicia.gal/datosred/infoweb/meteo/docs/observacion/camaras/servizopanelcamaras_es.pdf),
[Ayuntamiento de Suances — WebCams Municipales](https://suances.es/webcams-municipales/).

**Firmado:** robot buscador de fuentes (pasada de webcams — auditoría
PTZ/rotación), 2026-09-15 10:14 UTC.

### 2026-09-15 13:13 UTC (pasada buscadora — webcams para spots sin cámara)

**Objetivo de la pasada:** misma tarea recurrente (buscar cámaras nuevas
para spots fijos sin cámara). Punto de partida: recontados los spots sin
cámara cruzando `SPOTS`/regionales de `index.html` contra
`SPOTS_CON_WEBCAM` — **48 spots fijos siguen sin cámara** (Portugal
entero, Canarias, buena parte de Andalucía y del Mediterráneo, más
Plentzia, Santander, Sanxenxo, A Guarda, Pasaia, Ondarroa, Getaria,
Zumaia, Llanes, Ribadesella...). No pude priorizar por `spots_usuario`
(la regla lo pide primero) porque esta pasada no tiene token de sesión
para consultar esa tabla y no hay contador de actividad accesible sin
credenciales — así que centré la búsqueda en los huecos de spots fijos.

**Red desde este runner:** `meteogalicia.gal` `200`, `detectia.net`
`200`. **`cantabria.es` sigue sin ser alcanzable** (`HTTP 000`/timeout
pidiendo `suances-New-85.jpg`, una imagen ya integrada) — mismo bloqueo
que las pasadas del 2026-09-13/14/15 08:20, así que la cámara de
Santander/El Sardinero sigue **sin poder verificarse** desde aquí (la
pista firme de aquellas pasadas —`cantabria.es/ftp_webcam/<nombre>-New-<id>.jpg`
desde `cantabria.es/webcams`— queda igual de válida y pendiente de
comprobación manual desde un navegador normal).

**Re-inventario autoritativo de AZTI (`detectia.net`), el proveedor de
Sopelana/Lekeitio/Getxo — hallazgo nuevo respecto a pasadas
anteriores.** `detectia.net` no publica lista de cámaras, así que sondeé
por nombre de fichero (`webcam-<lugar>.webp`) y **descargué de verdad**
cada candidato que respondió. Resultado del conjunto realmente servido:

| Fichero | Estado | Corresponde a |
|---|---|---|
| `webcam-sopelana-azti3.webp` | ✅ 200, WebP real ~96 KB | Sopelana (ya integrado) |
| `webcam-lekeitio.webp` | ✅ 200, WebP real ~121 KB | Lekeitio (ya integrado) |
| `webcam-ereaga.webp` | ✅ 200, WebP real ~66 KB | Getxo/Ereaga (ya integrado) |
| `webcam-mundaka.webp` | ✅ 200, WebP real ~80 KB | **Mundaka** (hoy vía `kostasystem.com`) |
| `webcam-bakio.webp` | ✅ 200, WebP real ~59 KB | **Bakio** (hoy vía `pyscada.isurki.com`) |

Lo **nuevo y útil**: AZTI también sirve Mundaka y Bakio, dos spots que
hoy tiran de OTRO proveedor. No es un spot nuevo, pero sí una **fuente
de respaldo verificada** para esos dos por si `kostasystem` o `pyscada`
dejan de responder algún día (mismo patrón y mismo proveedor que las 3
cámaras AZTI ya integradas). No lo integro ni lo propongo como cambio:
las dos cámaras actuales funcionan, y tocar `functions/webcam/[slug].js`
sería propuesta y no commit directo por la red de seguridad de
`ROBOT_REGLAS.md` de todos modos — se anota aquí como opción de fallback
lista para usar si hiciera falta.

**Euskadi — huecos exhaustivamente descartados en AZTI.** Probé (y todos
dieron 404 real, no imagen) los nombres de los spots vascos sin cámara y
sus playas: `plentzia`, `ondarroa`, `getaria`, `zumaia`, `pasaia`, más
variantes por nombre de playa (`gorliz`, `laga`, `laida`, `arrigunaga`,
`concha`/`laconcha`, `zurriola`, `hondarribia`, `saturraran`,
`karraspio`, `isuntza`, `itzurun`, `malkorbe`, `orio`, `santiago`,
`zarautz`...). **AZTI/detectia no tiene cámara para ninguno** — su
inventario real se limita a los 5 de la tabla de arriba. Plentzia sigue,
como en pasadas anteriores, sin más opción que agregadores de terceros o
una IP-cam de escuela de surf en crudo (no institucional), así que
queda sin cámara.

**Canarias (Las Canteras, El Médano):** vuelto a comprobar en vivo —
las páginas de `canariaslife.com` solo exponen fotos estáticas de
artículo (`wp-content/uploads/...jpg`), el feed en directo va por un
reproductor de terceros embebido (Canarian Surf Fruit / SkylineWebcams),
sin `.m3u8`/`img` directo ni CORS confirmado. Confirma lo que ya cerró la
pasada del 2026-09-15 08:20: sin fuente institucional con imagen directa,
no se inventa una URL. Queda sin cámara.

**Resultado neto de la pasada: sin novedades integrables** para ningún
spot fijo sin cámara. Lo único nuevo y aprovechable es la fuente de
respaldo AZTI verificada para Mundaka y Bakio (anotada arriba). Sin
cambios de código.

**Fuentes:** [detectia.net (AZTI)](https://detectia.net/),
[CanariasLife — Las Canteras](https://canariaslife.com/en/webcams-of-gran-canaria/las-palmas-de-gran-canaria/las-canteras-beach/),
[Meteocantabria — Webcams](https://www.meteocantabria.es/meteocantabria/webcam/view).

**Firmado:** robot buscador de fuentes (pasada de webcams), 2026-09-15
13:13 UTC.

---

### 2026-09-15 13:31 UTC (pasada buscadora — corrientes marinas por zona)

**Qué se buscó:** continuación de la pasada de corrientes del 2026-09-14
19:37 UTC (ver más arriba). Aquel día se verificó en vivo UN dataset de
radar HF (canal de Ibiza, vía ERDDAP de EMODnet Physics) y se dejaron
Galicia y el delta del Ebro solo citados. Esta pasada ha rastreado el
catálogo entero de EMODnet Physics ERDDAP para ver qué zonas de la costa
de España y Portugal (el ámbito real de Costaviva, no solo el
Cantábrico) tienen radar HF consumible por REST, y si esos datos están
vivos hoy o congelados.

**Este runner SÍ tiene salida de red** (a diferencia de la sesión
nocturna en la nube, bloqueada por egress proxy — ver 2026-08-31): `curl`
a `erddap.emodnet-physics.eu` devuelve `200`, así que se ha podido
verificar todo con peticiones HTTP reales, no solo por búsqueda.

**Hallazgo principal, verificado en vivo:** EMODnet Physics ERDDAP
publica 56 datasets con "HFRADAR", y hay DOS familias distintas para las
mismas zonas — importa mucho cuál se usa:
- `HFRADAR_<zona>_Totals` — **archivo/agregación, CONGELADO**. El de
  Galicia acaba en `2024-02-29`; Ibiza/Ebro/PLOCAN/Gibraltar/South en
  torno a `2026-07-30/31`; Lisboa en `2026-02-04`. Inservible para
  tiempo real.
- `EUHFR_NRTcurrent_HFR-<zona>-Total` — **Near Real Time, VIVO hoy**.
  `time_coverage_end` comprobado uno a uno el 2026-09-15:

  | Zona (dataset NRT) | Institución | Última hora disponible |
  |---|---|---|
  | Galicia | INTECMAR-Xunta / PdE / IH | 2026-09-15 09:00Z |
  | Lisboa (Portugal) | Instituto Hidrográfico | 2026-09-15 11:00Z |
  | Gibraltar (cerca G. de Cádiz) | Puertos del Estado | 2026-09-15 10:00Z |
  | Ibiza | SOCIB | 2026-09-15 11:00Z |
  | PLOCAN (Canarias) | PLOCAN | 2026-09-14 05:00Z |
  | **EUSKOOS (Euskadi/Golfo de Bizkaia)** | **AZTI; Ifremer** | **2026-07-16 08:00Z (CONGELADO)** |

  Es decir: la familia NRT cubre las cuatro zonas del código de Costa
  Viva (`ESPECIES` atlántico N, `_MEDITERRANEO` vía Ibiza/Ebro,
  `_GOLFO_CADIZ` vía Gibraltar/South, `_CANARIAS` vía PLOCAN, y Portugal
  vía Lisboa/South) con radar HF de OBSERVACIÓN real, hora a hora.

**Caveat importante y contraintuitivo:** la única zona parada es
**EUSKOOS (AZTI), que es justo la costa de casa de la app** (Bilbao,
Bermeo, Getaria, Pasaia... — cobertura lat 43.32–44.58, lon −3.20 a
−1.20, confirmada en los metadatos). Su feed NRT en EMODnet no se
actualiza desde el 2026-07-16 — no es un fallo nuestro, es el mirror de
EMODnet el que está detenido para esa zona. Si algún día se integra
esto, el dato de radar para el Cantábrico oriental habría que buscarlo
en la fuente propia de AZTI/Euskoos (THREDDS), no en EMODnet — y AZTI
enlaza con la vía Euskalmet que sigue bloqueada del lado de ellos (ver
`CLAUDE.md`, estaciones de monte). Para el resto de zonas, EMODnet vale.

**Cadena completa verificada de extremo a extremo (petición real →
número real):** consultado el griddap NRT de Galicia para la última hora
(`2026-09-15 11:00Z`), devuelve 51 celdas con corriente real de las
3807 de la rejilla (el radar solo cubre la franja donde solapan las
antenas, el resto es `null` — correcto, nunca se inventa dato). Ejemplo
real leído: lat 41.111, lon −9.648 → EWCT −0.035 m/s, NSCT −0.249 m/s →
módulo 0.25 m/s (0.49 nudos). Variables por dataset: `EWCT`/`NSCT`
(componentes E-O y N-S, m/s), `EWCS`/`NSCS` (incertidumbre), y flags de
calidad (`QCflag`, `CSPD_QC`, `VART_QC`, `GDOP`...). Resolución `PT1H`
(horaria), processing level 3B, gestionado por el nodo europeo de radar
HF de EuroGOOS.

**Acceso y licencia:** REST puro, sin login — griddap `.json`/`.csv` por
`[time][depth][lat][lon]` en `erddap.emodnet-physics.eu`. Licencia
**Creative Commons (CC-BY)** con cita obligatoria al EuroGOOS European
HFR Node y a las instituciones de cada zona (Puertos del Estado,
INTECMAR-Xunta, Instituto Hidrográfico, SOCIB, AZTI, PLOCAN según
corresponda). Sin cuota por-ubicación tipo Open-Meteo, pero conviene
cachear igual (patrón `/prevision`).

**Por qué SOLO propuesta, no implementación** (misma razón que la pasada
del 2026-09-14, ver `ROBOT_REGLAS.md`): integrarlo tocaría
`functions/prevision.js` (por encima del límite de volumen) y es una
decisión de producto — el radar HF solo cubre unas pocas franjas
costeras concretas (no los ~95 spots fijos, y con muchas celdas `null`
incluso dentro de su zona), así que hay que decidir cómo mezclar
"corriente observada real por radar donde la hay" con "el modelo de
Open-Meteo (`ocean_current_velocity`) en el resto" sin confundir al
usuario sobre qué es observación y qué es modelo. Además, cada zona
añadiría una sub-petición más a `/prevision`, que ya está cerca del
límite de 50 de Cloudflare (ver `ROBOT_REGLAS.md`) — habría que hacerlo
como endpoint aparte o bajo demanda al abrir un spot, no en la pasada
general. No se ha tocado código.

**Propuesta concreta para el usuario, si se retoma:** empezar por
Galicia o Ibiza (NRT, ya verificados vivos hoy) como prueba de concepto
de "corriente observada por radar HF", mostrada SOLO al abrir un spot de
esa zona y etiquetada claramente como observación (distinta del modelo
Open-Meteo). Antes de proponer cualquier mezcla o factor, calibrar la
lectura del radar contra el `ocean_current_velocity` de Open-Meteo en
esos mismos puntos y anotarlo en `CALIBRACION.jsonl` (mismo patrón que
oleaje y coeficiente de marea). Para el Cantábrico oriental (Euskadi),
NO usar EMODnet mientras siga congelado desde julio — dejarlo pendiente
de la vía AZTI/Euskalmet propia.

**Fuentes:**
[EMODnet Physics ERDDAP](https://erddap.emodnet-physics.eu/erddap/search/index.html?searchFor=HFRADAR),
[dataset NRT Galicia (verificado vivo)](https://erddap.emodnet-physics.eu/erddap/info/EUHFR_NRTcurrent_HFR-Galicia-Total/index.html),
[dataset NRT EUSKOOS (congelado)](https://erddap.emodnet-physics.eu/erddap/info/EUHFR_NRTcurrent_HFR-EUSKOOS-Total/index.html).

**Firmado:** robot buscador de fuentes (pasada de corrientes marinas),
2026-09-15 13:31 UTC.

---

### 2026-09-15 18:35 UTC (pasada buscadora — corrientes marinas por zona)

**Qué se buscó:** cerrar el hueco que dejó abierto la pasada anterior
(2026-09-15 13:31 UTC): el radar HF de **EUSKOOS (AZTI, Golfo de
Bizkaia)** — justo la costa de casa de la app — está **congelado desde
el 2026-07-16 en el mirror de EMODnet Physics**, y aquella pasada dejó
apuntado que, si se retoma, el dato para el Cantábrico oriental habría
que buscarlo en la **fuente propia de AZTI/EuskOOS (THREDDS)**, no en
EMODnet. Esta pasada ha ido a verificar en vivo si ese THREDDS propio
existe, está accesible por REST y sirve dato actual.

**Hallazgo principal, verificado con peticiones HTTP reales:** el
servidor THREDDS nativo de EuskOOS existe y responde —
`https://thredds.euskoos.eus/thredds/catalog.xml` → `200`. Publica los
productos de radar HF de las dos antenas de la red (Matxitxako + Higer):
radiales (`MATX`/`HIGE`), **totales combinados** (`TOTL`, `OMA`,
`2DVAR`), FSLE, y mareógrafos. Servicios OPeNDAP (`/thredds/dodsC/`),
DAP4, HTTPServer y WMS abiertos, sin login. Cobertura de la rejilla de
totales confirmada en los metadatos: **lat 43.3–44.6, lon −3.2 a −1.2**
(Golfo de Bizkaia / Euskadi — Bilbao, Bermeo, Getaria, Pasaia...),
rejilla 29×32 celdas, resolución horaria, variables `EWCT`/`NSCT`
(componentes E-O y N-S de la corriente superficial, m/s) más
incertidumbres (`EWCS`/`NSCS`) y flags de calidad (`CSPD_QC`, `GDOP`...)
— mismo esquema estándar de radar HF que los datasets NRT de EMODnet ya
vistos.

**El servidor SÍ ingesta dato actual hoy (probado en vivo):** el CSV del
mareógrafo de Txingudi
(`/thredds/fileServer/mareografos/R4C_Txingudi_Obscape_TG_4466.csv`)
tiene su última fila en **`2026-09-15 18:00:00`** (minutos antes de esta
pasada) — es decir, el THREDDS de EuskOOS está vivo y actualizándose al
minuto, a diferencia del mirror de EMODnet. La costa de casa SÍ tiene
fuente propia viva.

**Caveat importante, verificado también en vivo — no es "coger la
agregación y ya":** las agregaciones cómodas FMRC "best time series"
(`/thredds/dodsC/fmrc/HFR-EUSKOOS-TOTL/HFR-EUSKOOS-TOTL_best.ncd`, y las
equivalentes de radiales `-MATX`/`-HIGE`) están **rotas/congeladas**:
las tres devuelven un único paso temporal fijado en **2023-05-31**
(leído el valor real de la variable `TIME`: 26813.75 / 26813.79 días
desde 1950-01-01 → 2023-05-31 18:00–19:00 UTC), claramente una
agregación mal configurada del servidor, NO el horizonte real del dato
(los mareógrafos del mismo servidor van a hoy). Y los resolvers
`latest.xml` de los datasetScan (`/thredds/catalog/TOTL/latest.xml`)
devuelven `500`; el catálogo plano de ficheros (`/thredds/catalog/TOTL/
catalog.xml`) es tan grande que agota el timeout (>60s) al listarlo.
**Conclusión:** el dato de radar horario vivo existe y está en el
servidor, pero NO es accesible por la vía trivial de la agregación —
para leer la última hora habría que averiguar la convención de nombre
de los ficheros `.nc` por hora dentro del datasetScan `TOTL`/`OMA` y
pedirlos uno a uno por OPeNDAP; esta pasada no ha conseguido enumerar
ese catálogo (demasiado grande / timeout), así que **no se ha
confirmado una lectura de corriente de la hora actual**, solo que la
fuente está viva (mareógrafo al minuto) y que la agregación fácil no
sirve.

**Por qué SOLO propuesta, no implementación** (igual que las dos pasadas
de corrientes anteriores, ver `ROBOT_REGLAS.md`): integrar radar HF
tocaría `functions/prevision.js` (por encima del límite de volumen para
aplicar directo) y es una decisión de producto — mezclar "corriente
observada por radar donde la hay" con "el modelo Open-Meteo en el
resto", y además cada zona sería una sub-petición más a `/prevision`,
que ya está cerca del límite de 50 de Cloudflare (ver `ROBOT_REGLAS.md`)
→ tendría que ser un endpoint aparte o bajo demanda al abrir un spot. No
se ha tocado código.

**Próximo paso concreto para una futura pasada (si se retoma EuskOOS):**
enumerar el datasetScan `TOTL` (o `OMA`, que suele ser el producto
operacional de totales) en trozos — probablemente hay subcarpetas por
año/mes que sí se listan rápido — para sacar el nombre del fichero de la
última hora y confirmar una lectura de corriente real vía OPeNDAP
`.ascii?EWCT[...]`/`NSCT[...]`. Una vez confirmada, calibrarla contra el
`ocean_current_velocity` de Open-Meteo en esos mismos puntos y anotarlo
en `CALIBRACION.jsonl` (mismo patrón que oleaje y coeficiente de marea),
antes de proponer cualquier mezcla. Con esto, EuskOOS/AZTI queda como la
vía viva para el Cantábrico oriental que EMODnet no da (frozen desde
julio), cerrando el único hueco de zona que dejó la pasada del 13:31.

**Licencia y cita:** datos de EuskOOS — Euskalmet (Gobierno Vasco) con
asesoría técnica de AZTI; si se integran, citar a EuskOOS/Euskalmet/AZTI
(y al nodo europeo de radar HF de EuroGOOS según el producto), mismo
criterio de atribución que EMODnet.

**Fuentes:**
[EuskOOS THREDDS (verificado vivo)](https://thredds.euskoos.eus/thredds/catalog.html),
[plataforma info.euskoos.eus](https://info.euskoos.eus/en/),
[EuskOOS en AZTI](https://www.azti.es/productos/euskoos-sistema-vasco-de-oceanografia-operacional/).

**Firmado:** robot buscador de fuentes (pasada de corrientes marinas),
2026-09-15 18:35 UTC.

### 2026-09-15 23:12 UTC (pasada buscadora — presión atmosférica e histórico por zona)

**Qué se buscó y por qué:** las dos pasadas previas de este mismo tema
(2026-09-14 23:31 y 2026-09-15 13:33, más arriba) ya cubrieron el
**reanálisis por coordenada** (Open-Meteo Historical Weather API / archivo
ERA5 + Historical Forecast API, verificados) y la **observación por
estación** vía AEMET (España, sin poder probar el histórico diario por
falta de `AEMET_API_KEY`) e IPMA (Portugal, verificado en vivo). Para no
repetir, esta pasada fue al hueco que quedaba: una fuente de **histórico
observado por estación, profundo (décadas) y bulk**, que sirva para
backfill de `presion_historico` hacia atrás y como referencia de
calibración — cubriendo España y Portugal a la vez.

**Nota de entorno:** este runner tiene salida de red a dominios de datos
(a diferencia de las pasadas de agosto, ver 2026-08-31) — todo lo de abajo
se verificó con peticiones HTTP reales, no solo por búsqueda.

**Hallazgo 1 verificado en vivo — Meteostat (bulk data interface):**
observación histórica por estación, sin autenticación ni API key.
- Catálogo de estaciones (`https://bulk.meteostat.net/v2/stations/lite.json.gz`,
  ~806 KB, `200`): 15.931 estaciones globales, cada una con `id`,
  coordenadas (`location.latitude/longitude/elevation`) e identificadores
  `wmo`/`icao`. **104 estaciones en España, 39 en Portugal** — suficiente
  para curar por coordenada las costeras cercanas a cada spot, igual que
  `ESTACIONES_AEMET`. Ej. verificado: `08025` = "Bilbao / Sondica",
  `[43.3, -2.9333]`, WMO 08025 / ICAO LEBB.
- Serie horaria por estación (`https://bulk.meteostat.net/v2/hourly/08025.csv.gz`,
  ~3 MB, `200`): CSV horario con columnas
  `date,hour,temp,dwpt,rhum,prcp,snow,wdir,wspd,wpgt,pres,tsun,coco` — la
  **11ª columna `pres` es presión real en hPa**. Verificado en vivo:
  Bilbao arranca en **1973-01-01** (`pres` 1025.3 hPa) y la última fila
  del fichero descargado hoy era **2025-09-13** (1018.2 hPa). Décadas de
  observación real, en un solo fichero por estación.

**Pega importante de Meteostat — licencia CC BY-NC 4.0 (no comercial):**
confirmado en su web de términos/licencia y por búsqueda. Meteostat no
posee los datos (los agrega de servicios públicos: NOAA, DWD...), pero
**redistribuye bajo Creative Commons Attribution-NonCommercial 4.0** — la
cláusula NC es un problema real ahora que Costaviva tiene paywall de
suscripción (ver `CLAUDE.md`, Stripe 2026-09-15). Por eso Meteostat queda
como **referencia de calibración/contraste offline** (comparar nuestra
tendencia de presión contra observación real), NO como fuente servida
dentro de la app de pago. Para eso, el hallazgo 2:

**Hallazgo 2 verificado en vivo — NOAA NCEI "Global Hourly" (ISD), la
alternativa de dominio público:** misma naturaleza (presión observada por
estación, décadas de profundidad) pero **dominio público** (obra del
gobierno de EE.UU., sin cláusula NC — apta para uso comercial), sin API
key. CSV por año y estación:
`https://www.ncei.noaa.gov/data/global-hourly/access/2024/08025099999.csv`
(`200`, ~9,3 MB, 25.627 filas para Bilbao 2024). Trae `STATION`, `DATE`,
`LATITUDE`, `LONGITUDE` y la columna **`SLP`** (presión a nivel del mar):
formato codificado en décimas de hPa + flag de calidad (ej. `10200,1` =
1020.0 hPa; centinela de ausente `99999`). Es la misma fuente primaria de
la que Meteostat bebe, pero sin el intermediario ni la licencia NC.

**Encaje / utilidad concreta:** cualquiera de las dos permitiría backfill
observado real de `presion_historico` (complementario al reanálisis ERA5
de Open-Meteo ya documentado) y calibrar la tendencia de presión que
`ROBOT_REGLAS.md` (sección "Variables adicionales para el índice de
pesca") apunta como candidata a mejorar `indicePesca`. Para una app de
pago, la vía correcta es NCEI/ISD (dominio público) o el archivo de
Open-Meteo (CC BY 4.0), reservando Meteostat solo para contraste interno.

**Aviso de cuota:** ambas son bulk-por-estación (un fichero cubre toda la
serie histórica de una estación), no por-ubicación como la Marine API de
Open-Meteo — así que no multiplican cuota al estilo de `ROBOT_REGLAS.md`
(sección de cuota Open-Meteo). Ficheros grandes (MB), conviene bajarlos
por lotes/una vez y cachear, nunca en caliente dentro de `/prevision`.

**Flag colateral, fuera del alcance de presión pero relevante y nuevo
(anotado, no investigado a fondo aquí):** al mirar licencias salió que el
propio Open-Meteo se declara "free for non-commercial use" (el uso
comercial requiere su plan de pago), y la app ya depende de Open-Meteo
para casi todo. Con el paywall recién lanzado, merecería una revisión
dedicada de si el uso actual de Open-Meteo (y de cualquier otra fuente
"gratis solo no comercial") encaja con una app de pago — es una cuestión
legal/de producto, no algo que este robot deba resolver ni tocar; solo
queda apuntada aquí para que el usuario la valore.

**Por qué solo propuesta, no implementación** (ver `ROBOT_REGLAS.md`):
integrar cualquiera de estas tocaría `functions/` (endpoint de backfill o
`ESTACIONES_*` nuevas + parseo) y/o `supabase/`, por encima del límite de
volumen para aplicar directo; y usar la tendencia de presión como
modificador de `indicePesca` es decisión de producto. No se ha tocado
código — solo esta entrada de bitácora.

**Fuentes:**
[Meteostat — Bulk Data](https://dev.meteostat.net/data/bulk),
[Meteostat — Terms & License (CC BY-NC 4.0)](https://dev.meteostat.net/terms.html),
[NOAA NCEI — Global Hourly (ISD)](https://www.ncei.noaa.gov/products/land-based-station/integrated-surface-database).

**Firmado:** robot buscador de fuentes (pasada de presión atmosférica e
histórico por zona), 2026-09-15 23:12 UTC.

---

### 2026-09-16 01:42 UTC (pasada buscadora — estudios institucionales/académicos tipo DIGIPESCA, España y Portugal)

**Qué se buscó:** dar continuidad a la pasada de DIGIPESCA del 2026-09-15
09:18 UTC, que dejó explícitamente pendiente lo más importante: DIGIPESCA
(UPV) solo cubre **Mediterráneo español + Atlántico de Andalucía** y NO el
Cantábrico ni Galicia, que es justo donde está el grueso de spots y
usuarios de Costaviva. Esta pasada buscó los **equivalentes
institucionales** de datos de especie · lonja/puerto · mes · precio/volumen
para las zonas que DIGIPESCA no toca (Cantábrico/Euskadi, Galicia) y para
**Portugal** (ámbito geográfico ya declarado en `ROBOT_REGLAS.md`: España
y Portugal enteros). Solo propuesta, no se ha tocado `ESPECIES`,
`indicePesca` ni ningún fichero de código — únicamente esta entrada.

**Qué se encontró (todo verificado con `WebFetch`/`WebSearch` reales, no de
memoria — cada fuente confirmada con una petición HTTP que devolvió
contenido real):**

1. **Gobierno Vasco — "Subastas en lonja de bajura" (el hallazgo más
   relevante, cubre la zona con más spots).** Estadística oficial de
   Eustat/Gobierno Vasco, publicada también en **Open Data Euskadi**.
   Desglose por **especie principal · punto de venta (lonja/puerto) ·
   periodo**, con **cantidad y valor**. Rango largo (evolución **1985–2025**,
   última actualización 03/07/2026), descargable en formatos abiertos
   (**XLSX y CSV**; Open Data Euskadi además ofrece API/JSON/XML). Sin
   registro aparente. **Lo más importante para nuestras reglas: la propia
   fuente separa de raíz "bajura" de "altura"** — el dataset se titula
   literalmente "subastas en lonja de **bajura**" (pesca cercana a la costa
   con embarcaciones pequeñas), que es exactamente la distinción que
   `ROBOT_REGLAS.md` exige aplicar a mano con DIGIPESCA. Aquí viene ya
   hecha por el organismo. Verificado en:
   `euskadi.eus/.../estadistica/subastas_lonja_bajura/`. Granularidad
   temporal confirmada solo a nivel anual desde los títulos; queda por
   confirmar si el desglose descargable llega a mensual (una futura pasada
   debería bajar un XLSX real y mirarlo, como se hizo con el `.xlsx` de
   DIGiPESCA).

2. **Pesca de Galicia (Xunta) — "Cotizacións nas lonxas".** Plataforma
   tecnolóxica da pesca (`pescadegalicia.gal`). Herramienta de consulta por
   **fecha de venta · lonxa/zona de producción · especie**, con
   **cantidad, importe y precio medio/mínimo/máximo**, agrupable por
   **últimos 30 días / últimos 12 meses / últimos 10 años**. Datos de las
   notas de primera venta de las 65 lonjas gallegas, con opción de
   descarga. **Ventaja sobre DIGIPESCA: no es un histórico estático
   2010–2021, sino que llega casi al día** (Idapes/DIGIPESCA son series
   cerradas; esta se alimenta de la primera venta reciente). El dataset
   machine-readable equivalente está en datos.gob.es ("Primera venta de
   productos pesqueros frescos", Xunta de Galicia, **actualización diaria**,
   licencia **CC BY-SA 4.0**). Cubre exactamente el hueco de Galicia que
   DIGIPESCA dejaba fuera. Verificado en
   `pescadegalicia.gal/informe-cotizaciones-lonjas/agregation` y
   `datos.gob.es/.../primera-venta-de-productos-pesqueros-frescos1`.

3. **Idapes — Junta de Andalucía (mejora sobre DIGIPESCA para el Golfo de
   Cádiz).** "Consultas estadísticas pesqueras": primera venta de pesca
   fresca en lonja **por especie (agrupada en crustáceos/moluscos/peces) ·
   lonja/puerto de Andalucía · año y mes**, series desde **2000 hasta
   2026**. Sin registro aparente. Más actual y granular que DIGIPESCA para
   la misma zona (Atlántico de Andalucía / Golfo de Cádiz), donde Costa
   Viva sí tiene spots (`ESPECIES_GOLFO_CADIZ`). Verificado en el
   `FrontController?action=ConsultarPrecios` de
   `juntadeandalucia.es/agriculturaypesca/idapes`.

4. **Portugal — DGRM "Estatísticas Mensais da Pesca" + dados.gov.pt
   "Capturas nominais de pescado (t)".** DGRM (`dgrm.pt/estatisticasmensais`)
   publica descargas **mensuales** por especie y puerto (solo territorio
   nacional, desembarques en puertos portugueses). El portal de datos
   abiertos `dados.gov.pt` tiene además el dataset **"Capturas nominais de
   pescado (t) por Porto de descarga (NUTS-2013) e Espécie"** (fuente
   INE/DGRM, licencia **CC BY 4.0**), aunque este último es **anual, no
   mensual**. Cubre el hueco de Portugal (`ESPECIES` por defecto incluye el
   Portugal atlántico). Verificado en
   `dados.gov.pt/.../capturas-nominais-de-pescado-t/` y la búsqueda de
   `dgrm.pt/estatisticasmensais`.

**Cruces obligatorios de `ROBOT_REGLAS.md` aplicados a estas fuentes antes
de proponer nada (todas quedan como fuente candidata, no como dato
aplicado):**

- **Bajura vs altura:** el dato de todas ellas es *puerto de venta*, no
  *zona de captura*. Solo es proxy razonable de "se pesca cerca de aquí"
  para especies de bajura (`zona: "costa"` en `ESPECIES`). Para altura
  (`zona: "mar adentro"`: Bonito del norte, Dentón, Urta, Medregal…) el pez
  puede haberse capturado a cientos de km del puerto de venta — NO usar su
  volumen/precio de lonja como señal de zona. **La fuente vasca es la única
  que trae esta separación ya hecha por el organismo** (dataset de
  "bajura"); en Galicia/Andalucía/Portugal habría que filtrarla a mano por
  especie usando el campo `zona` que ya tenemos.
- **Hábitos/costumbres reales de captura:** "abundante+barato en lonja este
  mes" no implica "se pesca de costa" — muchas especies de bajura se
  capturan sobre todo desde embarcación o en fondos profundos cercanos,
  poco realistas a lanzado desde la orilla (ejemplo del pargo del propio
  usuario). Cualquier traducción de estos datos a "buen mes para pescar X
  desde la orilla en esta zona" exige cruzar con los hábitos reales de la
  especie; el dato de lonja por sí solo no lo distingue.
- **Localismos regionales:** los nombres de especie de estas fuentes son
  regionales (una lonja vasca puede etiquetar "antxoa/bokarta", una gallega
  "xouba", etc.). Antes de casar una fila de lonja con una especie de
  `ESPECIES` habría que mapear el nombre con cuidado y sin asumir que un
  término vale para otra zona — encaja con la responsabilidad de
  `sinonimos_especie` y con la de localismos por spot.

**Por qué solo propuesta, no implementación** (ver `ROBOT_REGLAS.md`):
integrar cualquiera de estas cambiaría lo que se muestra al usuario como
dato fiable (`ESPECIES`/`indicePesca`) y/o tocaría `functions/` — decisión
de producto por definición, siempre a confirmar. Además son históricos/
notas de primera venta, no un dato "en vivo" del estado del mar: su encaje
natural sería una *climatología mensual por especie de bajura y por zona*
(qué meses hay más volumen histórico de una especie de costa en las lonjas
de ESA costa), nunca un valor en tiempo real.

**Recomendación / siguiente paso para una futura pasada:** ahora que hay
una fuente institucional real por cada zona de la app (Euskadi→Gobierno
Vasco/bajura, Galicia→Pesca de Galicia, Andalucía→Idapes, Med.
español→DIGIPESCA, Portugal→DGRM), el trabajo pendiente es descargar un
fichero real de la vasca (la mejor por venir ya separada en bajura) y de la
gallega, comprobar si el desglose llega a mensual, y construir una tabla de
prueba especie·zona·mes·volumen solo con especies de bajura — para
enseñársela al usuario y que decida si quiere usarla como climatología
estacional. No se ha bajado ningún fichero grande en esta pasada (solo
verificación de existencia/estructura de cada portal), para no exceder el
alcance de una pasada buscadora.

**Fuentes:**
[Gobierno Vasco — Subastas en lonja de bajura](https://www.euskadi.eus/gobierno-vasco/-/estadistica/subastas-en-lonja-de-bajura/),
[Open Data Euskadi — Banco de datos de Pesca](https://www.euskadi.eus/gobierno-vasco/-/estadistica/banco-de-datos-pesca/),
[Pesca de Galicia — Cotizacións nas lonxas](https://www.pescadegalicia.gal/informe-cotizaciones-lonjas/agregation),
[datos.gob.es — Primera venta de productos pesqueros frescos (Xunta)](https://datos.gob.es/en/catalogo/a12002994-primera-venta-de-productos-pesqueros-frescos1),
[Idapes — Junta de Andalucía (primera venta en lonja)](https://www.juntadeandalucia.es/agriculturaypesca/idapes/servlet/FrontController?action=ConsultarPrecios&optSel=origen&ec=observatorio&id_menu=menu_1),
[DGRM — Estatísticas Mensais da Pesca](https://www.dgrm.pt/estatisticasmensais),
[dados.gov.pt — Capturas nominais de pescado (t) por porto e espécie](https://dados.gov.pt/en/datasets/capturas-nominais-de-pescado-t/).

**Firmado:** robot buscador de fuentes (pasada de estudios
institucionales/académicos tipo DIGIPESCA, España y Portugal),
2026-09-16 01:42 UTC.

### 2026-09-16 07:55 UTC (pasada buscadora — webcams para spots sin cámara)

**Objetivo:** tarea recurrente de buscar cámaras nuevas para spots fijos
sin cámara. Recontados los huecos cruzando `SPOTS`/regionales contra
`SPOTS_CON_WEBCAM`: siguen sin cámara Plentzia, Ondarroa, Zumaia,
Getaria, Pasaia, A Guarda, Sanxenxo, Llanes, Ribadesella, Santander,
casi toda Cataluña/Murcia/Andalucía/Canarias/Baleares fuera de las ya
integradas, y **Portugal entero (17 spots)**. Como en pasadas
anteriores, no pude priorizar por `spots_usuario` (sin token de sesión
ni contador de actividad accesible sin credenciales).

**Red desde este runner (GitHub Actions, no el sandbox web del
2026-08-31):** `meteogalicia.gal` `200`, `apps.socib.es` alcanzable.
**`cantabria.es` sigue en `HTTP 000`/timeout** (probado con
`Laredo-New-1.jpg`, ya integrada) — Santander/El Sardinero sigue **sin
poder verificarse** desde aquí, igual que todas las pasadas previas.
**`beachcam.meo.pt` bloquea IPs de datacenter** (`403` CloudFront tanto
por `curl` como por `WebFetch`) — la referencia lusa no es proxyable
desde edge; Portugal solo sería viable con HLS directo desde el
navegador del usuario (patrón Gipuzkoa), a descubrir desde un navegador
real, no desde esta automatización.

**Hallazgo de método (nuevo respecto a pasadas anteriores) — roster
autoritativo de MeteoGalicia.** La web de cámaras es una SPA Angular sin
la lista en el JS; la fuente real es el panel server-rendered
`https://servizos.meteogalicia.gal/paneis/camaras.action?ids=9999`, que
lista las 31 cámaras por su nombre de directorio
(`datosred/camaras/MeteoGalicia/<Nombre>/ultima.jpg`, mismo patrón ya
integrado). Descargadas y confirmadas como JPEG real (`200`) las
costeras que NO teníamos: `Burela`, `Carinho` (Cariño), `PuntaCandieira`
(Cedeira), `Cabodomundo` (Foz), `Coron` (Vilanova de Arousa), `Salvora`
(Illa de Sálvora), `Aguete2` (Marín), `CiesFaroNorte`. Auditoría de paso:
las conocidas (`Baiona`/`Corunha`/`Onspuerto`) siguen `200`.

**Pero ninguna cubre un spot-hueco existente.** Nuestros únicos huecos
gallegos son A Guarda y Sanxenxo, y MeteoGalicia no tiene cámara de
ninguno de los dos (probados `Sanxenxo`/`Portonovo`/`AGuarda`/`Guarda` →
404 real). Las 8 cámaras costeras nuevas de arriba corresponden a
**localidades que hoy no son spots** — añadirlas exige crear el spot
primero, que es decisión de producto (mapa/frontend), así que **solo se
proponen**, no se integran:

> **Propuesta (no aplicada): 8 spots nuevos gallegos con webcam
> institucional ya verificada.** Cariño, Cedeira (Punta Candieira),
> Foz (Cabo de Mundo), Burela (costa de Lugo/Cantábrico gallego),
> Vilanova de Arousa (Corón), Illa de Sálvora, Marín (Aguete) — todos
> con cámara MeteoGalicia `200`/JPEG real y encaje directo en el proxy
> `/webcam/<slug>` existente. Rellenan un tramo con poca densidad de
> spots (costa de Lugo y Rías Baixas interiores). Requiere el visto bueno
> del usuario por ser alta de spots nuevos, no un cambio de dato.

**SOCIB (Baleares) — método de verificación definitivo y cierre del
hueco.** El endpoint interno `apps.socib.es/.../view/<code>/...` hace un
`307` para CUALQUIER código (inyecta el código en una plantilla), así que
no vale para verificar; e `images.socib.es` (destino real) rechaza
conexiones desde este runner y desde `WebFetch` (`ECONNREFUSED`) — solo
resuelve desde el edge de Cloudflare, por eso las 3 actuales funcionan en
producción pero no se pueden comprobar aquí. La vía fiable es la API
`.../api/image_access/getlatestdirectory/<code>/<code>/thumbnail/`:
devuelve **JSON de cámaras si la estación existe** y **`500` si no**.
Con eso, verificado sin ambigüedad: solo existen `clm` (Cala Millor),
`snb` (Son Bou) y `muro` (Platja de Muro) — **las 3 que ya tenemos**.
Sondeados y descartados (`500`, igual que un código inventado de control)
`palma`, `pdp`, `arenal`, `canpastilla`, `ciutadella`, `formentera` y
~12 variantes más: **SOCIB no tiene cámara para Palma, Ciutadella ni
Formentera** pese a que la documentación menciona "Playa de Palma" (será
histórica o de otro sistema). Doble valor: cierra ese hueco para futuras
pasadas (no volver a sondear a ciegas) y sirve de auditoría — las 3
cámaras SOCIB integradas confirmadas vivas.

**Resultado neto: sin novedades integrables directas** para ningún
spot-hueco existente. Lo aprovechable queda como propuesta (8 spots
gallegos nuevos con webcam ya verificada) y como método reutilizable
(roster de MeteoGalicia vía `paneis/camaras.action`; verificación de
existencia de SOCIB vía `getlatestdirectory`). Sin cambios de código.

**Firmado:** robot buscador de fuentes (pasada de webcams para spots sin
cámara), 2026-09-16 07:55 UTC.

### 2026-09-16 10:27 UTC (pasada buscadora — caudal de ríos por zona + estaciones de monte, España y Portugal)

**Objetivo:** los dos huecos conocidos: (1) `caudal: null` en los ríos
vascos de `RIOS` (`index.html`) — el comentario de `functions/prevision.js`
dice "URA/Bizkaia bloquea el acceso automático"; (2) ampliar las
estaciones de monte reales (precip/presión, estilo `ESTACIONES_AEMET`) a
España **y Portugal**, no solo Euskadi. Esta pasada corre desde el runner
de GitHub Actions (red real, no el sandbox web bloqueado del 2026-08-31).
**Todo lo de abajo tocaría `functions/prevision.js` y/o `RIOS` en
`index.html` → por la regla de volumen de `ROBOT_REGLAS.md` es propuesta,
nunca aplicación directa.** No se ha cambiado ni una línea de código.

**HALLAZGO 1 — Open Data Bizkaia publica datos hidrometeorológicos en
tiempo real (24h), abiertos y sin key.** La premisa del comentario de
`prevision.js` ("URA/Bizkaia bloquea el acceso automático") puede estar
**desactualizada**: `opendatabizkaia.eus` tiene el dataset "Datos de las
estaciones de Bizkaia (en tiempo real, últimas 24 horas)" (red foral de
~40 estaciones hidrometeorológicas, integrada en la red de URA) con
descarga en JSON/CSV/XML/TSV/XLSX y patrón de dump tipo
`/opendata/es/datastore/dump/<dataset-id>/...?format=csv`. Recursos:
`https://www.opendatabizkaia.eus/es/catalogo/hidrologia/recurso/datos-estaciones-bizkaia-tiempo-real`
y el de metadatos de estaciones (coordenadas/ids)
`https://www.opendatabizkaia.eus/es/catalogo/hidrologia/recurso/estaciones-hidrometeorologicas`.
Sería justo lo que falta para desbloquear Lea, Oka, Butrón, Gobela,
Nervión/Ibaizabal y el resto de ríos de Bizkaia de `RIOS`.
**PERO no he podido verificarlo desde este runner**: `opendatabizkaia.eus`
rechaza conexiones desde IP de datacenter (`ECONNREFUSED`/`HTTP 000` tanto
por `curl` como por `WebFetch`) — mismo patrón que ya se documentó con
`beachcam.meo.pt`/`images.socib.es`. **Antes de integrarlo hay que
verificar el endpoint exacto (dataset-id real + campos de caudal/precip/
presión + frescura) desde un navegador real o, mejor, desde una Function
de Cloudflare** (comprobar si el edge de Cloudflare sí alcanza el host, ya
que producción corre ahí, no en este runner) — no dar por bueno el
formato sin una petición real que devuelva datos, como con cualquier
fuente nueva.

**HALLAZGO 2 — Gipuzkoa (Obras Hidráulicas) da caudal REAL en vivo,
verificado hoy.** Portal "Datos en tiempo real"
(`gipuzkoa.eus/es/web/obrahidraulikoak/hidrologia-y-calidad/datos-en-tiempo-real`),
una página por estación (portlet Liferay, parámetro `idEstacion=<código>`,
`view=datosTiempoReal`). **Verificado en real hoy**: la estación DEBA
(`idEstacion=A1Z1`) devuelve una tabla server-rendered con datos de
**16/09/2026** cada 10 min, con columnas Nivel (m), **Caudal (m³/s)**,
**Pluv. (l/m²)**, Tª Agua (ºC) y **Turb. (NTU)** — ej. 00:00 → nivel
0.202 m, caudal 0.282 m³/s. Estaciones útiles para spots de Gipuzkoa
(hoy sin caudal en `RIOS`): DEBA `A1Z1`/`A3Z1` (Deba, Mutriku), UROLA
`B1Z1`/`B2Z1` (Zumaia), ORIA `C5Z1`/`C9Z1` (Orio, Zarautz), URUMEA
`D1T1`/`D2W1` (Donostia), OIARTZUN `E1W1` (Pasaia), ENDARA `F1W1`
(Bidasoa, Hondarribia). **No rellena el hueco vasco original (esos son de
Bizkaia), sino que AÑADE caudal nuevo a la costa guipuzcoana** (más rico
incluso: trae también pluviometría, temperatura del agua y turbidez —
esto último encaja con la responsabilidad de turbidez de
`ROBOT_REGLAS.md`). **Cautelas para el diseño (proponer, no aplicar)**:
(a) no encontré un endpoint JSON limpio del portlet — cada estación es
una página HTML de ~200 KB que habría que parsear, y es **un fetch por
estación**, lo que choca con el límite de ~50 sub-peticiones de Cloudflare
que ya está al 78% en `/prevision` (ver `ROBOT_REGLAS.md`, 2026-09-15);
integrarlo exigiría o bien un endpoint bulk que no aparece, o un cron
propio que cachee (patrón `registrar-presion`), no llamadas en vivo desde
`/prevision`. (b) verificar con mapa que cada estación cae de verdad
aguas arriba del spot antes de cruzarla.

**HALLAZGO 3 — Portugal: estaciones de monte reales, verificado, sin key.**
IPMA (Instituto Português do Mar e da Atmosfera) publica observación
horaria abierta: `https://api.ipma.pt/open-data/observation/meteorology/stations/observations.json`
(**verificado hoy**: `200`, ~1 MB, 24 timestamps, última hora
2026-09-16T09:00 con **222 estaciones**; campos por estación
`precAcumulada` (precip), `pressao` (presión hPa), `temperatura`,
`humidade`, viento — en la última hora, 160 estaciones con precip válida y
78 con presión válida) y el listado de estaciones con coordenadas en
`https://api.ipma.pt/open-data/observation/meteorology/stations/stations.json`
(GeoJSON, `idEstacao` + `localEstacao` + coords). **Es el equivalente
exacto de `ESTACIONES_AEMET` para Portugal** — hoy los 17 spots
portugueses de la app no tienen ninguna estación de monte, porque
`ESTACIONES_AEMET` es solo AEMET/España. Encaje directo con el patrón ya
existente (`ESTACIONES_AEMET`/`datosEstacionesAemet()`), una sola petición
para toda la cobertura nacional (no cuenta por ubicación como Open-Meteo).
Candidato fuerte, pero es alta de una fuente nueva en `functions/` →
propuesta, a confirmar por el usuario.

**Sin verificar / descartado esta pasada:** la red autonómica de URA
(`uragentzia.euskadi.eus`, visor de estaciones de aforo) permite descargar
media diaria y datos a 10 min, pero no localicé un endpoint JSON/tiempo
real sin login desde el HTML (usa un `getJSON` cuyo destino no se expone
en los scripts servidos); Euskalmet (red conjunta) sigue dependiendo de la
`EUSKALMET_API_KEY` que nunca llegó (ver `CLAUDE.md`). Para España
peninsular, `ESTACIONES_AEMET` ya cubre el hueco vía AEMET — no hace falta
fuente nueva ahí, como mucho ampliar la lista de `idema`.

**Resultado neto:** 3 fuentes reales candidatas para los dos huecos, dos
de ellas verificadas en vivo hoy (Gipuzkoa caudal, IPMA Portugal) y una
muy prometedora pero no verificable desde este runner (Open Data Bizkaia,
IP de datacenter bloqueada — verificar desde el edge de Cloudflare). Sin
cambios de código: todo toca `functions/`/`RIOS` → propuesta a confirmar.

**Fuentes:**
[Open Data Bizkaia — estaciones en tiempo real (24h)](https://www.opendatabizkaia.eus/es/catalogo/hidrologia/recurso/datos-estaciones-bizkaia-tiempo-real),
[Gipuzkoa — Obras Hidráulicas, datos en tiempo real](https://www.gipuzkoa.eus/es/web/obrahidraulikoak/hidrologia-y-calidad/datos-en-tiempo-real),
[URA — datos de estaciones de aforo](https://www.uragentzia.euskadi.eus/datos-de-estaciones-de-aforo/webura00-contents/es/),
[IPMA — observação meteorológica (open data)](https://api.ipma.pt/open-data/observation/meteorology/stations/observations.json).

**Firmado:** robot buscador de fuentes (pasada de caudal de ríos +
estaciones de monte, España y Portugal), 2026-09-16 10:27 UTC.

---

### 2026-09-17 (pasada buscadora — webcams para spots sin cámara)

**Objetivo:** misma tarea recurrente, recontados los huecos vigentes:
Plentzia, Ondarroa, Zumaia, Getaria, Pasaia (Euskadi), A Guarda, Sanxenxo
(Galicia, ya descartados en pasadas previas — MeteoGalicia no tiene
cámara de ninguno de los dos), Llanes, Ribadesella, Santander (Cantabria/
Asturias), casi toda Cataluña/Murcia/Andalucía/Canarias/Baleares fuera de
lo ya integrado, y Portugal entero. Como en pasadas anteriores, no se
pudo priorizar por `spots_usuario` (sin credenciales de Supabase
accesibles desde esta sesión).

**✅ Encontrada e integrada — Pasaia, mismo proveedor AZTI/detectia.net ya
usado para Sopelana/Lekeitio/Getxo.** Probando por fuerza bruta el
esquema de nombre de fichero de este proveedor (`webcam-<lugar>.webp`,
`webcam-<lugar>-azti.webp`) contra los huecos vascos, `webcam-pasaia-
azti.webp` respondió `200` — descargada y confirmada de verdad: WebP VP8
real, 2464×2056, ~140 KB, `Last-Modified` de hoy mismo (no una imagen
estática/placeholder cacheada). Pasaia es un spot-hueco real (sin cámara
desde que se creó, ver pasada 2026-09-16), así que esto sí rellena un
hueco existente (a diferencia de otros aciertos del mismo proveedor
encontrados en esta misma pasada — `deba-azti`, `zarautz-azti`,
`hondarribia-azti` también dan `200`, pero esos tres spots ya tienen
cámara por HLS de Gipuzkoa, así que no se tocan). Bajo riesgo, mismo
patrón ya integrado varias veces — añadida directamente: `pasaia` en
`functions/webcam/[slug].js` (`WEBCAMS`) y en `SPOTS_CON_WEBCAM`
(`index.html`). Verificado con `node --check` antes de commitear. Sigue
sin encontrarse fuente para Plentzia, Ondarroa, Zumaia ni Getaria con
este mismo esquema de nombre (todas `404`, varias variantes probadas).

**Llanes/Ribadesella — pista real pero no verificable sin más trabajo,
no integrada.** `webcamsdeasturias.com` (agregador con red de cámaras
reales del Principado, distinto de los agregadores ya descartados en
pasadas previas como SkylineWebcams) tiene páginas dedicadas a Playa de
Vega (Ribadesella) y Playa de Toró/Barro (Llanes). Inspeccionado el HTML
real de la página de Vega: el reproductor es un iframe a
`rtsp.me/embed/9d6iFr5a/` (servicio de re-streaming RTSP→HLS/embed) — el
propio embed carga el stream por JavaScript (`devlinePlayerLoader`), sin
ninguna URL de imagen/`.m3u8` directa visible en el HTML estático
descargado por `curl`. No se pudo verificar una URL final proxyable sin
inspeccionar peticiones de red reales desde un navegador (fuera del
alcance de esta sesión) — se deja como pista para retomar, no se
integra ni se propone como cambio todavía (regla de no inventar una
URL: sin la URL real del stream, no hay nada que proponer).

**Cantabria (Santander) sigue sin poder verificarse desde este runner**:
`cantabria.es` vuelve a dar timeout (`000`), mismo síntoma que pasadas
anteriores — no se trata como fuente rota, solo como límite de red de
este entorno, igual que se documentó en la pasada de calibración de
anoche.

**Resultado neto:** 1 webcam nueva verificada e integrada (Pasaia).
Ninguna otra novedad integrable esta pasada; Llanes/Ribadesella quedan
como pista real a seguir investigando (necesita inspección de red desde
navegador), no como propuesta todavía.

**Fuentes:**
[detectia.net — webcam-pasaia-azti.webp](https://detectia.net/img/webcam-pasaia-azti.webp),
[Webcams de Asturias — Playa de Vega (Ribadesella)](https://www.webcamsdeasturias.com/asturias/oriente/ribadesella/vega/playa-de-vega-hd/132/),
[Webcams de Asturias — Playa de Toró (Llanes)](https://www.webcamsdeasturias.com/asturias/oriente/llanes/llanes/playa-de-toro-mirador-de-toro-hd/53/).

**Firmado:** robot buscador de fuentes (pasada de webcams para spots sin
cámara), 2026-09-17 15:50 UTC.

### 2026-09-17 16:27 UTC (pasada buscadora — mareas y oleaje)

**Calibración — 4 puntos nuevos, cerrando el hueco de las boyas menos
recientes** (candidatas señaladas explícitamente por la pasada nocturna
de esta misma madrugada: Cabo de Gata, Dragonera, Cabo Peñas y
Villano-Sisargas, todas sin rotar desde hace varios días). Mismo método
de siempre: `curl` real a `poem.puertos.es/portus/StationData` para la
altura medida, Marine API de Open-Meteo en las coordenadas exactas de
cada boya para la calculada, emparejando por la hora UTC exacta del
último dato real de cada boya (todas coincidieron en 2026-09-17 16:00
UTC):

| boya | altura medida | altura calculada | diferencia | % |
|---|---|---|---|---|
| 2548 Cabo de Gata | 0.82 m | 0.58 m | −0.24 m | −29.3% |
| 2820 Dragonera (Mallorca) | 0.94 m | 0.96 m | +0.02 m | +2.1% |
| 2242 Cabo Peñas | 1.88 m | 1.40 m | −0.48 m | −25.5% |
| 2246 Villano-Sisargas | 1.99 m | 1.48 m | −0.51 m | −25.6% |

Añadidos a `CALIBRACION.jsonl` (mismo `tipo:
"boya_vs_openmeteo_mismo_punto"` de siempre). Recuento actualizado tras
esta pasada: Cabo de Gata 3 puntos (−11.9%, +2.9%, −29.3% — signo
mixto), Dragonera 2 puntos (−31.9%, +2.1% — signo mixto), Cabo Peñas 2
puntos, Villano-Sisargas 2 puntos (−11.1%, −25.6% — mismo signo,
todavía muestra mínima). **Curiosidad anotada, no un error**: el punto
nuevo de Cabo Peñas (1.88 m medido → 1.40 m calculado, −25.5%) coincide
EXACTAMENTE, hasta el decimal, con el único punto anterior de esa misma
boya (2026-09-14T01:00 UTC) pese a ser una petición real distinta 3
días después — verificado que no es un error de copia (los números
salen del `curl` de hoy, con la hora de hoy); se deja constancia por si
en el futuro se quiere investigar si es casualidad de estado de mar
repetido o algún patrón del modelo, pero con un solo caso no hay nada
que perseguir todavía. **Ninguna boya llega ni de lejos al mínimo de 15
puntos** — sigue sin proponerse ningún factor de corrección.

**Fuentes nuevas investigadas — sin resultado aprovechable.** Se buscó
de nuevo un endpoint de Puertos del Estado que devuelva varias boyas en
una sola petición (relevante por el límite de ~50 sub-peticiones de
Cloudflare que ya documenta `ROBOT_REGLAS.md`, con 26 boyas ya en
`BOYAS`). `widgets.pdf` de PORTUS (`portus.puertos.es/Portus/docs/`) no
se pudo leer como documentación (es mayormente binario/imagen embebida,
sin especificación de API legible). Se identificó el servidor
OPeNDAP/THREDDS de Puertos del Estado
(`opendap.puertos.es/thredds/catalog/circulation_coastal_bil/`),
accesible por HTTP simple, pero sirve datos de **modelo de circulación
en rejilla (NetCDF/DAP)**, no lecturas puntuales de boyas reales — no
sirve como fuente de verdad independiente para calibrar (sería
comparar un modelo contra otro modelo) ni como sustituto simple en JSON
de las peticiones actuales a `StationData`, así que no se integra ni se
propone. Se confirma que sigue sin encontrarse una alternativa de
"todas las boyas en una llamada" — queda como limitación conocida, no
como tarea resuelta.

**Firmado:** robot buscador de fuentes (pasada de mareas y oleaje),
2026-09-17 16:27 UTC.

---

### 2026-09-17 18:41 UTC (pasada buscadora — corrientes marinas por zona)

**Qué se buscó:** continuación de las tres pasadas previas de corrientes
(2026-09-14 19:37, 2026-09-15 13:31 y 2026-09-15 18:35, más arriba). La
última dejó dos frentes abiertos: (1) el radar HF de **EUSKOOS** (AZTI,
Golfo de Bizkaia — la costa de casa de la app) aparecía **congelado
desde el 2026-07-16** en el mirror de EMODnet Physics, y (2) la fuente
propia de EuskOOS (THREDDS nativo) sí está viva pero su agregación fácil
está rota (single time-step fijo en 2023-05-31), sin conseguir enumerar
el catálogo `TOTL` por timeout/500 para leer un fichero por hora
directamente.

**Verificado en vivo el frente (2), sigue exactamente igual que el
2026-09-15**: `TOTL/catalog.xml`, `MATX/catalog.xml` y `HIGE/catalog.xml`
siguen devolviendo `500` de inmediato (no timeout, error real del
servidor); `OMA/catalog.xml` y `2DVAR/catalog.xml` siguen sin responder
en 30s (catálogo demasiado grande para listar plano); los resolvers
`latest.xml` de `TOTL`/`MATX`/`HIGE` siguen en `500` (`OMA/latest.xml`
da `404`, antes ni se había probado). El `best.ncd` de la agregación FMRC
de `TOTL` sigue devolviendo un único `TIME` fijo en 26813.75 días desde
1950 (2023-05-31 18:00 UTC) y su WMS `GetCapabilities` da `403`. **Sin
cambios en este frente** — la vía THREDDS nativa de EuskOOS sigue sin
ser utilizable por REST simple.

**Hallazgo real y verificado en el frente (1) — buenas noticias: el
radar de EUSKOOS en EMODnet Physics YA NO ESTÁ CONGELADO.** Petición
directa a
`erddap.emodnet-physics.eu/erddap/info/EUHFR_NRTcurrent_HFR-EUSKOOS-Total/index.csv`
hoy: `time_coverage_end = 2026-09-17T12:00:00Z` (y una petición de dato
real un rato después mostró hasta las 14:00 UTC) — se ha reanudado la
actualización desde julio, sin que este robot haya hecho nada para
provocarlo (probablemente el propio EMODnet arregló su mirror). Petición
de dato real confirmada: para la hora 2026-09-17T11:00Z, 716 celdas con
corriente real de 957 en la rejilla del recorte de coordenadas de
Euskadi/Cantabria — muchísima más cobertura que Galicia (51 de 3807 el
2026-09-15, radar más disperso). **Revisadas también las otras 5 zonas
como comprobación de salud**: Galicia, Lisboa, Gibraltar, Ibiza y PLOCAN
(Canarias) están las 5 vivas hoy con `time_coverage_end` de hoy mismo
(PLOCAN, que iba con 1.5 días de retraso el 2026-09-15, hoy está al día
también) — **las 4 zonas de Costaviva + Portugal tienen radar HF real
vivo simultáneamente por primera vez desde que se investiga esto**, sin
necesidad de tocar la vía THREDDS rota de EuskOOS: EMODnet ya sirve el
dato de la costa de casa también.

**Calibración de un punto real, pedida por `ROBOT_REGLAS.md` antes de
proponer nada** (mismo criterio que oleaje/coeficiente de marea):
comparado el radar HF de EUSKOOS contra `ocean_current_velocity`/
`ocean_current_direction` de Open-Meteo (mismo modelo que usa
`functions/prevision.js` hoy) para Mundaka (43.4047, −2.6989 — celda de
radar más próxima a 500 m), 3 horas del mismo día (05:00, 11:00, 14:00
UTC):

| hora UTC | radar (EWCT/NSCT → velocidad/dirección) | Open-Meteo | veredicto |
|---|---|---|---|
| 05:00 | 0.45 m/s, 178° (hacia el sur) | 0.4 m/s, 297° | velocidad parecida, dirección muy distinta (119°) |
| 11:00 | 0.61 m/s, 230° (hacia el SO) | 0.6 m/s, 288° | velocidad casi idéntica, dirección distinta (58°) |
| 14:00 | 0.18 m/s, 327° (hacia el NO) | 0.6 m/s, 288° | velocidad muy distinta (3.4×), dirección algo más cercana (38°) |

Confirmado con la propia documentación de Open-Meteo (ambas usan la
misma convención — "hacia dónde va" la corriente, 0°=norte, sentido
horario — así que la comparación de arriba es directa, no hace falta
invertir 180° ningún lado). **Patrón real, con solo 3 puntos pero
consistente**: la dirección del radar (dato real) ROTA con claridad a lo
largo del día (178°→230°→327°, compatible con el giro típico de una
corriente de marea), mientras que Open-Meteo se queda prácticamente fijo
(297°→288°→288°) — el modelo no parece capturar bien la componente de
marea de la corriente en este punto, solo algo más estable (¿residual /
deriva media?). La velocidad, en cambio, coincide muy bien en 2 de los 3
puntos (diferencia de solo 0.01–0.05 m/s) pero falla claramente en el
tercero (0.18 real vs 0.6 modelo). Guardado como 3 filas nuevas en
`CALIBRACION.jsonl` (`tipo: "corriente_radar_hf_vs_openmeteo"`).

**Con solo 3 puntos de una sola zona y un solo día no hay base para
proponer ningún factor de corrección** (mismo criterio que boyas/
coeficiente de marea: mínimo de puntos antes de tocar nada) — esto es
solo el primer punto de calibración real que pide `ROBOT_REGLAS.md`
antes de proponer una mezcla, no una conclusión cerrada.

**Por qué solo propuesta, no implementación** (misma razón que las tres
pasadas anteriores de corrientes, ver `ROBOT_REGLAS.md`): integrar esto
tocaría `functions/prevision.js` (por encima del límite de volumen) y es
decisión de producto — ahora que las 4 zonas + Portugal están vivas a la
vez, la pregunta de "cómo mezclar corriente observada real donde hay
radar con el modelo en el resto sin confundir al usuario" ya no tiene la
limitación de cobertura parcial de antes, pero sigue habiendo celdas
`null` fuera de la zona de antena y sigue sumando sub-peticiones cerca
del límite de 50 de Cloudflare (ver `ROBOT_REGLAS.md`) — seguiría
necesitando ser un endpoint aparte o bajo demanda, no parte de la
petición general de `/prevision`. No se ha tocado código.

**Propuesta concreta para el usuario, actualizada:** con las 4 zonas +
Portugal ya verificadas vivas simultáneamente (Galicia, EUSKOOS,
Gibraltar, Ibiza, PLOCAN, Lisboa), el bloqueo real ya no es de
cobertura/disponibilidad de la fuente — es solo de diseño (dónde vive el
endpoint, cómo se etiqueta observación-vs-modelo) y de calibración
(solo 3 puntos hechos, haría falta ampliar a varias zonas/horas/días
antes de decidir si mostrar la dirección del radar en vez de la de
Open-Meteo, dado el desacuerdo de dirección encontrado hoy). Si se
retoma, EUSKOOS ya no necesita la vía THREDDS rota — se puede consumir
igual que las otras 5 zonas, vía EMODnet ERDDAP REST puro.

**Fuentes:**
[EMODnet Physics ERDDAP — EUSKOOS NRT (verificado vivo hoy)](https://erddap.emodnet-physics.eu/erddap/info/EUHFR_NRTcurrent_HFR-EUSKOOS-Total/index.html),
[Open-Meteo Marine API docs (convención de `ocean_current_direction`)](https://open-meteo.com/en/docs/marine-weather-api).

**Firmado:** robot buscador de fuentes (pasada de corrientes marinas),
2026-09-17 18:41 UTC.

---

### 2026-09-17 23:10 UTC (pasada buscadora — presión atmosférica e histórico por zona, cuarta pasada)

**Qué se buscó y por qué:** las tres pasadas previas de este mismo tema
(2026-09-14 23:31, 2026-09-15 13:33 y 2026-09-15 23:12, más arriba) ya
verificaron el reanálisis por coordenada (Open-Meteo ERA5/Historical
Forecast), la observación horaria por estación en España (AEMET,
`ESTACIONES_AEMET` ya en producción) y Portugal (IPMA, verificado en
vivo pero sin integrar todavía), y dos fuentes de histórico observado
bulk (Meteostat, con problema de licencia NC; NOAA NCEI/ISD, dominio
público). Quedaban dos huecos explícitos sin cerrar: (1) el histórico
**diario** de AEMET (nunca probado, por falta de `AEMET_API_KEY` en
este runner) y (2) el formato del histórico **diario** de IPMA (solo se
había verificado el endpoint horario). Esta pasada fue a cerrar esos dos
huecos.

**Nota de entorno:** `AEMET_API_KEY` sigue sin estar disponible en este
runner (comprobado con `env`, igual que en las tres pasadas anteriores)
— vive solo como secreto en Cloudflare Pages. Red de salida abierta a
dominios de datos, todo lo de abajo verificado con peticiones HTTP
reales.

**Hueco 1 (AEMET) — sin poder verificar en vivo, pero se descarta un
posible atajo.** Se investigó si el catálogo de datos abiertos del
Gobierno de España (`datosabiertos.miteco.gob.es`) republicaba las
"Climatologías diarias" de AEMET como fichero descargable sin API key
— **no es así**: su ficha de catálogo
(`catalogo.dataset/2d48e936-95a2-4904-af7e-59d912d002ec/resource/
fb436028-d2fe-4040-9ac7-24dedbc6f49b`, verificada en vivo, `200` tras
un par de reintentos — el servidor de MITECO es intermitente,
alternando `200`/`502` en peticiones seguidas) es solo una entrada de
catálogo/metadatos que enlaza directamente al propio
`opendata.aemet.es` (endpoint
`/api/valores/climatologicos/diarios/datos/...`, el mismo que ya
apuntaba la pasada del 2026-09-14). No hay atajo: sigue haciendo falta
la `AEMET_API_KEY` real desde una `functions/` para esto, nunca desde
este runner.

**Hueco 2 (IPMA) — verificado en vivo, hallazgo real y más limitado de
lo que sugería la documentación general.** Las "séries longas" de IPMA
(`ipma.pt/pt/oclima/series.longas/`) se describen en la propia web como
~50 estaciones con registros desde 1855 incluyendo presión reducida al
nivel del mar — pero el catálogo real que sirve los ficheros
(`ipma.pt/opencms/pt/oclima/series.longas/list-long-series-stations.json`,
`200`, verificado) solo lista **16 estaciones con serie larga
descargable**, y de esas, **solo 1 tiene dato de presión**: Lisboa /
Geofísico (`NEstacao 535`), con fichero diario
(`pressdaily_Lisbon-Geofisico_igidl_1864-2006_no-grav-correction_
28072020.xlsx`, descarga verificada en vivo — `200`, `.xlsx` real de
2,3 MB) que cubre **1864-2006 sin corrección de gravedad** (no
actualizado desde entonces) y un fichero mensual homogeneizado
equivalente. Las otras 15 estaciones (Porto, Terceira, Beja, Bragança,
Castelo Branco, Coimbra, Évora, Faro, Funchal, Montalegre, Penhas
Douradas, Portalegre, Ponta Delgada, Santarém, Setúbal) solo tienen
temperatura/precipitación, ninguna presión. **Conclusión: esta fuente
sirve como referencia histórica muy larga para UN punto de Lisboa, no
como fuente de backfill por estación para la costa portuguesa en
general** — para eso sigue siendo mejor lo ya encontrado (IPMA
observación horaria en vivo desde 2026-09-15, o NCEI/ISD bulk del
2026-09-15 23:12, que sí cubre estaciones portuguesas costeras con
décadas de profundidad).

**Puertos del Estado, confirmación adicional (sin cambio de
conclusión):** se buscó si `datos.gob.es` o la app "iMar" exponían una
vía API alternativa al formulario de `bancodatos.puertos.es` ya
descartado el 2026-09-15 — no se encontró ninguna; `bancodatos.puertos.es`
sigue devolviendo `403` a una petición directa sin sesión de formulario,
verificado de nuevo hoy. Se mantiene como fuente real pero de
integración no trivial, igual que la pasada anterior.

**Balance de las 4 pasadas de este tema**: los dos huecos que quedaban
abiertos ya están cerrados con una respuesta verificada (aunque la de
IPMA sea "más limitada de lo esperado", es una respuesta real, no una
suposición). No queda ninguna pregunta pendiente de este tema sin al
menos un intento real de verificación — la vía con más profundidad y
cobertura sigue siendo NOAA NCEI/ISD (dominio público, décadas, España y
Portugal) para backfill, más el archivo ERA5 de Open-Meteo para relleno
por coordenada exacta. Nada de esto se ha implementado en código —
sigue siendo decisión de producto ya explicada en las tres pasadas
anteriores (tocaría `functions/`/`supabase/` y afecta a un dato que se
muestra al usuario como fiable).

**Sin cambios en código** — investigación pura, solo esta entrada en
`ROBOT.md`.

**Fuentes:**
[MITECO — catálogo, Climatologías diarias (enlaza a AEMET OpenData)](https://catalogo.datosabiertos.miteco.gob.es/catalogo/dataset/2d48e936-95a2-4904-af7e-59d912d002ec/resource/fb436028-d2fe-4040-9ac7-24dedbc6f49b),
[IPMA — Séries Longas](https://www.ipma.pt/pt/oclima/series.longas/),
[IPMA — catálogo de estaciones de série longa (JSON)](https://www.ipma.pt/opencms/pt/oclima/series.longas/list-long-series-stations.json),
[IPMA — descarga verificada, presión diaria Lisboa/Geofísico 1864-2006](https://api.ipma.pt/open-data/observation/climate/monthly-long-series/pressdaily_Lisbon-Geofisico_igidl_1864-2006_no-grav-correction_28072020.xlsx).

**Firmado:** robot buscador de fuentes (pasada de presión atmosférica e
histórico por zona), 2026-09-17 23:10 UTC.

---

### 2026-09-18 13:10 UTC (pasada buscadora — mareas y oleaje)

**Calibración — 3 puntos nuevos, rotación de las boyas exteriores menos
recientes.** Candidatas señaladas por la pasada buscadora de ayer
(2026-09-17 16:27 UTC) y confirmadas como las que llevaban más tiempo sin
repetirse (Dragonera ya recibió un punto extra en la pasada nocturna de
esta madrugada, así que no le tocaba hoy): mismo método de siempre,
`curl` real a `poem.puertos.es/portus/StationData` para la altura
medida, Marine API de Open-Meteo en las coordenadas exactas de cada boya
para la calculada, emparejando por la hora UTC exacta (13:00 UTC en las
3):

| boya | altura medida | altura calculada | diferencia | % |
|---|---|---|---|---|
| 2548 Cabo de Gata | 0.82 m | 0.84 m | +0.02 m | +2.4% |
| 2242 Cabo Peñas | 2.70 m | 2.32 m | −0.38 m | −14.1% |
| 2246 Villano-Sisargas | 2.34 m | 2.38 m | +0.04 m | +1.7% |

Añadidos a `CALIBRACION.jsonl` (`tipo: "boya_vs_openmeteo_mismo_punto"`).
Recuento tras esta pasada: **Cabo de Gata** 4 puntos (−11.9%, +2.9%,
−29.3%, +2.4% — sigue con signo mixto). **Cabo Peñas** 3 puntos (−25.5%,
−25.5%, −14.1% — los 3 ahora con signo negativo, aunque las dos primeras
lecturas coinciden hasta el decimal por una casualidad ya anotada el
2026-09-17; con el punto de hoy distinto, empieza a parecer un sesgo
real más que una repetición de caché). **Villano-Sisargas** 3 puntos
(−11.1%, −25.6%, +1.7% — sigue con signo mixto). Ninguna llega ni de
lejos al mínimo de 15 puntos — no se propone ningún factor de
corrección.

**Fuente nueva real encontrada — catálogo OGC API Features del
Instituto Hidrográfico de Portugal (`ogcapi.hidrografico.pt`), verificado
en vivo, pero con un límite importante que hay que dejar anotado antes
de que otra pasada intente integrarlo a ciegas.** Buscando alternativas
a Puertos del Estado para el lado portugués (hasta ahora solo cubierto
por la boya de Nazaré ya integrada), apareció este servidor OGC
(`https://ogcapi.hidrografico.pt/collections?f=json`, sin autenticación,
CORS no comprobado pero HTTP directo funciona bien) con **~40
colecciones geoespaciales reales**, entre ellas tres relevantes para
mareas/oleaje:
- `buoys_datawell` (Red de boyas Datawell Waverider): 11 boyas reales,
  con estado (`active`/`inactive`) y timestamp del último dato
  (`last_sea`) — confirmadas **activas con dato reciente hoy**: Leixões
  (CSA92/D, −8.9825, 41.316, `last_sea` 2026-09-17T11:32 UTC), Sines
  (CSA83/1D), Faro (CSA82/D), Caniçal (Madeira) y Graciosa (Azores).
- `buoys_Fugro_oceanor_wavescan`: 9 boyas, incluida **"Boia Nazaré
  Costeira" (CSA88/2, `id_est=2`) — el mismo `id_est=2` que ya usa
  `datosBoyaNazare()` en `functions/prevision.js` contra
  `monican.hidrografico.pt/json/boia.graph.php`**, así que esta
  colección confirma de forma independiente que la boya que ya
  integramos es real y sigue activa (`last_data` 2026-09-18T12:00 UTC,
  justo antes de esta pasada). También aparecen ZLT1/ZLT2 (activas) y
  varias boyas oceánicas ya inactivas (Nazaré Oceânica, Leixões
  Oceânica, Sines Oceânica, Faro Oceânica).
- `tide_obs_nrt` (Red de estaciones mareográficas activas): catálogo de
  estaciones de marea reales (Funchal, Leixões, Vila Real de Santo
  António...) con coordenadas.

**El límite real, comprobado con peticiones directas, no solo
sospechado**: estas tres colecciones son catálogos de METADATOS
(posición, nombre, estado, fecha del último dato) — ninguna trae el
valor real (altura de ola, nivel del mar) dentro de la propia respuesta
OGC, ni existe una colección `*_obs`/`*_data` hermana con las lecturas.
Probé el mismo patrón que ya funciona para Nazaré
(`monican.hidrografico.pt/json/boia.graph.php` con el `id_est=4` de la
boya Datawell de Leixões, que es la más interesante por estar cerca de
los spots portugueses de Viana do Castelo/Póvoa de Varzim) y con varias
variantes razonables de `dbn` (`datawell`, `csa`, `leixoes`, `porto`,
además del `monican` que sí funciona para Nazaré) — las 4 devolvieron
`302` a `index.php` (mismo error que con un `id_est` no reconocido en
esa base de datos), así que la red Datawell claramente vive en un
sistema/base de datos distinto de `monican` y no he encontrado cuál.
**No se ha inventado ningún parámetro** — se probaron variantes y se
descartaron por no dar resultado real, no se propone ninguna de ellas.
Queda como pista real y verificada (existe una boya activa cerca de
Leixões, con dato de hoy) pero sin forma de leer su valor todavía —
candidata a retomar en una futura pasada, quizá inspeccionando
`https://www.hidrografico.pt/m.mare` o el visor de AnavNet en un
navegador real (fuera del alcance de esta sesión, ver limitación de red
ya documentada en pasadas anteriores).

**Fuentes nuevas de bulk buoy — sin resultado, mismo diagnóstico que el
2026-09-17.** Se volvió a buscar un endpoint de Puertos del Estado con
"todas las boyas en una sola petición" (relevante por el límite de ~50
sub-peticiones de Cloudflare). Encontrada la tabla
`static.puertos.es/pred_simplificada/Predolas/tablas.html`, pero enlaza
a `bancodatos.puertos.es/TablaAccesoSimplificado/` — predicción de
modelo (HIRLAM/WAM) por puerto, no lectura real de boya; mismo problema
ya descartado el 2026-09-17 con el servidor OPeNDAP (comparar un modelo
contra otro modelo no sirve para calibrar). No se integra ni se
propone.

**Fuentes:**
[ogcapi.hidrografico.pt — catálogo de colecciones](https://ogcapi.hidrografico.pt/collections?f=json),
[Instituto Hidrográfico — Acesso a Dados / OGC API Features](https://www.hidrografico.pt/paginas-genericas/dt/dcdt/acesso-a-dados/oapif/),
[Tablas de Viento y Oleaje, Puertos del Estado/AEMET](https://static.puertos.es/pred_simplificada/Predolas/tablas.html).

**Firmado:** robot buscador de fuentes (pasada de mareas y oleaje),
2026-09-18 13:10 UTC.

### 2026-09-19 01:48 UTC (pasada buscadora — estudios institucionales/académicos tipo DIGIPESCA, segunda pasada)

**Qué se buscó:** dar continuidad a la pasada del 2026-09-16 01:42 UTC,
que dejó pendiente confirmar si el dataset vasco (el único que ya trae
la separación bajura/altura hecha por el propio organismo) llega a
desglose mensual, y buscar ángulos genuinamente nuevos (fuentes
nacionales o de Cantabria, zona que ni el dataset vasco ni el gallego
cubren bien). Solo propuesta/diagnóstico — no se ha tocado `ESPECIES`,
`indicePesca` ni ningún fichero de código, únicamente esta entrada.

**Resultado, en su mayoría negativo pero verificado en vivo (no de
memoria) — deja el panorama más claro para no repetir estas
comprobaciones:**

1. **Gobierno Vasco, confirmado: es anual, NO mensual.** La propia
   página del dataset ("Subastas en lonja de bajura") y el catálogo
   "Banco de datos de Pesca" declaran explícitamente
   "Frecuencia de actualización: Anual" para las tres tablas de
   subastas — ninguna baja a mes. Cierra la pregunta pendiente del
   2026-09-16: la fuente vasca sigue siendo la única con bajura/altura
   ya separada por el organismo, pero **no sirve para una climatología
   mensual**, solo para comparar años completos. Los ficheros de
   descarga reales viven en `nasdap.net` (dominio de Lakuntza/NASDAP,
   no `euskadi.eus` directamente) — ese dominio no respondió a una
   petición HTTP directa desde este runner (timeout), la periodicidad
   se confirmó leyendo la propia página del catálogo, no el fichero.
2. **El enlace de acceso a datos de "Primera venta de productos
   pesqueros frescos" (Xunta, citado el 2026-09-16 como el
   machine-readable de Pesca de Galicia) está roto.** El RDF del
   dataset en `abertos.xunta.gal` redirige (302) a
   `pescadegalicia.com/cotizaciones/ventas.aspx` (dominio `.com`,
   distinto del `.gal` ya probado), que devuelve **404** — el sitio se
   reestructuró y el enlace de datos.gob.es/abertos.xunta.gal quedó
   obsoleto. La vía real que sigue viva es la herramienta interactiva de
   `pescadegalicia.gal/informe-cotizaciones-lonjas/agregation` (ya
   verificada el 2026-09-16), pero no tiene endpoint de API confirmado —
   para usarla habría que automatizar su exportación desde la propia
   interfaz, no una descarga directa.
3. **Fuente nueva candidata, sin verificar todavía: IEO (Instituto
   Español de Oceanografía, CSIC) gestiona el PNDB** (Programa Nacional
   de Datos Básicos del sector pesquero español) — muestreos de talla y
   peso de especies objetivo al desembarcar en lonja, cobertura
   nacional. Tiene un catálogo de datos abiertos en `datos.ieo.es`
   (geonetwork), pero **no se ha podido verificar en vivo esta pasada**
   (la petición a `datos.ieo.es` y a `ieo.es/es/web/vigo/analisis-
   actividad-pesquera` dieron timeout desde este runner) — queda como
   pista sin confirmar, no como fuente candidata real todavía. Repetir
   el intento en una futura pasada antes de proponerla en firme.
4. **Comprobado y descartado: MAPA — "Estadísticas de Capturas y
   Desembarcos de Pesca Marítima"** (cobertura nacional, actualizado
   17/12/2025, XLSX descargable desde 1992). Desglosa por especie, zona
   de captura (aguas nacionales/comunitarias/terceros países) y
   fresco/congelado — **no por puerto/lonja ni por mes**, son capturas
   de la flota española agregadas por caladero, no desembarcos locales.
   No sirve para el proxy de "se pesca cerca de aquí" que necesita esta
   idea; no hace falta revisarlo de nuevo en pasadas futuras.
5. **Cantabria, hueco real sin cubrir todavía**: ni el dataset vasco ni
   el gallego cubren esta zona (8 puertos: San Vicente de la Barquera,
   Comillas, Suances, Santander, Santoña, Laredo, Colindres, Castro
   Urdiales). Solo se encontraron noticias de prensa con totales
   anuales agregados por lonja (ej. Forbes/El Diario, cifras de 2025),
   nada de un portal de datos abiertos del Gobierno de Cantabria con
   desglose por especie/mes. Sin una fuente institucional verificable,
   no se propone nada para esta zona por ahora.

**Cruces obligatorios de `ROBOT_REGLAS.md` (bajura/altura, hábitos
reales de captura, localismos)**: no aplican todavía a nada de esta
pasada — no hay ningún dato nuevo que traducir a una propuesta sobre
`ESPECIES`, solo diagnóstico de qué fuentes sirven o no.

**Recomendación para la próxima pasada de este tema**: (a) reintentar
`datos.ieo.es` con más margen de tiempo o vía `WebSearch` dirigido a su
geonetwork, para confirmar si el PNDB tiene algo descargable y
granular; (b) si se quiere seguir con la vía gallega, probar
directamente si `pescadegalicia.gal` expone algún parámetro de URL o
llamada XHR interna con los datos en crudo (inspeccionar la petición
de red que hace la propia herramienta al aplicar un filtro, no solo
leer el HTML de la página); (c) Cantabria y Asturias siguen siendo el
hueco más claro del Cantábrico — sin fuente institucional encontrada
todavía en ninguna de las dos.

**Fuentes:**
[Gobierno Vasco — Banco de datos de Pesca (confirma periodicidad anual)](https://www.euskadi.eus/gobierno-vasco/-/estadistica/banco-de-datos-pesca/),
[abertos.xunta.gal — ficha RDF del dataset (enlace roto verificado)](https://abertos.xunta.gal/catalogo/economia-empresa-emprego/-/dataset/0154/primeira-venda-produtos-pesqueiros-frescos.rdf),
[IEO — Análisis de la actividad pesquera (PNDB, sin verificar en vivo esta pasada)](https://www.ieo.es/el/web/vigo/analisis-actividad-pesquera),
[MAPA — Estadística de Capturas y Desembarcos de Pesca Marítima (descartada, sin desglose por lonja/mes)](https://www.mapa.gob.es/es/estadistica/temas/estadisticas-pesqueras/pesca-maritima/estadistica-capturas-desembarcos),
[Forbes España — pesca subastada en lonjas de Cantabria 2025 (solo prensa, sin portal de datos abiertos)](https://forbes.es/economia/859783/la-pesca-subastada-en-lonjas-de-cantabria-baja-un-37-en-2025-pero-aumenta-su-valor-hasta-69-millones/).

**Firmado:** robot buscador de fuentes (pasada de estudios
institucionales/académicos tipo DIGIPESCA, segunda pasada),
2026-09-19 01:48 UTC.

---

## Auditoría de datos

### 2026-08-31

**Bloqueada por red — no se pudo auditar con peticiones reales** (mismo
motivo que arriba: `curl` y `WebFetch` a `open-meteo.com`,
`poem.puertos.es`, `aa.usno.navy.mil` y `aemet.es` devuelven bloqueo de
salida antes de llegar al servidor real). No he tocado ningún código de
`functions/*.js` ni de `index.html` en esta pasada porque no he podido
verificar nada de verdad — cambiar algo a ciegas sería peor que no tocar
nada.

Repaso del código (sin red) para contexto de la próxima pasada, esto sí
verificado por lectura directa del repo, no por request:
- `functions/prevision.js`, `functions/luna.js`, `functions/rayos-imagen.js`
  y `functions/webcam/[slug].js` etiquetan explícitamente su fuente y no
  tienen ningún valor numérico hardcodeado presentado como dato real —
  cumplen la norma del proyecto.
- `index.html` sí trae un bloque de datos de respaldo (`SPOTS` con
  `altura`, `periodo`, `viento`... fijos, línea ~410-445) para cuando
  `/prevision` no responde — pero va seguido de
  `.map((b) => ({ ...b, alturaSignificativa: null, ... }))` y el propio
  texto de la nota de la UI dice "posiciones aproximadas, sin datos
  reales todavía" para los ríos. Es un dato de respaldo declarado como
  tal, no uno inventado disfrazado de real — no es una violación de la
  norma, es el patrón de fallback correcto.
- Gaps ya documentados honestamente por el propio proyecto (README.md,
  `index.html`): caudal de ríos (`caudal: null` en los 6 ríos), webcams
  de Lekeitio/Plentzia/Getxo sin fuente identificada. Siguen igual, no
  se han podido cerrar esta pasada.

**Pendiente para cuando haya red:** repetir con `curl` real las llamadas
de `prevision.js` (marine + forecast API por spot), `luna.js` (USNO) y
`rayos-imagen.js`/timeline (AEMET), comprobar forma del JSON y que los
valores tengan sentido (rango de altura de ola, temperatura del agua,
etc.), y la boya 2136/1117/1101 de `poem.puertos.es`.

### 2026-08-31 (segunda pasada, misma fecha)

**Auditoría real hecha con `curl` para todo lo que el entorno permite
alcanzar hoy.** Resultado: todo lo comprobable está sano, nada que
corregir.

- **`functions/prevision.js` — Open-Meteo Marine + Forecast, los 6
  spots.** Pedí exactamente las mismas URLs que construye el código
  (mismos parámetros: `hourly=wave_height,wave_period,wave_direction,
  sea_surface_temperature,ocean_current_velocity,ocean_current_direction,
  sea_level_height_msl` para marine; `windspeed_10m,winddirection_10m,
  precipitation,cloudcover` para forecast). HTTP 200 en los 6 spots.
  Forma del JSON correcta (`hourly.time`, `hourly.wave_height`, etc.,
  igual que espera el código). Valores con sentido para finales de agosto
  en el Cantábrico: altura de ola 0.9–1.6 m, temperatura del agua
  ~22–24°C, viento 8–11 km/h. Nada roto, nada que corregir.
- **Boyas de Puertos del Estado (`poem.puertos.es/portus/StationData`) —
  2136 Bilbao-Vizcaya, 1117 Gijón, 1101 Pasaia II.** Las tres responden
  HTTP 200 con la forma esperada (`[cabeceras, filas]`, cada valor
  `[numero, flag_calidad]`). Bilbao-Vizcaya: Hm0 en torno a 2.0–2.5 m,
  periodo pico 9–10.5 s, dirección ~294–301° (NW/WNW), temp. agua
  ~22.6°C — coherente con oleaje de fondo de Cantábrico en verano, no un
  valor roto ni sospechoso.
- **`functions/luna.js` — USNO (`aa.usno.navy.mil/api/rstt/oneday`).**
  HTTP 200, JSON con la forma que el código espera
  (`properties.data.curphase`, `.moondata[].phen/time`, `.fracillum`).
  Para hoy: fase "Waning Gibbous" (89% iluminada), coherente con la luna
  llena real del 28 de agosto que también devuelve la propia API
  (`closestphase`) — el cálculo de fase encaja con la fecha, no hay
  desfase.
- **`functions/webcam/[slug].js` — bakio y sopelana.** Ambas URL
  configuradas devuelven HTTP 200 con una imagen real y válida (JPEG de
  1024×768 y WebP de 2464×2056 respectivamente, no una página de error ni
  un placeholder). **mundaka** (`kostasystem.com`) no se pudo comprobar
  esta pasada — ese dominio concreto está bloqueado por la política de
  red del entorno (ver sección "Fuentes nuevas" de hoy), no porque la
  fuente esté rota; queda pendiente de revisar la próxima vez que el
  dominio sea alcanzable.
- **`functions/rayos-imagen.js` y el bloque `metaRayos()` dentro de
  `prevision.js` (ambos contra `www.aemet.es`)**: **no se pudo auditar
  esta pasada** — `aemet.es` está bloqueado por la política de red de
  este entorno concreto (comprobado 3 veces, mismo resultado las 3). Esto
  es distinto de la pasada anterior (donde *toda* la red estaba
  bloqueada): ahora es un bloqueo específico de ese dominio. No se marca
  como "roto" porque no hay evidencia de que lo esté — solo no se ha
  podido comprobar desde aquí. Pendiente para cuando el dominio sea
  alcanzable, o para verificarlo manualmente contra el despliegue de
  Cloudflare Pages si el usuario lo prefiere.
- **Repaso de `index.html` para valores hardcodeados presentados como
  reales**: confirmado que los nombres de campo que lee el frontend
  (`alturaSignificativa`, `periodoPico`, `dirOla`, `tempAgua`,
  `marea.altura`, `marea.tendencia`, `marea.proximas`) coinciden
  exactamente con lo que devuelve `functions/prevision.js` — no hay
  desajuste de forma entre backend y frontend. El único bloque de datos
  fijos (`SPOTS`, línea ~410-445) sigue siendo el *fallback* declarado
  para cuando `/prevision` falla, no un dato inventado disfrazado de
  real — mismo veredicto que la pasada anterior, ahora confirmado
  también revisando cómo se consume en el resto del archivo.

**Nada que corregir esta pasada** — todo lo alcanzable coincide con lo
que el código espera y tiene valores con sentido.

### 2026-08-31 (tercera pasada, misma fecha)

**Auditoría completa con `curl` real — todo alcanzable esta vez** (la red
de hoy permitió llegar a `aemet.es`, algo que las dos pasadas anteriores
no pudieron). Un hallazgo trivial corregido, el resto sano.

- **`functions/prevision.js` — Open-Meteo, los 6 spots.** HTTP 200 en
  marine y forecast para los 6. Forma correcta (`hourly.wave_height`,
  `.wave_period`, `.sea_surface_temperature`, etc.). Valores con sentido:
  altura de ola 0.8–1.6 m, agua ~23°C — coherente con la pasada anterior
  del mismo día.
- **Boyas de Puertos del Estado — 2136 Bilbao-Vizcaya, 1117 Gijón, 1101
  Pasaia II.** Las tres HTTP 200, forma `[cabeceras, filas]` correcta.
  Bilbao-Vizcaya: Hm0 1.88 m, Tp 10.55 s, dirección 298° (WNW), agua
  22.9°C. Gijón: Hm0 2.13 m. Pasaia II: Hm0 1.61 m. Todo coherente con
  oleaje de fondo de verano en el Cantábrico.
- **`functions/luna.js` — USNO.** HTTP 200, forma correcta. Fase "Waning
  Gibbous" (89% iluminada), coherente con la luna llena real del 28 de
  agosto (`closestphase` de la propia API).
- **`functions/rayos-imagen.js` (y `metaRayos()` en `prevision.js`) —
  AEMET.** Timeline HTTP 200 (24 bloques horarios) e imagen HTTP 200,
  PNG válido de 5472×1965 px. El fichero pesa solo ~1.4 KB — comprobado
  con `file` que es un PNG 1-bit en escala de grises real y no una
  respuesta rota o vacía; un tamaño tan pequeño es normal en un mapa
  nacional de rayos de un día sin apenas actividad eléctrica (imagen casi
  toda blanca, muy compresible), no un indicio de fallo.
- **`functions/webcam/[slug].js` — mundaka, bakio, sopelana.** Las tres
  HTTP 200 con imagen real (JPEG/WebP válidos, no placeholders).
- **Repaso de código:** se encontró un comentario desactualizado en
  `index.html` (línea ~409) que describía el bloque `SPOTS` de respaldo
  como "datos reales de hoy (scrapeados de Todosurf en esta sesión)" —
  pero `functions/prevision.js` deja claro en sus propios comentarios que
  el scraping de Todosurf se sustituyó por Open-Meteo hace tiempo; ese
  bloque es solo un snapshot estático viejo que se usa de respaldo si
  `/prevision` no responde (comportamiento correcto y ya documentado
  unas líneas más abajo, en `actualizarDesdeBackend()`). No es una
  violación de la norma de honestidad de datos — nada de esto llega al
  usuario etiquetado como algo que no es — pero el comentario en sí
  inducía a error a quien leyera el código. Corregido directamente por
  ser un ajuste trivial de un comentario, sin tocar comportamiento.

**Nada más que corregir** — todo lo demás coincide con lo que el código
espera.

### 2026-09-07

**Auditoría completa con `curl` real — todo alcanzable, todo sano, nada
que corregir.**

- **`functions/prevision.js` — Open-Meteo, los 6 spots.** Repetidas las
  mismas llamadas (marine + forecast) que hace el código. HTTP 200 en las
  12 peticiones (dos timeouts puntuales en el primer intento para
  Lekeitio/Sopelana en `forecast`, ambos resueltos con un segundo intento
  inmediato — ruido de red transitorio, no un fallo del proveedor). Forma
  correcta (`hourly.wave_height`, `.sea_surface_temperature`,
  `.windspeed_10m`, `.pressure_msl`, 48 horas por spot). Valores con
  sentido para principios de septiembre: altura de ola 0.66–1.0 m, agua
  22.7–23.4°C, viento 1.5–11.3 km/h, presión ~1024–1025 hPa. Nada roto.
- **Boyas de Puertos del Estado — 2136 Bilbao-Vizcaya, 1117 Gijón, 1101
  Pasaia II.** Las tres HTTP 200, forma `[cabeceras, filas]` correcta.
  Bilbao-Vizcaya: Hm0 1.41 m, Tp 15.43 s, dirección 294° (WNW), agua
  22.94°C. Gijón: Hm0 1.21 m, agua 21.1°C. Pasaia II: Hm0 1.08 m, agua
  23.2°C. Todo coherente con oleaje de fondo suave de principios de otoño.
- **`functions/luna.js` — USNO.** HTTP 200, forma correcta. Fase "Waning
  Crescent" (17% iluminada), coherente con el cuarto menguante real del 4
  de septiembre que devuelve la propia API (`closestphase`) — encaja con
  la fecha, sin desfase.
- **`functions/rayos-imagen.js` (y `metaRayos()` en `prevision.js`) —
  AEMET.** Timeline HTTP 200 (24 bloques horarios) e imagen HTTP 200, PNG
  válido de 5472×1965 px, 1-bit escala de grises (imagen casi toda blanca,
  normal para un día sin apenas actividad eléctrica, no indicio de fallo).
- **`functions/webcam/[slug].js` — mundaka, bakio, sopelana.** Las tres
  HTTP 200 con imagen real y válida (JPEG 1024×768 ×2, WebP 2464×2056), no
  placeholders ni páginas de error.
- **Repaso de `index.html` y `functions/*.js` en busca de valores
  inventados presentados como reales:** nada nuevo desde la última
  auditoría. El bloque `SPOTS` de respaldo (línea ~430) sigue siendo el
  *fallback* declarado, con su comentario ya corregido en la pasada del
  2026-08-31. El "ÍNDICE DE PESCA" añadido en sesiones de desarrollo
  recientes (no de este robot) está etiquetado en la UI como "(estimación)"
  y en el código dice explícitamente que se calcula solo a partir de dos
  datos reales (temperatura del agua vs. rango documentado por especie, y
  tendencia de presión) — cumple el patrón de honestidad, no es un
  hallazgo. Los rangos de temperatura de `ESPECIES` (línea ~544) traen
  `rangoTemp: null` explícito para las especies sin cifra fiable
  encontrada en fuentes biológicas, en vez de inventar un número — también
  cumple la norma.

**Nada que corregir esta pasada.**

### 2026-09-10 (pasada nocturna corta — salud de datos)

**Pasada nocturna diaria, distinta de la auditoría semanal completa** (esta
sesión es la rutina "Costaviva — calibración nocturna", no el "Robot de
datos" semanal — no se ha tocado ninguna lista de especies ni se ha buscado
ninguna fuente nueva, eso es trabajo de la semanal). Alcance: comprobar con
`curl` real que las fuentes ya integradas siguen respondiendo con la forma
esperada.

- **Boyas de Puertos del Estado — 2136 Bilbao-Vizcaya, 1117 Gijón, 1101
  Pasaia II, y 1731 Barcelona II** (rotando esta noche a una boya
  mediterránea además de las 3 cántabras habituales, según pide la tarea).
  Las 4 HTTP 200, forma `[cabeceras, filas]` correcta, datos de las últimas
  horas. Bilbao-Vizcaya Hm0 1.88 m, Gijón Hm0 1.9 m, Pasaia II Hm0 2.0 m,
  Barcelona II Hm0 0.96 m. Todas sanas — detalle completo en la sección
  "Calibración" de hoy.
- **Boya de Nazaré (Portugal, `monican.hidrografico.pt`) — no se pudo
  comprobar esta pasada.** El dominio fue rechazado por el proxy de salida
  del entorno (`curl: (56) CONNECT tunnel failed, response 403`, 3/3
  intentos, confirmado también contra la raíz del dominio, no solo el
  endpoint JSON). Es el mismo patrón ya documentado muchas veces en este
  archivo: la política de red de este entorno varía de un día/pasada a
  otro y bloquea dominios concretos sin patrón fijo — no hay evidencia de
  que la fuente en sí esté rota, solo que no fue alcanzable hoy desde
  aquí. Sin severidad porque no es un hallazgo, es una limitación de esta
  pasada — pendiente de reintentar en la próxima.
- **Las 4 fuentes de caudal de ríos (Cantábrico/Júcar/Segura/Galicia) — no
  se pudieron comprobar esta pasada, mismo motivo.** Los 4 dominios
  (`visor.saichcantabrico.es`, `saih.chj.es`, `saihweb.chsegura.es`,
  `servizos.meteogalicia.gal`) fueron rechazados por el proxy de salida
  (`403` en los 4, un único intento cada uno tras confirmar con el estado
  del proxy — `recentRelayFailures` — que es un rechazo de política, no un
  timeout del servidor de destino). Son justo las fuentes que la propia
  tarea señala como "las más propensas a romperse" por ser parsers de HTML
  frágiles, así que sería deseable volver a intentarlo pronto — pero de
  momento no hay ninguna evidencia real de rotura, solo de bloqueo de red
  local a esta pasada.
- **Webcams — muestra de 3 (no se llegó a 4 por el mismo bloqueo de red):
  bakio, sopelana, mundaka, las 3 sanas.** HTTP 200 con imagen real y
  válida (JPEG 764 906 bytes, WebP 60 166 bytes, JPEG 173 085 bytes
  respectivamente — no placeholders ni páginas de error). Se intentó
  también una muestra de otras zonas para cumplir mejor el espíritu de
  "zonas distintas" (`cantabria.es` para Suances, `comunitatvalenciana.com`
  para Calpe, `meteogalicia.gal` para A Coruña, `apps.socib.es` para
  Balears) pero los 4 dominios fueron rechazados por el proxy de salida —
  no se pudo ampliar la muestra fuera del País Vasco esta noche. Ninguna
  marcada como rota, solo no alcanzable hoy.

**Resumen de severidad para el usuario:** nada roto confirmado esta noche.
Lo único a vigilar es que la política de red de este entorno bloqueó hoy 8
dominios de fuentes ya integradas y sanas en pasadas anteriores (Nazaré,
las 4 de caudal, y 3 de las 4 webcams de fuera del País Vasco) — igual que
ya ha pasado varias veces documentado más arriba en este archivo, parece
ser variabilidad de la política de red del entorno entre pasadas, no una
rotura real de ninguna fuente. Si esto se repite varias noches seguidas
para el mismo dominio, ahí sí habría que sospechar de una rotura real en
vez de una limitación de red puntual.

### 2026-09-11 (pasada nocturna corta — salud de datos)

**Pasada nocturna diaria, mismo alcance estrecho que la de ayer** (rutina
"Costaviva — calibración nocturna", distinta de la auditoría semanal
completa; no se ha tocado ninguna lista de especies ni se ha buscado
ninguna fuente nueva). Resultado: todo lo alcanzable hoy está sano, pero
**el mismo bloqueo de red de anoche para Nazaré y las 4 fuentes de caudal
se repite hoy, dos noches seguidas** — empieza a merecer vigilancia, ver
aviso más abajo.

- **Boyas de Puertos del Estado — 2136 Bilbao-Vizcaya, 1117 Gijón, 1101
  Pasaia II, y 1514 Málaga** (rotando hoy a una boya del Mediterráneo/Sur
  distinta de la de anoche, según pide la tarea). Las 4 HTTP 200, forma
  `[cabeceras, filas]` correcta, datos de las últimas horas. Bilbao-Vizcaya
  Hm0 0.94 m, Gijón Hm0 0.81 m, Pasaia II Hm0 1.1 m, Málaga Hm0 0.42 m.
  Todas sanas — detalle completo en la sección "Calibración" de hoy.
- **Boya de Nazaré (Portugal, `monican.hidrografico.pt`) — bloqueada de
  nuevo, segunda noche seguida.** Rechazada por el proxy de salida
  (`curl: (56) CONNECT tunnel failed, response 403`, 2/2 intentos, tanto al
  endpoint JSON como a la raíz del dominio). Idéntico resultado a la pasada
  de anoche (2026-09-10). Todavía sin evidencia de que la fuente en sí esté
  rota (nunca ha llegado a responder con datos vacíos o mal formados, solo
  no ha sido alcanzable), pero ya son 2/2 noches — si mañana se repite otra
  vez, pasaría a marcarse como hallazgo de red persistente en vez de ruido
  puntual.
- **Las 4 fuentes de caudal de ríos (Cantábrico/Júcar/Segura/Galicia) —
  bloqueadas de nuevo, segunda noche seguida, mismo motivo.** Los 4
  dominios (`visor.saichcantabrico.es`, `saih.chj.es`, `saihweb.chsegura.es`,
  `servizos.meteogalicia.gal`) rechazados por el proxy de salida (`403` en
  los 4, confirmado también que no hay fallos de red registrados en el
  estado del proxy — es un rechazo de política, no un timeout del servidor
  de destino). Igual que con Nazaré: 2/2 noches seguidas bloqueadas. Son
  justo las fuentes que la tarea señala como más frágiles (parsers de HTML),
  así que esta racha de bloqueo de red es más preocupante para ellas que
  para las boyas — pero sigue sin haber ninguna evidencia real de rotura de
  la fuente en sí, solo de la red de este entorno hacia esos 4 dominios
  concretos.
- **Webcams — intento de ampliar a zonas fuera del País Vasco (suances,
  calpe, acoruna, calamillor) bloqueado en los 4 dominios**, mismo patrón
  que anoche. Se cayó de nuevo a la muestra de las 3 habituales del País
  Vasco: **mundaka, bakio, sopelana — las 3 sanas.** HTTP 200 con imagen
  real y válida (JPEG 144 618 bytes 1024×768, JPEG 764 906 bytes 1024×768,
  WebP 48 158 bytes 2464×2056 respectivamente — no placeholders ni páginas
  de error).

**Resumen de severidad para el usuario:** nada roto confirmado esta noche
tampoco. **Aviso de vigilancia (no severidad "roto" todavía):** Nazaré y
las 4 fuentes de caudal llevan **2/2 pasadas nocturnas seguidas** (2026-09-10
y 2026-09-11) bloqueadas por la política de red de este entorno, sin poder
confirmar si siguen sanas. No es (todavía) evidencia de rotura real — el
propio historial de este archivo muestra que la política de red de este
entorno varía de un día a otro sin patrón fijo (ver entradas de agosto) —
pero si una tercera noche seguida repite el mismo bloqueo para los mismos
dominios, la siguiente pasada debería empezar a tratarlo como una limitación
estructural de este entorno concreto (a reportar al usuario como tal) en
vez de asumir que se resolverá solo. Las webcams de fuera del País Vasco
tienen el mismo patrón pero son de severidad menor (hay 46 webcams más que
sí se pueden comprobar cuando la red lo permite).

### 2026-09-12 (pasada nocturna corta — salud de datos)

**Pasada nocturna diaria, mismo alcance estrecho** (rutina "Costaviva —
calibración nocturna", no la auditoría semanal completa). **Aviso
importante: el bloqueo de red de las dos noches anteriores se repite hoy
por tercera noche seguida y exactamente para los mismos 5 dominios**
(Nazaré + las 4 fuentes de caudal), mientras que todo lo demás (boyas de
Puertos del Estado, Open-Meteo, las 3 webcams del País Vasco) sigue
respondiendo con normalidad las 3 noches. Con este patrón tan estable —
siempre los mismos dominios bloqueados, todo lo demás sano — deja de
parecer variabilidad aleatoria de red y empieza a parecer una política de
salida de **este entorno concreto** (no de las fuentes en sí) que excluye
esos dominios de forma consistente. Ver aviso al usuario más abajo.

- **Boyas de Puertos del Estado — 2136 Bilbao-Vizcaya, 1117 Gijón, 1101
  Pasaia II, y 2548 Cabo de Gata** (rotando hoy a una boya del
  Mediterráneo/Sur distinta de las de las dos noches anteriores, según pide
  la tarea). Las 4 HTTP 200 finalmente, forma `[cabeceras, filas]`
  correcta, datos de la última hora. La petición a 1117 Gijón devolvió un
  502 en el primer intento (`gateway answered 502 to CONNECT`, registrado
  en el estado del proxy) pero funcionó a la primera reintentando — parece
  un fallo transitorio puntual, no un patrón, así que no se marca como
  hallazgo. Bilbao-Vizcaya Hm0 0.59 m, Gijón Hm0 0.73 m, Pasaia II Hm0
  0.82 m, Cabo de Gata Hm0 0.59 m. Todas sanas — detalle completo en la
  sección "Calibración" de hoy.
- **Boya de Nazaré (Portugal, `monican.hidrografico.pt`) — bloqueada
  tercera noche seguida (2026-09-10, 11 y 12), 2/2 intentos hoy** (endpoint
  JSON y raíz del dominio), mismo error exacto que las dos noches
  anteriores: `curl: (56) CONNECT tunnel failed, response 403`, confirmado
  en el estado del proxy como `connect_rejected` (`policy denial or
  upstream failure`). Sigue sin haber ninguna evidencia de que la fuente en
  sí esté rota (nunca ha respondido con datos vacíos o mal formados, solo
  no ha sido alcanzable desde aquí) — pero 3/3 noches con el mismo bloqueo
  exacto, mientras que boyas y webcams de otros dominios sí funcionan sin
  problema esas mismas noches, ya no encaja con "ruido puntual de red".
- **Las 4 fuentes de caudal de ríos (Cantábrico/Júcar/Segura/Galicia) —
  bloqueadas tercera noche seguida, mismo motivo exacto.** Los 4 dominios
  (`visor.saichcantabrico.es`, `saih.chj.es`, `saihweb.chsegura.es`,
  `servizos.meteogalicia.gal`) rechazados con HTTP 403 en el primer intento
  de cada uno, confirmado en el estado del proxy como `connect_rejected`
  (rechazo de política, no timeout del servidor de destino). 3/3 noches
  seguidas para estos 4 dominios exactos.
- **Webcams — muestra de 3 del País Vasco (mundaka, bakio, sopelana), las
  3 sanas**, HTTP 200 con imagen real y válida (JPEG 150 431 bytes, JPEG
  764 906 bytes, WebP 53 996 bytes respectivamente). Se intentó de nuevo
  ampliar a otras zonas (acoruna/meteogalicia.gal, suances/cantabria.es,
  calpe/comunitatvalenciana.com, calamillor/apps.socib.es) y los 4 dominios
  fueron rechazados, mismo patrón que las dos noches anteriores — de nuevo
  no se pudo ampliar la muestra fuera del País Vasco.

**Resumen de severidad para el usuario — esto ya merece tu atención, no
solo vigilancia:** nada de lo comprobado esta noche está confirmado como
roto en el propio origen de datos. Pero **Nazaré y las 4 fuentes de caudal
de ríos llevan 3/3 pasadas nocturnas seguidas (10, 11 y 12 de septiembre)
bloqueadas siempre por los mismos 5 dominios exactos**, mientras que en
esas mismas noches todo lo demás (boyas españolas, Open-Meteo, webcams del
País Vasco) responde con normalidad. Esa consistencia — mismos dominios,
mismas 3 noches, todo lo demás sano — apunta a que **este entorno de
ejecución concreto tiene esos 5 dominios excluidos de su política de salida
de red**, no a que las fuentes en sí se hayan roto. Severidad: media para
los 4 ríos (son justo los parsers de HTML más frágiles, como advierte la
tarea, y esta rutina no puede vigilarlos de verdad mientras dure el
bloqueo) y baja-media para Nazaré (es la única boya real de Portugal, pero
el resto del proyecto sigue funcionando sin ella). Si el bloqueo persiste,
convendría revisar la política de red de este entorno programado para
esos 5 dominios (`monican.hidrografico.pt`, `visor.saichcantabrico.es`,
`saih.chj.es`, `saihweb.chsegura.es`, `servizos.meteogalicia.gal`) — la
rutina nocturna seguirá sin poder confirmar su salud mientras sigan
bloqueados desde aquí.

### 2026-09-13 (pasada nocturna corta — salud de datos)

**Pasada nocturna diaria, mismo alcance estrecho** (rutina "Costaviva —
calibración nocturna", no la auditoría semanal completa). **El bloqueo de
red de las tres noches anteriores se repite hoy por cuarta noche
seguida, exactamente para los mismos 5 dominios** (Nazaré + las 4 fuentes
de caudal), mientras que todo lo demás sigue sano.

- **Boyas de Puertos del Estado — 2136 Bilbao-Vizcaya, 1117 Gijón, 1101
  Pasaia II, y 2820 Dragonera (Mallorca)** (rotando hoy a una boya del
  Mediterráneo/Baleares, región distinta de las tres últimas rotaciones —
  1731 Barcelona II, 1514 Málaga, 2548 Cabo de Gata). Las 4 HTTP 200,
  forma `[cabeceras, filas]` correcta, datos de la última hora. Bilbao-
  Vizcaya Hm0 0.94 m, Gijón Hm0 1.26 m, Pasaia II Hm0 0.83 m, Dragonera
  Hm0 0.47 m. Todas sanas — detalle completo en la sección "Calibración"
  de hoy.
- **Boya de Nazaré (Portugal, `monican.hidrografico.pt`) — bloqueada
  cuarta noche seguida (2026-09-10, 11, 12 y 13), 2/2 intentos hoy**
  (endpoint JSON y raíz del dominio), mismo error exacto que las tres
  noches anteriores: `curl: (56) CONNECT tunnel failed, response 403`.
  Sigue sin haber ninguna evidencia de que la fuente en sí esté rota —
  solo no ha sido alcanzable desde aquí ninguna de las 4 noches.
- **Las 4 fuentes de caudal de ríos (Cantábrico/Júcar/Segura/Galicia) —
  bloqueadas cuarta noche seguida, mismo motivo exacto.** Los 4 dominios
  (`visor.saichcantabrico.es`, `saih.chj.es`, `saihweb.chsegura.es`,
  `servizos.meteogalicia.gal`) rechazados con HTTP 403 en el primer
  intento de cada uno. 4/4 noches seguidas para estos 4 dominios exactos.
- **Webcams — muestra de 3 del País Vasco (mundaka, bakio, sopelana), las
  3 sanas**, HTTP 200 con imagen real y válida (JPEG 177 905 bytes,
  JPEG 764 906 bytes, WebP 50 238 bytes respectivamente). Se intentó de
  nuevo ampliar a otras zonas (acoruna/meteogalicia.gal,
  suances/cantabria.es, calpe/comunitatvalenciana.com) y los 3 dominios
  fueron rechazados, mismo patrón que las noches anteriores — de nuevo no
  se pudo ampliar la muestra fuera del País Vasco.

**Resumen de severidad para el usuario: sin cambios respecto a ayer, ya
son 4/4 noches seguidas.** Nada de lo comprobado esta noche está
confirmado como roto en el origen de datos — Nazaré y las 4 fuentes de
caudal llevan **4/4 pasadas nocturnas seguidas (10, 11, 12 y 13 de
septiembre) bloqueadas siempre por los mismos 5 dominios exactos**,
mientras que boyas españolas, Open-Meteo y las webcams del País Vasco
siguen respondiendo con normalidad esas mismas noches. Esto refuerza la
conclusión de ayer: es una exclusión de política de red de este entorno
concreto hacia esos 5 dominios, no una rotura real de las fuentes.
Severidad sin cambios (media para los 4 ríos, baja-media para Nazaré) —
sigue pendiente que el usuario revise la política de red de este entorno
programado para esos 5 dominios si quiere que esta rutina pueda vigilar
su salud de verdad.

### 2026-09-14 (pasada nocturna corta — salud de datos)

**Pasada nocturna diaria, mismo alcance estrecho** (rutina "Costaviva —
calibración nocturna", no la auditoría semanal completa). **El bloqueo de
red de las cuatro noches anteriores se repite hoy por quinta noche
seguida, exactamente para los mismos 5 dominios** (Nazaré + las 4 fuentes
de caudal), mientras que todo lo demás sigue sano. Confirmado además en el
estado del proxy de esta sesión (`recentRelayFailures`): los 5 rechazos de
hoy son `connect_rejected` / "gateway answered 403 to CONNECT (policy
denial or upstream failure)" — mismo tipo de rechazo exacto que las noches
anteriores, refuerza que es política de red del entorno, no una caída real
del servidor de destino.

- **Boyas de Puertos del Estado — 2136 Bilbao-Vizcaya, 1117 Gijón, 1101
  Pasaia II, y 2242 Cabo Peñas** (rotando hoy a la última boya que quedaba
  sin probar de la lista corta de candidatas — Barcelona II, Málaga, Cabo
  de Gata y Dragonera ya se habían comprobado en pasadas anteriores). Las 4
  HTTP 200, forma `[cabeceras, filas]` correcta, datos de la última hora.
  Bilbao-Vizcaya Hm0 1.41 m, Gijón Hm0 1.36 m, Pasaia II Hm0 1.39 m, Cabo
  Peñas Hm0 1.88 m. Todas sanas — detalle completo en la sección
  "Calibración" de hoy.
- **Boya de Nazaré (Portugal, `monican.hidrografico.pt`) — bloqueada
  quinta noche seguida (2026-09-10 a 14), 1/1 intento hoy**, mismo error
  exacto que las cuatro noches anteriores: `curl: (56) CONNECT tunnel
  failed, response 403`. Sigue sin haber ninguna evidencia de que la fuente
  en sí esté rota — solo no ha sido alcanzable desde aquí ninguna de las 5
  noches.
- **Las 4 fuentes de caudal de ríos (Cantábrico/Júcar/Segura/Galicia) —
  bloqueadas quinta noche seguida, mismo motivo exacto.** Los 4 dominios
  (`visor.saichcantabrico.es`, `saih.chj.es`, `saihweb.chsegura.es`,
  `servizos.meteogalicia.gal`) rechazados con HTTP 403 en el primer intento
  de cada uno. 5/5 noches seguidas para estos 4 dominios exactos.
- **Webcams — muestra de 3 del País Vasco (mundaka, bakio, sopelana), las
  3 sanas**, HTTP 200 con imagen real y válida (JPEG 1024×768, JPEG
  1024×768, WebP 2464×2056 respectivamente). Se intentó de nuevo ampliar a
  otras zonas (`www.meteogalicia.gal` para A Coruña, `cantabria.es` para
  Suances, `comunitatvalenciana.com` para Calpe, `apps.socib.es` para
  Calamillor) y los 4 dominios fueron rechazados, mismo patrón que las
  noches anteriores — nótese que esta vez el bloqueo alcanzó también
  `www.meteogalicia.gal` (webcam), un subdominio distinto del
  `servizos.meteogalicia.gal` que ya se sabía bloqueado para el caudal de
  Galicia — de nuevo no se pudo ampliar la muestra fuera del País Vasco.

**Resumen de severidad para el usuario: sin cambios respecto a ayer, ya
son 5/5 noches seguidas.** Nada de lo comprobado esta noche está
confirmado como roto en el origen de datos — Nazaré y las 4 fuentes de
caudal llevan **5/5 pasadas nocturnas seguidas (10 al 14 de septiembre)
bloqueadas siempre por los mismos 5 dominios exactos**, mientras que boyas
españolas, Open-Meteo y las webcams del País Vasco siguen respondiendo con
normalidad esas mismas noches. Severidad sin cambios (media para los 4
ríos, baja-media para Nazaré) — sigue pendiente que el usuario revise la
política de red de este entorno programado para esos 5 dominios si quiere
que esta rutina pueda vigilar su salud de verdad.

### 2026-09-15 (pasada nocturna corta — salud de datos)

**Pasada nocturna diaria, mismo alcance estrecho.** **El bloqueo de red
se repite hoy por sexta noche seguida, exactamente para los mismos 5
dominios** (Nazaré + las 4 fuentes de caudal), mientras que todo lo demás
sigue sano. Confirmado de nuevo en `recentRelayFailures` del proxy de
esta sesión: mismo `connect_rejected` / "gateway answered 403 to CONNECT"
que las cinco noches anteriores.

- **Boyas de Puertos del Estado — 2136 Bilbao-Vizcaya, 1117 Gijón, 1101
  Pasaia II y 2548 Cabo de Gata** (rotando a la boya de la lista corta que
  llevaba más noches sin repetirse). Las 4 HTTP 200, forma
  `[cabeceras, filas]` correcta, dato de la última hora. Bilbao-Vizcaya
  Hm0 0.94 m, Gijón Hm0 1.07 m, Pasaia II Hm0 0.99 m, Cabo de Gata Hm0
  0.35 m. Todas sanas — detalle completo en la sección "Calibración" de
  hoy.
- **Boya de Nazaré (Portugal, `monican.hidrografico.pt`) — bloqueada
  sexta noche seguida (2026-09-10 a 15)**, mismo `curl: (56) CONNECT
  tunnel failed, response 403` que siempre. Sigue sin ninguna evidencia
  de que la fuente en sí esté rota, solo inalcanzable desde aquí.
- **Las 4 fuentes de caudal de ríos (Cantábrico/Júcar/Segura/Galicia) —
  bloqueadas sexta noche seguida, mismos 4 dominios exactos**
  (`visor.saichcantabrico.es`, `saih.chj.es`, `saihweb.chsegura.es`,
  `servizos.meteogalicia.gal`), rechazo 403 en el primer intento de cada
  una.
- **Webcams — muestra de 3 del País Vasco (mundaka, bakio, sopelana), las
  3 sanas**, HTTP 200 con imagen real (JPEG ~169 KB, JPEG ~765 KB, WebP
  ~50 KB respectivamente — tamaños coherentes con una foto real, no una
  respuesta vacía o de error). Se intentó de nuevo ampliar la muestra
  fuera del País Vasco (`www.meteogalicia.gal` para A Coruña,
  `www.cantabria.es` para Laredo, `streaming.comunitatvalenciana.com`
  para Valencia, `apps.socib.es` para Calamillor) y los 4 dominios
  siguieron rechazados — mismo patrón que las noches anteriores, sin
  poder confirmar salud fuera de las webcams vascas.

**Resumen de severidad: sin cambios respecto a las cinco noches
anteriores, ya son 6/6 seguidas.** Nada de lo comprobado esta noche está
confirmado como roto en origen — Nazaré y las 4 fuentes de caudal llevan
6/6 pasadas nocturnas seguidas (10 al 15 de septiembre) bloqueadas
siempre por los mismos 5 dominios exactos, mientras boyas españolas,
Open-Meteo y las webcams vascas siguen respondiendo con normalidad.
Severidad sin cambios (media para los 4 ríos, baja-media para Nazaré) —
sigue pendiente que el usuario revise la política de red de este entorno
para esos 5 dominios concretos si quiere que esta rutina pueda vigilar su
salud de verdad.

### 2026-09-16 (pasada nocturna corta — salud de datos)

**Pasada nocturna diaria, mismo alcance estrecho.** **El bloqueo de red se
repite hoy por séptima noche seguida, exactamente para los mismos 5
dominios** (Nazaré + las 4 fuentes de caudal), mientras que todo lo demás
sigue sano.

- **Boyas de Puertos del Estado — 2136 Bilbao-Vizcaya, 1117 Gijón, 1101
  Pasaia II y 1731 Barcelona II** (rotación de esta noche: Barcelona II,
  la candidata de la lista corta con más noches sin repetirse desde el
  punto de vista de esta rutina nocturna). Las 4 HTTP 200, forma
  `[cabeceras, filas]` correcta, dato de la última hora (Pasaia II con un
  hueco `"-"` a las 23:00 pero con dato válido justo antes, sin problema).
  Bilbao-Vizcaya Hm0 1.52 m, Gijón Hm0 1.62 m, Pasaia II Hm0 1.37 m,
  Barcelona II Hm0 0.36 m. Todas sanas — detalle completo en la sección
  "Calibración" de hoy.
- **Boya de Nazaré (Portugal, `monican.hidrografico.pt`) — bloqueada
  séptima noche seguida (2026-09-10 a 16)**, mismo `curl: (56) CONNECT
  tunnel failed, response 403` que siempre. Sigue sin ninguna evidencia de
  que la fuente en sí esté rota, solo inalcanzable desde aquí.
- **Las 4 fuentes de caudal de ríos (Cantábrico/Júcar/Segura/Galicia) —
  bloqueadas séptima noche seguida, mismos 4 dominios exactos**
  (`visor.saichcantabrico.es`, `saih.chj.es`, `saihweb.chsegura.es`,
  `servizos.meteogalicia.gal`), rechazo 403 en el primer intento de cada
  una.
- **Webcams — muestra de 3 del País Vasco (mundaka, bakio, sopelana), las
  3 sanas**, HTTP 200 con imagen real (JPEG ~123 KB, JPEG ~747 KB, WebP
  ~39 KB respectivamente). Se intentó de nuevo ampliar la muestra fuera
  del País Vasco (`www.meteogalicia.gal` para A Coruña, `www.cantabria.es`
  para Laredo, `streaming.comunitatvalenciana.com` para Valencia,
  `apps.socib.es` para Calamillor) y los 4 dominios siguieron rechazados —
  mismo patrón que las seis noches anteriores.

**Resumen de severidad: sin cambios respecto a las seis noches anteriores,
ya son 7/7 seguidas.** Nada de lo comprobado esta noche está confirmado
como roto en origen — Nazaré y las 4 fuentes de caudal llevan 7/7 pasadas
nocturnas seguidas (10 al 16 de septiembre) bloqueadas siempre por los
mismos 5 dominios exactos, mientras boyas españolas, Open-Meteo y las
webcams vascas siguen respondiendo con normalidad. Severidad sin cambios
(media para los 4 ríos, baja-media para Nazaré) — sigue pendiente que el
usuario revise la política de red de este entorno para esos 5 dominios
concretos si quiere que esta rutina pueda vigilar su salud de verdad.

---

## Calibración

### 2026-08-31

**Bloqueada por red — no se ha podido tomar ningún punto de calibración
real esta pasada.** No se ha creado ni tocado `CALIBRACION.jsonl`: sin
poder pedir de verdad la altura de ola calculada (Open-Meteo, los 6
spots) ni la altura medida de la boya de Bilbao-Vizcaya (2136), escribir
una línea en ese archivo sería inventar un dato de calibración — justo lo
que este proyecto existe para evitar. Mejor no escribir nada que escribir
un número falso etiquetado como medición real.

En cuanto la red lo permita, la primera pasada que funcione debe: pedir
por `curl` las mismas llamadas que hace `functions/prevision.js` para los
6 spots, pedir la boya 2136 (y 1117/1101 si aportan contexto), y añadir
la primera línea real a `CALIBRACION.jsonl`. Con al menos 8 puntos de
historial se podrá calcular la desviación media y, si es sistemática y
grande, proponer aquí un factor de corrección (a confirmar por el
usuario, nunca aplicado en automático).

### 2026-08-31 (segunda pasada, misma fecha)

**Primer punto de calibración real registrado en `CALIBRACION.jsonl`.**
La red permitió esta vez alcanzar tanto Open-Meteo como
`poem.puertos.es`, así que pedí por `curl` la altura de ola calculada
para los 6 spots (misma llamada que hace `functions/prevision.js`) y la
boya 2136 Bilbao-Vizcaya, ambas para la misma hora local (2026-08-31
14:00 CEST = 12:00 UTC, coincide exactamente con el último dato de la
boya). Resultado (boya Hm0 = 1.99 m):

| spot | altura calculada | diferencia | % |
|---|---|---|---|
| lekeitio | 1.02 m | −0.97 m | −48.7% |
| mundaka | 1.58 m | −0.41 m | −20.6% |
| bakio | 1.28 m | −0.71 m | −35.7% |
| sopelana | 1.34 m | −0.65 m | −32.7% |
| plentzia | 1.34 m | −0.65 m | −32.7% |
| getxo | 1.30 m | −0.69 m | −34.7% |

Con un solo punto **no se puede sacar ninguna conclusión de calibración
todavía** (hacen falta al menos 8, según la instrucción de esta tarea).
Es solo el primer dato, guardado en `CALIBRACION.jsonl` (no se ha tocado
nada más del archivo, solo se ha añadido esta línea). A simple vista
todos los spots calculan por debajo de la boya, lo cual es esperable
_a priori_ (la boya está en mar abierto, los spots están más resguardados
en la costa) — pero con un punto no se distingue "efecto costero real"
de "ruido de un día concreto", así que no se propone ningún factor de
corrección todavía. Seguir acumulando puntos en próximas pasadas.

### 2026-08-31 (tercera pasada, misma fecha)

**Segundo punto de calibración añadido a `CALIBRACION.jsonl`** (solo se
añade la línea nueva, historial anterior intacto). Misma metodología que
la pasada anterior: pedir por `curl` la altura de ola calculada para los
6 spots y la boya 2136, emparejando la hora local de Open-Meteo con la
hora exacta del último dato real de la boya (esta vez la boya publicó su
última lectura a las 13:00 UTC = 15:00 CEST, una hora más tarde que en el
punto anterior del mismo día — no es una hora fija, se recalcula cada vez
a partir del propio timestamp que devuelve la boya). Resultado (boya
Hm0 = 1.88 m):

| spot | altura calculada | diferencia | % |
|---|---|---|---|
| lekeitio | 1.02 m | −0.86 m | −45.7% |
| mundaka | 1.58 m | −0.30 m | −16.0% |
| bakio | 1.30 m | −0.58 m | −30.9% |
| sopelana | 1.34 m | −0.54 m | −28.7% |
| plentzia | 1.34 m | −0.54 m | −28.7% |
| getxo | 1.32 m | −0.56 m | −29.8% |

Con 2 puntos de historial **sigue sin llegar al mínimo de 8** que pide la
tarea antes de calcular una desviación media o proponer un factor de
corrección. Lo que sí se puede decir informalmente: en ambos puntos del
mismo día, todos los spots calculan sistemáticamente por debajo de la
boya (mar abierto vs. costa resguardada, como cabía esperar), con
mundaka consistentemente la desviación más pequeña (−20.6% y −16.0%) y
lekeitio la mayor (−48.7% y −45.7%) — pero son solo 2 muestras del mismo
día, así que esto es una observación, no una conclusión. Sin factor de
corrección propuesto todavía; seguir acumulando puntos, idealmente en
días y horas distintas para no confundir el patrón real con el estado de
mar de un único día.

### 2026-09-07

**Tercer punto de calibración añadido a `CALIBRACION.jsonl`** (solo se
añade la línea nueva, historial anterior intacto) — primer punto que no es
del mismo día que los dos anteriores (31 de agosto), así que empieza a
aportar variedad real de días/estados de mar en vez de repetir el mismo
día. Misma metodología: `curl` a la boya 2136 y a Open-Meteo para los 6
spots, emparejando por la hora exacta del último dato real de la boya
(07:00 UTC = 09:00 CEST). Resultado (boya Hm0 = 1.41 m, bastante más baja
que en los dos puntos de agosto):

| spot | altura calculada | diferencia | % |
|---|---|---|---|
| lekeitio | 0.70 m | −0.71 m | −50.4% |
| mundaka | 1.00 m | −0.41 m | −29.1% |
| bakio | 0.84 m | −0.57 m | −40.4% |
| sopelana | 0.86 m | −0.55 m | −39.0% |
| plentzia | 0.86 m | −0.55 m | −39.0% |
| getxo | 0.84 m | −0.57 m | −40.4% |

Con 3 puntos **todavía no se llega al mínimo de 8** que pide la tarea antes
de calcular una desviación media o proponer un factor de corrección. Lo que
sí se sostiene con este tercer punto, ahora en un día distinto y con un
estado de mar más suave que los dos anteriores (Hm0 boya bajó de ~1.9-2.0m
a 1.41m): el patrón de "todos los spots por debajo de la boya" se mantiene,
mundaka sigue siendo consistentemente el spot con menor desviación (−20.6%,
−16.0%, −29.1%) y lekeitio el de mayor (−48.7%, −45.7%, −50.4%) — la
distancia entre ambos extremos se mantiene bastante estable alrededor de
~20-30 puntos porcentuales en los tres puntos, lo cual empieza a parecer
más un efecto geográfico consistente (mundaka es una ría más resguardada/
con más refracción de oleaje hacia dentro; lekeitio puede estar peor
representado por las coordenadas actuales del spot) que ruido — pero con
solo 3 muestras sigue siendo una observación, no una conclusión con
suficiente respaldo. Seguir acumulando puntos en próximas pasadas, faltan
al menos 5 más.

### 2026-09-10 (pasada nocturna corta — nueva metodología)

**Pasada nocturna diaria** (rutina "Costaviva — calibración nocturna",
corta y enfocada, distinta de la auditoría semanal completa que hace
`ROBOT.md` en sus otras entradas). A partir de hoy la calibración nocturna
usa una metodología algo distinta a los 3 puntos anteriores de este
archivo, y **no son directamente comparables entre sí**:

- Los 3 puntos anteriores (31 ago. y 7 sep.) comparaban la altura
  calculada **en cada uno de los 6 spots del País Vasco** contra la altura
  medida por **una sola boya de referencia** (2136, mar adentro) — mezclan
  en la misma cifra el error del modelo de Open-Meteo *y* el efecto
  geográfico real de estar más resguardado en la costa que en mar abierto.
- Los 4 puntos de hoy comparan, boya por boya, la altura calculada por
  Open-Meteo **justo en las coordenadas de esa misma boya** contra lo que
  la boya mide en ese instante — así se aísla el error propio del modelo,
  sin mezclarlo con la distancia geográfica a ningún spot. Se marcan en
  `CALIBRACION.jsonl` con `"tipo": "boya_vs_openmeteo_mismo_punto"` para
  distinguirlos de las líneas anteriores (que no llevan ese campo).

Metodología de hoy: `curl` real a `poem.puertos.es/portus/StationData` para
las boyas 2136 (Bilbao-Vizcaya), 1117 (Gijón) y 1101 (Pasaia II) —el
mínimo que pide la tarea— más una cuarta boya de otra región para ir
rotando cobertura: **1731 Barcelona II** (Mediterráneo, no comprobada
hasta ahora en ninguna pasada de calibración). Para cada una, `curl` a
Open-Meteo Marine (`marine-api.open-meteo.com/v1/marine`, mismo parámetro
`wave_height` que usa `functions/prevision.js`) con la lat/lon exacta de
esa boya (las mismas coordenadas que trae `BOYAS` en
`functions/prevision.js`), emparejando por la hora UTC exacta del último
dato real de cada boya:

| boya | hora UTC | altura medida | altura calculada | diferencia | % |
|---|---|---|---|---|---|
| 2136 Bilbao-Vizcaya | 01:00 | 1.88 m | 1.72 m | −0.16 m | −8.5% |
| 1117 Gijón | 2026-09-09 23:00 | 1.90 m | 1.62 m | −0.28 m | −14.7% |
| 1101 Pasaia II | 00:00 | 2.00 m | 1.28 m | −0.72 m | −36.0% |
| 1731 Barcelona II | 00:00 | 0.96 m | 0.74 m | −0.22 m | −22.9% |

Con solo 4 puntos de esta nueva metodología (0 de historial previo, porque
es la primera pasada que la usa) **no se llega ni de lejos** al mínimo de
15 puntos por boya/zona que pide la tarea antes de proponer un factor de
corrección — ni siquiera hay más de un punto todavía para ninguna boya
individual. Observación preliminar sin ninguna conclusión: las 4 boyas de
hoy salen con Open-Meteo calculando **por debajo** de la medición real
directamente en el punto de la boya (no solo en los spots costeros como ya
se veía antes), con Pasaia II la desviación más grande (−36%) y
Bilbao-Vizcaya la más pequeña (−8.5%) — pero es un único punto por boya en
un único instante, así que podría ser tanto sesgo real del modelo en esa
zona como ruido de esta hora/estado de mar concreto. Seguir acumulando,
rotando cada noche por alguna boya nueva de otra región (candidatas para
próximas pasadas: 1514 Málaga, 2548 Cabo de Gata, o repetir 2136/1117/1101
para ir sumando historial en las 3 obligatorias) hasta tener al menos 15
puntos por boya antes de plantear ningún factor de corrección.

### 2026-09-11 (pasada nocturna corta)

**Segundo día con la metodología "boya vs. Open-Meteo en el mismo punto"**
(mismo criterio que ayer: se aísla el error del modelo, sin mezclarlo con
el efecto costero de los spots). `curl` a las boyas 2136 (Bilbao-Vizcaya),
1117 (Gijón) y 1101 (Pasaia II) —las 3 obligatorias— más **1514 Málaga**
como cuarta boya de rotación (Mediterráneo/Sur, distinta de la 1731
Barcelona II de anoche, para ir cubriendo más zonas como pide la tarea).
Mismo método: Open-Meteo Marine en las coordenadas exactas de cada boya,
emparejando por la hora UTC exacta del último dato real de cada boya:

| boya | hora UTC | altura medida | altura calculada | diferencia | % |
|---|---|---|---|---|---|
| 2136 Bilbao-Vizcaya | 01:00 | 0.94 m | 0.94 m | 0.00 m | 0.0% |
| 1117 Gijón | 00:00 | 0.81 m | 0.84 m | +0.03 m | +3.7% |
| 1101 Pasaia II | 00:00 | 1.10 m | 0.80 m | −0.30 m | −27.3% |
| 1514 Málaga | 00:00 | 0.42 m | 0.26 m | −0.16 m | −38.1% |

Con este segundo día, el historial de esta metodología queda así (todavía
muy lejos del mínimo de 15 puntos por boya que pide la tarea antes de
proponer ningún factor de corrección):

- **2136 Bilbao-Vizcaya**: 2 puntos (−8.5%, 0.0%) — la boya con menor
  desviación en ambos días, consistente con ser la que Open-Meteo modela
  mejor de las 3 obligatorias hasta ahora.
- **1117 Gijón**: 2 puntos (−14.7%, +3.7%) — signo distinto entre los dos
  días (un día por debajo, otro por encima), demasiado pronto para hablar
  de sesgo sistemático.
- **1101 Pasaia II**: 2 puntos (−36.0%, −27.3%) — sigue siendo, con
  diferencia, la boya de las 3 obligatorias con mayor desviación los dos
  días que se ha comprobado, siempre en la misma dirección (Open-Meteo por
  debajo). Es la que más vale la pena vigilar de cerca en próximas pasadas:
  si se mantiene así con más puntos, sería la primera candidata a un factor
  de corrección de zona.
- **1731 Barcelona II** (Mediterráneo): 1 punto (−22.9%), sin repetir hoy.
- **1514 Málaga** (Sur/Mediterráneo): 1 punto nuevo hoy (−38.1%), la
  desviación más grande de las 5 boyas vistas hasta ahora en cualquier día
  — pero un solo punto no permite decir si es sesgo de zona o el propio
  oleaje residual/de mar de viento local (Hm0 muy bajo, 0.42 m, donde un
  error absoluto pequeño se traduce en un % grande) mal capturado por el
  modelo de aguas abiertas.

**Ningún factor de corrección propuesto todavía** — ninguna boya llega ni
de lejos a los 15 puntos que pide la tarea. Seguir rotando cada noche por
alguna boya nueva de otra región (candidata para la próxima: 2548 Cabo de
Gata) además de sumar historial en las 3 obligatorias.

### 2026-09-12 (pasada nocturna corta)

**Tercer día con la metodología "boya vs. Open-Meteo en el mismo punto".**
`curl` a las boyas 2136 (Bilbao-Vizcaya), 1117 (Gijón) y 1101 (Pasaia II)
—las 3 obligatorias— más **2548 Cabo de Gata** como cuarta boya de rotación
(Mediterráneo/Sur, la candidata que quedó apuntada ayer, distinta de 1731
Barcelona II y 1514 Málaga ya vistas). Mismo método: Open-Meteo Marine en
las coordenadas exactas de cada boya, emparejando por la hora UTC exacta
del último dato real de cada boya:

| boya | hora UTC | altura medida | altura calculada | diferencia | % |
|---|---|---|---|---|---|
| 2136 Bilbao-Vizcaya | 01:00 | 0.59 m | 0.74 m | +0.15 m | +25.4% |
| 1117 Gijón | 00:00 | 0.73 m | 0.74 m | +0.01 m | +1.4% |
| 1101 Pasaia II | 00:00 | 0.82 m | 0.58 m | −0.24 m | −29.3% |
| 2548 Cabo de Gata | 01:00 | 0.59 m | 0.52 m | −0.07 m | −11.9% |

Con este tercer día, el historial de esta metodología queda así (todavía
lejos del mínimo de 15 puntos por boya que pide la tarea antes de proponer
ningún factor de corrección):

- **2136 Bilbao-Vizcaya**: 3 puntos (−8.5%, 0.0%, +25.4%) — primera vez que
  cambia de signo (Open-Meteo pasa de calcular por debajo a calcular por
  encima). Con tanta dispersión y cambio de signo en solo 3 puntos, deja de
  parecer la boya "mejor modelada" que sugerían los 2 primeros días —
  demasiado pronto para decir nada firme, pero ya no hay un patrón claro.
- **1117 Gijón**: 3 puntos (−14.7%, +3.7%, +1.4%) — los dos últimos días
  muy cerca de 0%, tras un primer día más alejado. Podría estar
  estabilizándose cerca de una desviación pequeña, pero con 3 puntos sigue
  siendo pronto para afirmarlo.
- **1101 Pasaia II**: 3 puntos, **los 3 con el mismo signo y magnitud
  parecida (−36.0%, −27.3%, −29.3%, media ≈ −30.9%)** — es, con diferencia,
  la boya con el patrón más consistente de las 3 obligatorias hasta ahora:
  siempre Open-Meteo calculando por debajo, siempre alrededor de 30 puntos
  porcentuales. Sigue siendo la principal candidata a un futuro factor de
  corrección de zona, pero **3 puntos no son ni de lejos los 15 que pide la
  tarea** — se necesita bastante más historial (idealmente en más
  condiciones de mar distintas) antes de proponer nada en firme.
- **1731 Barcelona II**: 1 punto (−22.9%), sin repetir desde el 2026-09-10.
- **1514 Málaga**: 1 punto (−38.1%), sin repetir desde el 2026-09-11.
- **2548 Cabo de Gata**: 1 punto nuevo hoy (−11.9%) — la desviación más
  pequeña en valor absoluto de las boyas de rotación (no obligatorias)
  vistas hasta ahora, pero un único punto no permite decir si es
  representativo de la zona o del estado de mar de esta noche en concreto.

**Ningún factor de corrección propuesto todavía** — ninguna boya llega a
los 15 puntos mínimos. Pasaia II es la que más vigilancia merece de cerca
en próximas pasadas (3/3 noches con el mismo signo y magnitud similar);
seguir sumando historial en las 3 obligatorias y rotando una boya nueva de
otra región cada noche (ya cubiertas: 1731 Barcelona II, 1514 Málaga, 2548
Cabo de Gata — candidatas para próximas pasadas: repetir alguna de estas
tres para empezar a acumular su propio historial, o sumar una nueva de la
lista de `BOYAS` en `functions/prevision.js` como 2242 Cabo Peñas o 2820
Dragonera).

### 2026-09-13 (pasada nocturna corta — calibración)

**Cuarto punto de calibración añadido para las 3 boyas obligatorias, y
primer punto para 2820 Dragonera (Mallorca)** — rotación de hoy, primera
vez que se cubre una boya balear (las tres rotaciones anteriores fueron
Barcelona II, Málaga y Cabo de Gata). Mismo método que las pasadas
anteriores: `curl` a `poem.puertos.es/portus/StationData` para la altura
real, Open-Meteo Marine en las coordenadas exactas de cada boya para la
altura calculada, emparejando por la hora UTC exacta del último dato real
de cada boya:

| boya | hora UTC | altura medida | altura calculada | diferencia | % |
|---|---|---|---|---|---|
| 2136 Bilbao-Vizcaya | 01:00 | 0.94 m | 1.00 m | +0.06 m | +6.4% |
| 1117 Gijón | 00:00 | 1.26 m | 1.24 m | −0.02 m | −1.6% |
| 1101 Pasaia II | 00:00 | 0.83 m | 0.70 m | −0.13 m | −15.7% |
| 2820 Dragonera | 01:00 | 0.47 m | 0.32 m | −0.15 m | −31.9% |

Con este cuarto punto, el historial de esta metodología queda así
(todavía lejos del mínimo de 15 puntos por boya que pide la tarea):

- **2136 Bilbao-Vizcaya**: 4 puntos (−8.5%, 0.0%, +25.4%, +6.4%) — sigue
  sin patrón claro, alterna signo y magnitud entre pasadas. De las 3
  obligatorias, la que menos se parece a tener una desviación sistemática
  hasta ahora.
- **1117 Gijón**: 4 puntos (−14.7%, +3.7%, +1.4%, −1.6%) — los últimos 3
  puntos seguidos dentro de ±4%, tras un primer día más alejado. Empieza a
  parecer la boya mejor modelada por Open-Meteo de las 3 obligatorias,
  pero con 4 puntos sigue siendo pronto para afirmarlo en firme.
- **1101 Pasaia II**: 4 puntos, **los 4 con el mismo signo** (−36.0%,
  −27.3%, −29.3%, −15.7%, media ≈ −27.1%) — sigue siendo, con diferencia,
  la boya con el patrón más consistente de las 3 obligatorias: 4/4 noches
  con Open-Meteo calculando por debajo de la boya real. La magnitud varía
  bastante (de −15.7% a −36.0%), así que todavía no se puede fijar un
  porcentaje concreto, pero la dirección del sesgo (Open-Meteo infravalora
  el oleaje en ese punto) se mantiene noche tras noche. Sigue siendo la
  principal candidata a un futuro factor de corrección de zona — **4
  puntos, todavía lejos de los 15 que pide la tarea antes de proponer nada
  en firme.**
- **1731 Barcelona II**: 1 punto (−22.9%), sin repetir desde el 2026-09-10.
- **1514 Málaga**: 1 punto (−38.1%), sin repetir desde el 2026-09-11.
- **2548 Cabo de Gata**: 1 punto (−11.9%), sin repetir desde el 2026-09-12.
- **2820 Dragonera**: 1 punto nuevo hoy (−31.9%) — desviación considerable
  ya en el primer punto, pero una sola muestra no permite decir si es
  representativa de la zona o del estado de mar de esta noche.

**Ningún factor de corrección propuesto todavía** — ninguna boya llega a
los 15 puntos mínimos. Pasaia II sigue siendo la que más vigilancia
merece de cerca (4/4 noches con el mismo signo); seguir sumando historial
en las 3 obligatorias y rotando una boya nueva de otra región cada noche
(ya cubiertas: 1731 Barcelona II, 1514 Málaga, 2548 Cabo de Gata, 2820
Dragonera — candidata para la próxima pasada: 2242 Cabo Peñas, la única
de la lista corta que queda sin probar, o repetir alguna de las 4 ya
vistas para empezar a acumular su propio historial).

### 2026-09-14 (pasada nocturna corta — calibración)

**Quinto punto de calibración para las 3 boyas obligatorias, y primer
punto para 2242 Cabo Peñas** — con esta rotación quedan ya probadas al
menos una vez las 5 boyas candidatas de la lista corta apuntada en
pasadas anteriores (1731 Barcelona II, 1514 Málaga, 2548 Cabo de Gata,
2820 Dragonera y ahora 2242 Cabo Peñas). Mismo método que siempre: `curl`
a `poem.puertos.es/portus/StationData` para la altura real, Open-Meteo
Marine en las coordenadas exactas de cada boya para la altura calculada,
emparejando por la hora UTC exacta del último dato real de cada boya:

| boya | hora UTC | altura medida | altura calculada | diferencia | % |
|---|---|---|---|---|---|
| 2136 Bilbao-Vizcaya | 01:00 | 1.41 m | 1.44 m | +0.03 m | +2.1% |
| 1117 Gijón | 00:00 | 1.36 m | 1.34 m | −0.02 m | −1.5% |
| 1101 Pasaia II | 00:00 | 1.39 m | 1.08 m | −0.31 m | −22.3% |
| 2242 Cabo Peñas | 01:00 | 1.88 m | 1.40 m | −0.48 m | −25.5% |

Con este quinto punto, el historial de esta metodología queda así
(todavía lejos del mínimo de 15 puntos por boya que pide la tarea):

- **2136 Bilbao-Vizcaya**: 5 puntos (−8.5%, 0.0%, +25.4%, +6.4%, +2.1%) —
  media ≈ +5.1%, pero sigue alternando signo y magnitud entre pasadas sin
  un patrón claro. De las 3 obligatorias, sigue siendo la que menos parece
  tener una desviación sistemática.
- **1117 Gijón**: 5 puntos (−14.7%, +3.7%, +1.4%, −1.6%, −1.5%) — los
  últimos 4 puntos seguidos dentro de ±3.7%, tras un primer día más
  alejado. Es la que más se acerca a "bien modelada por Open-Meteo" de
  las 3 obligatorias, con 5 puntos ya empieza a ser una observación algo
  más sólida, aunque todavía lejos de los 15 que pide la tarea.
- **1101 Pasaia II**: 5 puntos, **los 5 con el mismo signo** (−36.0%,
  −27.3%, −29.3%, −15.7%, −22.3%, media ≈ −26.1%) — sigue siendo, con
  diferencia, la boya con el patrón más consistente de las 3 obligatorias:
  5/5 noches con Open-Meteo calculando por debajo de la boya real, la
  media se mantiene estable entre pasadas (≈−27% hace dos noches, ≈−26.1%
  hoy). Sigue siendo la principal candidata a un futuro factor de
  corrección de zona — **5 puntos, todavía lejos de los 15 que pide la
  tarea antes de proponer nada en firme**, pero si esta consistencia se
  mantiene unas cuantas pasadas más ya tendría sentido empezar a redactar
  la propuesta.
- **1731 Barcelona II**: 1 punto (−22.9%), sin repetir desde el 2026-09-10.
- **1514 Málaga**: 1 punto (−38.1%), sin repetir desde el 2026-09-11.
- **2548 Cabo de Gata**: 1 punto (−11.9%), sin repetir desde el 2026-09-12.
- **2820 Dragonera**: 1 punto (−31.9%), sin repetir desde el 2026-09-13.
- **2242 Cabo Peñas**: 1 punto nuevo hoy (−25.5%) — desviación en la misma
  dirección y magnitud parecida a Pasaia II y Dragonera, pero una sola
  muestra no permite decir si es representativa de la zona (aguas
  abiertas del Cantábrico central) o del estado de mar de esta noche.

**Ningún factor de corrección propuesto todavía** — ninguna boya llega a
los 15 puntos mínimos. Pasaia II sigue siendo la que más vigilancia
merece de cerca (5/5 noches con el mismo signo, magnitud estable
alrededor de −26/−27%); seguir sumando historial en las 3 obligatorias.
Con las 5 boyas de la lista corta ya probadas al menos una vez, a partir
de la próxima pasada tiene más sentido repetir alguna de ellas (empezando
por las que llevan más noches sin repetirse: 1731 Barcelona II y 1514
Málaga) para que alguna empiece a acumular su propio historial, en vez de
seguir sumando boyas nuevas de un solo punto cada una.

### 2026-09-14 15:18 UTC (pasada buscadora — mareas y oleaje, calibración)

Esta pasada corre en un runner de GitHub Actions con salida de red real
(a diferencia de la nocturna en Claude-on-the-web, ver 2026-08-31), así
que se pudo hacer una comparación real boya vs Open-Meteo a media tarde,
además de la nocturna de hoy — mismo método: `poem.puertos.es/portus/
StationData` para la altura real (Hm0), Marine API de Open-Meteo en las
coordenadas exactas de cada boya para la altura calculada, emparejando
por la hora UTC exacta del último dato real de cada boya. Siguiendo la
recomendación de la pasada nocturna anterior, se repitieron las 3 boyas
obligatorias más las dos de la lista corta que llevaban más tiempo sin
repetirse (1731 Barcelona II, 1514 Málaga):

| boya | hora UTC | altura medida | altura calculada | diferencia | % |
|---|---|---|---|---|---|
| 2136 Bilbao-Vizcaya | 15:00 | 1.17 m | 1.22 m | +0.05 m | +4.3% |
| 1117 Gijón | 13:00 | 1.22 m | 1.08 m | −0.14 m | −11.5% |
| 1101 Pasaia II | 14:00 | 1.23 m | 0.92 m | −0.31 m | −25.2% |
| 1731 Barcelona II | 14:00 | 0.58 m | 0.30 m | −0.28 m | −48.3% |
| 1514 Málaga | 14:00 | 0.48 m | 0.54 m | +0.06 m | +12.5% |

Lectura de estos puntos frente al historial de `CALIBRACION.jsonl`:

- **1101 Pasaia II** suma su **sexto punto seguido con signo negativo**
  (−25.2%, en línea con la media ≈−26% de las noches anteriores). Sigue
  siendo, con diferencia, la boya con la desviación más consistente:
  Open-Meteo calcula sistemáticamente por debajo de la boya real en esa
  ría. Aun así, **6 puntos, todavía por debajo de los 15 mínimos** que
  pide la tarea antes de proponer un factor de corrección de zona — es
  la principal candidata, pero no se propone nada todavía.
- **1731 Barcelona II** estrena su segundo punto (−48.3%; el primero fue
  −22.9% el 2026-09-10). Los dos negativos, pero la magnitud varía mucho
  — con mar de solo 0.58 m, un error absoluto pequeño (−0.28 m) dispara
  el porcentaje, así que este −48.3% pesa poco como señal de sesgo real.
- **1514 Málaga** estrena segundo punto (+12.5%) con **signo opuesto** al
  primero (−38.1% el 2026-09-11): sin patrón, mar muy baja (0.48 m).
- **2136 Bilbao-Vizcaya** (+4.3%) y **1117 Gijón** (−11.5%) dentro de lo
  ya visto; siguen sin desviación sistemática clara.

**Ningún factor de corrección propuesto** — se mantiene la regla de 15
puntos mínimos por boya y de que la calibración nunca se aplica sola. La
señal de Pasaia II es la única que merece seguimiento cercano. Nota de
método: con oleaje bajo (<0.6 m) el porcentaje de error es muy sensible
a diferencias absolutas mínimas; conviene ponderar por altura absoluta
al valorar si una boya tiene sesgo, no fiarse solo del %.

**Firmado:** robot buscador de fuentes (pasada de mareas y oleaje),
2026-09-14 15:18 UTC.

### 2026-09-14 17:04 UTC (pasada buscadora — buenas prácticas de otras apps)

Investigación con `WebSearch` de qué datos en tiempo real o funciones
ofrecen otras apps de mareas/pesca (Windy, Fishbrain, Tides4fishing,
Puertos del Estado, FishTrack, Marine Weather Forecast Pro, FishWeather)
que Costaviva no tenga todavía. **Solo propuestas — cambio de producto
por definición, nunca implementación directa** (regla de
`ROBOT_REGLAS.md`). Nada se ha tocado en código.

Recordatorio de lo que Costaviva YA tiene, para no proponer duplicados:
oleaje/viento/marea/corriente por spot, coeficiente de marea propio por
spot, fase y posición lunar (`/luna`), presión histórica + tendencia,
estaciones AEMET (precipitación/presión), turbidez relativa por webcam,
webcams (imagen + vídeo HLS), rayos (AEMET), índice de pesca por rango
de temperatura de especie, capa de batimetría y radar de lluvia.

**Huecos reales encontrados, ordenados por lo verificable/accionable que
parece cada uno:**

1. **Avisos costeros oficiales de AEMET (fenómenos marítimos)** — varias
   apps (Marine Weather Forecast Pro, FishWeather con su "Advisories
   Layer") muestran los avisos meteorológicos oficiales del gobierno
   (temporal, aviso por viento/oleaje, "small craft advisory"). Costa
   Viva no muestra ningún aviso oficial pese a que ya usamos AEMET para
   rayos y estaciones. AEMET OpenData publica los avisos en formato CAP
   (`/api/avisos_cap/...`), potencialmente accesible con la misma
   `AEMET_API_KEY` que ya tenemos (caduca 2026-12-23). **No verificado
   con petición real en esta pasada** — la key vive como secreto en
   Cloudflare Pages, no en este runner. Sería un aviso de seguridad real
   ("no salgas hoy") muy alineado con el carácter de la app (SOS,
   seguridad en la mar). Candidato de más valor: propongo verificar el
   endpoint CAP con la key real y, si va, integrarlo como capa/aviso en
   `functions/prevision.js` + banner en `index.html` (eso sí sería
   cambio de frontend → propuesta aparte antes de implementar).

2. **Periodos solunares (mayor/menor) como recomendación horaria** —
   Tides4fishing y el "BiteTime" de Fishbrain marcan las franjas del día
   con más actividad prevista (paso lunar por el meridiano, orto/ocaso
   lunar y solar). Costaviva ya calcula posición lunar en `/luna`, así
   que el dato base está — faltaría derivar las 2-4 ventanas diarias.
   Ya anotado en `ROBOT_REGLAS.md` (sec. de variables del índice de
   pesca) como **heurística tradicional, no ciencia dura**: si se añade,
   dejarlo dicho así de claro en la UI. No inventa ningún dato externo
   (es cálculo astronómico sobre lo que ya tenemos), pero sigue siendo
   decisión de producto → propuesta.

3. **Recomendación de cebo/técnica por comunidad ("Top Baits")** —
   Fishbrain agrega los cebos/técnicas con más capturas reportadas por
   spot. Costaviva ya guarda `cebo`/`tecnica` por captura y tiene
   `especies_comunidad`, pero no agrega nada para recomendar. Encaja
   directamente con la idea ya aparcada "qué se está pescando ahora"
   (`CLAUDE.md`, consentimiento vía `consiente_uso_datos_capturas`) —
   mismo problema pendiente de mínimo de capturas/usuarios antes de
   mostrar agregados para no des-anonimizar. No abrir sin retomar esa
   idea con el usuario.

4. **Cartas de temperatura superficial del mar (SST) y clorofila por
   satélite** — FishTrack, SatFish y SeaLegs muestran "temperature
   breaks" y barreras de color donde se concentra el pez (sobre todo
   pesca de embarcación/altura). Copernicus Marine (ya citado en
   `ROBOT_REGLAS.md` para turbidez) publica capas de SST y clorofila.
   Más relevante para embarcación que para costa; requiere auth de
   Copernicus (no verificable sin alta previa). Interés medio para el
   perfil actual de la app (mayoría de spots de costa) — dejar como
   idea de fondo, no prioritaria.

5. **Descarga de previsión sin conexión (offline)** — Windy y Wavve
   permiten descargar la previsión para consultarla sin cobertura, algo
   habitual en la mar. Costaviva ya es PWA; podría cachear el último
   `/prevision` con un service worker para lectura offline. Mejora de
   robustez real (seguridad: consultar condiciones sin cobertura), pero
   es trabajo de frontend/PWA no trivial → propuesta.

**Ya cubierto por ideas aparcadas existentes, no re-propongo como nuevo**:
normativa de pesca por CCAA (Fishbrain "local rules"), agregado de
capturas de comunidad, y batimetría (ya tenemos capa). **Sin novedad
verificable con petición HTTP en esta pasada** — todo lo de arriba es
propuesta de producto; lo único con verificación HTTP realista a corto
plazo es el punto 1 (avisos CAP de AEMET), que no se pudo comprobar aquí
por no tener la key en este runner.

Fuentes consultadas:
- Windy.app (App Store / Google Play) y guías de apps marinas 2026
  (wavveboating.com, discoverboating.com, sealegs.ai).
- Fishbrain (fishbrain.com, Google Play) y reseñas 2026 (gilledit.com,
  bassanglermag.com).
- Tides4fishing (tides4fishing.com/tides/tidal-coefficient,
  /solunar-tables).
- Puertos del Estado / PORTUS (portus.puertos.es, puertos.es).
- FishTrack (fishtrack.com), SatFish (satfish.com), SeaLegs
  (sealegs.ai), Marine Weather Forecast Pro y FishWeather (App Store).

**Firmado:** robot buscador de fuentes (pasada de buenas prácticas de
otras apps), 2026-09-14 17:04 UTC.

### 2026-09-15 15:42 UTC (pasada buscadora — buenas prácticas de otras apps)

Investigación con `WebSearch` de qué funciones/datos tienen otras apps de
mareas/pesca que Costaviva no tenga, evitando repetir lo ya propuesto el
2026-09-14 (avisos CAP de AEMET, periodos solunares, "top baits" de
comunidad, cartas SST/clorofila por satélite, previsión offline en la
PWA). **Solo propuestas — cambio de producto por definición, nunca
implementación directa** (regla de `ROBOT_REGLAS.md`). No se ha tocado
código. Ninguno de estos hallazgos es una API de datos verificable con
una petición HTTP: son funciones de producto/UX de apps de terceros
(App Store / Google Play / sus propias webs), así que aquí no aplica la
verificación HTTP, igual que en la pasada del 2026-09-14.

**Huecos nuevos encontrados (no cubiertos por la pasada anterior),
ordenados por lo accionable que parece cada uno:**

1. **Avisos/alarmas configurables por el usuario (Nautide)** — Nautide
   deja poner alarmas y eventos de calendario (hasta 90 días vista) para
   condiciones concretas: pleamar/bajamar, umbral de viento/racha, o "el
   mejor momento de pesca" del día. Costaviva hoy **no tiene ningún
   sistema de notificaciones/avisos** — ni push ni recordatorios. Encaja
   con el carácter de seguridad de la app (avisar "hoy hay temporal en tu
   spot"). **Limitación técnica real a dejar clara antes de construirlo,
   la misma ya documentada para el trackeo GPS y la geolocalización en
   segundo plano** (ver `CLAUDE.md`, ideas aparcadas): las push de una
   PWA en iOS solo funcionan con la app instalada en pantalla de inicio y
   iOS ≥16.4, y con limitaciones; no prometer avisos fiables que el
   sistema operativo no garantiza. Propuesta de producto → no abrir sin
   hablarlo con el usuario.

2. **Planificador por condición de marea a futuro ("SeaQuery" de
   Nautide)** — filtrar los próximos N días buscando cuándo se da una
   condición concreta en un spot: marea entrante/saliente, o coeficiente
   por encima de un umbral. Costaviva **ya calcula el coeficiente por
   spot** (`coeficientePorSpot()`) y la altura/fase de marea, pero solo
   los muestra para "ahora"; no hay forma de preguntar "¿cuándo, en los
   próximos días, hay marea entrante + coeficiente alto en Bermeo?". El
   dato base ya existe, faltaría la vista de planificación (frontend). Es
   una función muy usada por pescadores para planear la salida.
   Propuesta.

3. **Explicabilidad del índice + índice horario a lo largo del día
   (Fish & Tides "Bite Score", Nautide "fish activity")** — estas apps
   dan un índice 0-100 **por hora** para todo el día y dejan tocar cada
   hora para ver POR QUÉ puntúa alto o bajo (qué variable pesa). Costa
   Viva ya tiene `indicePesca` (0-100) pero es un único valor "de ahora"
   por spot, sin curva horaria ni desglose de por qué sale ese número.
   Dos ideas separables: (a) mostrar el índice como curva a lo largo del
   día/próximas horas, no un único valor; (b) al pulsar, explicar qué
   factor lo sube/baja (ya hay un botón "ⓘ" que explica el concepto, pero
   no el valor concreto de ese momento). Nota: enriquecer `indicePesca`
   con MÁS variables (tendencia de presión, ventana de cambio de marea,
   solunar) ya está anotado aparte en `ROBOT_REGLAS.md` (sec. "Variables
   adicionales para el índice de pesca") — lo NUEVO de esta pasada es la
   parte de UX (curva horaria + "por qué este número"), no las variables
   en sí. Propuesta de producto.

4. **Racha de viento (gust), no solo viento medio (Nautide, FishWeather)**
   — varias apps muestran la racha además del viento medio, porque para
   decidir si salir en una embarcación pequeña la racha máxima importa
   tanto o más que la media. `indiceMar()` en `index.html` usa viento
   medio; Open-Meteo expone `wind_gusts_10m` en la misma petición que ya
   se hace. Sería un dato real más (mostrarlo) y, potencialmente, un
   factor del índice. **Ojo**: meterlo en la fórmula de `indiceMar` es un
   cambio a un dato que se muestra como fiable → propuesta, nunca cambio
   directo (regla general del fichero). Mostrarlo solo como dato
   informativo (sin tocar la fórmula) sería de menor riesgo, pero sigue
   siendo frontend → propuesta.

**Ya cubierto por la pasada del 2026-09-14 o por ideas aparcadas
existentes, no re-propongo**: avisos oficiales CAP de AEMET, periodos
solunares como recomendación horaria, recomendación de cebo/técnica por
comunidad, SST/clorofila por satélite, y descarga offline en la PWA. El
punto 3 (explicabilidad) se cruza con el solunar ya propuesto pero añade
la dimensión nueva de "índice horario + por qué".

Fuentes consultadas:
- Nautide (`apps.apple.com/us/app/nautide-tides-wind-waves/id1413108902`,
  `play.google.com/store/apps/details?id=com.nautide.app`, `mwm.ai`).
- Fish & Tides (`fishandtides.com`, `fishandtides.com/best-tide-app-for-fishing.html`,
  `apps.apple.com/us/app/fish-tides/id1589893765`).
- FishWeather y SeaLegs AI (`sealegs.ai/blog/best-fishing-weather-apps`,
  `sealegs.ai/blog/best-marine-weather-apps`).
- Fishbrain (`fishbrain.com/features/depth-maps`, Google Play/App Store).

**Firmado:** robot buscador de fuentes (pasada de buenas prácticas de
otras apps), 2026-09-15 15:42 UTC.

### 2026-09-15 (pasada nocturna corta — calibración)

**Sexto punto de calibración para las 3 boyas obligatorias, y segundo
punto para 2548 Cabo de Gata** (rotación de esta noche: de la lista corta
de candidatas ya probadas al menos una vez — 1731 Barcelona II, 1514
Málaga, 2548 Cabo de Gata, 2820 Dragonera, 2242 Cabo Peñas — se repitió
Cabo de Gata, la que llevaba más noches sin repetirse desde el
2026-09-12). Mismo método de siempre: `curl` a
`poem.puertos.es/portus/StationData` para la altura real, Open-Meteo
Marine en las coordenadas exactas de cada boya para la altura calculada,
emparejando por la hora UTC exacta del último dato real de cada boya:

| boya | hora UTC | altura medida | altura calculada | diferencia | % |
|---|---|---|---|---|---|
| 2136 Bilbao-Vizcaya | 01:00 | 0.94 m | 1.00 m | +0.06 m | +6.4% |
| 1117 Gijón | 00:00 | 1.07 m | 0.90 m | −0.17 m | −15.9% |
| 1101 Pasaia II | 00:00 | 0.99 m | 0.76 m | −0.23 m | −23.2% |
| 2548 Cabo de Gata | 01:00 | 0.35 m | 0.36 m | +0.01 m | +2.9% |

Con este sexto punto, el historial de esta metodología queda así
(todavía lejos del mínimo de 15 puntos por boya que pide la tarea):

- **2136 Bilbao-Vizcaya**: 6 puntos (−8.5%, 0.0%, +25.4%, +6.4%, +2.1%,
  +6.4%) — media ≈ +5.3%, sigue sin un patrón sistemático claro, la más
  cercana a "sin desviación" de las 3 obligatorias.
- **1117 Gijón**: 6 puntos (−14.7%, +3.7%, +1.4%, −1.6%, −1.5%, −15.9%) —
  el punto de hoy rompe la racha de 4 noches seguidas dentro de ±3.7%,
  volviendo a una magnitud parecida a la del primer día. Con solo 6
  puntos y esta variación, todavía no hay patrón sólido, ni siquiera el
  que empezaba a insinuarse ayer.
- **1101 Pasaia II**: 6 puntos, **los 6 con el mismo signo** (−36.0%,
  −27.3%, −29.3%, −15.7%, −22.3%, −23.2%, media ≈ −25.6%) — sigue siendo,
  con diferencia, la boya con el patrón más consistente y estable de las
  3 obligatorias: 6/6 noches con Open-Meteo calculando por debajo de la
  boya real, la media apenas se mueve entre pasadas (≈−26.1% ayer, ≈−25.6%
  hoy). Principal candidata a un futuro factor de corrección de zona —
  **6 puntos, todavía lejos de los 15 que pide la tarea**, pero la
  consistencia ya es notable.
- **1731 Barcelona II**: 1 punto (−22.9%), sin repetir desde el
  2026-09-10 (repetido hoy por la pasada buscadora diurna, ver
  2026-09-14 15:18 UTC más arriba, con un segundo punto de −48.3%).
- **1514 Málaga**: 1 punto propio de esta rutina nocturna (−38.1%), sin
  repetir desde el 2026-09-11 (también repetido hoy por la pasada
  buscadora diurna, +12.5%).
- **2548 Cabo de Gata**: **2 puntos** (−11.9%, +2.9%) — signo opuesto
  entre los dos, mar muy baja en ambos casos (<0.6 m), consistente con el
  patrón ya visto en otras boyas de que con oleaje pequeño el error
  porcentual es ruidoso y poco fiable como señal de sesgo real.
- **2820 Dragonera**: 1 punto (−31.9%), sin repetir desde el 2026-09-13.
- **2242 Cabo Peñas**: 1 punto (−25.5%), sin repetir desde el 2026-09-14.

**Ningún factor de corrección propuesto todavía** — ninguna boya llega a
los 15 puntos mínimos. Pasaia II sigue siendo, con diferencia, la que más
vigilancia merece de cerca (6/6 noches con el mismo signo, magnitud
estable en torno a −25/−26%); seguir sumando historial ahí es lo más
valioso de las 3 obligatorias. Para la próxima rotación, 1731 Barcelona
II y 1514 Málaga siguen siendo las candidatas con más noches sin
repetirse desde el punto de vista de esta rutina nocturna en concreto
(aunque ambas ya tienen un segundo punto vía la pasada buscadora diurna
de hoy, que corre aparte).

**Firmado:** robot de calibración nocturna, 2026-09-15 01:13 UTC.

### 2026-09-15 13:24 UTC (pasada buscadora — mareas y oleaje)

Pasada diurna de "mareas y oleaje". **La red saliente de este runner sí
funciona** (a diferencia de la sesión cloud nocturna): verificado con
peticiones reales a `poem.puertos.es/portus/StationData` y a la Marine
API de Open-Meteo. Método de siempre: altura real de boya (`Hm0`, último
dato) contra `wave_height` de Open-Meteo en las coordenadas exactas de
cada boya, emparejando por la hora UTC exacta del último dato de la boya.

| boya | hora UTC | medida | calculada | diferencia | % |
|---|---|---|---|---|---|
| 2136 Bilbao-Vizcaya | 13:00 | 1.88 m | 1.72 m | −0.16 m | −8.5% |
| 1117 Gijón | 12:00 | 1.11 m | 1.22 m | +0.11 m | +9.9% |
| 1101 Pasaia II | 12:00 | 1.90 m | 0.96 m | −0.94 m | **−49.5%** |
| 1731 Barcelona II | 12:00 | 0.35 m | 0.26 m | −0.09 m | −25.7% |
| 2246 Villano-Sisargas | 13:00 | 1.17 m | 1.04 m | −0.13 m | −11.1% |

**Punto de calibración nuevo:** 2246 Villano-Sisargas (Galicia, REDEXT) —
primera vez que se calibra esta boya, amplía la cobertura geográfica del
historial más allá de las 3 obligatorias del Cantábrico.

**Hallazgo destacado — Pasaia II (1101), octavo punto consecutivo con el
mismo signo negativo** (−36.0%, −27.3%, −29.3%, −15.7%, −22.3%, −25.2%,
−23.2%, −49.5%; media ≈ **−28.6%**). Sigue siendo, con diferencia, la boya
con el sesgo más consistente: Open-Meteo calcula sistemáticamente por
debajo de la medida real ahí. El punto de hoy (−49.5% con 1.9 m de mar
real) es el mayor sesgo visto y descarta que fuera solo ruido de oleaje
pequeño. **8 puntos, todavía lejos de los 15 mínimos que pide la tarea
antes de proponer un factor de corrección de zona** — no se propone
ningún ajuste todavía, solo se sigue acumulando historial. Es la
principal candidata a un futuro factor de corrección.

Resto sin patrón nuevo: 2136 Bilbao-Vizcaya sigue siendo la más cercana a
cero; 1117 Gijón sigue oscilando de signo sin estabilizarse; 1731
Barcelona II acumula 3 puntos todos negativos pero siempre con mar <0.6 m
(porcentaje ruidoso, poco fiable como señal de sesgo real).

**Fuente nueva revisada (mareas/oleaje):** `labouee.app` "The Buoy API"
—aparecida buscando cobertura de boyas de Portugal, que es un hueco real
(hoy solo tenemos Nazaré vía MONICAN)—. Comprobado con petición HTTP real
que **exige API key** (`Authorization: Bearer`, cuota 1.000 req/h) y que
reempaqueta sobre todo datos de Puertos del Estado, que ya obtenemos
gratis y directo. No se pudo verificar si su cobertura de las boyas del
IH portugués (Leixões/Sines) es real ni si hay plan gratuito sin
registrarse. Queda como **lead a evaluar, no drop-in gratuito** — y
tocar la lista `BOYAS` de `functions/prevision.js` está fuera del límite
de volumen de auto-aplicación de todas formas (ver `ROBOT_REGLAS.md`,
además del riesgo del límite de 50 sub-peticiones ya documentado).
Copernicus Marine IBI (reanálisis de oleaje) reaparece en la búsqueda —
ya conocido, requiere alta previa, sin cambios.

**Firmado:** robot buscador de fuentes (pasada de mareas y oleaje),
2026-09-15 13:24 UTC.

---

### 2026-09-15 13:56 UTC (pasada buscadora — mareas y oleaje)

Pasada diurna de "mareas y oleaje". **No se pudo hacer la calibración
boya-vs-Open-Meteo de siempre**: la API de Puertos del Estado
(`poem.puertos.es/portus/StationData`) devolvió **HTTP 500 para TODAS las
boyas probadas y en 3 reintentos** (2136 Bilbao-Vizcaya, 1117 Gijón, 1101
Pasaia II, 2248 Cabo Silleiro, 2244 Estaca de Bares, 2610 Cabo de Palos),
tanto con `params` completos como pidiendo solo `Hm0`, con y sin
`User-Agent` propio. **No es problema de la red del runner ni nuestro**:
la misma pasada de las 13:24 UTC (32 min antes) sí obtuvo datos reales de
esa API, y en esta pasada la Marine API de Open-Meteo respondió con
normalidad a las mismas coordenadas — es una **caída temporal del lado de
Puertos del Estado**. `StationInfo` en el mismo host da 404 y la raíz
`/portus/` 404, coherente con un fallo interno del servicio de datos, no
con un cambio de contrato de la API. **No hay punto de calibración nuevo
esta pasada** — no se añade nada a `CALIBRACION.jsonl`; se reanudará la
calibración en la siguiente pasada cuando la fuente vuelva.

Impacto en producción durante la caída: `functions/prevision.js` envuelve
cada boya en `.catch()` (`BOYAS.map((b) => datosBoya(b).catch(...))`), así
que las boyas que fallan simplemente no se dibujan en el mapa (patrón "no
inventar dato" de siempre) — el resto de `/prevision` (Open-Meteo) sigue
funcionando. No requiere acción; solo se anota por si la caída persiste.

**Fuente nueva verificada con petición HTTP real — boyas de Portugal
(Instituto Hidrográfico), llena un hueco real.** Hoy solo tenemos una
boya portuguesa (Nazaré, vía MONICAN); el IH portugués tiene su red
Datawell Waverider (Leixões, Sines, Faro + Azores/Madeira) accesible por
dos vías, ambas comprobadas en vivo:
- **OGC API Features** (`https://ogcapi.hidrografico.pt/collections`,
  sin key, licencia CC-BY 4.0): la colección `buoys_datawell` lista las
  estaciones activas con metadatos y frescura real —verificado hoy:
  Leixões (`id_est` 4, 41.316°N/8.983°W, `last_sea`
  2026-09-15T11:32Z), Sines (`id_est` 19, 37.921°N/8.929°W,
  11:26Z), Faro (`id_est` 20, 36.904°N/7.898°W, 11:25Z), todas
  `status: active`, `nrt: near-real-time data available`. Esto da la
  ubicación y el estado, **no** la medida de oleaje.
- **Medida NRT real** (`hm0`, `tp`, `temp` + flags QC, en JSON):
  `https://supportserver1.hidrografico.pt/geodata/buoys/getDatawellData`
  (y `.../getDatawellTemp` para temperatura), parámetros `stationId` +
  `startDate`/`endDate` (ventana máx. 15 días). **Verificado en vivo que
  el endpoint existe y exige autenticación**: sin key devuelve
  `401 "Invalid API KEY"`. La key es **gratuita, se pide por email** a
  `cedencia.dados@hidrografico.pt` y se pasa en la cabecera `X-API-KEY`
  (mismo patrón que AEMET/Euskalmet — usar `datos@costaviva.org` para el
  alta, ver `CLAUDE.md`).

**Solo propuesta, NO se integra en esta pasada**, por dos motivos ya
documentados en `ROBOT_REGLAS.md`: (1) tocar la lista `BOYAS` de
`functions/prevision.js` está fuera del límite de volumen de
auto-aplicación (fichero de `functions/`), y (2) el riesgo del límite de
50 sub-peticiones de `/prevision` — cada boya nueva es un `fetch` más, y
la medida NRT del IH parece exigir una petición por estación (no un bulk
"todas las boias en una llamada"), así que 3 boyas portuguesas = 3
sub-peticiones más. Recomendación: pedir la key gratuita con
`datos@costaviva.org`, guardarla como secreto en Cloudflare Pages
(patrón `AEMET_API_KEY`) y solo entonces valorar la integración,
midiendo antes cuántas sub-peticiones quedan libres en `/prevision`.
Sigue siendo la vía más limpia y verificada para cubrir el hueco de
Portugal, mejor que `labouee.app` (evaluado el 2026-09-15 13:24 UTC:
exige key de pago y reempaqueta datos de Puertos del Estado que ya
tenemos gratis).

**Firmado:** robot buscador de fuentes (pasada de mareas y oleaje),
2026-09-15 13:56 UTC.

---

### 2026-09-16 (pasada nocturna corta — calibración)

**Noveno punto de calibración para las 3 boyas obligatorias, y cuarto
punto para 1731 Barcelona II** (rotación de esta noche: de la lista corta
de candidatas ya probadas al menos una vez, Barcelona II era la que más
noches llevaba sin repetirse desde el punto de vista de esta rutina
nocturna en concreto — Málaga sigue con solo el punto propio del
2026-09-11, pendiente para la próxima rotación). Mismo método de siempre:
`curl` a `poem.puertos.es/portus/StationData` para la altura real,
Open-Meteo Marine en las coordenadas exactas de cada boya para la altura
calculada, emparejando por la hora UTC exacta del último dato real de
cada boya:

| boya | hora UTC | altura medida | altura calculada | diferencia | % |
|---|---|---|---|---|---|
| 2136 Bilbao-Vizcaya | 01:00 | 1.52 m | 1.42 m | −0.10 m | −6.6% |
| 1117 Gijón | 00:00 | 1.62 m | 1.36 m | −0.26 m | −16.0% |
| 1101 Pasaia II | 23:00 (día anterior) | 1.37 m | 1.00 m | −0.37 m | −27.0% |
| 1731 Barcelona II | 00:00 | 0.36 m | 0.26 m | −0.10 m | −27.8% |

Con este noveno punto, el historial de la metodología `boya_vs_openmeteo_
mismo_punto` (excluyendo la del 2026-08-31, spot-vs-boya, ya superseded)
queda así — todavía lejos del mínimo de 15 puntos por boya que pide la
tarea:

- **2136 Bilbao-Vizcaya**: 9 puntos (−8.5%, 0.0%, +25.4%, +6.4%, +2.1%,
  +6.4%, −8.5%, +4.3%, −6.6%) — media ≈ +2.3%, sigue sin patrón
  sistemático claro, la más cercana a "sin desviación" de las 3
  obligatorias.
- **1117 Gijón**: 9 puntos (−14.7%, +3.7%, +1.4%, −1.6%, −1.5%, −15.9%,
  −11.5%, +9.9%, −16.0%) — media ≈ −5.1%, sigue alternando signo y
  magnitud pasada a pasada, sin patrón sólido.
- **1101 Pasaia II**: 9 puntos, **los 9 con el mismo signo negativo**
  (−36.0%, −27.3%, −29.3%, −15.7%, −22.3%, −25.2%, −23.2%, −49.5%, −27.0%,
  media ≈ **−28.4%**) — sigue siendo, con diferencia, la boya con el sesgo
  más consistente y estable: 9/9 puntos (nocturnos y diurnos combinados)
  con Open-Meteo calculando por debajo de la boya real, la media apenas
  se mueve pasada a pasada. Principal candidata a un futuro factor de
  corrección de zona — **9 puntos, todavía lejos de los 15 mínimos**, pero
  a este ritmo (una pasada nocturna + alguna diurna al día) podría
  alcanzarlos en unos días más.
- **1731 Barcelona II**: **4 puntos, los 4 con signo negativo** (−22.9%,
  −48.3%, −25.7%, −27.8%; media ≈ −31.2%) — mar siempre <0.6 m en las
  cuatro mediciones, así que el porcentaje sigue siendo ruidoso (un error
  absoluto pequeño dispara el %), pero la consistencia del signo empieza a
  llamar la atención igual que pasó con Pasaia II en sus primeros puntos.
  A vigilar en próximas rotaciones, sin sacar conclusiones todavía con
  solo 4 puntos.
- **1514 Málaga**: 2 puntos (−38.1%, +12.5%), sin repetir desde el
  2026-09-14 (pasada buscadora diurna). Candidata para la próxima
  rotación de esta rutina nocturna.
- **2548 Cabo de Gata**: 2 puntos (−11.9%, +2.9%), sin cambios desde el
  2026-09-15.
- **2820 Dragonera**: 1 punto (−31.9%), sin repetir desde el 2026-09-13.
- **2242 Cabo Peñas**: 1 punto (−25.5%), sin repetir desde el 2026-09-14.
- **2246 Villano-Sisargas**: 1 punto (−11.1%, vía pasada buscadora diurna
  del 2026-09-15), primera boya de Galicia en el historial.

**Ningún factor de corrección propuesto todavía** — ninguna boya llega a
los 15 puntos mínimos, aunque Pasaia II (9 puntos, 9/9 mismo signo, media
estable ≈−28%) es ya la candidata más sólida y se acerca al umbral;
seguir sumando historial ahí sigue siendo lo más valioso. Para la próxima
rotación de esta rutina nocturna, 1514 Málaga es la candidata con más
noches sin repetirse.

**Firmado:** robot de calibración nocturna, 2026-09-16 01:14 UTC.

### 2026-09-17 (pasada nocturna corta — calibración + salud de datos)

**Calibración — décimo punto para las 3 boyas obligatorias, tercer punto
para 1514 Málaga** (rotación de esta noche, era la candidata con más
noches sin repetirse desde la nota de ayer). Mismo método de siempre:
`curl` a `poem.puertos.es/portus/StationData` para la altura real,
Open-Meteo Marine en las coordenadas exactas de cada boya para la altura
calculada, emparejando por la hora UTC exacta del último dato real de
cada boya:

| boya | hora UTC | altura medida | altura calculada | diferencia | % |
|---|---|---|---|---|---|
| 2136 Bilbao-Vizcaya | 01:00 | 1.76 m | 1.86 m | +0.10 m | +5.7% |
| 1117 Gijón | 00:00 | 2.24 m | 1.74 m | −0.50 m | −22.3% |
| 1101 Pasaia II | 00:00 | 1.71 m | 1.22 m | −0.49 m | −28.7% |
| 1514 Málaga | 00:00 | 0.87 m | 0.52 m | −0.35 m | −40.2% |

Historial actualizado de la metodología `boya_vs_openmeteo_mismo_punto`
(sigue lejos del mínimo de 15 puntos por boya):

- **2136 Bilbao-Vizcaya**: 10 puntos (−8.5%, 0.0%, +25.4%, +6.4%, +2.1%,
  +6.4%, −8.5%, +4.3%, −6.6%, +5.7%) — media ≈ **+2.7%**, sigue sin
  patrón sistemático claro, la más cercana a "sin desviación" de las 3
  obligatorias.
- **1117 Gijón**: 10 puntos (−14.7%, +3.7%, +1.4%, −1.6%, −1.5%, −15.9%,
  −11.5%, +9.9%, −16.0%, −22.3%) — media ≈ **−6.9%**, sigue alternando
  signo y magnitud pasada a pasada, sin patrón sólido.
- **1101 Pasaia II**: **10 puntos, los 10 con el mismo signo negativo**
  (media ≈ **−28.4%**) — sigue siendo, con diferencia, la boya con el
  sesgo más consistente y estable. Faltan **5 puntos más** para el
  mínimo de 15; a este ritmo (una pasada nocturna al día) podría
  alcanzarlos en menos de una semana. Sigue siendo la candidata más
  sólida a un futuro factor de corrección de zona, pero todavía no se
  propone ninguno — falta llegar al umbral acordado.
- **1731 Barcelona II**: 4 puntos, sin cambios desde ayer (no le tocaba
  rotación esta noche).
- **1514 Málaga**: 3 puntos (−38.1%, +12.5%, −40.2%; media ≈ **−21.9%**)
  — 2 de 3 negativos, todavía muy poca muestra y signo no consistente
  como Pasaia II. A vigilar en próximas rotaciones.
- Resto de boyas (2548 Cabo de Gata, 2820 Dragonera, 2242 Cabo Peñas,
  2246 Villano-Sisargas): sin cambios desde su última pasada, no les
  tocaba rotación esta noche.

**Ningún factor de corrección propuesto todavía** — ninguna boya llega a
los 15 puntos mínimos. Para la próxima rotación de esta rutina nocturna,
candidatas con más noches sin repetirse: Cabo de Gata, Dragonera, Cabo
Peñas o Villano-Sisargas (todas con 1-2 puntos, sin tocar desde hace
varios días).

**Salud de datos — bloqueada por la política de red de esta sesión en
concreto, no por ninguna fuente real caída.** Se pudo verificar en vivo:
las 4 boyas de Puertos del Estado de arriba (mismo endpoint que
`datosBoya()`, responde con datos reales y recientes) y 3 webcams de
proveedores distintos (`mundaka` — kostasystem.com, `bakio` —
pyscada.isurki.com, `sopelana` — detectia.net; las 3 con `200` y una
imagen real de tamaño razonable). **No se pudo comprobar** la boya de
Nazaré (`monican.hidrografico.pt`), ninguna de las 4 fuentes de caudal
de río (`visor.saichcantabrico.es`, `saih.chj.es`,
`saihweb.chsegura.es`, `servizos.meteogalicia.gal`) ni una cuarta
webcam de otra región (`streaming.comunitatvalenciana.com`) — todas
rechazadas por el propio proxy de salida de esta sesión
(`connect_rejected`, "gateway answered 403 to CONNECT"), confirmado con
`curl .../__agentproxy/status` y repitiendo la petición sin cambio de
resultado. Es la misma limitación ya documentada el 2026-08-31 (esta
sesión en la nube tiene salida de red bloqueada salvo un conjunto de
dominios, que no incluye estos) — **no se anota ninguna de estas 5
fuentes como rota**, porque no hay evidencia real de que lo estén, solo
evidencia de que esta sesión concreta no puede alcanzarlas esta noche.
Ninguna corrección de código aplicada (no había nada que corregir: no es
un fallo del sitio ni de nuestro parser). Si esto se repite varias
noches seguidas, valdría la pena confirmar si el conjunto de dominios
permitidos para esta rutina en concreto puede ampliarse, en vez de
asumir cada vez que es transitorio.

**Firmado:** robot de calibración nocturna, 2026-09-17 01:16 UTC.

### 2026-09-18 (pasada nocturna corta — calibración + salud de datos)

**Calibración — undécimo punto para las 3 boyas obligatorias, tercer
punto para 2820 Dragonera** (rotación de esta noche: de las candidatas
señaladas ayer con más noches sin repetirse — Cabo de Gata, Dragonera,
Cabo Peñas, Villano-Sisargas — Dragonera llevaba desde el 2026-09-13 sin
un punto de esta rutina nocturna en concreto, aunque sí sumó un segundo
punto vía la pasada buscadora diurna del 2026-09-17). Mismo método de
siempre: `curl` a `poem.puertos.es/portus/StationData` para la altura
real, Open-Meteo Marine en las coordenadas exactas de cada boya para la
altura calculada, emparejando por la hora UTC exacta del último dato
real de cada boya:

| boya | hora UTC | altura medida | altura calculada | diferencia | % |
|---|---|---|---|---|---|
| 2136 Bilbao-Vizcaya | 01:00 | 1.52 m | 1.38 m | −0.14 m | −9.2% |
| 1117 Gijón | 00:00 | 1.16 m | 1.24 m | +0.08 m | +6.9% |
| 1101 Pasaia II | 00:00 | 1.36 m | 0.98 m | −0.38 m | −27.9% |
| 2820 Dragonera | 01:00 | 0.70 m | 0.52 m | −0.18 m | −25.7% |

Historial actualizado de la metodología `boya_vs_openmeteo_mismo_punto`
(sigue lejos del mínimo de 15 puntos por boya):

- **2136 Bilbao-Vizcaya**: 11 puntos, media ≈ **+1.6%**, sigue sin patrón
  sistemático claro, la más cercana a "sin desviación" de las 3
  obligatorias.
- **1117 Gijón**: 11 puntos, media ≈ **−5.6%** (7/11 negativos), sigue
  alternando signo y magnitud pasada a pasada, sin patrón sólido.
- **1101 Pasaia II**: **11 puntos, los 11 con el mismo signo negativo**,
  media ≈ **−28.4%** — sigue siendo, con diferencia, la boya con el
  sesgo más consistente y estable. Faltan **4 puntos más** para el
  mínimo de 15; a este ritmo (una pasada nocturna al día, a veces más
  con las pasadas buscadoras diurnas) debería alcanzarlos en pocos días
  más. Sigue siendo la candidata más sólida a un futuro factor de
  corrección de zona, pero todavía no se propone ninguno — falta llegar
  al umbral acordado.
- **2820 Dragonera**: 3 puntos (−31.9%, +2.1%, −25.7%; media ≈ **−18.5%**),
  2 de 3 negativos — mar siempre <1m en las tres mediciones, así que el
  porcentaje sigue siendo ruidoso (un error absoluto pequeño dispara el
  %); sin patrón de signo tan claro como Pasaia II todavía.
- Resto de boyas (1731 Barcelona II, 1514 Málaga, 2548 Cabo de Gata,
  2242 Cabo Peñas, 2246 Villano-Sisargas): sin cambios desde su última
  pasada, no les tocaba rotación esta noche.

**Ningún factor de corrección propuesto todavía** — ninguna boya llega a
los 15 puntos mínimos, aunque Pasaia II (11 puntos, 11/11 mismo signo,
media estable ≈−28%) sigue siendo la más cerca del umbral. Para la
próxima rotación de esta rutina nocturna, candidatas con más noches sin
repetirse: Cabo de Gata (desde 2026-09-15), Cabo Peñas (desde
2026-09-14) o Villano-Sisargas (desde 2026-09-15).

**Salud de datos — verificado en vivo lo alcanzable, mismo bloqueo de
red que anoche para el resto (segunda noche seguida con el mismo
patrón).** Las 4 boyas de Puertos del Estado de la tabla de arriba
(mismo endpoint que `datosBoya()`) respondieron con datos reales y
recientes, sin cambios de forma. Se comprobaron también 3 webcams de
proveedores distintos — `mundaka` (kostasystem.com), `bakio`
(pyscada.isurki.com), `sopelana` (detectia.net) — las 3 con `200` y una
imagen real de tamaño razonable (104 KB, 765 KB y 72 KB respectivamente).
**No se pudo comprobar** la boya de Nazaré (`monican.hidrografico.pt`),
ninguna de las 4 fuentes de caudal de río (`visor.saichcantabrico.es`,
`saih.chj.es`, `saihweb.chsegura.es`, `servizos.meteogalicia.gal`) ni una
cuarta webcam de otra región (se probó `meteogalicia.gal`,
`cantabria.es`, `comunitatvalenciana.com` y `socib.es`, las 4
rechazadas) — todas con `connect_rejected` / "gateway answered 403 to
CONNECT" del propio proxy de salida de esta sesión, confirmado con
`curl .../__agentproxy/status`. Exactamente la misma limitación ya
documentada el 2026-08-31 y el 2026-09-17 (dominios fuera de la lista
blanca de esta sesión en la nube en concreto) — **no se anota ninguna de
estas fuentes como rota**, no hay evidencia de que lo estén, solo de que
esta sesión no puede alcanzarlas. Es la segunda noche consecutiva con
exactamente el mismo bloqueo (mismos dominios, mismo tipo de error) — si
se repite una tercera noche seguida, ya no parece tan "transitorio":
valdría la pena que el usuario confirme si el conjunto de dominios
permitidos para esta rutina en concreto puede ampliarse (Puertos del
Estado y Open-Meteo sí están permitidos; los proveedores de ríos/Nazaré/
otras webcams no). Ninguna corrección de código aplicada — no hay nada
que corregir del lado del repo.

**Firmado:** robot de calibración nocturna, 2026-09-18 01:16 UTC.

### 2026-09-19 (pasada nocturna corta — calibración + salud de datos)

**Calibración — duodécimo punto para las 3 boyas obligatorias, quinto
punto para 1731 Barcelona II** (rotación de esta noche: era la boya de
la lista corta con más noches sin repetirse, desde el 2026-09-16).
Mismo método de siempre: `curl` a `poem.puertos.es/portus/StationData`
para la altura real, Open-Meteo Marine en las coordenadas exactas de
cada boya para la altura calculada, emparejando por la hora UTC exacta
del último dato real de cada boya. **Segunda noche seguida de mar
agitado** en las 3 obligatorias (Hm0 real 2.9-3.9 m, frente a menos de
2 m casi siempre hasta hace dos días):

| boya | hora UTC | altura medida | altura calculada | diferencia | % |
|---|---|---|---|---|---|
| 2136 Bilbao-Vizcaya | 01:00 | 3.87 m | 2.66 m | −1.21 m | −31.3% |
| 1117 Gijón | 00:00 | 2.91 m | 2.56 m | −0.35 m | −12.0% |
| 1101 Pasaia II | 00:00 | 3.39 m | 1.90 m | −1.49 m | −44.0% |
| 1731 Barcelona II | 00:00 | 0.41 m | 0.30 m | −0.11 m | −26.8% |

Historial actualizado de la metodología `boya_vs_openmeteo_mismo_punto`
(sigue lejos del mínimo de 15 puntos por boya, salvo Pasaia II que ya
está muy cerca):

- **2136 Bilbao-Vizcaya**: 12 puntos, media ≈ **−1.2%** — con mar en
  calma esta boya solía repartirse entre signos sin patrón claro (media
  ≈+1.6% con 11 puntos); el punto de hoy, el más negativo visto hasta
  ahora (−31.3%, coincidiendo con la noche de mar más agitado), tira la
  media a un valor algo negativo pero sigue sin verse ninguna
  desviación sistemática real — puede que Open-Meteo se comporte
  distinto con mar de temporal que con mar en calma en este punto,
  algo a vigilar si se repiten noches agitadas.
- **1117 Gijón**: 12 puntos, media ≈ **−6.1%** — sigue alternando signo
  y magnitud, sin patrón sólido pese al aumento del historial.
- **1101 Pasaia II**: **12 puntos, los 12 con el mismo signo negativo**
  (media ≈ **−29.7%**) — el punto de hoy es además la mayor desviación
  absoluta vista en esta boya hasta ahora (mar más agitado, −1.49 m).
  Sigue siendo, con diferencia, la boya con el sesgo más consistente y
  estable de las 3 obligatorias: 12/12 noches con Open-Meteo calculando
  por debajo, magnitud siempre en un rango similar (entre −15.7% y
  −49.5%). **Faltan solo 3 puntos más para el mínimo de 15** — a este
  ritmo (una pasada nocturna al día, a veces más con las buscadoras
  diurnas) se alcanzaría en 2-3 días. Sigue sin proponerse ningún factor
  de corrección todavía, pero la próxima pasada o la siguiente ya
  debería tener base suficiente para redactar una propuesta concreta si
  el signo se mantiene.
- **1731 Barcelona II**: 5 puntos (−22.9%, −48.3%, −25.7%, −27.8%,
  −26.8%), **los 5 con el mismo signo negativo**, media ≈ **−30.3%** —
  magnitud muy parecida a la de Pasaia II (≈−29.7%) pese a ser una zona
  completamente distinta (Mediterráneo vs. Cantábrico). Es la segunda
  boya, tras Pasaia II, que empieza a mostrar un sesgo negativo
  consistente en todas sus muestras — con 5 puntos todavía es pronto
  para tratarlo como confirmado, pero merece seguimiento cercano en
  próximas rotaciones.
- Resto de boyas (1514 Málaga, 2548 Cabo de Gata, 2820 Dragonera, 2242
  Cabo Peñas, 2246 Villano-Sisargas): sin cambios desde su última
  pasada, no les tocaba rotación esta noche.

**Ningún factor de corrección propuesto todavía** — Pasaia II está a
solo 3 puntos del umbral de 15; si las próximas pasadas siguen dando
signo negativo (como las 12 anteriores), la próxima entrada de esta
rutina o la siguiente debería ya poder proponer un factor concreto para
esa zona. Para la próxima rotación nocturna, candidatas con más noches
sin repetirse: 1514 Málaga (desde 2026-09-17) o Cabo Peñas (desde
2026-09-14, solo actualizada por pasadas buscadoras diurnas desde
entonces).

**Salud de datos — misma limitación de red de la sesión que las dos
noches anteriores, ya documentada el 2026-08-31, el 2026-09-17 y el
2026-09-18: no es evidencia de que ninguna fuente esté rota.**
Verificado en vivo con `curl`: las 4 boyas de Puertos del Estado de
arriba (responden `200` con datos reales y recientes, última lectura
hace 0-1h) y 3 webcams de proveedores distintos (`mundaka` —
kostasystem.com, 106 KB; `bakio` — pyscada.isurki.com, 765 KB;
`sopelana` — detectia.net, 63 KB; las 3 con `200` y una imagen real de
tamaño razonable). **No se pudo comprobar** la boya de Nazaré
(`monican.hidrografico.pt`), ninguna de las 4 fuentes de caudal de río
(`visor.saichcantabrico.es`, `saih.chj.es`, `saihweb.chsegura.es`,
`servizos.meteogalicia.gal`), ni webcams de otros proveedores
(`meteogalicia.gal`, `cantabria.es`, `apps.socib.es`,
`streaming.comunitatvalenciana.com`) — las 8 rechazadas por el propio
proxy de salida de esta sesión (`connect_rejected`, "gateway answered
403 to CONNECT"), confirmado con `curl .../__agentproxy/status`.
**Incluso `https://costaviva.org/` en sí mismo está bloqueado por el
mismo proxy** — se intentó pedirlo para verificar estas fuentes de
forma indirecta a través de `/prevision` en producción, sin éxito, así
que no hay ninguna vía alternativa disponible desde esta sesión.
Ninguna corrección de código aplicada — no hay evidencia de ningún
fallo real, solo de que esta sesión concreta no alcanza esos dominios.
**Esto ya es la tercera noche consecutiva con exactamente el mismo
patrón de dominios bloqueados** (2026-09-17, 2026-09-18 y hoy) — la
nota de la pasada anterior ya recomendaba que el usuario revisara si el
conjunto de dominios permitidos para esta rutina puede ampliarse
(Puertos del Estado y Open-Meteo sí están permitidos; ríos/Nazaré/otras
webcams/incluso el propio costaviva.org no); con esta tercera
repetición seguida, se reitera esa recomendación con más insistencia —
no es algo que esta sesión pueda cambiar por sí misma, y de momento
sigue sin haber señal de que sea transitorio.

**Firmado:** robot de calibración nocturna, 2026-09-19 01:18 UTC.

### 2026-09-20 (pasada nocturna corta — calibración + salud de datos)

**Calibración — decimotercer punto para las 3 boyas obligatorias, cuarto
punto para 2242 Cabo Peñas** (rotación de esta noche: era la candidata
con más noches sin repetirse desde el 2026-09-14, solo tocada por
pasadas buscadoras diurnas desde entonces). Mismo método de siempre:
`curl` a `poem.puertos.es/portus/StationData` para la altura real,
Open-Meteo Marine en las coordenadas exactas de cada boya para la altura
calculada, emparejando por la hora UTC exacta del último dato real de
cada boya. **Mar volviendo a la calma** tras las dos noches agitadas
anteriores (Hm0 real 1.83-2.11 m esta noche, frente a 2.9-3.9 m hace 24h):

| boya | hora UTC | altura medida | altura calculada | diferencia | % |
|---|---|---|---|---|---|
| 2136 Bilbao-Vizcaya | 01:00 | 1.99 m | 1.84 m | −0.15 m | −7.5% |
| 1117 Gijón | 00:00 | 1.91 m | 1.70 m | −0.21 m | −11.0% |
| 1101 Pasaia II | 00:00 | 1.83 m | 1.42 m | −0.41 m | −22.4% |
| 2242 Cabo Peñas | 01:00 | 2.11 m | 1.82 m | −0.29 m | −13.7% |

Historial actualizado de la metodología `boya_vs_openmeteo_mismo_punto`:

- **2136 Bilbao-Vizcaya**: 13 puntos, media ≈ **−1.6%** — sigue sin
  patrón sistemático claro; el punto de hoy vuelve a un valor moderado
  tras el −31.3% de ayer (la noche más agitada vista hasta ahora).
- **1117 Gijón**: 13 puntos, media ≈ **−6.5%** — sigue alternando signo
  y magnitud pasada a pasada, sin patrón sólido.
- **1101 Pasaia II**: **13 puntos, los 13 con el mismo signo negativo**
  (media ≈ **−29.1%**) — sigue siendo, con diferencia, la boya con el
  sesgo más consistente y estable de las 3 obligatorias, y la magnitud
  de hoy (−22.4%) se mantiene dentro del rango habitual (−15.7% a
  −49.5%) pese a que el mar ya no está tan agitado como ayer. **Faltan
  solo 2 puntos más para el mínimo de 15** — a este ritmo debería
  alcanzarse en 1-2 días; si el signo se mantiene, la próxima pasada o
  la siguiente ya debería poder proponer un factor de corrección
  concreto para esta zona.
- **2242 Cabo Peñas**: 4 puntos (−25.5%, −25.5%, −14.1%, −13.7%), **los
  4 con el mismo signo negativo**, media ≈ **−19.7%** — magnitud algo
  menor que Pasaia II/Barcelona II pero mismo signo consistente. Tercera
  boya, tras Pasaia II y Barcelona II, que empieza a mostrar un sesgo
  negativo en todas sus muestras — todavía con poca muestra (4 puntos),
  a seguir vigilando en próximas rotaciones.
- Resto de boyas (1514 Málaga, 1731 Barcelona II, 2820 Dragonera, 2548
  Cabo de Gata, 2246 Villano-Sisargas): sin cambios desde su última
  pasada, no les tocaba rotación esta noche.

**Ningún factor de corrección propuesto todavía** — Pasaia II está a
solo 2 puntos del umbral de 15, el más cerca que ha estado nunca; si las
próximas 1-2 pasadas siguen dando signo negativo (como las 13
anteriores, sin excepción), la próxima entrada de esta rutina debería ya
poder proponer un factor concreto para esa zona, en vez de seguir
posponiéndolo. Para la próxima rotación nocturna, candidatas con más
noches sin repetirse: 1514 Málaga (desde 2026-09-17) o 1731 Barcelona II
(desde 2026-09-19).

**Salud de datos — cuarta noche consecutiva con exactamente el mismo
patrón de dominios bloqueados (2026-09-17, 18, 19 y hoy); no es evidencia
de que ninguna fuente esté rota.** Verificado en vivo con `curl`: las 4
boyas de Puertos del Estado de arriba (responden `200` con datos reales
y recientes, última lectura hace 0-1h) y 3 webcams de proveedores
distintos (`mundaka` — kostasystem.com, 106 KB; `bakio` —
pyscada.isurki.com, 765 KB; `sopelana` — detectia.net, 48 KB; las 3 con
`200` y una imagen real de tamaño razonable). **No se pudo comprobar** la
boya de Nazaré (`monican.hidrografico.pt`), ninguna de las 4 fuentes de
caudal de río (`visor.saichcantabrico.es`, `saih.chj.es`,
`saihweb.chsegura.es`, `servizos.meteogalicia.gal`), ni una cuarta/quinta
webcam de otra región (`meteogalicia.gal` para A Coruña,
`streaming.comunitatvalenciana.com` para Valencia, `apps.socib.es` para
Cala Millor) — las 7 rechazadas por el propio proxy de salida de esta
sesión (`connect_rejected`, "gateway answered 403 to CONNECT"),
confirmado con `curl .../__agentproxy/status`. Ninguna corrección de
código aplicada — no hay evidencia de ningún fallo real, solo de que
esta sesión concreta no alcanza esos dominios. Se reitera, con ya cuatro
noches seguidas del mismo patrón, la recomendación de que el usuario
revise si el conjunto de dominios permitidos para esta rutina puede
ampliarse (Puertos del Estado y Open-Meteo sí están permitidos;
ríos/Nazaré/la mayoría de webcams no).

**Firmado:** robot de calibración nocturna, 2026-09-20 01:20 UTC.

---

### 2026-09-21 (pasada nocturna corta — calibración + salud de datos)

**Pasada nocturna diaria, mismo alcance estrecho** (rutina "Costaviva —
calibración nocturna", no la auditoría semanal completa).

**Calibración — 4 boyas comprobadas, las 3 fijas + rotación a 2548 Cabo
de Gata** (candidata con más noches sin repetirse, desde 2026-09-18,
empatada con Dragonera/Villano-Sisargas pero ya elegida en pasadas
anteriores de la lista corta del prompt). Las 4 respondieron `200` con
forma `[cabeceras, filas]` correcta y datos de la última hora:

- **2136 Bilbao-Vizcaya**: real 1.64 m, calculado 1.62 m, diferencia
  -1.2%. Decimoquinto punto — media de 15 puntos ~= -2.6%, sigue sin
  patrón sistemático (8/15 negativos, signo mixto).
- **1117 Gijón**: real 1.58 m, calculado 1.54 m, diferencia -2.5%.
  Decimoquinto punto — media de 15 puntos ~= -6.6%, igual de mixto
  (11/15 negativos).
- **1101 Pasaia II**: real 1.54 m, calculado 1.24 m, diferencia -19.5%.
  **Decimoquinto punto consecutivo con signo negativo (15/15, sin
  ninguna excepción en 15 noches/pasadas) — alcanza el mínimo de 15
  puntos que el propio prompt de esta rutina fija para valorar un
  factor de corrección.** Media de los 15 puntos: **-29.1%** (Open-Meteo
  calcula sistemáticamente por debajo de lo que mide la boya real).
  **Propuesta concreta, a confirmar por el usuario, nunca aplicada
  aquí**: multiplicar la altura de ola calculada por Open-Meteo para la
  zona de Pasaia/Guipúzcoa (o aplicar un factor equivalente) por **~1.29
  – 1.4** antes de mostrarla — 1.29 si se corrige sobre la media
  aritmética de las diferencias porcentuales (-29.1% → factor
  1/(1-0.291)), 1.4 si se usa la media de la razón real/calculado punto
  a punto (1.44, algo más alta porque pesa más los puntos de mar
  agitado donde la diferencia absoluta y relativa crecen juntas — ver
  CALIBRACION.jsonl, últimos puntos de mar agitado como el
  2026-09-19 con -44.0%). No se ha comprobado si esta zona necesita un
  factor distinto al resto de la costa vasca (Bilbao-Vizcaya y Gijón no
  muestran el mismo sesgo) — sería razonable acotarlo a Pasaia/
  Guipúzcoa en vez de aplicarlo a todo `indiceMar`/`indicePesca`, pero
  esa decisión de alcance es del usuario.
- **2548 Cabo de Gata**: real 1.41 m, calculado 1.08 m, diferencia
  -23.4%. Quinto punto para esta boya, sigue sin patrón consistente
  (-38.1%, +12.5%, -40.2%, +2.1%, -23.4% — 3/5 negativos, sin
  candidata a factor de corrección todavía, haría falta más muestra y
  más consistencia de signo).

**Salud de datos — quinta noche consecutiva con exactamente el mismo
patrón de dominios bloqueados (2026-09-17, 18, 19, 20 y hoy); sigue sin
ser evidencia de que ninguna fuente esté rota.** Verificado en vivo con
`curl`: las 4 boyas de Puertos del Estado de arriba (`200`, datos reales
y recientes) y 3 webcams de proveedores distintos (`mundaka` —
kostasystem.com, 94 KB JPEG 1024×768; `bakio` — pyscada.isurki.com,
765 KB JPEG 1024×768; `sopelana` — detectia.net, 46 KB WebP 2464×2056;
las 3 con `200` y una imagen real de tamaño razonable). **No se pudo
comprobar** la boya de Nazaré (`monican.hidrografico.pt`), ninguna de
las 4 fuentes de caudal de río (`visor.saichcantabrico.es`,
`saih.chj.es`, `saihweb.chsegura.es`, `servizos.meteogalicia.gal`), ni
la ampliación de muestra de webcams intentada hoy (`rswc.tendsys.net`,
la reserva de Laredo — dominio nuevo, no probado en pasadas anteriores,
también rechazado) — las 5 rechazadas por el propio proxy de salida de
esta sesión (`connect_rejected`, "gateway answered 403 to CONNECT"),
confirmado con `curl .../__agentproxy/status`. Ninguna corrección de
código aplicada — no hay evidencia de ningún fallo real, solo de que
esta sesión concreta no alcanza esos dominios. Se reitera, con ya cinco
noches seguidas del mismo patrón, la recomendación de que el usuario
revise si el conjunto de dominios permitidos para esta rutina puede
ampliarse (Puertos del Estado y Open-Meteo sí están permitidos;
ríos/Nazaré/la mayoría de webcams no).

**Resumen de severidad para el usuario**: nada roto en las fuentes ya
integradas (media/baja para los 5 dominios bloqueados por política de
red, sin cambios respecto a las 4 noches anteriores). Novedad real de
hoy: **Pasaia II ya tiene suficiente historial consistente (15/15
negativo, media -29.1%) para que el usuario decida si aplicar un factor
de corrección de ola en esa zona** — ver la propuesta concreta arriba.

**Firmado:** robot de calibración nocturna, 2026-09-21 01:15 UTC.

### 2026-09-22 (pasada nocturna corta — calibración + salud de datos)

**Calibración — decimoséptimo punto para las 3 boyas obligatorias, cuarto
punto para 2246 Villano-Sisargas** (rotación de esta noche: candidata con
más noches sin repetirse en esta rutina nocturna en concreto — nunca le
había tocado un turno nocturno hasta hoy, solo tenía 3 puntos sueltos de
pasadas buscadoras diurnas del 15/17/18 de septiembre). Mismo método de
siempre: `curl` a `poem.puertos.es/portus/StationData` para la altura
real, Open-Meteo Marine en las coordenadas exactas de cada boya para la
altura calculada, emparejando por la hora UTC exacta del último dato real
de cada boya:

| boya | hora UTC | altura medida | altura calculada | diferencia | % |
|---|---|---|---|---|---|
| 2136 Bilbao-Vizcaya | 01:00 | 1.64 m | 1.52 m | −0.12 m | −7.3% |
| 1117 Gijón | 00:00 | 1.54 m | 1.40 m | −0.14 m | −9.1% |
| 1101 Pasaia II | 00:00 | 1.57 m | 1.16 m | −0.41 m | −26.1% |
| 2246 Villano-Sisargas | 01:00 | 1.52 m | 1.36 m | −0.16 m | −10.5% |

Historial actualizado de la metodología `boya_vs_openmeteo_mismo_punto`:

- **2136 Bilbao-Vizcaya**: 17 puntos, media ≈ **−3.1%** — sigue sin
  patrón sistemático (signo mixto), nada nuevo que reportar.
- **1117 Gijón**: 17 puntos, media ≈ **−6.2%** — sigue alternando
  signo/magnitud pasada a pasada, sin patrón sólido.
- **1101 Pasaia II**: **17 puntos, los 17 con el mismo signo negativo**
  (media ≈ **−28.6%**) — sigue reforzando, sin ninguna excepción de
  signo todavía, la propuesta de factor de corrección ya escrita en
  ROBOT.md el 2026-09-21 01:15 UTC (multiplicar la altura de ola
  calculada por Open-Meteo en la zona de Pasaia/Guipúzcoa por ~1.29–1.4)
  — sigue pendiente de que el usuario decida si aplicarla, no se ha
  tocado ningún código.
- **2246 Villano-Sisargas**: 4 puntos (−11.1%, −25.6%, +1.7%, −10.5%),
  3 de 4 negativos, media ≈ **−11.4%** — todavía mezcla de signo (el
  +1.7% del 2026-09-18 rompe la racha) y magnitudes muy distintas entre
  sí, sin patrón consolidado como el de Pasaia II. A seguir vigilando en
  próximas rotaciones.
- Resto de boyas (1731 Barcelona II, 1514 Málaga, 2548 Cabo de Gata,
  2820 Dragonera, 2242 Cabo Peñas): sin cambios desde su última pasada,
  no les tocaba rotación esta noche.

**Ningún factor de corrección nuevo propuesto** — la única propuesta
activa sigue siendo la de Pasaia II (2026-09-21), reforzada por el punto
de hoy. Para la próxima rotación nocturna, las candidatas con más noches
sin repetirse son 1514 Málaga (desde 2026-09-17) y 2242 Cabo Peñas (desde
2026-09-20, solo actualizada por pasadas buscadoras diurnas desde
entonces).

**Salud de datos — sexta noche consecutiva con exactamente el mismo
patrón de dominios bloqueados (2026-09-17 a hoy); sigue sin ser evidencia
de que ninguna fuente esté rota.** Verificado en vivo con `curl`: las 4
boyas de Puertos del Estado de arriba (`200`, forma `[cabeceras, filas]`
correcta, datos reales de la última hora) y 3 webcams de proveedores
distintos, pidiendo la imagen real (no solo la home del dominio):
`mundaka` (kostasystem.com, `200`, 91.8 KB JPEG), `bakio`
(pyscada.isurki.com, `200`, 764.9 KB JPEG), `sopelana` (detectia.net,
`200`, 46.7 KB WebP) — las 3 con tamaños en línea con noches anteriores.
**No se pudo comprobar**: la boya de Nazaré (`monican.hidrografico.pt`),
las 4 fuentes de caudal de río (`visor.saichcantabrico.es`,
`saih.chj.es`, `saihweb.chsegura.es`, `servizos.meteogalicia.gal`), ni la
ampliación de muestra a webcams de otras regiones intentada hoy
(`www.meteogalicia.gal`, `www.cantabria.es`,
`streaming.comunitatvalenciana.com`) — las 7 rechazadas por el propio
proxy de salida de esta sesión (`connect_rejected`, "gateway answered
403 to CONNECT"), confirmado con `curl .../__agentproxy/status`. Ninguna
corrección de código aplicada — no hay evidencia de ningún fallo real,
solo de que esta sesión concreta no alcanza esos dominios. Se reitera,
con ya seis noches seguidas del mismo patrón exacto, la recomendación de
que el usuario revise si el conjunto de dominios permitidos para esta
rutina puede ampliarse.

**Resumen de severidad para el usuario**: nada roto en las fuentes ya
integradas (media/baja para los 7 dominios bloqueados por política de
red, sin cambios respecto a las noches anteriores). Sin novedad de
calibración nueva más allá de reforzar la propuesta ya hecha para Pasaia
II.

**Firmado:** robot de calibración nocturna, 2026-09-22 01:17 UTC.

### 2026-09-23 (pasada nocturna corta — calibración + salud de datos)

**Calibración — decimonoveno punto para las 3 boyas obligatorias, quinto
punto para 1514 Málaga** (rotación de esta noche: candidata con más
noches sin repetirse, desde 2026-09-17). Mismo método de siempre: `curl`
a `poem.puertos.es/portus/StationData` para la altura real, Open-Meteo
Marine en las coordenadas exactas de cada boya para la altura calculada,
emparejando por la hora UTC exacta del último dato real de cada boya:

| boya | hora UTC | altura medida | altura calculada | diferencia | % |
|---|---|---|---|---|---|
| 2136 Bilbao-Vizcaya | 01:00 | 0.82 m | 1.16 m | +0.34 m | +41.5% |
| 1117 Gijón | 00:00 | 1.06 m | 1.26 m | +0.20 m | +18.9% |
| 1101 Pasaia II | 00:00 | 0.82 m | 0.76 m | −0.06 m | −7.3% |
| 1514 Málaga | 00:00 | 0.24 m | 0.20 m | −0.04 m | −16.7% |

Historial actualizado de la metodología `boya_vs_openmeteo_mismo_punto`:

- **2136 Bilbao-Vizcaya**: 19 puntos, media ≈ **−0.5%** — sigue sin
  patrón sistemático (10/19 negativos, signo mixto). El +41.5% de hoy es
  con mar en calma (0.82 m real) — diferencia relativa poco fiable con
  oleaje tan pequeño, mismo aviso ya documentado otras noches; en
  términos absolutos (+0.34 m) no es una desviación grande.
- **1117 Gijón**: 19 puntos, media ≈ **−5.2%** — sigue alternando
  signo/magnitud pasada a pasada (13/19 negativos), sin patrón sólido.
- **1101 Pasaia II**: **19 puntos, los 19 con el mismo signo negativo**
  (media ≈ **−27.5%**) — sigue reforzando, sin ninguna excepción de
  signo todavía, la propuesta de factor de corrección ya escrita en
  ROBOT.md el 2026-09-21 01:15 UTC (multiplicar la altura de ola
  calculada por Open-Meteo en la zona de Pasaia/Guipúzcoa por ~1.29–1.4)
  — la magnitud de hoy (−7.3%) es la más pequeña de toda la serie,
  coincide con mar en calma (0.82 m real) igual que el aviso de
  fiabilidad de porcentaje de arriba; sigue pendiente de que el usuario
  decida si aplicarla, no se ha tocado ningún código.
- **1514 Málaga**: 5 puntos (−38.1%, +12.5%, −40.2%, +2.1%, −16.7%), 3 de
  5 negativos, sin patrón consolidado como el de Pasaia II — mar casi en
  calma hoy (0.24 m real) también con pct poco fiable.
- Resto de boyas (1731 Barcelona II, 2246 Villano-Sisargas, 2242 Cabo
  Peñas, 2548 Cabo de Gata, 2820 Dragonera, SOCIB Bahía de
  Palma/Canal de Ibiza): sin cambios desde su última pasada, no les
  tocaba rotación esta noche.

**Ningún factor de corrección nuevo propuesto** — la única propuesta
activa sigue siendo la de Pasaia II (2026-09-21), reforzada de nuevo por
el punto de hoy. Para la próxima rotación nocturna, la candidata con más
noches sin repetirse es **2242 Cabo Peñas** (desde 2026-09-20).

**Salud de datos — séptima noche consecutiva con el mismo patrón de
dominios bloqueados por la política de red de esta sesión (2026-09-17 a
hoy), más un hallazgo nuevo real esta noche.** Verificado en vivo con
`curl`:
- Las 4 boyas de arriba: `200`, forma `[cabeceras, filas]` correcta,
  datos reales de la última hora — sin novedad.
- **`mundaka`** (kostasystem.com): `200`, 84.9 KB JPEG 1024×768 — bien.
- **`sopelana`** (detectia.net): `200`, 89.2 KB WebP 2464×2056 — bien.
- **`bakio`, fuente principal (`pyscada.isurki.com`) — hallazgo nuevo**:
  el TLS handshake completa bien (certificado válido, vence
  2026-11-23) y la conexión se acepta, pero el servidor **no responde
  nada a la petición GET** — timeout agotado dos veces (15 s y 30 s) y
  confirmado con `curl -v` que no es un bloqueo del proxy de esta sesión
  (no aparece como `connect_rejected` en `.../__agentproxy/status`, a
  diferencia de los dominios de siempre). En noches anteriores esta
  misma URL respondía bien (764.9 KB JPEG el 2026-09-21/22), así que
  parece un problema real y nuevo del lado del proveedor (servidor
  colgado o muy lento), no de esta sesión. **Severidad baja**: `bakio`
  ya tiene una reserva automática configurada en
  `functions/webcam/[slug].js` (`webviewcams.com`, MJPEG) que entra en
  juego sola si la principal falla — el usuario final probablemente no
  nota nada. No se ha podido comprobar la reserva esta noche (mismo
  dominio bloqueado por la política de red de esta sesión que otras
  noches). Ninguna corrección de código aplicada — no hay URL que
  cambió ni campo renombrado, es un servidor real sin responder, no algo
  que este robot pueda arreglar. Si `pyscada.isurki.com` sigue sin
  responder en la próxima pasada (nocturna o de la rutina semanal),
  merece subir de severidad.
- **No se pudo comprobar**: la boya de Nazaré
  (`monican.hidrografico.pt`), las 4 fuentes de caudal de río
  (`visor.saichcantabrico.es`, `saih.chj.es`, `saihweb.chsegura.es`,
  `servizos.meteogalicia.gal`) — las 5 rechazadas por el propio proxy de
  salida de esta sesión (`connect_rejected`, "gateway answered 403 to
  CONNECT"), mismo patrón que las últimas seis noches. Se reitera la
  recomendación de que el usuario revise si el conjunto de dominios
  permitidos para esta rutina puede ampliarse.

**Resumen de severidad para el usuario**: nada roto de forma confirmada
en las fuentes ya integradas — severidad media/baja para los 5 dominios
bloqueados por política de red de esta sesión (sin cambios) y severidad
baja/nueva para el timeout de `pyscada.isurki.com` (fuente principal de
la webcam de Bakio), que no afecta al usuario final gracias a la reserva
automática ya existente, pero merece vigilarse la próxima noche. Sin
propuesta de factor de corrección nueva — la de Pasaia II sigue
reforzándose (19/19 negativo, media −27.5%).

**Firmado:** robot de calibración nocturna, 2026-09-23 01:16 UTC.

### 2026-09-24 (pasada nocturna corta — calibración + salud de datos)

**Calibración — vigésimo punto para las 3 boyas obligatorias, quinto
punto para 2242 Cabo Peñas** (rotación de esta noche: candidata con más
noches sin repetirse, desde 2026-09-20). Mismo método de siempre: `curl`
a `poem.puertos.es/portus/StationData` para la altura real, Open-Meteo
Marine en las coordenadas exactas de cada boya para la altura calculada,
emparejando por la hora UTC exacta del último dato real de cada boya:

| boya | hora UTC | altura medida | altura calculada | diferencia | % |
|---|---|---|---|---|---|
| 2136 Bilbao-Vizcaya | 01:00 | 1.64 m | 1.52 m | −0.12 m | −7.3% |
| 1117 Gijón | 00:00 | 1.40 m | 1.30 m | −0.10 m | −7.1% |
| 1101 Pasaia II | 00:00 | 1.57 m | 0.96 m | −0.61 m | −38.9% |
| 2242 Cabo Peñas | 01:00 | 1.52 m | 1.44 m | −0.08 m | −5.3% |

Historial actualizado de la metodología `boya_vs_openmeteo_mismo_punto`
(medias recalculadas sobre todos los puntos reales de `CALIBRACION.jsonl`,
no aproximadas):

- **2136 Bilbao-Vizcaya**: 20 puntos, media ≈ **−0.8%** — sigue sin
  patrón sistemático (11/20 negativos, signo mixto).
- **1117 Gijón**: 20 puntos, media ≈ **−5.3%** — sigue alternando
  signo/magnitud pasada a pasada (14/20 negativos), sin patrón sólido.
- **1101 Pasaia II**: **20 puntos, los 20 con el mismo signo negativo**
  (media ≈ **−28.0%**) — vigésima noche consecutiva sin ninguna
  excepción de signo, sigue reforzando la propuesta de factor de
  corrección ya escrita en ROBOT.md el 2026-09-21 01:15 UTC (multiplicar
  la altura de ola calculada por Open-Meteo en la zona de
  Pasaia/Guipúzcoa por ~1.29–1.4) — sigue pendiente de que el usuario
  decida si aplicarla, no se ha tocado ningún código.
- **2242 Cabo Peñas**: 5 puntos (−25.5%, −25.5%, −14.1%, −13.7%, −5.3%),
  los 5 con signo negativo (media ≈ **−16.8%**) — empieza a parecer un
  patrón consistente como el de Pasaia II, aunque con menos historial
  (5 frente a 20) y una magnitud menor; a vigilar en próximas rotaciones,
  todavía lejos de los 15 puntos necesarios para proponer nada.
- Resto de boyas (1731 Barcelona II, 2246 Villano-Sisargas, 2548 Cabo de
  Gata, 2820 Dragonera, 1514 Málaga, SOCIB Bahía de Palma/Canal de
  Ibiza): sin cambios desde su última pasada, no les tocaba rotación
  esta noche.

**Ningún factor de corrección nuevo propuesto** — la única propuesta
activa sigue siendo la de Pasaia II (2026-09-21), reforzada de nuevo por
el punto de hoy. Para la próxima rotación nocturna, la candidata con más
noches sin repetirse es **2548 Cabo de Gata** (desde 2026-09-21).

**Salud de datos — el timeout de `bakio` (`pyscada.isurki.com`)
reportado anoche se ha resuelto solo; hallazgo nuevo esta noche: la
política de red de esta sesión bloquea muchos más dominios de webcam de
los documentados hasta ahora, no solo los 5 de siempre.** Verificado en
vivo con `curl`:
- Las 4 boyas de arriba: `200`, forma `[cabeceras, filas]` correcta,
  datos reales de la última hora — sin novedad.
- **`bakio` (fuente principal, `pyscada.isurki.com`) — recuperada**:
  `200`, 764.9 KB JPEG, mismo tamaño que antes del timeout de anoche
  (2026-09-23) — era un problema puntual del proveedor, no algo que
  necesitara corrección de código, tal y como se apuntó ayer.
- **`mundaka`** (kostasystem.com): `200` — bien.
- **`getxo`** (detectia.net): `200` — bien.
- **No se pudo comprobar, esta vez con una lista más amplia de la
  habitual**: `acoruna` (meteogalicia.gal), `valencia`
  (streaming.comunitatvalenciana.com) y `muro`
  (apps.socib.es) — las 3 rechazadas por el propio proxy de salida de
  esta sesión (`connect_rejected`, "gateway answered 403 to CONNECT"),
  igual que las 5 fuentes ya documentadas otras noches (Nazaré + 4 ríos).
  Probando también otros dominios usados por `functions/webcam/[slug].js`
  para confirmar el alcance: `www.cantabria.es`, `s61.ipcamlive.com`,
  `rswc.tendsys.net` y `www.webviewcams.com` (la reserva de `bakio`)
  **también bloqueados** por esta misma política — solo
  `detectia.net`, `kostasystem.com` y `pyscada.isurki.com` (todos
  proveedores de webcams del País Vasco) resultaron alcanzables esta
  noche, además de `poem.puertos.es` y `marine-api.open-meteo.com` para
  la calibración. **No es una fuente rota**: es la propia sesión en la
  nube la que no puede salir a esos dominios (mismo tipo de bloqueo que
  ya afecta a Nazaré/los 4 ríos, documentado en `CLAUDE.md` — las
  Functions de Cloudflare sí tienen red real, esta sesión no). Se
  reitera con más fuerza la recomendación de que el usuario revise el
  conjunto de dominios permitidos para esta rutina: con la lista actual,
  la comprobación real de "salud de datos" de esta pasada nocturna queda
  limitada casi en exclusiva a las boyas de Puertos del Estado y a las
  3 webcams del País Vasco, sin poder verificar nunca Galicia,
  Cantabria, Comunitat Valenciana ni Baleares desde aquí.

**Resumen de severidad para el usuario**: nada roto de forma confirmada
en las fuentes ya integradas — el timeout de `bakio` de anoche se
resolvió solo. Severidad media/baja para los dominios bloqueados por la
política de red de esta sesión, que hoy resultó ser una lista bastante
más larga de la que se venía reportando — recomendación reiterada (y
reforzada) de ampliarla si se quiere que esta pasada nocturna pueda
comprobar de verdad la salud de las webcams fuera del País Vasco. Sin
propuesta de factor de corrección nueva — la de Pasaia II sigue
reforzándose (20/20 negativo, media −28.0%), y Cabo Peñas (5/5 negativo,
media −16.8%) empieza a apuntar en la misma dirección con menos
historial todavía.

**Firmado:** robot de calibración nocturna, 2026-09-24 01:15 UTC.

### 2026-09-25 (pasada nocturna corta — calibración + salud de datos)

**Nota operativa previa, antes de empezar la tarea de esta noche**: el
commit de la pasada de anoche (2026-09-24) apareció en este checkout
como un commit local sin rama, desconectado de `main` (`git log`
mostraba `HEAD detached from refs/heads/main`). Comprobado contra
`origin/main`: el commit **sí estaba ya en el remoto** — era solo el
puntero local de esta sesión el que había quedado en detached HEAD, no
una pérdida real de trabajo. Se hizo `git checkout main` (ya estaba al
día con `origin/main`) antes de continuar, sin tocar ningún commit. Se
deja anotado por si vuelve a pasar: comprobar siempre `git log
origin/main` antes de asumir que un commit huérfano se ha perdido de
verdad.

**Calibración — vigesimoprimer punto para las 3 boyas obligatorias,
sexto punto para 2548 Cabo de Gata** (rotación de esta noche: candidata
con más noches sin repetirse, desde 2026-09-21). Mismo método de
siempre: `curl` a `poem.puertos.es/portus/StationData` para la altura
real, Open-Meteo Marine en las coordenadas exactas de cada boya para la
altura calculada, emparejando por la hora UTC exacta del último dato
real de cada boya:

| boya | hora UTC | altura medida | altura calculada | diferencia | % |
|---|---|---|---|---|---|
| 2136 Bilbao-Vizcaya | 01:00 | 1.29 m | 1.24 m | −0.05 m | −3.9% |
| 1117 Gijón | 00:00 | 1.02 m | 1.04 m | +0.02 m | +2.0% |
| 1101 Pasaia II | 00:00 | 1.22 m | 0.86 m | −0.36 m | −29.5% |
| 2548 Cabo de Gata | 01:00 | 0.35 m | 0.24 m | −0.11 m | −31.4% |

Historial actualizado de la metodología `boya_vs_openmeteo_mismo_punto`
(medias recalculadas sobre todos los puntos reales de `CALIBRACION.jsonl`,
no aproximadas):

- **2136 Bilbao-Vizcaya**: 21 puntos, media ≈ **−1.0%** — sigue sin
  patrón sistemático (12/21 negativos, signo mixto).
- **1117 Gijón**: 21 puntos, media ≈ **−4.9%** — sigue alternando
  signo/magnitud pasada a pasada (14/21 negativos), sin patrón sólido.
- **1101 Pasaia II**: **21 puntos, los 21 con el mismo signo negativo**
  (media ≈ **−28.1%**) — vigesimoprimera noche consecutiva sin ninguna
  excepción de signo, sigue reforzando la propuesta de factor de
  corrección ya escrita en ROBOT.md el 2026-09-21 01:15 UTC (multiplicar
  la altura de ola calculada por Open-Meteo en la zona de
  Pasaia/Guipúzcoa por ~1.29–1.4) — sigue pendiente de que el usuario
  decida si aplicarla, no se ha tocado ningún código.
- **2548 Cabo de Gata**: 6 puntos, 4 de 6 con signo negativo (media ≈
  **−15.1%**) — a diferencia de Cabo Peñas (5/5 negativo), aquí el
  signo no es consistente todavía, así que no apunta a un patrón
  geográfico claro por ahora.
- Resto de boyas (1731 Barcelona II, 2246 Villano-Sisargas, 2242 Cabo
  Peñas, 2820 Dragonera, 1514 Málaga, SOCIB Bahía de Palma/Canal de
  Ibiza): sin cambios desde su última pasada, no les tocaba rotación
  esta noche.

**Ningún factor de corrección nuevo propuesto** — la única propuesta
activa sigue siendo la de Pasaia II (2026-09-21), reforzada de nuevo por
el punto de hoy. Para la próxima rotación nocturna, la candidata con más
noches sin repetirse es **2820 Dragonera (Mallorca)** (desde 2026-09-21).

**Salud de datos — octava noche con el mismo patrón de dominios
bloqueados por la política de red de esta sesión; nada roto en lo que sí
se pudo comprobar.** Verificado en vivo con `curl` (con dos reintentos
puntuales por timeouts transitorios en `poem.puertos.es`/2136 y en
Open-Meteo/2136 y 1117 — los tres resolvieron bien al repetir la
petición, no parecen un problema real de la fuente, solo ruido de red
de esta sesión concreta esta noche):
- Las 4 boyas de arriba: `200`, forma `[cabeceras, filas]` correcta,
  datos reales de la última hora — sin novedad.
- **`mundaka`** (www.kostasystem.com): `200`, 84.4 KB JPEG 1024×768 —
  bien, tamaño en línea con noches anteriores.
- **`sopelana`** (detectia.net): `200`, 44.7 KB WebP — bien.
- **`getxo`** (detectia.net): `200`, 29.1 KB WebP — bien.
- **`bakio`** (pyscada.isurki.com): `200`, 764.9 KB JPEG — bien, mismo
  tamaño exacto que noches anteriores.
- **No se pudo comprobar**: la boya de Nazaré (`monican.hidrografico.pt`),
  las 4 fuentes de caudal de río (`visor.saichcantabrico.es`,
  `saih.chj.es`, `saihweb.chsegura.es`, `servizos.meteogalicia.gal`) ni
  la muestra ampliada de webcams de otras regiones (`meteogalicia.gal`
  para A Coruña, `streaming.comunitatvalenciana.com` para Valencia,
  `apps.socib.es` para Muro, `www.cantabria.es`) — las 8 rechazadas por
  el propio proxy de salida de esta sesión (`connect_rejected`, "gateway
  answered 403 to CONNECT"), mismo patrón exacto que las últimas siete
  noches. Se reitera la recomendación, ya repetida varias noches, de que
  el usuario revise si el conjunto de dominios permitidos para esta
  rutina puede ampliarse — con la lista actual la comprobación de salud
  sigue limitada casi en exclusiva a las boyas de Puertos del Estado y a
  las webcams del País Vasco.

**Resumen de severidad para el usuario**: nada roto de forma confirmada
en las fuentes ya integradas. Severidad media/baja, sin cambios, para
los 8 dominios bloqueados por la política de red de esta sesión. Sin
propuesta de factor de corrección nueva — la de Pasaia II sigue
reforzándose (21/21 negativo, media −28.1%); Cabo de Gata (4/6
negativo, media −15.1%) no muestra el mismo patrón consistente que
Cabo Peñas.

**Firmado:** robot de calibración nocturna, 2026-09-25 01:25 UTC.

---

## Robot de experiencia de usuario

### 2026-09-15

Pasada de prueba intensiva de "usuario real exigente" contra producción
(costaviva.org + API REST de Supabase), con las dos cuentas de prueba.
Núcleo sólido: /prevision (105 spots, 0 errores, dato fresco, "ahora"
alineado con Madrid), datos coherentes por zona (marea, temperatura de
agua, presión, coeficiente por spot con 26 valores distintos),
/identificar-captura acertó "Lubina" (Dicentrarchus labrax) sin inventar
talla/peso por falta de escala, /luna, /geocodificar, /webcam y rutas
bloqueadas correctos, y el flujo completo de grupos (crear/invitar/unir/
compartir con interruptores granulares + aislamiento entre cuentas
verificado) funciona bien. Dos hallazgos: (1) los spots de marea casi
nula del Mediterráneo (peniscola, gandia, torreblanca, vinaros, piles,
calamillor, sonbou, muro) muestran "próximas mareas" contradictorias
—dos pleamares seguidos, o pleamar y bajamar a la misma altura con 1 h
de diferencia— que son puro ruido del modelo (delta 0.00–0.06 m);
convendría ocultar los eventos cuando el rango es < ~0.10–0.15 m. (2) La
función eliminar_grupo() está en el repo (migración 20260915120000) pero
NO desplegada en producción (PGRST202), y grupos.html la llama con
`.catch(()=>{})`, así que al salir el último miembro el grupo queda
huérfano en silencio —ya hay una invitación huérfana previa que lo
confirma; falta aplicar la migración. Datos de prueba limpiados salvo la
fila de grupo huérfana y su invitación (consecuencia directa del
hallazgo 2, inofensivas). Informe completo en /tmp/experiencia-informe.txt.

### 2026-09-16

Segunda pasada intensiva de "usuario real exigente" contra producción
(costaviva.org + API REST de Supabase) con las dos cuentas de prueba.
Núcleo muy sólido: /prevision (105 spots, 0 errores, 0 nulos en los
bloques, dato fresco del día) con valores coherentes por zona —marea del
Mediterráneo minúscula (Valencia 0.1 m) vs Cantábrico ~2.4 m vs Atlántico
~1.8 m—, temperatura del agua que refleja el afloramiento real del NW de
Portugal/Costa da Morte (13.8–14.8 °C) frente a Baleares (27–28 °C), y las
27 boyas de Puertos del Estado con oleaje real. /identificar-captura volvió
a acertar "Lubina" (Dicentrarchus labrax) sin inventar talla/peso por falta
de escala; /luna coherente con la fase real (creciente 28%); errores de
borde claros (geocodificar en el océano → 422, sin lat/lon → 400, webcam
inexistente → 404). RLS verificado en cruzado (B no ve nada de A; B
suplantando el user_id de A al insertar → 403) y el flujo COMPLETO de
grupos con dos cuentas reales (crear/invitar/unir/ver-compartido +
interruptor maestro y granular por tipo de salida + aislamiento de
no-miembro que no revela si el grupo existe) funciona bien. Dos hallazgos
menores, ninguno de cálculo: (1) la boya de Nazaré (fuente real: Instituto
Hidrográfico de Portugal) se etiqueta en el popup de index.html como
"Puertos del Estado" —atribución de fuente incorrecta, única boya
afectada; (2) su campo "actualizado" usa formato no-ISO ("2026-09-16
11:00") frente al ISO-Z del resto, latente pero hoy sin impacto porque el
popup no muestra ese campo. Nota útil sobre el hallazgo huérfano del
2026-09-15: el DELETE directo del creador sobre la tabla `grupos` SÍ
funciona (204, 0 residual verificado), así que la limpieza de grupos es
posible sin la RPC eliminar_grupo() pendiente de desplegar. Todos los datos
de prueba borrados y verificados a 0. Informe completo en
/tmp/experiencia-informe.txt.

### 2026-09-17

Tercera pasada intensiva de "usuario real exigente" contra producción
(costaviva.org + API REST de Supabase) con las dos cuentas de prueba.
Núcleo sólido de nuevo: entrada de diario real en Mundaka con todos los
campos ambientales (marea, presión, viento, oleaje, temp. agua,
nubosidad, coeficiente) llegando completos y coherentes con /prevision
para ese spot — no se repitió el bug de índices cruzados que dejaba esos
campos en blanco; /identificar-captura volvió a acertar "Lubina" con una
foto real sin inventar talla/peso por falta de escala; el flujo completo
de grupos con las dos cuentas (crear/invitar/unir/compartir por tipo de
salida con interruptor maestro + aislamiento mientras no se comparte)
funcionó exactamente como está diseñado; y `eliminar_grupo()` con un
`grupo_id` inexistente ya da el error limpio "Grupo no encontrado"
(confirma en producción el arreglo de hoy mismo,
`20260917160000_eliminar_grupo_id_invalido.sql`). Un hallazgo, relacionado
con el ya conocido de mareas casi nulas del Mediterráneo (2026-09-15): en
Valencia, con un rango de marea real de solo ~9 cm en 48h, el filtro de
ruido deja un único evento de "próxima pleamar" que puede caer más de 24h
vista (la de mañana, no la de hoy) — y el panel de index.html
(`panelMareaProxima`) muestra solo la hora ("16:00"), sin indicar si es
hoy o mañana, lo que puede leerse como si ya hubiera pasado. No es un
cálculo erróneo (es la consecuencia esperada del filtro de ruido ya
documentado), pero sí una ambigüedad real de interfaz que valdría la
pena aclarar con un indicador de "mañana" cuando el evento no cae en las
próximas horas. Todos los datos de prueba (2 salidas, 2 capturas, 1
grupo, 1 invitación, 1 membresía) borrados y verificados a 0. Informe
completo en /tmp/experiencia-informe.txt.

### 2026-09-18

Cuarta pasada intensiva de "usuario real exigente" contra producción
(costaviva.org + API REST de Supabase) con las dos cuentas de prueba.
Núcleo sólido de nuevo: entrada de diario real en Mundaka con marea/
oleaje/viento/presión/coeficiente internamente coherentes (swell real
entrando, periodo alargándose de 9 a 13s); /identificar-captura volvió a
acertar "Lubina" con una foto real sin inventar talla/peso por falta de
escala; flujo completo de grupos con las dos cuentas (crear/invitar/
unir/compartir selectivo por categoría, aislamiento verificado en ambos
sentidos, atribución cae bien a "Miembro del grupo") funcionó exactamente
como está diseñado; `eliminar_grupo()` con id inexistente sigue dando el
error limpio confirmado el 2026-09-17. Dos hallazgos: (1) profundizando en
el bug de mareas casi nulas del Mediterráneo ya conocido (2026-09-15,
2026-09-17): repliqué el algoritmo exacto de `calcularMarea()` con datos
horarios reales de Open-Meteo para Roses y confirmé que el filtro de ruido
(`UMBRAL_RUIDO_MAREA_M=0.12`) no solo funde pares de eventos aislados —
en cascada, funde TODOS los eventos de la ventana de 2 días en uno solo,
porque en el Mediterráneo cada pleamar/bajamar consecutiva difiere de la
anterior en menos de 0.12m. Resultado: la pleamar real de hoy (14-15h,
0.16m) y la bajamar real de hoy (22-23h) desaparecen sin aviso, y el
panel solo muestra un evento de MAÑANA — comprobado el mismo patrón sin
excepción en Torreblanca, Vinaròs, Piles, Cala Millor, Son Bou y Muro (los
6 spots que el propio código ya señalaba como afectados). (2) Hallazgo
nuevo: el indicador "caudal bajo/normal/alto" del mapa de ríos
(`categoriaCaudal()`, index.html) usa como umbrales los niveles de ALERTA
POR INUNDACIÓN de la fuente oficial (confirmado mirando el HTML crudo de
visor.saichcantabrico.es: son literalmente 3 iconos de semáforo
amarillo/naranja/rojo de aviso de avenida, no una tabla de abundancia de
agua) — con el Sella hoy en 5.22 m³/s frente a un `umbralBajo` (primer
nivel de alerta) de 438, cualquier caudal normal sin lluvias sale
etiquetado "bajo" (verde) casi todos los días del año, dando una falsa
sensación de indicador variable cuando en la práctica casi nunca cambia
de color salvo en una crecida real. No comprobado si Júcar/Turia/Mijares
(fuente distinta) tienen el mismo problema — pendiente. También un
detalle menor de UX: una foto corrupta en /identificar-captura devuelve
un error crudo que menciona "Anthropic" y se muestra literal al usuario
en diario.html, en vez de un mensaje cuidado. Todos los datos de prueba
(2 salidas, 2 capturas, 1 grupo, 1 invitación, 2 membresías) borrados y
verificados a 0. Informe completo en /tmp/experiencia-informe.txt.

### 2026-09-19

Quinta pasada intensiva de "usuario real exigente" contra producción
(costaviva.org + API REST de Supabase) con las dos cuentas de prueba.
Núcleo sólido de nuevo: comparé /prevision en detalle para 3 zonas
(Mundaka/Cantábrico, Valencia/Mediterráneo, Las Palmas/Canarias) y todo
—marea, oleaje, viento, temperatura del agua— tenía pinta coherente
para la época; puse en duda a propósito el coeficiente de marea por
spot (hoy casi todos los spots atlánticos daban 20-23, el mínimo de su
escala, mientras la fórmula astronómica de respaldo daba 70 calculada a
mano) y lo verifiqué contra tides4fishing.com para Bermeo: el
coeficiente real de hoy es 25-27 ("muy bajo"), coincide con lo que
muestra la app — no era un bug, era el mecanismo principal funcionando
bien un día de mareas muertas de verdad. Entrada de diario real en
Mundaka con los mismos valores que /prevision, /identificar-captura
acertó "Lubina" sin inventar talla/peso, y el flujo completo de grupos
con las dos cuentas (crear/invitar/unir/compartir selectivo, activar un
compartir a media prueba y verlo reflejado al momento, aislamiento
verificado en ambos sentidos) funcionó exactamente como está diseñado.
Casos límite probados con errores claros en todos los casos (400/401/502
según toque, nunca un 200 silencioso): /luna sin coordenadas y con
coordenadas absurdas, /geocodificar sin parámetros, /identificar-captura
sin sesión y sin imagen, insert sin "especie", fecha con formato
inválido.

**El bug de "dos pleamares seguidas sin bajamar entre medias" en spots
de marea casi plana (documentado ya el 2026-09-15, 2026-09-17 y
2026-09-18, `UMBRAL_RUIDO_MAREA_M` en `calcularMarea()`,
`functions/prevision.js`) SIGUE sin corregirse — 4ª confirmación
consecutiva.** Hoy apareció en Valencia (Malvarrosa), que no estaba en
la lista de 6-8 spots ya catalogados como afectados (peniscola, gandia,
torreblanca, vinaros, piles, cala millor, son bou, muro) — reproduje el
algoritmo exacto con los datos horarios reales de Open-Meteo para
Valencia y confirmé que una bajamar real y grande (el mínimo de toda la
ventana de 48h, hacia las 08-10h del segundo día) desaparece del todo
porque el filtro de ruido compara el nuevo evento contra el último
evento que sobrevivió sin importar si es del mismo tipo (pleamar vs.
bajamar) — con esto, cualquier spot de marea muy plana puede verse
afectado, no solo la lista cerrada de siempre. Sugerencia (solo
propuesta, no aplicada): antes de descartar un evento por diferencia de
altura, exigir también que sea del mismo tipo que el evento con el que
se compara — así una bajamar real nunca se compararía contra una
pleamar guardada y no desaparecería sin dejar rastro. Hallazgo menor
aparte: `/luna` con coordenadas fuera de rango (lat=999,lon=999) da 502
con el texto crudo de la URL del proveedor externo (USNO) en el mensaje
de error, en vez de un 400 propio de validación — sin datos sensibles
expuestos, pero menos cuidado que el resto de endpoints. Todos los
datos de prueba (2 salidas, 2 capturas, 1 grupo, 1 invitación, 2
membresías) borrados y verificados a 0. Informe completo en
/tmp/experiencia-informe.txt.

### 2026-09-20

Sexta pasada intensiva de "usuario real exigente" contra producción
(costaviva.org + API REST de Supabase) con las dos cuentas de prueba.
Núcleo sólido de nuevo: entrada de diario real en Mundaka con todos los
campos ambientales coherentes con /prevision; /identificar-captura
acertó "Lubina" sin inventar talla/peso por falta de escala;
impersonación de `user_id` bloqueada por RLS (403) y lectura cruzada A/B
bloqueada; flujo completo de grupos con las dos cuentas (crear/invitar/
unir/activar compartir a media prueba/salir) funcionó exactamente como
está diseñado, incluida `eliminar_grupo()`. Errores de borde siempre
claros (400/401/404/422/502, nunca un 200 silencioso). Un hallazgo
nuevo: comparé el `coeficiente` de marea de `/prevision` entre Cantábrico
y Mediterráneo contra la fase lunar real (hoy, gibosa creciente al 65%,
subiendo hacia la llena) y descargué yo mismo 8 días de
`sea_level_height_msl` de Open-Meteo Marine API para Bakio, Calpe y
Valencia: en Bakio el rango de marea diario sube de forma monótona hacia
la llena (1.13 m hoy → 3.89 m en 7 días), como cabría esperar; en Calpe y
Valencia el rango va justo al revés, más alto ahora y bajando toda la
semana, con el pico varios días antes de la llena en vez de después.
Como el Mediterráneo tiene una marea astronómica real minúscula (10-20
cm) dominada por presión/viento, `coeficientePorSpot()` probablemente
está normalizando ruido meteorológico como si fuera el ciclo vivas-
muertas ahí — la app le pone la misma etiqueta y el mismo aviso genérico
("propio de este punto") en Calpe/Valencia que en el Cantábrico, sin
avisar de que en el Mediterráneo ese número puede no tener relación
real con la Luna esa semana. Relacionado en espíritu con el bug ya
conocido de eventos de marea fundidos en spots mediterráneos de marea
casi plana (documentado 2026-09-15 a 2026-09-19) — mismo origen (marea
real minúscula y ruidosa), pero un síntoma distinto (aquí no se pierde
ningún evento, es el número del coeficiente el que parece no significar
lo mismo que en el resto del país). Solo propuesta, no aplicada — es una
decisión de producto. Todos los datos de prueba (2 salidas, 1 captura, 1
grupo, 1 invitación, 1 membresía) borrados y verificados a 0. Informe
completo en /tmp/experiencia-informe.txt.

### 2026-09-22

Pasada de prueba intensiva de "usuario real exigente" contra producción
(costaviva.org + API REST de Supabase) con las dos cuentas de prueba.
Núcleo sólido: /prevision comparado en Mundaka (Cantábrico), Calpe
(Mediterráneo) y Las Palmas (Canarias) con datos coherentes por zona y
época del año (agua 21.6-22°C / 26°C / 24.3-24.5°C, oleaje y mareas
internamente consistentes, 22 boyas reales de Puertos del Estado sin
error); /identificar-captura volvió a acertar "Lubina" con una foto real
distinta (Ifremer/Wikimedia) sin inventar talla/peso por falta de
referencia de escala, y sus 4 casos límite (sin token, token inválido,
sin imagen, imagen inválida) dieron errores claros, ninguno silencioso.
El flujo completo de grupos con las dos cuentas (crear/invitar/unir,
aislamiento mientras no se comparte, interruptores independientes por
categoría, salir, eliminar_grupo()) funcionó de principio a fin —
confirma que la RPC eliminar_grupo() ya está desplegada en producción
(el hallazgo del 2026-09-15 quedó resuelto). Dos hallazgos menores de
validación, ninguno explotable desde la app real: (1) `capturas.especie`
es `not null` pero acepta cadena vacía ("") por la API REST directa —
`diario.html` ya bloquea esto en el cliente antes de llamar a Supabase,
así que es un hueco de defensa en profundidad, no un bug activo; (2)
`capturas.talla_cm` acepta valores negativos (-30) sin ningún `check`.
Aparte, no es un bug pero se anota: `/geocodificar` en las coordenadas
exactas de "Mundaka" devuelve "Sukarrieta" (dato real de Nominatim, el
rompeolas cae en ese término municipal) — si se usa alguna vez para
sugerir nombre a una ubicación personalizada justo ahí, puede
sorprender a quien conozca el sitio por su nombre de surf. Todos los
datos de prueba (2 salidas, 3 capturas, 1 grupo, 1 invitación, 2
membresías) borrados y verificados a 0. Informe completo en
/tmp/experiencia-informe.txt.

---

## Robot de patrones de uso

### 2026-09-17

Primera pasada real de esta rutina semanal (nueva, ver `CLAUDE.md`).
Leído por REST con `SUPABASE_SERVICE_ROLE_KEY` (solo lectura): `eventos_uso`
(0 filas), `capturas` (0 filas), `salidas_pesca` (1 fila), `spots_favoritos`
(1 fila), `spots_usuario` (1 fila), `perfiles` (7 filas totales).

**`eventos_uso` está a 0 filas — no es un fallo, es prematuro.** La tabla
y la instrumentación se añadieron hoy mismo (2026-09-17, mismo día de esta
pasada), así que no ha dado tiempo a acumular ningún evento real todavía.
Verificado por código (grep) que las 9 llamadas a `registrarEvento()`
documentadas en `CLAUDE.md` existen de verdad y donde dicen: `ver_mapa`,
`ver_capa_batimetria/estaciones/rios/boyas/radar_lluvia`,
`crear_ubicacion_personalizada`, `marcar_favorito` en `index.html`;
`crear_salida`, `crear_captura` en `diario.html`; `pulsar_sos` en
`alarma.html`; `crear_grupo`, `unirse_grupo` en `grupos.html`;
`ver_suscripcion`, `iniciar_checkout` en `suscripcion.html` — el
helper hace `insert` a `eventos_uso` con `try/catch` mudo, nunca bloquea
la interacción. En `index.html`, el primer intento de `ver_mapa` ocurre
antes de que `window.usuarioIdActual` esté listo (script clásico se
ejecuta antes que el `<script type="module">` de login-guard), pero hay
un respaldo correcto: queda un listener de `supabase-listo` (evento que
el módulo sí dispara tras fijar `usuarioIdActual`) que vuelve a intentarlo
— no parece un bug, solo no se puede confirmar en producción de verdad
hasta que haya tráfico real que lo dispare. **No se puede confirmar
todavía, con datos, que la recogida funciona de extremo a extremo en
producción** — solo que el código está bien enganchado. Revisar esto en
la pasada de la semana que viene (2026-09-24), cuando ya haya ~1 semana
de tráfico real acumulado.

**El resto de tablas también tiene muestra mínima**: de los 7 perfiles
dados de alta, solo 1 (`85447dec...`, el más antiguo, dado de alta
2026-09-09) tiene alguna fila real en `salidas_pesca`/`spots_favoritos`/
`spots_usuario` (una de cada, las tres del mismo usuario); los otros 6
perfiles (dados de alta entre 2026-09-13 y 2026-09-16, todos con menos
de 7 días de antigüedad todavía) no tienen ninguna fila en ninguna de
esas tablas ni en `capturas`. **No interpreto esto como abandono real**:
`CLAUDE.md` ya documenta varias cuentas de prueba conocidas
(`fishnowtest1`/`fishnowtest2`/`fishnowavisotest`, más la cuenta admin)
que encajan en ese rango de fechas y count — con el alcance de lectura
de esta pasada (`perfiles` solo expone `id`/`creado_en`/`aprobado`, sin
email) no puedo distinguir cuentas de prueba de altas reales, así que
etiquetar a esos 6 perfiles como "usuarios que probaron la app y la
dejaron" sería inventar un patrón que la muestra no respalda.

**Sin propuestas de rediseño/eliminación de producto esta pasada** —
con 0 eventos de uso y 1 sola fila de actividad real de producto (fuera
de las tablas de perfil/cuenta), no hay ninguna base numérica real
todavía para decidir qué función usa la gente o no. Cualquier propuesta
ahora sería una intuición disfrazada de dato, justo lo que esta rutina
existe para evitar. Confirmado en cambio que la instrumentación en
código está donde `CLAUDE.md` dice que está.

**Qué no dio tiempo a mirar esta pasada**: no se comprobó
`admin_resumen_eventos_uso()`/`admin_eventos_uso_usuario()` en sí (esta
rutina no puede llamarlas, ver `CLAUDE.md` — usan `auth.email()`, no
disponible con un token de `service_role`); no se leyó `detalle` (jsonb)
de ningún evento porque no hay ninguno; no se comparó actividad por
`spot`/tipo de salida en `salidas_pesca` más allá de la única fila
existente, por ser una muestra de 1.

**Firmado:** robot de patrones de uso, 2026-09-17 (pasada semanal,
sábado UTC).

### 2026-09-19 13:07 UTC

Pasada de seguimiento (no exactamente semanal — solo 2 días desde la
anterior, pero se cumple el pedido explícito del usuario de comprobar
esta métrica en cuanto hubiera datos reales). Leído por REST con
`SUPABASE_SERVICE_ROLE_KEY` (solo lectura): `eventos_uso` (70 filas,
antes 0), `capturas` (0 filas, igual que antes), `salidas_pesca` (1
fila, misma que la semana pasada), `spots_favoritos` (1 fila, igual),
`spots_usuario` (1 fila, igual), `grupos` (4 filas), `miembros_grupo`
(2 filas, ambas del mismo grupo), `perfiles` (7 filas totales, igual).

**Primera confirmación real de que `eventos_uso` funciona de extremo a
extremo en producción** (la semana pasada no se pudo confirmar, estaba a
0 filas). Las 70 filas van de 2026-09-17 17:29 UTC a 2026-09-19 12:55
UTC. Desglose por tipo (total / usuarios distintos / último uso):
`ver_mapa` 41/2/19-09 12:55, `ver_capa_rios` 9/2/18-09 17:37,
`ver_capa_boyas` 6/2/19-09 07:45, `ver_capa_estaciones` 6/2/18-09 17:38,
`ver_capa_radar_lluvia` 6/2/18-09 17:38, `ver_capa_batimetria` 1/1/18-09
17:37, `unirse_grupo` 1/1/18-09 17:39. Cero filas todavía de
`crear_salida`, `crear_captura`, `pulsar_sos`, `crear_ubicacion_personalizada`,
`marcar_favorito`, `ver_suscripcion`, `iniciar_checkout`, `crear_grupo`.
Verificado por código (grep en `index.html`/`grupos.html`) que las
llamadas a `ver_mapa`, las 5 capas y `unirse_grupo` nunca pasan un
segundo argumento `detalle` — por eso las 70 filas tienen `detalle: null`,
no es un fallo de la instrumentación, es lo esperado para esos tipos
concretos. El único evento de tipo con estado ligado a otra tabla
(`unirse_grupo`) coincide exactamente con los datos reales: el grupo
`3633549d...` tiene 2 miembros (`85447dec...` y `2a0e7aaa...`), y esos
son justo los 2 `user_id` que aparecen en `eventos_uso` — la
instrumentación registra lo que de verdad ocurrió, no un dato inventado
ni duplicado.

**Pero la muestra sigue siendo demasiado pequeña para proponer ningún
cambio de producto.** De los 7 perfiles totales, solo 2 (`85447dec...`,
dado de alta 2026-09-09, y `2a0e7aaa...`, dado de alta 2026-09-13) han
generado algún evento — los mismos 2 que ya tenían actividad real en
otras tablas la semana pasada. Los otros 5 perfiles (`bb401ba6...`,
`13809555...`, `2cd60e7e...`, `f81a8b12...`, `e4865583...`, entre 2 y 6
días de antigüedad) siguen sin ninguna fila en `eventos_uso` ni en
`capturas`/`salidas_pesca`/`spots_favoritos` — igual que la semana
pasada, y coherente con que `CLAUDE.md` ya documenta varias de esas
fechas como cuentas de prueba conocidas (no leí email en esta pasada,
solo `id`/`creado_en`/`aprobado`, así que no puedo confirmarlo con
certeza, solo descartar que sea una señal de abandono real nueva).
`salidas_pesca`/`spots_favoritos`/`spots_usuario` no han cambiado de
número desde la semana pasada.

**Sin propuestas de rediseño/eliminación de producto esta pasada,
otra vez.** Con solo 2 usuarios distintos generando actividad de los 7
perfiles totales, cualquier ranking de "capa más/menos usada" (p.ej.
`ver_capa_batimetria` con 1 uso de 1 usuario frente a `ver_capa_rios`
con 9 usos de 2 usuarios) reflejaría el comportamiento de una sola
persona probando la app a fondo, no un patrón real de la base de
usuarios — proponer quitar o simplificar algo con este tamaño de
muestra sería la misma intuición disfrazada de dato que esta rutina
existe para evitar. Recomendación: repetir esta lectura cuando haya más
usuarios activos y/o pase más tiempo (la semana que viene, 2026-09-26,
sería ya una semana completa de instrumentación real) antes de esperar
ningún hallazgo con base numérica suficiente.

**Qué no dio tiempo a mirar esta pasada**: `admin_resumen_eventos_uso()`/
`admin_eventos_uso_usuario()` (esta rutina sigue sin poder llamarlas, ver
`CLAUDE.md` — usan `auth.email()`, no disponible con `service_role`); el
campo `detalle` (jsonb) en sí, porque las únicas filas con algo que leer
ahí serían de tipos que todavía no han ocurrido ni una vez
(`crear_salida`/`crear_captura`/etc.); comparación de actividad por
`spot`/tipo de salida en `salidas_pesca`, sigue en una sola fila.

**Firmado:** robot de patrones de uso, 2026-09-19 13:07 UTC (pasada de
seguimiento).

### 2026-09-18 07:40 UTC (pasada buscadora — webcams para spots sin cámara)

**Objetivo:** tarea recurrente de buscar cámaras nuevas para spots fijos
sin cámara (o `spots_usuario` populares — sigue sin poder priorizarse por
esto último, esta sesión no tiene credenciales de Supabase accesibles,
mismo límite ya documentado en pasadas anteriores). Huecos vigentes tras
la pasada de 2026-09-17: Plentzia, Ondarroa, Zumaia, Getaria (Euskadi);
A Guarda, Sanxenxo (Galicia, ya descartados — MeteoGalicia no tiene
cámara de ninguno); Llanes, Ribadesella, Santander (pista real pendiente
de verificar); el resto de Cataluña/Murcia/Andalucía/Canarias/Baleares
fuera de lo ya integrado, y Portugal entero.

**✅ Encontrada e integrada — Getaria (playa de Malkorbe), mismo proveedor
AZTI/detectia.net ya usado para Sopelana/Lekeitio/Getxo/Pasaia.**
Probando por fuerza bruta variantes del esquema de nombre de este
proveedor contra los huecos vascos, `webcam-malkorbe-azti.webp` respondió
`200` — descargada y comprobada de verdad: WebP VP8 real, 1600×1200,
~54 KB, `Last-Modified` de ayer por la tarde (no un placeholder estático).
Inspeccionada visualmente la imagen descargada: se ve con claridad el
"Ratón de Getaria" (el promontorio característico del pueblo) al fondo,
así que confirma sin duda que es la cámara de Getaria y no otro spot con
nombre parecido. El slug del proveedor es el de la playa (`malkorbe`), no
el del pueblo (`getaria`) — por eso no había aparecido en los intentos de
pasadas anteriores, que probaron solo `getaria`/`getaria-azti`. Bajo
riesgo, mismo patrón ya integrado varias veces (mismo proveedor, mismo
proxy `/webcam/<slug>` existente) — añadida directamente: `getaria` en
`functions/webcam/[slug].js` (`WEBCAMS`) y en `SPOTS_CON_WEBCAM`
(`index.html`). Verificado con `node --check` antes de commitear.

**Sigue sin encontrarse fuente para Plentzia, Ondarroa ni Zumaia** con
este mismo proveedor (probadas ~10 variantes de nombre entre esta pasada
y las anteriores, todas `404`) ni con ningún otro ya descartado en
pasadas previas.

**Santander/Cantabria sigue sin poder verificarse desde este runner**:
`cantabria.es` da timeout de conexión (`000`) de nuevo, mismo síntoma que
todas las pasadas anteriores desde el 2026-09-13 — se sigue tratando como
límite de red de este entorno, no como fuente rota (el resto de la web sí
responde bien desde este mismo runner, incluido `detectia.net`).
Llanes/Ribadesella (pista `rtsp.me` sin URL de stream verificable, ver
pasada 2026-09-17) no se ha retomado esta pasada — sigue pendiente de
inspección de red real desde navegador, fuera del alcance de esta sesión.

**Resultado neto:** 1 webcam nueva verificada e integrada (Getaria).
Ninguna otra novedad esta pasada.

**Fuentes:**
[detectia.net — webcam-malkorbe-azti.webp](https://detectia.net/img/webcam-malkorbe-azti.webp).

**Firmado:** robot buscador de fuentes (pasada de webcams para spots sin
cámara), 2026-09-18 07:40 UTC.

---

### 2026-09-18 14:20 UTC (pasada buscadora — corrientes marinas por zona, quinta pasada)

**Qué se buscó:** continuación de las cuatro pasadas previas de corrientes
(2026-09-14 19:37, 2026-09-15 13:31, 2026-09-15 18:35 y 2026-09-17 18:41,
más arriba). La última dejó pendiente ampliar la calibración radar HF vs.
Open-Meteo a "varias zonas/horas/días" antes de poder decidir nada — solo
había 3 puntos, un único día, una única zona (EUSKOOS/Mundaka).

**Salud de las 6 zonas, verificada de nuevo hoy:** las 6 (EUSKOOS,
Galicia, Lisboa, Gibraltar, Ibiza, PLOCAN) siguen vivas con
`time_coverage_end` de hoy mismo (`2026-09-18`, entre las 08:00Z de
EUSKOOS y las 16:00Z de Lisboa/Ibiza/PLOCAN/South) — se confirma que la
reanudación de EUSKOOS encontrada el 2026-09-17 no fue algo puntual de un
día, sigue viva hoy también.

**Calibración ampliada — 6 puntos nuevos, 2 zonas, 2 días (frente al 1
zona/1 día de la pasada anterior):**
- **Mundaka/EUSKOOS, segundo día** (03:00, 05:00, 08:00 UTC de hoy,
  mismo punto ya usado el 2026-09-17): dirección real del radar rota
  otra vez a lo largo del día (201°→7°→69°), con horas y velocidades
  distintas al día anterior — refuerza que es variación real (marea),
  no ruido de un único día suelto.
- **Galicia, primera zona nueva calibrada** (03:00, 09:00, 12:00 UTC):
  el punto real más cercano a un spot de Costaviva con cobertura de
  radar (A Guarda, 41.900, −8.867) está a **~46 km mar adentro**
  (41.921467, −9.502433) — comprobado en vivo que ni la ría de Vigo ni
  la franja pegada a la costa de A Guarda tienen NINGUNA celda con dato
  real (todo `null`), el radar de Galicia solo cubre mar abierto. Es un
  hallazgo en sí mismo: si se integrara esto, no sería "corriente real
  en el spot", sería "corriente real a decenas de km del spot".

**Resultado de las 6 comparaciones (radar real vs. Open-Meteo, mismo
punto/hora exactos):** la diferencia de dirección nunca baja de 60° en
ningún punto de los 6 (rango 60°–165°), y la velocidad tampoco converge
a un factor estable — en Galicia el radar sale sistemáticamente más
bajo que Open-Meteo (0.28 vs 0.6, 0.69 vs 1.3, 0.44 vs 1.2 m/s, roughly
2-3x), pero en Mundaka la relación se invierte según la hora (unas veces
el radar es más alto, otras más bajo). **Con 9 puntos totales ya
acumulados (3+6) en 2 zonas y 2 días, la conclusión provisional de la
pasada anterior se sostiene y se refuerza**: no hay ningún factor de
corrección único que tenga sentido proponer — el patrón real es que
Open-Meteo no captura bien el componente de marea de la corriente
costera, así que la única integración honesta seguiría siendo "mostrar
el dato del radar como observación real, aparte del modelo", nunca
mezclarlos con un factor.

**Hallazgo metodológico nuevo, importante para cualquier integración
futura — los flags de calidad del propio dataset SÍ marcan datos malos,
y hay que mirar los dos campos, no uno solo:** al pedir `QCflag` y
`CSPD_QC` junto a `EWCT`/`NSCT` por primera vez en esta serie de
pasadas, se encontraron 2 puntos claramente erróneos que un uso ingenuo
del dato (solo `EWCT`/`NSCT`, como han hecho las 4 pasadas anteriores)
habría colado sin más: Mundaka 06:00Z de hoy dio una "corriente" de
**2.6 m/s** (imposible para esta zona, muy por encima de cualquier otro
punto medido) con `QCflag=4` y `CSPD_QC=4` (ambos "malo"); Galicia
06:00Z dio un valor con `QCflag=4` también. Los dos se descartaron de la
calibración de arriba. **Además, encontrado un caso donde los dos flags
NO coinciden** (Mundaka 00:00Z de hoy: `QCflag=4` pero `CSPD_QC=1`) —
confirma que hay que comprobar ambos campos antes de confiar en una
celda, no basta con uno. Ninguna de las 4 pasadas anteriores de
corrientes había usado estos campos de calidad — quedaba implícito en
la documentación del dataset pero no se había comprobado en la práctica
hasta ahora.

**Búsqueda complementaria, sin verificar todavía:** `WebSearch` confirma
que la misma red europea de radar HF (EuroGOOS European HFR Node) se
redistribuye también a través de **Copernicus Marine Service**
(`INSITU_GLO_PHY_UV_DISCRETE_NRT_013_048` y productos hermanos), "con
flags de calidad y metadatos" según su propia descripción — podría ser
una vía alternativa a EMODnet ERDDAP, potencialmente más oficial/
estable. **No verificado con ninguna petición real esta pasada**
(Copernicus Marine normalmente exige cuenta/token, a diferencia del
ERDDAP anónimo de EMODnet que ya funciona) — queda como pista para una
futura pasada, no como fuente confirmada.

**Por qué solo propuesta, no implementación** (misma razón que las 4
pasadas anteriores, ver `ROBOT_REGLAS.md`): sigue tocando
`functions/prevision.js` por encima del límite de volumen y siendo una
decisión de producto. El hallazgo de hoy (diferencia de dirección
siempre grande, sin factor estable, y cobertura real solo mar adentro
en Galicia) más bien debilita el caso de "mezclar" nada — si se retoma,
apunta más a mostrar el radar como un dato de observación aparte,
opcional, solo donde hay cobertura real, nunca como sustituto ni
corrección del modelo. No se ha tocado código.

**6 filas nuevas en `CALIBRACION.jsonl`** (`tipo:
"corriente_radar_hf_vs_openmeteo"`), sumando 9 en total para este tipo.

**Fuentes:**
[EMODnet Physics ERDDAP — EUSKOOS NRT](https://erddap.emodnet-physics.eu/erddap/info/EUHFR_NRTcurrent_HFR-EUSKOOS-Total/index.html),
[EMODnet Physics ERDDAP — Galicia NRT](https://erddap.emodnet-physics.eu/erddap/info/EUHFR_NRTcurrent_HFR-Galicia-Total/index.html),
[Copernicus Marine Service — Global Ocean in-situ NRT currents (pista sin verificar)](https://data.marine.copernicus.eu/product/INSITU_GLO_PHY_UV_DISCRETE_NRT_013_048/description).

**Firmado:** robot buscador de fuentes (pasada de corrientes marinas),
2026-09-18 14:20 UTC.

---

### 2026-09-18 22:54 UTC (pasada buscadora — presión atmosférica e histórico por zona, quinta pasada)

**Qué se buscó y por qué:** las cuatro pasadas previas de este tema
(2026-09-14 23:31, 2026-09-15 13:33, 2026-09-15 23:12 y 2026-09-17 23:10,
más arriba) ya dejaron cerrados con verificación real: reanálisis ERA5/
historical-forecast de Open-Meteo, observación horaria AEMET (España,
`ESTACIONES_AEMET` en producción) e IPMA (Portugal, verificado pero sin
integrar), histórico bulk NOAA NCEI/ISD, y la "serie larga" de IPMA
(solo Lisboa tiene presión). La pasada del 2026-09-17 concluyó que "no
queda ninguna pregunta pendiente sin al menos un intento real de
verificación". Esta pasada fue a buscar ángulos genuinamente nuevos en
vez de repetir lo ya cerrado: (1) un posible API/histórico programático
de Puertos del Estado más allá del formulario `bancodatos.puertos.es`
(descartado dos veces por no API), y (2) mirrors/portales alternativos de
AEMET/IPMA no revisados todavía.

**Nota de entorno:** red de salida abierta a dominios de datos en este
runner, igual que las pasadas anteriores — todo lo de abajo verificado
con peticiones HTTP reales, no solo `WebSearch`. `AEMET_API_KEY` sigue
sin estar disponible aquí (solo vive en Cloudflare Pages).

**Hallazgo nuevo, verificado en vivo — Puertos del Estado SÍ tiene un
servidor THREDDS/OpenDAP público (`opendap.puertos.es`), pero resulta
NO servir presión atmosférica observada.** Encontrado vía un artículo de
JERICO-RI (infraestructura europea de investigación oceanográfica) sobre
"Portuscopia" (`portuscopia.puertos.es`), la capa de descarga masiva que
complementa a PORTUS — más amigable que el THREDDS crudo, con descargas
recurrentes por script. Verificado en vivo el propio THREDDS
(`http://opendap.puertos.es/thredds/catalog/catalog.html`, `200` tras
seguir la redirección desde `catalog.html`): es un catálogo público sin
login, con ~200 entradas organizadas por categoría
(`wave_local_<código>` tipo a01/a02/.../a23 — probablemente los mismos
códigos internos que las boyas de aguas profundas ya usadas en `BOYAS`—,
`circulation_local/coastal/regional`, `radar_local`,
`atmosphere_regional_harmonie25`, `atmosphere_local_safeport`,
`tidegauge_*`, `nivmar_large`, `sat_large`). Inspeccionado el fichero
NetCDF de una boya real vía OPeNDAP (`.das` de
`wave_local_a01/HOURLY/HW-2026092100-B2026091800-FC.nc`): la única
variable es `VHM0` (altura significativa de ola) — es un **producto de
modelo de oleaje** (hindcast/forecast, prefijo "HW"), no una serie de
sensor real con presión. Las dos carpetas con "atmosphere" en el nombre
tampoco sirven para esto: `atmosphere_regional_harmonie25` es salida del
modelo numérico Harmonie (predicción, no observación) y
`atmosphere_local_safeport` es un proyecto de escala muy local (6 puntos
en la bahía de Algeciras/Tarifa, proyecto "SAFEPORT") — ninguno cubre la
costa general de España/Portugal ni es dato observado de estación.
**Conclusión verificada**: Portuscopia/THREDDS es una vía real y
programática (sin necesidad del formulario de `bancodatos.puertos.es`,
que sigue siendo la única vía para lo que sí interesaría, dato
observado real de presión de boya/REDEXT), pero para PRESIÓN
específicamente no aporta nada nuevo — sigue sin haber una API abierta
de Puertos del Estado para su histórico observado. Sí es un hallazgo
útil para la idea aparcada de "mar de fondo" (`ROBOT_REGLAS.md`,
sección dedicada): estos ficheros de hindcast de oleaje por boya
(a01-a23, con histórico) podrían servir para calibrar esa propagación
sin depender solo de la lectura en vivo de `poem.puertos.es` — anotado
ahí como pista, no día de hoy.

**Segundo hallazgo, mirror no oficial de AEMET (`datosclima.es`) —
existe pero no es una vía recomendable para integrar.** `WebSearch`
encontró `datosclima.es/Aemethistorico/Descargahistorico.html`,
un sitio de terceros (no gubernamental) que republica series de AEMET
desde 1920 sin necesitar `AEMET_API_KEY`, incluida presión por estación.
No se ha verificado con una petición HTTP real porque, aunque sea
técnicamente accesible, tiene dos problemas que lo descartan como fuente
para Costaviva: (a) es un mirror no oficial sin garantía de
mantenimiento ni de fidelidad a los datos originales de AEMET (a
diferencia de OpenData, que es la fuente primaria), y (b) su propia
descripción dice que la descarga completa por estación requiere pedirla
por email a una dirección personal (`historicoexcel@yahoo.com`) — no es
automatizable ni fiable para un cron. Se descarta como candidato; queda
anotado solo para no repetir la búsqueda si alguien lo sugiere de nuevo.

**Tercer intento, IPMA `dataclima.ipma.pt` ("Monitorização
climática")** — nueva URL que no había aparecido en las 4 pasadas
anteriores (esas cubrieron `obs.superficie` horario y `series.longas`).
Bloqueada con `403 Forbidden` tanto con `WebFetch` como con `curl` con
User-Agent de navegador real — no se pudo verificar su contenido ni
confirmar si expone presión diaria por estación más allá de lo ya
conocido. Queda como hueco sin cerrar (a diferencia del resto de esta
pasada, aquí no hubo ni intento exitoso), no descartada ni confirmada.

**Balance:** ningún hallazgo cambia la conclusión ya asentada en las 4
pasadas anteriores — la vía con más profundidad para backfill sigue
siendo NOAA NCEI/ISD + archivo ERA5 de Open-Meteo, y AEMET/IPMA (ya
integrados en tiempo real) seguirían siendo la vía de observación cuando
se retome. Ningún cambio de código esta pasada — sigue tocando
`functions/`/`supabase/` y siendo decisión de producto (ver
`ROBOT_REGLAS.md`). Dada la profundidad ya alcanzada en 5 pasadas sobre
el mismo tema sin encontrar nada que cambie la propuesta, sugiero al
usuario espaciar esta responsabilidad concreta (no las otras 3 de datos
en tiempo real) hasta que exista una razón nueva para retomarla — por
ejemplo la clave de AEMET, o una respuesta de `dataclima.ipma.pt`.

**Fuentes:**
[JERICO-RI — Thredds/OpenDAP y Portuscopia de Puertos del Estado](https://www.jerico-ri.eu/2023/12/13/jerico-va-navigating-oceanographic-and-meteorological-data-with-puertos-del-estado-thredds-opendap-service-and-portuscopia/),
[Puertos del Estado — THREDDS Data Server (catálogo público)](http://opendap.puertos.es/thredds/catalog/catalog.html),
[Puertos del Estado — Portuscopia](https://portuscopia.puertos.es/),
[datosclima.es — histórico AEMET (mirror no oficial, descartado)](https://datosclima.es/Aemethistorico/Descargahistorico.html),
[IPMA — Monitorização climática (bloqueado 403, sin verificar)](https://dataclima.ipma.pt/pt/sobre-os-dados/).

**Firmado:** robot buscador de fuentes (pasada de presión atmosférica e
histórico por zona), 2026-09-18 22:54 UTC.

---

### 2026-09-19 17:33 UTC (pasada buscadora — corrientes marinas por zona, sexta pasada)

**Qué se buscó:** continuación de las cinco pasadas previas (2026-09-14
19:37, 2026-09-15 13:31, 2026-09-15 18:35, 2026-09-17 18:41 y 2026-09-18
14:20, más arriba), que ya dejaron una conclusión sólida (no hay factor
de corrección estable entre el radar HF real y Open-Meteo, en 2 zonas —
Cantábrico/EUSKOOS y Atlántico/Galicia) pero solo habían mirado 2 de las
6 redes de radar HF que EMODnet Physics ya tenía identificadas
(EUSKOOS, Galicia, Lisboa, Gibraltar, Ibiza, PLOCAN). Esta pasada partió
de la pista sin verificar que dejó la quinta ("Copernicus Marine Service
redistribuye la misma red, con cuenta/token") para comprobarla de
verdad con peticiones HTTP reales.

**Hallazgo 1 — Copernicus Marine SÍ es accesible sin cuenta ni token,
corrigiendo la suposición de la pasada anterior.** El producto
`INSITU_GLO_PHY_UV_DISCRETE_NRT_013_048` publica su metadato STAC
(`stac.marine.copernicus.eu`) en abierto, y de ahí se llega a un bucket
S3 público (`s3.waw3-1.cloudferro.com/mdl-native-03/...`) que se puede
listar y descargar sin autenticación (verificado con peticiones `GET`
reales, incluido un fichero NetCDF completo de ~1.1 MB). Aun así, **no
aporta nada nuevo sobre EMODnet ERDDAP para este caso de uso concreto**:
mismas variables (`EWCT`/`NSCT`/`QCflag`/`CSPD_QC`, mismo dataset
OceanSITES redistribuido), pero en NetCDF crudo (hay que descargar el
fichero del día entero y parsearlo) en vez del ERDDAP de EMODnet (que
permite pedir un punto/hora concreto por URL) — peor candidato para una
integración real en `functions/prevision.js`, solo útil como mirror de
respaldo si EMODnet cayera.

**Hallazgo 2, más relevante — el propio listado de Copernicus reveló 2
redes de radar HF reales que las 5 pasadas anteriores nunca habían
buscado, porque la búsqueda se centró en las 6 zonas ya conocidas en vez
de mirar el catálogo completo:**
- **ICATMAR** (Generalitat de Catalunya + Institut de Ciències del Mar/
  CSIC): cubre la costa catalana completa (`geospatial_lat` 40.5–43.5,
  `lon` 1.0–4.3), con dato real hasta hoy mismo. Verificado también en
  EMODnet ERDDAP (`EUHFR_NRTcurrent_HFR-ICATMAR-Total`, existía, nunca
  se había buscado por ese nombre).
- **DeltaEbro** (Puertos del Estado — la misma institución que ya
  aporta las boyas de `BOYAS`): cubre el golfo de Sant Jordi/delta del
  Ebro (`lat` 39.6–41.2, `lon` 0.06–2.08), con histórico real desde
  2019-01-01. También confirmado en EMODnet ERDDAP.
- (Se descartó una tercera red vista en el mismo listado, **CALYPSO**:
  cubre el canal Sicilia-Malta, en Italia — fuera del ámbito de España/
  Portugal de Costaviva.)

**Cobertura real comprobada contra spots de Costaviva (con petición
real a ERDDAP, filtrando por `QCflag=1` Y `CSPD_QC=1`, ambos "buenos" —
regla ya aprendida en la pasada del 2026-09-18):**
- **Peñíscola**: celda real a solo **~6.6 km** de la costa — la
  cobertura más cercana a un spot encontrada hasta ahora en las 6
  pasadas de corrientes (mejor que los ~46 km de Galicia).
- **Vinaròs**: celda más cercana con `QCflag=4` (mala) pese a
  `CSPD_QC=1` — mismo caso de discrepancia entre flags ya documentado
  el 2026-09-18, descartada.
- **Cambrils**: celda válida más cercana a ~31 km, y con `QCflag=4`
  igualmente — sin cobertura útil.
- **Blanes**: celda real (ambos flags buenos) a solo **~4.6 km**.
- **Roses**: celda real a ~14 km.

**Calibración real, 8 puntos nuevos (4 en Peñíscola/DeltaEbro, 4 en
Blanes/ICATMAR), primera vez que se prueba el Mediterráneo/Cataluña en
esta serie de pasadas — la conclusión ya asentada en Cantábrico y
Atlántico se confirma también aquí, y con un matiz nuevo:** en
Peñíscola, dirección y velocidad reales del radar no guardan relación
estable con Open-Meteo (diferencias de dirección 22°–86°), igual que en
las pasadas anteriores. En Blanes aparece un patrón distinto y
llamativo: Open-Meteo predice una corriente **fuerte y casi constante
durante todo el día** (0.8–0.9 m/s, 27°–56°, apenas varía en 24h) que el
radar real **no confirma en ningún momento** (0.04–0.65 m/s, con la
dirección llegando a invertirse por completo entre horas) — un caso más
extremo que los ya vistos, con el modelo sobreestimando la velocidad
real varias veces seguidas, no solo puntualmente.

**Conclusión, igual que las 5 pasadas anteriores — solo propuesta, no
cambio de código** (sigue tocando `functions/prevision.js` y siendo
decisión de producto, ver `ROBOT_REGLAS.md`): con ya **17 puntos de
calibración en 4 zonas distintas** (EUSKOOS, Galicia, DeltaEbro,
ICATMAR) y ningún factor de corrección estable en ninguna, la propuesta
sigue siendo la misma — si se integra, mostrar el radar como dato de
observación real aparte (con su propia etiqueta de fuente/distancia al
spot), nunca como sustituto ni corrección del modelo de Open-Meteo. El
hallazgo nuevo de hoy (ICATMAR/DeltaEbro con coberturas de 4.6-6.6 km,
mejores que las ya conocidas) sí mejora el caso concreto de "para qué
spots merecería la pena mostrarlo primero" si el usuario decide
retomarlo: Peñíscola y Blanes serían los primeros candidatos por
cercanía real de la celda.

**Salud general, comprobada de nuevo:** EUSKOOS sigue viva pero con el
último dato de ayer (`time_coverage_end` 2026-09-18T08:00Z, no de hoy)
— dentro del patrón de huecos ya conocido para esta red concreta, no es
una caída nueva que investigar aparte.

**Fuentes:**
[Copernicus Marine — INSITU_GLO_PHY_UV_DISCRETE_NRT_013_048 (STAC, acceso anónimo confirmado)](https://stac.marine.copernicus.eu/metadata/INSITU_GLO_PHY_UV_DISCRETE_NRT_013_048/product.stac.json),
[EMODnet Physics ERDDAP — ICATMAR](https://erddap.emodnet-physics.eu/erddap/info/EUHFR_NRTcurrent_HFR-ICATMAR-Total/index.html),
[EMODnet Physics ERDDAP — DeltaEbro](https://erddap.emodnet-physics.eu/erddap/info/EUHFR_NRTcurrent_HFR-DeltaEbro-Total/index.html).

**Firmado:** robot buscador de fuentes (pasada de corrientes marinas),
2026-09-19 17:33 UTC.

---

### 2026-09-19 22:35 UTC (pasada buscadora — presión atmosférica e histórico por zona, sexta pasada)

**Contexto:** las 5 pasadas previas de este tema (2026-09-14 23:31,
2026-09-15 13:33, 2026-09-15 23:12, 2026-09-17 23:10 y 2026-09-18 22:54,
más arriba) dejaron todas las vías obvias cerradas (AEMET/IPMA en tiempo
real, ERA5/archive de Open-Meteo, NOAA NCEI/ISD, Puertos del Estado sin
API) y la última pasada recomendó espaciar este tema hasta que hubiera
una razón nueva (la `AEMET_API_KEY`, o que `dataclima.ipma.pt` dejara de
dar 403). Comprobado de nuevo: `dataclima.ipma.pt` sigue dando **403**
con `curl`/User-Agent real (sin cambios). Esta pasada buscó en dos
direcciones nuevas, no cubiertas en ninguna de las 5 anteriores.

**Hallazgo real y verificado — MeteoGalicia tiene API pública con datos
diarios/históricos, pero sin confirmar si incluye presión ni cobertura
costera** (no se profundizó más por el hallazgo más relevante de abajo,
que sí llegó hasta el dato real): existe un servicio JSON documentado
(`JSON_EstacionsDiarios_es.pdf`, descargado y accesible sin clave) con
resoluciones `instant`/`current_day`/`daily`/`monthly`. Queda como pista
sin verificar del todo — pendiente de una petición real a su endpoint
JSON con una estación costera concreta antes de dar nada por bueno.

**Hallazgo principal, verificado en real con datos reales descargados —
Euskalmet SÍ publica presión atmosférica costera histórica de forma
completamente abierta, sin la `EUSKALMET_API_KEY` que lleva bloqueada
desde el 2026-09-14 (registro nunca llegó por email, ver `CLAUDE.md`).**
Es una vía totalmente distinta de la API REST de Euskalmet (que sí
exige esa clave): el portal de datasets `opendata.euskadi.eus` (parte
de Open Data Euskadi, ya usado en este repo para
`especies_comunidad`/investigación de fauna, nunca antes para
meteorología) publica un catálogo "Estaciones meteorológicas: lecturas
recogidas en <año>" con un ZIP anual descargable sin login ni clave:

- `https://opendata.euskadi.eus/contenidos/ds_meteorologicos/met_stations_ds_2026/opendata/2026.zip`
  (~100 MB, verificado con descarga real completa) y el mismo patrón
  para 2025 (`met_stations_ds_2025/opendata/2025.zip`, ~148 MB,
  confirmado con `HEAD` real) — multi-año, sirve para backfill.
- Contiene un ZIP por estación y año (`<código>_2026.zip`), y dentro un
  XML por mes con lecturas cada **10 minutos**.
- El listado maestro de estaciones (con coordenadas, sin necesitar
  clave tampoco) está en
  `https://opendata.euskadi.eus/contenidos/ds_meteorologicos/estaciones_meteorologicas/opendata/estaciones.json`
  — 153 estaciones, con un tipo `"B"` (8 estaciones) que son
  específicamente **puertos/boyas costeras**: Bilbao (Punta Lucero,
  Santurtzi), Armintza, Bermeo, Ondarroa, Getaria, Pasaia, Hondarribia y
  Mutriku — coinciden con spots reales de `SPOTS`.
- **Verificado descargando y abriendo el XML real de Bilbao (B090,
  agosto 2026)**: cada lectura de 10 minutos trae
  `Presion._a_2200cm` (presión real en hPa, ej. 1017.6) además de
  `Tem.Aire`, `Humedad`, `Precip.`, `Vel.Med`/`Vel.Max`/`Dir.Med`
  (viento) — y, como extra no buscado pero relevante para otra parte de
  la app, también **oleaje real de boya** (`OlaSig`/`OlaMax`/`OlaPer`,
  altura significativa/máxima y periodo) y **temperatura del agua**
  (`Tp._a_0cm`). Mismo formato confirmado en Pasaia (B096).

**Limitación real encontrada, no ocultarla**: de las 8 estaciones tipo
`"B"`, el ZIP de 2026 **solo incluye 2 con datos** (Bilbao/B090 y
Pasaia/B096) — Armintza, Bermeo, Ondarroa, Getaria, Hondarribia y
Mutriku no aparecen en el archivo de este año, no se ha investigado
todavía si es porque dejaron de reportar, nunca llegaron a tener sensor
de presión, o el "thin"/otro año las incluye. No dar las 8 por
disponibles sin comprobar caso por caso.

**Por qué esto es relevante de verdad, más allá de "una fuente más"**:
esto no depende de que llegue el email de alta de Euskalmet (bloqueado
desde hace 5 días, ver `CLAUDE.md`) — es un canal completamente
distinto del mismo organismo (Gobierno Vasco), ya accesible hoy. Con
solo 2 estaciones cubiertas no sustituye a AEMET (que ya cubre
observación horaria en producción), pero sí sirve para lo que ninguna
otra fuente había resuelto en las 5 pasadas anteriores: **backfill
histórico real de presión** (no solo tiempo real) para 2 puntos
concretos de la costa de Bizkaia/Gipuzkoa, multi-año, con periodicidad
de 10 minutos (más fina que la horaria de AEMET).

**No aplicado a código esta pasada** (sigue siendo decisión de producto
y tocaría `functions/`, ver `ROBOT_REGLAS.md`) — **propuesta**: si el
usuario quiere retomar el backfill de `presion_historico` (aparcado
desde la primera pasada de este tema, 2026-09-14), este ZIP anual de
Bilbao/Pasaia es la fuente más prometedora encontrada hasta ahora para
ese objetivo concreto en esas 2 ubicaciones — requeriría un script de
importación puntual (no un cron, es un histórico ya cerrado por año),
descargar el ZIP, parsear el XML mensual y volcar `Presion._a_2200cm`
con su timestamp real. Antes de implementarlo: confirmar por qué las
otras 6 estaciones tipo B no están en el archivo de este año (puede
cambiar qué años/estaciones merece la pena importar) y decidir si
también interesa aprovechar el oleaje/temperatura del agua reales de
paso, ya que vienen en el mismo fichero sin coste adicional.

**Pendiente para la próxima pasada de este tema**: verificar el
endpoint JSON de MeteoGalicia con una petición real (estación costera
gallega concreta) para saber si aporta presión y si hace falta clave;
y comprobar si las 6 estaciones tipo B que faltan en el ZIP de 2026
aparecen en años anteriores (2024, 2023...) o en el fichero "thin".

**Fuentes:**
[Open Data Euskadi — catálogo "Estaciones meteorológicas: lecturas recogidas en 2026"](https://opendata.euskadi.eus/catalogo/-/estaciones-meteorologicas-lecturas-recogidas-en-2026/),
[Open Data Euskadi — listado de estaciones (JSON, sin clave)](https://opendata.euskadi.eus/contenidos/ds_meteorologicos/estaciones_meteorologicas/opendata/estaciones.json),
[MeteoGalicia — documentación del servicio JSON de datos diarios](https://www.meteogalicia.gal/datosred/infoweb/meteo/docs/rss/JSON_EstacionsDiarios_es.pdf),
[dataclima.ipma.pt (sigue en 403, sin cambios respecto a la pasada anterior)](https://dataclima.ipma.pt/pt/sobre-os-dados/).

**Firmado:** robot buscador de fuentes (pasada de presión atmosférica e
histórico por zona), 2026-09-19 22:35 UTC.

---

### 2026-09-20 08:01 UTC (pasada buscadora — webcams, ZONA DE HOY: Asturias)

**Objetivo:** primera pasada de la rotación automática por zonas (ver
`ROBOT_REGLAS.md`, "Aprendizaje por zonas") que toca Asturias. Solo hay 2
spots fijos en Asturias (`llanes`, `ribadesella`) y ninguno de los dos
tiene cámara todavía — son las 2 poblaciones investigadas, probando todos
los modificadores de búsqueda activos (`webcam directo`, `webcam surf`,
`webcam ayuntamiento`, `webcam pesca`/`puerto`/`cofradía de pescadores`,
`webcam club náutico`/`puerto deportivo`).

**Sin cámara integrable esta pasada — pero sí un hallazgo real e
importante sobre por qué.** Todo lo encontrado para Llanes y Ribadesella
(puerto, playas, ría, puerto deportivo) termina en el mismo backend,
`rtsp.me`, servido por dos webs espejo (`webcamsdeasturias.com` y
`hispacams.com` — confirmado con los mismos IDs de `rtsp.me` exactos para
la misma cámara, ej. Puerto de Llanes = `rtsp.me/embed/SfETz5yS` en
ambas). A diferencia de AZTI/detectia.net (JPEG directo) o IPCamLive
(HLS/snapshot público), `rtsp.me` exige un token vía su propia API
(`/api/embed/<id>/token/<n>`, visto en el bundle JS del embed) para
poder ver el stream — comprobados varios paths de snapshot típicos
(`snapshot.jpg`, `snap.jpg`, `thumbnail.jpg`, `poster.jpg`, `image.jpg`)
contra 3 IDs distintos, los 5 dan `404`. Mismo tipo de problema ya
documentado con `tendsys.net` en Cantabria (ver "Aprendizaje por zonas"),
pero sin ni siquiera el póster JPEG de reserva que sí tenía tendsys —
haría falta un proxy propio con intercambio de token, desarrollo nuevo,
no una corrección trivial.

**Otras fuentes investigadas y descartadas, todas verificadas con
petición HTTP real:**
- Ayuntamiento de Ribadesella (`ayto-ribadesella.es/en/webcams`): no aloja
  cámara propia, solo enlaza a `webcamsdeasturias.com` — mismo problema
  de arriba.
- Escuela Asturiana de Surf (`escuelaasturianadesurf.com`) tiene páginas
  de webcam para Llanes (playas de San Antolín y Cuevas) pero apuntan a
  `wewebcams.com`, dominio muerto (`cam_embedded.php?id=...` da `404`, la
  raíz del dominio es la página por defecto de Plesk sin sitio real).
- Surfcamp Ribadesella ("Ribacam"): su dominio propio `ribacam.es` no
  resuelve por DNS (`Could not resolve host`); la web del surfcamp
  (`surfcampribadesella.com`) devuelve `403` a peticiones automatizadas —
  no se pudo verificar, pero tampoco se descarta del todo (podría ser
  bloqueo de bot, no necesariamente muerta). Pendiente de reintentar.
- `meteosurfcanarias.com` dice tener webcam "en directo" de Santa Marina
  (Ribadesella) pero la imagen que sirve tiene `Last-Modified: 16 Nov
  2017` — foto estática vieja, no una cámara real. Descartado como
  fuente, y anotado como aviso general: no fiarse de que un agregador
  diga "en directo" sin comprobar la cabecera `Last-Modified` de la
  imagen en sí.
- Búsqueda también por el nombre en asturianu (Ribeseya) sin resultado
  distinto — mismo agregador `webcamsdeasturias.com`, nada nuevo.

**Términos de búsqueda confirmados productivos en esta zona** (aunque no
se pudo integrar nada, sí aparecieron cámaras reales — cuenta para el
protocolo de poda de `ROBOT_REGLAS.md`): `webcam pesca`/`puerto`/
`cofradía de pescadores` (Puerto de Llanes, en colaboración real con la
Cofradía de Pescadores Santa Ana de Llanes) y `webcam club náutico`/
`puerto deportivo` (Puerto deportivo de Ribadesella / Club Náutico Arra).
Recuento actualizado en `ROBOT_REGLAS.md`.

**Pista para la próxima zona (Galicia — Rías Altas), sin investigar
todavía**: apareció `clubnauticoribadeo.com/webcams/` para Ribadeo
(concejo de Lugo, ya en `SPOTS` como `ribadeo`, sin cámara) — un club
náutico con página de webcams propia, no comprobado en esta pasada por
quedar fuera de la zona de hoy.

**Resultado neto:** ninguna cámara nueva integrable. Añadida una regla
nueva en `ROBOT_REGLAS.md` (sección "Aprendizaje por zonas" → Asturias)
sobre el backend único `rtsp.me` de toda la red de webcams de la región,
para que futuras pasadas no repitan la misma investigación desde cero.

**Fuentes:**
[Webcams de Asturias — Puerto de Llanes](https://www.webcamsdeasturias.com/asturias/oriente/llanes/llanes/puerto-de-llanes-hd/39/),
[Hispacams — Puerto de Llanes](https://www.hispacams.com/en/webcams/puerto-de-llanes/),
[Hispacams — Puente y Puerto deportivo de Ribadesella](https://www.hispacams.com/en/webcams/puente-y-puerto-deportivo-de-ribadesella/),
[Ayuntamiento de Ribadesella — Webcams](https://www.ayto-ribadesella.es/en/webcams),
[Escuela Asturiana de Surf — webcam Playa de San Antolín](https://www.escuelaasturianadesurf.com/webcam-llanes-playa-de-san-antolin/),
[Surfcamp Ribadesella — Ribacam](https://www.surfcampribadesella.com/blog/ribacam-la-webcam-de-surfcamp-ribadesella/),
[Club Náutico de Ribadeo — Webcams (pista sin investigar, próxima zona)](https://clubnauticoribadeo.com/webcams/).

**Firmado:** robot buscador de fuentes (pasada de cámaras/webcams, zona
Asturias), 2026-09-20 08:01 UTC.

### 2026-09-20 13:20 UTC (pasada buscadora — mareas y oleaje)

**Calibración — 4 puntos nuevos, incluida la boya obligatoria más
cerca del umbral de 15.** Mismo método de siempre: `curl` real a
`poem.puertos.es/portus/StationData` para la altura medida, Marine API
de Open-Meteo en las coordenadas exactas de cada boya para la
calculada, emparejando por la hora UTC exacta del último dato real:

| boya | hora UTC | altura medida | altura calculada | diferencia | % |
|---|---|---|---|---|---|
| 2136 Bilbao-Vizcaya | 13:00 | 2.11 m | 1.76 m | −0.35 m | −16.6% |
| 1117 Gijón | 12:00 | 1.76 m | 1.54 m | −0.22 m | −12.5% |
| 1101 Pasaia II | 12:00 | 2.06 m | 1.26 m | −0.80 m | −38.8% |
| 1514 Málaga | 12:00 | 0.96 m | 0.98 m | +0.02 m | +2.1% |

Añadidos a `CALIBRACION.jsonl` (`tipo: "boya_vs_openmeteo_mismo_punto"`).
**Pasaia II llega a 14 puntos, LOS 14 con el mismo signo negativo**
(media 14 puntos ≈ **−29.8%**) — solo falta 1 punto más para el mínimo
de 15 que se viene marcando desde hace días como el umbral para
proponer un factor de corrección concreto en esa zona; la siguiente
pasada (buscadora o nocturna) debería ya poder proponerlo si el signo
se mantiene, cosa que ha pasado sin excepción en las 14 muestras
tomadas hasta ahora. Bilbao-Vizcaya (14 puntos) y Gijón (14 puntos)
siguen sin patrón sistemático claro, signo mixto. Málaga (rotación,
candidata con más días sin repetirse desde 2026-09-17) llega a 4
puntos con signo todavía mixto (−38.1%, +12.5%, −40.2%, +2.1%).

**Hallazgo real que resuelve una pista pendiente desde la pasada del
2026-09-18: el endpoint real de lecturas de las boyas Datawell
Waverider del Instituto Hidrográfico de Portugal, confirmado en vivo
con una petición HTTP real.** La pasada del 2026-09-18 encontró el
catálogo de metadatos (`ogcapi.hidrografico.pt`, boyas activas como
Leixões/Sines/Faro con dato reciente) pero no el endpoint para leer el
valor real, y descartó varias variantes de URL por no dar resultado.
Buscando de nuevo con otros términos (`monican.hidrografico.pt`,
`dbn`, `id_est`), apareció una página de ayuda oficial real —
[FAQ del Instituto Hidrográfico — "Serviço de dados: boias Datawell
Waverider"](https://faq.hidrografico.pt/books/hidrografico/page/servico-de-dados-boias-datawell-waverider) —
que documenta dos endpoints reales:
- `https://supportserver1.hidrografico.pt/geodata/buoys/getDatawellData`
  (`startDate`, `endDate`, `stationId`) — altura de ola (Hm0), periodos
  (T02, Tp), dirección y métricas espectrales con indicadores de
  calidad.
- `https://supportserver1.hidrografico.pt/geodata/buoys/getDatawellTemp`
  (mismos parámetros + `qc`) — temperatura del agua.

**Verificado en vivo, sin inventar nada**: una petición real a
`getDatawellData?startDate=...&endDate=...&stationId=19` devuelve
`401 "Invalid API KEY"` — confirma que el endpoint existe de verdad y
está protegido, exactamente como dice la documentación (la propia FAQ
dice que la API key es **gratuita**, mediante petición a
`cedencia.dados@hidrografico.pt`). Serie temporal limitada a 15 días
(mismo aviso textual de la FAQ). Para el mapeo `stationId` → boya real,
`https://webgeo4.hidrografico.pt/geoserver/oceanography/ows?service=WFS&version=2.0.0&request=GetFeature&typeName=oceanography%3Abuoys_datawell&outputFormat=application%2Fjson`
(sin clave, verificado en vivo con `200`) da el catálogo completo con
`id_est` — **id_est 4 = CSA92/D (Leixões)**, **id_est 19 = CSA83/1D
(Sines)**, **id_est 20 = CSA82/D (Faro)**, más BOND1-6 y otras boyas
menores; el ejemplo `stationId=19` de la propia FAQ coincide con un
`id_est` real de este catálogo, lo que sugiere (sin confirmarlo del
todo sin clave) que ambos identificadores son el mismo esquema.

**Propuesta, no implementación** (pedir una clave nueva y tocar
`functions/prevision.js` cae fuera de lo que esta pasada puede aplicar
directo — nueva credencial externa + cambio de código real): pedir a
`cedencia.dados@hidrografico.pt` una API key gratuita para
`datos@costaviva.org` (mismo email ya usado para AEMET/Euskalmet, ver
`CLAUDE.md`), y una vez obtenida, añadir Leixões (`id_est`/`stationId`
4) como boya real cerca de los spots portugueses del norte (Viana do
Castelo, Póvoa de Varzim) — completaría la cobertura portuguesa que
hasta ahora solo tiene la boya de Nazaré. Guardar como
`HIDROGRAFICO_PT_API_KEY` (mismo patrón de secreto que el resto), y
recordar el límite de sub-peticiones de `/prevision` (~10 boyas de
margen, ver `ROBOT_REGLAS.md`) antes de añadir más de una.

**Fuentes:**
[FAQ Instituto Hidrográfico — Serviço de dados: boias Datawell Waverider](https://faq.hidrografico.pt/books/hidrografico/page/servico-de-dados-boias-datawell-waverider),
[Catálogo WFS de boyas Datawell (GeoServer, sin clave)](https://webgeo4.hidrografico.pt/geoserver/oceanography/ows?service=WFS&version=2.0.0&request=GetFeature&typeName=oceanography%3Abuoys_datawell&outputFormat=application%2Fjson),
[poem.puertos.es — StationData (Puertos del Estado, boyas reales)](https://poem.puertos.es/portus/StationData),
[Open-Meteo Marine API](https://marine-api.open-meteo.com/v1/marine).

**Firmado:** robot buscador de fuentes (pasada de mareas y oleaje),
2026-09-20 13:20 UTC.

### 2026-09-20 17:43 UTC (pasada buscadora — corrientes marinas por zona, séptima pasada)

**Qué se buscó:** las 6 pasadas previas ya identificaron 8 redes de
radar HF vivas (EUSKOOS, Galicia, Lisboa, Gibraltar, Ibiza, PLOCAN,
ICATMAR, DeltaEbro) y calibraron 4 contra spots reales, pero
**Gibraltar y PLOCAN solo se habían comprobado como "vivas"
(`time_coverage_end`), nunca su proximidad real a un spot de
Costaviva**. Esta pasada cierra ese hueco con peticiones reales a los
griddap de EMODnet ERDDAP.

**Hallazgo 1, negativo — Golfo de Cádiz sin cobertura útil.** `Gibraltar`
(lat 35.81–36.19, lon −5.85/−4.99) solo cubre el Estrecho — ningún spot
de Costaviva cae dentro (Tarifa solo existe como boya, no como spot).
`South` (lat 36.0–37.19, lon −9.59/−6.21) solapa en el mapa con
Cádiz/Conil/Chipiona/Punta Umbría, pero su cobertura real está frente a
Huelva/Algarve — celda válida más cercana a 91 km (Punta Umbría) y
166 km (Cádiz), y con `QCflag=4` (mala) en ambos casos. Golfo de Cádiz
queda descartado salvo red nueva.

**Hallazgo 2, positivo — mejor cobertura de toda la serie.** `PLOCAN`
tiene una celda con `QCflag=1`/`CSPD_QC=1` (buenos) a solo **2.6 km**
de Las Palmas (Las Canteras) — mejor que Blanes (4.6 km) o Peñíscola
(6.6 km). Los otros 3 spots de Canarias quedan fuera de su rejilla
(95–125 km).

**Calibración real, 4 puntos en Las Palmas** (06/09/12/15h UTC,
`CALIBRACION.jsonl`, `tipo: "corriente_radar_hf_vs_openmeteo"`):
confirma la conclusión ya asentada, sin relación estable con
Open-Meteo — diferencia de dirección 56°–116°; a las 12:00 la
velocidad casi coincidió (0.282 vs 0.3 m/s) pero la dirección no (49°
vs 315°), mismo patrón de "aciertan por separado" ya visto en
Mundaka el 2026-09-17.

**Conclusión — sigue siendo solo propuesta**, no cambio de código
(tocaría `functions/prevision.js`): con **21 puntos en 5 zonas** y sin
factor de corrección estable en ninguna, la recomendación no cambia —
si se integra, mostrar el radar como observación real aparte, nunca
como sustituto del modelo. Las Palmas (2.6 km) pasa a ser el primer
candidato por cercanía de toda la lista. Pendiente para una futura
pasada: comprobar la proximidad real de Lisboa/Ibiza a un spot, igual
que se ha hecho hoy con Gibraltar/PLOCAN.

**Fuentes:**
[EMODnet Physics ERDDAP — Gibraltar](https://erddap.emodnet-physics.eu/erddap/info/EUHFR_NRTcurrent_HFR-Gibraltar-Total/index.html),
[EMODnet Physics ERDDAP — South](https://erddap.emodnet-physics.eu/erddap/info/EUHFR_NRTcurrent_HFR-South-Total/index.html),
[EMODnet Physics ERDDAP — PLOCAN](https://erddap.emodnet-physics.eu/erddap/info/EUHFR_NRTcurrent_HFR-PLOCAN-Total/index.html).

**Firmado:** robot buscador de fuentes (pasada de corrientes marinas),
2026-09-20 17:43 UTC.

---

### 2026-09-20 22:52 UTC (pasada buscadora — presión atmosférica e histórico por zona, séptima pasada)

**Contexto:** seguía dos pendientes explícitos de la pasada anterior
(2026-09-19 22:35, más arriba): (1) verificar con una petición real el
endpoint JSON diario de MeteoGalicia con una estación costera concreta,
y (2) comprobar si las 6 estaciones tipo "B" de Euskalmet que faltaban
en el ZIP de 2026 (Armintza, Bermeo, Ondarroa, Getaria, Hondarribia,
Mutriku) aparecían en años anteriores o en algún fichero "thin". Las
dos quedan resueltas esta pasada, cierran el tema por completo.

**Hallazgo principal, verificado con datos reales — MeteoGalicia SÍ
publica presión diaria observada, real y validada, sin ninguna clave,
para al menos 2 spots reales de Costa Viva.** El PDF oficial
(`JSON_EstacionsDiarios_es.pdf`, descargado y leído esta vez con éxito)
documenta el endpoint:

```
https://servizos.meteogalicia.gal/mgrss/observacion/datosDiariosEstacionsMeteo.action?idEst=<código>&dataIni=dd/MM/yyyy&dataFin=dd/MM/yyyy&idParam=<código>
```

Sin clave, sin login. Cada estación trae, entre otros, los parámetros
`PR_AVG_1.5m` ("Presión", hPa) y `PRED_AVG_1.5m` ("Presión reducida",
hPa) — confirmado en real contra dos estaciones costeras que
corresponden a spots ya existentes de `SPOTS` (`index.html`):
**Coruña-Dique (idEst 14000, junto al spot `acoruna`)** y **Porto de
Vigo (idEst 14001, junto al spot `cies`)**. Petición real de un rango
(`dataIni=15/09/2026&dataFin=19/09/2026`) devolvió presión real y
validada (`lnCodigoValidacion=1`, "dato válido original") día a día,
ej. Coruña-Dique 15-sept 1023.17 hPa / 16-sept 1023.97 hPa. Profundidad
histórica comprobada con varias peticiones puntuales: hay dato real en
junio de 2018, 2020 y 2023, pero **hueco real en junio de 2022**
(`lnCodigoValidacion=9`, "dato no registrado" — sensor caído esa
temporada, no un fallo de la consulta) — no asumir cobertura continua
sin comprobar el rango exacto que se necesite. Antes de 2018 no se
comprobó más atrás (petición a enero de 2015 devolvió lista vacía, sin
investigar en qué fecha exacta empieza la serie).

**Por qué es relevante**: cierra para Galicia el mismo hueco que
Euskalmet cerró para Bizkaia/Gipuzkoa el 2026-09-19 (backfill real de
`presion_historico`, más fino que AEMET en el sentido de venir ya
validado con código de calidad) — y a diferencia de la vía REST de
Euskalmet (bloqueada desde el 2026-09-14 por un alta que nunca llegó
por email, ver `CLAUDE.md`), esta ni siquiera necesita gestionar una
clave. Listado completo de estaciones sin clave en
`https://servizos.meteogalicia.gal/mgrss/observacion/listaEstacionsMeteo.action`
— no se ha revisado todavía si hay más spots de `SPOTS` con una
estación de esta red cerca (solo se comprobaron Coruña y Vigo, las dos
candidatas obvias); pendiente para una futura pasada.

**Segundo hallazgo — resuelto del todo el misterio de las 6 estaciones
tipo "B" de Euskalmet que faltaban en el ZIP anual.** En vez de bajar
los ZIPs completos de 2023/2024/2025 (~150 MB cada uno), se listó su
contenido pidiendo solo los últimos 2 MB del fichero con `curl -r`
(el directorio central de un ZIP vive al final, `unzip -l` no necesita
el resto) — confirmado: **los 3 años (2023, 2024, 2025) solo traen
Bilbao (B090) y Pasaia (B096), igual que 2026**, ninguno de los otros 6.
La causa real (nada que ver con el formato del archivo ni con un
"fichero thin", que no existe como tal) sale de su propio XML de
metadatos (`XMLdatos` de cada estación en
`estaciones.json`), que trae un campo `dateTo` con la fecha real de
baja de cada estación:

| Estación | Código | Dada de baja (`dateTo`) |
|---|---|---|
| Puerto de Armintza | B091 | 01/01/2006 |
| Puerto de Bermeo | B092 | 22/07/2013 |
| Puerto de Ondarroa | B093 | 06/01/2014 |
| Puerto de Getaria | B094 | 06/01/2014 |
| Puerto de Hondarribia | B097 | 07/10/2014 |
| Mutriku | B098 | 01/02/2023 |

Es decir: son estaciones reales que existieron (todas desde 2003,
salvo Mutriku desde 2021) pero **llevan dadas de baja entre 12 y 20
años**, salvo Mutriku (baja mucho más reciente, 2023). Solo Bilbao
(B090) y Pasaia (B096) siguen activas hoy. Para backfill histórico
dentro de su ventana real (ej. Ondarroa 2003-2014), el dato sigue
existiendo en los ZIP de esos años concretos — pero no aporta nada para
tendencia reciente/actual, que es el uso principal que tendría en
`presion_historico`.

**No aplicado a código esta pasada** (sigue tocando `functions/` y
siendo backfill/decisión de producto, ver `ROBOT_REGLAS.md`) —
**propuesta**: si el usuario retoma el backfill de `presion_historico`
aparcado desde el 2026-09-14, ya hay 4 fuentes reales confirmadas para
combinar (Euskalmet ZIP anual para Bilbao/Pasaia, MeteoGalicia JSON sin
clave para A Coruña/Vigo — y potencialmente más spots gallegos, sin
comprobar todavía —, AEMET en producción para el resto de España, IPMA
solo Lisboa) — ninguna cubre el litoral entero, pero entre las cuatro
ya no queda ninguna vía obvia sin explorar. Este tema puede
espaciarse ahora: las 7 pasadas dedicadas a "presión atmosférica e
histórico por zona" han agotado las fuentes evidentes; la próxima
pasada de esta rotación debería, en su lugar, comprobar qué otros spots
de `SPOTS` (más allá de acoruna/cies) tienen una estación de
MeteoGalicia cerca, antes de seguir buscando proveedores nuevos desde
cero.

**Fuentes:**
[MeteoGalicia — servicio JSON de datos diarios (PDF oficial)](https://www.meteogalicia.gal/datosred/infoweb/meteo/docs/rss/JSON_EstacionsDiarios_es.pdf),
[MeteoGalicia — listado de estaciones sin clave](https://servizos.meteogalicia.gal/mgrss/observacion/listaEstacionsMeteo.action),
[Open Data Euskadi — listado de estaciones con XMLdatos por estación](https://opendata.euskadi.eus/contenidos/ds_meteorologicos/estaciones_meteorologicas/opendata/estaciones.json).

**Firmado:** robot buscador de fuentes (pasada de presión atmosférica e
histórico por zona), 2026-09-20 22:52 UTC.

### 2026-09-21 08:20 UTC (pasada buscadora — cámaras/webcams, zona Galicia — Rías Altas / costa norte)

**Objetivo de la pasada:** primera vez que la rotación automática toca
esta zona. Solo 3 spots fijos aquí (`acoruna`, `camarinas`, `ribadeo`,
ver `SPOTS` en `index.html`) — a diferencia de Asturias/Cantabria, los
3 YA tienen cámara (MeteoGalicia, `functions/webcam/[slug].js`), así
que no hay ningún hueco de "spot fijo sin cámara" que rellenar en esta
zona. Sin acceso a `spots_usuario` (esta pasada no tiene token de
sesión, mismo límite ya documentado en pasadas anteriores), así que la
búsqueda se centró en: (1) comprobar que las 3 cámaras existentes
siguen vivas, (2) seguir la pista de Ribadeo dejada por la pasada de
Asturias, (3) buscar población por población (A Coruña, Ribadeo,
Camariñas) con los modificadores activos de `ROBOT_REGLAS.md`.

**Las 3 cámaras existentes están vivas y sin caída correlada.**
Verificado con petición HTTP real a las 3 `ultima.jpg` de MeteoGalicia:
A Coruña, Camariñas y Ribadeo, las 3 con `200 image/jpeg` y
`Last-Modified` a menos de 2 minutos del momento de la comprobación
(08:12-08:14 UTC). Nada que reemplazar.

**Pista de Ribadeo confirmada real — pero mismo bloqueo técnico que
Asturias.** `clubnauticoribadeo.com/webcams/` (Real Club Náutico de
Ribadeo) embebe dos cámaras reales de `rtsp.me`
(`rtsp.me/embed/TEsbennT/` y `rtsp.me/embed/6QYaBsGS/`) — la segunda es
exactamente la misma que `hispacams.com/en/webcams/puerto-de-ribadeo/`
(mismo ID, confirmado con `curl`: son espejos del mismo origen, igual
que ya se vio en Asturias con `webcamsdeasturias.com`/`hispacams.com`).
Probados los 5 paths de snapshot típicos (`snapshot.jpg`, `snap.jpg`,
`thumbnail.jpg`, `poster.jpg`, `image.jpg`) contra los 2 IDs — los 10,
`404`, igual que en Asturias: `rtsp.me` exige un intercambio de token
vía su propia API para servir el vídeo, no hay snapshot público
directo. Integrarlo exigiría un proxy propio con ese intercambio de
token — desarrollo nuevo, no una corrección trivial, así que queda
como propuesta sin implementar, igual que las cámaras de Llanes/
Ribadesella en Asturias.

**Hallazgo real más importante de la pasada — el "vídeo" de
MeteoGalicia vía `streamlock.net` NO está en directo.** Buscando
"webcam A Coruña", casi todos los resultados pasan por el agregador
`camaramar.com`. Inspeccionando su página para A Coruña
(`camaramar.com/webcam/coruna-dique`) apareció un `<source>` HLS real,
con CORS abierto:
`https://622a10e8864f7.streamlock.net/VODgrabaciones/meteo_Corunha.mp4/playlist.m3u8`
— mismo nombre de carpeta (`Corunha`) que la URL JPEG que ya usamos.
Confirmado que el mismo patrón (`meteo_<carpeta>.mp4`) existe también
para Ribadeo (`meteo_Ribadeoporto.mp4`, `200`) y Camariñas
(`meteo_Camarinhas.mp4`, `200`). A primera vista parecía un ascenso
directo por la regla de prioridad "vídeo antes que imagen fija" de
`ROBOT_REGLAS.md` — pero verificado en real pidiendo el mismo segmento
`.ts` dos veces con 75 segundos de diferencia real: el `ETag` y el
`Content-Length` no cambiaron ni un byte (mientras que, en la misma
pasada, el `ultima.jpg` de la misma cámara sí se actualizó de verdad en
ese margen). Es un clip fijo de ~54s grabado una vez y servido siempre
igual (solo el nombre del `chunklist` cambia en cada petición al
`playlist.m3u8`, el contenido real no) — **no es vídeo en directo, es
una trampa de aspecto convincente** (CORS abierto, HLS real, nombre de
carpeta coincidente). Añadida esta regla a `ROBOT_REGLAS.md` para que
ninguna pasada futura pierda tiempo intentando "mejorar" una cámara de
MeteoGalicia con esto.

**Resto de vías investigadas, sin resultado verificable:**
- Real Club Náutico de A Coruña (`rcncoruna.com`): sin cámara propia
  encontrada.
- Club Náutico de Camariñas: solo aparece vía Windfinder, cuya página
  es un widget renderizado por JS — el `og:image` es un asset genérico
  de Windfinder, no una foto real de la cámara; no verificable con una
  petición simple, no se propone.
- Ningún ayuntamiento de la zona (A Coruña, Ribadeo, Camariñas) tiene
  cámara propia independiente — todo lo encontrado remite a
  agregadores comerciales (`camaramar.com`, `g24.gal`,
  `meteosurfcanarias.com`, `enterat.com`) que a su vez remiten a
  MeteoGalicia o a `rtsp.me`.
- "Webcam surf" para A Coruña encontró Razo Beach
  (`artsurfcamp.com`) — cámara real de una escuela de surf, pero es una
  playa distinta (término de Carballo), no el spot de A Coruña; no se
  propone para este spot.

**Resultado neto: sin cámara nueva integrable esta pasada.** Los 3
spots fijos de esta zona ya tienen cámara viva; la única pista real
encontrada (Ribadeo/`rtsp.me`) tiene el mismo bloqueo técnico que ya
impidió integrar las de Asturias. Sí dos hallazgos generalizables,
añadidos a `ROBOT_REGLAS.md` (sección "Aprendizaje por zonas" → nueva
subsección Galicia — Rías Altas): que `rtsp.me` no es exclusivo de
Asturias, y que el HLS de `streamlock.net`/MeteoGalicia es un clip fijo,
no vídeo en directo — para que ninguna pasada futura repita esta
misma investigación desde cero. Recuento de términos actualizado en
`ROBOT_REGLAS.md` (sección de poda) para las 4 poblaciones de esta
zona probadas contra los modificadores activos.

**Fuentes:**
[Real Club Náutico de Ribadeo — Webcams](https://clubnauticoribadeo.com/webcams/),
[Hispacams — Puerto de Ribadeo](https://www.hispacams.com/en/webcams/puerto-de-ribadeo/),
[Camaramar — Webcam Coruña (Dique)](https://www.camaramar.com/webcam/coruna-dique),
[Windfinder — Club Náutico de Camariñas](https://es.windfinder.com/webcams/club-nutico-de-camarias),
[Artsurfcamp — Razo Beach Webcam](https://www.artsurfcamp.com/en/webcam/razo-beach-webcam/).

**Firmado:** robot buscador de fuentes (pasada de cámaras/webcams, zona
Galicia — Rías Altas / costa norte), 2026-09-21 08:20 UTC.

### 2026-09-21 15:35 UTC (pasada buscadora — mareas y oleaje)

**Calibración — 4 puntos nuevos, mismo método de siempre.** `curl` real
a `poem.puertos.es/portus/StationData` para la altura medida, Marine API
de Open-Meteo en las coordenadas exactas de cada boya para la
calculada, emparejando por la hora UTC exacta del último dato real:

| boya | hora UTC | altura medida | altura calculada | diferencia | % |
|---|---|---|---|---|---|
| 2136 Bilbao-Vizcaya | 15:00 | 1.76 m | 1.66 m | −0.10 m | −5.7% |
| 1117 Gijón | 13:00 | 1.52 m | 1.56 m | +0.04 m | +2.6% |
| 1101 Pasaia II | 13:00 | 1.65 m | 1.26 m | −0.39 m | −23.6% |
| 2820 Dragonera | 15:00 | 0.23 m | 0.12 m | −0.11 m | −47.8% |

Añadidos a `CALIBRACION.jsonl`. **Pasaia II llega a 16 puntos, los 16
con el mismo signo negativo** — no es una novedad en sí (el robot de
calibración nocturna ya alcanzó el umbral de 15 y escribió la propuesta
de factor de corrección hoy mismo a las 01:15 UTC, ver la sección
"Robot de calibración nocturna" más arriba); este punto solo confirma
que el patrón sigue sin excepción, no hace falta repetir la propuesta.
Bilbao-Vizcaya y Gijón (16 puntos cada una) siguen sin patrón
sistemático claro, signo mixto. Dragonera (rotación, candidata con más
días sin repetirse desde el 2026-09-18) llega a 2 puntos con el mismo
signo (−31.9%, −47.8%), pero con el mar casi en calma (alturas
absolutas de 0.12–0.23 m) el porcentaje es poco fiable como medida de
desviación real — hace falta más muestra con mar más agitado antes de
sacar ninguna conclusión de esta boya.

**Hallazgo nuevo — fuente real de nivel del mar (mareógrafo, no
oleaje) para calibrar el TIMING de marea, no solo el coeficiente
astronómico.** Investigando alternativas a `tides4fishing.com` (única
referencia usada hasta ahora para el coeficiente de marea, ver
`ROBOT_REGLAS.md`), apareció que el servidor THREDDS de EuskOOS/AZTI
(`thredds.euskoos.eus`, ya usado en la pasada de corrientes del
2026-09-15 para el radar HF) también publica un **mareógrafo real y
vivo**: `mareografos/R4C_Txingudi_Obscape_TG_4466.csv` (y dos sensores
más del mismo punto, `_4465`/`_4464`), en la bahía de Txingudi
(Hondarribia/Hendaia), actualizado cada 10 minutos —confirmado en vivo,
última fila a las 15:00 UTC, minutos antes de esta pasada.

Verificado contra nuestro propio cálculo para el spot `hondarribia`
(lat 43.3736, lon −1.7964 — la bahía de Txingudi está a menos de 2 km,
coordenada del mareógrafo solo aproximada, centro de la bahía según
Wikipedia, la documentación pública de EuskOOS no da la posición exacta
del sensor Obscape): el dato real y crudo de EuskOOS no es comparable
en valor absoluto contra el `marea.altura` que devuelve `/prevision`
(datums distintos — el mareógrafo usa su propio cero local, nuestro
valor está re-referenciado contra el mínimo de la ventana de Open-Meteo,
ver `CLAUDE.md` 2026-09-12), pero **sí se puede comparar el TIMING de
pleamar/bajamar**, que es justamente lo que un pescador necesita saber
bien. Resultado: la pleamar real observada en el mareógrafo cayó entre
las 12:10 y las 12:40 UTC de hoy (máximo local ~0.99 en su propio
datum); nuestra propia predicción para `hondarribia` decía bajamar a
las 18:00 UTC (20:00 hora de Madrid) — un desfase de ~5h20-5h50, muy
cercano al cuarto de periodo semidiurno real (~6h12m). El timing de
nuestro modelo encaja razonablemente bien con el mareógrafo real, sin
haber usado nunca este dato para calibrar nada hasta ahora. Detalle
completo en `CALIBRACION.jsonl` (`tipo:
"marea_real_txingudi_vs_modelo_propio"`).

**Propuesta, no implementación** (cae fuera de lo que esta pasada puede
aplicar directo — tocaría `functions/prevision.js`/`diario.html` y tiene
matices de datum que conviene decidir con calma): usar este mareógrafo
como fuente de VALIDACIÓN periódica del timing de marea para los spots
vascos de la zona (Hondarribia, Pasaia...) en vez de depender solo de
`tides4fishing.com` — a diferencia de esa web (una estimación de
terceros), esto es una medición real de nivel del mar. No se propone
mostrarlo directo al usuario (el problema del datum distinto lo haría
confuso sin más trabajo), solo usarlo internamente para futuras
calibraciones de `coeficientePorSpot()`/la hora de los eventos de
marea. Si se retoma: (1) confirmar si existen más mareógrafos EuskOOS
además de Txingudi (el catálogo del THREDDS solo lista esta estación
por ahora, comprobado en vivo), y (2) decidir cómo restar el offset de
datum entre el mareógrafo y nuestro cálculo antes de comparar alturas
absolutas, no solo el timing.

**Fuentes:**
[poem.puertos.es — StationData (Puertos del Estado, boyas reales)](https://poem.puertos.es/portus/StationData),
[Open-Meteo Marine API](https://marine-api.open-meteo.com/v1/marine),
[THREDDS EuskOOS — catálogo de mareógrafos](https://thredds.euskoos.eus/thredds/catalog/mareografos/catalog.xml),
[THREDDS EuskOOS — CSV real del mareógrafo de Txingudi](https://thredds.euskoos.eus/thredds/fileServer/mareografos/R4C_Txingudi_Obscape_TG_4466.csv),
[Wikipedia — Bay of Txingudi](https://en.wikipedia.org/wiki/Bay_of_Txingudi).

**Firmado:** robot buscador de fuentes (pasada de mareas y oleaje),
2026-09-21 15:35 UTC.

### 2026-09-21 18:52 UTC (pasada buscadora — corrientes marinas por zona, octava pasada)

**Qué se buscó:** la pasada anterior (2026-09-20 17:43 UTC) dejó pendiente
comprobar la proximidad real de las redes de radar HF de **Lisboa** e
**Ibiza** a un spot de Costaviva, mismo método ya aplicado a
Gibraltar/PLOCAN (petición real al griddap de EMODnet ERDDAP, buscar la
celda válida — `QCflag=1`/`CSPD_QC=1` — más cercana, no solo comprobar que
la red esté "viva").

**Hallazgo 1, muy positivo — Lisboa tiene la mejor cobertura de las 9
zonas comprobadas hasta ahora.** Confirmado en vivo (`time_coverage_end`
= hoy 17:00 UTC, actualizándose de verdad): la red `HFR-Lisboa-Total`
tiene una celda real y de buena calidad a solo **1.1 km** de
`costadacaparica` (spot ya existente) — más cerca que el mejor caso
anterior (PLOCAN/Las Palmas, 2.6 km). `cascais` también cae dentro,
a 4.1 km. El resto de spots portugueses de la zona quedan fuera de la
rejilla real: `troia` (25.3 km), `sines` (32.8 km), `ericeira` (33.0 km,
pese a estar geográficamente más cerca en línea recta — la rejilla con
datos válidos no cubre esa esquina norte de la red a esta hora).

**Hallazgo 2, positivo con matiz — Ibiza cubre Formentera, no Mallorca.**
`HFR-Ibiza-Total` (viva, mismo `time_coverage_end` de hoy) tiene su celda
válida más cercana a **12.4 km** de `formentera` (Es Pujols) — usable
pero bastante peor que Lisboa o PLOCAN. `palma` (Mallorca) queda a 139 km,
sin cobertura real ninguna — el nombre "Ibiza" de la red describe bien su
alcance real, no llega a Mallorca.

**Calibración real, 3 puntos nuevos** (17:00 UTC de hoy,
`CALIBRACION.jsonl`, `tipo: "corriente_radar_hf_vs_openmeteo"`):
Costa da Caparica (radar 0.36 m/s a 221°, Open-Meteo 0.11 m/s a 153° —
diferencia grande en velocidad Y dirección), Cascais (radar 0.13 m/s a
176°, Open-Meteo 0.18 m/s a 214° — velocidad parecida, dirección a 38°),
Formentera (radar 0.10 m/s a 12°, Open-Meteo 0.14 m/s a 135° —
dirección a 123°, la peor de las tres). Mismo patrón ya asentado en las
7 pasadas anteriores: sin relación estable entre el radar real y el
modelo de Open-Meteo, ni en velocidad ni en dirección — con esto ya son
**23 puntos en 7 zonas**, ninguno con corrección estable.

**Hallazgo 3, corrección de auditoría sobre esta misma responsabilidad —
bug de unidades en las 20 calibraciones anteriores.** Revisando cómo
pedir Open-Meteo para los 3 puntos nuevos, se comprobó que la Marine API
devuelve `ocean_current_velocity` en **km/h por defecto** (confirmado en
vivo y en la documentación oficial de Open-Meteo) — pero las 7 pasadas
anteriores de esta misma responsabilidad guardaron ese valor en
`openMeteoVelocidad` y lo compararon directamente contra
`radarVelocidad` (que sí es real en m/s, viene de `EWCT`/`NSCT` del
radar HF) **sin convertir**, como si ambos estuvieran en la misma
unidad. Confirmado pidiendo el mismo punto con y sin el parámetro
`wind_speed_unit=ms` (que también convierte `ocean_current_velocity`,
no solo el viento pese al nombre): mismo punto, `0.4` km/h (valor ya
guardado en calibraciones previas) frente a `0.11` m/s real (valor
correcto). Esto invalida las lecturas cualitativas tipo "velocidad casi
idéntica" de calibraciones anteriores (ej. Mundaka 2026-09-17 11:00 UTC:
"0.605 vs 0.6" parecía casi idéntico, pero 0.6 era km/h = 0.167 m/s, muy
lejos de 0.605 m/s real) — la conclusión de fondo (sin relación estable
radar-modelo) no cambia, pero el grado de discrepancia real en velocidad
es aún mayor de lo que las notas anteriores decían. **No se ha tocado
código de producción** (`functions/prevision.js` etiqueta bien
`corriente` como km/h en `index.html`, `panelCorriente` —
`${s.corriente} km/h` — así que esto es un bug solo de la metodología de
calibración de este robot, no de la app real). A partir de esta pasada,
`openMeteoVelocidad_ms` en `CALIBRACION.jsonl` se guarda siempre con
`wind_speed_unit=ms` explícito en la petición — cualquier pasada futura
que añada un punto de este `tipo` debe hacer lo mismo, y si se revisan
los 20 puntos anteriores para una conclusión cuantitativa, dividir su
`openMeteoVelocidad` entre 3.6 antes de comparar.

**Conclusión — sigue siendo solo propuesta**, no cambio de código: con
la cobertura de Lisboa (1.1 km de Costa da Caparica) ya es, de largo, el
mejor candidato de las 9 zonas comprobadas para una eventual integración
como capa de "corriente observada" aparte del modelo — pero la
recomendación de fondo no cambia (mostrar como observación real
aparte, nunca sustituir el modelo, dado que ninguna zona muestra
corrección estable). Pendiente para una futura pasada: de las 6 zonas
con radar HF real que quedan sin comprobar la proximidad exacta a un
spot (EUSKOOS y Galicia ya se han usado para calibrar puntos concretos,
pero conviene repetir el mismo barrido sistemático de "celda más
cercana" que se ha hecho hoy con Lisboa/Ibiza y antes con
Gibraltar/PLOCAN, para tener el mismo dato de distancia real en las 9
zonas).

**Fuentes:**
[EMODnet Physics ERDDAP — Lisboa](https://erddap.emodnet-physics.eu/erddap/info/EUHFR_NRTcurrent_HFR-Lisboa-Total/index.html),
[EMODnet Physics ERDDAP — Ibiza](https://erddap.emodnet-physics.eu/erddap/info/EUHFR_NRTcurrent_HFR-Ibiza-Total/index.html),
[Open-Meteo — Marine Weather API docs](https://open-meteo.com/en/docs/marine-weather-api).

**Firmado:** robot buscador de fuentes (pasada de corrientes marinas),
2026-09-21 18:52 UTC.

### 2026-09-21 23:45 UTC (pasada buscadora — presión atmosférica e histórico por zona, octava pasada)

**Contexto:** seguía el pendiente explícito dejado por la séptima pasada
(2026-09-20 22:52 UTC, más arriba): comprobar qué otros spots de `SPOTS`
(`index.html`) además de `acoruna`/`cies` (ya confirmados con MeteoGalicia)
tienen una estación real de esa misma red cerca, antes de seguir buscando
proveedores nuevos desde cero. Cubre los 9 spots gallegos restantes:
`baiona`, `aguarda`, `cangas`, `sanxenxo`, `ons`, `camarinas`, `corrubedo`,
`portosin`, `ribadeo`.

**Método:** GET real (vía `WebFetch`, sin acceso de red directo desde esta
sesión) al listado sin clave
`https://servizos.meteogalicia.gal/mgrss/observacion/listaEstacionsMeteo.action`,
verificado con dos peticiones independientes que devolvieron exactamente
los mismos `idEst`/coordenadas — y distancia recalculada a mano
(Haversine) para cada candidata, sin fiarse solo del cálculo de la
primera pasada (ver el hallazgo de la última sección, se encontró un
error real en una de esas distancias). Después, para cada estación
candidata se pidió `datosDiariosEstacionsMeteo.action` (15-19 sept 2026)
y se comprobó si trae de verdad `PR_AVG_1.5m`/`PRED_AVG_1.5m` — tener una
estación cerca no basta, varias estaciones de esta red miden viento/
temperatura/precipitación pero no llevan barómetro.

**Resultado — 7 de los 9 spots pendientes SÍ tienen una estación de
MeteoGalicia real y cercana con presión válida:**

| Spot | Estación (idEst) | Distancia | Presión real (15-19 sept 2026) |
|---|---|---|---|
| `aguarda` | As Eiras (19047) | 7.7 km | Sí, los 5 días válidos (ej. 1018.68 hPa) |
| `ons` | Ons (10126) | 0.3 km | Sí, los 5 días válidos (ej. 1024.88 hPa) |
| `camarinas` | Camariñas (10800) | 0.7 km | Sí, los 5 días válidos (ej. 1020.86 hPa) |
| `corrubedo` | Corrubedo (10049) | 1.9 km | Sí, los 5 días válidos (ej. 1019.58 hPa) |
| `ribadeo` | Pedro Murias (10047) | 3.4 km | Sí, los 5 días válidos |
| `portosin` | Lesende (19010) | 9.4 km | Sí, los 5 días válidos (ej. 1006.09 hPa) — nombre no coincide con la zona, es la más cercana disponible, sin estación llamada "Portosín"/"Noia"/"Muros" en el listado |
| `sanxenxo` | Sanxenxo (10129) | 0.8 km | Sí, pero **con hueco reciente**: 15-16 sept válida (1010.63/1010.51 hPa), 17-19 sept en `-9999.0` (sensor caído esos días concretos, no un fallo de la consulta — mismo tipo de intermitencia ya visto en Coruña-Dique en junio 2022, pasada anterior) |

**2 de los 9 NO tienen presión pese a tener estación muy cerca** —
confirmado pidiendo sus datos diarios reales, ninguno de los parámetros
de esos días incluye `PR_AVG`/`PRED_AVG`/similar:
- `baiona`: estación Baiona (10169), 1.1 km — solo balance hídrico,
  temperatura, viento, radiación, UV, precipitación, temperatura de
  suelo/rocío. Sin barómetro.
- `cangas`: estación Cangas-Porto (10906), 0.7 km — solo viento, humedad,
  temperatura, precipitación. Sin barómetro.

**Corrección sobre un dato intermedio de esta misma pasada, para que
quede constancia:** al investigar si existía una estación mejor para
`cies` que Porto de Vigo (ya confirmada con presión, pasada anterior),
apareció una estación llamada literalmente "Illas Cíes" (idEst 10125) —
pero **no lleva barómetro** (confirmado con una petición real a sus
datos diarios) y además el primer cálculo de distancia que se hizo a
mano la situaba a 11,7 km del spot `cies`; recalculado con más cuidado
(Haversine completo, sin redondear a mitad de camino) la distancia real
es **~15,6 km**, no 11,7 km. No cambia la conclusión (Porto de Vigo, a
0,5 km y con presión real, sigue siendo la fuente correcta para `cies`
sin ninguna duda) pero conviene dejar anotado el error de cálculo
intermedio por si se recicla ese número en el futuro.

**Conclusión — sigue siendo solo propuesta, no cambio de código** (toca
`functions/prevision.js` y es la misma decisión de backfill de
`presion_historico` ya aparcada desde 2026-09-14, ver `CLAUDE.md`): con
esta pasada, **9 de los 11 spots gallegos de `SPOTS`** (todos salvo
`baiona`/`cangas`) tienen ya una estación real y verificada de
MeteoGalicia con presión válida a menos de 10 km — la cobertura de esta
fuente para Galicia queda prácticamente cerrada. Si el usuario retoma el
backfill de `presion_historico`, la lista de estaciones a usar para
Galicia sería: A Coruña→14000, Camariñas→10800, Corrubedo→10049,
Portosín→19010 (Lesende), Ons→10126, Sanxenxo→10129 (con el hueco
conocido de sensor), Vigo/Cíes→14001, A Guarda→19047 (As Eiras),
Ribadeo→10047 (Pedro Murias). Para `baiona` y `cangas` no hay estación
de MeteoGalicia con presión disponible — quedarían sin dato de esta
fuente concreta (seguirían con el modelo de Open-Meteo, como el resto
de spots sin estación real cerca).

**Con esto, las 8 pasadas dedicadas a "presión atmosférica e histórico
por zona" quedan sin ningún pendiente evidente abierto** (Euskalmet,
MeteoGalicia y AEMET ya mapeados por zona; IPMA solo cubre Lisboa). La
próxima vez que le toque esta rotación a esta responsabilidad, conviene
revisar primero si el usuario ha retomado el backfill de
`presion_historico` — si no, plantearse espaciar aún más esta área o
reasignar el hueco a otra investigación (ver la propuesta ya hecha en la
pasada anterior).

**Fuentes:**
[MeteoGalicia — listado de estaciones sin clave](https://servizos.meteogalicia.gal/mgrss/observacion/listaEstacionsMeteo.action),
[MeteoGalicia — datos diarios por estación (ejemplo Ons, idEst 10126)](https://servizos.meteogalicia.gal/mgrss/observacion/datosDiariosEstacionsMeteo.action?idEst=10126&dataIni=15/09/2026&dataFin=19/09/2026).

**Firmado:** robot buscador de fuentes (pasada de presión atmosférica e
histórico por zona), 2026-09-21 23:45 UTC.

### 2026-09-22 08:03 UTC (pasada buscadora — webcams, ZONA: Galicia — Rías Baixas / costa sur)

**Objetivo:** primera pasada de rotación dedicada a esta zona (no había
sección propia en `ROBOT_REGLAS.md` → "Aprendizaje por zonas" todavía).
Spots fijos de la zona: `baiona`, `aguarda`, `cangas`, `cies` (Illas
Cíes), `sanxenxo`, `ons` (Illas Ons), `corrubedo`, `portosin` — 8 en
total. De estos, **6 ya tienen cámara de MeteoGalicia** (baiona, cangas,
cies→Ciesrodas, ons→Onspuerto, corrubedo, portosin) y **ninguno de los 6
muestra caída correlada ni historial de fallos repetidos** (revisado
`ROBOT.md` — sin menciones de `502`/"sin señal"/congelado para estos
slugs), así que por la regla de "Fallos correlados por proveedor" no
tenía sentido buscar reemplazo para ninguno. Los otros 2 (`aguarda`,
`sanxenxo`) llevan sin cámara desde 2026-09-13/14/16 (ya confirmado
varias veces que MeteoGalicia no los cubre) — esta pasada se centró en
ellos, con el enfoque nuevo de "población por población" pedido por el
usuario: ayuntamiento/turismo local, escuelas de surf, clubes náuticos y
cofradías, no solo ampliar MeteoGalicia.

**A Guarda: sin fuente nueva verificable.** `turismoaguarda.es` solo
enlaza a CRTVG/`g24.gal` (mismo backend institucional que MeteoGalicia,
no es independiente). Localizado un snapshot real,
`https://www.g24.gal/prog24/ARQUIVO/CAMARAS_WEB/aguarda.jpg` (`200
image/jpeg`) — pero **verificado en vivo que NO está en directo**:
`Last-Modified: Fri, 28 Aug 2026`, `Age` de más de 2.100.000s (~24 días)
y `cache-control: s-maxage=2592000` (30 días), confirmado con dos
peticiones reales espaciadas — es una imagen de archivo (`ARQUIVO` en
gallego), no una cámara viva. La Cofradía "Santa Tecla" existe pero sin
webcam propia asociada; ningún club náutico ni escuela de surf con
cámara encontrado para esta población.

**Sanxenxo/Portonovo/Silgar: sin fuente nueva integrable, pero sí una
fuente real con dos backends rotos distintos.** El Club Náutico de
Portonovo (`nauticoportonovo.com/webcam`, fuente primaria real, no
agregador) embebe dos cámaras: (1)
`hispacams.com/cam_embedded.php?id=000162` — su propio `caminfo.json`
declara metadatos de OTRA ubicación (Gijón/El Musel, Asturias, no
Sanxenxo — cámara mal indexada en Hispacams/Simbiosys) y la imagen fue
bit a bit idéntica en dos peticiones separadas 15s (mismo hash) → no
está en directo; (2) `crtvg.es/camweb/cam3.php?c=portonovo` → `404`
confirmado. El Hotel Minso (playa de Silgar) usa `rtsp.me/embed/
ZtENkk9Y/` — mismo bloqueo ya documentado en Asturias/Rías Altas (sin
snapshot público). El mismo patrón de archivo `g24.gal/prog24/ARQUIVO/
CAMARAS_WEB/sanxenxo.jpg` que A Guarda, igual de desactualizado. Riders
Surf School enlaza a `camaramar.com/spots/foxos.html` (playa de Foxos,
sí es Sanxenxo) pero da `404`.

**Conclusión de la pasada**: ninguna cámara nueva integrable para
`aguarda` ni `sanxenxo` — siguen sin fuente real. Sin cambios de código
(nada que proponer siquiera, todos los candidatos verificados están
rotos/desactualizados/mal indexados). Ver `ROBOT_REGLAS.md` →
"Aprendizaje por zonas" → nueva sección "Zona: Galicia — Rías Baixas"
para los dos hallazgos generalizables (patrón `g24.gal/ARQUIVO` y el
riesgo de metadatos cruzados en Hispacams).

**Firmado:** robot buscador de fuentes (pasada de webcams), 2026-09-22
08:03 UTC.

### 2026-09-22 13:44 UTC (pasada buscadora — mareas y oleaje)

**Calibración — 4 puntos de siempre + primera calibración contra una
fuente completamente nueva.** Mismo método de siempre: `curl` real a
`poem.puertos.es/portus/StationData` para la altura medida, Marine API
de Open-Meteo en las coordenadas exactas para la calculada, emparejando
por la hora UTC exacta del último dato real:

| boya | hora UTC | altura medida | altura calculada | diferencia | % |
|---|---|---|---|---|---|
| 2136 Bilbao-Vizcaya | 13:00 | 1.17 m | 1.18 m | +0.01 m | +0.9% |
| 1117 Gijón | 13:00 | 1.19 m | 1.06 m | −0.13 m | −10.9% |
| 1101 Pasaia II | 13:00 | 1.25 m | 0.90 m | −0.35 m | −28.0% |
| 1731 Barcelona II | 13:00 | 0.73 m | 0.56 m | −0.17 m | −23.3% |

Añadidos a `CALIBRACION.jsonl`. **Pasaia II llega a 18 puntos, los 18
con el mismo signo negativo** (media 18 puntos ≈ **−28.6%**, estable
respecto a la media de 15/16/17 puntos ya escrita en `ROBOT.md` el
2026-09-21 — sigue sin ninguna excepción de signo) — no hace falta
repetir la propuesta de factor de corrección ya hecha por el robot de
calibración nocturna, este punto solo confirma que se mantiene.
Bilbao-Vizcaya y Gijón siguen sin patrón sistemático claro (signo
mixto). **Barcelona II (rotación, candidata con más días sin
repetirse desde el 2026-09-19) llega a 6 puntos, LOS 6 con signo
negativo (media 6 puntos ≈ −29.1%)** — y esta vez con oleaje real de
0.73 m, el primer punto de esta boya por encima del umbral de 0.6 m que
hasta ahora hacía sospechar que el sesgo fuera solo ruido de mar en
calma. Con este punto, Barcelona II se parece cada vez más a Pasaia II
en magnitud de sesgo (−29.1% vs −28.6%), aunque son zonas geográficas
distintas (Mediterráneo vs Cantábrico/Guipúzcoa) — refuerza la
sospecha, ya apuntada el 2026-09-19, de que Open-Meteo podría estar
subestimando oleaje de forma más general de lo que parecía al principio
(no solo un problema local de Pasaia).

**Fuente nueva encontrada y verificada en vivo: boyas reales de SOCIB
(Sistema de Observación y Predicción Costero de las Islas Baleares).**
Buscando alternativas a Puertos del Estado para la zona balear (donde
la única boya fija ya en rotación, Dragonera, lleva solo 6 puntos y con
mar casi siempre en calma), apareció que SOCIB — instituto público de
investigación oceanográfica de Baleares, financiado por el Ministerio
de Ciencia y el Govern de les Illes Balears — publica boyas de oleaje
reales y vivas en su servidor THREDDS
(`thredds.socib.es/thredds/catalog/mooring/waves_recorder/`), con dato
de altura significativa de ola (`WAV_HEI_SIG`, Hm0) cada 30 minutos y
su propio control de calidad (`QC_WAV_HEI_SIG`, 1 = "good_data").
Confirmado en vivo vía OPeNDAP (`.dds`/`.ascii`, sin necesidad de
descargar el NetCDF completo — mismo patrón que otros THREDDS ya usados
en el repo, ver EuskOOS 2026-09-15/21):

- **Boya Bahía de Palma** (`buoy_bahiadepalma-scb_wave006`, despliegue
  `dep0003`, lat 39.498883, lon 2.702133) — última lectura real a las
  13:30 UTC de hoy, actualizada 20 minutos antes de esta pasada.
  Comparada a las 13:00 UTC: real 0.26 m, calculado 0.12 m, diferencia
  −53.8% — mar casi en calma (mismo aviso de siempre: el % es poco
  fiable con oleaje tan pequeño), pero mismo signo negativo. Está a
  solo **~9 km del spot fijo `palma`** (39.570, 2.650) — mucho más
  cerca que la boya de Puertos del Estado que cubre esa zona hoy
  (Dragonera, a ~28 km de `palma`).
- **Boya Canal de Ibiza** (`buoy_canaldeibiza-scb_wave007`, despliegue
  `dep0001`, lat 38.813817, lon 0.808467) — misma frescura (última
  lectura también a las 13:30 UTC de hoy). Comparada a las 13:00 UTC:
  real 0.50 m, calculado 0.32 m, diferencia −36.0%, mismo signo.

Ambas añadidas a `CALIBRACION.jsonl` como primer punto de una fuente
nueva (`nombre` describe la fuente en vez de un código de Puertos del
Estado, que esta boya no tiene). El catálogo de SOCIB tiene más boyas
de oleaje vivas sin explorar todavía (Sóller, Portocolom, más
despliegues de "MOBIMS" en Muro/Cala Millor/Son Bou/Sonbou — todas con
spot fijo homónimo o cercano en `index.html`) — candidatas para
próximas pasadas de esta misma rotación.

**Propuesta, no implementación** (fuente externa nueva + tocaría
`functions/prevision.js`, cae fuera de lo que esta pasada puede aplicar
directo): usar las boyas de SOCIB como referencia de calibración
adicional para los spots baleares (`palma`, `formentera`, `muro`,
`calamillor`, `sonbou`, `ciutadella`), en vez de depender solo de
Dragonera (que cubre peor esa zona, más lejos y con menos muestra
todavía). No se propone sustituir a Puertos del Estado en el resto de
la costa — solo complementar la cobertura balear con una fuente real
más cercana y ya con control de calidad propio. Antes de integrarlo
haría falta decidir con el usuario si el acceso es vía OPeNDAP
(NetCDF, sin API key, pero requiere leer un formato binario/subconjunto
en vez de JSON simple) o si SOCIB tiene un endpoint JSON/REST más
sencillo (no comprobado todavía en esta pasada).

**Fuentes:**
[poem.puertos.es — StationData (Puertos del Estado, boyas reales)](https://poem.puertos.es/portus/StationData),
[Open-Meteo Marine API](https://marine-api.open-meteo.com/v1/marine),
[SOCIB — Datos meteoceánicos](https://www.socib.es/es/que-hacemos/datos-meteoceanicos),
[SOCIB — Boya Bahía de Palma](https://www.socib.es/es/que-hacemos/observacion-del-oceano/plataformas-fijas/boya-bahia-de-palma),
[THREDDS SOCIB — catálogo de boyas de oleaje](https://thredds.socib.es/thredds/catalog/mooring/waves_recorder/catalog.html).

**Firmado:** robot buscador de fuentes (pasada de mareas y oleaje),
2026-09-22 13:44 UTC.

### 2026-09-22 (pasada buscadora — presión atmosférica e histórico por zona, novena pasada)

**Contexto:** las 8 pasadas anteriores de este tema (2026-09-14 a
2026-09-21, más arriba) ya dejaron mapeadas las fuentes obvias por zona
(AEMET nacional en producción, Euskalmet ZIP anual para Bilbao/Pasaia,
MeteoGalicia JSON sin clave para 9 de 11 spots gallegos, IPMA solo
Lisboa, Open-Meteo archive/ERA5 como respaldo de modelo) y la octava
pasada concluyó **"sin ningún pendiente evidente abierto"**, recomendando
para esta rotación (1) comprobar si el usuario había retomado el
backfill de `presion_historico` (aparcado desde el 2026-09-14) y, si no,
(2) espaciar aún más este tema o reasignar el hueco a otra investigación.

**Comprobado (1): backfill sigue parado.** Revisados
`supabase/migrations/` (ninguna migración nueva relacionada con
`presion_historico`) y `functions/prevision.js`/`registrar-presion.js`
(sin cambios de código en esa dirección) — el usuario no lo ha retomado.
Sigue siendo una propuesta pendiente de confirmar por él, tal como
recoge `CLAUDE.md`.

**Comprobado (2): un hueco geográfico real que las 8 pasadas anteriores
no habían mirado explícitamente para presión — Cantabria.** Búsqueda
específica de un equivalente institucional a MeteoGalicia/Euskalmet para
esta zona (spots `santander`/costa cántabra). Dos candidatas nuevas,
ambas descartadas con una comprobación real:
- **Meteocantabria** (`meteocantabria.es`, portal público con histórico
  1984-2023 de 4 estaciones): confirmado que sus 13 variables
  climatológicas (temperatura, precipitación, nieve, granizo, tormenta,
  niebla, escarcha, rocío...) **no incluyen presión atmosférica en
  ningún caso** — no aporta nada nuevo, descartado.
- **Snowy** (`snowy.es`, red con estaciones "Snowy" + reemisión de AEMET
  en el mismo mapa): confirmado que es una red **híbrida con estaciones
  amateur/crowdsourced** (tipo Weather Underground) mezcladas con datos
  ya reemitidos de AEMET/Open-Meteo — mismo tipo de fuente ya descartada
  antes en este repo por falta de control de calidad institucional
  (mismo criterio que Fishbrain/apps de terceros para otras áreas). No
  aporta ninguna estación ni dato que no tengamos ya de AEMET
  directamente, y con menos garantía de calibración. Descartado.

**Conclusión de esta pasada**: Cantabria (y por extensión, muy
probablemente Asturias — misma ausencia de un portal autonómico propio
de datos meteorológicos abiertos, ya detectada en pasadas de otras áreas
de este robot para lonjas/webcams) se queda, de momento, sin ninguna
fuente de backfill histórico de presión más fina que el modelo de
Open-Meteo (ERA5/archive) y las estaciones AEMET ya integradas
(Santander Aeropuerto) — no es un hueco nuevo grave, es la misma
situación que ya cubre el modelo para el resto de spots sin estación
institucional cercana. **Sin novedades que cambien la conclusión de la
pasada anterior**: el tema sigue sin ningún pendiente evidente real que
justifique seguir dedicándole una pasada dedicada cada rotación — se
reitera la recomendación de la octava pasada de espaciar este tema o
reasignar el hueco, a decidir por el usuario.

**Fuentes:**
[Meteocantabria — histórico/estadísticas](https://www.meteocantabria.es/meteocantabria/historico/view-estadistica),
[Snowy — estaciones en Cantabria](https://snowy.es/stations/espana/cantabria).

**Firmado:** robot buscador de fuentes (pasada de presión atmosférica e
histórico por zona), 2026-09-22 23:50 UTC.

### 2026-09-23 08:05 UTC (pasada buscadora — cámaras/webcams, ZONA: Portugal — centro y norte, primera vez en esta rotación por zonas)

**Qué se buscó**: cámara nueva para los 8 spots fijos de esta zona, todos
sin webcam (`moledo`, `vianadocastelo`, `povoadevarzim`, `matosinhos`,
`aveiro`, `figueiradafoz`, `nazare`, `peniche`) — población por
población, más los términos activos de `ROBOT_REGLAS.md` (`webcam
directo`, `webcam surf`, `webcam ayuntamiento` → `webcam câmara
municipal`, `webcam pesca/puerto/cofradía` → `webcam porto de
pesca/capitania`, `webcam club náutico` → `webcam clube naval/marina`).
Antes de nada se releyó la entrada de 2026-09-15 08:20 UTC (pasada
buscadora anterior, sin la rotación por zonas todavía) que ya había
investigado Portugal en bloque y concluyó "sin fuente gratuita/hotlinkable
viable" porque Beachcam (MEO) había pasado a servicio de pago
(`403 Forbidden`) — **reconfirmado hoy en real** (`curl` a
`beachcam.meo.pt/livecams/praia-do-norte/` → `403`, sigue muerto para
integración directa 8 días después).

**HALLAZGO PRINCIPAL — red comunitaria global Windy Webcams, nunca
investigada en este repo, cubre 7 de las 8 poblaciones de esta zona con
cámaras reales, propias e independientes (no Beachcam), en alta
resolución.** Encontrada a través del agregador `portugalwebcams.pt`
(que a su vez reincrusta el visor oficial de `webcams.windy.com`) — cada
cámara tiene una ficha propia (`portugalwebcams.pt/en/webcam/<slug>`)
con un ID numérico de Windy, y la imagen real se sirve directa, sin
necesidad de scraping ni token, en:
`https://imgproxy.windy.com/_/full/plain/current/<id>/original.jpg`
(variante `full` = resolución real 1280x720 o 1920x1080; la variante
`preview` que aparece primero en el HTML es solo una miniatura de
400x224 — **usar siempre `full`, no `preview`**). CORS abierto
(`Access-Control-Allow-Origin: *`) en las dos variantes, aunque para
este repo es indiferente (el proxy `/webcam/<slug>` ya hace la petición
desde el propio Worker, no desde el navegador).

Verificado en real, todas con `Last-Modified` a menos de 10 minutos de
la comprobación (08:00-08:05 UTC de hoy) y resolución real comprobada
por bytes (no solo por la cabecera):

| Spot | Cámara (nombre en Windy) | ID | Resolución | Ficha en portugalwebcams.pt |
|---|---|---|---|---|
| `matosinhos` | Matosinhos – Leixões Port | `1662727342` | 1280x720 | `matosinhos-leixoes-port` |
| `matosinhos` (reserva) | Matosinhos – Leça da Palmeira | `1349771403` | 1280x720 | `matosinhos-leca-da-palmeira` |
| `vianadocastelo` | Viana do Castelo – Darque | `1444832771` | 1920x1080 | `viana-do-castelo-darque` |
| `vianadocastelo` (reserva) | Viana do Castelo – Darque (Panoramic) | `1672453690` | 1920x1080 | `viana-do-castelo-darque-panoramic` |
| `aveiro` | Aveiro – Barra Beach | `1424817063` | 1920x1080 | `aveiro-barra-beach` |
| `figueiradafoz` | Figueira da Foz – São Pedro - Cabedelo | `1793906895` | 1920x1080 | `figueira-da-foz-sao-pedro-cabedelo` |
| `figueiradafoz` (reserva) | Figueira da Foz – Buarcos e São Julião | `1646935622` | 1920x1080 | `figueira-da-foz-buarcos-sao-juliao` |
| `figueiradafoz` (reserva 2) | Figueira da Foz – Quiaios | `1691852074` | 1280x720 | `figueira-da-foz-quiaios` |
| `figueiradafoz` (reserva 3) | Figueira da Foz – São Pedro | `1695295936` | 1280x720 | `figueira-da-foz-sao-pedro` |
| `nazare` | Nazaré – Norte Beach 2 | `1399037667` | 1920x1080 | `nazare-north-beach-2` |
| `nazare` (reserva) | Nazaré – Town Beach | `1516663648` | 1920x1080 | `nazare-town-beach` |
| `nazare` (reserva 2) | Nazaré – Safe Harbor | `1637346177` | 1280x720 | `nazare-safe-harbor` |
| `peniche` | Peniche – Baleal Beach | `1695285178` | 1920x1080 | `peniche-baleal-beach` |
| `peniche` (reserva) | Peniche – Areia Branca Beach | `1742819240` | 1920x1080 | `peniche-areia-branca-beach` |
| `peniche` (reserva 2) | Peniche – Lagide and Bay | `1695211815` | 1920x1080 | `peniche-lagide-bay` |

Es decir: **9 spots nuevos con cámara candidata verificada** (6
principales + reservas), cubriendo 6 de los 8 spots de la zona
(`matosinhos`, `vianadocastelo`, `aveiro`, `figueiradafoz`, `nazare`,
`peniche`). Por el criterio de prioridad de `ROBOT_REGLAS.md`
("Aprendizaje por zonas" — vídeo > imagen fija; entre imágenes fijas, la
de mejor resolución) se eligió como principal la de mayor resolución
real cuando había varias por spot, dejando el resto como reserva en el
array (nunca se investigó si hay variante de vídeo/HLS de este mismo
proveedor — pendiente para una futura pasada si el usuario quiere
profundizar).

**`moledo` (Caminha) — encontrada pero NO propuesta todavía, cámara
real pero actualmente parada**: `portugalwebcams.pt/en/webcam/
caminha-moledo-beach` → Windy ID `1570535472`, 1920x1080, pero su
`Last-Modified` es del **17 de septiembre** (6 días antes de esta
comprobación) — la cámara existe y en su momento funcionó, pero el
propio origen (el dueño de la cámara, no Windy) lleva varios días sin
subir imagen nueva. Mismo patrón que las carpetas muertas de
`kostasystem.com` en Bizkaia: responde `200` con una imagen real pero
vieja, nunca dar esto por bueno solo por el código de estado. **No se
propone todavía** — reintentar en una pasada futura de esta zona (la
próxima le toca en ~10 días por la rotación) para comprobar si ha vuelto
a actualizar.

**`povoadevarzim` — sin cámara de Windy confirmada, un ID visto en un
resultado de búsqueda resultó no existir ya.** `portugalwebcams.pt` no
tiene ficha de ciudad para Póvoa de Varzim (`/en/city/povoa-de-varzim` →
`404`). Un resultado de búsqueda apuntaba a
`windy.com/pt/-Webcams/.../webcams/1570780006`, pero ese ID da `404` en
`imgproxy.windy.com` tanto en `full` como en `preview` — la cámara ya no
existe en la red (o se retiró). En su lugar se encontró **Surftotal**
(`surftotal.com`, red de cámaras propia, NO un espejo de Beachcam pese
al nombre "Beachcam - ... HD" que usa en sus títulos — comprobado
mirando el HTML real de la página, sirve desde su propio dominio
`stream.surftotal.com`/`surftotal.com`, no reincrusta beachcam.meo.pt):
cámara "Ferrari" de Póvoa de Varzim, snapshot JPEG real y actualizado
(`Last-Modified` a menos de 4 minutos de la comprobación) en
`https://surftotal.com/camara/stream_files/today_portugal_ferrari_8.jpg`
— pero solo **200x113px**, una miniatura, muy por debajo de la
resolución de cualquier cámara de Windy de esta misma pasada. También
existe un HLS (`stream.surftotal.com/portugal/ferrari/index.m3u8`) pero
con un token de sesión en la URL (`?token=...&time=...`) — no se pudo
confirmar si ese token caduca o es reutilizable sin más investigación
(pendiente si se quiere profundizar). Dada la resolución tan baja de la
imagen fija, se deja como candidata de baja prioridad para
`povoadevarzim`, no como hallazgo fuerte — el usuario puede decidir si
merece la pena con esta calidad.

**Recuento del protocolo de poda de términos** (`ROBOT_REGLAS.md`, 2
poblaciones fijas de esta zona: **Nazaré y Peniche**, primera vez que se
registra esta zona):
- `webcam surf`: sin resultado nuevo confirmable — Baleal Surf Camp
  (Peniche) anuncia una webcam propia pero la petición automatizada dio
  `202` sin contenido verificable, no se pudo confirmar si es
  independiente o reincrusta Beachcam; no se cuenta como resultado
  positivo sin verificación real.
- `webcam ayuntamiento` (`webcam câmara municipal`): sin resultado —
  `cm-nazare.pt` no expone webcam propia (sitio con partes en
  mantenimiento), `cm-peniche.pt` tampoco.
- `webcam pesca/puerto/cofradía` (`webcam porto de pesca/capitania`):
  sin resultado — la Capitania do Porto de Peniche solo tiene ficha de
  contacto; el "Porto de Abrigo" de Nazaré sí tiene cámara pero es de
  Beachcam (ya descartado), no una fuente independiente de la propia
  autoridad portuaria.
- `webcam club náutico` (`webcam clube naval/marina`): sin resultado —
  ni `cnpeniche.pt` (Clube Naval de Peniche) ni `cnnazare.pt` (Clube
  Naval da Nazaré) muestran cámara propia en su web.

**Aviso general para cualquier zona con Panomax**: se probó también
`matosinhos.panomax.com` y `nazare.panomax.com` (código embebido tipo
PANOMAX 360°, aparece en varias búsquedas de esta pasada) — el único
recurso público sin autenticación es el `og:image` de la portada, y
resultó ser una imagen **estática cacheada desde 2022** (`Last-Modified:
10 May 2022`), no una vista en directo — mismo patrón ya conocido de
`g24.gal/prog24/ARQUIVO/CAMARAS_WEB/` en Galicia. Probados también los
paths típicos de snapshot (`current.jpg`, `live.jpg`, `latest.jpg`,
`thumbnail.jpg`) → los 4, `404`. Panomax parece exigir su API de pago
para la imagen real en directo; no perseguir más esta vía salvo que
aparezca una API pública documentada.

**Añadida regla nueva en `ROBOT_REGLAS.md`** (sección "Aprendizaje por
zonas", nueva subsección de esta zona): la red Windy Webcams como
proveedor a comprobar en cualquier zona futura (no solo Portugal), y el
patrón `imgproxy.windy.com/_/full/plain/current/<id>/original.jpg` con
el aviso de comprobar siempre `Last-Modified` antes de proponer (igual
que con cualquier otro proveedor).

**Nada de esto se ha integrado en código todavía** — toca
`functions/webcam/[slug].js` y `index.html` (`SPOTS_CON_WEBCAM`/`WEBCAMS`),
fuera del límite de "corrección trivial" de `ROBOT_REGLAS.md` (son 6
spots nuevos con 9 URLs). **Queda como propuesta para que el usuario
decida** cuáles de los 6 hallazgos principales integrar y con qué
prioridad de reserva, y si quiere que se investigue también el HLS de
Surftotal para Póvoa de Varzim antes de descartar esa cámara por baja
resolución.

**Fuentes:**
[Portugal Webcams — Matosinhos/Leixões](https://portugalwebcams.pt/en/webcam/matosinhos-leixoes-port),
[Portugal Webcams — Viana do Castelo/Darque](https://portugalwebcams.pt/en/webcam/viana-do-castelo-darque),
[Portugal Webcams — Aveiro/Barra](https://portugalwebcams.pt/en/webcam/aveiro-barra-beach),
[Portugal Webcams — Figueira da Foz](https://portugalwebcams.pt/en/city/figueira-da-foz),
[Portugal Webcams — Nazaré](https://portugalwebcams.pt/en/city/nazare),
[Portugal Webcams — Peniche](https://portugalwebcams.pt/en/city/peniche),
[Portugal Webcams — Caminha/Moledo](https://portugalwebcams.pt/en/webcam/caminha-moledo-beach),
[Surftotal — Póvoa de Varzim Ferrari HD](https://surftotal.com/camaras-report/grande-porto-douro-litoral/povoa-de-varzim-ferrari),
[Beachcam MEO — Praia do Norte (403, referencia de lo ya descartado)](https://beachcam.meo.pt/livecams/praia-do-norte/),
[Panomax — Matosinhos (descartado)](https://matosinhos.panomax.com/).

**Firmado:** robot buscador de fuentes (pasada de cámaras/webcams, zona
Portugal — centro y norte), 2026-09-23 08:05 UTC.

### 2026-09-23 15:38 UTC (pasada buscadora — buenas prácticas de otras apps)

Investigación con `WebSearch`/`WebFetch` de qué datos en tiempo real o
funciones tienen otras apps de mareas/pesca (Windy, Tides4fishing,
Fishbrain, Meteoblue, Puertos del Estado, AEMET...) que Costaviva no
tenga todavía, evitando repetir lo ya propuesto el 2026-09-14 y el
2026-09-15 (avisos CAP de AEMET, periodos solunares, "top baits" de
comunidad, SST/clorofila por satélite, previsión offline PWA, alarmas
configurables tipo Nautide, planificador por condición futura,
explicabilidad del índice + curva horaria, racha de viento). **Solo
propuestas — cambio de producto/dato mostrado como fiable por
definición, nunca implementación directa** (regla de
`ROBOT_REGLAS.md`, sec. "Buenas prácticas de otras apps y biología de
especies"). Nada se ha tocado en código, pese a que dos de los tres
hallazgos de abajo sí se pudieron verificar con una petición HTTP real
(a diferencia de las dos pasadas anteriores de esta misma
responsabilidad, que eran solo capturas de pantalla/descripciones de
producto de apps de terceros).

**1. MeteoGalicia tiene un servicio JSON público de predicción por
playa — gratis, sin API key, y ya verificado en real — con temperatura
del agua y UV que Costaviva no muestra hoy.** Documentado en
`meteogalicia.gal/datosred/infoweb/meteo/docs/rss/JSON_Pred_Praia_es.pdf`:
`https://servizos.meteogalicia.gal/mgrss/predicion/jsonPredPraia.action?idPraia=<id>`
devuelve, para 3-4 días vista y 3 franjas horarias por día (mañana/
tarde/noche): estado del cielo, agitación del mar (débil/moderada/
fuerte), % de probabilidad de lluvia, dirección e intensidad de viento,
temperatura mín/máx del aire — y, lo verdaderamente nuevo, **`tAuga`
(temperatura del agua prevista, °C) y `uvMax` (índice UV máximo)**,
ninguno de los dos disponible hoy en Costaviva (el agua sale del
modelo de Open-Meteo, sin UV en ningún sitio de la app). Probado en
vivo para Ribadeo (`idPraia=1987`, "As Catedrais ou Carricelas"):
`200` con datos reales de hoy (`tAuga: 19`, `uvMax: 6`) y 3 días más de
previsión. El propio documento trae un listado completo de
identificadores de playa por ayuntamiento (Anexo I) — de los spots
fijos de Galicia, ya se han localizado los de A Coruña (2448 Riazor,
2449 Orzán y más), Camariñas (varios en Anexo I), Ribadeo (1987, usado
en la prueba), Baiona (2051-2055), Cangas (2148-2158+), Sanxenxo
(2204-2270) — faltaría cruzar cada spot fijo con la playa concreta más
cercana antes de integrar. **Cobertura solo Galicia** (es un servicio
autonómico) — no cubre Euskadi/Cantabria/Asturias/Portugal, sería un
complemento regional, no sustituto de nada existente. Propuesta: (a)
mostrar `tAuga`/`uvMax` como dato adicional en el panel de los spots
gallegos con playa de MeteoGalicia identificada, (b) valorar si
`tAuga` merece cruzarse con el de Open-Meteo como segunda fuente/
validación en vez de sustituirlo. Toca `functions/prevision.js` +
`index.html`, y hace falta identificar bien cada `idPraia` por spot
antes de nada → propuesta, no corrección trivial.

**2. Open-Meteo Marine API — la MISMA fuente que Costaviva ya usa para
`wave_height`/`wave_period`/`wave_direction` — separa el oleaje en
mar de fondo (swell) y mar de viento (wind wave), y Costaviva no pide
esos campos.** Verificado en vivo contra el propio endpoint de
`marine-api.open-meteo.com/v1/marine` (mismo que usa
`functions/prevision.js`, línea ~578) añadiendo los parámetros
`swell_wave_height,swell_wave_period,swell_wave_direction,
wind_wave_height,wind_wave_period,wind_wave_direction` a la petición
`hourly` ya existente — `200`, con valores reales y coherentes (para un
punto de prueba en Bizkaia: oleaje combinado 1.40 m con periodo 14 s,
descompuesto en swell 1.38 m/12 s desde 302° y mar de viento residual
casi nulo 0.04 m). Es exactamente la distinción "swell vs. wind chop"
que Windy, Surfline y otras apps de surf/pesca destacan como dato de
valor (un mar de fondo largo y limpio pesca/surfea distinto de un
oleaje corto levantado por el viento local, aunque la altura combinada
sea la misma). **Coste de integración mínimo real**: no es un
proveedor nuevo, son 6 parámetros más en la MISMA URL que ya se pide
cada vez — a diferencia de la idea aparcada en `CLAUDE.md` ("estimar
la mar de fondo combinando boyas + batimetría + webcam", pedida
2026-09-14, sin empezar), esto no requiere ningún modelo propio ni
calibración: Open-Meteo ya lo calcula. Sigue siendo propuesta y no
corrección trivial porque cambia lo que se muestra en `indiceMar()` y
en los paneles de spot (dato mostrado como fiable) y tocaría
`functions/prevision.js` + `index.html` + `diario.html` a la vez. Si
el usuario lo retoma, puede servir como primer paso barato antes de
la idea más ambiciosa ya aparcada (que seguiría teniendo sentido para
propagar swell de una boya exterior spot a spot, algo que Open-Meteo
no hace).

**3. AEMET tiene un endpoint de predicción específica por playa
(`/api/prediccion/especifica/playa/{id}`), documentado y con un listado
público de IDs de playa (CSV, sin autenticación) que cubre poblaciones
de casi todas las zonas de Costaviva — no verificado con petición real
por no tener la `AEMET_API_KEY` en este runner (vive como secreto en
Cloudflare Pages, mismo límite ya anotado para los avisos CAP el
2026-09-14).** El listado de playas
(`aemet.es/documentos/es/eltiempo/prediccion/playas/Playas_codigos.csv`,
público, verificado en vivo con `curl`, `200`) incluye playas en los
municipios de Zarautz/Zumaia (Gipuzkoa), Llanes/Ribadesella (Asturias),
Baiona/Cangas/Sanxenxo (Pontevedra), Castro-Urdiales/Laredo/Santoña
(Cantabria) y Mundaka (Bizkaia) — cobertura nacional, a diferencia de
MeteoGalicia (solo Galicia). Según la documentación pública de la API
(no verificado con dato real), el JSON de este endpoint trae estado
del cielo y otros campos meteorológicos por playa a 3 días vista;
no se ha podido confirmar si incluye temperatura del agua o UV como
MeteoGalicia. Propuesta para la próxima vez que alguien con acceso al
secreto pueda probar el endpoint real: verificar con la key de
Cloudflare Pages antes de decidir si aporta algo que MeteoGalicia (para
Galicia) no ya cubra, y si merece la pena para el resto de zonas.

**Encontrado pero descartado por no ser una API limpia**: NÁYADE
(Ministerio de Sanidad, `nayadeciudadano.sanidad.gob.es`) es la fuente
oficial española de calidad de aguas de baño (clasificación anual
excelente/buena/suficiente/insuficiente por playa, cumplimiento de la
directiva europea de aguas de baño) — real y verificado que responde
(`200`, `curl` real), pero es una aplicación web antigua tipo Struts
pensada para navegar a mano por provincia/municipio/playa, sin ningún
endpoint JSON/REST público encontrado — integrarlo exigiría scraping
HTML, no una petición estructurada. Además es un dato de temporada
(clasificación anual), no en tiempo real como el resto de fuentes de
este repo. Queda anotado como fuente real que existe, no como
candidato a integrar a corto plazo.

**Ya cubierto por pasadas anteriores, no re-propongo**: avisos CAP de
AEMET, periodos solunares, recomendación de cebo/técnica por
comunidad, SST/clorofila por satélite, previsión offline PWA, alarmas
configurables, planificador de condición futura, explicabilidad del
índice + curva horaria, racha de viento (gust). También revisados y
sin novedad relevante frente a lo ya anotado: Windy.app (wave alerts,
elección de datum de marea LAT/MLLW — mismo tipo de función que las
alarmas de Nautide ya propuestas) y Tides4fishing (solunar, ya
cubierto).

Fuentes consultadas:
- MeteoGalicia — [Servicio JSON predicción por playa (PDF)](https://www.meteogalicia.gal/datosred/infoweb/meteo/docs/rss/JSON_Pred_Praia_es.pdf),
  endpoint verificado en vivo `servizos.meteogalicia.gal/mgrss/predicion/jsonPredPraia.action?idPraia=1987`.
- Open-Meteo Marine API — [documentación](https://open-meteo.com/en/docs/marine-weather-api),
  endpoint verificado en vivo con parámetros `swell_wave_*`/`wind_wave_*`.
- AEMET OpenData — [documentación API](https://opendata.aemet.es/opendata/documentation/v2/api-docs?group=AEMET_API),
  [listado de playas (CSV, verificado en vivo)](https://www.aemet.es/documentos/es/eltiempo/prediccion/playas/Playas_codigos.csv).
- Ministerio de Sanidad — [NÁYADE](https://www.sanidad.gob.es/areas/sanidadAmbiental/calidadAguas/aguasBanno/nayade.htm),
  portal verificado en vivo (`nayadeciudadano.sanidad.gob.es`).
- Windy.app — [App Store](https://apps.apple.com/us/app/windy-app-wind-tides-radar/id997079492),
  [novedades de mareas](https://windy.app/news/now-you-can-see-and-choose-tides-from-the-lat-and-mllw-datums.html).
- Tides4fishing — [tablas solunares](https://tides4fishing.com/solunar-tables).

**Firmado:** robot buscador de fuentes (pasada de buenas prácticas de
otras apps), 2026-09-23 15:38 UTC.

### 2026-09-23 18:45 UTC (pasada buscadora — corrientes marinas por zona, novena pasada)

**Qué se buscó:** la pasada anterior (2026-09-21 18:52 UTC, octava) dejó
pendiente repetir para **EUSKOOS** y **Galicia** el mismo barrido
sistemático de "celda válida más cercana a cada spot" ya hecho para
Gibraltar/South/PLOCAN (2026-09-20) y Lisboa/Ibiza (2026-09-21) — hasta
ahora esas dos zonas solo se habían calibrado contra un único spot cada
una (Mundaka y A Guarda), sin comprobar el resto de spots de su costa.
Petición real al griddap de EMODnet ERDDAP (filtrando `QCflag=1` Y
`CSPD_QC=1`, ambos "buenos") para los 16 spots vascos (EUSKOOS) y los 11
spots gallegos (Galicia).

**Hallazgo 1, el mejor de toda la serie — Mundaka a solo 0.6 km.**
Confirmado en vivo (`time_coverage_end` EUSKOOS = hoy 12:00 UTC): la
celda real más cercana a Mundaka está a **0.6 km**, mejor que el mejor
caso anterior (Lisboa/Costa da Caparica, 1.1 km, ver pasada del
2026-09-21). El resto de la costa vasca también tiene cobertura
razonable, algo que no se sabía hasta ahora al haber calibrado solo
Mundaka: Getaria 1.7 km, zumaia 2.6 km, bakio 3.0 km, deba 4.0 km, orio
4.1 km, ondarroa/pasaia/lekeitio/hondarribia/zarautz/mutriku entre 4.5 y
4.8 km, plentzia 5.5 km, donostia 5.7 km, sopelana 8.5 km, getxo 12.9 km
— toda la costa vasca queda dentro de 13 km de una celda válida, la
cobertura más completa y cercana de las 9 zonas comprobadas hasta ahora.

**Hallazgo 2 — Galicia mejora su mejor caso conocido, pero sigue lejos.**
La celda real más cercana no es A Guarda (46 km, hallado el 2026-09-18)
sino **Illas Ons, entre 36 y 65 km según la hora** (la rejilla con datos
válidos de esta red cambia bastante de una hora a otra — comprobado en
4 horas del mismo día: 65.2, 38.0, 36.0, 36.0 km). Sigue confirmándose
que el radar de Galicia solo cubre mar abierto, nunca la franja pegada a
la costa ni el interior de las rías (Baiona 42.6 km, Cangas 47.0 km,
Sanxenxo 46.4 km, Corrubedo 38.9 km — ninguno por debajo de los ~36 km
de Ons) — A Coruña (141 km) y Ribadeo (233 km), los dos spots del norte
de Galicia, quedan totalmente fuera de esta red.

**Calibración real, 6 puntos nuevos** (`CALIBRACION.jsonl`, `tipo:
"corriente_radar_hf_vs_openmeteo"`, con `wind_speed_unit=ms` explícito,
ver el aviso de unidades de la pasada del 2026-09-21): 2 en Mundaka
(09:00 y 12:00 UTC de hoy) y 4 en Illas Ons (06:00, 09:00, 12:00 y 15:00
UTC). Mismo patrón ya asentado en las 8 pasadas anteriores — nunca
coinciden velocidad y dirección a la vez: en Mundaka 12:00 UTC la
dirección casi coincide (17.6° de diferencia) pero la velocidad real es
el doble; en Ons 15:00 UTC la dirección casi coincide (6°) pero la
velocidad real es más de 6 veces la de Open-Meteo. Con esto ya son **29
puntos en 9 zonas**, ninguno con corrección estable.

**Conclusión — sigue siendo solo propuesta**, no cambio de código
(tocaría `functions/prevision.js` y es decisión de producto, ver
`ROBOT_REGLAS.md`): con el barrido de hoy, las 9 zonas de radar HF ya
tienen su distancia real a spot comprobada de forma sistemática (no solo
"vivo", sino "a cuántos km de qué spot en concreto"). Mundaka (0.6 km)
pasa a ser, con diferencia, el mejor candidato de toda la serie para una
eventual capa de "corriente observada" aparte del modelo — sin que esto
cambie la recomendación de fondo: mostrarla como observación real
aparte, nunca como sustituto ni corrección de Open-Meteo, dado que
ninguna de las 9 zonas muestra relación estable entre radar y modelo.

**Fuentes:**
[EMODnet Physics ERDDAP — EUSKOOS NRT](https://erddap.emodnet-physics.eu/erddap/info/EUHFR_NRTcurrent_HFR-EUSKOOS-Total/index.html),
[EMODnet Physics ERDDAP — Galicia NRT](https://erddap.emodnet-physics.eu/erddap/info/EUHFR_NRTcurrent_HFR-Galicia-Total/index.html),
[Open-Meteo — Marine Weather API docs](https://open-meteo.com/en/docs/marine-weather-api).

**Firmado:** robot buscador de fuentes (pasada de corrientes marinas),
2026-09-23 18:45 UTC.

### 2026-09-23 23:20 UTC (pasada buscadora — presión atmosférica e histórico por zona, décima pasada)

**Contexto:** las pasadas 8ª y 9ª (2026-09-21/22) concluyeron "sin ningún
pendiente evidente" y recomendaron espaciar este tema. Antes de repetir
esa misma conclusión, se revisó qué zonas geográficas cubrían realmente
las 9 pasadas anteriores — **ninguna mencionaba nunca Mediterráneo,
Golfo de Cádiz, Baleares ni Canarias**, pese a que la app tiene ~44 spots
mediterráneos (`SPOTS_MEDITERRANEO`), 4 de Golfo de Cádiz y 4 de
Canarias en `index.html`. Todo el trabajo previo de "por zona" se había
concentrado sin excepción en Cantábrico/Atlántico/Galicia/Portugal. Esta
pasada cubre ese hueco geográfico real, no repetido antes.

**Hallazgo verificado con petición HTTP real — Meteocat/XEMA (Catalunya)
tiene histórico de presión abierto, sin clave, desde 2009.** El portal
"Dades obertes de Catalunya" (Socrata) republica en abierto la Xarxa
d'Estacions Meteorològiques Automàtiques (XEMA) del Servei Meteorològic
de Catalunya:

```
GET analisi.transparenciacatalunya.cat/resource/nzvn-apee.json?codi_variable=34&$limit=5&$order=data_lectura ASC
→ 200, primer registro real: estació "CA", 2009-01-01T00:00:00, 940 hPa
GET .../nzvn-apee.json?codi_variable=34&$limit=5&$order=data_lectura DESC
→ 200, último registro: 2026-09-23T22:00:00 (¡de hoy!), valores 889.9-1023.3 hPa
```

`codi_variable=34` = "Pressió atmosfèrica" (confirmado por la propia
documentación de Meteocat, no asumido). Los valores bajos (889.9, 909.8)
corresponden a estaciones de montaña sin reducir a nivel del mar — para
estaciones costeras de poca altitud el dato ya sirve tal cual. Endpoint
de metadatos de estaciones (`.../resource/yqwd-vj5e.json`) trae
coordenadas/altitud/municipio exactos por estación — permitiría elegir
a mano la más cercana a cada spot de Girona/Barcelona/Tarragona
(roses, blanes, cambrils y el resto de `SPOTS_MEDITERRANEO` de esas
provincias) igual que se hizo con `ESTACIONES_AEMET`. **Sin API key**
para esta vía (el portal Socrata es de acceso público); la API oficial
de Meteocat (`apidocs.meteocat.gencat.cat`) sí exige registro para
tiempo real, pero no hace falta para este histórico. Cubre exactamente
el mismo hueco que ya resolvían MeteoGalicia/Euskalmet para sus zonas,
pero para Catalunya — ningún hallazgo así se había verificado antes en
las 9 pasadas previas.

**Hallazgo verificado con petición HTTP real — SOCIB (Baleares) opera
una red dedicada de BARÓMETROS, no solo boyas de oleaje.** Confirmado
en vivo: `https://thredds.socib.es/thredds/catalog/mooring/barometer/catalog.html`
(`200`) lista varias estaciones reales (`station_sarapita-scb_baro007`,
`station_santantoni-scb_baro010`, `station_santantoni-scb_baro002`...),
cada una con datos por niveles `L0` (crudo)/`L1` (procesado) vía THREDDS/
OPeNDAP (NetCDF), sin API key. Es más específico que las boyas
meteo-oceánicas genéricas de Sóller/Bahía de Palma ya conocidas por
búsqueda (esas miden viento/presión/temperatura de forma más genérica).
**Limitación real, no un problema de esta fuente sino de formato**: a
diferencia de AEMET/Meteocat (JSON simple), el acceso es NetCDF vía
OPeNDAP — igual de "no trivial de integrar" que ya se documentó para el
histórico de Puertos del Estado (ver pasada del 2026-09-15) — necesitaría
una librería NetCDF o parseo binario propio, no un simple `fetch()+JSON`.
Anotado como candidato real para Baleares (`palma`, `ciutadella`,
`formentera`, `calamillor`, `sonbou`, `muro`) pero con esa salvedad de
formato — no se ha verificado todavía qué estación de las listadas es la
más cercana a cada uno de esos spots.

**Comprobado y DESCARTADO — RIA (Red de Información Agroclimática de
Andalucía, IFAPA/Junta de Andalucía), candidata para Golfo de Cádiz**:
su documentación oficial (confirmada también por el paquete R
`meteospain`, que replica su API) lista sus variables — temperatura,
humedad, precipitación, viento, radiación solar — y **no incluye presión
atmosférica en ningún caso**. No se pudo hacer una petición HTTP directa
contra `juntadeandalucia.es` desde este entorno (timeout/`ECONNREFUSED`
en dos intentos, dominio distinto de los ya probados hoy con éxito como
`transparenciacatalunya.cat` — puede ser un bloqueo puntual de red de
este runner hacia ese dominio en concreto, no necesariamente de la
fuente), pero como el motivo del descarte es la ausencia documentada de
la variable que buscamos (no un problema de acceso), no hace falta
insistir en verificarlo por HTTP: aunque respondiera, no aportaría
presión. Golfo de Cádiz (`cadiz`, `conil`, `chipiona`, `puntaumbria`) y
Canarias (`laspalmas`, `santacruztenerife`, `elmedano`, `corralejo`) se
quedan, de momento, sin ninguna red autonómica propia con presión
verificada — igual que ya se concluyó para Cantabria/Asturias en la 9ª
pasada, dependen de `ESTACIONES_AEMET` (ya cubre Jerez/Huelva para
Cádiz-Huelva y las 4 islas de Canarias) y del modelo de Open-Meteo.

**Por qué solo propuesta, no implementación** (ver `ROBOT_REGLAS.md`):
integrar Meteocat o SOCIB tocaría `functions/prevision.js` (arrays de
estaciones nuevos + función de lectura, mismo patrón que
`ESTACIONES_AEMET`) e `index.html` (marcador en el mapa) — por encima
del límite de volumen para aplicar directo, y es un dato que se muestra
al usuario como fiable. No se ha tocado código.

**Propuesta concreta para el usuario, si se retoma:**
1. Curar una lista `ESTACIONES_METEOCAT` (código de estación + nombre +
   coordenadas, sacados del endpoint de metadatos `yqwd-vj5e.json`,
   verificados uno a uno) para los spots mediterráneos de Girona/
   Barcelona/Tarragona — mismo patrón que `ESTACIONES_AEMET`.
2. Para Baleares, evaluar primero si merece la pena el coste de parsear
   NetCDF/OPeNDAP de SOCIB solo para presión, dado que `ESTACIONES_AEMET`
   ya cubre Palma/Ibiza/Menorca en tiempo real — SOCIB aportaría sobre
   todo profundidad histórica específica de barómetro, no necesariamente
   algo que falte hoy.
3. Golfo de Cádiz y Canarias: sin acción nueva, ya cubiertos por AEMET
   nacional (climatologías diarias, mismo pendiente de siempre — hace
   falta la `AEMET_API_KEY` desde una function, no desde este runner).

**Conclusión de esta pasada**: al contrario que las dos anteriores, sí
había un hueco real (geográfico, no solo técnico) sin investigar antes.
Con Mediterráneo (Catalunya) y Baleares ya con al menos una fuente
institucional identificada y verificada, y Golfo de Cádiz/Canarias
confirmados como dependientes de AEMET nacional (sin alternativa
autonómica con presión), el mapa de "presión por zona" queda ahora sí
completo para las 10 zonas de la rotación de este robot. Recomendación
para la próxima vez que toque este tema: sin una fuente nueva concreta
que investigar, valdría la pena que el usuario decida si espaciar esta
área (como ya sugerían las pasadas 8ª/9ª) o reasignar el hueco a otra
investigación, como caudal de ríos o mar de fondo.

**Fuentes:**
[Dades obertes de Catalunya — Dades meteorològiques de la XEMA](https://analisi.transparenciacatalunya.cat/Medi-Ambient/Dades-meteorol-giques-de-la-XEMA/nzvn-apee/data),
[Meteocat — informació de variables XEMA](https://www.meteo.cat/wpweb/divulgacio/equipaments-meteorologics/estacions-meteorologiques-automatiques/xarxa-destacions-meteorologiques-automatiques-xema/informacio-sobre-les-dades-meteorologiques-de-les-ema-que-es-mostren-al-web/),
[SOCIB — THREDDS, catálogo de barómetros](https://thredds.socib.es/thredds/catalog/mooring/barometer/catalog.html),
[SOCIB — datos meteoceánicos](https://www.socib.es/es/que-hacemos/datos-meteoceanicos),
[IFAPA — Red de Información Agroclimática de Andalucía (RIA)](https://www.juntadeandalucia.es/agriculturaypesca/ifapa/riaweb/web/inicio_estaciones),
[paquete R meteospain — documentación RIA](https://cran.r-project.org/web/packages/meteospain/vignettes/ria.html).

**Firmado:** robot buscador de fuentes (pasada de presión atmosférica e
histórico por zona), 2026-09-23 23:20 UTC.

### 2026-09-25 08:20 UTC (pasada buscadora — webcams, zona Comunidad Valenciana y Murcia)

**Objetivo de la pasada:** rotación automática de zonas para la busqueda
de camaras (ver ROBOT_REGLAS.md, seccion "Aprendizaje por zonas").
Zona de hoy: Comunidad Valenciana y Murcia — primera vez que esta zona
se investiga con el sistema de rotacion por zonas.

**Punto de partida:** de los spots fijos de esta zona, la Comunitat
Valenciana (valencia, gandia, denia, calpe, alicante, benidorm,
santapola, oropesa, cullera y varios mas) ya tiene camara desde 2026-09-09
via Turisme Comunitat Valenciana (28 camaras). Solo los 2 spots de
Murcia — `cartagena` y `aguilas` — seguian sin ninguna camara, asi que
la busqueda se centro en esas 2 poblaciones.

**Aguilas: 4 camaras reales encontradas y verificadas, provider nuevo
para el repo (SkylineWebcams).** Snapshot JPEG directo, sin token, en
`https://cdn.skylinewebcams.com/live<ID>.jpg`:
- `live1448.jpg` — "Puerto deportivo de Aguilas" (marina + castillo de
  fondo, mejor composicion de las 4).
- `live911.jpg` — "Aguilas" (vista panoramica ciudad+puerto).
- `live260.jpg` — "Aguilas Yacht Club" — confirmado de forma cruzada
  con la propia web del Club Nautico de Aguilas (`cnaguilas.com/webcam.html`,
  que embebe la misma imagen via `embed.skylinewebcams.com/img/260.jpg`).
- `live5963.jpg` — "Aguilas - Bahia de Levante" (playa, mas alejada del
  puerto que las otras 3).

Las 4 verificadas con `Last-Modified` a menos de 10 minutos de la
comprobacion (peticion real, dos veces espaciadas donde hizo falta).
**Limitacion real de calidad**: las 4 son 344x193px, resolucion baja
(SkylineWebcams las regenera a partir de su propio video, no es la
resolucion nativa de la camara) — peor que la mayoria de camaras ya
integradas en el repo. El video real (HLS) de SkylineWebcams exige un
token de sesion que cambia en cada carga de pagina (visto en el HTML:
`livee.m3u8?a=<token>`) — mismo bloqueo ya documentado para `rtsp.me`
(Asturias/Galicia) y el HLS de `tendsys.net` (Cantabria), asi que
integrar video en vez del JPEG exigiria un proxy de token propio,
desarrollo nuevo fuera del alcance de esta pasada.

**Propuesta (no aplicada — toca `functions/webcam/[slug].js` e
`index.html`, cae fuera de "correccion trivial" segun ROBOT_REGLAS.md):**
anadir `aguilas` a `WEBCAMS`/`SPOTS_CON_WEBCAM`, con `live1448.jpg` como
fuente principal (mejor composicion) y las otras 3 como reserva en el
mismo array — pendiente de decision del usuario, sobre todo por la
resolucion baja frente al resto de camaras del repo.

**Cartagena: ninguna camara real verificable, pese a una candidata
obvia sin poder confirmarla.** La Autoridad Portuaria de Cartagena
(`apc.es/webapc/puerto/webcam`) es la fuente que cualquier busqueda
sugiere primero, y `meteomurcia.com` confirma que existe de verdad
(embebe `controlvideo.apc.es:15378`) — pero tanto `www.apc.es` como
`controlvideo.apc.es` dieron `HTTP 000` (conexion rechazada) desde este
entorno, mismo patron de bloqueo de red ya documentado (2026-08-31)
para dominios que no son de infraestructura reconocida. **No se puede
descartar que la camara funcione de verdad — solo que no se pudo
verificar desde aqui.** Pendiente de reintentar desde una sesion
interactiva o confirmar a mano (recomendacion: probar
`https://www.apc.es/webapc/puerto/webcam` desde un navegador normal).

Otras candidatas para Cartagena, descartadas con evidencia real (no por
falta de busqueda):
- `playawebcams.com/andy/webcam-cartagena.jpg` / `webcam-puerto-cartagena.jpg`
  — imagenes muertas desde 2018 y 2015 (`Last-Modified` confirmado en
  dos peticiones separadas).
- `meteosurfcanarias.com/1-webcams/webcam-murcia.jpg` — se actualiza de
  verdad, pero resulto ser la misma vista de Aguilas (ciudad+puerto+
  castillo) mal etiquetada como "murcia" generico — no vale para el
  spot de Cartagena.
- `cabo-de-palos.jpg` (mismo agregador) — real y actualizada, pero es
  Cabo de Palos, ~20km del puerto de Cartagena — spot equivocado.
- SkylineWebcams solo tiene "La Manga del Mar Menor - Cartagena"
  (`live490.jpg`), que es la franja de La Manga (~37.7, -0.78), lejos
  del spot `cartagena` de la app (37.605, -0.986, el puerto/ciudad) —
  mismo tipo de error ya descartado para Orihuela.
- Windy tiene pagina de camara "Cartagena/Puerto" pero es una SPA sin
  datos en el HTML servido — no se pudo extraer el ID real sin usar su
  API (pendiente de retomar si aparece un agregador espanol que
  reincruste camaras de Windy con el ID visible en HTML estatico).
- Outdooractive lista una camara de usuario en Playa de las Salinas (no
  el puerto) sin URL de imagen verificable en el HTML servido.

**Terminos de busqueda probados (protocolo de poda de ROBOT_REGLAS.md,
2 poblaciones: Cartagena y Aguilas)**: `webcam directo` — con resultado
en Aguilas; `webcam ayuntamiento` — sin resultado en ninguna de las 2;
`webcam club nautico`/`webcam puerto deportivo` — con resultado en
Aguilas (Club Nautico de Aguilas); `webcam surf` — sin resultado en
ninguna de las 2 (hay escuelas de surf reales en ambas, ninguna con
webcam propia); `webcam pesca`/`webcam puerto`/`webcam cofradia de
pescadores` — sin resultado nuevo distinto de lo ya cubierto arriba.
Detalle completo y aprendizajes generalizables anadidos a
`ROBOT_REGLAS.md`, seccion "Aprendizaje por zonas" → "Zona: Comunidad
Valenciana y Murcia".

**Sin cambios de codigo aplicados esta pasada** — la unica camara nueva
verificable (Aguilas) exige tocar `functions/webcam/[slug].js` e
`index.html`, fuera del limite de aplicacion directa; queda como
propuesta arriba.

**Fuentes:**
[SkylineWebcams — Aguilas (Puerto deportivo)](https://www.skylinewebcams.com/en/webcam/espana/region-de-murcia/murcia/marina-di-aguilas.html),
[SkylineWebcams — Aguilas](https://www.skylinewebcams.com/en/webcam/espana/region-de-murcia/murcia/aguilas.html),
[SkylineWebcams — Aguilas Yacht Club](https://www.skylinewebcams.com/en/webcam/espana/region-de-murcia/murcia/aguilas-yacht-club.html),
[Club Nautico de Aguilas — Webcam](https://www.cnaguilas.com/webcam.html),
[MeteoMurcia — Webcam Puerto de Cartagena](https://www.meteomurcia.com/webcampuertocartagena.php),
[Autoridad Portuaria de Cartagena — Webcam](https://www.apc.es/webapc/puerto/webcam).

**Firmado:** robot buscador de fuentes (pasada de camaras, zona Comunidad
Valenciana y Murcia), 2026-09-25 08:20 UTC.

---

### 2026-09-25 (nota de reglas, no una pasada de investigación)

**Cambio de reglas que invalida una conclusión repetida en las entradas de
cámaras de arriba.** Varias pasadas anteriores cerraron con la idea de que
una cámara verificada no se podía integrar si no había spot para ella, o si
integrarla obligaba a tocar `functions/`. Las dos cosas han dejado de ser
verdad hoy, por petición explícita del usuario. **No reutilices esas
conclusiones**: ahora manda la sección "Cámara con mar a la vista → se
integra siempre, y si no hay spot se crea" de `ROBOT_REGLAS.md`.

En resumen: toda cámara con mar a la vista (comprobado MIRANDO la imagen con
`Read`, no por su nombre) se integra siempre, y si no existe spot para ese
punto, el spot se crea en la misma pasada — hasta 5 por pasada, siguiendo
los 7 puntos de edición y las comprobaciones obligatorias de esa sección.
Es la única excepción al límite de volumen y al veto de tocar `functions/`,
y solo de forma aditiva.

Quedan en cola, ya verificadas en pasadas anteriores y pendientes solo de
esto: las 7 cámaras de Windy Webcams de los spots portugueses (2026-09-23,
solo integrarlas, los spots ya existen), las 11 de MeteoGalicia sin spot
(2026-09-14, les faltan encuadre y coordenadas) y `puntaluzero`.

**Aviso, sin relación con las reglas**: las 4 pasadas del 2026-09-24
fallaron a los ~20 segundos con `Credit balance is too low` — la
`ANTHROPIC_API_KEY` de GitHub Actions se quedó sin saldo. Es el motivo de
que no haya ninguna entrada entre el 2026-09-20 y hoy, no que no hubiera
nada que contar.

**Firmado:** sesión interactiva con el usuario (cambio de reglas),
2026-09-25.

### 2026-09-25 14:15 UTC (pasada buscadora — mareas y oleaje)

**Calibración — 4 puntos nuevos, mismo método de siempre.** `curl` real a
`poem.puertos.es/portus/StationData` para la altura medida, Marine API de
Open-Meteo en las coordenadas exactas de cada boya para la calculada,
emparejando por la hora UTC exacta del último dato real:

| boya | hora UTC | altura medida | altura calculada | diferencia | % |
|---|---|---|---|---|---|
| 2136 Bilbao-Vizcaya | 14:00 | 1.41 m | 1.40 m | −0.01 m | −0.7% |
| 1117 Gijón | 13:00 | 0.94 m | 1.30 m | +0.36 m | +38.3% |
| 1101 Pasaia II | 13:00 | 1.17 m | 0.82 m | −0.35 m | −29.9% |
| 2820 Dragonera | 14:00 | 0.59 m | 0.32 m | −0.27 m | −45.8% |

Añadidos a `CALIBRACION.jsonl`. **Pasaia II llega a 22 puntos, los 22 con
el mismo signo negativo** (media 22 puntos ≈ **−28.2%**, estable respecto
a las medias ya escritas en `ROBOT.md` los días anteriores) — sigue sin
ninguna excepción de signo, no hace falta repetir la propuesta de factor
de corrección ya hecha por el robot de calibración nocturna, este punto
solo confirma que se mantiene. Bilbao-Vizcaya (22 puntos) sigue sin
patrón sistemático claro. Gijón (22 puntos) tampoco, aunque el punto de
hoy es la desviación positiva más grande vista hasta ahora para esta boya
(+38.3%, sobre un oleaje pequeño de 0.94 m — con alturas tan bajas el
porcentaje es poco fiable, mismo aviso de siempre). Dragonera (rotación,
candidata con más días sin repetirse desde el 2026-09-21) llega a 5
puntos, 4 de 5 negativos (media 5 puntos ≈ −29.8%) — empieza a parecerse
en magnitud a Pasaia II, pero con una muestra todavía pequeña y un signo
positivo suelto en medio (2026-09-17, +2.1%), no tan limpio como Pasaia.

**Búsqueda de puntos de calibración nuevos: las otras 7 boyas de oleaje
de SOCIB (más allá de Bahía de Palma y Canal de Ibiza, ya propuestas el
2026-09-22) están MUERTAS o llevan meses/años sin dato — verificado en
vivo una por una, ninguna se propone.** La pasada del 2026-09-22 dejó
anotado el catálogo completo de SOCIB
(`thredds.socib.es/thredds/catalog/mooring/waves_recorder/`) con más
despliegues sin explorar (Sóller, Portocolom, y los "MOBIMS" de
Muro/Cala Millor/Son Bou/Playa de Palma) como candidatas para calibración
balear adicional. Se comprobó cada una en esta pasada, cogiendo siempre
el despliegue con el número más alto (el "activo" de cada catálogo) y
pidiendo el ÚLTIMO punto real de su serie temporal vía OPeNDAP (mismo
método que Bahía de Palma/Canal de Ibiza, `.ascii` sobre el índice final
del array `time`) — **truco de sintaxis anotado aquí para no repetir la
búsqueda: los corchetes de índice OPeNDAP hay que mandarlos
URL-codificados (`%5B`/`%5D`), sin codificar `curl` los trata como rango
de globbing y la petición falla en silencio (exit 1, sin cuerpo de
respuesta)**:

| estación | último dato real | de cuándo | ¿utilizable hoy? |
|---|---|---|---|
| Sóller (`buoy_soller-scb_wave008`, dep0001) | Hm0 0.43 m, QC=1 (bueno) | 2026-06-02 | No — casi 4 meses de retraso |
| Portocolom (`buoy_portocolom-scb_wave005`, dep0002) | Hm0 "655.34 m" (valor de relleno, no real), QC=4 (dato malo) | 2026-04-01 | No — muerta, último valor ni siquiera es un dato real |
| Cala Millor (`mobims_calamillor-scb_awac005`, dep0019) | Hm0 1.3 m | 2025-11-13 | No — más de 10 meses |
| Muro (`mobims_muro-scb_awac005`, dep0020) | Hm0 0.12 m | 2026-07-09 | No — casi 3 meses |
| Son Bou (`mobims_sonbou-scb_awac006`, dep0001) | Hm0 0.09 m | 2026-05-26 | No — 4 meses |
| Playa de Palma (`mobims_playadepalma-scb_awac005`, dep0002) | Hm0 0.16 m | **2015-10-08** | No — más de 10 años, el despliegue "activo" del catálogo lleva una década parado |
| Son Blanc (`station_sonblanc-pib_rdi002`, dep0002 — nótese que este es de Ports IB, no de SOCIB directamente, aunque vive en el mismo THREDDS) | Hm0 0.14 m, QC=1 | 2018-09-10 | No — 8 años |

**Conclusión, para no repetir esta comprobación**: de las 9 plataformas de
oleaje que publica el THREDDS de SOCIB, solo 2 (Bahía de Palma y Canal de
Ibiza) están vivas de verdad hoy — las otras 7 aparecen en el catálogo
como si tuvieran un despliegue "activo" (número de `dep` más alto,
fichero `_latest.nc`), pero su último dato real es viejo, en un caso
(Playa de Palma) de hace una década. **El nombre del fichero
(`_latest.nc`) no significa "actualizado hoy", solo "el fichero agregado
de este despliegue"** — antes de proponer cualquier estación de este
catálogo hay que comprobar siempre el último timestamp real de su serie,
nunca fiarse del nombre. No hace falta volver a revisar estas 7
concretas salvo que aparezca alguna señal de que SOCIB las ha
reactivado (redespliegue nuevo con número de `dep` más alto que los ya
vistos aquí).

**Sin cambios de código aplicados esta pasada** — la calibración solo
añade filas a `CALIBRACION.jsonl` y esta entrada a `ROBOT.md`; no se
encontró ninguna fuente nueva utilizable que proponer o integrar.

**Fuentes:**
[poem.puertos.es — StationData (Puertos del Estado, boyas reales)](https://poem.puertos.es/portus/StationData),
[Open-Meteo Marine API](https://marine-api.open-meteo.com/v1/marine),
[THREDDS SOCIB — catálogo de boyas de oleaje](https://thredds.socib.es/thredds/catalog/mooring/waves_recorder/catalog.html).

**Firmado:** robot buscador de fuentes (pasada de mareas y oleaje),
2026-09-25 14:15 UTC.

### 2026-09-25 15:03 UTC (robot de cámaras caídas — primera pasada)

**9 cámaras en rojo, agrupadas por proveedor antes de tocar nada** (regla
"Cámara caída: primero descarta que se haya MOVIDO" de `ROBOT_REGLAS.md`):

**Caída de proveedor, no investigadas una a una (6 de las 9):**
- `comillas`, `suances`, `sanvicente` — las tres en `www.cantabria.es`.
  Ahora mismo ni siquiera responden: timeout puro a los 15s en las tres
  (antes `http_502`, 48 fallos seguidos cada una — ha empeorado, sigue
  siendo su lado, no el nuestro).
- `calamillor`, `sonbou`, `muro` — las tres en `apps.socib.es`. El
  endpoint que consultamos sí responde (`307`, redirige a
  `images.socib.es/convert/...`), pero ese host de destino da timeout
  puro. Es la misma caída para las tres (mismo patrón de redirección,
  mismo destino roto), 48 fallos seguidos cada una.

Ninguna de las 6 necesita ninguna URL nueva: el problema no está en
nuestra URL guardada, está en la infraestructura del proveedor. No hay
nada que aplicar — si sigue igual en la próxima pasada, revisar de nuevo
sin repetir toda esta comprobación palabra por palabra.

**`sopelana` — ya arreglada por el commit anterior de este mismo robot,
solo pendiente de que el monitor se entere.** El alias IPCamLive nuevo
(`s153/99eod1rsuvg7yjnvk`) ya estaba aplicado en los 2 sitios donde vive
(`index.html`, `functions/webcam/[slug].js`) desde el commit `ae4153b` de
hoy. Verificado en esta pasada: `200` real, `EXT-X-MEDIA-SEQUENCE`
avanzando de 28907 a 28909 entre dos lecturas separadas 6s. `camara_estado`
todavía la marca roja (`sin_respuesta`, 24 fallos, última señal
2026-09-21) porque `camaras-salud.yml` no ha vuelto a pasar desde que se
aplicó el fix (cada 30 min) — se espera que se ponga verde sola en la
próxima pasada de salud, sin que haga falta tocar nada más.

**`santona` — corregida esta pasada, mismo patrón que Sopelana (alias de
IPCamLive movido).** La URL guardada (`s110/6erjzdw9wypirqvta`) daba `404`
puro. La web de Watsay Surf School (`watsaysurfschool.com/webcam/`) sigue
embebiendo IPCamLive, pero con un alias distinto
(`ipcamlive.com/player/player.php?alias=webcamberria`); resolviendo ese
player salió el servidor/streamid de hoy (`s123/7bz57yv0sddgbiwei`).
Verificado: snapshot con `Last-Modified` de hace segundos, y mirando el
fotograma con `Read` se ve la playa de Berria de verdad (dunas, un
surfista cogiendo una ola, gente paseando perros) — sitio correcto, no
otra cámara. Aplicado en los 2 sitios donde vivía la URL vieja
(`index.html` y `scripts/camaras/comprobar-camaras.mjs`, encontrados con
`Grep` por el streamid, no por el slug) y validado con
`node --check` sobre el módulo JS extraído de `index.html`. Commit y push
directos a `main`, como permite la regla para una corrección trivial de
URL movida.

**`deba` — investigada, sin sustituta que aplicar, no es un caso de "se
ha movido".** La URL guardada
(`58f14c0895a20.streamlock.net/camaramar/GIP_deba_169.stream/playlist.m3u8`)
da `404` en repetidos intentos (con y sin `Referer`). Comprobado que no es
una caída del proveedor entero: las cámaras hermanas del mismo servidor
(`hondarribia`, `zarautz`, `getaria`, `mutriku`) responden `200`
perfectamente ahora mismo. Comprobada la página oficial de la Diputación
(`gipuzkoa.eus/es/web/hondartzak/webcams/deba`, HTML crudo vía `curl`, no
solo `WebFetch`): **sigue embebiendo exactamente esa misma URL** — no hay
ningún alias nuevo que resolver, el dueño no la ha movido, así que el 404
es la cámara/codificador real caído en origen, algo que no podemos
arreglar desde aquí. Probadas variantes de nombre por si acaso
(`GIP_deba_hd`, `GIP_deba`, `GIP_deba2`, `GIP_deba_720`) — las 4, `404`.
Se deja tal cual (última señal real: 2026-09-21T02:05 UTC, 25 fallos
seguidos) para que la próxima pasada no repita esta búsqueda a ciegas —
solo merece revisarse de nuevo si cambia el motivo del fallo en
`camara_estado` (p.ej. pasa a `404` con las hermanas también caídas, señal
de que sí se ha movido el servidor entero).

**Resumen de lo aplicado**: 1 URL corregida (`santona`), 1 ya corregida
por un commit anterior y solo pendiente de que el monitor la vea
(`sopelana`), 6 descartadas como caída de proveedor (sin acción posible
desde aquí), 1 sin sustituta encontrada y documentada para no repetir la
búsqueda (`deba`).

**Firmado:** robot de cámaras caídas, 2026-09-25 15:03 UTC.

---

### 2026-09-25 17:05 UTC (búsqueda manual de alternativas — Zumaia y Deba)

Hecha a mano en sesión interactiva, no por el robot, porque Zumaia todavía no
figuraba como roja (tenía `fallos_seguidos = 1`, por debajo del umbral de 2) y
el robot no la habría mirado. Ese hueco se cerró el mismo día: ahora la
consulta del robot incluye también `fallos_seguidos >= 1`.

**Las dos están rotas en origen. No se han movido, y no hay alternativa viva
hoy.** Detalle de lo comprobado, para que la próxima pasada no repita nada de
esto:

**Zumaia** (`GIP_zumaia2.stream`) y **Deba** (`GIP_deba_169.stream`) dan `404`
en el servidor de la Diputación de Gipuzkoa.

- **El resto de la red de Gipuzkoa está perfecta**: `GIP_hondarribia_169`,
  `GIP_zurriola_169`, `GIP_zarautz_169` y `GIP_getaria_169` responden `200`.
  No es una caída del proveedor: son esas dos en concreto. (Buen ejemplo de
  por qué agrupar por proveedor engaña — ver la regla corregida ese día.)
- La aplicación del servidor sigue siendo `camaramar` y funciona
  (`camaras`, `webcams`, `live` y `hondartzak` dan 404).
- Probadas sin éxito 13 variantes de nombre: `GIP_zumaia`, `GIP_zumaia_169`,
  `GIP_zumaia3`, `GIP_zumaia169`, `GIP_itzurun`, `GIP_itzurun_169`,
  `GIP_itzurun2`, `GIP_deba`, `GIP_deba2`, `GIP_deba3`, `GIP_deba169`,
  `GIP_santiago_169`, `GIP_ondarbeltz_169`. **No seguir adivinando nombres**:
  no es el método.
- **Las webs de sus propios dueños embeben la MISMA URL muerta**:
  `gipuzkoa.eus/es/web/hondartzak/webcams/deba` y
  `zumaia.eus/eu/turismoa/zer-egin-zumaian/webcam`. Esa es la prueba de que
  no se han movido: si hubieran cambiado de dirección, el dueño ya estaría
  apuntando a la nueva.

**Alternativa buscada y descartada — kostasystem.com** (el mismo proveedor de
Mundaka). La encontró la web de `escueladesurfsopelana.com`, que tiene página
propia de Deba:

| Carpeta | Estado | Fecha real de la imagen |
|---|---|---|
| `deba/camara1..4_snap.jpeg` | 200, ~300 KB | **6 de febrero de 2026** |
| `itzurun/camara1..2_snap.jpeg` | 200, ~250 KB | **28 de enero de 2026** |

Siete y ocho meses de antigüedad. Es exactamente la trampa ya documentada en
`ROBOT_REGLAS.md`: **kostasystem responde `200` con imágenes muertas**. Si
alguien las integra sin mirar la fecha, la app enseñará una foto de invierno
como si fuera de ahora, que es peor que no enseñar nada.

**Conclusión:** Zumaia y Deba se quedan sin cámara. No es un fallo nuestro ni
hay nada que arreglar en el repo — las cámaras están apagadas en origen y
tampoco existe sustituta viva. Si la Diputación las reactiva, volverán solas
(las URLs que tenemos son las correctas y siguen siendo las que publica el
dueño).

**Términos ya probados, para no repetirlos**: "webcam en directo playa Itzurun
Zumaia", "Deba/Zumaia webcam surf en directo ipcamlive/youtube". Vías
pendientes por si alguien retoma esto: Windfinder (`zumaia_faro`),
`camarastrafico.com.es` y `surf-forecast.com` — los tres son agregadores, así
que lo más probable es que embeban la misma fuente muerta, pero no se han
comprobado.

**Firmado:** sesión interactiva con el usuario (búsqueda manual de
alternativas), 2026-09-25.
