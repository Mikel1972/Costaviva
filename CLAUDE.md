# CLAUDE.md — Costaviva

Este fichero se lee al empezar cada sesión y se reescribe libremente cuando
cambian las convenciones — no es un historial (para eso está `ROBOT.md`).
Si algo de aquí queda desactualizado, corrígelo en el momento en que lo
detectes, no lo dejes para luego.

## Analítica de uso propia (`eventos_uso`, añadida 2026-09-17)

Pedido explícito del usuario: entender qué usa de verdad cada usuario
para (1) poder darle mejor servicio y (2) decidir qué rediseñar/quitar
en base a uso real, no intuición. Cloudflare Web Analytics no sirve
(agregado/anónimo, sin usuario).

Tabla `public.eventos_uso` (user_id, tipo, detalle jsonb, creado_en),
RLS: cada usuario solo puede **insertar** sus propios eventos, nadie
puede leer nada desde el cliente (ni admin.html, ni el propio dueño).
Lectura solo vía dos funciones `security definer` restringidas a
`es_admin()`:
- `admin_resumen_eventos_uso()` — por tipo de evento: total, usuarios
  distintos, último uso. Para ver qué se usa/no se usa.
- `admin_eventos_uso_usuario(p_user_id)` — desglose de un usuario
  concreto. Para ayudar a alguien en particular.

Helper `registrarEvento(tipo, detalle)` duplicado en cada página
(mismo criterio que otros helpers del repo, sin build step para
compartir código) — nunca bloquea la interacción si falla. Eventos ya
instrumentados: `ver_mapa`, `ver_capa_batimetria/estaciones/rios/boyas/
radar_lluvia`, `crear_ubicacion_personalizada`, `marcar_favorito`
(index.html); `crear_salida`, `crear_captura` (diario.html, solo altas
nuevas, no ediciones); `pulsar_sos` (alarma.html); `crear_grupo`,
`unirse_grupo` (grupos.html); `ver_suscripcion`, `iniciar_checkout`
(suscripcion.html). **No duplica** los datos de pesca en sí (especie,
talla, spot, etc.) — eso ya vive completo en `capturas`/`salidas_pesca`
desde antes, `eventos_uso` es solo sobre qué funciones se tocan.

`functions/geocodificar.js` ampliado con `?cp=<código postal>`
(geocodificación directa) — usado para centrar el mapa de index.html en
la zona del usuario (`perfiles.codigo_postal`, recogido en el alta).

