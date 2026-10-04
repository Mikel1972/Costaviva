# COMPARATIVA_PROYECTOS.md — Costaviva vs. Pólizas.ai / Etxeapala / Lurnahi

**Generado: 2026-10-04.** Segunda pasada de este robot. Reescrito entero
(no se acumula). Los otros tres repos se leyeron en solo lectura desde
`/tmp/hermanos/`, sin tocar nada allí. Ya se leyó `TRAMPAS_COMPARTIDAS.md`
(en `polizas-ai`) antes de esta pasada — lo de aquí abajo no repite lo que
ya está ahí, lo complementa.

**Portado desde la semana pasada (2026-09-25 → hoy), confirmado leyendo el
código real:**
- ✅ Detección de drift de esquema/RLS: `.github/workflows/vigia-esquema.yml`
  (cron `41 3 * * *`) + `.github/scripts/comprobar-esquema.mjs`. Y no es una
  copia a medias: compara el mismo diff granular tabla-por-tabla que el
  original de Pólizas.ai **y además** contrasta las migraciones realmente
  aplicadas en producción contra los ficheros versionados — justo el hueco
  que causó el incidente del 2026-09-20. En esta pieza concreta, Costaviva ya
  no va por detrás de Pólizas.ai.
- ✅ Test unitario fail-closed de la lista blanca de rutas:
  `test/rutas-publicas.test.js` existe, con el caso de regresión central
  ("un fichero nunca visto sigue bloqueado por defecto") en la línea 135.
- ✅ Gate de CI con tests de lógica pura en cada push/PR: `.github/workflows/tests.yml`,
  añadido explícitamente citando este mismo robot como origen (línea 14 del
  fichero). Pólizas.ai ya lo tenía; Costaviva no tenía ningún test corriendo
  en CI, solo el diario contra producción.

**Seguido pendiente, sin cambios:** bitácora legible de pasadas del smoke
test (tipo `PRUEBA_E2E.md`) — ver sección 2 más abajo.

---

## Saldo de API

**Objetivo:** ~20 €/semana entre las 4 apps, sin perder funcionalidad.
**Estimado esta semana (sin `ANTHROPIC_ADMIN_KEY`, es orden de magnitud):**
**4,0 €/semana solo en robots de agente, los seis en Costaviva** (ningún
hermano tiene robots de agente en GitHub Actions, solo llamadas directas
desde el código de sus apps cuando un usuario real las usa). El gasto real
total —incluyendo las llamadas de las 4 apps— sigue sin medirse: falta el
secret `ANTHROPIC_ADMIN_KEY` para que `scripts/saldo/auditar-consumo-api.mjs`
deje de estimar y empiece a leer el gasto real de `/v1/organizations/cost_report`.
**Es el recorte de mayor prioridad de todos los de abajo, porque sin él
cualquier otro ahorro se decide a ciegas.**

No existe una sección de "Saldo de API" en el informe de la semana pasada
con la que comparar directamente (es la primera vez que este robot cubre
esta dimensión con cifras), pero sí hay recortes que ya pedía
`TRAMPAS_COMPARTIDAS.md` (2026-09-28) y que esta pasada confirma como
**ya aplicados**:

- ✅ **Los 6 workflows de Costaviva arrancan en directorio vacío**
  (`mkdir -p /tmp/sesion-X && cd ...`) y no cargan el `CLAUDE.md` (~157 KB)
  en cada turno. Confirmado en `robot-camaras-caidas.yml:124`,
  `robot-experiencia-usuario.yml` y el resto.
- ✅ **`robot-buscador-fuentes.yml` ya no tiene `schedule` activo** — se
  movió a una rutina en la nube de Claude (pagada con el plan, no con el
  saldo de API) el 2026-10-02. Coherente con "la frecuencia debe ajustarse a
  cuánto encuentra el robot", aplicado sin que nadie lo pidiera esta semana.
