# CLAUDE.md — Costa Viva / Fishnow

Este fichero se lee al empezar cada sesión y se reescribe libremente cuando
cambian las convenciones — no es un historial (para eso está `ROBOT.md`).
Si algo de aquí queda desactualizado, corrígelo en el momento en que lo
detectes, no lo dejes para luego.

## ⚠ CRÍTICO SIN RESOLVER: el SOS probablemente no llega a nadie (2026-09-12)

`sos-alerta.js` manda el email de socorro desde `sos@costaviva.app`, pero
**ese dominio no está verificado en Resend** (no hay dominio propio
registrado todavía). Confirmado en real: Resend rechaza con `403 "domain
is not verified"` cualquier envío desde ese dominio a un destinatario
que no sea el dueño de la cuenta de Resend. Los contactos de emergencia
son personas reales, nunca el dueño de la cuenta de Resend — así que
**la alarma SOS de este repo, en producción, probablemente no está
avisando a nadie ahora mismo**, aunque el resto del flujo (RLS, auth, la
respuesta que ve el usuario) esté bien y no lo delate.

Arreglo real pendiente: verificar un dominio propio en Resend
(resend.com/domains) y usarlo en el `from` de `sos-alerta.js`. Hasta
entonces, esto es lo primero que cualquier sesión futura debería mirar.
(`aviso-alta.js`, que sí notifica al dueño de la cuenta de Resend, se
arregló usando el remitente de pruebas `onboarding@resend.com` — pero
esa solución NO sirve para `sos-alerta.js`, cuyos destinatarios son
siempre otra persona.)

## Bug de seguridad corregido — CLAUDE.md y el código de functions/ se servían en público (2026-09-13)

Auditoría completa pedida por el usuario. Dos exposiciones reales
confirmadas en vivo (`200` en producción) antes del fix, ambas en
`functions/_middleware.js`:

1. **Este mismo fichero (`CLAUDE.md`) nunca se añadió a
   `RUTAS_BLOQUEADAS`** al crearla el 2026-09-12 (se bloquearon
   `ROBOT.md`, `ROBOT_REGLAS.md`, `CALIBRACION.jsonl`, `README.md` y
   `start.ps1`, pero no este) — es el fichero más sensible de todos,
   sirviéndose en público con el aviso de que el SOS probablemente no
   avisa a nadie, emails de las cuentas de prueba y detalle interno de
   RLS/esquema.
2. **Cloudflare Pages sirve el código fuente completo de cada
   `functions/*.js` como archivo estático** en su ruta literal (ej.
   `/functions/sos-alerta.js`), aparte de ejecutarlo como Function en su
   ruta reescrita (`/sos-alerta`) — confirmado también con
   `/functions/prevision.js`. Ningún fichero del frontend pide nunca
   `/functions/...` (solo las rutas ya reescritas), así que bloquear ese
   prefijo no rompe nada real.

Corregido añadiendo `/CLAUDE.md` a `RUTAS_BLOQUEADAS` y `/functions/` a
`PREFIJOS_BLOQUEADOS`. Verificado en preview antes de mergear: las 3
rutas dan `404` y las rutas reescritas (`/prevision`, `/login`,
`/diario`, `/luna`) siguen respondiendo igual que antes. **Cualquier
fichero nuevo que se añada a la raíz del repo o a `functions/` sigue el
mismo riesgo por defecto** (Cloudflare sirve todo lo que hay en el árbol
de git salvo que se bloquee explícitamente) — revisar `_middleware.js`
cada vez que se cree un fichero interno nuevo, no solo cuando se detecta
por accidente.

## Qué es esta app

App de condiciones costeras (oleaje, mareas, corriente, webcams, rayos,
especies por temporada) + un cuaderno de pesca (`diario.html`) + una
alarma SOS con detección de caída (`alarma.html`). La alarma SOS es la
parte más crítica del repo: un fallo ahí no es "un dato mal mostrado", es
"alguien no recibe ayuda o la reciben personas equivocadas con datos de
otro usuario". Cualquier cambio que toque `alarma.html`,
`functions/sos-alerta.js`, o las tablas `contactos_emergencia` /
`alertas_sos` merece más cuidado que el resto del repo.

## Stack y despliegue

- HTML + JS plano, sin build step. Cloudflare Pages sirve el árbol de git
  tal cual, salvo lo que bloquee `functions/_middleware.js` —
  **cualquier fichero que añadas al repo es servido en público** salvo
  que lo excluyas explícitamente ahí. Antes de añadir un fichero con
  datos internos/operativos, añade su ruta a `RUTAS_BLOQUEADAS` o
  `PREFIJOS_BLOQUEADOS` en `functions/_middleware.js`. (Se intentó
  primero con un fichero `_redirects` de solo-código — Cloudflare lo
  ignoraba en silencio por faltarle un destino; el middleware sí
  funciona, verificado en vivo.)
- `functions/*.js` son Cloudflare Pages Functions (edge, red real — a
  diferencia de las sesiones de robot/auditoría en la nube, que tienen la
  salida de red bloqueada salvo dominios de infraestructura, ver
  `ROBOT.md` 2026-08-31). Si una rutina programada necesita verificar una
  fuente externa nueva con una petición real, esa comprobación debe vivir
  en un endpoint de `functions/` o un workflow de GitHub Actions — nunca
  intentar sortear el bloqueo de red de la propia sesión.
- No hay build/test framework instalado (no hay `package.json`). `node
  --check archivo.js` es la validación mínima antes de commitear un
  cambio en `functions/`.
- `start.ps1` arranca todo en local vía Wrangler (funciones de backend
  reales, no solo estáticas).

## Supabase

- Proyecto real: **`imncbmizxkorotpeisic`** (no lo confundas con el de
  otro proyecto — Pólizas.ai, Etxeapala y Lurnahi tienen el suyo propio).
- La anon key está hardcodeada en `index.html`, `login.html`,
  `alarma.html`, `diario.html` y `functions/sos-alerta.js` — **esto es
  correcto y esperado**, la anon key es pública por diseño. Lo que nunca
  debe aparecer en el repo es una `service_role` key ni ningún secreto
  equivalente.
- `RESEND_API_KEY` (para el email de SOS) vive solo en Cloudflare Pages
  como variable de entorno tipo "Secret" — nunca en el repo.