**Robot de patrones de uso** (`.github/workflows/robot-patrones-uso.yml`,
añadido el mismo día): pedido explícito del usuario ("debiera haber un
robot analizando patrones de uso... para proponer cambios y mejoras").
Semanal (sábados, no diario — con pocos usuarios una semana ya dice más
que un día, y evita gastar cuota de API sin nada nuevo que aportar,
mismo criterio que el recorte de `robot-buscador-fuentes.yml` del
2026-09-16). Lee `eventos_uso`/`capturas`/`salidas_pesca` por REST con
`SUPABASE_SERVICE_ROLE_KEY` (bypassa RLS, solo lectura) — no puede usar
`admin_resumen_eventos_uso()`/`admin_eventos_uso_usuario()` porque esas
comprueban `es_admin()` vía `auth.email()`, que no existe en un token de
service_role. **Regla más estricta que el resto de robots del repo**:
nunca implementa ningún cambio de producto/UI por su cuenta bajo ningún
argumento (decidir qué rediseñar/quitar es puramente decisión del
usuario) — solo puede escribir en `ROBOT.md`, nada más. Publica su
resumen en el mismo Issue "Informe diario — Costaviva" que el resto.
**Pendiente de primera ejecución real** (probar con `workflow_dispatch`
antes de fiarse del `schedule`, mismo criterio que el resto de rutinas).

## ✅ RESUELTO (2026-09-17): fin de la aprobación manual de altas + repo renombrado a Costaviva

**Bug real encontrado el mismo día, tras probar con un alta real**: la
primera versión de este cambio (migración `20260917080000`) arregló
`handle_new_user()` — pero esa función es **código huérfano**, no está
enganchada a ningún trigger. El trigger de verdad (`on_auth_user_created`
en `auth.users`) llama a **`gestionar_alta_perfil()`** (la función real,
definida en `schema.sql` y redefinida con un campo más en
`schema_diario_alarma.sql`), que seguía insertando `aprobado=false`. Una
cuenta de prueba creada después del primer merge quedó bloqueada al
segundo login pese a la migración. Arreglado en
`20260917092621_fix_gestionar_alta_perfil_aprobado.sql` (la función
correcta esta vez) — **si algo similar vuelve a tocar el alta, comprobar
SIEMPRE qué función ejecuta de verdad `on_auth_user_created` antes de
tocar ninguna función con un nombre parecido.**

**Pedido explícito del usuario**: el alta copiaba el patrón de Etxeapala
(cuenta creada pero bloqueada hasta que el admin la aprobaba a mano desde
Supabase, avisado por email vía `aviso-alta.js` justo al registrarse) —
eso tiene sentido en Etxeapala (app familiar cerrada) pero no aquí, Costa
Viva es de alta abierta y el paso extra solo añadía fricción sin
seguridad real (ninguna RLS de tabla de usuario comprueba `aprobado`,
todas comprueban `auth.uid() = user_id`; la barrera real de quién entra
ya la pone la confirmación de email obligatoria de Supabase).

**Cambio, migración `20260917080000_alta_autoaprobada.sql`**:
- `perfiles.aprobado` pasa a `default true` (y el trigger `handle_new_user`
  a insertar `true`) — las altas nuevas quedan activas desde el momento
  del registro, sin esperar nada. Las que estaban pendientes de aprobar
  antes de este cambio también se pusieron a `true` (grandfathered).
- El campo `aprobado` **no desaparece**: `admin.html` sigue usándolo para
  "Pausar/Reactivar" una cuenta después del alta (moderación), vía
  `admin_fijar_acceso()` — eso no cambia.
- `login.html`: ya no llama a `/aviso-alta` ni muestra "un administrador
  debe aprobarla" — ahora dice "revisa tu email para confirmar la
  cuenta". El check de `aprobado === false` al iniciar sesión se queda,
  pero ahora es "cuenta pausada por el admin", no "pendiente de aprobar".
- `functions/aviso-alta.js` **eliminado**, sustituido por
  `functions/notificar-altas.js` (llamado cada 30 min por
  `.github/workflows/notificar-altas.yml`, mismo `CRON_SECRET` que
  `/registrar-presion`): avisa al admin por email (a) cuando alguien
  confirma su email de verdad (alta activada, informativo) y (b) cuando
  alguien lleva más de 48h sin confirmar (posible fallo de entrega) —
  cada alta se avisa como mucho una vez por tipo, controlado por las
  columnas nuevas `perfiles.email_confirmado_avisado` /
  `alta_fallida_avisada` y las funciones `security definer`
  `altas_activadas_pendientes_aviso()` / `altas_sin_confirmar_pendiente_aviso()`
  (grant solo a `service_role`, nunca a `authenticated`).

**Repo renombrado el mismo día**: `Mikel1972/Fishnow` → `Mikel1972/Costaviva`
en GitHub (con `gh repo rename`) — GitHub redirige el nombre antiguo
automáticamente. El proyecto de Cloudflare Pages (interno, URL
`fishnow-59u.pages.dev`) **sigue llamándose "fishnow" por dentro** —
pendiente, requiere tocar DNS/Turnstile a mano por el usuario (ver
"Triggers / rutinas" más abajo y el incidente de DNS de 2026-09-13/14).
`costaviva.org` no se ve afectado por nada de esto.

## ✅ RESUELTO (2026-09-13/14): recuperación de contraseña arreglada + CAPTCHA en login.html

**Bug original**: el enlace de "recuperar contraseña" autenticaba de
verdad (Supabase lo hace así a propósito, para poder llamar a
`updateUser()`), pero `login.html` no tenía ninguna pantalla para
cambiarla — el login simplemente veía que ya había sesión y mandaba
directo al mapa, sin dejar nunca escribir la contraseña nueva.

**Causa real, encontrada tras tres intentos fallidos de arreglar el
código de `login.html`**: el problema nunca estuvo en `login.html`. El
enlace del email (`https://<proyecto>.supabase.co/auth/v1/verify?...
&redirect_to=...`) llevaba un `redirect_to` que apuntaba a la raíz de
`fishnow-59u.pages.dev` (sin `/login`) — la "Site URL" configurada en
Supabase (Authentication → URL Configuration), de antes de que
existiera esta pantalla de recuperación. El enlace caía siempre en
`index.html` (el mapa), que solo ve una sesión válida y la muestra sin
más — ningún cambio dentro de `login.html` podía arreglar esto nunca,
porque el enlace no llegaba a ese fichero en absoluto. Encontrado
inspeccionando el enlace real del email en crudo (copiándolo sin
abrirlo) — **esta es la comprobación que había que hacer desde el
principio** en vez de seguir cambiando la lógica de eventos de
`login.html` a ciegas.

**Arreglo real, dos partes**:
1. En Supabase → Authentication → URL Configuration: "Site URL"
   actualizada a `https://costaviva.org` y añadida
   `https://costaviva.org/**` a "Redirect URLs" (antes solo estaba
   `https://fishnow-59u.pages.dev/**`).
2. `resetPasswordForEmail()` en `login.html` pasa ahora un `redirectTo`
   explícito (`${window.location.origin}/login`) — no basta con
   arreglar la Site URL, porque sin `redirectTo` explícito en el
   propio código, cualquier cambio futuro a esa configuración del panel
   volvería a romper esto en silencio. Si la URL de `redirectTo` no
   está en la lista blanca de "Redirect URLs", Supabase la ignora en
   silencio y vuelve a usar la Site URL — por eso las dos partes son
   necesarias juntas.

**Lección para la próxima vez que "el enlace de un email hace algo
raro"**: comprobar el enlace real en crudo (mantener pulsado sobre el
botón del email → Copiar, sin abrirlo) ANTES de tocar el código de la
página de destino — un `redirect_to`/Site URL mal configurado en
Supabase produce exactamente el mismo síntoma visible ("me entra
directo") que un bug real de JavaScript en la página, y sin mirar el
enlace en sí es indistinguible de fuera.

**Además, endurecido por el camino** (no era la causa del bug, pero es
una mejora real que se queda): la detección de la sesión ya no depende
de `supabase.auth.onAuthStateChange()` + la detección automática del
SDK (`detectSessionInUrl`) — se comprobó en real que no dispara el
evento `PASSWORD_RECOVERY` de forma fiable para el flujo PKCE
(`?code=`) de este proyecto. `login.html` ahora gestiona el código a
mano (`gestionarAccesoInicial()`: lee `?code=` y llama a
`supabase.auth.exchangeCodeForSession()`, con un respaldo por hash
`#access_token=...&type=recovery` + `setSession()` para el formato
antiguo) — determinista, sin eventos ni márgenes de tiempo.

**CAPTCHA (Cloudflare Turnstile)**, pedido explícito del usuario ("como
en Pólizas.ai"): Site Key `0x4AAAAAAEywlSn_bxleOonO`, widget "costa
viva", modo Managed. El token (leído de
`input[name="cf-turnstile-response"]`, que el script de Turnstile crea
solo) se exige antes de `signUp`, `signInWithPassword` y
`resetPasswordForEmail`, y se resetea (`window.turnstile.reset()`, los
tokens son de un solo uso) tras cada intento. La clave secreta se
configuró directamente en Supabase (Authentication → Settings → Enable
Captcha protection), nunca pasó por aquí. **Hostname Management del
widget**: tuvo que incluir no solo `costaviva.org`, sino también
`fishnow-59u.pages.dev` con subdominios (las URLs de preview de
Cloudflare Pages usan subdominios distintos en cada deploy, ej.
`ad90e324.fishnow-59u.pages.dev`) — sin esto, Turnstile falla con
"Error 300031" (hostname no permitido) en cualquier preview.

**Verificado en real de extremo a extremo, 2026-09-14**: pedido un
enlace nuevo, confirmado en crudo que `redirect_to=
https://costaviva.org/login`, clic en el enlace → aparece "Nueva
contraseña" → contraseña guardada → acceso concedido. El ciclo completo
de login/registro/recuperación con CAPTCHA queda verificado en
producción real.

## ✅ RESUELTO (2026-09-13): el SOS ya llega de verdad — dominio propio verificado

**Historial del problema** (crítico, sin resolver desde 2026-09-12):
`sos-alerta.js` mandaba el email de socorro desde `sos@costaviva.app`,
un dominio que ni siquiera era nuestro (despliegue de Vercel de otra
persona) y que nunca estuvo verificado en Resend. Confirmado en real en
su momento: Resend rechazaba con `403 "domain is not verified"`
cualquier envío a un destinatario que no fuera el dueño de la cuenta de
Resend — y los contactos de emergencia son siempre otra persona, así
que la alarma SOS probablemente no avisó a nadie en producción durante
un tiempo, sin que el resto del flujo (RLS, auth, la respuesta que veía
el usuario) lo delatara.

**Arreglo real, el mismo día**: el usuario compró `costaviva.org` (vía
Cloudflare Registrar) y lo dio de alta en Resend (región `eu-west-1`,
sin click/open tracking — son emails transaccionales de seguridad, no
marketing). Registros DNS añadidos en Cloudflare (públicos por diseño —
el DKIM es la clave PÚBLICA, Resend se queda la privada — sin ningún
secreto real en esta tabla):

| Tipo | Host/Name | Valor | TTL |
|---|---|---|---|
| TXT | `resend._domainkey` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCYovm3KUA1AMQvuuJ3CJz2LI8VvBc8hoKTnnH5J0K3A/cDiNc/mbQScSk2LC1AA/XLoOQvX6qia9FAv7p7GsWoQ+B1lzFfQHy5KQeqFzzVBUhFKY+ez2HWKB1rV0npqayH0GdZvWTS1/boD8VF3/3o5DwFCwbVSJXSQMzWChFcSQIDAQAB` | Auto |
| CNAME | `rsend` | `rsend-euw1.forge.rmta.net` | Auto |
| CNAME | `send` | `send.forge.rmta.net` | Auto |
| TXT (opcional, DMARC) | `_dmarc` | `v=DMARC1; p=none;` | Auto |

`sos-alerta.js` (`sos@costaviva.org`) y `aviso-alta.js` (sustituido el
2026-09-17 por `notificar-altas.js`, mismo remitente
`avisos@costaviva.org`, ya no depende del remitente de pruebas
`onboarding@resend.com`) actualizados y desplegados.

**Verificado en real de extremo a extremo, 2026-09-13**: se añadió el
email del propio usuario como contacto de emergencia temporal, se
disparó un SOS real desde `alarma.html` (`btnSOS`), el endpoint
respondió `"Aviso enviado a 1 contacto(s)"` sin error, **el email
llegó de verdad** (confirmado por el usuario, revisando spam
incluido), y se borró el contacto temporal para dejar todo como
estaba. La alarma SOS de este repo ya avisa a alguien de verdad.

**Resuelto también, mismo día**: Supabase Auth usa su PROPIO sistema de
email interno para confirmaciones de alta/recuperación de contraseña —
completamente aparte de Resend, con su propio límite de cupo del plan
gratuito (el "email rate limit exceeded" que bloqueó recrear las
cuentas de prueba tras borrarlas desde el panel de admin). Configurado
el SMTP personalizado de Supabase (Authentication → Emails → SMTP
Settings) apuntando a Resend (`smtp.resend.com`, puerto 465, usuario
`resend`, contraseña = `RESEND_API_KEY`, remitente
`noreply@costaviva.org`) — verificado en real pidiendo un
restablecimiento de contraseña para `etxebe2005+fishnowtest1@gmail.com`
vía `POST /auth/v1/recover`: `200` y el email llegó de verdad. Ya no
depende del límite de Supabase.

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
  - `perfiles` — una fila por usuario, `aprobado` boolean. Desde
    2026-09-17 ya NO es aprobación manual inicial (eso era el patrón de
    Etxeapala, no aplica aquí — alta abierta) — el default es `true` y
    solo se pone a `false` si el admin pausa la cuenta después, desde
    `admin.html` (`admin_fijar_acceso()`). Ver migración
    `20260917080000_alta_autoaprobada.sql`.
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
  `service_role`. Hay **dos excepciones** en el repo: `notificar-altas.js`
  (llama por REST a dos funciones `security definer` con `grant ... to
  service_role` — `altas_activadas_pendientes_aviso()` /
  `altas_sin_confirmar_pendiente_aviso()`, ver migración
  `20260917080000` — nunca lee tablas de usuario directamente, y solo lo
  llama el cron de `notificar-altas.yml`, protegido con `CRON_SECRET`) y
  `stripe-webhook.js` (sí escribe una tabla `public.*`, `suscripciones`,
  pero solo tras verificar a mano la firma criptográfica
  `Stripe-Signature` — ver la sección del paywall más abajo).

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
| `/geocodificar` | `geocodificar.js` | GET: geocodificación inversa (`?lat=&lon=`) para nombrar ubicaciones personalizadas, vía Nominatim | No requiere sesión |
| `/notificar-altas` | `notificar-altas.js` | POST: avisa al admin por email de altas activadas (email confirmado) y de altas sin confirmar tras 48h — sustituye a `aviso-alta.js` (eliminado 2026-09-17) | Sin sesión de usuario — protegido con secreto compartido (`X-Cron-Secret` / `CRON_SECRET`, mismo que `/registrar-presion`) |
| `/registrar-presion` | `registrar-presion.js` | POST: guarda la presión real de cada spot en `presion_historico` (Fase 4) | Sin sesión de usuario — protegido con secreto compartido (`X-Cron-Secret` / `CRON_SECRET`) |
| `/crear-checkout-stripe` | `crear-checkout-stripe.js` | POST: crea una Stripe Checkout Session (suscripción mensual/anual, con prueba) para el usuario que llama | **Requiere** `Authorization: Bearer <token de sesión>` |
| `/crear-portal-stripe` | `crear-portal-stripe.js` | POST: crea una sesión del Billing Portal de Stripe para gestionar/cancelar la suscripción propia | **Requiere** `Authorization: Bearer <token de sesión>` |
| `/stripe-webhook` | `stripe-webhook.js` | POST: recibe eventos de Stripe (checkout/suscripción) y actualiza `suscripciones` | Sin sesión — verifica la firma `Stripe-Signature` con `STRIPE_WEBHOOK_SECRET` |

Ninguno de los cuatro primeros toca tablas de usuario en Supabase.
`sos-alerta.js` sí, y usa siempre el token de quien llama.
`crear-checkout-stripe.js`/`crear-portal-stripe.js` también usan el
token de quien llama. `stripe-webhook.js` es la única excepción de
esta lista que usa `service_role` (ver sección del paywall más abajo).

## URL de producción

**`https://costaviva.org/`** (dominio propio, añadido como dominio
personalizado del proyecto de Cloudflare Pages el 2026-09-13 —
verificado en real que sirve la app de verdad, `/login` y `/prevision`
responden bien). `https://costaviva.org/` sigue funcionando
exactamente igual (mismo despliegue, dos puertas) pero ya no es la URL
canónica — usar `costaviva.org` en código/documentación nueva.
`costaviva.app` (sin la "org") NO es este despliegue — responde con
cabeceras de Vercel y 404 en rutas que sí existen aquí; no usarlo para
verificar nada de este repo (fácil de confundir con el dominio real).