- ✅ **`robot-camaras-caidas.yml` ya pasó por una ronda de ajuste de
  `--max-turns`**: subió de 60 a 80 el 2026-09-25 (sesión que se quedó sin
  turnos con 7 cámaras a la vez) y volvió a bajar a 60 el 2026-09-28 al dejar
  de cargar `CLAUDE.md` en cada turno (comentario explícito en el propio
  fichero, línea ~132). Es decir: ya hay un ajuste basado en datos reales
  detrás de la cifra actual, no un número elegido al azar — importa para
  valorar el recorte nº 4 de la lista de abajo con el riesgo correcto.
- ✅ **Pólizas.ai ya filtra el fichero de calibración por concepto** en vez
  de mandarlo entero: `functions/api/polizas/_verificacion.js:124-164`,
  función `seleccionarCalibracion()`. El problema más caro que señalaba
  `TRAMPAS_COMPARTIDAS.md` punto 9 (~0,5 $/póliza por meter los 795 KB
  enteros) **ya no existe** para ese fichero. Queda un resto menor sin
  filtrar (ver recorte nº 1 abajo).

### Recortes pendientes, ordenados por ahorro estimado

**1. polizas-ai `functions/api/polizas/_verificacion.js:179` — aplicar el
mismo filtro que ya existe para calibración también a `VIGILANCIA_REGLAS.md`**
- Cambio: la línea 179 sigue concatenando `VIGILANCIA_REGLAS.md` (12,7 KB)
  entero al `system`, mientras que el fichero de calibración (815 KB) ya se
  filtra por concepto desde que se detectó el problema. Aplicar el mismo
  criterio de `seleccionarCalibracion()` (o un recorte a las secciones de
  las coberturas presentes en la póliza) a este fichero también.
- Ahorro: ~3-4k tokens extra por cada llamada a `_verificacion.js` (una por
  póliza extraída). Menor que el problema ya resuelto del fichero de 815 KB,
  pero sigue siendo gasto evitable en cada póliza.
- Riesgo: bajo — es la extensión directa de una técnica ya validada en
  producción para un fichero 60× más grande. Único cuidado: si
  `VIGILANCIA_REGLAS.md` no tiene una estructura por concepto tan limpia
  como la de calibración, el filtro podría dejar fuera una regla relevante;
  mitigable incluyendo también "fichas vecinas" (solo título), como ya hace
  calibración.

**2. Instrumentar el registro de `usage` (tokens de entrada/salida) en las
llamadas a Claude de polizas-ai, Lurnahi y etxeapala**
- Cambio: en polizas-ai, capturar el evento `message_delta` del streaming en
  `_leerStreamClaude()` (`functions/api/polizas/_claude.js`, hoy ese evento
  se ignora explícitamente) y loguear `usage` junto a qué endpoint llamó. Lo
  mismo en Lurnahi (`functions/api/analyze.js`, `functions/api/claude.js`,
  `functions/cron-learning-agent.js`, `functions/cron-nightly-digest.js`) y
  etxeapala (`functions/ai.js`).
- Ahorro: 0 € directo, pero es el prerrequisito para que el auditor deje de
  estimar y empiece a medir — sin esto, cualquier otro recorte en estas tres
  apps (las que de verdad no se conocen: no hay robots de agente en ellas,
  solo uso real de usuarios) se decide sin datos.
- Riesgo: ninguno. Es solo instrumentación añadida tras el streaming, no
  cambia la respuesta al usuario.

**3. polizas-ai `functions/api/polizas/_extraccion.js:224-232` — revisar si
el tercer intento de extracción, que repite con el mismo modelo que ya
falló, aporta algo**
- Cambio: el intento 3 (línea 227-231) fija `claude-sonnet-5` como "modelo
  de respaldo", pero el intento 1 (línea 205-208) ya usa ese mismo modelo
  por defecto. Si el fallo que dispara el intento 3 es un timeout/524
  (línea 224), repetir con el mismo modelo probablemente tarda lo mismo.
  Antes de tocar nada, aplicar el recorte nº 2 (registrar `usage` y tasa de
  fallos) para saber si el intento 3 realmente recupera casos.