- Tablas y RLS (todas con `using/with check (auth.uid() = user_id)`,
  definidas en `supabase/schema.sql` y
  `supabase/schema_diario_alarma.sql`):
  - `perfiles` — una fila por usuario, `aprobado` boolean, aprobación
    manual desde el Table Editor (patrón Etxeapala).
  - `salidas_pesca`, `capturas`, `captura_fotos` — cuaderno de pesca.
  - `contactos_emergencia`, `alertas_sos` — alarma SOS.
  - Bucket de Storage `capturas-fotos`: cada usuario solo lee/escribe su
    propia carpeta (`<user_id>/...`).
  - `spots_usuario`, `spots_favoritos` (añadidas 2026-09-12, ver
    "Ubicaciones personalizadas" más abajo) — **excepción al patrón de
    arriba**: `spots_usuario` permite además `select` cuando
    `publica = true` (no solo `auth.uid() = user_id`), a propósito —
    es la tabla que sostiene el mapa colaborativo.
  - `especies_comunidad` (añadida 2026-09-12) — otra excepción: lectura
    Y escritura abiertas a cualquier usuario logueado (`to authenticated
    using (true)` / `with check (auth.uid() = creado_por)`), mismo
    criterio de "enriquecer entre todos" que `spots_usuario`.
  - `presion_historico` (añadida 2026-09-12, Fase 4) — otra excepción:
    lectura pública sin sesión (`using (true)`), sin política de
    insert/update/delete para clientes — solo escribe
    `functions/registrar-presion.js` (protegido con secreto
    compartido). No son datos personales de nadie.
  - `grupos`, `miembros_grupo`, `invitaciones_grupo` (añadidas
    2026-09-13, Fase 5 — ver más abajo) — visibilidad de grupo, con
    helper `es_miembro_de()` para evitar RLS recursivo.
  - `perfiles.nombre` (añadida 2026-09-13) — apodo público opcional,
    solo el propio usuario puede escribirlo (`grant update (nombre)`,
    ver Fase 5 más abajo).
  - `sinonimos_especie` (añadida 2026-09-13) — nueva responsabilidad del
    robot de datos (ver `ROBOT_REGLAS.md`): investiga sinónimos
    regionales de especies/cebos (txipirón/chipirón, róbalo/lubina...)
    vía `WebSearch` y los propone aquí. Lectura pública; la anon key
    solo puede insertar con `verificado=false` (la propia RLS lo obliga
    — un intento de insertar ya verificado falla), verificación manual
    desde el Table Editor, mismo patrón que `perfiles.aprobado`.
- **Verificado en vivo el 2026-09-12**: petición sin token de sesión (solo
  anon apikey) contra las 6 tablas de usuario devuelve `200 []` en todas
  — RLS está activo y funcionando, no solo declarado en el `.sql`.
  Pendiente (no hecho todavía, requiere confirmación antes de crear
  cuentas de prueba reales): la prueba cruzada "token de usuario A leyendo
  fila de usuario B".
- `sos-alerta.js` usa siempre el token del que llama, nunca
  `service_role`. `aviso-alta.js` es la única excepción del repo — ver
  su sección propia más abajo (solo lee `auth.users` por id, nunca
  tablas de usuario).

## Diario de pesca — campos añadidos 2026-09-12

`salidas_pesca`: `tipo_salida` (costa/embarcación/submarinismo — primero
en el formulario). **Solo embarcación** usa la boya real más cercana
(Puertos del Estado, vía `/prevision`) en vez del modelo por
coordenadas — `boya_usada` guarda cuál, solo informativo. Submarinismo
se pesca cerca de costa (como "costa"), así que NO usa la boya de mar
abierto — es una corrección explícita del usuario, no lo cambies de
vuelta sin preguntar.

`capturas`: ya tenía especie/talla/peso/cebo/notas/fotos, todo opcional
— no hacía falta añadirlos. Lo nuevo es `hora` (por captura, solo
informativo — a qué hora se pescó ese pez en concreto) y `tecnica`
(lista verificada con búsqueda real: Surfcasting/Spinning/Jigging/
Curricán/Fondo/Flotador-Corcheo/Popping/Eging/Otra) con el campo
condicional que activa: técnicas de señuelo (Spinning/Jigging/Curricán/
Popping/Eging) piden "tipo de señuelo" (texto libre); el resto sigue
con "Aparejo" (Plomo/Corcho/Otro, ya existía).

**Hora de inicio/fin (2026-09-12, Fase 3 del plan de mejoras):**
`salidas_pesca.hora` se renombró a `hora_inicio` y se añadió
`hora_fin` (migración `20260912190000_hora_inicio_fin_salida.sql`).
Las dos son opcionales — no se fuerza a rellenarlas (alguien en una
embarcación moviéndose puede querer registrar una captura de un momento
concreto sin más contexto), solo se valida que `hora_fin` sea posterior
a `hora_inicio` cuando las dos están puestas (asume que la salida no
cruza medianoche, limitación conocida). `capturas.hora` sigue siendo
por captura y opcional; si cae fuera de `[hora_inicio, hora_fin]` de su
salida no se bloquea el guardado, solo se avisa (no tiene sentido negar
un dato real de campo por no encajar en el rango declarado).

Todos los selectores de hora de la app (`hora_inicio`, `hora_fin`, la
hora de cada captura) usan el mismo componente `crearSelectorHora()`:
dos `<select>` nativos (hora, minuto), primera opción "--" para "sin
especificar". Se probó antes una rueda de scroll/snap hecha a mano (dos
intentos) que en la práctica no se veía bien para el usuario — un
`<select>` nativo ya trae scroll de fábrica con muchas opciones, así
que es la vía más simple y fiable. Vanilla JS/CSS, sin librerías (el
repo no tiene build step).

**Varias entradas por día + edición (2026-09-12):** una fecha puede
tener más de una salida (p.ej. embarcación por la mañana y costa por la
tarde, o dos spots distintos el mismo día) — `salidasPorFecha[fecha]`
es una LISTA de `{salida, capturas}`, no un único objeto. El calendario
sigue siendo una celda por día (verde si alguna entrada tiene capturas,
rojo si no), pero al abrirlo se ve la lista de entradas con "➕ Añadir
otra entrada este día" al final. Cada entrada y cada captura tienen
botón "✏️ Editar" (mismo formulario de creación, precargado, guarda con
`update` en vez de `insert` — `guardarSalida(fecha, idExistente)` /
`guardarCaptura(salidaId, fecha, idExistente, ordenFotoBase)`) y
"🗑 Borrar" — borrar ya es por entrada/captura suelta, nunca "todo el
día" (así lo pidió el usuario explícitamente, tras un primer diseño que
solo dejaba borrar el día completo). Editar una captura permite además
añadir fotos nuevas sin tocar las que ya hubiera (nunca las reemplaza).

Todas las migraciones probadas en real antes de mergear (rama +
preview): login con cuenta de prueba, salida embarcación → boya real
usada correctamente (y NO usada para submarinismo, verificado tras la
corrección); captura con técnica Spinning → campo de señuelo apareció y
se guardó bien; hora exacta (07:40 y 08:15) guardada y mostrada
correctamente tanto en la salida como en la captura.

## Sesión de pesca "en curso" (2026-09-13)

Pedido explícito del usuario: poder abrir una entrada de salida al
llegar al spot y dejarla abierta mientras dura la jornada (apuntando
notas, añadiendo capturas conforme van pasando), en vez del modelo
anterior donde una entrada nacía siempre ya completa. `salidas_pesca`
tiene ahora `concluida boolean not null default true` (migración
`20260913030000_sesion_en_curso.sql`) — las filas ya existentes se dan
por concluidas (eran registros completos), una entrada nueva se crea con
`concluida = false` y solo pasa a `true` al pulsar "✅ Concluir jornada"
en `diario.html`, que además rellena `hora_fin` con la hora actual
(Madrid local) **solo si no se había puesto ya** — no pisa una hora de
fin que el usuario haya escrito a mano. Editar una entrada ya existente
(`guardarSalida` con `idExistente`) nunca toca `concluida`, así corregir
una nota o el spot de una jornada ya cerrada no la vuelve a abrir.