**Incidente y arreglo — CNAME de la zona en "DNS only", no "Proxied"
(2026-09-13/14)**: `costaviva.org` empezó a fallar de forma
intermitente (timeout puro, sin respuesta HTTP) unas horas después de
migrar el dominio — confirmado que no era cosa de esta red/máquina
(mismo fallo desde `WebFetch`, que corre en infraestructura de
Anthropic, completamente aparte). El panel de Cloudflare Pages →
Custom domains seguía mostrando "Active, SSL enabled" durante el fallo
— **ese estado no es fiable para descartar este problema**. Ni el
certificado (válido, confirmado en SSL/TLS → Edge Certificates) ni el
DNS (correcto, confirmado registro a registro) eran la causa; quitar y
volver a añadir el custom domain en Pages tampoco lo arregló.

Diagnóstico real, de un agente de soporte de Cloudflare: al añadirse la
zona DNS de `costaviva.org` a la cuenta el mismo día que ya existía el
custom domain en Pages, quedó un conflicto entre el certificado "SaaS"
que usa Pages para custom domains y el certificado Universal SSL propio
de la zona — distintos nodos de borde de Cloudflare elegían uno u otro
de forma inconsistente, y los que elegían el de la zona intentaban un
proxy naranja-a-naranja hacia `*.pages.dev` que nunca resolvía (de ahí
la intermitencia). **Arreglo verificado en real**: en la zona DNS (no en
Pages) → DNS → Records → cambiar el CNAME `costaviva.org` →
`fishnow-59u.pages.dev` de "Proxied" (nube naranja) a **"DNS only"**
(nube gris). Efecto inmediato. Se pierde el proxy de zona (WAF/
analíticas a ese nivel) para este registro, irrelevante para esta app
(sin reglas de WAF propias) — Cloudflare Pages sigue sirviendo el sitio
igual de bien por su propia red. **Si esto vuelve a pasar en cualquiera
de los otros proyectos hermanos** (Pólizas.ai, Etxeapala, Lurnahi) al
añadir un dominio nuevo: sospechar de esto primero, no perder tiempo
revisando certificado/DNS/remove-readd (ver memoria de sesión).

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
Supabase real y `https://costaviva.org`. Comprueba: las 6 tablas
de usuario no devuelven datos sin token (solo anon key), y `/sos-alerta`
rechaza peticiones sin token o con un token inválido. Programado a diario
en `.github/workflows/auth-test.yml` (no escribe nada, solo lee/rechaza —
seguro de tener en automático).

**Incluye también** la prueba más estricta (token de usuario A leyendo una
fila de usuario B) — opcional: solo corre si están `TEST_USER_A_EMAIL`,
`TEST_USER_B_EMAIL` y `SUPABASE_SERVICE_ROLE_KEY`; sin ellas se salta con
un aviso en vez de fallar. Cuentas de prueba
(`etxebe2005+fishnowtest1@gmail.com` / `etxebe2005+fishnowtest2@gmail.com`,
alias de Gmail — llegan al mismo buzón del usuario; la misma cuenta A
sirve también para `smoke-test.yml`). **Ejecutado en real: el token de B
no vio la fila de A, ni por listado ni por id directo.**

**Sin password desde 2026-09-14**: activar el CAPTCHA de Turnstile en
Supabase bloqueó el login por password
(`/auth/v1/token?grant_type=password`) que usaban tanto esta prueba como
`smoke-test.yml` — mismo endpoint que un usuario real, sin
`captcha_token` Supabase lo rechaza siempre (`error_code:
"captcha_failed"`), y un script de CI no puede resolver un CAPTCHA real.
Arreglado generando la sesión vía API admin en su lugar
(`/auth/v1/admin/generate_link` con `SUPABASE_SERVICE_ROLE_KEY` +
`/auth/v1/verify` con la anon key) — `TEST_USER_A/B_PASSWORD` y
`SMOKE_TEST_PASSWORD` ya no hacen falta. **Dos detalles no obvios de la
API de Supabase, encontrados a base de probar en real** (documentar
aquí para no repetir la búsqueda si hace falta tocar esto otra vez):
- `/auth/v1/verify` espera el hash en el campo **`token_hash`**, no
  `token` (ese último es para el código OTP de 6 dígitos que trae
  `email_otp`, un campo distinto de la misma respuesta).
- El `type` en `/verify` debe ser **`"email"`**, no `"magiclink"` (ese
  valor está obsoleto específicamente ahí — sigue siendo válido como
  `type` al pedir el enlace en `/admin/generate_link`, son dos
  parámetros de dos llamadas distintas con el mismo nombre).

Credenciales fuera del repo (no commitear nunca contraseñas de estas
cuentas, ni de prueba). Secrets en GitHub Actions:
`TEST_USER_A_EMAIL`/`TEST_USER_B_EMAIL`/`SUPABASE_SERVICE_ROLE_KEY`
(compartida con `smoke-test.yml`), `SMOKE_TEST_EMAIL` — la prueba
cruzada ya corre de verdad en el `auth-test.yml` diario, no solo a mano.

## Rutinas programadas (todas activas y probadas en real, 2026-09-12)

Las cuatro originales se probaron primero a mano (`workflow_dispatch`)
antes de activar el `schedule` — `smoke-test.yml` falló en su primer
intento (ver abajo) y se corrigió antes de programarlo. Horas
escalonadas para no competir por runners:

| Workflow | Cron (UTC) | Qué hace |
|---|---|---|
| `security-scan.yml` | `30 4 * * 1` (lunes) | ZAP baseline (pasivo) contra producción → Issue "ZAP Scan Baseline Report" |
| `smoke-test.yml` | `0 5 * * *` | login real → `/prevision` → `/webcam/mundaka` → crea/borra una salida de pesca de prueba. `/sos-alerta` excluido a propósito (ver más abajo) |
| `daily-report.yml` | `0 6 * * *` | salud + conteo real de SOS (24h) → entrada nueva en el Issue "Informe diario — Costaviva" |
| `auth-test.yml` | `17 6 * * *` | RLS sin token + prueba cruzada A-lee-B (secrets ya puestos) |
| `presion-historico.yml` | `7 * * * *` (cada hora) | POST a `/registrar-presion` (secret `PRESION_CRON_SECRET`) — guarda la presión real de cada spot en `presion_historico`, para la tendencia real de `/prevision` (Fase 4, ver más abajo). **Activada y verificada en real el 2026-09-12**: primer intento falló (42501, faltaba política de `insert` en la RLS de `presion_historico` — ni el propio endpoint podía escribir con la anon key sin sesión), corregido en `20260912230000_fix_insert_presion_historico.sql`; segundo intento escribió filas reales, confirmado leyendo la tabla. |