- Ahorro: depende de la tasa de fallo por timeout en producción (hoy no
  medible). Si ocurre en, por ejemplo, un 5-10 % de extracciones —la
  llamada más cara de polizas-ai, 32000 `max_tokens`, con PDFs adjuntos—
  evitar reintentos que repiten el mismo fallo sería una fracción no
  trivial del gasto de esta app.
- Riesgo: medio-bajo. No quitar el intento 3 sin datos primero: podría ser
  la última red de seguridad real para extracciones que sí se recuperan.

**4. Costaviva `.github/workflows/robot-camaras-caidas.yml:128` — NO bajar
`--max-turns` a ciegas; medir primero cuántos turnos usan las últimas
pasadas**
- Es el workflow más caro (2,9 €/semana, ~72 % del gasto total de robots) y
  el único con aviso R5 (herramienta web con más de 40 turnos). Pero como se
  confirma arriba, el valor actual (60) ya viene de un ajuste real tras un
  incidente de quedarse sin turnos a mitad de trabajo (2026-09-25, 7 cámaras
  a la vez). Antes de recortar, mirar `$SALIDA_CLAUDE` de las últimas 3-4
  pasadas para ver cuántos turnos se usan de verdad.
- Ahorro potencial si los datos lo permiten: recortar de 60 a, por ejemplo,
  40-45 turnos bajaría el techo de la sesión más cara en un ~30 %
  (del orden de 0,8-1 €/semana).
- Riesgo: medio-alto si se hace sin medir — el propio robot ya tiene la
  regla "trabaja como mucho sobre 3 cámaras por pasada" precisamente porque
  intentar con todas dejó un incidente real sin terminar. Cortar turnos sin
  ver el dato real de uso puede repetir ese incidente con cámaras caídas más
  tiempo.

**5. Lurnahi `functions/cron-nightly-digest.js:22` — subir el umbral
mínimo de evidencia antes de gastar una llamada**
- Cambio: el comentario de la línea 22 dice explícitamente que "cualquier
  señal del día merece un digest", con tope de 20 llamadas/noche
  (línea 24) — es la invocación de IA más frecuente de las 4 apps (una
  posible cada noche, 7×/semana). Subir el umbral mínimo de 1 a 2-3 señales
  antes de generar un digest reduciría el ruido sin perder noches con
  actividad real.
- Ahorro: bajo en € absolutos (2000 `max_tokens` por llamada, barato), pero
  es la de mayor frecuencia garantizada de las 4 apps.
- Riesgo: bajo — un digest con una sola corrección probablemente tampoco
  aporta aprendizaje útil; subir el umbral puede mejorar también la calidad
  de las conclusiones, no solo el coste.

**6. etxeapala `functions/ai.js` — añadir freno de volumen por usuario,
como ya tiene Lurnahi**
- Cambio: replicar el límite diario por usuario que ya existe en Lurnahi
  (tabla `claude_api_usage`, 300-500/día) — etxeapala hoy no tiene ningún
  tope de volumen, solo autenticación por rol.
- Ahorro: 0 € a corto plazo (etxeapala ya usa bien Haiku para las tareas
  mecánicas de `recetas.html`/`tarjetas.html`), pero es puramente
  preventivo: sin este freno, un bug de reintento en bucle en el frontend
  no tiene nada que lo pare.
- Riesgo: ninguno para uso normal con un límite generoso.

**Descartado explícitamente, no recortable sin perder funcionalidad real:**
`daily-report.yml`, `robot-mejores-practicas.yml`, `robot-patrones-uso.yml`
ya tienen `--max-turns` y `--model` ajustados a su propósito, arrancan fuera
del repo, y `daily-report.yml` además tiene guardarraíl de "0 cambios en
24h → ni invoca a Claude". No se encontró grasa adicional en estos tres.