En la UI, una entrada en curso se distingue con una insignia "🟢 En
curso" y borde en color de acento (`resumenEntradaHTML()` en
`diario.html`); mientras está en curso se sigue pudiendo "➕ Añadir
captura" con normalidad. **Probado en real por el usuario en producción
2026-09-13**: abrir una entrada, ir añadiendo capturas y concluir la
jornada funciona bien.

## Bug corregido — radar de lluvia mostraba "Zoom Level Not Supported" (2026-09-13)

Reportado por el usuario: al acercar el mapa de nubes/lluvia
(`toggleNubes`, capa RainViewer en `index.html`), aparecía el texto
"Zoom Level Not Supported" pintado sobre el mapa. **No es un fallo
nuestro de red ni un error HTTP** — verificado en vivo pidiendo teselas
directamente: a partir de zoom 8 la API de RainViewer responde `200` con
una tesela PNG real que lleva ese texto dibujado dentro, para cualquier
x/y. La documentación oficial de RainViewer lo confirma: "Maximum zoom
level is 7". Arreglado añadiendo `maxNativeZoom: 7` al `L.tileLayer` de
`capaRadarLluvia` (index.html, dentro de `prepararCapaRadarLluvia()`) —
Leaflet sigue dejando acercar el mapa, pero a partir de zoom 8 reescala
la última tesela real de zoom 7 en vez de pedir una que no existe.
**Probado en real por el usuario en producción 2026-09-13**: confirmado
que ya no aparece el aviso al acercar el mapa.

**Bug real corregido 2026-09-12 — "ahora" en UTC contra horas en
local:** el usuario vio nubosidad 100% cuando en realidad no pasaba del
20%. Causa: Open-Meteo (con `timezone=Europe/Madrid`) etiqueta su array
horario en hora LOCAL, pero el cálculo de "ahora" usaba
`new Date().toISOString()` (UTC) — con CEST eso desplazaba el "ahora"
2h hacia atrás. Bug preexistente (no introducido en esta sesión de
mejoras), presente en `functions/prevision.js`
(`calcularMarea`/`calcularPresion`, afectaba a TODOS los spots fijos),
`diario.html` (`contextoAmbiental`) y el `datosAmbientalesPunto` nuevo
de `index.html`. Corregido con un helper `horaActualMadridISO()`
(`Intl.DateTimeFormat` con `timeZone` real) duplicado en los tres
sitios. Segundo bug relacionado, también preexistente:
`actualizarDesdeBackend()` en `index.html` cogía SIEMPRE el bloque de
"12pm" de `/prevision` sin importar la hora real — ahora coge el bloque
de 3h más cercano a la hora real de Madrid (`bloqueMasCercanoAAhora()`).

**Altura de marea confusa, corregida 2026-09-12:** `sea_level_height_msl`
de Open-Meteo es una anomalía respecto al nivel medio del mar (podía
salir negativa, ej. "-2.3m"), no la altura de marea de una tabla
náutica normal que espera alguien que no es oceanógrafo. Se
re-referencia contra el mínimo de la ventana de datos pedida, para
mostrar siempre un número positivo e intuitivo ("cuánta agua hay por
encima de la bajamar más cercana") — no es el cero hidrográfico oficial
de un puerto (eso exigiría datos batimétricos reales que no tenemos),
solo una aproximación honesta. Misma corrección en
`functions/prevision.js` (`calcularMarea`) y `diario.html`
(`contextoAmbiental`).

**Coeficiente de marea (2026-09-12):** mareas vivas (coeficiente alto,
hasta 120) cerca de luna nueva/llena, muertas (bajo, ~45) cerca de los
cuartos — aproximación astronómica por fase lunar
(`coeficienteMarea()`, duplicada en `functions/prevision.js` y
`diario.html`), NO un dato oficial de un servicio hidrográfico (eso
requeriría análisis armónico real por puerto). Se muestra junto a la
altura de marea en el panel de cada spot del mapa y se guarda también
por salida (`salidas_pesca.marea_coeficiente`).

**Dos bugs reales encontrados y corregidos el 2026-09-13, el usuario
los cazó comparando contra tides4fishing.com para Armintza (Vizcaya):**
- **`marea_coeficiente` del diario usaba `new Date()` (el momento de
  guardar), no la fecha real de la salida.** Una salida del 7 de
  septiembre guardada/editada más tarde mostraba el coeficiente de HOY,
  no el del 7 de septiembre — `contextoAmbiental()` ahora recibe `fecha`
  y la usa (a mediodía de ese día, la hora del día es irrelevante para
  la fase lunar). **Esto revela un problema más amplio, sin resolver
  todavía**: `contextoAmbiental()` sigue pidiendo a Open-Meteo el
  forecast de "ahora" (`forecast_days=1`, sin `start_date`/`end_date`)
  para TODO lo demás (oleaje, viento, presión, nubosidad, temp. agua,
  altura de marea) — para cualquier entrada guardada en una fecha
  distinta a cuando se guardó de verdad (registro retroactivo), esos
  datos también estarían mal, mismo tipo de fallo que el del
  coeficiente. Pendiente de arreglar con `start_date=end_date=fecha` en
  vez de `forecast_days=1`.
- **La fórmula del coeficiente no tenía en cuenta el "retraso de la
  marea"** (la marea real no responde al instante a la luna nueva/llena
  — desfase físico real de varios días según el puerto, por fricción y
  propagación de la onda). Comparado contra tides4fishing.com para
  Armintza del 5 al 10 de septiembre de 2026 (ver `CALIBRACION.jsonl`,
  `tipo: "coeficiente_marea_vs_tides4fishing"`), la fórmula sin retraso
  salía sistemáticamente ~2 días adelantada (ej. 7 sept: fórmula 92,
  real 66 — pero el real del 9 sept es 92). Corregido con
  `RETRASO_MAREA_DIAS = 2`.

**Coeficiente real por spot, sustituye al índice nacional (2026-09-13):**
al calibrar el punto anterior contra más puertos (Vigo, Cádiz, Valencia,
Las Palmas, Peniche), salió un hallazgo que cambió el enfoque:
**tides4fishing.com publica el mismo coeficiente, día a día, en TODOS
los puertos comprobados** (Cantábrico, Atlántico Galicia, Golfo de
Cádiz, Mediterráneo, Canarias y Portugal) — no es un dato por puerto,
es un índice astronómico nacional compartido, así que calibrar un
`RETRASO_MAREA_DIAS` por zona (lo que se dejó preparado en
`ROBOT_REGLAS.md`) no tenía sentido: el número de referencia no varía
entre zonas.