`0 6 * * *` = 08:00 en verano (CEST) / 07:00 en invierno (CET) — GitHub
Actions no ajusta el cron por el cambio de hora. Ajustar aquí si se
quiere afinar. Avisos vía Issues de GitHub (que ya notifican por email
al dueño del repo) — no se montó un canal de email aparte para esto.

- **`security-scan.yml`**: ZAP en modo baseline (pasivo, nunca payloads
  activos) contra `costaviva.org`.
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

## Tema claro (2026-09-13)

Pedido explícito del usuario: "utiliza colores claros" / "piensa en un
look&feel atractivo, moderno" — sustituido el tema oscuro por uno claro
en las 5 páginas (no un interruptor, se eligió reemplazar del todo).
Misma identidad de marca (dorado `#D4A24C`, Fraunces/Inter/IBM Plex
Mono), roles de luminosidad invertidos:

| Rol | Antes (oscuro) | Ahora (claro) |
|---|---|---|
| Fondo de página | `#0B2532` | `#F7F3E8` |
| Tarjeta/sección | `#0F2C38` | `#FFFFFF` |
| Fondo terciario (inputs, chips, iconos) | `#123B4D` | `#EEF2EF` |
| Texto principal | `#E8E2D0` | `#0B2532` (reutilizado — ya era el texto oscuro de los botones dorados) |
| Texto secundario | `#7FA3AF` | `#5C7680` |
| Texto apagado | `#9FB8BF` / `#6C8890` | `#5F7981` / `#42585F` |
| Bordes | `#1C3F4F` | `#DDE2DC` |
| Dorado como texto (antes ilegible en blanco) | `#D4A24C` | `#A8792A` (el dorado de fondo de botón no cambia) |

Mensajes de error/éxito/aviso reutilizan el antiguo color de borde
(ya bastante oscuro) como nuevo color de texto, y generan un borde
nuevo más claro (`#A8D4B8`, `#D9C08A`). `theme-color` y
`apple-mobile-web-app-status-bar-style` (pasó de `black-translucent` a
`default`) actualizados para que la barra de estado del móvil combine.

**Casos de doble rol que un reemplazo ciego habría roto** (revisados a
mano): texto claro sobre elementos con **fondo oscuro propio**
(distinto del fondo general de la página) se deja intencionadamente en
claro — el botón de ampliar el mapa de rayos, la insignia "EN DIRECTO"
de la webcam, el `.expandir-rayos`, y la cuenta atrás de SOS
(`.cuenta-atras-overlay`, fondo `rgba(11,37,50,0.96)` a propósito, para
que la emergencia destaque incluso en tema claro). `#7FA3AF` original
en `#comprobandoAcceso` (pantalla de carga) sí seguía el patrón general
sin excepción.

**Contraste ajustado tras revisar en real**: `#7C939A` (primera versión
del texto más apagado) daba ~3.4:1 sobre blanco, por debajo del mínimo
recomendado (4.5:1) — usado en TODAS las etiquetas de formulario de las
5 páginas. Sustituido por `#5F7981` (~4.8:1).

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

**3 bugs reales encontrados y corregidos probando en real en un iPhone
(PWA instalada), el mismo día del rediseño de arriba** — ninguno se
veía en escritorio, solo se detectaron con capturas reales del usuario:

1. **Menú inferior invisible en la PWA instalada**: en modo standalone
   (`apple-mobile-web-app-capable`), la app ocupa toda la pantalla
   incluida la franja del home indicator de iOS — sin ajuste de área
   segura, el contenido fijo del fondo puede quedar ahí. Arreglado con
   `viewport-fit=cover` en las 4 páginas + `body` a `100dvh` (con
   `100vh` de respaldo) + `.tabs-nav`/su padding-bottom sumando
   `env(safe-area-inset-bottom)` a los 64px de siempre. De paso se
   corrigió un `bottom: 54px` obsoleto en `.panel` (index.html) que
   seguía con la altura antigua del menú, antes del rediseño a 64px.
2. **Botón "✕" de cerrar el panel de spot, sin respuesta al toque**:
   16px sin padding es un objetivo táctil demasiado pequeño para un
   dedo (mínimo recomendado 44×44 en iOS/Android). Arreglado con
   padding + margen negativo (amplía la zona pulsable sin mover el
   icono visualmente) en `.panel .cerrar`.
3. **Ese mismo botón se iba con el scroll**: el panel de un spot es más
   alto que la pantalla de un móvil (hay que bajar el scroll para ver
   marea/corriente/índices), y el botón de cerrar no era `sticky` —
   dejaba de estar donde el usuario lo buscaba tras bajar el scroll.
   Arreglado con `position: sticky; top: 0` en `.panel .cerrar`,
   verificado en el navegador que se queda fijo tras 300px de scroll.

**Decisión de producto explícita, mismo hilo**: el usuario pidió que el
menú inferior se vea SIEMPRE, incluso con la ficha de un spot abierta
debajo — antes el panel (z-index 1000) podía quedar por encima del
menú (z-index 700) según la altura real en cada dispositivo. Ahora
`.tabs-nav` tiene z-index 1100 (por encima del panel) a propósito, para
garantizarlo pase lo que pase con el cálculo de alturas de cada móvil,
no solo confiando en el `bottom` offset del panel.

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

**Cuarta idea, pedida el 2026-09-14, misma categoría (aparcada, solo
investigación por ahora)**: **estimar la mar de fondo (swell de periodo
largo) combinando boyas exteriores + batimetría + imágenes de webcam**.
El oleaje de fondo viaja por aguas profundas con poca pérdida de
energía y a una velocidad de grupo calculable por su periodo, así que
en teoría se puede propagar la lectura de una boya exterior hasta cada
spot y contrastarla con la transformación por batimetría al acercarse a
la costa — calibrando ese modelo contra las boyas costeras que Puertos
del Estado ya tiene cerca de cada zona, mismo patrón que la calibración
de oleaje/coeficiente de marea que ya existe. Las webcams se ven más
como corroboración cualitativa (p.ej. % de espuma/rompiente visible)
que como fuente numérica independiente — visión artificial para altura
de ola real es un problema difícil y frágil (necesita calibración por
cámara, se rompe si alguien mueve la cámara). Añadido como tarea de
investigación para la pasada de "mareas y oleaje" del robot buscador de
fuentes (ver más abajo) — como todo lo que toca el índice de mar, sería
siempre una propuesta a confirmar, nunca un cambio directo.

**Quinta idea, pedida el 2026-09-15, misma categoría (aparcada, solo
diseñada por ahora, sin código)**: **botón de "trackeo" en `alarma.html`**
— quien va solo pulsa un botón, la app guarda su ubicación GPS cada
cierto intervalo (p.ej. 3 min) y la comparte con un contacto elegido, como
tranquilidad mientras dura la salida ("es una forma de estar tranquilo si
voy solo", palabras del usuario) — complementaria a la Alarma SOS (esa
avisa solo tras una caída detectada; esto es visibilidad continua elegida
a propósito, sin esperar a un incidente).

**Limitación técnica real que hay que dejar clara antes de construirlo**:
en iOS (Safari/PWA instalada, que es el uso principal de la app —
[[project-movil-primero]]), `watchPosition()`/`setInterval()` **se
pausan o se detienen en cuanto la pantalla se apaga o la app pasa a
segundo plano** — no hay geolocalización en background real sin ser una
app nativa con permiso "Always" (Costaviva es PWA, no tiene eso). Un
pescador con el móvil en el bolsillo y la pantalla apagada dejaría de
mandar ubicaciones sin ningún aviso — igual de peligroso que no tener el
botón, si se promete "cada 3 minutos" sin más matiz. Cualquier versión de
esto necesita, como mínimo: (a) dejarlo muy claro en la propia UI ("con
la pantalla encendida" o similar, no prometer algo que el sistema
operativo no permite cumplir), y/o (b) usar una notificación
persistente/Wake Lock API mientras el trackeo está activo para animar a
mantener la pantalla encendida, sabiendo que ni así hay garantía total.