---

## Comparativa general — ordenada por lo que más aportaría portar

### 1. Pólizas.ai documenta una regla de "probar en preview antes de
mergear" motivada por un incidente real de datos expuestos — Costaviva
tiene la infraestructura pero no la regla escrita

`/tmp/hermanos/polizas-ai/CLAUDE.md:30-31`: desde el 2026-09-09, cualquier
cambio con efecto visible debe probarse en el deployment de preview de su
rama antes de ir a `main` — regla motivada por un incidente real: el
2026-09-09, `data/snapshot/watchdog.json` (con edad, hijos, renta, pólizas y
capitales de usuarios reales) quedó accesible sin autenticación en
producción, y la regla ya evitó después dos despliegues rotos más
(`_redirects` con forzado, `.assetsignore`).

Costaviva **sí** tiene previews automáticos por rama (mencionado en
`robot-diseno-pr.yml:11`), pero no hay una regla escrita en `CLAUDE.md` que
obligue a probarlos antes de mergear un cambio visible, ni una forma fácil
de apuntar el smoke test a un preview: `.github/workflows/smoke-test.yml:50`
solo tiene `workflow_dispatch: {}` sin parámetros, y la URL de producción
está fija en la línea 58. Pólizas.ai sí lo permite:
`/tmp/hermanos/polizas-ai/.github/workflows/e2e-smoke.yml:16-21,42` acepta
un `input base_url` ("vacío = producción... sirve para probar el deployment
de preview de una rama antes de mergear").

**Por qué importa:** hoy, en Costaviva, el recorrido completo del smoke
test (login real, foto real a `/identificar-captura`, ciclo de grupo con
dos cuentas) solo puede correr contra `costaviva.org` ya en producción —
cualquier regresión grave de ese flujo se descubre ya en vivo, no antes de
mergear. Portar las dos cosas juntas (la regla escrita + el parámetro
`base_url` en `smoke-test.yml`) es barato y cierra el mismo tipo de hueco
que ya costó una exposición real de datos personales en el hermano.

---

### 2. Falta una bitácora legible de cada pasada del smoke test —
sigue pendiente desde la semana pasada, sin cambios

Pólizas.ai documenta cada pasada de su `e2e-smoke.yml` en
`/tmp/hermanos/polizas-ai/PRUEBA_E2E.md` (comiteado automáticamente,
`if: always()` en la línea 45-51 del workflow), con entradas tipo "❌ CON
FALLOS" o "✅ OK" y qué pasó de verdad frente a lo esperado. Costaviva sigue
sin nada parecido: `smoke-test.yml` imprime a stdout (líneas 138, 172) pero
no comitea ningún artefacto — para saber si ha fallado alguna vez por algo
distinto a saldo/configuración, hay que abrir logs de Actions uno a uno.

**Por qué sigue importando:** no requiere ningún cambio de lógica, solo
añadir un paso que anexe un resumen a un fichero y lo comitee — el coste de
implementarlo es bajo frente al tiempo que ahorra cada vez que alguien
necesita saber "¿esto ya falló antes?".

---

### 3. Auditar los 68 usos de `security definer` en Costaviva frente a
los 7 de Pólizas.ai — puede haberse vuelto la opción por defecto

Grep de `security definer` (case-insensitive) sobre `supabase/`: **68
ocurrencias en 25 ficheros en Costaviva**, frente a **7 en Pólizas.ai** y
**1 en Lurnahi**. Costaviva sí documenta bien los casos que ha revisado —
`supabase/migrations/20260913010000_grupos_privados.sql:7-14` tiene un
comentario "DECISIÓN DE SEGURIDAD CLAVE" explicando por qué hace falta
saltarse una política RLS recursiva— pero con un volumen 10× mayor que el
del hermano más cercano en el mismo stack, vale la pena revisar si el
patrón se eligió caso a caso o se ha convertido en la opción por defecto al
escribir una función nueva.

**Por qué importa:** cada `security definer` sin política RLS equivalente
es superficie de confianza adicional en la función, no en la tabla —
cuantos más haya sin una razón anotada, más cuesta auditar cuáles son
imprescindibles. No es una lista de ficheros concretos a corregir (eso
requeriría revisar los 68 uno a uno, fuera del alcance de esta pasada), es
una señal cuantitativa que vale la pena que alguien revise.

---

### 4. Pólizas.ai distingue "la respuesta de Claude se truncó por límite de
tokens" de "el modelo no respetó el formato", y lo usa para decidir el
reintento — Costaviva no tiene esta distinción en `identificar-captura.js`

`/tmp/hermanos/polizas-ai/functions/api/polizas/_claude.js:73-98`, función
`diagnosticarRespuestaIlegible()`: calcula el balance de llaves `{`/`}` del
JSON de respuesta para saber si se cortó por `max_tokens` o si el modelo
simplemente devolvió algo mal formado. Con eso, el reintento puede pedir
menos verbosidad en el primer caso en vez de repetir el mismo prompt que
volvería a truncarse.

**Nota importante de honestidad:** la propuesta de la semana pasada de
unificar la clasificación de fallos de Claude y de Stripe en un helper
común (`functions/_lib/clasificar-fallo-proveedor.js`) **se evaluó y se
descartó**, con buena razón documentada en el propio código:
`functions/identificar-captura.js:45-51` explica que son ideas distintas
—clasificar un fallo de servicio para un mensaje de usuario, frente a
detectar una condición puntual recuperable (cliente de Stripe borrado) para
reintentar— y que unificarlas habría hecho el código menos legible sin
beneficio real. **No se repite esa recomendación esta semana.** Lo de
`diagnosticarRespuestaIlegible()` es una idea distinta y más concreta:
afecta solo al manejo de la propia respuesta de Claude en
`identificar-captura.js`, no a unificar con Stripe. Aplicable el día que
haga falta reintentar una llamada a Claude en este repo (hoy no se
reintenta ninguna).

---

### 5. Etxeapala dispara su smoke test también al terminar el deploy, no
solo por cron — detecta una página rota en minutos, no al día siguiente

`/tmp/hermanos/etxeapala/.github/workflows/smoke-test.yml:3-9,14`: se
dispara con `workflow_run` cuando termina "Deploy to Cloudflare Pages"
(`types: [completed]`), condicionado a que el deploy haya tenido éxito,
además del cron diario. Ningún otro de los 4 repos engancha su smoke test
al propio evento de deploy — todos (incluido Costaviva,
`.github/workflows/smoke-test.yml:7-9`, solo `schedule` + `workflow_dispatch`)
dependen solo del cron de una vez al día.

**Por qué importa:** en Costaviva, un deploy roto a las 10:00 UTC no se
detecta hasta el cron de las 05:00 UTC del día siguiente — hasta 19 horas
de ventana. Añadir un disparador `workflow_run` tras el deploy de
Cloudflare Pages es barato (reutiliza el mismo smoke test ya existente) y
cierra esa ventana a minutos. Contrapartida real del propio Etxeapala: ese
smoke test solo cubre 20 páginas con `curl` y un endpoint de solo lectura
— mucho menos profundo que el de Costaviva, que si se dispara igual tras el
deploy mantendría su cobertura actual (login real, grupos, etc.).

---

### 6. Etxeapala documenta el error de "arreglar RLS rompe lo que
dependía de ver filas de otros" como lección propia, aparte de "falta RLS"
— ningún otro de los 4 lo anota tan explícitamente

`/tmp/hermanos/etxeapala/AUDITORIA.md:53-99` documenta una política RLS
abierta (`using(true)`), y `AUDITORIA.md:1073-1099` documenta el *segundo*
incidente: al corregir esa política, se rompió la propagación de permisos
en cascada que dependía implícitamente de ver filas ajenas. Pólizas.ai tiene
un caso parecido (`AUDITORIA.md:89`, política de UPDATE demasiado laxa),
pero Costaviva (`CLAUDE.md:1033`/`1062`) y Lurnahi (`README.md:46-51`) solo
documentan el primer síntoma —RLS ausente— nunca el segundo.

**Por qué importa:** es una lección de proceso, no de código: la próxima
vez que Costaviva cierre una política RLS demasiado abierta, vale la pena
verificar explícitamente, antes de dar el cambio por bueno, que ninguna
vista agregada o jerarquía existente dependía de ver filas de otros
usuarios. Barato de aplicar (es una pregunta más al final del checklist de
revisión), evita el mismo tipo de regresión de dos tiempos que ya mordió a
dos de los tres hermanos.

---

### 7. `prevision.js` de Costaviva ya resuelve bien la degradación ante
fallo de proveedor externo — pero el mismo repo tiene otros tres endpoints
sin ese mismo cuidado

`functions/prevision.js:1106-1108`: si AEMET falla, sirve la última
respuesta buena cacheada y lo marca explícitamente para el cliente
(`_respaldo: "AEMET no responde..."`); y `prevision.js:1170-1176` evita
cachear una respuesta en error para no "congelar" el fallo. Es el mejor
patrón de degradación de los 4 repos en esta ronda (ver también sección
"Costaviva ya va por delante"). Pero dentro del propio Costaviva,
`rayos-imagen.js`, `viento-campo.js` y `geocodificar.js` devuelven un 502
genérico sin ninguna red de seguridad cuando su proveedor externo falla.

**Por qué importa:** no hace falta mirar a ningún hermano para este — es
portar la propia mejor práctica de Costaviva de un endpoint a los otros
tres del mismo repo. El coste de implementarlo ya está amortizado (el
patrón de caché de respaldo ya existe y funciona en producción).

---

### 8. Stripe — revisión en solitario de Costaviva (ningún hermano lo usa
activamente; Pólizas.ai lo tiene pendiente, Etxeapala y Lurnahi no lo usan)