En vez de seguir afinando esa aproximación, `coeficientePorSpot()`
(`functions/prevision.js` y `diario.html`) calcula uno real y distinto
por spot: el rango de marea (pleamar menos bajamar) que Open-Meteo
modela para ESE punto concreto cada día, normalizado contra el rango
mínimo y máximo del propio spot en una ventana que cubre un ciclo
vivas-muertas completo (~14.77 días; ±8 días alrededor de la fecha en
el diario). Escala 20-120 igual que el índice nacional, pero ahora sí
varía de un punto a otro porque usa el modelo de oleaje/marea propio de
cada coordenada. `coeficienteMarea()` (la fórmula astronómica con el
retraso calibrado) se queda como **respaldo**, solo si la ventana ancha
no trae datos suficientes (menos de 10 días válidos, o sin variación
real que normalizar).

**Incidente real en producción, mismo día (2026-09-13):** la primera
versión pedía la ventana ancha (`forecast_days=16`) con las 7 variables
marinas de golpe (~2.9 MB para los 95 spots) — funcionaba en pruebas
locales con Node.js (sin límite de tiempo/CPU), pero en Cloudflare
Pages `/prevision` empezó a devolver **503** en producción (el Worker
cortaba la respuesta a medias por pasarse del presupuesto de
tiempo/CPU). `previsionTodosSpots()` ahora hace DOS peticiones a la
Marine API en vez de una: la de siempre (7 variables, solo
`forecast_days=2`, para bloques/oleaje/temperatura/corriente) y una
aparte, ligera (una sola variable, `sea_level_height_msl`,
`forecast_days=16`, ~920 KB) solo para `coeficientePorSpot()`.
Verificado en real tras el arreglo: `/prevision` vuelve a responder
`200` en ~1s. Nota para la próxima vez que se amplíe una ventana de
datos: el preview de esa misma rama SÍ respondió `200` al probarlo antes
de mergear (una sola vez) — el límite de tiempo/CPU de Cloudflare
Workers parece tener algo de variabilidad caso límite (según qué tan
"caliente" esté el Worker, la ubicación de borde, etc.), así que una
única comprobación en preview que sale bien no es garantía si la
petición va muy justa de presupuesto — mejor quedarse con margen de
sobra (payload bastante más pequeño del límite) que apurar al límite y
confiar en que una prueba puntual lo confirme.

**Aclaración de UX añadida 2026-09-13**: el usuario probó el coeficiente
por spot contra un caso real (Armintza, 7 de septiembre) y vio 47 en
vez del 66 que muestra tides4fishing.com — no es un bug (se replicó el
cálculo a mano y es correcto: el rango de marea de ese día, dentro de
la ventana de 17 días de ESE punto, cae en la parte baja de la subida
hacia el pico de vivas), es la consecuencia esperada de comparar contra
la propia ventana del spot en vez del índice nacional. Como esto puede
parecer "mal" a quien lo compare con otra web de mareas sin saber que
es un cálculo distinto a propósito, se añadió una nota siempre visible
(no solo un `title`, que en móvil no se ve) junto al coeficiente tanto
en `index.html` (`#panelMareaCoefNota`) como en `diario.html`
(`contextoHTML()`) explicándolo. Decisión confirmada con el usuario:
mantener el cálculo por spot en vez de volver al índice nacional.

**Bug real corregido 2026-09-13 — un día con datos parciales inflaba el
coeficiente de toda la ventana:** el usuario pegó la tabla completa de
septiembre 2026 de tides4fishing.com para Armintza y, comparándola
contra `coeficientePorSpot()`, salía sistemáticamente 10-28 puntos por
encima del real, todos los días (no solo el 7 de septiembre, que ya se
sabía que iba a diferir a propósito). Causa: Open-Meteo devuelve el
array horario completo para toda la ventana pedida
(`forecast_days=16`), pero el horizonte real de previsión de
`sea_level_height_msl` es más corto — a partir de ~9 días vista, el día
trae solo 1-2 horas con valor real (el resto `null`), verificado también
en Bakio y A Coruña (mismo patrón exacto en las 3 costas, así que afecta
a los 95 spots en cada pasada del cron horario). Ese día "a medias"
entraba igual en el cálculo de `rangoMin`/`rangoMax` de la ventana con
un rango de marea falsamente pequeño, desplazando al alza el coeficiente
de todos los demás días. Corregido exigiendo un mínimo de 20 horas
válidas por día (`HORAS_MINIMAS_POR_DIA`) antes de dejarlo entrar en la
normalización, en `functions/prevision.js` y su copia en `diario.html` —
regla general documentada en `ROBOT_REGLAS.md` para cualquier futura
ventana de datos horaria. Verificado con datos reales: el error medio
frente a tides4fishing.com baja de ~20 a ~11-12 puntos, tanto en
Armintza como en A Coruña (la diferencia residual es la esperada por
diseño, ver párrafo anterior — no es el bug). Cron forzado a mano tras
el merge para refrescar ya el valor cacheado en producción.

**Especies enriquecidas por la comunidad (2026-09-12):** el
desplegable de especies del diario muestra el nombre científico entre
paréntesis (verificado por especie, `ESPECIES` en `diario.html`). Una
especie escrita a mano bajo "Otra" se da de alta en
`especies_comunidad` (pública de lectura y escritura para cualquier
usuario logueado — mismo criterio de "enriquecer entre todos" que
`spots_usuario`) para aparecer como opción real la siguiente vez, en
vez de perderse en el campo de texto libre de esa única captura.

**Pendiente, aparcado a propósito (Fase 5, grupos privados):**
atribución de "quién subió esta captura/ubicación" — solo tiene sentido
cuando algo es visible para más gente que su dueño, que es justo lo que
grupos privados va a añadir. Se implementa junto con eso, no antes.

## Ubicaciones personalizadas (Fase 2 del plan de mejoras, 2026-09-12)

Cualquier usuario puede marcar un punto nuevo en el mapa de
`index.html` (clic, con el botón ➕) o usar su GPS (botón 📍). Nunca
escribe el nombre a mano: sale siempre de `/geocodificar` (proxy a
Nominatim/OpenStreetMap, `functions/geocodificar.js` — necesita
User-Agent propio, por eso no se llama directo desde el navegador) para
que la lista de spots se enriquezca con nombres reales, no apodos. Al
crear una ubicación se elige:
- **Tipo** (🪨 Costa / 🚤 Embarcación / 🤿 Buceo): Costa sí resuelve un
  nombre de localidad real por geocodificación inversa. Embarcación y
  Buceo son puntos de mar abierto — forzarles un nombre de localidad
  cercana sería engañoso (el punto no está ahí, está varios km mar
  adentro) — así que se identifican por sus coordenadas
  (`🚤 43.4123°N, 2.6789°W`), sin llamar a la geocodificación para el
  nombre. Corrección hecha tras probar la Fase 2 en real con el
  usuario — no revertir a "siempre geocodificar" sin volver a hablarlo.