**Diseño recomendado, no implementado todavía** (para cuando se retome):
reutilizar `contactos_emergencia` (ya existe, ya verificado con RLS) en
vez de crear una tabla de contactos aparte; nueva tabla
`trackeo_activo` (o similar) con `user_id`, `activo boolean`, y un
histórico de puntos `lat/lon/timestamp`, RLS igual que el resto
(`auth.uid() = user_id` para escribir; el contacto que recibe el trackeo
necesitaría una vía de lectura sin cuenta propia — probablemente un
enlace con token, no una cuenta Supabase, ya que un contacto de
emergencia no tiene por qué estar registrado en Costaviva). Igual que el
resto de ideas de esta sección: cuando se retome, es una propuesta de
diseño a confirmar con el usuario antes de escribir una sola línea de
RLS, no una implementación directa.

## Robot buscador de fuentes — 4 veces al día + 2 áreas 1x/día (2026-09-13)

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
Issue "Informe diario — Costaviva" que ya usa `daily-report.yml`.

**Ampliado el mismo día con 2 áreas más**, pedidas explícitamente por el
usuario, cada una 1 vez al día (no 4, a diferencia de las originales —
ver `ROBOT_REGLAS.md`, sección "Buenas prácticas de otras apps y
biología de especies"):
- **Buenas prácticas de otras apps** (Windy, Tides4fishing, Fishbrain,
  Meteoblue, Puertos del Estado, AEMET...) — qué datos en tiempo real o
  funciones tienen que Costaviva no. Siempre propuesta en `ROBOT.md`,
  nunca implementación directa (es una decisión de producto por
  definición).
- **Migración y cría de especies** — épocas de migración y rangos de
  temperatura para reproducción/cría/reposo de las especies de
  `ESPECIES` (`diario.html`), para enriquecer eso o `indicePesca` más
  adelante. Mismo criterio de "nunca inventar un dato" que los
  sinónimos regionales; siempre propuesta, nunca cambio directo.

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

**Recortado el 2026-09-16 — gasto real de API más alto de lo esperado
en la cuenta (60 USD en un día), revisado junto con el usuario.** Las 4
áreas de datos en tiempo real verificables (cámaras, mareas/oleaje,
corrientes, presión) se quedan a diario. Las 4 de
"investigación/contenido, solo propuesta en `ROBOT.md`, nunca aplicación
directa" (caudal de ríos, buenas prácticas de otras apps, migración/cría
de especies, estudios académicos) pasan de diario a **semanal**, cada
una un día distinto (martes/miércoles/jueves/viernes) — no tenían la
misma urgencia que las de datos en tiempo real (nada se aplica solo,
siempre se revisa a mano) y eran las que más volumen de sesión sumaban.
Además, `--model claude-sonnet-5` y `--max-turns` fijados
explícitamente en este workflow y en `robot-experiencia-usuario.yml`
(antes ninguno de los dos limitaba modelo ni turnos — una sesión podía
quedarse investigando sin tope). **Corrección 2026-09-17**: esta
entrada decía "40" para los dos workflows, pero `robot-buscador-
fuentes.yml` se había quedado en `--max-turns 25` — insuficiente para
la tarea (búsquedas web + verificación HTTP + editar `ROBOT.md` +
a veces commit/push), así que casi todas las pasadas desde el
2026-09-16 agotaban el límite antes de llegar a escribir la entrada en
`ROBOT.md` o el resumen del Issue diario (perdían el trabajo entero de
la pasada, no solo fallaba el job en rojo). Subido a 40 (en su momento
igualado con `robot-experiencia-usuario.yml`, que ese mismo día se
subió otra vez a 60 — ver el párrafo siguiente).

**Mismo problema encontrado también en `robot-experiencia-usuario.yml`,
mismo día (2026-09-17), pero enmascarado**: ese workflow tiene
`continue-on-error: true` en el paso de Claude Code, así que cuando
agota `--max-turns` el job queda en **verde** en GitHub Actions en vez
de en rojo — solo se nota porque el Issue "Informe diario" muestra el
mensaje de reserva "⚠️ El robot de experiencia de usuario no dejó
informe esta pasada". La pasada del 2026-09-16 sí completó dentro de 40
turnos y encontró 2 bugs reales (mareas absurdas en spots mediterráneos
de marea casi nula, y `eliminar_grupo()` sin desplegar en producción —
ver el detalle en `ROBOT.md`), pero la del 2026-09-17 agotó el límite y
perdió el informe entero. Subido `--max-turns` 40→60 ahí también. **Para
la próxima vez que se revise este workflow: un job en verde no garantiza
que la pasada terminara de verdad** — comprobar siempre el contenido real
del Issue, no solo el color del check.

**Corrección a la limitación de arriba, encontrada la misma sesión**: la
"rutina nocturna principal" SÍ es visible e inspeccionable — no vive
fuera del alcance de una sesión de Claude Code, vive como una **rutina
en la nube** (`claude.ai/code/routines`, herramienta `RemoteTrigger`/skill
`schedule`, distinta de `CronCreate`) — persiste igual que un GitHub
Action, no caduca a los 7 días ni se borra con la sesión. Es
"Fishnow - Calibracion y salud nocturna" (diaria, 01:12 UTC) más
"Fishnow - Robot de datos (fuentes, auditoria, calibracion)" (semanal).
**Hallazgo más importante de esa misma revisión**: la cuenta tiene
además **~10 rutinas en la nube de Pólizas.ai**, varias más frecuentes
que cualquier cosa de este repo (una cada 6h, una 3x/día) — es multi-
proyecto, así que un gasto alto en un día concreto no implica
necesariamente que la causa esté en Fishnow. Dos de las de Pólizas.ai
(Diccionario del sector, antes cada 6h; Catálogo de mercado, antes
3x/día) se bajaron a diario ese mismo día como parte de este ajuste.
Antes de asumir que un gasto alto viene de este repo, revisar también
`RemoteTrigger`/`claude.ai/code/routines` de la cuenta completa, no solo
los workflows de este repo.

## Panel de administrador (2026-09-13)

Pedido explícito del usuario: "como en Pólizas.ai", ver quién está
inscrito, pudiendo pausarlo o eliminarlo. `admin.html` — no aparece en
el menú inferior de ninguna otra página; el acceso visible es un icono
⚙️ junto al botón de cuenta (`title="Admin"`), solo pintado cuando
`session.user.email === "etxebe2005@gmail.com"` (comprobado en JS en
las 4 páginas con cabecera). Esa comprobación en el cliente es solo
para no anunciar el icono a nadie más — la seguridad real está en
Supabase. La propia `admin.html` tiene su cabecera a juego con el
resto de la app: botón "← Volver al mapa" + botón de cuenta con
desplegable para cerrar sesión (pedido explícito tras el primer
despliegue: "no tengo botón para echar para atrás").

**Decisión de diseño clave**: nada de esto usa `service_role` ni un
segundo endpoint de Cloudflare. Tres funciones `security definer` en
Postgres (`supabase/migrations/20260913090000_panel_administrador.sql`):
- `es_admin()` — `auth.email() = 'etxebe2005@gmail.com'`.
- `admin_listar_usuarios()` — salta el RLS de `perfiles` (que solo deja
  ver la fila propia) SOLO si `es_admin()`.
- `admin_fijar_acceso(user_id, aprobado)` — "pausar" reutiliza la
  columna `perfiles.aprobado` que ya existía y ya estaba probada
  (login.html bloquea el acceso si es `false`) — no hace falta una
  columna "pausado" aparte, es el mismo estado real. Bloquea que el
  admin se pause a sí mismo.
- `admin_eliminar_usuario(user_id)` — borra directamente de
  `auth.users` (el rol que ejecuta la función tiene permiso sobre el
  esquema `auth`, no hace falta la Admin API ni service_role);
  cascada automática a todas las tablas de usuario por las FK ya
  existentes (`references auth.users(id) on delete cascade`).
  Bloquea que el admin se elimine a sí mismo. **Irreversible** —
  `admin.html` pide confirmación con `confirm()` antes de llamarla.

**Bug de seguridad real encontrado y corregido en la misma sesión**
(`20260913091500_fix_es_admin_null.sql`): `es_admin()` devolvía `NULL`
(no `false`) sin sesión, porque `auth.email() = 'x'` con `auth.email()`
NULL da NULL — y en PL/pgSQL `if not es_admin()` con NULL nunca entra
en la rama, así que las funciones no rechazaban llamadas sin
autenticar. Detectado probando con la sola anon key (`admin_fijar_acceso`
devolvía `204` en vez de un error) antes de dar el panel por bueno.
Corregido con `coalesce(..., false)` en `es_admin()`. Verificado tras
el fix: las 3 funciones rechazan con `400 "no autorizado"` sin sesión.

