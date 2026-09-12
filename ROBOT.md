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