- **Privada o pública**: pública la ve cualquier usuario de la app;
  privada, solo su creador. La visibilidad "compartida con mi grupo"
  (Fase 5, grupos privados, sin empezar todavía) se añadirá aparte vía
  funciones RPC — la tabla y su RLS no se tocan para eso.

Tabla `spots_usuario` (`nombre`, `tipo`, `pais`, `ccaa`, `lat`, `lon`,
`publica`) + `spots_favoritos` (favoritos por usuario, vale tanto para
un spot fijo como para uno personalizado). Nunca tienen cámara — nunca
llevan el punto verde de webcam en directo. Su índice de mar/pesca no
sale de `/prevision` (que solo conoce su lista fija de siempre) sino de
una llamada directa a Open-Meteo hecha en el propio `index.html`, igual
que ya hacía `diario.html` para "mi ubicación actual".

`diario.html` filtra el desplegable "Spot" según el tipo de salida
elegido (costa/embarcación/submarinismo): los ~90 spots fijos cuentan
todos como "costa"; cada ubicación personalizada aparece solo para su
propio tipo (buceo ↔ submarinismo). Si no hay ninguna ubicación de ese
tipo todavía, el desplegable lo dice en vez de mostrarse vacío sin
explicación.

## Endpoints (`functions/`)

| Ruta | Fichero | Qué hace | Auth |
|---|---|---|---|
| `/prevision` | `prevision.js` | Oleaje/viento/marea/corriente (Open-Meteo + boyas Puertos del Estado) + caudal de ríos por spot | No requiere sesión |
| `/luna` | `luna.js` | Fase y posición lunar por coordenadas (`?lat=&lon=`) | No requiere sesión |
| `/rayos-imagen` | `rayos-imagen.js` | Proxy del mapa de rayos de AEMET | No requiere sesión |
| `/webcam/<slug>` | `webcam/[slug].js` | Proxy de imagen de webcam (evita CORS/hotlinking) | No requiere sesión |
| `/sos-alerta` | `sos-alerta.js` | POST: manda el aviso SOS (email vía Resend) a los contactos de emergencia del usuario que llama | **Requiere** `Authorization: Bearer <token de sesión>` |
| `/aviso-alta` | `aviso-alta.js` | POST: avisa al admin por email cuando un `user_id` corresponde a un alta real de los últimos 5 min | Sin token — verifica con `service_role` server-side (ver más abajo) |
| `/geocodificar` | `geocodificar.js` | GET: geocodificación inversa (`?lat=&lon=`) para nombrar ubicaciones personalizadas, vía Nominatim | No requiere sesión |
| `/registrar-presion` | `registrar-presion.js` | POST: guarda la presión real de cada spot en `presion_historico` (Fase 4) | Sin sesión de usuario — protegido con secreto compartido (`X-Cron-Secret` / `CRON_SECRET`) |

Ninguno de los cuatro primeros toca tablas de usuario en Supabase.
`sos-alerta.js` es el único que sí, y usa siempre el token de quien llama.

## URL de producción

**`https://fishnow-59u.pages.dev/`** (confirmado 2026-09-12: `Server:
cloudflare`, `/login`, `/manifest.json` y todos los endpoints de
`functions/` responden como se espera). `costaviva.app` NO es este
despliegue — responde con cabeceras de Vercel y 404 en rutas que sí
existen aquí; no usarlo para verificar nada de este repo.

**Exposición pública confirmada y corregida el 2026-09-12**: antes de
añadir `functions/_middleware.js`, `ROBOT.md`, `CALIBRACION.jsonl`,
`README.md`, `start.ps1` y ambos `supabase/*.sql` se servían con `200` en
producción (contenido revisado: sin secretos ni datos reales de
usuarios, pero sí detalle interno de esquema/RLS e historial operativo —
exposición de información, no fuga de datos de usuario). **Verificado en
vivo el 2026-09-12 tras el deploy**: las 7 rutas bloqueadas devuelven
`404`, y `/`, `/login`, `/prevision`, `/webcam/<slug>`, `/luna` y
`/sos-alerta` (incluido su rechazo 401 sin token) siguen funcionando
igual que antes.

## Fórmulas del índice de mar / índice de pesca (`index.html`)

**`indiceMar(s)`** (línea ~986): `alturaNorm*40 + vientoNorm*35 +
factorOposicion*25`, con `alturaNorm = altura/1.2m` y `vientoNorm =
viento/30km/h` (ambos tope 1) y `factorOposicion` según el ángulo entre
dirección de ola y de viento. **Los umbrales 1.2m/30km/h y los pesos
40/35/25 no citan ninguna fuente** — son un criterio de diseño inicial,
no una referencia oficial. Si se ajustan alguna vez, documentar aquí el
porqué del cambio.

**Corregido 2026-09-12 — vigencia máxima de 1h, por spot.** Antes,
`indiceMar()` no distinguía "dato real de ahora" de "dato ausente": si el
backend no tenía viento para esa hora, el código dejaba el valor
placeholder cargado al abrir la página (o el de la última vez que sí
respondió) y calculaba el índice igual, con el mismo aspecto de
confianza — el mismo tipo de bug que un denominador-a-0 interpretado como
"100% cumplido". Además, `/prevision` solo se pedía una vez al cargar la
página: dejarla abierta horas mostraba un índice cada vez más viejo sin
ningún aviso.

Ahora cada spot guarda `s.actualizadoEn` (timestamp del último fetch de
`/prevision` que sí trajo datos para ESE spot en concreto — es por spot,
no un flag global, porque un spot puede fallar mientras el resto se
actualiza bien). `indiceMar(s)`/el índice de pesca devuelven `null` (se
pinta "S/D" en gris, nunca un número) si ese spot no tiene un fetch de
verdad de la última hora (`spotVigente(s)`, `VIGENCIA_MAX_MS` en
`index.html` ~línea 993). Además:
- `actualizarDesdeBackend()` ahora se repite cada hora (antes: solo al
  cargar) vía `setInterval`, y hay un tick ligero cada minuto
  (`refrescarIndicesVisibles()`) que recalcula vigencia/colores aunque el
  refresco de red esté fallando — así el índice pasa a gris en cuanto
  toca, no solo cuando alguien vuelve a pintar la pantalla.
- El header muestra un indicador de vigencia general
  (`#estadoVigenciaGlobal`) y cada panel de spot muestra el suyo
  (`#panelIndiceNota` / `#panelIndicePescaNota`).

**Simplificación consciente, no un gap oculto:** la vigencia es por
spot, no por campo — si un spot se actualiza pero solo le falta el
viento de esa hora concreta, ese spot entero cuenta como vigente (el
campo de viento en sí seguiría con lo último que hubo, no con `null`).
Ir a vigencia por campo sería un rediseño mayor de todo el pipeline de
render; no se ha hecho porque el bug real y crítico (mostrar un índice
con aspecto fiable calculado con datos de horas/días atrás) ya queda
cerrado con la vigencia por spot.

