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
hora de cada captura) usan el mismo componente `crearSelectorHora()`
(rueda con scroll+snap para horas y minutos, con un checkbox "Sin
especificar") en vez de `<input type="time">` — el nativo, en algunos
navegadores/móviles, solo deja ver unas pocas horas a la vez. Vanilla
JS/CSS, sin librerías (el repo no tiene build step).

Todas las migraciones probadas en real antes de mergear (rama +
preview): login con cuenta de prueba, salida embarcación → boya real
usada correctamente (y NO usada para submarinismo, verificado tras la
corrección); captura con técnica Spinning → campo de señuelo apareció y
se guardó bien; hora exacta (07:40 y 08:15) guardada y mostrada
correctamente tanto en la salida como en la captura.

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
(`admin+fishnowtest1@costaviva.invalid` / `admin+fishnowtest2@costaviva.invalid`,
alias de Gmail — llegan al mismo buzón del usuario; la misma cuenta A
sirve también para `smoke-test.yml`). **Ejecutado en real el 2026-09-12:
el token de B no vio la fila de A, ni por listado ni por id directo.**
Credenciales fuera del repo (no commitear nunca contraseñas de estas
cuentas, ni de prueba). Los 6 secrets ya están puestos en GitHub Actions
(`TEST_USER_A/B_EMAIL/PASSWORD`, `SMOKE_TEST_EMAIL/PASSWORD`) — la
prueba cruzada ya corre de verdad en el `auth-test.yml` diario, no solo
a mano.

## Rutinas programadas (todas activas y probadas en real, 2026-09-12)

Las cuatro se probaron primero a mano (`workflow_dispatch`) antes de
activar el `schedule` — `smoke-test.yml` falló en su primer intento (ver
abajo) y se corrigió antes de programarlo. Horas escalonadas para no
competir por runners:

| Workflow | Cron (UTC) | Qué hace |
|---|---|---|
| `security-scan.yml` | `30 4 * * 1` (lunes) | ZAP baseline (pasivo) contra producción → Issue "ZAP Scan Baseline Report" |
| `smoke-test.yml` | `0 5 * * *` | login real → `/prevision` → `/webcam/mundaka` → crea/borra una salida de pesca de prueba. `/sos-alerta` excluido a propósito (ver más abajo) |
| `daily-report.yml` | `0 6 * * *` | salud + conteo real de SOS (24h) → entrada nueva en el Issue "Informe diario — Costa Viva" |
| `auth-test.yml` | `17 6 * * *` | RLS sin token + prueba cruzada A-lee-B (secrets ya puestos) |

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