La integración de Costaviva ya tiene buenas prácticas sólidas: verificación
HMAC con comparación en tiempo constante y rechazo de timestamps >300 s
(`functions/stripe-webhook.js:33-68`), Customer Portal
(`functions/crear-portal-stripe.js:84-96`), cupones vía
`allow_promotion_codes` (`functions/crear-checkout-stripe.js:125`), el
precio se resuelve en servidor y el cliente nunca lo controla
(`crear-checkout-stripe.js:90-96,23-26`), RLS en `suscripciones` con
solo-lectura para el propio usuario y toda escritura vía `service_role`
tras verificar la firma
(`supabase/migrations/20260915160000_suscripciones_stripe.sql:42-49`).

Carencias concretas encontradas esta pasada:
- **Sin idempotencia por `event.id`** (`stripe-webhook.js:124-181`): un
  reenvío desordenado de `customer.subscription.updated` podría pisar un
  estado más reciente con uno más viejo.
- **No se procesan `invoice.payment_failed` ni `invoice.paid`** (alcance
  declarado en `stripe-webhook.js:5-7`): un pago recurrente fallido no
  dispara ningún aviso propio, solo lo reflejará con retraso el siguiente
  `customer.subscription.updated`.
- **Fallo silencioso con 200 OK**: si no se resuelve el `user_id` del
  cliente de Stripe, el evento se descarta con solo `console.error`
  (`stripe-webhook.js:72,95-103`) y se responde 200 — Stripe no reintenta y
  la suscripción queda sin enlazar, sin alerta al admin (a diferencia de
  `avisarAdmin()` en `avisar-fin-prueba.js:192-199`, que sí existe en el
  mismo repo para otro caso).