**`indicePesca` (línea ~1553) ya usaba un patrón parecido de "no
inventar"**: cuando no hay ninguna especie con rango de temperatura
documentado, usa un valor neutro (`0.5`) en vez de 0 o 1, y el texto dice
explícitamente "sin especies con rango de temperatura documentado hoy".
Ahora además hereda la vigencia por spot del punto anterior.

## Triggers / rutinas automatizadas

Desde el propio repo solo hay evidencia de **una** rutina programada: el
"robot de investigación/auditoría de datos" que escribe en `ROBOT.md` y
`CALIBRACION.jsonl`, con tres responsabilidades en la misma pasada:

1. **Fuentes nuevas** — busca/verifica fuentes de datos externas
   candidatas (nunca las da por buenas sin una petición real vista).
2. **Auditoría de datos** — revisa que lo ya integrado siga funcionando.
3. **Calibración** — compara el oleaje calculado contra boyas reales de
   Puertos del Estado; el factor de corrección resultante **nunca se
   aplica en automático**, siempre es una propuesta a confirmar por el
   usuario (regla ya escrita en `ROBOT.md`).

Reglas operativas ya declaradas en `ROBOT.md` (cabecera del fichero):
nunca inventar un dato (`null` siempre mejor que un número inventado);
fuente nueva de bajo riesgo → integrar en rama `robot/AAAA-MM-DD`
validando con `node --check`; cualquier cambio de frontend/diseño/mapa o
decisión de producto → solo proponer, no implementar; corrección trivial
de auditoría → corregir directo, cualquier otra cosa → proponer.

**Limitación de esta entrada:** no tengo visibilidad directa del panel de
rutinas cloud (cadencia exacta, qué tiene permiso real para tocar sin
supervisión) — esto es una reconstrucción a partir de lo que `ROBOT.md`
dice de sí mismo, no una fuente verificada de gestión de triggers.

**Red de seguridad de la automatización (añadida 2026-09-12, ver
`ROBOT_REGLAS.md`):** límite de volumen (más de 3 ficheros o ~80 líneas
en una pasada → cuarentena, proponer en vez de aplicar), interruptor de
pausa (fichero `ROBOT_PAUSADO` en la raíz → la rutina no escribe nada esa
pasada), y la instrucción de que una futura auditoría periódica debe
incluir muestreo de las pasadas de esta rutina. Es la regla escrita, no
una comprobación técnica externa — el robot tiene que leerla y
respetarla, igual que el resto de `ROBOT_REGLAS.md`.

## Test de autenticación (`test/endpoints-auth.test.js`)

Corre con `node test/endpoints-auth.test.js` (sin dependencias) contra
Supabase real y `https://fishnow-59u.pages.dev`. Comprueba: las 6 tablas
de usuario no devuelven datos sin token (solo anon key), y `/sos-alerta`
rechaza peticiones sin token o con un token inválido. Programado a diario
en `.github/workflows/auth-test.yml` (no escribe nada, solo lee/rechaza —
seguro de tener en automático).

**Incluye también** la prueba más estricta (token de usuario A leyendo una
fila de usuario B) — opcional: solo corre si están las variables de
entorno `TEST_USER_A_EMAIL`/`TEST_USER_A_PASSWORD`/`TEST_USER_B_EMAIL`/
`TEST_USER_B_PASSWORD`; sin ellas se salta con un aviso en vez de fallar.
Cuentas de prueba creadas y confirmadas el 2026-09-12
(`etxebe2005+fishnowtest1@gmail.com` / `etxebe2005+fishnowtest2@gmail.com`,
alias de Gmail — llegan al mismo buzón del usuario; la misma cuenta A
sirve también para `smoke-test.yml`). **Ejecutado en real el 2026-09-12:
el token de B no vio la fila de A, ni por listado ni por id directo.**
Credenciales fuera del repo (no commitear nunca contraseñas de estas
cuentas, ni de prueba). Los 6 secrets ya están puestos en GitHub Actions
(`TEST_USER_A/B_EMAIL/PASSWORD`, `SMOKE_TEST_EMAIL/PASSWORD`) — la
prueba cruzada ya corre de verdad en el `auth-test.yml` diario, no solo
a mano.

## Rutinas programadas (todas activas y probadas en real, 2026-09-12)

Las cuatro originales se probaron primero a mano (`workflow_dispatch`)
antes de activar el `schedule` — `smoke-test.yml` falló en su primer
intento (ver abajo) y se corrigió antes de programarlo. Horas
escalonadas para no competir por runners:

| Workflow | Cron (UTC) | Qué hace |
|---|---|---|
| `security-scan.yml` | `30 4 * * 1` (lunes) | ZAP baseline (pasivo) contra producción → Issue "ZAP Scan Baseline Report" |
| `smoke-test.yml` | `0 5 * * *` | login real → `/prevision` → `/webcam/mundaka` → crea/borra una salida de pesca de prueba. `/sos-alerta` excluido a propósito (ver más abajo) |
| `daily-report.yml` | `0 6 * * *` | salud + conteo real de SOS (24h) → entrada nueva en el Issue "Informe diario — Costa Viva" |
| `auth-test.yml` | `17 6 * * *` | RLS sin token + prueba cruzada A-lee-B (secrets ya puestos) |
| `presion-historico.yml` | `7 * * * *` (cada hora) | POST a `/registrar-presion` (secret `PRESION_CRON_SECRET`) — guarda la presión real de cada spot en `presion_historico`, para la tendencia real de `/prevision` (Fase 4, ver más abajo). **Activada y verificada en real el 2026-09-12**: primer intento falló (42501, faltaba política de `insert` en la RLS de `presion_historico` — ni el propio endpoint podía escribir con la anon key sin sesión), corregido en `20260912230000_fix_insert_presion_historico.sql`; segundo intento escribió filas reales, confirmado leyendo la tabla. |

`0 6 * * *` = 08:00 en verano (CEST) / 07:00 en invierno (CET) — GitHub
Actions no ajusta el cron por el cambio de hora. Ajustar aquí si se
quiere afinar. Avisos vía Issues de GitHub (que ya notifican por email
al dueño del repo) — no se montó un canal de email aparte para esto.

- **`security-scan.yml`**: ZAP en modo baseline (pasivo, nunca payloads
  activos) contra `fishnow-59u.pages.dev`.
- **`daily-report.yml`**: cuenta las alarmas SOS de las últimas 24h vía
  `contar_alertas_sos_24h()`, función `security definer` en Supabase
  (nunca filas ni user_id, solo el entero) — aplicada en producción el
  2026-09-12.
- **`smoke-test.yml`**: su primer intento falló (`42501`, RLS) porque el
  insert de prueba en `salidas_pesca` no mandaba `user_id` explícito —
  corregido extrayendo el id del login antes de programarlo.

## Disciplina de trabajo (añadida 2026-09-12, ver memoria de sesión)

- **Rama + preview antes de mergear a main**: cualquier cambio con efecto
  visible (frontend, un endpoint de `functions/`, cualquier cosa que
  cambie lo que ve/hace un usuario real) va en una rama; se espera el
  deploy de preview de Cloudflare Pages y se prueba ahí de verdad antes
  de mergear. Cambios inertes (documentación, workflows solo con
  `workflow_dispatch`, migraciones todavía sin aplicar) no necesitan este
  paso.