**Probado en real con datos reales** (2026-09-13): el panel muestra
correctamente los 6 usuarios registrados hasta ahora, incluidas dos
altas nuevas del mismo día; pausar/reactivar probado de verdad sobre
`etxebe2005+fishnowtest1@gmail.com` (restaurado a como estaba después).
"Eliminar" no se ha probado en real todavía (es irreversible) — la
capa de autorización sí está verificada.

## Estaciones de monte (precipitación/presión real) — en curso, 2026-09-14

Pedido explícito del usuario tras investigar el hueco de `caudal: null`
en los ríos vascos de `RIOS` (`index.html`) — ver el comentario en
`functions/prevision.js` sobre URA/Bizkaia bloqueando el acceso
automático. Idea: usar precipitación/presión real de estaciones de
monte (en vez de solo el modelo de Open-Meteo) como dato complementario
donde no hay caudal real. Alcance decidido con el usuario: **solo
rellenar el hueco de los ríos vascos** (no un rediseño de todo `RIOS`),
**Euskalmet para Euskadi, AEMET para el resto**.

**Email propio del proyecto para altas externas**: `datos@costaviva.org`
(Cloudflare Email Routing, activado 2026-09-14 — reenvía al Gmail del
usuario, sin buzón real). Mismo criterio que las direcciones de Resend
(`sos@`/`avisos@`/`noreply@`): nunca mezclar altas de servicios externos
con el email personal del usuario.

**AEMET OpenData — hecho y verificado**: alta en
`https://opendata.aemet.es/centrodedescargas/altaUsuario` con
`datos@costaviva.org`. Key obtenida y probada con una petición real
contra `/opendata/api/observacion/convencional/todas` (patrón de dos
pasos: esa llamada devuelve una URL corta en `datos`, hay que hacer un
segundo `GET` a esa URL para las lecturas reales) — confirmado en vivo:
Bilbao Aeropuerto, Santander Aeropuerto y Donostia Aeropuerto con
`prec` (precipitación de la hora) y `pres`/`pres_nmar` (presión) reales
del 2026-09-14. Cobertura nacional (~10.000 lecturas de golpe, todas
las estaciones), sirve para "AEMET para el resto".

**Caduca cada ~100 días (~3 meses) — decodificado del propio JWT
devuelto**: `iat` 2026-09-14, `exp` **2026-12-23**. Antes de esa fecha,
pedir una key nueva desde el mismo formulario con `datos@costaviva.org`
(la vieja deja de funcionar, no hay renovación automática) y
actualizar el secreto `AEMET_API_KEY` en Cloudflare Pages. **Recordar
esto explícitamente la próxima vez que se toque este fichero cerca de
esa fecha.**

Guardada como secreto `AEMET_API_KEY` en Cloudflare Pages (Settings →
Environment variables), nunca en el repo — mismo patrón que
`RESEND_API_KEY`.

**Implementado en código y verificado end-to-end en preview
(2026-09-14)**: `ESTACIONES_AEMET` + `datosEstacionesAemet()` en
`functions/prevision.js` (25 estaciones curadas, código `idema` +
coordenadas verificados uno a uno con una petición real antes de
escribirlos), expuesto en `/prevision` como `estacionesAemet`. En
`index.html`, marcador propio (🌧, sin dato inventado — igual que las
boyas, si no hay lectura real no se dibuja) que al pulsar abre un modal
con el detalle completo (precipitación, presión, temperatura,
viento...).

**Incidente real al configurar el secreto en Cloudflare Pages, mismo
día — para la próxima vez que algo similar "no llega" pese a estar bien
puesto**: la variable `AEMET_API_KEY` aparecía correctamente en el
dashboard (nombre bien, en el proyecto correcto, en Preview) pero
`context.env.AEMET_API_KEY` seguía dando el mismo error que si no
existiera — **se había guardado con el valor vacío** (un fallo de
copia/pegado en el propio formulario de Cloudflare, no nuestro). La
forma real de diagnosticarlo, más rápida que pelearse con los logs del
dashboard: añadir temporalmente al `Response` de la function un campo
con `Object.keys(context.env)` (nombres de variables, nunca valores) y
opcionalmente `.length` de la sospechosa — confirma en segundos si el
problema es "no existe la variable", "existe pero vacía", o el propio
código. Quitar el campo debug en cuanto se resuelva, nunca dejarlo en `main`.
("Retry deployment" sí recoge el valor actual de las variables al
volver a desplegar — lo que no hace es refrescar solo, hace falta
relanzarlo a mano tras cambiar una variable.)

**Pendiente, bloqueado del lado de Euskalmet**: perfil creado en
`https://api.euskadi.eus/met01uiApiKeyUsersWar/` con `datos@costaviva.org`
(dos intentos, 2026-09-14), pero el correo con la API key **nunca ha
llegado** — confirmado que no es un problema nuestro: MX/SPF de
`costaviva.org` están bien propagados (verificado con DNS real) y el
usuario revisó los logs de Cloudflare Email Routing. A diferencia de
AEMET (instantáneo), Euskalmet parece pasar por gestión/aprobación
manual (típico de una administración pública) — puede tardar. No
reintentar el alta ni tocar DNS por esto. **2026-09-14, mismo día**:
enviado email a soporte de Open Data Euskadi (`opendata@euskadi.eus`,
contacto oficial confirmado en su documentación) explicando el
problema. Respondieron pidiendo probar el acceso por **XLNets**
(sistema de identificación electrónica del Gobierno Vasco) — probado,
pero el email prometido **sigue sin llegar**, mismo síntoma que antes.
Refuerza que el problema es de Euskalmet, no nuestro: la key de AEMET
llegó instantánea a la misma dirección (`datos@costaviva.org`), así que
la recepción de correo funciona bien cuando el remitente lo hace bien.
Se ha respondido a soporte con este detalle — a la espera de nuevo. Una vez haya key,
guardar como `EUSKALMET_API_KEY` (mismo patrón) y entonces sí escribir
el código en `functions/prevision.js` (nueva función a estilo
`datosCaudalTodos()`) que, para los ríos vascos de `RIOS`, cruce por
CCAA/bounding box qué fuente usar y devuelva precipitación/presión real
de la estación de monte más cercana a la cabecera de cada río
(candidatas ya identificadas por su ubicación: Oiz — cabecera compartida
de Lea y Oka —, Urkiola, Berriatua, Sodupe). Nada de esto se ha
implementado en código todavía, solo la parte de credenciales.

## Webcams en vídeo de Gipuzkoa + turbidez + capas del mapa (2026-09-14)

Misma sesión que lo de arriba, tres piezas más añadidas en la rama
`feat/estaciones-monte-gipuzkoa`, verificadas de extremo a extremo:

**Webcams en vídeo real (HLS)** — 6 playas de Gipuzkoa (Hondarribia,
Donostia/Zurriola, Orio, Zarautz, Deba, Mutriku/Mutrikukaia), fuente
Diputación Foral de Gipuzkoa, CORS abierto (`Access-Control-Allow-Origin:
*`), cargadas directas sin proxy propio (`WEBCAMS_HLS` en `index.html`).
`puntuacionOleajeVisual()` generalizada para analizar tanto `<img>` como
`<video>`; para vídeo se capturan 3 frames espaciados 2.5s y se descarta
el que más se aparta de los otros dos (posible giro de cámara panorámica
a media captura) antes de promediar. **Bug real encontrado y arreglado
probando en vivo**: Chrome devuelve `"maybe"` en
`video.canPlayType('application/vnd.apple.mpegurl')` (válido según el
propio estándar, no implica soporte real) — el código comprobaba eso
antes que `Hls.isSupported()`, así que Chrome entraba siempre por la
rama "nativa" y el vídeo se quedaba colgado sin pedir nada al stream.
Arreglado invirtiendo la prioridad (hls.js primero siempre que esté
disponible). **Confirmado funcionando en un Chrome real del usuario**
tras el arreglo. Nota para la próxima vez que haga falta depurar vídeo/
HLS: el navegador automatizado de esta sesión (Claude in Chrome) no
decodifica bien streams HLS reales (manifiesto y segmentos se
descargaban perfectos vía `fetch()`, pero hls.js nunca llegaba a pedir
un fragmento) — es una limitación de ese entorno de pruebas, no del
código; para depurar reproducción de vídeo de verdad, pedir al usuario
que pruebe en su propio navegador en vez de fiarse de la automatización.