- **Sin verificación en runtime de que `STRIPE_SECRET_KEY` es de modo
  live en producción** — habría sido una red de seguridad barata frente a
  la clase de incidente ya conocido del 2026-09-25 (cliente de test colado
  en producción).

Qué guarda Supabase hoy (`suscripciones`): `user_id`, `stripe_customer_id`,
`stripe_subscription_id`, `estado`, `periodo`, `periodo_actual_fin`,
`actualizado_en`. No guarda `event.id`, importe cobrado ni histórico de
facturas — relevante para la carencia de idempotencia de arriba.

---

### 9. Etxeapala y Lurnahi aíslan el flujo de recuperación de contraseña
en su propia página; Costaviva y Pólizas.ai lo mezclan con el login

Etxeapala (`establecer-contrasena.html`) y Lurnahi (`reset-password.html`)
tienen página dedicada. Costaviva reutiliza `login.html:435-551` con estado
oculto para el modo "recovery", igual que Pólizas.ai
(`seguros.html:1231-1240`).

**Por qué importa:** aislar el flujo de recuperación en su propia página
reduce el JS cargado durante un paso sensible y evita bugs de estado
cruzado entre "modo login" y "modo recovery" dentro del mismo fichero
grande (`login.html` pesa 35 KB). Es una mejora de bajo coste, no una
corrección urgente — no hay ningún incidente real detrás todavía.