- **Migraciones de Supabase, no `.sql` suelto**: adoptado —
  `supabase/migrations/` con `20260912144111_conteo_alertas_sos_24h.sql`
  como primera migración real, aplicada con `supabase db push
  --db-url <connection pooling string>`. Notas para la próxima vez:
  - `supabase link` con un Personal Access Token de cuenta **no
    funcionó** (error de privilegios de la API de gestión de Supabase,
    incluso con el usuario confirmado como Owner y el token con todos
    los scopes) — no perder tiempo ahí de nuevo sin comprobar primero si
    Supabase lo ha arreglado.
  - La cadena de conexión **directa** (`db.imncbmizxkorotpeisic.supabase.co`)
    solo tiene registro DNS AAAA (IPv6) — falla en cualquier entorno sin
    salida IPv6 (`ENOTFOUND`). Usar siempre la de **Connection
    Pooling** (`aws-*.pooler.supabase.com`, usuario
    `postgres.imncbmizxkorotpeisic`), que sí resuelve por IPv4.
  - `supabase db pull` en modo migración necesita Docker (no disponible
    en este entorno) para la "shadow database" — no se pudo traer un
    baseline de `schema.sql`/`schema_diario_alarma.sql` como migración.
    Por eso esas dos tablas siguen siendo `.sql` suelto (ya aplicado
    hace tiempo, no se toca) y solo lo *nuevo* a partir de ahora usa
    `supabase/migrations/`. Migrar el histórico requeriría Docker
    Desktop en la máquina donde se ejecute.
  - `supabase db push --db-url "<pooler>" --include-all --yes` sí
    funciona sin Docker ni `link` — es la vía a repetir para la próxima
    migración.

## Grupos privados (Fase 5 del plan de mejoras, 2026-09-13)

Cuadrillas de amigos que comparten entre ellos ubicaciones, capturas
y/o calendario — sin admin: cualquier miembro puede invitar, cualquiera
puede salirse y borrar su propio contenido. Página nueva `grupos.html`
(mismo esqueleto de login-guard + `tabs-nav` que `diario.html`/
`alarma.html`, pestaña añadida en las 4 páginas).

**Decisión de seguridad clave — no tocada la RLS de `salidas_pesca`/
`capturas`.** Esas dos tablas tienen una política ya verificada con
pruebas cruzadas reales (`auth.uid() = user_id`, ver
`test/endpoints-auth.test.js`) — tocarla para meter la visibilidad de
grupo ahí habría sido el cambio de más riesgo de todo este plan. En vez
de eso, tres funciones `security definer`
(`obtener_calendario_grupo`/`obtener_capturas_grupo`/
`obtener_ubicaciones_grupo`, en la migración
`20260913010000_grupos_privados.sql`) hacen su propia comprobación de
pertenencia al grupo (`es_miembro_de()`, helper `security definer` que
evita el problema conocido de políticas RLS recursivas) + de si el
dueño de esa fila activó "compartir" esa categoría para ESE grupo, y
solo entonces devuelven las filas — como `jsonb` (no `setof <tabla>`,
para poder añadir `autor_nombre` sin enumerar a mano todas las columnas
de cada tabla).

**"Técnicas" plegado dentro de "capturas"** (simplificación deliberada,
ya anotada en el plan): el mensaje original del usuario pedía poder
compartir spot/capturas/técnicas/calendario como cuatro cosas
independientes. Separar la técnica del resto de una captura
(especie/talla/peso/fotos) exigiría una vista de solo-columnas-
permitidas, mucho más compleja de mantener segura — para esta primera
versión, activar "compartir capturas" comparte la captura entera,
técnica incluida.

**Atribución ("quién subió esto")**: se aparcó a propósito en la Fase 2
hasta que hubiera un sitio donde tuviera sentido (solo importa cuando
algo es visible para más gente que su dueño). Se añadió
`perfiles.nombre` (apodo público, antes no existía nada — solo el email
privado) para esto: cada usuario pone su propio apodo desde
`grupos.html`, nunca se expone el email. Para que nadie pueda
aprovechar un PATCH a `perfiles` para auto-aprobarse
(`perfiles.aprobado`), se revocó el `UPDATE` de tabla completa a
`authenticated` y se concedió solo en la columna `nombre` —
`grant update (nombre) on public.perfiles to authenticated`, además de
la política RLS normal por fila.

**Invitaciones**: solo por enlace/código por ahora
(`invitaciones_grupo`, consumido vía `unirse_a_grupo()` — la tabla en sí
no tiene política de select pública, así que el código no es
enumerable leyendo la tabla). **La opción de invitar por email NO se ha
implementado**: sufriría el mismo problema ya documentado al principio
de este fichero (`sos-alerta.js`) — mandar a un destinatario arbitrario
desde un dominio no verificado en Resend falla con 403. Implementarlo
ahora habría sido una función garantizada de no funcionar; se deja para
cuando se verifique un dominio propio.

**Sin probar en real con dos cuentas todavía** (pendiente, ver
`CLAUDE.md` sección de cuentas de prueba): la exploración de
`login.html`/entrada de contraseñas está fuera de lo que un asistente
puede hacer por su cuenta (nunca debe manejar contraseñas), así que esta
fase se verificó con `curl` + anon key (confirmado: sin recursión de
RLS, `grupos`/`miembros_grupo` responden `200 []` sin sesión) pero NO
con el flujo completo de dos usuarios reales creando/uniéndose a un
grupo. Probarlo así es el siguiente paso antes de dar la fase por
cerrada del todo.

**Compartir capturas por tipo de salida (2026-09-13):** "compartir
capturas" era todo o nada — pedido explícito del usuario: poder
compartir solo costa y no embarcación (o al revés), y que sea
independiente por grupo (mismo usuario puede compartir distinto en cada
cuadrilla, ya sale gratis porque `miembros_grupo` es por
`(grupo_id, user_id)`). Tres columnas nuevas
(`compartir_capturas_costa/embarcacion/submarinismo`, todas `default
true` para no recortar en silencio lo que ya se compartía) más 3
checkboxes en `grupos.html` bajo el interruptor maestro (se ocultan si
"Compartir mis capturas" está desactivado). `obtener_capturas_grupo()`
ahora une con `salidas_pesca` para filtrar por `tipo_salida` — filas
antiguas sin ese campo (antes de que existiera) se tratan como "costa".

## Rediseño de cabecera/menús (2026-09-13)

Pedido explícito del usuario tras revisar la app en vivo desde el
móvil:
- **Menú de cuenta arriba a la derecha** (👤, en las 4 páginas): "📤
  Invitar a un amigo" (comparte el enlace de la app vía
  `navigator.share`, con fallback a copiar al portapapeles — mismo
  patrón que "Compartir ubicación" en `alarma.html`) y "🚪 Cerrar
  sesión" — sustituye al enlace "Salir" que vivía en el menú inferior
  (`.tabs-nav`).