**✅ Quitada del todo (2026-09-15): la "lectura visual" de oleaje
(`puntuacionOleajeVisual()`/`etiquetaOleajeVisual()` de arriba) resultó no
ser un problema de umbral mal puesto, sino de raíz — la métrica confunde
"muchos bordes de alto contraste" con "oleaje".** Reportado por el
usuario ("por qué pone esto siempre?"), investigado descargando 5
imágenes reales de cámaras de proveedores distintos y replicando el
cálculo exacto en Node (`sharp`) fuera del navegador: Laredo y Calpe
(puertos deportivos llenos de barcos amarrados, agua totalmente en calma)
puntuaron 93 y 100 — MÁS alto que Bakio (58, oleaje real con espuma) —
porque los cascos/mástiles/reflejos de los barcos generan tantos "bordes"
como la espuma de una ola rompiendo. Mundaka, con el mar liso, ya
puntuaba 38 (por encima del umbral de "rompiente", 35) solo por el ruido
de sensor/compresión JPEG y los edificios de la orilla en el recorte
inferior. No hay un único umbral que separe bien ambos casos porque el
puerto en calma ya puntúa por encima del mar agitado de verdad — subir el
umbral rompería la detección real (Bakio, 58) antes de dejar de marcar
falsos positivos en los puertos. Decisión del usuario, con este hallazgo
ya sobre la mesa: quitar la función entera en vez de intentar excluir a
mano las ~15 cámaras de puerto/marina de `SPOTS_CON_LECTURA_VISUAL`. Se
borraron `SPOTS_CON_LECTURA_VISUAL`, `analizarFrame()`,
`puntuacionDeGris()`, `diferenciaMediaGris()`, `puntuacionOleajeVisual()`,
`promedioVisualMultiFrame()`, `etiquetaOleajeVisual()`,
`actualizarLecturaVisual()`/`actualizarLecturaVisualVideo()` y el `<div
id="lecturaVisual">` de los dos paneles de webcam (imagen fija y HLS) —
las webcams en sí (imagen y vídeo HLS) se quedan igual, solo desaparece
el indicador "👁 ...". Los comentarios de
`scripts/turbidez/medir-turbidez.mjs` que citaban esta función (es un
cálculo HSV independiente, nunca importó nada de `index.html`) se
actualizaron para no referenciar algo que ya no existe.

**Turbidez relativa del agua** — pieza completa nueva (no confundir con
el oleaje visual, es un cálculo aparte): tabla `turbidez_historico`
(pendiente de aplicar la migración
`20260914100000_turbidez_historico.sql` en Supabase — no se ha hecho
todavía), endpoint `/registrar-turbidez` (mismo `CRON_SECRET` que
`/registrar-presion`), workflow diario `turbidez.yml` (mediodía Madrid,
runner de GitHub Actions con `sharp`+`ffmpeg` porque Cloudflare Workers
no tiene API de imagen/vídeo) que analiza saturación/tono HSV del agua
de cada webcam (imagen fija y vídeo) y lo guarda. Nunca se compara un
spot contra otro (el ángulo de cada cámara lo haría sin sentido, mismo
problema que ya existía con el coeficiente de marea) — cada lectura se
clasifica en no turbia/turbia/muy turbia por percentil contra el propio
histórico de 90 días de ESE spot, y con menos de 14 lecturas se queda
sin clasificar (S/D). **Pendiente**: aplicar la migración y lanzar el
workflow a mano (`workflow_dispatch`) para la primera prueba real — no
se ha ejecutado todavía.

**Spots, ríos y boyas como capas independientes** — pedido explícito del
usuario para un mapa limpio y personalizable: tras el login solo la capa
de spots empieza encendida (`capaSpots`, botón 📍 activo por defecto);
ríos (`capaRios`, botón 〰️) y boyas (`capaBoyas`, botón ⚓) quedan
apagadas hasta que el usuario las active, mismo patrón que batimetría/
radar/estaciones AEMET que ya eran opt-in. Apagar spots deshabilita
también el botón "+" de añadir ubicación (`.deshabilitado`, pointer-
events:none) — no tiene sentido añadir un punto que no se va a poder
ver. Verificado en preview real: los spots (incluidos los nuevos de
Gipuzkoa) se pintan bien, el resto de capas arrancan apagadas.

## Paywall de suscripción — Stripe (2026-09-15, en curso)

Pedido explícito del usuario: pasar de app gratis a **7 días de prueba
desde el alta, luego bloqueo total** (no freemium) salvo suscripción
activa — **3,99€/mes o 39,99€/año**. Proveedor: **Stripe**, vía web
(las tiendas siguen "próximamente", ver `project_movil_primero` en
memoria). Producto real en Stripe (modo TEST de momento):
`prod_VGVio7rbJPK1Oh` "Costaviva Premium", precios
`price_1UFyhEGXcSRiyJYIvGpTzjZu` (mensual) y
`price_1UFyhEGXcSRiyJYIdjCv5aFH` (anual).

**Diseño**: tabla `public.suscripciones` (migración
`20260915160000_suscripciones_stripe.sql`) con RLS "deny by
default" — solo lectura propia (`auth.uid() = user_id`), **sin**
políticas de escritura; la única escritura es `stripe-webhook.js` vía
`service_role`, justificado porque ahí no hay sesión de usuario y la
prueba de autenticidad es la firma `Stripe-Signature` de Stripe
(verificada a mano con Web Crypto, sin SDK — el repo no tiene build
step). Es la **segunda excepción** del repo al patrón "nunca
service_role", junto a `notificar-altas.js`.

Toda la lógica de acceso vive en una única función
`security definer`, `mi_estado_suscripcion()`: el trial sale de
`perfiles.creado_en` (7 días, sin columna nueva), el admin
(`es_admin()`) siempre tiene acceso, y pasado el trial solo hay acceso
con `estado` `trialing`/`active` en `suscripciones`. El frontend
(`index.html`/`diario.html`/`alarma.html`/`grupos.html`/`admin.html`,
cada uno con su propio guard duplicado, sin partial compartido) llama
a esta función justo después de comprobar que hay sesión, y redirige a
`suscripcion.html` si `con_acceso === false` — fallo silencioso si la
RPC falla por red, solo bloquea un `false` explícito.

`suscripcion.html` es la pantalla de pago/gestión (mismos tokens
visuales que `login.html`): dos botones que llaman a
`/crear-checkout-stripe` (nunca acepta el price id crudo del cliente,
solo `"monthly"`/`"annual"` traducido server-side) y redirigen a la
URL de Stripe Checkout devuelta. `success_url`/`cancel_url` se
calculan del origen de la petición (`new URL(request.url).origin`),
no hardcodeados a `costaviva.org`, para que funcione igual en preview
y producción. `allow_promotion_codes=true` en la sesión de Checkout —
los cupones (% o importe fijo, con caducidad o límite de usos) se
gestionan enteramente desde el Dashboard de Stripe, no hace falta
código para cada cupón nuevo.

**Cancelación y reembolsos, decisión explícita del usuario**: se puede
cancelar cuando se quiera (vía `/crear-portal-stripe`, que abre el
Billing Portal de Stripe), pero el plazo ya pagado **no se
reembolsa** — el acceso sigue activo hasta el final de ese periodo y
luego no se renueva. Esto es el comportamiento natural de Stripe con
una cancelación "al final del periodo" (no inmediata): el estado sigue
`active` hasta que el periodo termina de verdad, así que
`mi_estado_suscripcion()` no necesita lógica extra para esto. **Pendiente
de configurar a mano en el Dashboard de Stripe** (no es algo que se
pueda fijar desde el código sin la API de configuración del portal):
Settings → Billing → Customer portal → Cancellations → "Cancel at end
of billing period" (no "Cancel immediately").

Para el plan **anual**, además, `suscripcion.html` exige marcar una
casilla de consentimiento explícito antes de activar el botón de pago
— no basta con decir "no reembolsable" en la UI: por defecto, en la UE
el usuario tiene 14 días de derecho de desistimiento en compras
online, así que la casilla declara explícitamente que el servicio
empieza de inmediato y que renuncia a ese derecho para esa compra. Sin
ese consentimiento explícito, la cláusula de "no reembolsable" podría
no ser válida ante una reclamación real.

**Trial de Stripe vs. trial de la app**: `crear-checkout-stripe.js`
calcula `subscription_data[trial_period_days]` dinámicamente
(`7 - días desde el alta`, mínimo 1) en vez de fijarlo siempre a 7 —
evita regalar otros 7 días de prueba de Stripe encima de una prueba de
la app ya parcialmente consumida si el usuario se suscribe tarde
dentro de su semana gratis. `subscription_data[metadata][supabase_user_id]`
(no solo el `metadata`/`client_reference_id` de nivel superior de la
Checkout Session) es imprescindible para que el `user_id` llegue a los
eventos `customer.subscription.*` del webhook — el objeto Subscription
de Stripe no hereda el metadata de nivel superior de la Session.