---

### 10. Lurnahi verifica el CAPTCHA de Turnstile en su propio backend, no
solo delega en Supabase — con una salvedad real a tener en cuenta

`/tmp/hermanos/Lurnahi/functions/notify-request.js:45-62` llama a
`siteverify` de Cloudflare antes de aceptar la solicitud, en vez de confiar
solo en que Supabase valide el `captchaToken` (lo que hacen Costaviva y
Pólizas.ai). Defensa en profundidad real: impide que alguien capture el
endpoint y lo bombardee saltándose el widget.

**Salvedad que hay que copiar con cuidado, no tal cual:** el propio código
de Lurnahi tiene un fallback inseguro si falta `TURNSTILE_SECRET_KEY` —deja
pasar sin verificar (comentado en las líneas 43-44)— y solo protege el
formulario de solicitud, no login ni reset. Si se porta esta idea a
Costaviva, el fallback ante secret ausente debe ser **rechazar**, no dejar
pasar.

---

## Costaviva ya va por delante en esto (no hace falta portar nada, es información)

- **Clasificación de saldo agotado de Anthropic en CI, único de los 4**:
  `robot-buscador-fuentes.yml`, `robot-patrones-uso.yml`,
  `robot-mejores-practicas.yml` y `robot-experiencia-usuario.yml` detectan
  "credit balance is too low" y avisan con `::warning::` +
  `$GITHUB_STEP_SUMMARY` sin romper el check. `daily-report.yml:566-575`
  tiene el mismo guardarraíl y además, si la síntesis del día queda vacía
  por esto, lo dice en el propio Issue público
  (`daily-report.yml:670-695`). Ningún hermano llama a Claude desde sus YAML
  con esta granularidad, así que no hay nada equivalente que comparar.
- **Doble canal de alerta (Issue + email)**: `daily-report.yml:670-713` —
  el informe diario se publica en un Issue de GitHub **y** se manda por
  email vía Resend, con el comentario explícito de que depender solo del
  Issue falla si el usuario no tiene "Watching" activado. Pólizas.ai solo
  tiene email; Etxeapala no tiene alertas de infraestructura; Lurnahi tiene
  emails de negocio pero no Issues.
- **Degradación ante fallo de AEMET/Open-Meteo en `prevision.js`** (caché de
  respaldo marcada explícitamente, ver sección 7 de arriba): mejor que
  Etxeapala (reenvía JSON crudo de Anthropic en `functions/ai.js:45`) y
  Lurnahi (reenvía status+JSON crudo y hasta 300 caracteres de texto de
  Anthropic en `functions/api/analyze.js:180`).
