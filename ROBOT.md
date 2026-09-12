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
