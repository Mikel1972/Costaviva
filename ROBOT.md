# ROBOT.md — bitácora del robot de datos de Costa Viva

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
usuarios de Costa Viva (Euskadi, Cantabria, Asturias, Galicia). Una
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
para Costa Viva por dos motivos**: (a) no cubre la costa cantábrica/gallega
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
PROPUESTA (no aplicada).** Costa Viva cubre España y Portugal pero hoy
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
de España y Portugal (el ámbito real de Costa Viva, no solo el
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
cláusula NC es un problema real ahora que Costa Viva tiene paywall de
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
usuarios de Costa Viva. Esta pasada buscó los **equivalentes
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
sesión es la rutina "Costa Viva — calibración nocturna", no el "Robot de
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
"Costa Viva — calibración nocturna", distinta de la auditoría semanal
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

**Pasada nocturna diaria, mismo alcance estrecho** (rutina "Costa Viva —
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

**Pasada nocturna diaria, mismo alcance estrecho** (rutina "Costa Viva —
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

**Pasada nocturna diaria, mismo alcance estrecho** (rutina "Costa Viva —
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

**Pasada nocturna diaria** (rutina "Costa Viva — calibración nocturna",
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
que Costa Viva no tenga todavía. **Solo propuestas — cambio de producto
por definición, nunca implementación directa** (regla de
`ROBOT_REGLAS.md`). Nada se ha tocado en código.

Recordatorio de lo que Costa Viva YA tiene, para no proponer duplicados:
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
   lunar y solar). Costa Viva ya calcula posición lunar en `/luna`, así
   que el dato base está — faltaría derivar las 2-4 ventanas diarias.
   Ya anotado en `ROBOT_REGLAS.md` (sec. de variables del índice de
   pesca) como **heurística tradicional, no ciencia dura**: si se añade,
   dejarlo dicho así de claro en la UI. No inventa ningún dato externo
   (es cálculo astronómico sobre lo que ya tenemos), pero sigue siendo
   decisión de producto → propuesta.

3. **Recomendación de cebo/técnica por comunidad ("Top Baits")** —
   Fishbrain agrega los cebos/técnicas con más capturas reportadas por
   spot. Costa Viva ya guarda `cebo`/`tecnica` por captura y tiene
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
   habitual en la mar. Costa Viva ya es PWA; podría cachear el último
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
mareas/pesca que Costa Viva no tenga, evitando repetir lo ya propuesto el
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
   mejor momento de pesca" del día. Costa Viva hoy **no tiene ningún
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
   por encima de un umbral. Costa Viva **ya calcula el coeficiente por
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