- **Menú inferior** rediseñado: cada icono va dentro de un recuadro
  redondeado (`.tabs-nav a .icono`) en vez de flotar sobre fondo plano
  — pedido explícito: "que parece que están sacados de una excel".
- **`index.html`**: quitado el párrafo fijo de la cabecera y la nota
  "Coef. propio de este punto..." bajo MAREA (redundantes). Nuevo botón
  "ⓘ" expandible junto a "ÍNDICE DE MAR COMBINADO" y "ÍNDICE DE PESCA"
  que explica en una frase qué representa cada número (0-100, según
  nuestro propio algoritmo). "Qué se puede pescar" pasa a `<details>`
  por especie bajo el titular "¿Qué esperamos pescar hoy?", en vez de
  mostrar las 5-6 especies siempre expandidas de golpe.

## Ideas aparcadas explícitamente (2026-09-13, no empezadas)

Tres pedidas por el usuario la misma noche del rediseño de arriba,
aparcadas a propósito por su tamaño/sensibilidad — no tocar sin
retomarlo expresamente con él:

- **Agente de "qué se está pescando ahora"**: agregar capturas reales
  de usuarios que hayan consentido (el checkbox de `login.html`,
  `consiente_uso_datos_capturas`, ya existe para esto) cruzándolo con
  los datos de temporada/temperatura ya en `ESPECIES` — "si no hay
  nada, sin comentarios, sin más" (nunca inventar). El usuario apuntó
  que el consentimiento podría acabar viviendo dentro del acuerdo de
  una futura suscripción en vez de un checkbox aparte — pendiente de
  que esa suscripción exista antes de diseñar esto del todo. Falta
  decidir un mínimo de capturas/usuarios distintos antes de mostrar
  nada agregado, para no des-anonimizar sin querer a quien haya
  pescado algo poco común en un spot con muy poca actividad.
- **Comprobación de normativa de pesca recreativa** al subir una foto
  de captura (talla mínima, cupo de piezas/kg por jornada) + un
  contador por salida que se ajusta según lo declarado. Requiere
  investigar tallas/cupos reales por Comunidad Autónoma (varían mucho,
  y España delega la competencia de pesca marítima recreativa en las
  CCAA) — dar un "OK" equivocado tendría consecuencias reales, así que
  esto necesita fuentes oficiales verificadas antes de escribir una
  sola regla, no unos valores aproximados.
- **Priorizar `spots_usuario` populares como candidatos para el robot
  de cámaras**: el robot de datos ya investiga fuentes nuevas por su
  cuenta (ver `ROBOT_REGLAS.md`) — la idea es darle una lista de
  ubicaciones personalizadas con más actividad como candidatas
  prioritarias en vez de buscar a ciegas. Documentación pendiente de
  añadir a `ROBOT_REGLAS.md`, no requiere código nuevo.

## Robot buscador de fuentes — 4 veces al día (2026-09-13)

Nuevo workflow `.github/workflows/robot-buscador-fuentes.yml`, pedido
explícito del usuario: investigar fuentes nuevas (cámaras, mareas y
oleaje, corrientes, presión) 4 veces al día, no solo en la pasada
nocturna. Un solo workflow (no 4 separados, decisión explícita del
usuario) que rota de área según qué cron lo disparó
(`github.event.schedule`), invocando una sesión de Claude Code en modo
no interactivo (`claude -p ... --dangerously-skip-permissions`) que
sigue las mismas reglas de `ROBOT_REGLAS.md` que la rutina nocturna
externa (nunca inventar datos, límite de volumen para aplicar cambios
directos, interruptor `ROBOT_PAUSADO`). Publica su resumen en el mismo
Issue "Informe diario — Costa Viva" que ya usa `daily-report.yml`.

**Limitación importante que hay que recordar**: la herramienta de cron
de una sesión de Claude Code normal (`CronCreate`) es solo de esa
sesión — se borra al cerrarla y caduca a los 7 días. Por eso esto se
montó como GitHub Action (igual que los otros 5 workflows del repo),
no como algo programado desde dentro de una conversación — es la única
vía duradera y versionada que esta sesión puede crear por sí misma. La
rutina nocturna "principal" (la que escribe en `ROBOT.md` con más
profundidad) sigue viviendo en otro sitio fuera de este repo, con una
cadencia y permisos que esta sesión no puede ver (limitación ya
reconocida arriba).

**Pendiente antes de fiarse del schedule** (mismo criterio que el
resto de rutinas de este repo): añadir el secret `ANTHROPIC_API_KEY` a
GitHub Actions (Settings → Secrets → Actions — es un almacén distinto
al de Cloudflare Pages, aunque se reutilice el mismo valor que ya usa
`functions/identificar-captura.js`) y probar con `workflow_dispatch`
antes de esperar a que dispare solo.

## Pendiente conocido (no tocar sin confirmar)

- Prueba cruzada usuario-A-lee-fila-de-usuario-B: **hecha y verificada el
  2026-09-12** — usuario B nunca vio las filas de usuario A (ni listado
  ni por id directo) en `contactos_emergencia` ni `salidas_pesca`; filas
  de prueba limpiadas después. RLS confirmado en el caso más estricto.
- `smoke-test.yml` nunca debe llamar a `/sos-alerta` (decisión explícita
  del 2026-09-12) — dispararía un email de socorro real. Si en el futuro
  se quiere cubrir también ese camino, hace falta antes un modo de
  prueba explícito en `sos-alerta.js` que nunca llame a Resend de verdad
  para una cuenta marcada como test — decidirlo aparte, no asumirlo.
- **`functions/aviso-alta.js`** (añadido 2026-09-12): avisa por email al
  admin en cada alta real (llamado desde `login.html` tras un `signUp()`
  con éxito). Único uso de `SUPABASE_SERVICE_ROLE_KEY` en todo el repo —
  solo lectura de `auth.users` por id para verificar que el alta es
  real y de los últimos 5 minutos (resistente a spoofing con un
  `user_id` inventado o reutilizado), nunca para tablas de usuario. Las
  3 variables de entorno (`SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_EMAIL`,
  `RESEND_API_KEY`) ya están puestas en Cloudflare Pages. Usa el
  remitente de pruebas de Resend (`onboarding@resend.com`) porque no hay
  dominio propio verificado — ver el aviso crítico al principio de este
  fichero. **Pendiente de confirmación final**: el usuario va a
  registrarse de verdad en `/login.html` para comprobar si el email le
  llega (bloqueado de probarlo yo mismo por el rate-limit de altas de
  Supabase).
- Punto 13 del diagnóstico (2026-09-12, sin aplicar nada): el alta en
  `login.html` es pública sin CAPTCHA/Turnstile — mitigado parcialmente
  porque `perfiles.aprobado` bloquea el acceso real hasta aprobación
  manual, pero no hay ningún aviso al admin cuando alguien se registra
  (hoy hay que mirar el Table Editor a mano). No existen todavía código
  de invitación/descuento ni cuentas compartidas tipo "tripulación" — no
  hay nada que blindar ahí hasta que esas features existan.