**✅ Verificado en real de extremo a extremo, 2026-09-15** (rama
`feat/stripe-suscripciones`, modo TEST): migración aplicada, checkout
mensual completo con tarjeta de prueba (`4242 4242 4242 4242`),
webhook entregado y procesado, fila real en `suscripciones` con
`estado: "trialing"` y los IDs de Stripe correctos. Cuatro bugs reales
encontrados y corregidos por el camino — documentados aquí para no
repetir la investigación:

1. **`return` a nivel superior del módulo en `index.html` — SyntaxError
   real.** El gate de suscripción se escribió primero con
   `if (...) { ...; return; }` dentro de un `else` que NO está envuelto
   en ninguna función (script de módulo con top-level `await`, como el
   resto de páginas) — `return` fuera de una función es un error de
   sintaxis en JS, así que el navegador ni siquiera podía parsear el
   script entero. Síntoma: "Comprobando acceso…" colgado para siempre,
   sin ningún error visible en pantalla (el resto de páginas usan
   `throw new Error(...)` en el mismo sitio, que SÍ es válido a nivel
   superior — por eso solo `index.html` tenía este bug). Arreglado
   sustituyendo el `return` por un flag (`conAcceso`) que envuelve el
   resto del bloque. **Lección**: `node --check` sobre el contenido de
   un `<script type="module">` extraído (no sobre el `.html` en sí)
   habría detectado esto al instante — hacerlo la próxima vez que se
   toque el top-level de un módulo de estas páginas.
2. **"Managed Payments" de Stripe (activado por defecto en cuentas
   nuevas) exige un `tax_code` de producto.** Sin él, `crear-checkout-
   stripe.js` recibía `400 "Invalid line_items[0]: the product tax
   code is missing"`. Como no se configuró Stripe Tax a propósito (ver
   más arriba), se desactiva con `managed_payments[enabled]=false` al
   crear la Checkout Session, en vez de rellenar un código fiscal.
3. **`Subscription.current_period_end` ya NO vive en el objeto de
   nivel superior en esta versión de la API de Stripe (`2026-08-26.
   dahlia`)** — venía `null` siempre. El dato real está en
   `items.data[0].current_period_end` (a nivel de `subscription_item`).
   `stripe-webhook.js` corregido para leer de ahí, con `trial_end`
   (que sí sigue en el nivel superior) como respaldo.
4. **Cambiar un secret en Cloudflare Pages no refresca los despliegues
   ya existentes** (mismo comportamiento ya documentado para
   `AEMET_API_KEY` en su sección propia) — tras corregir un valor
   equivocado de `SUPABASE_SERVICE_ROLE_KEY` (que daba
   `401 "Invalid API key"` en el webhook), hizo falta forzar un
   redeploy nuevo (`git commit --allow-empty` + push) para que la
   Function empezara a usar el valor corregido — "Reenviar" el evento
   sin redeploy seguía dando el mismo error viejo.

**Confirmado también**: Cloudflare Pages tiene los secrets de Preview
y Production en ámbitos totalmente separados (`wrangler pages secret
list --env preview` solo devolvía `AEMET_API_KEY` hasta que se
añadieron los de Stripe explícitamente ahí también) — al añadir
cualquier secret nuevo, marcar también "Preview" en el Dashboard, o
probar directamente tras mergear a main.

**Pendiente antes de dar esto por cerrado**:
- Reenviar/confirmar también el evento `checkout.session.completed`
  (el de `customer.subscription.created` ya quedó verificado en
  `200`).
- Mergear a main y registrar un segundo webhook en Stripe contra
  `https://costaviva.org/stripe-webhook` (la URL de preview no sirve
  en producción).
- ✅ Configurada en el Dashboard de Stripe la cancelación "al final del
  periodo" y el cambio de plan (mensual↔anual) con prorrateo
  facturado de inmediato — ambas en Settings → Billing → Customer
  portal. `suscripcion.html` ya marca el plan vigente ("✓ Tu plan
  actual") y ofrece "Cambiar a..." en el otro, pedido explícito del
  usuario: subir de plan se aplica al momento con el saldo del mes ya
  pagado descontado del cobro nuevo — comportamiento por defecto de
  Stripe una vez el Portal tiene el cambio de plan activado, no
  requirió código de prorrateo propio.
- ✅ **Pasado a modo LIVE en producción, 2026-09-15.** Cuenta de Stripe
  activada y verificada (negocio/banco), perfil público configurado
  ("Costaviva", @costaviva, categoría Software/SaaS, uso comercial,
  sin app móvil todavía). Producto "Costaviva Premium" recreado en
  live con **Stripe Tax activado** (decisión explícita, dado que se
  vende un servicio digital a clientes de la UE — con las reglas de
  IVA de servicios digitales, hay obligación real de cobrarlo; nota:
  no es asesoría fiscal, confirmarlo con gestoría si hace falta más
  seguridad legal) — a diferencia de test, aquí el producto SÍ lleva
  código fiscal ("SaaS, uso comercial, sin app móvil"), así que
  `managed_payments[enabled]=false` en `crear-checkout-stripe.js` ya
  no es estrictamente necesario por esa causa (se dejó igual, sin
  probar con Managed Payments activado). Nuevos Price ID live:
  `price_1UG0hPGVID60u22aXMcBJNF3` (mensual) y
  `price_1UG0hPGVID60u22a3GO1Cflj` (anual) — actualizados en
  `crear-checkout-stripe.js` y `stripe-webhook.js`. `STRIPE_SECRET_KEY`
  y `STRIPE_WEBHOOK_SECRET` en Cloudflare Production sustituidos por
  los valores live (nuevo webhook `costaviva-webhook-live` registrado
  contra `https://costaviva.org/stripe-webhook`), producción
  redesplegada para recogerlos.
  **Pendiente — nunca se ha probado con dinero real todavía**: el
  usuario decidió no hacer una compra real de prueba por ahora ("ya la
  haré"). Todo lo verificado en real (checkout, webhook, portal,
  cancelación, cambio de plan) fue en modo test — modo live comparte
  el mismo código pero es la primera vez que corre con la cuenta live
  de verdad. Antes de anunciar el cobro a usuarios reales, sería
  prudente hacer al menos una compra real de prueba (mensual, 3,99€) y
  confirmar que el ciclo completo funciona con dinero de verdad.

## Pendiente conocido (no tocar sin confirmar)

- **Cuenta atrás para reintentar `/prevision`** (2026-09-14): la cuota
  diaria de Open-Meteo se agotó por el volumen de pruebas de esta
  sesión (ver más abajo, sección de la caché) — pendiente de confirmar
  que se recupera sola cuando reinicie (probablemente medianoche UTC) y
  que la caché nueva evita que vuelva a pasar con tráfico normal.
- **Cuentas de prueba recreadas y `auth-test.yml`/`smoke-test.yml`
  arreglados, 2026-09-14**: `fishnowtest2` y `fishnowavisotest` se
  recrearon desde Supabase → Authentication → Users ("Add user" +
  "Auto Confirm User", sin pasar por el alta pública) — más rápido que
  el flujo normal y sin CAPTCHA/confirmación de email de por medio. Ver
  la sección de arriba ("Test de autenticación") para el arreglo del
  CAPTCHA bloqueando el login de estos workflows.
- **`ANTHROPIC_API_KEY` añadido como secret de GitHub Actions y probado
  con `workflow_dispatch`** — ver el resultado de esa primera ejecución
  en `ROBOT.md` antes de fiarse del `schedule` en automático.
- **Grupos privados (Fase 5)**: la RLS y las funciones RPC se
  verificaron con `curl` + anon key (sin recursión, responden `200 []`
  sin sesión), pero **no se ha probado el flujo completo con dos
  cuentas reales** creando/uniéndose a un grupo — pendiente antes de dar
  la fase por cerrada del todo.
- `smoke-test.yml` nunca debe llamar a `/sos-alerta` (decisión explícita
  del 2026-09-12) — dispararía un email de socorro real. Si en el futuro
  se quiere cubrir también ese camino, hace falta antes un modo de
  prueba explícito en `sos-alerta.js` que nunca llame a Resend de verdad
  para una cuenta marcada como test — decidirlo aparte, no asumirlo.
- No existen todavía código de invitación/descuento ni cuentas
  compartidas tipo "tripulación" — no hay nada que blindar ahí hasta que
  esas features existan.
