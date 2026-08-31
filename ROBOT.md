# ROBOT.md — bitácora del robot de datos de Costa Viva

Este archivo lo mantiene el robot de investigación/auditoría de datos que
corre en sesiones programadas contra este repo. Cada pasada añade una
entrada fechada en la sección que corresponda — nunca se borra el
historial anterior, solo se añade.

Reglas para el robot (hasta que el usuario anote otras aquí):
- Nunca inventar un dato. `null`/sin-dato es siempre preferible a un
  número inventado, tal como pide el resto del proyecto.
- Fuente nueva de bajo riesgo y fácil de integrar (endpoint tipo
  `functions/*.js` siguiendo el patrón existente) → intégrala e implementa
  en una rama `robot/AAAA-MM-DD`, verifica con `node --check` antes de
  commitear.
- Cualquier cosa que cambie mucho el frontend, el diseño del mapa, o que
  sea una decisión de producto → no implementar, solo proponer aquí.
- Corrección de auditoría trivial (un campo de un JSON, una URL que
  cambió de dominio) → corregir directamente. Cualquier otra cosa →
  proponer.
- El factor de corrección de calibración nunca se aplica en automático:
  siempre es una propuesta a confirmar por el usuario.

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