- **Lista blanca de rutas**: ya al nivel de Pólizas.ai (la mejor
  referencia), muy por delante de Etxeapala (sin lista blanca ni negra,
  autorización dispersa por endpoint vía `requireAuth()`) y Lurnahi (mismo
  patrón disperso vía `_lib/authz.js`, y además **sin ningún test** de
  rutas/autorización — el único de los 4 sin esa red).
- **Trazabilidad de migraciones**: 45 ficheros en `supabase/migrations/`,
  100 % con convención `YYYYMMDDHHMMSS_descripcion.sql`, y el incidente de
  2026-09-20 (migraciones pegadas a mano, nunca registradas por la CLI)
  quedó documentado y cerrado con `supabase migration repair`. Mejor que
  Pólizas.ai (dos carpetas paralelas `migrations/`+`sql/`, y una migración
  con sufijo `_draft` dentro de la carpeta que debería ser inmutable) y
  mucho mejor que Lurnahi (formato de fecha sin hora, hasta 5 ficheros el
  mismo día sin orden determinista) y Etxeapala (0 `.sql` versionados, RLS
  gestionada a mano en el panel).
- **Email transaccional con reintento real, no solo log**: en
  `functions/avisar-fin-prueba.js:187-232`, si el envío falla, el registro
  **no se marca como enviado** en Postgres, generando un reintento real en
  la siguiente pasada del cron (cada 30 min). Es el único de los 4 con algo
  parecido a un reintento automático — Etxeapala ni siquiera comprueba
  `response.ok` en `functions/notify.js:36-44` (documentado como pendiente
  sin corregir en su propio `AUDITORIA.md:573-578`).

---

## Pendiente propio de Costaviva, con una corrección concreta ahora
identificada (no es "portar", es deuda ya conocida con una solución más
clara esta semana)

`robot-experiencia-usuario.yml:144` tiene `continue-on-error: true` en el
único paso real del job. Se revisó el código completo esta semana: el paso
**ya distingue** internamente el caso de saldo agotado (sale con
`exit 0` tras avisar, líneas 167-175) de cualquier otro fallo (sale con
`exit "$CODIGO"` en la línea 177, el código real). El problema es que,
como el `continue-on-error: true` cubre el paso entero, ese `exit "$CODIGO"`
con un fallo real (por ejemplo, agotar `--max-turns` sin terminar el
informe) **sigue dejando el job en verde** igual que si hubiera sido el
caso de saldo. Dado que el propio script ya distingue los dos casos y el
caso de saldo ya termina en `exit 0` por su cuenta, **quitar
`continue-on-error: true` del paso debería bastar**: el caso de saldo
seguiría en verde (porque ya sale con 0 explícitamente) y un fallo real
volvería a mostrarse en rojo, que es lo que falta hoy. Ningún hermano tiene
un patrón mejor que copiar para esto (ninguno invoca Claude desde un YAML
con esta forma), pero esta semana sí se identificó la corrección concreta
dentro del propio fichero.

---

## Dimensiones cubiertas donde uno o más proyectos no aplican

- **Stripe**: solo Costaviva lo usa de los cuatro (ver sección 8). Pólizas.ai
  lo tiene explícitamente pendiente
  (`functions/api/polizas/canjear-codigo.js`); Etxeapala y Lurnahi no lo
  usan.
- **RLS versionada**: Etxeapala sigue sin ningún `.sql` en su repo — RLS se
  gestiona a mano en el panel de Supabase. Ya anotado la semana pasada,
  sigue igual.
- **Tests unitarios**: Etxeapala y Lurnahi no tienen carpeta `test/` en
  absoluto (Lurnahi compensa parcialmente con un gate de CI distinto,
  `audit-duplicates.yml`, que detecta identificadores duplicados en
  HTML/JS pero no es un test de lógica).
- **Rotación de secrets**: ninguno de los 4 documenta un procedimiento
  periódico — brecha compartida, no diferencial, no hay nada que portar de
  un hermano a otro aquí.
