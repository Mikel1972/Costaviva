# CLAUDE.md — Costaviva

Este fichero se lee al empezar cada sesión y se reescribe libremente cuando
cambian las convenciones — no es un historial (para eso está `ROBOT.md`).
Si algo de aquí queda desactualizado, corrígelo en el momento en que lo
detectes, no lo dejes para luego.

## Idiomas: español e inglés (2026-10-09, base para Nueva Zelanda)

Mikel abre Nueva Zelanda para pescadores en inglés. Base de idiomas sin
dependencias (PR "i18n"; los datos de NZ van aparte).

- **Núcleo**: `assets/js/i18n.js` (`window.I18n`), diccionarios
  `assets/i18n/es.js` y `en.js` (envoltorio + un objeto JSON, una clave por
  línea). Los módulos ES importan `assets/js/i18n-modulo.js`. En el `<head>`
  de cada página traducida, **antes de cualquier otro script**: `es.js`,
  `en.js`, `i18n.js`.
- **Qué idioma**: guardado en este navegador (`localStorage`
  `costaviva.idioma`) > perfil (`user_metadata.idioma` de la sesión de
  Supabase, leído de su entrada de localStorage) > `navigator.languages`
  (el primero que sea es o en) > español. En node (tests, Functions) siempre
  español. El selector (🌐 Español / English) va en el menú de cuenta 👤
  (`<div data-i18n-selector>`); guarda, intenta `auth.updateUser({ data: {
  idioma } })` y recarga. OJO: un español con el móvil en inglés verá la app
  en inglés hasta que elija Español una vez (lo pide el orden acordado).
- **HTML fijo**: el texto español se queda en el HTML y se marca con
  `data-i18n="clave"` (texto), `data-i18n-html` (con marcado, solo textos
  nuestros) o `data-i18n-title|aria-label|placeholder|alt`. En español no se
  toca nada; en inglés se traduce al cargar (sin destello: el cuerpo se
  oculta hasta entonces, la pantalla de inicio se traduce antes con
  `I18n.aplicarInicio()`), y solo si el elemento sigue con el texto español
  original (lo que ya cambió el JS no se pisa).
- **Texto del JS**: `I18n.t("clave", { vars })` (plurales: valor
  `{ "one", "other" }` y `{ n }`). En los módulos se usa `I18n.t`, no un `t`
  suelto (muchos callbacks usan `t` como variable). Los scripts clásicos que
  también carga admin.html (errores.js, meteo.js...) usan
  `tr("clave", "texto español")`: el respaldo debe ser idéntico a es.js.
- **Números/unidades**: `I18n.num` (coma en es, punto en en), `I18n.decimal`,
  `I18n.temp`, `I18n.metros`, `I18n.velocidad(kmh, "nudos")`, `I18n.locale()`
  (es-ES / en-NZ), `I18n.mesesCortos()`.
- **Motivos del índice** (`ventana-actividad.js`): cada motivo lleva `clave`,
  `vars`, `texto` (idioma de la app) y `textoEs`. Lo que se guarda en el
  diario (`resumenIndice`) va en español + clave; `paraUsuario` filtra lo
  interno por `textoEs`.
- **Datos por idioma** (fase de datos): `I18n.dato(obj, "texto")` usa
  `texto_en` si existe; `I18n.nombre(especie)` usa `nombres.en`. Sin ellos,
  español. Reglas expertas: `texto_en` en la regla.
- **SEO**: `functions/_lib/seo/idiomas.js` deja preparado `/en/...` con
  hreflang, **apagado** (`PUBLICAR_EN = false`): mismo HTML, sin rutas /en/,
  sitemap y canónicas intactos. Los pasos para activarlo están en ese fichero.
- **Tests**: `test/i18n.test.js` (cobertura de claves, nada sin traducir en
  las páginas de `PAGINAS_I18N` salvo `EXCEPCIONES`, es.js = texto del HTML,
  núcleo). Los tests antiguos que buscan textos en index.html leen la fuente
  con `fuenteEs()` (test/i18n-html.js): `I18n.t("clave"` vuelve a su texto.
- **Página nueva o texto nuevo**: marca el HTML, añade la clave a es.js Y a
  en.js. admin.html se queda en español a propósito.
- **Pendiente (inventario, sin tocar)**: emails (`avisar-fin-prueba.js`:
  bienvenida, aviso y fin de prueba, enchufe; `_lib/invitaciones.js`:
  invitación; `sos-alerta.js`: SOS a contactos; plantillas de Supabase Auth
  —enlace de alta y "olvidé mi contraseña"— en el panel de Supabase, un solo
  idioma), Stripe (productos y precios en EUR en el panel de Stripe,
  Checkout sin `locale` → idioma del navegador; textos del portal), avisos al
  admin (informe diario, altas: se quedan en español), nombres de spots, ríos,
  boyas, especies, normativa, reglas expertas y zona horaria Europe/Madrid
  (fase de datos de NZ), coordenadas del panel siempre "°N/°W".

## Captación: redes, calendario, métricas e "Invita a un amigo" (2026-10-09)

Fase decidida por Mikel: todo a conseguir usuarios (0 suscriptores el
2026-10-09). Cuatro piezas, todas sin IA y a coste 0:

1. **Instagram + Facebook, mismo flujo de aprobación.** Los robots
   (`robot-marketing-instagram.yml`, `robot-reel-instagram.yml`) crean el
   borrador de Instagram y abren UN Issue (etiqueta `marketing`) con los dos
   textos y la pieza entera en un bloque invisible
   (`scripts/marketing/pieza-issue.mjs`). En Facebook no se crea nada antes del
   OK (la API de Páginas no guarda borradores). Publicar: Actions →
   **Publicar post de Instagram** → `issue_number` y `redes` (las dos, solo
   Instagram o solo Facebook) → `scripts/marketing/publicar-pieza.mjs`.
   Instagram: `/media_publish`. Facebook: Page token sacado del token del
   Usuario del Sistema (`/{page}?fields=access_token`); foto con
   `/{page}/photos`, reel con `/{page}/video_reels` (start, subida por URL a
   `rupload.facebook.com`, finish). Lo publicado en Facebook se apunta en
   `posts-facebook.jsonl` (el de Instagram sigue en `posts-publicados.jsonl`).
   Códigos de salida: 3 token caducado, 4 falta permiso/`META_PAGE_ID`.
   **Facebook (pasos de Mikel, 2026-10-09):** el token actual (Usuario del
   Sistema "Costaviva", no caduca) NO tiene `pages_manage_posts`. Hay que
   generar uno nuevo con ese permiso además de los 5 de siempre (ver "Token de
   Instagram", paso 4) y guardarlo con `gh secret set META_PAGE_ACCESS_TOKEN`
   (nunca por chat). `comprobar-token-instagram.yml` ya exige
   `pages_manage_posts` y que la Página `META_PAGE_ID` devuelva su Page token.
2. **Calendario fiable** (`scripts/marketing/calendario.mjs`): martes 08:00
   especie, jueves 13:00 función de la app (diario → grupos → alarma),
   viernes 08:00 condiciones, sábado 09:00 reel. La pieza se prepara la
   VÍSPERA a las ~19:30 con los datos de la hora de publicación (índice,
   bloque de `/prevision`, pleamar/bajamar del día desde `nivelMar`) para
   que Mikel solo apruebe por la mañana (el contenedor de Instagram caduca a
   las 24 h). Reloj: pg_cron (`20261009130000_programador_marketing.sql`:
   L/X/J 17:30 UTC posts, V 17:10 UTC reel); el `schedule:` de GitHub es el
   respaldo una hora después y no repite (`calendario-estado.json`). A mano:
   inputs `fecha` y `tipo`. Cada texto lleva `{ENLACE}`, que
   `publicar-borrador-instagram.mjs` cambia por
   `costaviva.org/empieza?utm_source=instagram|facebook&utm_medium=social&utm_campaign=<AAAAMMDD-pieza>`.
   Enlace de la bio de Instagram (a mano, Mikel):
   `https://costaviva.org/empieza?utm_source=instagram&utm_medium=social&utm_campaign=bio`.
3. **Métricas sin IA.** `/empieza` (`empieza.html`, noindex) es la entrada
   de campañas y amigos y lleva a `/login?alta=1`. Primer contacto:
   `assets/js/origen.js` (UTM o dominio del referrer, solo listas cerradas,
   localStorage 90 días) viaja en el metadato del alta (`origen`, `ref`) y el
   trigger `registrar_origen_alta()` lo copia a `origen_altas`. Visitas:
   `functions/_middleware.js` + `_lib/visitas.js` suman en segundo plano un
   recuento por día/página/fuente/campaña (`contar_visita_publica`, la única
   función con EXECUTE para anon, marcada anon-ok); sin IP, navegador ni
   cookies; los botones "Empieza gratis" de /mareas, /spots y /especies llevan
   la fuente de quien llega de fuera. `metricas_captacion()` (service_role) y
   `admin_metricas_captacion()` (es_admin): visitas por fuente, altas (y por
   fuente), invitaciones canjeadas, amigos, **prueba → pago** (estrella del
   norte: altas confirmadas sin admin/pruebas/permanentes/invitación 100 %,
   terminadas = 8 días; paga = `suscripciones.primer_pago_en`, que pone el
   webhook la primera vez que ve `active`) y retención semana 2/4 (eventos_uso
   en días 7-13 / 21-27). Se ven en admin.html ("📈 Captación") y en el
   informe diario de los lunes (paso "Captación", `scripts/captacion/`).
   `privacidad.html` lo explica.
4. **"Invita a un amigo"** (aprobado por Mikel, ACTIVADO por defecto;
   interruptor `ajustes_app.referidos_activo`). Enlace en suscripcion.html
   (y "🎁 Invita a un amigo" del menú de cuenta): `/empieza?ref=CODIGO`. Si
   el amigo paga de verdad (suscripción `active`), quien invita gana 1 mes:
   saldo a favor de 3,99 € en Stripe si ya está suscrito
   (`balance_transactions`, Idempotency-Key por amigo) o +30 días de prueba
   al suscribirse (`crear-checkout-stripe.js`, máx. 3, metadata
   `referidos_dias`). Protecciones: un amigo una vez en la vida (hash del
   email normalizado), nada de autoinvitarse (Gmail sin puntos ni +alias),
   misma tarjeta que quien invita o repetida entre sus amigos = sin premio
   (huella de Stripe, guardada como hash), máx. 12 meses/año, >10 altas en
   24 h con un código = no cuentan. Lógica en
   `20261009110000_invita_a_un_amigo.sql` y `functions/_lib/referidos.js`.

Migraciones `20261009100000`-`20261009130000` **sin aplicar** (esperan el sí
de Mikel); el baseline del vigía ya lleva las 5 tablas nuevas, así que el
vigía saldrá en rojo hasta aplicarlas. Tests: `test/captacion.test.js`,
`test/calendario-marketing.test.js`.

## Aspecto "Amanecer de pesca" (2026-10-08, elegido por Mikel)

Mikel pidió algo "visualmente atractivo, no frío" y eligió, entre tres
propuestas, **Amanecer**: degradado de amanecer (naranja → magenta → violeta)
sobre azul de mar profundo, con letra Unbounded (títulos) y Manrope (texto).
Regla suya: **el degradado solo donde da emoción** (cabecera y logo, botón y
pestaña activa, la nota del índice y su "sol", llamadas a la acción, posts de
Instagram) y **sobrio donde hay datos** (cifras, motivos ▲▼, textos
pequeños: tinta oscura sobre claro, contraste AA).

- **Todo vive en `assets/css/costaviva.css`**: los tokens (`--mar`, `--fondo`,
  `--tinta`, `--acento`, `--degradado`, `--degradado-fuerte`, `--nivel-*`,
  `--ok/--peligro/--aviso-*`, `--f-titulo`, `--f-texto`) y lo común a todas
  las páginas (cabecera, logo `.marca-logo` + `.logotipo`, menú de cuenta,
  menú inferior `.tabs-nav`, `.nota-nivel`). Cada página lo carga antes de su
  `<style>` propio, que ya solo usa `var(--...)`: **no metas colores sueltos
  en las páginas, añade un token**. El contraste de cada par está anotado en
  la cabecera del CSS.
- `--degradado` (claro) es solo decorativo; si lleva texto encima, usar
  `--degradado-fuerte` (blanco encima ≥ 5,2:1).
- **Índices por nivel** (`assets/js/nivel-indice.js`, test
  `test/nivel-indice.test.js`): verde bueno, amarillo sol regular, coral malo.
  Los dos índices van AL REVÉS: en el de mar alto = mar movido = malo; en el
  de pesca alto = bueno. Hasta el 2026-10-08 el de pesca se pintaba con la
  escala del de mar y un 77 salía en el color de "malo". El texto ⓘ del
  índice de mar decía "cuanto más alto, mejor pinta", al revés que la
  fórmula y la leyenda: corregido el texto (la fórmula no se tocó).
- La alarma SOS va en rojo sólido, no con el degradado: seguridad ≠ emoción.
- **Menú inferior y hojas fijas (2026-10-09, captura de Mikel en el iPhone):**
  `.tabs-nav` mide `72px + env(safe-area-inset-bottom)`. Todo lo `fixed` que
  se apoye abajo (p. ej. `.panel-dia` del diario) va a ese `bottom`, nunca a
  un número suelto; y su alto máximo se limita con `--cabecera-abajo` (lo
  mide el script) para no tapar la cabecera. Cabeceras con
  `padding-top: max(10px, env(safe-area-inset-top))`. Test
  `test/diario-movil.test.js`, que también vigila que la ficha de la salida
  y su índice usen el mismo dato (boya o modelo) y los decimales con coma.
- **Mapa base (2026-10-08, decidido por Mikel): OpenFreeMap en vez de Esri.**
  La ficha de Esri (`World_Ocean_Base`, item 1e126e7520f9466c9ca28b8f28b5e500)
  va con el Esri Master License Agreement y su resumen
  (https://www.esri.com/content/dam/arcgisonline/docs/tou_summary.pdf) exige
  suscripción de ArcGIS y prohíbe el uso comercial de Living Atlas sin
  licencia. Ahora: `assets/js/mapa-base.js` (test `test/mapa-base.test.js`)
  monta OpenFreeMap "Liberty" (https://openfreemap.org: "Is commercial usage
  allowed? Yes"; atribución obligatoria "OpenFreeMap © OpenMapTiles Data from
  OpenStreetMap") con MapLibre GL 5.24.0 (cdnjs, SRI) + el plugin oficial
  `@maplibre/maplibre-gl-leaflet@0.1.4` (jsdelivr, SRI). Los colores Amanecer
  van EN EL ESTILO (`retocarEstilo`), no con filtros. Encima, hasta zoom 11, el
  relieve `emodnet:mean_atlas_land` de EMODnet (CC BY 4.0) al 45 % con
  `mix-blend-mode: multiply`. Base y relieve van en paneles propios por debajo
  de `tilePane`, así que lluvia, rayos, batimetría, isóbatas, viento, cámaras y
  spots quedan siempre encima. Sin WebGL o sin OpenFreeMap, el relieve de
  EMODnet hace de mapa base opaco. MapLibre 6 no se usa: solo se publica como
  módulo ES con worker aparte (más frágil con la CSP); la 5.x trae el worker
  como blob: (`worker-src blob:` ya estaba por hls.js).
- **Créditos del mapa sin tapar el ⓘ (2026-10-08, aprobado por Mikel).** En el
  móvil la atribución (3 líneas) tapaba el botón ⓘ de la leyenda, y en
  escritorio también cuando ocupaba dos líneas. `assets/js/creditos-mapa.js`
  (test `test/creditos-mapa.test.js`) hace como la atribución "compacta" de
  MapLibre: en el móvil se ven enteros al cargar y al primer toque/arrastre
  del mapa (o a los 6 s) se pliegan en la píldora "ⓒ Fuentes", siempre
  visible; tocarla los abre (sin pasar del ⓘ) y cierra la leyenda. En
  escritorio siempre abiertos, con la esquina inferior derecha empezando a
  76 px (a la derecha del ⓘ) y la leyenda del ⓘ abriéndose por encima de
  ellos. Ningún crédito se quita: no usar `attributionControl.remove()`.
- **Tarjetas del mapa en un dock (2026-10-08, bug aprobado por Mikel).** En
  el móvil la tarjeta de rayos (antes control de Leaflet `bottomright`) tapaba
  la lluvia animada y la leyenda del ⓘ abierta. Ahora todas las tarjetas de
  abajo viven en `#tarjetasMapa` (index.html) y se apilan con `order`, de
  arriba a abajo: rayos, lluvia (lluvia-animada.js la mete ahí vía
  `contenedor`), clorofila / temperatura, viento y la leyenda del ⓘ. Nunca se
  pisan. `assets/js/tarjetas-mapa.js` (test `test/tarjetas-mapa.test.js`)
  pone el `bottom` del dock por encima de lo que tenga debajo en su columna
  (ⓘ, créditos abiertos, leyendas de Leaflet de abajo a la izquierda) y el
  `max-height` sin tapar el zoom ni las leyendas de arriba; si no cabe,
  scroll (en escritorio, segunda columna). Acaba a la izquierda de los
  botones de capas. Con la lluvia abierta, rayos se queda en su frase (sin la
  línea de leyenda). Una tarjeta nueva sobre el mapa: dentro del dock, con
  su `order`; nada de `position: absolute` suelto abajo.
- **Tarjetas de capa minimizables (2026-10-09, Mikel con captura del iPhone:
  "Debe poder minimizarse para tener más visión").** La tarjeta de 〰 Frentes
  ocupaba el 48 % del alto a 375 px y tapaba los spots. Ahora la tarjeta de
  las capas de mar (`#capaMarPanel`: clorofila, temperatura, frentes,
  corriente) y la del viento llevan cabecera con un chevron (`.tarjeta-plegar`,
  44x44 px, `aria-expanded`/`aria-controls`, `addEventListener`, sin on*=).
  Minimizada = una línea de 46 px (6,9 % del alto a 375x667, medido con
  Playwright): icono + nombre corto (`corto` en `CAPAS_MAR`) + la escala de
  colores sin texto. **Estado (decisión de Claude):** lo que elija el usuario
  se recuerda por tarjeta en localStorage (`cv_tarjeta_plegada_<id>`, con
  try/catch); si no eligió nada, en el móvil (< 600 px) la primera vez sale
  entera con la explicación plegada (para que entienda los colores) y desde
  la segunda vez minimizada (`cv_tarjeta_vista_<id>`); en escritorio, entera.
  Los créditos de Copernicus siguen en la vista expandida y siempre en los
  créditos del mapa (ⓒ Fuentes). Rayos ya es una línea y la lluvia trae sus
  botones de reproducir (lluvia-animada.js): no se tocan. Al cambiar de capa
  se cierra el valor tocado de la anterior. `assets/js/plegar-tarjeta.js`,
  test `test/plegar-tarjeta.test.js`.

## Pantalla de inicio con foto (2026-10-09, captura de Mikel en el iPhone)

Al abrir la app salía, mientras se comprueba la sesión, una pantalla crema
casi vacía con "Comprobando acceso…" y el texto para buscadores con enlaces
azules de navegador. Ahora `#comprobandoAcceso` (index, diario, alarma,
grupos, admin y suscripcion) es una pantalla a pantalla completa
(`assets/css/pantalla-inicio.css`, cargada tras `costaviva.css`): foto de
una rompiente con un pescador, velo de `--mar`, logo + COSTAVIVA en
`.logotipo`, frase y un indicador discreto ("Comprobando acceso…"). Respeta
safe-area y `prefers-reduced-motion`. El script de cada página la sigue
quitando con `.remove()`.

- **SEO:** en index.html el texto "Costaviva: pesca en tiempo real…" y los
  enlaces a /spots, /especies y /mareas siguen en el DOM, abajo y en claro
  sobre la foto (enlaces en píldora, sin el azul). No quitarlos. Canonical y
  metas sin tocar.
- **Foto:** fotograma (0,4 s) de "A young man fishing on a rocky beach",
  Coverr, https://coverr.co/videos/a-young-man-fishing-on-a-rocky-beach-pcrpoqlvon
  (el mismo clip que `coverr-pescador-rocas-oleaje.mp4` de los reels).
  Licencia de Coverr (https://coverr.co/license, comprobada el 2026-10-09):
  uso comercial, copiar y modificar, **sin atribución obligatoria**; prohíbe
  competir con Coverr y entrenar IA. Detalle en `scripts/inicio/LICENCIA.json`.
  Fotograma original en `scripts/inicio/` (no se sirve).
- **Ficheros** (`/assets/inicio/`, una semana de caché en `_headers`; si
  cambia la foto, cambia el nombre): `rompiente-movil.{webp,jpg}` 720x1280
  para vertical y `rompiente-ancha.{webp,jpg}` 1280x720 para horizontal
  (`<picture>` por `orientation`), cada una ≤ 80 kB, precargadas en el
  `<head>` con `fetchpriority="high"`.
- **iOS:** `apple-touch-startup-image` para 11 tamaños de iPhone en vertical
  (`assets/inicio/arranque/`), que son esta misma pantalla sin el indicador,
  declaradas en index.html y login.html entre `<!-- arranque-ios -->`. iOS las
  guarda al añadir a la pantalla de inicio: quien ya tenía la app instalada
  tiene que quitarla y volver a añadirla para verlas. El manifest ya tenía
  `background_color`/`theme_color` = `--mar`.
- **Regenerar** (sin IA): `node scripts/inicio/generar-pantallas-inicio.mjs`
  (ffmpeg con libwebp + Playwright de `scripts/marketing`, `npm ci` allí, o
  `CHROMIUM_PATH`). Rehace fotos, imágenes de arranque y el bloque de `<link>`.
  Test: `test/pantalla-inicio.test.js` (medidas, pesos, licencia, SEO,
  safe-area, bloque de arranque al día).

## Alarma: lista de WhatsApp (2026-10-08, pedido de Mikel)

"En las alarmas, también debiera haber una lista prefijada para los
WhatsApp." Coste cero: **nada de la API de WhatsApp Business** (de pago y con
aprobación de Meta). Cada contacto de emergencia puede tener email, WhatsApp
(columna `whatsapp`, E.164) o los dos. Tras el SOS, o tras la cuenta atrás de
la caída, `alarma.html` enseña un botón grande por contacto con WhatsApp que
abre `https://wa.me/<número>?text=<mensaje>` con la ubicación ya escrita; **la
persona tiene que pulsar Enviar** y la pantalla lo dice. El email sigue
saliendo solo (`sos-alerta.js`, ahora solo a contactos con email). Los grupos
no tienen número: "Compartir en un grupo" usa `navigator.share` y, sin él,
`wa.me/?text=`. El nombre del mensaje se guarda solo en el teléfono
(localStorage). Lógica en `assets/js/sos-whatsapp.js`, test
`test/sos-whatsapp.test.js`. Migración
`20261008200000_contactos_whatsapp.sql` **SIN APLICAR** (baseline ya
actualizado); sin ella la página dice que el WhatsApp aún no está activado y
el email funciona como antes. En textos de marketing: "te prepara el
WhatsApp", nunca "manda un WhatsApp automático".

**Contactos desde la agenda (2026-10-08, pedido de Mikel).** En "Añadir
contacto", el botón "📇 Elegir de la agenda" usa la Contact Picker API
(`navigator.contacts.select(['name','email','tel'], {multiple: true})`): solo
existe en Chrome/Chromium de Android, en https y tras un toque. Donde no está
(iPhone/Safari, escritorio) el botón no sale y la página dice "Tu navegador no
deja abrir la agenda: escribe el contacto a mano". La web no lee la agenda:
el sistema abre su selector y solo llegan los contactos marcados; después se
revisan (si hay varios emails o teléfonos se elige uno, los teléfonos no
válidos salen con el motivo, los repetidos van desmarcados) y nada se guarda
hasta pulsar "Guardar N contactos". Lógica en `assets/js/agenda-contactos.js`
(usa `normalizarTelefono` de `sos-whatsapp.js`), test
`test/agenda-contactos.test.js`.

## Instagram en estilo Amanecer: posts, stories y reels sin IA (2026-10-08)

Mikel: "imágenes/vídeos como los de Fizk son mil veces mejores que las
nuestras". Sustituidas las plantillas SVG+sharp (crema y dorado, letras del
sistema, emoji rotos y **fotogramas de webcams de terceros**, que Skyline,
YouTube o MEO no dejan republicar) por piezas en el estilo de la app.

- **Plantilla única**: `scripts/marketing/plantillas/pieza.html`, pintada con
  Playwright (Chromium). Letras dentro del repo (`assets/fonts/`, las mismas
  que sirve la web; Unbounded y Manrope con su OFL): no depende de la red ni de las fuentes del
  runner. `render.mjs` hace post (1080x1350), story (1080x1920) y reel.
- **Lógica pura** en `pieza-datos.mjs` (test `test/pieza-datos.test.js`):
  índice del día con la MISMA cuenta que la ficha (`indiceSpot` +
  `calcularVentana` sobre `serieHoraria`), motivos ▲▼, mejor tramo, tarjetas,
  guion del reel, rotación, ganchos y claims. Datos reales en
  `obtener-datos.mjs` (endpoints públicos `/prevision`, `/meteo/*`,
  `/viento-campo`; minimapa de batimetría de EMODnet).
- **Posts** (`robot-marketing-instagram.yml`; desde el 2026-10-09 la víspera
  de M/J/V, ver "Captación"): borrador + Issue + publicación manual, también
  en Facebook. Ahora también deja la story en
  `assets/marketing/*-story.png` (para subirla a mano).
- **Reels** (`robot-reel-instagram.yml`, para el sábado, preparado el viernes): 10,5 s =
  gancho (3,5 s, vídeo + pregunta) + datos animados (5,5 s: índice contando,
  ventana creciendo, viento real en partículas; o una pantalla real de la app
  en un marco de móvil) + cierre (1,5 s, claim y CTA). Rotación
  `ROTACION_REELS`: condiciones, diario, condiciones, grupos, especie,
  alarma (estado en `rotacion-reels.json`). MP4 H.264 + audio mudo, < 8 MB;
  en el árbol solo quedan los 4 últimos. ~10 min de Actions por reel
  (el de ejemplo: 10,5 s, 1,8 MB).
  `publicar-borrador-instagram.mjs reel-pendiente.json` crea el contenedor
  `REELS` y espera a `status_code=FINISHED`; se publica con el mismo
  workflow manual "Publicar post de Instagram".
- **Clips del gancho**: `scripts/marketing/clips/propios/` (los que grabe
  Mikel; tienen prioridad) y `clips/stock/` (solo con su `.licencia.json`
  al lado: URL, cita y fecha; el test lo comprueba). `scripts/` no se sirve
  en la web, así que los clips en bruto no quedan públicos. Hay 3 de Coverr
  y 2 de Mixkit (licencias comprobadas el 2026-10-08: uso comercial y
  modificación permitidos, sin atribución obligatoria; sin caras
  reconocibles ni marcas), recortados a 5 s, 1080x1920. **Mixkit: solo la
  "Mixkit Stock Video Free License"**; casi todos sus vídeos de pesca son
  "Restricted" (solo uso personal) y NO valen. Coverr: solo `isPremium:false`.
  Pexels, Pixabay y Videvo no se pudieron verificar (reto anti-bots de
  Cloudflare, 403): no usar nada suyo sin verificar su licencia. Nunca
  YouTube, webcams de terceros ni Instagram de otros.
- **Forzar spot y clip** (2026-10-08, para el primer reel que pidió Mikel:
  pescador en un sitio idílico + datos + CTA): el workflow del reel acepta
  `spot` (slug, p. ej. `bakio`) y `clip` (fichero de `clips/propios` o
  `clips/stock`, p. ej. `mixkit-cana-al-atardecer.mp4`) a mano; sin ellos,
  rotación normal. El spot forzado no toca `rotacion-zonas.json`. El gancho
  lleva un velo con banda oscura detrás de la pregunta (legible sobre un
  atardecer) y el cierre dice "Costaviva · Gratis 7 días · costaviva.org".
- **Pantallas de la app** en las piezas de funciones: `capturas-app.mjs`
  sirve el repo en local con un doble de Supabase y datos de demostración
  inventados (nunca datos de usuarios ni producción).
- **Textos**: nada indemostrable ("la primera app..." se quitó del texto de
  los posts: Ley General de Publicidad). La app NO tiene "tipo de fondo"
  (roca/arena), tiene batimetría: se dice "profundidad del fondo". Alarma:
  el SOS manda un email con la ubicación a tus contactos y la detección de
  caída es experimental y SOLO con la app abierta y la pantalla visible;
  nada de "te salva la vida" ni segundo plano. El test lo comprueba.

## Cámaras de terceros: solo como su dueño lo permita (2026-10-08)

`assets/js/camaras-externas.js` lista cámaras de otros (SkylineWebcams,
canales de YouTube, MEO Beachcam) encontradas en agregadores. **Los permisos
los pone el dueño real del stream, no el agregador** (webcamera24 y
webcamtaxi solo reenvían YouTube, in2thebeach, feratel...). Dos modos:
`imagen_oficial` (el código "Insertar" del dueño tal cual; hoy solo el
fotograma de Skyline, cada 5 min) y `enlace` (botón que abre su web).
YouTube va siempre como enlace: sus políticas prohíben cobrar por ver un
reproductor insertado y Costaviva está tras paywall. Windy Webcams queda
fuera (exige su API). `analisis_permitido` es `false` en todas: nadie
permite descargar o analizar sus fotogramas, así que **ninguna entra en
turbidez, espuma ni posts de Instagram**, y el robot de salud solo hace un
HEAD/oEmbed (clave `ext-<id>` en `camara_estado`). Águilas salió del proxy
`/webcam/` y de turbidez por eso. `test/camaras-externas.test.js` exige
dueño, modo permitido, condiciones con fuente y spot existente.

**"No verificable" no es "caída" (2026-10-08).** Caso real (21:04 UTC):
las 30 de MEO Beachcam salían en `camara_estado` con `sin_senal=true` y
`http_403`; MEO bloquea las peticiones de los runners de GitHub (anti-bots),
no la cámara. A las 24 h la app habría escondido todos los enlaces de
Portugal. Ahora, en modo `enlace`, un 401/403/429 se guarda como
`no_verificable_<código>` con `sin_senal=false` y sin sumar fallos
(`resultadoComprobacionExterna` y `lecturaSaludExterna` en
`camaras-externas.js`, que usa el robot de salud), y la app solo esconde
una externa si `externaCuentaComoCaida` (también ignora filas viejas con
`http_403`). El robot de cámaras caídas no las ve (lee `sin_senal` o
`fallos_seguidos>=1`) y el informe diario las cuenta aparte. No se intenta
esquivar su protección. En `imagen_oficial` un 403 sí es fallo.

**Interruptor `SKYLINE_EMBED_AUTORIZADO` (en `camaras-externas.js`, hoy
`true`).** Mikel ha pedido a SkylineWebcams autorización escrita para el
uso comercial (2026-10-08) y decidió usar ya la imagen oficial que su FAQ
ofrece en "Incrustar" mientras contestan. Si Skyline lo niega, se pone a
`false` y todas (Águilas incluida) pasan a `enlace` sin cargar nada de
`embed.skylinewebcams.com`; no hay que tocar nada más (el test se adapta al
valor). Analizar sus fotogramas sigue prohibido en cualquier caso.

## Oleaje costero: mar abierto frente a "en la playa" (2026-10-08)

**Caso real (Mikel, 2026-10-08):** Hondarribia salía con "3.7–4.5 m" y su
webcam enseñaba la bahía de Txingudi casi en calma. Diagnóstico con los
números de ese día (11:57 hora de Madrid):
- La celda de Open-Meteo Marine que toca a Hondarribia está en
  43.458, -1.792: **~9,4 km mar adentro**, frente a la costa francesa. En el
  Cantábrico la rejilla es de ~9 km y TODAS las celdas de los spots caen a
  6-19 km de la costa (Mundaka 15 km, Ribadeo 19 km). El modelo da 2,98 m
  (Hs total, mar de fondo 2,84 m del NW 322° + mar de viento).
- ×1,38 de Gipuzkoa → 4,11 m; el "rango" es ±10 % artificial alrededor de ese
  único valor → 3,7–4,5 m. No es swell + mar de viento ni una incertidumbre.
- La boya Pasaia II medía 3,5-3,8 m (máx. 6,7 m) del NW: **el mar abierto
  era de verdad de ~3,6 m**. El número no estaba mal calculado; estaba mal
  rotulado: es mar abierto, y Hondarribia está detrás del cabo Higuer.
- A la misma hora, las webcams: Zarautz y Deba rompiendo en varias líneas,
  Orio y Zurriola rompiente moderada, Mutriku dentro del puerto en calma,
  Hondarribia con una orilla de espuma mínima.
- Además, la celda de Hondarribia (fila 43.458) es más exterior que la de
  Pasaia (43.375) con la que se calibró el ×1,38: ese día 2,98×1,38 = 4,1 m
  frente a 3,6 m de la boya (+14 %). Un solo dato: no se ha tocado el factor.

**Qué se cambió (`functions/_lib/oleaje-costero.js`, tests en
`test/oleaje-costero.test.js`):**
- `/prevision` devuelve en cada bloque `alturaMarAbierto` (lo del modelo, con
  el ×1,38 si toca) y `altura` = lo esperado en el spot; y por spot
  `zonaOleaje` (abrigada/abierta, parámetros, criterio y a cuántos km está la
  celda del modelo).
- **Spots claramente abrigados** (`ABRIGO_SPOTS`): Hondarribia, Pasaia,
  Getxo (Ereaga), Santander (bahía), Santoña, Ribadeo y Faro/Olhão.
  Coeficiente por dirección de llegada: ventana abierta (`centro`,
  `semiancho`) con `coefAbierto`, fuera `coefAbrigado`, transición lineal de
  30°; sin dirección, el mayor. Son **estimaciones por geometría**, elegidas
  por el lado alto (subestimar una ola es lo peligroso). Criterio para entrar:
  el spot está dentro de bahía/puerto/ría/laguna con un obstáculo físico claro
  Y la celda del modelo está en mar abierto. Por eso NO están Cangas,
  Vigo/Cíes, Sanxenxo ni Portosín (sus celdas ya están dentro de la ría y el
  modelo ya da 0,6-0,9 m: corregir otra vez sería contar dos veces).
  Candidatos dudosos, sin tocar a propósito: Plentzia, Laredo,
  Camariñas, Getaria, Mutriku, Donostia (la coordenada cae entre La Concha y
  Zurriola, y su cámara es Zurriola, expuesta), Palma, Platja de Muro.
  Mundaka entró el 2026-10-08 (ver "Oleaje por cámara").
- En el panel (`pintarOleajePanel()` en `index.html`): spot abrigado →
  "~0,6–0,7 m" + "en la playa (zona muy abrigada, estimación) · mar abierto:
  3,7–4,5 m"; resto → el valor + "mar abierto (modelo a ~N km de la costa);
  en la orilla puede ser menos". El índice de mar y la ventana de actividad
  usan la altura en la playa (la ventana recibe los parámetros de
  `zonaOleaje` y aplica la copia de `coeficienteAbrigoDesdeParametros()`; un
  test comprueba que la copia es idéntica).
- **×1,38 (d):** corrige el MAR ABIERTO (la boya Pasaia II es exterior); el
  abrigo se aplica después, sobre ese valor. Y solo se aplica si el oleaje
  viene de Open-Meteo (`factorOleaje(lat, lon, fuente)`): con
  `FUENTE_OLEAJE=copernicus` no, hasta recalibrarlo contra la boya.
- Pendiente: `diario.html` (contexto de la salida) y las ubicaciones
  personalizadas siguen guardando/enseñando el mar abierto sin coeficiente.

**Calibración por cámara, sin IA (`scripts/oleaje-camaras/`,
`espuma-camaras.yml`; desde el 2026-10-08 cada 30 min, 13 cámaras, y la app
ya usa el resultado: ver "Oleaje por cámara" justo debajo; lo que sigue es
la primera versión):** fracción de píxeles de
espuma (claros y casi sin color) en un ROI de mar fijado a mano para las 6
cámaras de vídeo de la Diputación, junto con el mar abierto del modelo, la
dirección, el nivel del mar y la boya Pasaia II → `datos-robots/
oleaje-camaras/espuma.jsonl`. No cambia nada de la app. Con semanas de
datos: `umbralRotura()` (altura de mar abierto a la que la mitad de las
lecturas ya ven espuma) por cámara y sector de dirección, y
`coeficienteRelativo()` frente a Zarautz (expuesta). Los coeficientes
calibrados se enseñan a Mikel antes de sustituir los estimados.
Trampas ya vistas el primer día:
- **Las cámaras de la Diputación hacen ronda de encuadres** (Hondarribia
  cambia de plano general a primer plano; Deba barre la playa). Por eso cada
  cámara tiene `referencias/<spot>.jpg` y solo se miden frames con similitud
  ≥ 0,8 (huella en gris de la mitad inferior); si en ~5 min no pasa por el
  encuadre, la línea queda `otro_encuadre`. Ese día Zarautz, Deba y Mutriku
  no volvieron al suyo en 2,5 min: si pasa a menudo, añadir más encuadres de
  referencia por cámara.
- Arena con bruma y espuma con luz cálida tienen el mismo color: el ROI no
  debe tocar la orilla en ninguna marea (revisar con bajamar y pleamar).
- La lección de 2026-09-15 sigue en pie: nada de contar bordes, y nunca
  comparar una cámara con otra en absoluto.

## Oleaje por cámara: "si hay cámara, utiliza nuestro cálculo" (2026-10-08)

Pedido de Mikel: "utiliza las cámaras en todos los spots para ajustar la
ola. Veo que Mundaka también está mal. Si hay cámara, utiliza nuestro
cálculo". Ampliado el mismo día (aprobado por Mikel): lecturas cada 30 min,
boyas de Copernicus como verdad de terreno, página para etiquetar fotos y
botón "ola real que veo". Todo sin IA ni API de pago: píxeles.

**Piezas:**
- `scripts/oleaje-camaras/camaras.mjs`: inventario (qué cámara sirve, sus
  encuadres con imagen de referencia y ROI, y `NO_SIRVEN` con el motivo).
- `scripts/oleaje-camaras/espuma.mjs`: métrica de espuma + guarda de la
  orilla (si entra arena en el ROI, la lectura es `orilla` y no cuenta) +
  zona DINÁMICA (busca el mar entre horizonte y orilla en cada fotograma)
  para las cámaras que barren sin repetir plano (Zarautz, Berria).
- `scripts/oleaje-camaras/calibracion.mjs`: espuma → metros
  (`altura = a·espuma^p` por cámara y encuadre), incertidumbre, etiquetas,
  elevación solar.
- `scripts/oleaje-camaras/boyas-copernicus.py`: boyas de Copernicus Marine
  In Situ (Pasaia II, Donostia, Bilbao II, Bilbao-Vizcaya, Gijón, Peñas,
  Estaca, Langosteira, Villano, Silleiro, Leixões).
- `scripts/oleaje-camaras/medir-espuma.mjs` + `.github/workflows/
  espuma-camaras.yml`: cada 30 min de 05:07 a 18:37 UTC (cubre la luz de
  todo el año; con el sol < 8° corta en ~15 s; repo público, Actions
  gratis). El `schedule:` de GitHub casi no corre en este repo (el primer
  día, ninguna vez): lo fiable es pg_cron (migración
  `20261008210000_programador_espuma_camaras.sql`, SIN APLICAR, y necesita
  la clave de "Tareas cada 30 min", que a 2026-10-08 nunca se guardó).
  workflow_dispatch también respeta la luz salvo con `forzar_luz`. Escribe
  `datos-robots/oleaje-camaras/espuma.jsonl` (histórico, de ahí sale la
  calibración) y `calibracion.json`, y con la migración aplicada publica en
  `oleaje_camara_lecturas` + miniaturas en el bucket `oleaje-camaras`.
- `functions/_lib/oleaje-camaras.js`: qué cámara usa cada spot, vigencia,
  corrección de la previsión y `aplicarCamarasASpots()` (lo usa /prevision).
- `etiquetar-olas.html` (solo admin, enlace en admin.html) y el botón
  "🌊 Ola real que veo" del panel (con sesión).
- Migración `supabase/migrations/20261008180000_oleaje_camaras.sql` **SIN
  APLICAR** (baseline ya actualizado). Sin ella todo funciona como antes:
  /prevision no encuentra lecturas y sigue con modelo × coeficiente.
- Tests: `test/oleaje-camaras.test.js` (en tests.yml).

**Inventario (fotogramas del 2026-10-08, 12:20-12:50, mar de fondo NW de
3,1-4,0 m en las boyas):** sirven 13: Hondarribia, Zurriola, Orio (su
stream daba 404 todo el día), Zarautz, Getaria (Malkorbe, abrigada: casi
nunca hay espuma en el ROI; sin etiquetas no calibra), Zumaia, Deba,
Mutriku (fuera del dique), Mundaka (barra de la ría, KOSTASystem), Bakio
(imagen velada, la métrica satura pronto), Sopela (foto de Detectia, no el
vídeo de IPCamLive que tiene gotas), Berria (la playa expuesta de Santoña,
NO la bahía del spot) y Castro (Ostende, la de reserva de tendsys). No
sirven (motivo en `NO_SIRVEN`): Lekeitio, Getxo, Pasaia, todas las de
Galicia (rías y puertos sin rompiente, o mar lejano), las de cantabria.es
(503 ese día: Suances, Comillas, San Vicente, Santoña fija; Laredo gris) y
todo el Mediterráneo (la ola rompe en la misma orilla y son miniaturas).

**Encuadres:** las de la Diputación hacen ronda (cambian de plano cada
~20 s). Cada cámara tiene varias referencias y se mide el fotograma que se
parece a alguna (≥ 0,8 y ganando a la segunda por 0,05). Zarautz pasó por
15 planos en 7 min sin repetir: además usa la zona dinámica. Berria cambia
de zoom cada minuto: solo zona dinámica. Las fotos fijas que no han cambiado
desde la medida anterior no se guardan dos veces.

**Mundaka (diagnóstico 2026-10-08 12:20):** la celda del modelo cae en
43.54, -2.71, ~15 km al N por fuera de Matxitxako; 2,78 m del NW (330°).
Bizkaia no tiene el ×1,38, así que el panel decía "2,5–3,1 m" como si fuera
la altura en el spot. Las boyas medían 3,1-3,5 m (Bilbao II, Bilbao-Vizcaya:
el mar abierto del modelo salía BAJO en Bizkaia, -10/-20 %), pero el spot
está en el pueblo, dentro de la boca de la ría, y la cámara de la barra
enseñaba series de ~1,5-2,5 m (a ojo). Arreglo: Mundaka entra en
`ABRIGO_SPOTS` (ventana N-NNW 345° ±25°, 0,70 / 0,35, "semiabrigada") y,
con lectura vigente, manda su cámara.

**Cálculo "según cámara":**
1. Espuma en el ROI (o zona dinámica) → `altura = a·espuma^p`. Muestras
   para ajustar: lecturas automáticas con altura de referencia = boya
   costera más cercana (Copernicus, < 4 h; peso 1) o el modelo con su
   factor (peso 0,5), por el coeficiente PREVIO del sitio que ve la cámara
   (1 en las expuestas); etiquetas de Mikel sobre fotos (peso 5) y "ola
   real que veo" (peso 3, emparejada con la lectura de la cámara propia en
   ±45 min); etiquetas de Claude mirando el fotograma (peso 2, ver
   "Etiquetas de Claude" abajo). Ajuste en logaritmos; p fijo en 1 hasta tener ≥ 12 muestras
   con alturas que varíen ×1,8. Se calibra SIN la lectura actual.
2. Incertidumbre: exp(rms log) - 1, con mínimo ±50 % mientras no haya 3
   días distintos y alturas que varíen ×1,5. **Hoy (un solo estado de mar)
   la escala solo reproduce boya × coeficiente de este día: la cámara aporta
   la variación de ahí en adelante y las etiquetas la corrigen.** Entre dos
   lecturas a 10 min de distancia la espuma de una misma cámara varió
   ±30 % (series de olas, encuadre): de ahí que el ±50 % no sea pesimista.
3. Varios encuadres de una cámara: media geométrica ponderada por 1/error².
   Sin espuma visible en el ROI no se da altura (la rompiente puede estar
   fuera del ROI: Castro, 2026-10-08): el spot sigue con modelo ×
   coeficiente. Con calibración de pocos datos (error ≥ 50 %) el cociente
   cámara/modelo se acota a 0,6-1,6 (Bakio: la espuma pasó de 0,13 a 0,41
   en 30 min con el mismo mar, por la exposición de la foto).
   **Cámaras ruidosas no sustituyen al modelo** (pedido de Mikel,
   2026-10-08, "no quiero enseñar 4,7 m en Bakio con el modelo a 2 m sin
   calibrar"): por cámara y automático (`camaraSustituyeModelo()` en
   calibracion.mjs). Ruido = mediana de la variación de la espuma entre
   lecturas `ok` del mismo encuadre separadas ≤ 45 min. Si es > ±30 % o aún
   no hay 3 pares para medirlo, la cámara solo sustituye al modelo con ≥ 5
   etiquetas (o su equivalente con las de Claude: 8 en ≥ 2 franjas) o ≥ 3
   días con alturas variadas. Mientras tanto se mide, se
   guarda y calibra, pero la fila sale con `sustituye_modelo = false` y
   /prevision no la usa (ni para el spot, ni para la previsión, ni para las
   vecinas). Con los datos del 2026-10-08 ninguna cámara pasa todavía
   (Zarautz ±49 %, Zumaia ±43 %, Deba ±103 %, Zurriola ±230 %, Bakio ±219 %;
   el resto sin pares suficientes): hoy el panel sigue con modelo ×
   coeficiente en todos los spots, y las cámaras empezarán a mandar con las
   etiquetas de Mikel.
4. En /prevision: lectura `ok`, < 3 h y con estimación → el bloque más
   cercano a la lectura toma la altura de la cámara (`fuenteAltura:
   "camara"`), el panel dice "según cámara (Zarautz), 12:30 · mar abierto
   (modelo): …". Las horas siguientes: modelo × coeficiente × factor, con
   factor = 1 + (cámara/modelo - 1)·max(0, 1 - Δh/18) (cociente acotado a
   0,25-3): a las 18 h ya es el modelo con el coeficiente estático. La
   ventana de actividad de index.html aplica la misma corrección (copia de
   `factorCamara()`, un test comprueba que no se desvía).
4b. **Cámara como referencia (2026-10-08, aprobado por Mikel).** Mientras
   la cámara PROPIA del spot no sustituye al modelo, /prevision añade por
   spot `camaraReferencia: {altura, rango, hora, fecha, camara, nombre}`
   (`filasLecturas()` + `camaraReferenciaDeSpot()` en
   `_lib/oleaje-camaras.js`; ahora /prevision lee todas las filas `ok` de
   3 h, sustituyan o no). Condiciones: última medida `ok` (encuadre, sin
   orilla), < 3 h, sol ≥ 8° a la hora de la lectura, con espuma y
   estimación, cámara propia (nunca vecina; Santoña tampoco) y que la
   cámara no esté ya mandando en el spot. Panel, en secundario debajo del
   modelo: "La cámara apunta a ~1,2 m (0,8–1,9 m, sin calibrar · 16:30)"
   (redondeo a 0,1 m; el navegador lo oculta si pasa de 3 h). Sin espuma no
   se dice nada (decidido: la rompiente puede estar fuera del ROI, Castro y
   Getaria, y "no ve rompiente" junto a un modelo de 2 m invitaría a fiarse).
   No entra en las piezas de Instagram. Tests:
   `test/camara-referencia.test.js`. `elevacionSolar`, `ELEVACION_MINIMA` y
   `ESPUMA_MINIMA` viven ahora en el lib (calibracion.mjs las reexporta).
5. Spots sin cámara: la cámara EXPUESTA más cercana con la misma orientación
   de costa (±60°, < 60 km; orientación sacada a mano del trazado de costa)
   corrige su modelo con `peso` (0,8 si está a ≤ 11 km, 0,5 si más lejos);
   su abrigo propio se mantiene. Panel: "… · ajustado con la cámara de X".
   Tabla (`FUENTE_POR_SPOT`): Ondarroa ← Mutriku; Lekeitio ← Deba; Pasaia ←
   Zurriola; Plentzia ← Bakio; Getxo ← Sopela; Santoña, Laredo, Santander,
   Suances ← Berria. Sin cámara a menos de 60 km (Comillas, San Vicente,
   Asturias, Galicia, Mediterráneo...): modelo × coeficiente, como antes.

**Copernicus Marine In Situ (licencia):** comprobado el 2026-10-08 en
marine.copernicus.eu/user-corner/service-commitments-and-licence: licencia
gratuita, "for any purpose" (incluido comercial) con atribución "Generated
using E.U. Copernicus Marine Service Information" + DOI (In Situ IBI:
10.48670/moi-00043). Las boyas de Puertos del Estado llegan redistribuidas
ahí; la API directa de Puertos del Estado NO está autorizada para uso
comercial: ya no la usa este robot ni el mapa de la app (abajo).
Los ficheros "latest" se leen sin cuenta del almacenamiento público.

**Boyas del mapa vía Copernicus (2026-10-08, pedido de Mikel):** las 26
boyas de `BOYAS` (prevision.js) llevan su id de Copernicus (`copernicus`,
comprobado con el `platform_name` de cada NetCDF; todas están en el producto
IBI, también las del Mediterráneo y Canarias). `boyas-copernicus.yml` (cada 2
h, ~360 min/mes) corre `boyas-copernicus.py` y sube `boyas/copernicus.json`
al bucket `fuentes-gratuitas`; /prevision lo lee (`boyaDesdeCopernicus()`,
descarta medidas de más de 6 h). Ya no se llama a poem.puertos.es desde la
app. Atribución visible: tooltip de cada boya y línea bajo el panel ("Boyas:
Puertos del Estado vía E.U. Copernicus Marine Service … doi:10.48670/
moi-00043"). Nazaré (Instituto Hidrográfico) sigue igual. Queda
`scripts/fuentes/comparar-boyas.mjs` (comparativa interna) llamando a
Puertos del Estado directamente: pendiente de pasar también.

**Pendiente:** aplicar la migración (Mikel); revisar los ROI con bajamar
fuerte (se dibujaron con marea media subiendo; la guarda de arena cubre la
arena con color, no la arena gris con bruma); Orio caída; cuando haya
semanas de datos y etiquetas, revisar `calibracion.json` y los coeficientes
estimados de `ABRIGO_SPOTS` con los de las cámaras.

**Etiquetas de Claude (2026-10-08, Mikel: "puedes calibrar tú la cámara.
Debes, de hecho"):** Claude mira fotogramas de las cámaras (en una sesión o
en una rutina del plan de Claude, NUNCA con la API ni `claude -p`) y anota la
banda de ola que ve en `datos-robots/oleaje-camaras/etiquetas-claude.jsonl`
(cámara, encuadre, fecha UTC, banda o `no_se_sabe`, confianza, motivo,
espuma medida con el mismo código del robot, hash del fotograma; sin
imágenes). Procedimiento y texto de la rutina diaria:
`scripts/oleaje-camaras/RUTINA_ETIQUETADO.md`; lote con
`preparar-lote-etiquetado.mjs` (captura o miniaturas del bucket, y
`--anotar`); recalcular con `medir-espuma.mjs --solo-calibrar` (el robot
también las lee en cada ejecución). La rutina sube a
`robot/etiquetas-olas-AAAA-MM-DD` y `robot-diseno-pr.yml` le abre la PR.
**Pendiente (Mikel):** crear la rutina en claude.ai/code/routines con el
texto del final de `RUTINA_ETIQUETADO.md` (diaria, con luz, p. ej. 14:00
UTC).
- Peso 2 (1 si la confianza es `baja`): menos que Mikel (5) y "ola real"
  (3), más que las automáticas (1 / 0,5). `no_se_sabe` no cuenta. Solo
  calibran fotogramas `ok`, o `otro_encuadre` con `encuadreVerificado`
  (Claude comprobó con `<id>-roi.jpg` que es el encuadre de la referencia y
  el ROI cae en la rompiente; lo que falló fue la huella por marea o luz).
- `camaraSustituyeModelo()`: una etiqueta de Claude vale 5/8 de una de
  personas (8 solas, o 3 de Mikel + 4 de Claude) y además tienen que venir
  de ≥ 2 franjas de 2 h UTC (`franjaHoraria()`): mirar 8 veces el mismo mar
  no basta. Y la calibración de algún encuadre con esas etiquetas tiene que
  cuadrar con ellas (errorRel ≤ 75 %, `ERROR_MAXIMO_CLAUDE`): Berria tenía 9
  etiquetas en 2 franjas el primer día pero ±100 % (boya 3,1 m, etiquetas
  1,5 m, zona dinámica que cambia con el zoom) y NO sustituye.
- `p` (exponente) solo se ajusta con muestras de ≥ 2 días: en un día, la
  "variedad" de alturas puede venir solo de que boya y etiquetas discrepan
  para el mismo mar (daba p = 0,5 en Berria). `nEtiquetas` sigue contando solo las de personas;
  `nEtiquetasClaude` y `franjasClaude` van aparte en `calibracion.json`,
  que ahora lleva también `sustitucion` por cámara.
- Trampas vistas el primer día (15:45-17:25 UTC): por la tarde la mayoría
  de las cámaras de la Diputación están en planos que no son los de
  referencia (Mutriku mira al puerto, Deba y Zurriola a otro sitio) y salen
  `otro_encuadre`; **Sopela (Detectia) cambia de encuadre**: la foto es
  horaria (hh:04) y salió con tres planos distintos (la referencia de las
  10:20 UTC, uno más cerrado a las 15:04 y otro inclinado a las 16:04 y
  17:04); en los dos nuevos el ROI cae en mar abierto detrás de la
  rompiente (espuma 0,002-0,14) y no calibra. Parecía la marea y no lo era.
  Falta saber si son posiciones fijas (entonces, una referencia y un ROI
  por posición) o la cámara se mueve sola; Bakio a contraluz tiene brillos del
  sol dentro del ROI; con luz cálida la espuma tiene color de arena y la
  guarda la marca `orilla` (Mundaka 17:50 local).

## Open-Meteo: licencia comercial, API key y proxy `/meteo/` (2026-10-08)

**Situación de la licencia.** Costaviva tiene suscripciones de pago, así que
es una app **comercial** para Open-Meteo ("Subscriptions or ads make a site or
app commercial", open-meteo.com/en/terms). La API gratuita es solo para uso no
comercial (10.000/día, 5.000/hora, 600/min, 300.000/mes). Mikel compra el plan
de pago (Standard, 1M llamadas/mes; Professional, 5M/mes), que da licencia
comercial y una API key para los hosts `customer-` (`customer-api.open-meteo.com`,
`customer-marine-api.open-meteo.com`, ...; la key va en `&apikey=`). Los datos
son CC BY 4.0: **atribución visible obligatoria** ("Datos meteorológicos:
Open-Meteo.com (CC BY 4.0)", en la atribución del mapa, al pie del panel de
spot y bajo el contexto ambiental del diario). No quitarla.

**Cuota: Open-Meteo cuenta por ubicación** (ROBOT_REGLAS.md, 2026-09-14): una
petición con las 105 coordenadas de `SPOTS` gasta ~105 llamadas, y más de 14
días o más de 10 variables multiplican. Las peticiones de servidor ya agrupan
spots; lo que se paga es eso, no el número de fetches.

**Cómo está hecho:**
- `functions/_lib/open-meteo.js` es el único sitio que construye URLs de
  Open-Meteo (`urlOpenMeteo`, `pedirOpenMeteo`). Con `OPEN_METEO_API_KEY`
  usa el host comercial y la key; sin ella, el gratuito. Sus errores llevan
  la URL con la key tapada (`/prevision` devuelve el texto del error en su
  JSON público). Lo usan `prevision.js`, `viento-campo.js`,
  `registrar-presion.js` y `scripts/turbidez/medir-turbidez.mjs`, desde el
  2026-10-08 a través de `pedirDatosMeteo` de `functions/_lib/fuentes.js`
  (interruptor por variable, ver "Fuentes gratuitas" abajo).
- **El navegador nunca habla con Open-Meteo**: usa `pedirMeteo(api, consulta)`
  de `assets/js/meteo.js`, que pide a `/meteo/forecast` o `/meteo/marine`
  (`functions/meteo/[api].js`). El proxy NO es abierto: lista blanca de APIs,
  parámetros y variables (`PROXY_PERMITIDO`), una sola coordenada, ventanas de
  fechas acotadas; lo demás, 400 sin llamar a nadie. Redondea a 0,01° y
  cachea en el edge con la Cache API (30 min forecast, 60 min marine, 24 h si
  todo es pasado), así que usuarios cercanos comparten una llamada. Si una
  pantalla nueva necesita otra variable, se añade a `PROXY_PERMITIDO` y a
  `test/open-meteo.test.js`; ese test falla si algún `.html` o `assets/js/*.js`
  llama a `*api.open-meteo.com` directamente.
- La CSP no tenía hosts de Open-Meteo (connect-src admite `https:` entero),
  así que no cambia; las rutas `/meteo/forecast` y `/meteo/marine` están en
  `rutas-publicas.js` como rutas exactas, no como prefijo.

**Secretos (nombre: `OPEN_METEO_API_KEY` en los dos sitios):**
- **Cloudflare Pages → costaviva → Settings → Variables and Secrets**, como
  *Secret*, **en Production Y en Preview** (van por separado: si solo está en
  Production, las previews de las PR siguen en el host gratuito).
- **Después hace falta un redeploy** (un commit nuevo o "Retry deployment"
  del último despliegue de producción): un secret nuevo no llega a lo ya
  desplegado (trampa 1 de comun).
- **GitHub → Settings → Secrets and variables → Actions**:
  `OPEN_METEO_API_KEY`, para `turbidez.yml` (el único workflow que llama a
  Open-Meteo directamente; `presion-historico.yml` llama a
  `/registrar-presion`, que usa el secret de Cloudflare). Si el secret no
  existe, llega vacío y se usa el host gratuito.
- Para comprobar que ya va por el plan de pago: el panel de cliente de
  Open-Meteo muestra el consumo; si no sube tras el redeploy, el secret no ha
  llegado.

## Fuentes gratuitas: MET Norway y Copernicus Marine en paralelo (2026-10-08)

Decisión de Mikel: "por ahora gratis". Se montan dos fuentes gratuitas y
válidas para uso comercial **en paralelo** a Open-Meteo, se comparan contra
las boyas y se cambia **variable a variable** solo cuando Mikel vea la
comparativa. **Hoy producción sigue entera en Open-Meteo** (interruptores
apagados).

**Condiciones verificadas (2026-10-08):**
- **MET Norway Locationforecast 2.0** (api.met.no/doc/TermsOfService):
  "All requests must (if possible) include an identifying User Agent-string
  (UA)" con "a company email address or a link to the company website";
  "If we cannot contact you in case of problems, you risk being blocked
  without warning". "Anything over 20 requests/second per application (total,
  not per client) requires special agreement". "don't repeat requests until
  the time indicated in the `Expires` response header" y "use the
  `If-Modified-Since` request header". "truncate all coordinates to max 4
  decimals" (5+ da 403). No se puede usar "Yr" en el nombre del servicio.
  Licencia (api.met.no/doc/License): "licensed under the Norwegian Licence for
  Open Government Data (NLOD) 2.0" y "Creative Commons 4.0 BY International";
  crédito: "Data from MET Norway" / "Based on data from MET Norway". CC BY 4.0
  permite uso comercial; exige crédito, enlace a la licencia e indicar
  cambios (por eso el texto dice "adaptados").
- **Copernicus Marine** (marine.copernicus.eu/user-corner/service-commitments-and-licence):
  licencia "worldwide, non exclusive, royalty free, perpetual"; cláusula
  2.2(b): crear y distribuir productos derivados "for any purpose"
  (comercial incluido). Cláusula 2.4(a): crédito "Generated using E.U.
  Copernicus Marine Service Information" + DOI, "clearly visible on the home
  page of the Licensee's website or at least on the page allowing to access to
  the products". Cuenta personal obligatoria (2.7: usuario y contraseña
  "personal to the signatory ... non-transferable"); 2.6 pide guardar
  registro del uso (el workflow y este fichero lo son).
  Productos (IDs comprobados con `copernicusmarine describe`):
  `IBI_ANALYSISFORECAST_WAV_005_005` (DOI 10.48670/moi-00025), dataset
  `cmems_mod_ibi_wav_anfc_0.027deg_PT1H-i`: VHM0, VMDR, VTM10, VTPK.
  `IBI_ANALYSISFORECAST_PHY_005_001` (DOI 10.48670/moi-00027), dataset
  `cmems_mod_ibi_phy_anfc_0.027deg-2D_PT1H-m`: thetao, zos (CON marea; hay
  datasets aparte `..._detided`), uo, vo. Rejilla 1/36°, 10 días de
  previsión, dominio 26-56 N y 19 W-5 E: cubre los 105 spots (península,
  Baleares, Canarias); **no cubre Azores**.
- **Mareas de Puertos del Estado: NO se pueden reutilizar.** Su manual de
  descarga (bancodatos.puertos.es/BD/peticiones/Manual_Usuario_Descargaportus.pdf):
  "Puertos del Estado solo autoriza el uso de los datos para el propósito
  específico de la descarga, y, en ningún caso, se permite la transferencia de
  los datos a terceros"; el aviso legal de puertos.es exige "autorización
  escrita previa" para reproducir o distribuir. Parado. La comparativa con sus
  boyas es uso interno de validación (no se redistribuye).
- **Tablas de marea del Instituto Hidrográfico (PT): NO.** "© Copyright
  Instituto Hidrográfico 2025" sin licencia abierta; su aviso legal remite a
  fichas de metadatos por producto y al contacto centrodados@hidrografico.pt.
  Parado. La marea sale de `zos` de IBI (Copernicus), que sí se puede usar.

**Cómo está hecho:**
- `functions/_lib/fuentes.js`: `pedirDatosMeteo(api, consulta, { env })`
  sustituye a `pedirOpenMeteo` en `prevision.js`, `viento-campo.js`,
  `registrar-presion.js`, `scripts/turbidez/medir-turbidez.mjs` y el proxy
  `/meteo/`. Sin interruptores hace **exactamente** la llamada de siempre a
  Open-Meteo. Con ellos, reparte las variables por fuente, pide cada parte a
  la suya y las junta por etiqueta de hora. Cada respuesta lleva
  `fuentes_datos` (y `/prevision`, `fuentesDatos`).
- `functions/_lib/eje-horario.js`: eje de horas idéntico al de Open-Meteo.
  Ojo, comprobado en real: Open-Meteo usa **un único desfase** para toda la
  respuesta (el de la zona en el momento de pedir) y siempre 24 horas por día.
- `functions/_lib/met-norway.js`: Locationforecast compact -> forma de
  Open-Meteo Forecast (windspeed/winddirection_10m, pressure_msl, cloudcover,
  temperature_2m, precipitation = `next_1_hours` de la hora anterior). Un
  punto (el proxy del navegador) va en vivo con caché en el edge que respeta
  Expires/If-Modified-Since; muchos puntos leen la instantánea
  `atmosfera/todos.json` (spots + rejilla de 1° que `viento-campo` interpola
  por componentes u/v). MET da horario ~60 h y luego cada 6 h, y **no tiene
  pasado**: esas horas salen `null`.
- `functions/_lib/copernicus-mar.js`: instantáneas `mar/spots.json` (spots y
  boyas) y `mar/celdas/<k>.json` (celdas de mar alrededor de cada spot, cajas
  de 0,5°) -> forma de Open-Meteo Marine (wave_height, wave_direction,
  wave_period = VTM10, wave_peak_period = VTPK, sea_surface_temperature,
  sea_level_height_msl = zos, ocean_current_velocity en km/h,
  ocean_current_direction hacia donde va). Ventana guardada: 10 días atrás y
  10 adelante. Ubicaciones personalizadas a más de 15 km de una celda
  guardada: `null` + `aviso`.
- `functions/_lib/instantaneas.js`: lee de Supabase Storage, bucket público
  `fuentes-gratuitas` (migración `20261008100000_bucket_fuentes_gratuitas.sql`,
  **sin aplicar**). Más de 36 h de antigüedad -> error, nunca una previsión
  vieja con aspecto de actual.
- `.github/workflows/fuentes-gratuitas.yml` (sin IA): `atmosfera` cada 3 h
  (`scripts/fuentes/instantanea-met.mjs`, 293 puntos, ~75 s, ~0,85 MB), `mar`
  una vez al día a las 04:47 UTC (`scripts/fuentes/descargar-ibi.py`, toolbox
  `copernicusmarine==2.5.0`, servicio arco-time-series: solo los bloques de
  16x16 celdas donde caen los puntos; `--prueba` genera datos sintéticos sin
  cuenta) y `comparativa` a diario. Los `schedule` solo actúan con la
  variable de repositorio `FUENTES_GRATUITAS=true`; a mano corre siempre.
- **Comparativa**: `scripts/fuentes/comparar-boyas.mjs` archiva cada día lo
  que cada fuente prevé para las 24 h siguientes en las 26 boyas de `BOYAS`
  (`datos-robots/fuentes/pronosticos/`, 45 días) y lo cruza con lo medido
  (solo marca de calidad 1) en `datos-robots/fuentes/COMPARATIVA.md`: sesgo,
  MAE y RMSE por variable, **en las mismas horas para todas las fuentes**.
  Es aparte de la rutina nocturna "Calibración y salud nocturna" (que sigue
  con Open-Meteo en `CALIBRACION.jsonl`); esa rutina puede leer este fichero.
- Atribución: `assets/js/meteo.js` cambia el texto de `.atribucion-meteo` y
  del mapa a las fuentes que de verdad se pintan (mismos textos que
  `ATRIBUCIONES_HTML` de `fuentes.js`; lo comprueba
  `test/fuentes-gratuitas.test.js`). Copernicus exige su frase en inglés tal
  cual y los DOI; no traducirla.

**Interruptores** (Cloudflare Pages → Settings → Variables, **Production y
Preview por separado, y redeploy**, trampa 1; para `turbidez.yml`, variables
de repositorio): `FUENTE_ATMOSFERA=openmeteo|metno`, `FUENTE_MAR=openmeteo|copernicus`
y, por encima, por grupo: `FUENTE_VIENTO`, `FUENTE_PRESION`,
`FUENTE_NUBES_LLUVIA`, `FUENTE_TEMPERATURA`, `FUENTE_OLEAJE`,
`FUENTE_TEMP_AGUA`, `FUENTE_MAREA`, `FUENTE_CORRIENTE`. Probar primero en
**Preview**. Con `metno` hace falta `METNO_CONTACTO` en el mismo entorno.

**Pendiente de Mikel antes de activar nada:** cuenta gratuita de Copernicus
Marine y los secrets `COPERNICUSMARINE_USERNAME`/`COPERNICUSMARINE_PASSWORD`
(GitHub Actions); decidir el contacto del User-Agent de MET (web o email de
empresa, nunca personal). Por defecto se usa `datos@costaviva.org` (decidido por Mikel, 2026-10-08); `METNO_CONTACTO` (variable de
repositorio y de Cloudflare); aprobar y aplicar la migración del bucket;
`FUENTES_GRATUITAS=true`. Antes de quitar Open-Meteo del todo: el diario
retroactivo ya tiene atmósfera pasada con ERA5 (fase 2, abajo) salvo los
últimos ~6 días, y la ventana de actividad (`past_days=1`) sigue sin pasado
con MET.

### Fase 2 (2026-10-08, aprobada por Mikel): costa entera, capas, pasado y selector de admin

Sin IA en tiempo de ejecución; todo gratuito y válido para uso comercial con
atribución; nunca se inventa un dato (lo que falta sale `null` + `aviso`).

- **Franja costera de Copernicus** (`scripts/fuentes/descargar-ibi.py`,
  `celdas_costeras`): además de spots y boyas, se guardan las celdas de mar a
  menos de ~20 km de tierra en España y Portugal (península, Baleares, Ceuta,
  Melilla, Canarias, Madeira; se recortan Francia, Marruecos atlántico y
  Argelia), una por cuadro de 3x3 celdas (~8 km), la más pegada a la costa.
  Mismo formato `mar/celdas/<k>.json` (cajas de 0,5°), con el campo `anillo`.
  `copernicus-mar.js` busca en las cajas a menos de 0,2° y se queda con la
  celda más cercana de verdad; más de 20 km (`MAX_KM_CELDA`) -> `null` +
  `aviso`. **Medido en real (2026-10-08)**: 131 spots/boyas + 2.933 celdas
  costeras en 203 cajas, 59,4 MB en total (12,9 MB con gzip), caja mayor
  0,64 MB (límite 30 MB), 222 + 219 bloques, 23,5 min y 1,1 GB de RAM en un
  runner de GitHub. Distancia a la celda guardada más cercana en 32 puntos de
  costa (de Hondarribia a El Hierro, Funchal y Porto Santo): de 0,3 a 8,2 km.
  **Descarga**: indexado vectorial por tandas de 30 bloques; pedir bloque a
  bloque en hilos fue ~10 veces más lento (125 de 172 bloques en 49 min)
  porque se volvían a bajar trozos ya bajados. Ojo con `EXCLUSIONES`: un
  recorte de "Marruecos atlántico" sin límite oeste se comió Canarias y
  Madeira; ahora el script falla en rojo si alguna zona sale sin celdas.
- **Capas del mapa 🌿 Clorofila y 🌡 Temperatura del agua**
  (`scripts/fuentes/descargar-capas.py`, en el job `mar`):
  `capas/clorofila.json` = satélite `OCEANCOLOUR_ATL_BGC_L4_NRT_009_116`
  (dataset `cmems_obs-oc_atl_bgc-plankton_nrt_l4-gapfree-multi-1km_P1D`,
  `CHL`, DOI 10.48670/moi-00288; "gapfree": los huecos por nubes los
  interpola el productor y la leyenda lo dice) a 1/24°;
  `capas/temperatura-agua.json` = `thetao` de IBI físico (DOI
  10.48670/moi-00027) de hoy a las 12 UTC, a 1/18°. Un byte por celda en
  base64 (255 = sin dato; escala log10 o lineal en el propio JSON) porque el
  bucket **solo admite JSON** (no PNG). Medido en real: 369 kB y 208 kB
  (66 kB y 38 kB con gzip), 21 s. `index.html` las pinta en un `<canvas>`
  re-muestreado a Mercator (`assets/js/capas-mar.js`, puro y con tests),
  botones en la columna de ríos/boyas, leyenda con la explicación
  (corregida el 2026-10-09 con el texto de Mikel: la clorofila dice dónde
  el mar es productivo, NO dónde están los peces; azul = poca, verdosa =
  moderada e interesante, verde intenso = posible floración con agua turbia;
  lo que vale es el borde verde/azul, mejor con cambio de temperatura;
  satélite solo superficie, nubes, y la costa y las desembocaduras falsean
  el dato), toque en el mapa = valor, y atribución de Copernicus + DOI en el mapa y en la leyenda. Botones
  en la columna B debajo de Boyas (260/322 px; 234/290 en móvil), estilo de
  `.boyas-toggle`; la imagen va en `tilePane` (entre el mapa base y los
  marcadores); leyenda con variables de `costaviva.css`. Una capa a la vez hasta el 2026-10-09 (ahora varias, ver "Varias capas de mar a la vez"); más vieja de 7 días (clorofila) o 3 (temperatura), no se
  pinta.
- **〰 Frentes y corrientes (2026-10-09, pedido de Mikel; PR pendiente de
  su sí)**. Sin IA ni APIs de pago: sale de lo que ya baja
  `descargar-capas.py` más la corriente media del día **sin marea** de IBI
  (`cmems_mod_ibi_phy-cur_anfc_detided-0.027deg_P1D-m`, `uo_detided` /
  `vo_detided`, mismo producto y DOI 10.48670/moi-00027; sin marea porque en
  la plataforma la corriente de marea de una hora tapa la circulación).
  Fichero `capas/frentes.json` (malla común de 1/18°, ~5-6 km; ~255 kB) y
  copia diaria `capas/historico/frentes-AAAA-MM-DD.json` (zlib, ~50-80 kB)
  para el aprendizaje. Mismo bucket, mismo paso del job `mar`; el paso de
  subida va con `!cancelled()` para que, si fallan los frentes, clorofila y
  temperatura se suban igual (el job sale en rojo). Cero subrequests de
  Cloudflare: el navegador lo pide directo al bucket.
  **Método** (Belkin y O'Reilly 2009, J. Mar. Syst. 78:319-326, DOI
  10.1016/j.jmarsys.2008.11.018, simplificado): mediana 3x3 + Sobel en
  unidades físicas; frente de clorofila si |∇log10 CHL| ≥ 0,03 por km (se
  duplica en ~10 km), térmico si |∇T| ≥ 0,08 °C/km (0,8 grados en 10 km;
  era 0,05 hasta el 2026-10-09, ver "Ajuste" abajo).
  Chang y Cornillon 2015 (DSR II 119:40-47, DOI 10.1016/j.dsr2.2013.12.001)
  llaman fuertes a > 0,2 K/km y débiles a < 0,1 en imágenes de ~1 km; aquí
  son más bajos porque la malla de ~5 km suaviza. **Umbrales de Claude, por
  validar con el primer mes real**: el script imprime el % de celdas y avisa
  si pasa del 25 %. **Primera ejecución real (2026-10-09, rama de la PR):** 81.568
  celdas de mar; frente de clorofila 0,79 %, térmico 8,64 %, los dos 0,45 %,
  convergencia 0,23 %, nubes 49,8 %, franja costera 1,7 %; 255 kB + 60 kB de
  histórico. El térmico sale mucho más que el de clorofila (la mitad del mar
  estaba bajo nubes ese día): vigilarlo antes de tocar umbrales.
  **Ajuste (2026-10-09, Mikel con captura del iPhone: "no me aparece el
  combinado de clorofila"; solo salía naranja, en líneas rectas).** Con los
  campos reales del día bajados por un workflow temporal (sin escribir en el
  bucket; reproducción del frentes.json de producción al 100 %): (1) la
  clorofila del 7 oct dejaba el golfo de Bizkaia con el 2,6 % observado (97 %
  "nubes"): ni verde ni morado posibles. Ahora **compuesto de hasta 5 días**:
  el gradiente se calcula con cada día por separado (nunca mezclando días en
  un mismo Sobel, que inventaría bordes en la costura) y cada celda toma el
  día más reciente en que se pudo calcular; `fecha_clorofila_desde` en el
  JSON y la tarjeta dice "Satélite del X al Y (lo último sin nubes)". Bizkaia
  pasa de 3 % a 83 % con clorofila. (2) Las líneas naranjas **no eran un
  fallo de malla**: IBI y la malla de 1/18° casan 2:1 sin filas vacías, la
  temperatura media del día da lo mismo que la de las 12 UTC, y el campo
  tiene esos bordes; eran bordes suaves de filamentos del modelo que pasaban
  justo el 0,05 en líneas de una celda. Con **0,08 °C/km** el térmico baja
  del 8,6 % al 3,5 % del mar y quedan los bordes fuertes (afloramiento junto
  a Asturias y la franja fría junto a las Landas: 17,5-18 °C pegado a la
  costa frente a 19,5-20 °C a 15 km, que está en el campo de IBI). Además,
  **frentes de menos de 3 celdas unidas fuera** (ruido; Cayula y Cornillon
  1992). (3) El morado sale solo donde coinciden de verdad: el 30 % de los
  frentes de clorofila tiene térmico en la misma celda frente al 3 % del mar
  (10 veces el azar). Resultado del día real: clorofila 1,03 %, térmico
  3,53 %, los dos 0,32 %, nubes 1,6 %; en Bizkaia 135 naranjas, 24 verdes y
  11 morados (antes 344, 0 y 0). Tests: `test/frentes_capas_test.py`
  (Python, en tests.yml). Convergencia: -(∂u/∂x + ∂v/∂y) ≥ 0,1·f (|δ|/f, McWilliams
  2016, Proc. R. Soc. A 472, DOI 10.1098/rspa.2016.0117); lo que converge
  acumula lo que flota (D'Asaro et al. 2018, PNAS 115:1162-1167, DOI
  10.1073/pnas.1718453115). IBI va a 1/36° (~2-3 km) y se promedia a 1/18°;
  cerca de la costa el modelo pierde detalle y las diferencias centradas
  necesitan vecinos de mar, así que en la primera celda junto a tierra no
  hay convergencia. **Máscaras**: tierra; franja de 5 km desde tierra donde
  la clorofila del satélite no es fiable (aguas "caso 2": sedimentos y
  materia orgánica disuelta de ríos, IOCCG 2000, informe 3; y el efecto de
  adyacencia de tierra): ahí ni frente ni nivel de clorofila (el térmico y
  la convergencia sí); y nubes: la variable `flags` del L4 "gapfree"
  (máscara 2 = INTERPOLATED, 1 = LAND, comprobado en los metadatos STAC del
  dataset el 2026-10-09) marca lo que el productor rellenó; celda con menos
  de la mitad observada = nube, sin frente ni nivel. El borde con tierra o
  con nube nunca da frente (Sobel necesita los 8 vecinos). Nivel de
  clorofila: baja < 0,2, moderada, alta ≥ 2 mg/m³ (clases de Antoine et al.
  1996, GBC 10:57-69, DOI 10.1029/95GB02832, adaptadas al Cantábrico).
  **Mapa**: botón 〰 "Frentes" debajo de T. agua (384/74 px; 346/66 en
  móvil), una capa de mar a la vez, misma tarjeta del dock con muestras de
  color en vez de barra: morado = dos señales a la vez (clorofila + térmico,
  o frente con la corriente juntando el agua en esa celda o al lado), verde
  = borde de clorofila, naranja = térmico, celeste tenue = la corriente
  junta, gris = sin dato fiable (nubes o costa). Flechas de corriente
  (polilíneas SVG, clase `.flecha-corriente`, como mucho 12 por lado de
  pantalla, largo según la fuerza) que se rehacen en `moveend` (se quita el
  manejador al apagar). Toque = frase llana ("Borde de clorofila y de
  temperatura a unos 4 km: lo más prometedor. Corriente hacia el NE: 1,1
  km/h (0,6 nudos)"), sin cifras de umbral. Cálculo puro en
  `assets/js/frentes.js` (`window.Frentes`). Analítica: `ver_capa_frentes`.
  **Índice: desde el 2026-10-09 (PR "frentes en el índice") cuatro reglas
  con fuente y peso pequeño leen esta capa**, ver "〰 Frentes en el índice";
  el resto sigue en la sombra del aprendizaje semanal (ver "Aprendizaje
  autónomo del índice", frentes en la sombra).
  Tests: `test/frentes.test.js` (en tests.yml; fixture
  `test/fixtures/frentes-mini.json` generado con las funciones de Python).
- **🌊 Corriente (2026-10-09, Mikel: "¿La corriente se puede mostrar por
  manchas (con direcciones)?"; PR pendiente de su sí)**. Botón 🌊 "Corriente"
  debajo de 〰 Frentes (446/74 px; 402/66 en móvil; etiqueta a 8 px para que
  quepa), una capa de mar a la vez, misma tarjeta del dock. **Sin fichero
  nuevo**: lee `capas/frentes.json`, que desde este cambio trae
  `corriente.velocidad` (fuerza en m/s en la malla de los códigos, 1/18°, un
  byte, 0,02 m/s por unidad, 255 = tierra; los mismos bytes que el
  histórico, `bytes_velocidad` en `descargar-capas.py`; +207 kB en crudo,
  ~+40 kB con la compresión br del bucket) además de u/v de la malla de las
  flechas (1/6°). Mismo job `mar`, cero subrequests de Cloudflare. Si el
  fichero aún no trae `velocidad` (antes de la primera ejecución del job con
  este cambio), la fuerza sale de u/v de 1/6°: se ve igual, más borroso y
  pisando algo la costa. **Manchas**: un color por tramo, violeta de un solo
  tono de claro (floja) a oscuro (fuerte), que no se confunde con el azul
  del mar del mapa base; imagen a 3 píxeles por celda con la fuerza
  interpolada entre celdas de mar (bordes curvos, no escalones de 5 km) y
  re-muestreada a Mercator como clorofila/temperatura; opacidad 0,75.
  **Tramos** (nudos, km/h en la leyenda): < 0,15 / 0,15-0,3 / 0,3-0,5 / 0,5-1
  / > 1. Elegidos con el fichero real del 2026-10-09: en el Cantábrico y la
  fachada atlántica la mediana es ~0,19 nudos, p90 ~0,4 y p99 ~0,6; solo el
  Estrecho, el Mediterráneo y Canarias pasan de 1 nudo. Con < 0,2 / 0,2-0,5 /
  0,5-1 / > 1 el Cantábrico salía en dos colores. **Flechas**: rejilla fija
  de pantalla (como mucho 12 en el lado largo, nunca a menos de 56 px),
  dirección interpolada de la malla de 1/6°, largo de 12 a 34 px según la
  fuerza (tope en 1 nudo), tinta con halo blanco (`.flecha-corriente-halo` +
  `.flecha-corriente-tinta`) para leerse sobre violeta claro y oscuro; solo
  en el mar; se rehacen en `moveend`. **Toque**: "Corriente hacia el NE, 0,6
  nudos (1,1 km/h)." (fuerza de la malla fina, la que da el color). Leyenda:
  la frase visible dice "Media del día sin la marea: en rías, puertos y
  pegado a la costa manda la marea"; la explicación lo amplía (el modelo
  pierde detalle cerca de la costa). Créditos de Copernicus + DOI como las
  demás. **En 〰 Frentes las flechas se quedan** (decisión de Claude): allí
  explican por qué la corriente junta el agua en un borde; la fuerza por
  manchas está en 🌊 Corriente y la explicación de Frentes lo dice.
  Cálculo puro en `assets/js/corriente.js` (`window.Corriente`). Analítica:
  `ver_capa_corriente`. Tests: `test/corriente.test.js` (en tests.yml;
  fixture `test/fixtures/corriente-mini.json` generado con `salida_frentes`).
- **Pasado para el diario (ERA5)**: `functions/_lib/era5.js`. Si la
  atmósfera va por MET Norway (`metno`) y la consulta es ENTERA del pasado
  (`ventanaPasada`), `fuentes.js` la manda a ERA5 (`fuentes_datos: ["era5"]`).
  Datos de la copia pública ARCO-ERA5 de Google (Zarr, **sin cuenta ni
  clave**), job `pasado` (`scripts/fuentes/descargar-era5.py`, 08:13 UTC):
  `pasado/<día UTC>/<floor(lat)_floor(lon)>.json` con las celdas de 0,25° de
  las 90 cajas de 1° con costa; celda más cercana, sin interpolar. Medido en
  real: ~5 s y ~1 MB por día. ERA5T llega con **~6 días de retraso**: el
  diario de los últimos días sale en blanco con `aviso` (con Open-Meteo no
  pasa). Relleno histórico: `workflow_dispatch` con `parte=pasado` y
  `dias_pasado` (máx. 120 días por ejecución). Licencia: catálogo del CDS
  `"license": "CC-BY-4.0"` (DOI 10.24381/cds.adbb2d47); desde el 2-7-2025 la
  licencia de productos Copernicus del CDS es CC BY 4.0 (foro de ECMWF); el
  README de ARCO-ERA5: "Yes, you can use our ERA5 data according to the terms
  of the Copernicus license". Crédito en `ATRIBUCIONES_HTML.era5` y en
  `assets/js/meteo.js`.
- **Selector de fuentes, solo admin**: en el panel de spot
  (`#adminFuentes`), "Previsión (admin): la normal / Open-Meteo / Gratuitas /
  Las dos, lado a lado" -> tabla aparte con ola, viento, agua, marea,
  corriente, presión, nubes y lluvia. Se enseña solo si
  `supabase.rpc("es_admin")` da `true`. El proxy `/meteo/` honra
  `&fuente=openmeteo|gratuitas` SOLO tras `requireAdmin` de
  `functions/_lib/admin.js` (el mismo de invitaciones: JWT validado en
  `/auth/v1/user` y luego RPC `es_admin` con ese token). Cualquier otro -> 403 antes de mirar la
  caché y sin pedir datos; sin `fuente` no se llama a Supabase. Respuesta
  forzada: `private, no-store`.
- Tests: `test/fuentes-fase2.test.js` (en `tests.yml`).

## 🌡 T. agua: escala fija por grados e isotermas (2026-10-09, capturas de Mikel)

Con la escala continua de 10 a 28 °C el Cantábrico (17-21 °C) salía todo del
mismo verde. La PR #158 estiró la paleta al mar visible; Mikel la rechazó ("El
color debiera ser el mismo"): **la misma temperatura, siempre el mismo color,
en cualquier zona y zoom. No volver a proponer una escala adaptativa.** Ahora,
sin IA ni peticiones nuevas (mismo `capas/temperatura-agua.json`):

- **Escala fija por bandas de 1 °C**, de 8 a 30 °C (`PALETA_TEMP_AGUA` en
  `assets/js/isotermas.js`): tono de turbo de azul a rojo y luminosidad
  alterna entre grados vecinos. ΔE2000 entre vecinos ≥ 12 en visión normal y
  ≥ 11 simulando deuteranopía (lo comprueba el test, umbral 10). Leyenda:
  barra fija 8-30 °C con el tramo visible recuadrado y una casilla por grado
  visible con su número. Opacidad 0,8. Frase del ⓘ y de la tarjeta: "Cada
  color es un grado…; las líneas marcan el grado exacto".
- **Isotermas**: marching squares sobre el campo suavizado 3x3, solo lo
  visible, sin tierra ni celdas sin dato; cada 1 °C, 0,5 °C si el rango
  visible es < 2,5 °C, 2 °C a zoom 5; como mucho 10 niveles. Etiquetas "18°"
  con halo, ≤ 8, a ≥ 90 px entre sí y fuera de la columna de botones en el
  móvil (pane `isotermasEtiquetas`, z 450, debajo de los spots).
- Al tocar: "18,4 °C en superficie" (coma decimal).
- Código: `assets/js/isotermas.js` (puro, `test/isotermas.test.js`) y
  `pintarIsotermas()`/`leyendaBandas()` en `index.html`. La imagen se pinta
  una vez; mover el mapa cuesta ~3 ms en Chromium con el fichero real.

## 🌿🌡〰🌊 Varias capas de mar a la vez (2026-10-09, pedido de Mikel)

Mikel: "Debiéramos poder seleccionar varios campos a la vez… y el resumen
igual debiera ir en otro lugar o en otro formato". Antes, una capa de mar a la
vez; ahora los cuatro botones son **conmutadores independientes**
(`aria-pressed`; encender uno no apaga otro). Sin peticiones nuevas: mismos
ficheros del bucket, una petición por fichero aunque Frentes y Corriente la
pidan a la vez (`cargandoCapasMar`), y las imágenes se guardan por capa.

- **Con UNA capa, todo como antes** (imagen, isotermas, flechas, tarjeta,
  globo; la captura de solo T. agua es idéntica píxel a píxel a la de main).
- **Con VARIAS, solo una pone el color de fondo**: la que el usuario tocó en
  su fila de la leyenda o, por defecto, clorofila > temperatura > corriente >
  frentes. 〰 Frentes nunca es el fondo si hay otra. Las demás: 🌡 isotermas
  con número (halo blanco); 🌿 líneas verdes 0,2 (punteada) · 0,5
  (discontinua) · 2 mg/m³ (continua); 〰 solo los trazos (doble, clorofila,
  térmico; sin el gris ni el celeste) con halo blanco, `pixelesFrentesTrazo`,
  4 px por celda; 🌊 flechas (manchas solo de fondo). Las flechas de Frentes
  no salen si 🌊 está encendida. Viento (partículas) va aparte y convive.
- **Leyenda conjunta** "CAPAS DEL MAR" en la misma `#capaMarPanel`: una fila
  por capa (icono, nombre, mini leyenda, "Fondo" / "poner de fondo"; la fila
  es un botón de 44 px). Minimizada: los iconos y la escala del fondo. Fechas
  de cada capa en "Cómo se leen juntas"; créditos de Copernicus con los DOIs
  de todas en la tarjeta y en ⓒ Fuentes.
- **Toque**: un globo con una línea por capa ("🌿 Clorofila moderada (0,45
  mg/m³)", "🌡 19,4 °C en superficie", "〰 Borde de agua verde y azul a unos 3
  km", "🌊 Corriente hacia el NE, 0,3 nudos (0,6 km/h)"), estrecho (195 px)
  para no quedar debajo de la columna de botones.
- **Recuerdo**: `cv_capas_mar` en localStorage (`{activas, fondo}`, try/catch)
  y se restauran al abrir, cuando ya están los módulos (`ventana-actividad-lista`).
- Medido (Chromium, 390x844, CPU x4): mover el mapa con las 4 capas ~28 ms;
  la imagen de trazos, una vez, ~260 ms.
- Código: `assets/js/capas-combinadas.js` (puro), `componerCapasMar()` /
  `leyendaVariasCapas()` / `globoCapasMar()` en `index.html`. Tests:
  `test/capas-combinadas.test.js` (en tests.yml).

## Informe diario — Search Console real, conteo de cámaras, robot de especies (2026-09-20)

Pedido explícito del usuario: ampliar `daily-report.yml` con (1) cuántas
webcams funcionan bien y cuántas no, (2) cuántas cámaras nuevas encontró
el robot buscador de fuentes, (3) evolución del robot de especies, (4)
resumen de Instagram, (5) conclusiones de Search Console. Antes de tocar
nada se investigó qué existía ya — (1), (2), (3) y (4) ya tenían la
infraestructura montada (tabla `camara_estado`, `ROBOT.md`, el paso
"marketing" con métricas reales de Instagram vía `CALIBRACION.jsonl`),
solo hacía falta pulir el informe. (5) no existía — decisión previa
explícita de no montar la API de Google, revertida hoy tras preguntarle
al usuario.

**Cambios en `daily-report.yml`**:
- Paso "Estado de las webcams": ahora imprime `N de M cámaras funcionan
  correctamente` como primera línea, antes de listar caídas/con reserva.
- Prompt de "Síntesis del día": pide explícitamente el número de
  cámaras nuevas propuestas por el robot buscador de fuentes en las
  últimas 24h (línea `**Cámaras nuevas encontradas:**`), y separa la
  investigación de migración/cría de especies en su propia línea
  (`**Robot de especies:**`) dentro de "Trabajo externo" — esa pasada
  solo corre los jueves, así que la mayoría de días debe decir
  explícitamente "no le tocaba pasar hoy" en vez de inventar novedades.

**Search Console — integrado de verdad, sin clave descargable.** La
cuenta de Google del usuario tiene activada una política de
organización (`iam.disableServiceAccountKeyCreation`) que bloquea crear
claves JSON para cuentas de servicio — común en cuentas nuevas, medida
de seguridad real de Google, no un fallo. En vez de pedir que se
desactive (puede que ni haya un admin de políticas al que recurrir, es
una cuenta personal), se montó **Workload Identity Federation**: GitHub
Actions se autentica directo contra Google Cloud con su propio token
OIDC de cada ejecución, sin ningún secreto guardado en ningún sitio (ni
en el repo, ni como GitHub Secret).

Recursos creados (todo esto vive en Google Cloud, no en este repo):
- Proyecto: `project-5a5d60f4-a099-4065-a23` (número `1029831673189`).
- Cuenta de servicio: `costaviva-search-console-reade@project-5a5d60f4-a099-4065-a23.iam.gserviceaccount.com`
  (el nombre se truncó solo a 30 caracteres, límite de Google Cloud —
  "reade" en vez de "reader" es correcto, no un error). Dada de alta a
  mano en Search Console → Configuración → Usuarios y permisos, con
  acceso **Restringido** (solo lectura) sobre la propiedad
  `sc-domain:costaviva.org`.
- Workload Identity Pool: `github-actions-pool`.
- Proveedor OIDC dentro del pool: nombre visible `github-actions-provider`,
  emisor `https://token.actions.githubusercontent.com`, atributos
  `google.subject=assertion.sub`, `attribute.repository=assertion.repository`,
  `attribute.repository_owner=assertion.repository_owner`. Acceso
  concedido a la cuenta de servicio filtrando por
  `attribute.repository == Mikel1972/Costaviva`.

**Trampa real encontrada al usarlo por primera vez, para no repetir la
búsqueda**: el **ID real del proveedor no es el "nombre visible"** —
Google Cloud generó el ID con un guion delante:
`-github-actions-provider` (no `github-actions-provider`). La lista de
proveedores solo muestra el "nombre visible" sin guion, así que es
fácil copiar mal el `workload_identity_provider` del workflow (pasó en
la primera prueba real con `workflow_dispatch`, dio `invalid_target`).
Se confirmó el ID real comparando contra el texto
"Público predeterminado" que la propia consola de Google Cloud mostró
al configurar el proveedor (ese sí lleva el nombre de recurso completo
y correcto). **Si algún día hay que tocar este proveedor de nuevo**:
verificar siempre el ID real antes de asumir que coincide con el
nombre visible.

`workload_identity_provider` completo, tal como vive en
`daily-report.yml`:
```
projects/1029831673189/locations/global/workloadIdentityPools/github-actions-pool/providers/-github-actions-provider
```

El paso "Search Console" usa `google-auth-library` (no el paquete
`googleapis` completo, mucho más pesado) para conseguir un token de
acceso y llama directo a la API REST clásica de Search Console
(`www.googleapis.com/webmasters/v3/...`) con `fetch` — mismo patrón
que el resto de endpoints externos del repo. Datos que muestra: clics/
impresiones/CTR/posición media de los últimos 7 días (con variación
frente a los 7 anteriores) y el top 5 de búsquedas — o un aviso
explícito de que Google no desglosa búsquedas concretas cuando el
volumen es tan bajo que entra en su umbral de privacidad (pasa con
`costaviva.org` ahora mismo, SEO muy reciente). Verificado en real dos
veces con `workflow_dispatch` antes de mergear — la propiedad detectada
es `sc-domain:costaviva.org` (propiedad de dominio, no de prefijo URL).

**Indexación en Google (añadido 2026-09-28)**, pedido explícito del
usuario: además del rendimiento, el informe diario trae qué URLs del
`sitemap.xml` ha indexado Google y, las que no, agrupadas por motivo
("Rastreada: actualmente sin indexar", "Descubierta: actualmente sin
indexar"...), con la variación frente a la pasada anterior (marcador
`<!-- INDEXACION indexadas=N -->` en el Issue, mismo truco que
`KPI_AUTONOMO`). Usa la API de inspección de URLs
(`searchconsole.googleapis.com/v1/urlInspection/index:inspect`) con la misma
cuenta de servicio. Cuota de Google: 2.000 inspecciones/día y 600/min por
propiedad — con ~116 URLs se inspeccionan todas cada día. Lógica en
`scripts/seo/indexacion-google.mjs`; también se lanza a mano con el workflow
**Comprobar indexación en Google** (`indexacion-google.yml`), que deja el
resultado en el resumen del run. Si la API responde 403, el script lo dice
explícitamente: la cuenta tiene acceso "Restringido" y habría que subirla a
"Completo" (el script solo pide `webmasters.readonly`).

**`/login` fuera del sitemap, pero SIN `noindex` (2026-09-28).** `login.html`
es en la práctica la portada pública: `index.html` redirige a `/login.html`
a quien no tiene sesión (Googlebot incluido), y `login.html` lleva el
título/descripción SEO, el vídeo y `<link rel="canonical" href="https://costaviva.org/">`.
Se quitó del sitemap porque listar una URL cuya canónica es otra es una
señal contradictoria para Google. **No añadirle `noindex`**: Google
renderiza `/`, sigue la redirección y vería el `noindex` — podría sacar la
portada del índice. Tampoco tiene efecto de seguridad en ningún sentido: la
protección real del login es Supabase Auth + CAPTCHA + RLS.

**Robot de SEO y diseño (2026-09-28)**, pedido explícito del usuario:
"que el robot optimice la web para que sea atractiva visualmente para el
usuario y sobre todo para el SEO". Es una **rutina en la nube del plan de
Claude** (no gasta saldo de API), martes y viernes, creada por el usuario en
claude.ai/code/routines con el repo conectado; su prompt vive en
`scripts/seo/rutina-seo-diseno.txt` (si se cambia, actualizar ahí también).
Decisión del usuario sobre la autonomía:
- **SEO invisible → directo a `main`**: solo `functions/mareas/**`,
  `sitemap.xml`, `robots.txt` y el `<head>` de `login.html`/`index.html`
  (títulos, descripciones, JSON-LD con datos reales, enlaces internos). Máx.
  3 ficheros / ~100 líneas por pasada, con `node --check`, test de rutas
  públicas y JSON-LD validado. Nunca `noindex` ni canonical nuevo en
  `login.html` (ver "/login fuera del sitemap").
- **Diseño visible → rama `robot/diseno-AAAA-MM-DD-<tema>`**, nunca `main`.
  Las rutinas no pueden abrir PR, así que `robot-diseno-pr.yml` lo abre al
  recibir el push (y si GitHub no deja a Actions crear PR — Settings →
  Actions → General → "Allow GitHub Actions to create and approve pull
  requests" —, abre un Issue con el enlace para crearlo). El usuario lo ve en
  el preview de Cloudflare y decide.
- **Mide con datos reales**: `indexacion-google.yml` corre martes y viernes a
  las 03:23 UTC y deja `SEO_ESTADO.md` (indexación + clics/impresiones/CTR/
  posición por página y búsqueda de 28 días), porque la rutina no llega a
  Search Console. El robot anota en `SEO_ROBOT.md` (historial, se añade al
  final) los números, lo que cambió y qué espera ver la próxima vez.

## Páginas públicas de pesca: /spots y /especies (2026-10-08, pedido de Mikel)

"Costaviva no tiene visibilidad en buscadores": Google solo indexaba 4 URLs.
Detalle y pasos de Search Console/Bing en `SEO.md`.

- **Páginas** (HTML hecho en el servidor, sin JS ni IA): `/spots`,
  `/spots/region/<región>` (las 8 de `/mareas/region/`), `/spots/<spot>`,
  `/especies`, `/especies/<especie>` (id con guion: `bonito-norte`). Código en
  `functions/spots/**`, `functions/especies/**` y `functions/_lib/seo/`
  (`paginas.js` HTML, `datos.js` lógica pura, `indice-hoy.js` condiciones e
  índice de hoy, `carga.js` red, `base.js` plantilla/caché, `sitemap.js`,
  `indexacion.js`). Estilo en `assets/css/publico.css` (tokens Amanecer).
  `/spots/<spot>` va de pesca y `/mareas/<spot>` de marea: se enlazan, cada
  una con su canonical.
- **Índice de hoy en el servidor**: misma cuenta que la ficha
  (`VA.indiceSpot`, modalidad costa, con fondo, batimetría, turbidez y caudal),
  con `/prevision` + `/meteo/*` del spot. Página en Cache API 30 min (1 h las
  fijas); si un dato tarda > 4 s sale sin ese bloque y se guarda 5 min.
- **Nada interno en público**: `TEXTO_INTERNO_PUBLICO` (datos.js) filtra
  notas de especies.json; el test recorre las 158 páginas. Cámaras de
  terceros solo como enlace a su dueño. `RIOS_SPOT` es copia de `RIOS` de
  index.html (el test avisa si se desvía).
- **`sitemap.xml` generado**: `node scripts/seo/generar-sitemap.mjs` (284
  URLs); no editarlo a mano, el test falla si está desfasado.
- **Un solo dominio** (`_lib/seo/indexacion.js`, en `_middleware.js`): GET de
  páginas en `fishnow-59u.pages.dev` → 301 a `costaviva.org` (endpoints y
  POST no se tocan); previews `*.fishnow-59u.pages.dev` con `X-Robots-Tag:
  noindex`; http → https; páginas privadas de la app con noindex y en
  `robots.txt`. **Nunca noindex en `/` ni `/login`** (ver arriba).
- Tests: `test/seo-paginas.test.js` (en tests.yml).
- **Rendimiento (2026-10-08, PageSpeed móvil 87 → objetivo ≥ 95)**: nada
  bloquea el pintado. Sin Google Fonts en ninguna página: letras propias en
  `assets/fonts/` (las mismas woff2 variables de Google, latin + latin-ext con
  sus unicode-range, OFL al lado; caché de un año en `_headers`, así que si
  cambia un fichero, cambia su nombre). La CSP ya no admite
  fonts.googleapis.com ni fonts.gstatic.com. Las páginas públicas llevan el
  CSS **en línea** (`functions/_lib/seo/estilos.js`, GENERADO desde
  `costaviva.css` + `publico.css` por `generar-sitemap.mjs` /
  `generar-estilos.mjs`: si tocas un CSS, regenera o el test falla) y
  precargan los dos "latin" (`FUENTES_PRECARGA` en `base.js`). Ojo con los
  pesos: la app declara rangos (`costaviva.css`, como pedía a Google) y las
  públicas pesos sueltos 400/600/800 y 700/800 (`publico.css`), porque así
  las pedían a Google y un 700 en Manrope se veía a 800; el generador quita
  las `@font-face` de `costaviva.css` al ponerlo en línea. Test
  `test/rendimiento-publico.test.js`. Para que el cambio de letra no mueva
  la página (CLS), `publico.css` trae letras de reserva ("Manrope fallback",
  "Unbounded fallback": Arial/Liberation con `size-adjust` y overrides
  medidos con fontTools, y `unicode-range` = los glifos de cada woff2, para
  que →, ▲ sigan saliendo en system-ui). `/mareas/*` ya iba con estilos en línea
  y letras del sistema: no se tocó.

## IndexNow, imágenes OG, PWA y 404 (2026-10-08, pedido de Mikel)

Detalle y lo que le queda a Mikel en `SEO.md` ("IndexNow y mejoras
gratuitas"). Todo sin IA ni coste.
- **IndexNow** (Bing, Yandex, Seznam, Naver, Yep; Google no):
  `.github/workflows/indexnow.yml` avisa al fusionar en main de las URLs
  afectadas (espera al despliegue) y una vez al día de `/spots/<spot>` y
  `/mareas/<spot>`. Clave pública en `/<clave>.txt` (raíz, lista blanca);
  lógica en `functions/_lib/seo/indexnow.js`, script `scripts/seo/indexnow.mjs`.
  Espera 200/202; otra cosa, run en rojo. Sin pg_cron: los `schedule:`
  diarios sí corren cada día aquí.
- **Imágenes OG** por sección y región en `assets/og/` (sin IA:
  `python3 scripts/seo/generar-imagenes.py`); `documento()` acepta `imagen`.
  Una región nueva necesita su imagen (el test avisa).
- **PWA**: iconos PNG en `assets/iconos/` (192, 512, maskable, apple-touch
  180); `icon.svg` es ya el logo Amanecer.
- **404**: `404.html` (lo genera `generar-sitemap.mjs` desde
  `htmlNoEncontradaGeneral()` de `base.js`) y el middleware da la misma
  página fuera de la lista blanca. Sin 404.html, Pages devolvía la app con 200
  para cualquier fichero inexistente.
- `/.well-known/security.txt` caduca el **2027-10-01** (el test falla).
- `_headers`: caché de 1 día/1 semana para imágenes y de 1 año para
  `assets/fonts/` (nombres fijos: si cambia, nombre nuevo); nunca CSS/JS.
- Tests: `test/seo-extra.test.js` (en tests.yml).

## Observaciones abiertas, concursos y "Comparte tu captura" (2026-10-08, aprobado por Mikel)

"Añade todo lo legal". Sin IA en ejecución. Cuatro piezas:

- **Observaciones abiertas** (`.github/workflows/observaciones.yml`, martes,
  `scripts/observaciones/descargar.mjs` + `lib.mjs`): API de ocurrencias de
  GBIF para nuestras especies en España y Portugal, a ≤ 25 km de un spot,
  solo HUMAN_OBSERVATION/OCCURRENCE/MACHINE_OBSERVATION. **iNaturalist se toma
  de GBIF** (su exportación oficial), no de su API: la API de iNaturalist dice
  "not data scraping" (detalle y citas en `datos-robots/observaciones/LEEME.md`).
  Salida en `datos-robots/observaciones/`: `comercial/` (CC0, CC BY) y
  `no-comercial/` (CC BY-NC, **solo referencia interna: ni en la app ni para
  calibrar el índice**). Coordenadas ocultadas por iNaturalist (p. ej. lubina)
  se guardan a 0,2° y marcadas; nunca se afinan. Condiciones del spot:
  Copernicus (instantánea, ~10 días) y Open-Meteo archive/marine **solo con
  `OPEN_METEO_API_KEY`** (tope 150 llamadas/pasada). Carga histórica: lanzarlo
  a mano con `desde` (p. ej. 2010); si tarda más de 15 min, GBIF pide usar su
  API de descargas (cuenta + DOI).
- **Concursos** (`datos-robots/concursos/`): FEPyC y FPPD reservan todos los
  derechos; `concursos.json` vacío hasta que Mikel tenga permiso escrito. Sin
  nombres de participantes. Lo valida `scripts/observaciones/concursos.mjs`.
- **Rutina de los viernes** (`ROBOT_REGLAS.md`, "Viernes: estudios sobre
  factores de pesca" y "Concursos de pesca"): propone reglas/pesos del índice
  con fuente en `robot/especies-AAAA-MM-DD-factores`; `robot-diseno-pr.yml`
  abre el PR. **El .txt de la rutina cambió: hay que pegarlo en
  claude.ai/code/routines.**
- **Comparte tu captura** (diario): casilla por captura, apagada por defecto
  (`assets/js/compartir-captura.js`). Migración
  `20261008150000_capturas_compartidas.sql` (**sin aplicar**; al aplicarla,
  actualizar `supabase/baseline-seguridad.json`): marca propia en
  `capturas_compartidas`, copia anónima en `capturas_comunidad` (sin usuario,
  celda de ~5 km, RLS sin policies) y solo agregados con ≥ 5 usuarios
  distintos (`comunidad_capturas_por_zona`, `comunidad_capturas_por_condiciones`).
  Retirar = borrar la marca. Sin la migración, el diario no enseña la casilla.
  Texto en `privacidad.html` (nueva, en la lista blanca de rutas).
- Tests: `test/observaciones.test.js` (en `tests.yml`).

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

## Lluvia: radar OPERA de las últimas 3 horas, animado (2026-10-08)

Pedidos de Mikel: el botón **Lluvia** enseña la evolución de las últimas 3 h,
en bucle por defecto, con pausa/play y la hora de Madrid de cada toma (la
última dura más), y **"es imprescindible que sea lo más cercano en tiempo"**:
el panel dice siempre el retraso de la última toma ("hace 6 min"; en rojo si
pasa de 20 min).
- **Fuente principal: radar EUMETNET OPERA** (composición europea DBZH con
  los radares de AEMET, IPMA y Météo-France). Publica una toma cada 5 min,
  ~4-5 min después de su hora: retraso visto en la app 5-10 min. La animación
  usa **una cada 10 min y siempre la última publicada** (decisión de Mikel
  2026-10-08, `submuestrear()`): ~19 tomas en 3 h; el refresco de cada
  minuto mete la nueva al momento.
  Bucket S3 público de 24 h `s3.waw3-1.cloudferro.com/openradar-24h`, sin
  clave ni coste. **Licencia CC BY 4.0** ("EUMETNET ... has decided to
  distribute these products under the CC BY 4.0 license",
  github.com/EUMETNET/openradardata-documentation). Atribución en el mapa.
- **Respaldo: satélite EUMETSAT H SAF H60B** (WMS de EUMETView, CC BY 4.0,
  cada 15 min, ~45 min de retraso) solo donde el radar no llega (mar
  abierto, Canarias, radares caídos: el de A Coruña no daba datos el
  2026-10-08), más tenue y dicho en el panel. Si el radar entero falla, se
  anima solo el satélite.
- **Cómo llega**: el bucket no manda CORS. `functions/lluvia/tomas.js` lista
  las tomas (caché del edge 60 s) y `functions/lluvia/toma.js` lee la cabecera
  del GeoTIFF y reenvía SIN descomprimir las 2 teselas de la vista de 4 km
  que cubren la Península (caché del edge 24 h, inmutable). El navegador las
  descomprime (`DecompressionStream`), reproyecta de Lambert azimutal (lat0
  55, lon0 10) a Mercator y pinta un canvas por toma
  (`assets/js/lluvia-animada.js`). Nada se guarda en Supabase ni en GitHub.
- **Coste**: 0 €. 1 invocación de Functions por toma al abrir la capa y 1 por
  minuto mientras está abierta (unas 20 invocaciones al abrir); ~3,5 MB de
  descarga para las ~19 tomas (luego quedan en la caché del navegador 24 h).
- Descartados: RainViewer (2 h y sin uso comercial), AEMET OpenData (solo la
  última imagen, GIF con mapa de fondo, clave), Météo-France (clave; sus
  radares ya están en OPERA), IPMA (radar "solo informativo"), Rain Alarm
  (app cerrada, sin API).
- Tests: `test/lluvia-animada.test.js` (en `tests.yml`).

## Bug corregido (histórico, ya no se usa RainViewer) — radar de lluvia mostraba "Zoom Level Not Supported" (2026-09-13)

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
una llamada a Open-Meteo hecha desde el propio `index.html` (desde el
2026-10-08, a través del proxy `/meteo/`), igual que ya hacía `diario.html`
para "mi ubicación actual".

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
| `/meteo/forecast`, `/meteo/marine` | `meteo/[api].js` | GET: proxy de Open-Meteo para el navegador, con lista blanca de parámetros, coordenadas a 0,01° y caché en el edge; añade la key comercial si existe `OPEN_METEO_API_KEY`; con los interruptores `FUENTE_*` sirve MET Norway / Copernicus con la misma forma (ver secciones de Open-Meteo y de fuentes gratuitas arriba) | No requiere sesión |
| `/luna` | `luna.js` | Fase y posición lunar por coordenadas (`?lat=&lon=`) | No requiere sesión |
| `/rayos-imagen` | `rayos-imagen.js` | Proxy del mapa de rayos de AEMET | No requiere sesión |
| `/webcam/<slug>` | `webcam/[slug].js` | Proxy de imagen de webcam (evita CORS/hotlinking) | No requiere sesión |
| `/sos-alerta` | `sos-alerta.js` | POST: manda el aviso SOS (email vía Resend) a los contactos de emergencia del usuario que llama | **Requiere** `Authorization: Bearer <token de sesión>` |
| `/geocodificar` | `geocodificar.js` | GET: geocodificación inversa (`?lat=&lon=`) para nombrar ubicaciones personalizadas, vía Nominatim | No requiere sesión |
| `/notificar-altas` | `notificar-altas.js` | POST: avisa al admin por email de altas activadas (email confirmado) y de altas sin confirmar tras 48h — sustituye a `aviso-alta.js` (eliminado 2026-09-17) | Sin sesión de usuario — protegido con secreto compartido (`X-Cron-Secret` / `CRON_SECRET`, mismo que `/registrar-presion`) |
| `/registrar-presion` | `registrar-presion.js` | POST: guarda la presión real de cada spot en `presion_historico` (Fase 4) | Sin sesión de usuario — protegido con secreto compartido (`X-Cron-Secret` / `CRON_SECRET`) |
| `/crear-checkout-stripe` | `crear-checkout-stripe.js` | POST: crea una Stripe Checkout Session (suscripción mensual/anual, con prueba) para el usuario que llama | **Requiere** `Authorization: Bearer <token de sesión>` |
| `/crear-portal-stripe` | `crear-portal-stripe.js` | POST: crea una sesión del Billing Portal de Stripe para gestionar/cancelar la suscripción propia | **Requiere** `Authorization: Bearer <token de sesión>` |
| `/admin-invitaciones` | `admin-invitaciones.js` | GET/POST: lista, crea (cupón de Stripe + email), reenvía y anula invitaciones | **Admin**: token + `es_admin()` comprobados en el servidor antes de `service_role` |
| `/canjear-invitacion` | `canjear-invitacion.js` | POST: canjea un código de invitación para el email de la sesión, una sola vez | **Requiere** `Authorization: Bearer <token de sesión>` |
| `/stripe-webhook` | `stripe-webhook.js` | POST: recibe eventos de Stripe (checkout/suscripción/`invoice.payment_failed`) y actualiza `suscripciones`; idempotente por `event.id` (tabla `stripe_eventos`, 2026-10-07) | Sin sesión — verifica la firma `Stripe-Signature` con `STRIPE_WEBHOOK_SECRET` |

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

**Índice de pesca**: desde el 2026-10-08 es el índice v2 (ver "Índice de
pesca v2" más abajo): la puntuación de la mejor especie de temporada de la
pestaña en la hora actual. Hereda la vigencia por spot del punto anterior
(sin datos de la última hora, S/D).

## Fichas de especies y ventana de actividad (2026-10-07, aprobado por Mikel)

- **`assets/datos/especies.json`**: ficha versionada de cada especie para toda
  España y Portugal (nombres es/eu/gl/ca/pt, científico, hábitat, profundidad,
  presencia por región, freza por región, actividad, temperatura, alimentación,
  tallas mínimas y vedas por jurisdicción, cebos típicos) con **fuente por campo** (ids de la
  tabla `fuentes`, cada una con licencia y fecha) y la lista `pendiente` de lo
  que falta. `jurisdicciones` dice qué normativa está revisada y cuál no (UE,
  Estado, cada comunidad autónoma, Portugal, Azores, Madeira). Vive en
  `/assets/` porque esa carpeta ya es pública en la lista blanca (W2 de comun
  prohíbe meter `data/` en ella).
- **Regla de fuentes**: nunca inventar (null + nota); solo fuentes oficiales o
  abiertas no-NC. **FishBase es CC BY-NC y Costaviva es comercial**: no se añaden
  datos de FishBase; los que ya había en `ESPECIES*` de `index.html` siguen ahí
  marcados con `fuentePendiente` y listados en `fishbase_pendientes`, y en la
  ventana de actividad un rango de temperatura de FishBase **no puntúa**
  (`excluir_del_calculo`). Tampoco FAO (CC BY-NC-SA) ni contenido de apps
  competidoras (Fizk).
- **`assets/js/ventana-actividad.js`**: módulo ES puro (sin DOM ni red, con
  tests en `test/ventana-actividad.test.js`). Puntuación por hora con la
  escala logística v2 (`100·σ(Σ peso_lo × valor)`, ver "Índice de pesca v2"),
  con un motivo y su aporte en puntos por cada factor (luz con
  amanecer/anochecer calculados, marea, temperatura del agua, oleaje, viento,
  tendencia de presión ±1 hPa/3 h, turbidez). Los pesos están en el JSON
  (`reglas_por_defecto` + `reglas` por especie) con `criterio`/`fuente` y
  `tipo: heuristica_experta` cuando lo son. **La marea se escala con el rango
  local** (máx-mín en ±12 h del nivel del mar del propio spot frente a 2,5 m):
  en el Mediterráneo no cuenta. Mar > 2,5 m: aviso de ola peligrosa aparte,
  sin tope (ver "Ola peligrosa: aviso aparte"). Luna: peso 0.
- **UI**: tarjeta "Ventana de actividad por horas" del panel del spot
  (`pintarVentanaActividad` en `index.html`): selector de especie (las que
  tienen presencia en la región del spot, en temporada primero), Hoy/Mañana,
  tira de 24 horas, el porqué de la hora tocada, mejores ventanas, aviso de
  freza y talla mínima con enlace oficial. Los datos horarios se piden a
  Open-Meteo **desde el navegador** al abrir el panel (caché 1 h por spot, con
  el factor de oleaje de Gipuzkoa), sin tocar `/prevision`. Sin `on*=`: todo
  con `addEventListener`.
- **Mantenimiento**: la pasada de los jueves de la rutina del buscador de
  fuentes (`scripts/saldo/rutina-buscador-fuentes.txt`, sección "Fichas de
  especies" de `ROBOT_REGLAS.md`) sube cambios a `robot/especies-AAAA-MM-DD` y
  `robot-diseno-pr.yml` abre el PR. **Si cambias el .txt, hay que pegar el
  texto nuevo en la rutina de claude.ai/code/routines.**
- **Fuente única de especies (2026-10-08)**: las listas `ESPECIES`,
  `ESPECIES_MEDITERRANEO`, `ESPECIES_GOLFO_CADIZ` y `ESPECIES_CANARIAS` se
  retiraron de `index.html`, junto con la tarjeta "¿Qué esperamos pescar hoy?".
  Ahora todo lee `especies.json`:
  - **Índice de pesca** (`pintarIndicePesca` en `index.html`): desde el
    2026-10-08, índice v2 (sección propia más abajo). El ratio de especies con
    el agua en su rango × 70 + presión quedó retirado. El JSON se pide al cargar
    la página.
  - **Post de Instagram de los miércoles** (`scripts/marketing/especie-post.mjs`):
    región según la última zona de `rotacion-zonas.json` (por defecto Cantábrico;
    `REGION_POST` la fuerza), prioriza especies con temporada verificada, nunca
    una en veda, y el texto se compone con temporada + fuente, actividad,
    alimentación, cebos, freza y talla. Ya no publica las notas antiguas (algunas
    citaban FishBase).
  - **Vedas**: `vedas[].meses` + `regiones` en el JSON. El abadejo lleva la veda
    recreativa 1 ene–30 abr (Reg. (UE) 2025/202 según ICES), pendiente de
    verificar para 2026 (Reg. (UE) 2026/249): no aparece como de temporada, ni en
    el índice ni en los posts, y la ventana de actividad muestra "En veda" sin
    recomendar horas.
  - Lo que tenía la lista antigua y no tiene el JSON: la división costa/mar
    adentro (solo la usaba la tarjeta retirada) y las notas largas (sustituidas
    por campos con fuente). `diario.html` sigue con su propia `ESPECIES` (solo
    nombre + científico para el desplegable de capturas): es otra cosa y no se toca.
- **Modalidades de pesca (2026-10-08, pedido de Mikel)**: "debemos separar
  pesca de costa de pesca de embarcación o submarinismo; no se pesca lo mismo"
  y "no tiene sentido poner Mundaka y que me aparezca bonito". El panel del
  spot tiene tres pestañas accesibles (`role=tablist`, flechas/Inicio/Fin)
  encima del índice de pesca: **Desde costa**, **Embarcación** y
  **Submarina**. Abre la del tipo del punto propio (embarcación/buceo), si no
  la última elegida (`localStorage.va_modalidad`, solo comodidad), si no
  costa. La pestaña filtra el desplegable de especies de la ventana de
  actividad, las especies del índice de pesca, los cebos (submarina: sin
  cebos) y la normativa; el post de Instagram es de costa por defecto
  (`MODALIDAD_POST` lo cambia) y nunca saca una especie de mar adentro.
  - Datos: `modalidades` por especie en `especies.json` (muchos-a-muchos:
    lubina en las tres, bonito solo embarcación; `aplica: null` = sin dato, no
    se muestra). Recupera la división costa/mar adentro que tenía la lista
    antigua de `index.html` (fuente `app_index_zona`), con matices (txitxarro y
    verdel también desde espigón). `reglas_por_modalidad`: costa = lo de
    siempre; embarcación = viento > 20 km/h y ola > 1 m restan, aviso para kayak
    (> 20 km/h o > 1,5 m) y para embarcación pequeña (> 30 km/h o > 2,5 m),
    con tope 35 / 15 **solo si lo supera el viento** (la ola solo avisa desde
    el 2026-10-08), marea peso 4; submarina = turbidez peso 20 (clara
    suma, turbia resta), mar en calma (óptimo < 0,5 m, > 1,5 m aviso de ola
    peligrosa, sin tope), lluvia
    de las 24 h previas y caudal alto del río del spot restan, y **de noche
    puntúa 0** (prohibida: RD 347/2011 art. 16.d, Portaria 14/2014 art. 8.3).
    En las modalidades distintas de costa, oleaje/viento/turbidez (y marea en
    submarina) los fija la modalidad, no la especie.
  - Normativa: `normativa_modalidades` con artículo, url y fecha (RD 347/2011,
    Gobierno Vasco, Portaria 14/2014 y FAQ DGRM 2026) y `pendiente` por
    jurisdicción; tarjeta "Normativa de esta modalidad" del panel.
  - Diario: la modalidad ya se guarda por salida (`salidas_pesca.tipo_salida`);
    solo se añadieron técnicas de submarina (espera/agachón/rececho) al
    desplegable de técnica (texto libre: sin migración).
  - La ventana pide además `precipitation` horaria a Open-Meteo (para la
    lluvia previa de la submarina). Tests: `test/modalidades.test.js` (en
    `tests.yml`).
- **25 especies más (2026-10-08, pedido de Mikel: "¿y el resto de especies?
  rodaballo, cabracho…")**: rodaballo, rémol, cabracho, rascacio, maragota,
  besugo, aligote, mero, gallo, raya, merluza, rape, chopa, mojarra, herrera,
  raspallón, oblada, sargo picudo, pez limón, bacoreta, atún rojo, llampuga,
  abade, anjova y pintarroja (53 en total). Tallas del RD 560/1995, Reg. (UE)
  2019/1241 y la tabla DGRM; nombres del anexo I del RD 347/2011, la DGRM y la
  guía de especies objetivo de la Generalitat (`gencat_guia_pr_2021`, licencia
  por confirmar). Presencia por región: la especie figura en la tabla de tallas
  de ese caladero, en la guía catalana (Mediterráneo) o tiene 20 o más
  registros de 2 o más conjuntos CC BY/CC0 en OBIS (`obis_cc_by`); los meses
  son heurísticos (residentes: todo el año). Normas: atún rojo solo captura y
  suelta (RD 46/2019 art. 7; Euskadi y Portugal lo prohíben) → veda todo el
  año, nunca de temporada; besugo, merluza y llampuga necesitan autorización
  (anexo II RD 347/2011); mero y rayas mosaica/bramante prohibidos en
  Portugal; el mero no sale en submarina hasta verificar cada comunidad.
  Datos de campo de Mikel en Bizkaia (`mikel_campo_bizkaia`, confianza
  media): rodaballo desde playa oct-dic, mejor con mareas
  vivas (coeficientes altos, no oleaje: la regla de coeficiente la pone el
  motor del índice); rayas y pintarroja desde costa nov-ene (Armintza); pargo
  (`bocinegro`), dorada y dentón en verano a unos 20 m y en invierno más
  profundo (`modalidades.embarcacion.profundidad_temporada`, consejo en la
  pestaña Embarcación con `consejoProfundidad`). La anjova entra en
  `@depredadores_costeros`.
- **Presencia por región: criterios A/B/C (2026-10-08)** (descritos en la
  fuente `obis_cc_by` del JSON). A: OBIS con 20 o más registros de 2 o más
  conjuntos CC BY/CC0. B: talla en la tabla oficial del caladero + al menos 1
  registro libre en OBIS. C: publicación regional (guía oficial, estudio CC BY,
  observación de Mikel) o un conjunto científico CC BY/CC0 con 20 o más
  registros. Con B se completaron especies antiguas (pargo/`bocinegro` en
  Cantábrico, Mediterráneo, Canarias, Portugal y Azores; dorada, salmonete,
  pulpo, lenguado…); maragota en Galicia (estudio IIM-CSIC, CC BY) y oblada
  en Canarias (CC0). **No se usan los rangos de FishBase ni de la Lista Roja
  de la UICN** aunque se pidan: sus condiciones prohíben el uso comercial.
  Pulpo en el Mediterráneo peninsular queda fuera a propósito: la pesca
  recreativa del pulpo en aguas exteriores del Mediterráneo andaluz está
  prohibida (Orden APA/973/2002, según la guía catalana; sin leer en el BOE).
- **Ojo, Open-Meteo**: la API gratuita es solo para uso no comercial; toda la
  app (no solo esto) la usa. Pendiente de decidir con Mikel (plan comercial de
  Open-Meteo o alternativa).

## Tipo de fondo y orilla (2026-10-08, aprobado por Mikel)

Pedido de Mikel: saber el tipo de fondo de cada spot, sobre todo los primeros
~50 m desde la costa, usarlo **solo** desde costa y en submarina, y verlo como
capa del mapa al acercarse. Después pidió que la capa llegue "a mayor
profundidad, hasta donde tengamos": cubre plataforma y talud, no solo la
franja costera. Sin IA y sin coste.

- **Datos por spot** (`assets/datos/tipo-fondo.json`, ~30 KB, lo genera a mano
  `scripts/fondo/tipo-fondo.mjs`, Node sin dependencias; ver su cabecera):
  punto de costa más cercano al spot sobre `natural=coastline` de OSM; tipo de
  orilla a 50 m o menos de ese punto (`acantilado`, `roca`, `escollera`,
  `playa_arena`, `playa_cantos`, `playa` = playa de OSM sin superficie,
  `puerto`); fondo a 500 m y 1 km (fracciones de roca, arena, grava, fango,
  Posidonia, pradera, biogénico y `algas` = roca infralitoral) muestreando cada
  50 m EUSeaMap 2025 (EUNIS 2019, WFS de EMODnet) y las praderas de EMODnet;
  `cobertura` y `primer_dato_m` (a qué distancia de la orilla empieza el dato).
  Se re-ejecuta si cambian los spots (`--solo slug1,slug2` fusiona; `--punto
  "Nombre,lat,lon"` imprime un punto sin guardar). Overpass público: la
  principal (overpass-api.de) no respondía desde la nube el 2026-10-08; se usó
  la réplica `OVERPASS_URL=https://maps.mail.ru/osm/tools/overpass/api/interpreter`
  (da 504 a ratos: el script reintenta).
- **Licencias (verificadas el 2026-10-08)**:
  - OSM: "You are free to copy, distribute, transmit and adapt our data, as long
    as you credit OpenStreetMap and its contributors. If you alter or build upon
    our data, you may distribute the result only under the same license."
    (https://www.openstreetmap.org/copyright). `tipo-fondo.json` es base de
    datos derivada: queda bajo ODbL 1.0 (lo dice el propio JSON).
  - EUSeaMap 2025 (EMODnet Seabed Habitats): "Available under the Creative
    Commons Attribution (CC-BY) License v4.0 ... Credit: Licensed under CC-BY 4.0
    from the European Marine Observation and Data Network (EMODnet) Seabed
    Habitats initiative (https://emodnet.ec.europa.eu/en/seabed-habitats), funded
    by the European Commission." (metadatos ICES/EMODnet 4c810e39... y
    cec07b5e...). Praderas (Seagrass EOV 2025): el subconjunto europeo es CC BY
    4.0 (el del Caribe es CC BY-NC: no se usa).
  - EMODnet Geology (sustrato multiescala, Folk): "Creative Commons BY 4.0"
    (metadatos europe-geology.eu). No se pide directamente: EUSeaMap ya lo
    integra.
  - MITECO Ecocartografías (1:1 000-1:5 000, roca/arena/Posidonia): el aviso
    legal de MITECO permite reutilizar "sin necesidad de autorización expresa
    ... siempre que se cite la fuente" (Ley 37/2007), pero solo hay KMZ por
    provincia (Mediterráneo, Andalucía, Baleares, Canarias; nada del
    Cantábrico) y no se encontró un WMS verificable (wms.mapama.gob.es no
    respondía con TLS válido desde la nube). **No integrado**; candidato para
    el detalle de Posidonia en el Mediterráneo.
- **Calidad cerca de la orilla**: EUSeaMap es un modelo de escala amplia
  (celdas de ~100 m junto a la costa); los primeros 50-100 m casi nunca
  están resueltos (`primer_dato_m` típico 50-300 m) y en puertos y estuarios
  puede no haber dato. Para la orilla manda OSM. Orientativo, nunca para
  navegar.
- **Índice** (`especies.json`, 5 reglas nuevas al principio de
  `reglas_expertas.reglas`, todas `por_validar`, confianza 0,5-0,55, nunca en
  embarcación): `orilla_roca_espuma` (costa, orilla de acantilado/roca/escollera:
  lubina, sargo, sargo picudo, maragota, pulpo, congrio, cabracho, rascacio;
  la mitad con mar plana, entera de 1,5 a 2,5 m y se apaga hasta 0 a 3 m
con `efecto.atenua`: con mar grande se apartan), `orilla_playa_arena` (costa,
  playa: rodaballo, lenguado, raya; `mikel_campo_bizkaia`),
  `dorada_arena_con_roca` (costa y submarina, arena ≥ 30 % y roca ≥ 10 %),
  `fondo_roca_submarina` (submarina, roca ≥ 35 %, graduada) y `posidonia_cerca`
  (Mediterráneo y Baleares, costa y submarina, Posidonia ≥ 15 %: sepia, dorada,
  salema/salpa). Variables de contexto nuevas: `orilla_tipo`, `fondo_roca`,
  `fondo_arena`, `fondo_fango`, `fondo_grava`, `posidonia`, `algas`
  (`contexto.fondo` de `calcularVentana`; en embarcación el motor las pone a
  null aunque lleguen). Fuentes nuevas: `cheminee_2021_nurseries` y
  `marco_mendez_2016_salpa` (CC BY 4.0), `emodnet_euseamap_2025`, `osm_orilla`.
- **Ficha del spot**: línea `panelFondo` bajo las coordenadas, "Fondo: roca y
  arena · orilla de acantilado" (`textoFondo`, sin números). Punto propio: el
  dato del spot fijo a 1,5 km o menos; si no hay, se pregunta en vivo a
  EMODnet el sustrato del propio punto (GetFeatureInfo, sin orilla).
- **Capa "Tipo de fondo"** ("Tipo de fondo" en el selector del botón único
  "Fondo", ver "Botón único Fondo" en la sección de Batimetría): WMS `eusm_subs_group` de EMODnet Seabed Habitats (el
  grupo cambia solo de simplificación según la escala: costa, plataforma y
  talud), opacidad 0,6, desde zoom 7, leyenda propia (roca, arena, grava,
  fango, Posidonia, sin clasificar) y atribución CC BY. La CSP ya admite
  `https:` en img-src y connect-src: no hubo que tocarla.
- Tests: `test/tipo-fondo.test.js` (en `tests.yml`).

## Índice de pesca v2: escala logística y reglas expertas (2026-10-08, aprobado por Mikel)

**Fórmula** (`assets/js/ventana-actividad.js`, `INDICE_VERSION =
"v2-logistica-2026-10-08"`): `P = 100·σ(b0 + Σ peso_lo·f)`, `f ∈ [-1, 1]`,
`b0 = 0` (`especies.json.indice`). Los pesos están en log-odds (`peso_lo` =
puntos antiguos / 25; cerca de 50 un factor aporta casi lo mismo que antes:
los tests comparan con la v1 y no se mueve más de 8 puntos). El porqué sigue
en puntos: `P - 50` se reparte en proporción al log-odds de cada factor
(`repartirAportes`), así que 50 + la suma de los aportes da la puntuación.
Temperatura del agua: gaussiana alrededor del centro del rango (σ = media
anchura; +1 en el centro, ~+0,2 en los bordes, tiende a -1). Rangos solo de
FishBase siguen sin puntuar.

**Filtros fuera de la fórmula**: veda (la especie no entra), freza (aviso
"si lo pescas, devuélvelo", nunca suma), tope por viento en embarcación
(kayak 35 / embarcación pequeña 15; se aplica al final y sale como un motivo
"tope de seguridad"), submarina de noche = 0, datos caducados = S/D
(`spotVigente`).

**Ola peligrosa: aviso aparte, sin tope (decisión de Mikel, 2026-10-08).**
Antes la altura de ola recortaba la nota ("tope de seguridad (mar de 2,5-3 m,
peligrosa desde costa: máximo 20)"). Ahora la nota se calcula sin ese tope (el
factor de oleaje sigue puntuando como siempre) y el resultado lleva
`avisoOla` (`avisoOlaPeligrosa` en `ventana-actividad.js`): "⚠️ Ola peligrosa
desde costa (2,5-3 m): extrema la precaución". **No es un motivo con
flecha**: se pinta como nota aparte con la clase `.aviso-ola` de
`costaviva.css` (tokens `--peligro-*`). Umbral = `oleaje.max_seguro_m` de la
modalidad, estrictamente por encima: costa 2,5 m ("desde costa"), embarcación
2,5 m ("para salir en embarcación de recreo"), submarina 1,5 m ("para
bucear"); `tope_si_peligrosa` desapareció del JSON. Dónde sale: índice del
spot (encima de los motivos), ventana (franja con las horas con aviso, el
detalle de la hora y "⚠️ ola peligrosa" en las mejores ventanas), diario
(`indice_factores.aviso_ola`) y piezas de Instagram (`resumenDelDia().avisoOla`,
en la plantilla y en el texto del post y del reel). En embarcación, los
avisos de kayak / embarcación pequeña siguen saliendo también por ola, pero su
tope solo lo pone el viento. Desde costa, en los depredadores costeros el
factor de oleaje lo sustituyen las reglas de mar plana/poca/movida (hasta
2,5 m); por encima, `mar_grande_depredadores` ("mar demasiado grande: se
apartan de la orilla", `tipo: cientifica`, Bacheler 2019, Udyawer 2013 y la
flota de lubina 2022; casi 0 justo por encima de 2,5 m y en línea recta hasta
-1,6 log-odds a 4 m) cierra el hueco que dejó quitar el tope, y "mar algo
movida" se apaga entre 2,2 y 2,5 m: la nota baja sin escalones (test de
continuidad de 2,0 a 4,0 m, pasos de 0,1, ninguno de más de 8 puntos). Dorada
de la captura de prueba (Bakio): 78 / 72 / 70 / 57 / 34 a 2,0 / 2,5 / 2,6 /
3,1 / 4,0 m (con tope daba 72 a 3,1 m). En embarcación y submarina ninguna
regla sustituye al oleaje, así que no hay hueco (un test lo vigila).

**Índice del spot** (`indiceSpot`): la mejor especie de temporada (sin vedas)
de la pestaña en la hora actual, con su nombre y su porqué; es exactamente la
puntuación de la ventana de esa especie. Sustituye al antiguo "ratio de
especies con agua en rango × 70 + presión" (que daba 85-95 casi siempre en el
Cantábrico en otoño; el v2 da ~70 con un día normal).

**Fiabilidad** (`fiabilidad`): ★ solo criterio experto (lo normal hoy); ★★ si
más de la mitad del log-odds viene de factores con mecanismo científico u
oficial citado (regla `tipo: cientifica/oficial` o rango de temperatura
verificado con fuente propia); ★★★ validado con el diario y ★★★★ temporada
confirmada con desembarcos, marcados a mano en
`validacion_fiabilidad.por_combinacion["especie|modalidad|region"]`. Rebajas:
previsión a más de 48 h (-1), menos del 60 % del peso con dato (-1), modelo y
no medido (-0,5); nunca baja de ★, pero las rebajas se dicen en el texto. **El usuario no ve
la fiabilidad** (decisión de Mikel, 2026-10-08): se calcula, se guarda en
`indice_factores` y solo sale en el desplegable "Detalle (admin)".

**Datos**: la ventana y el índice piden a `/meteo/forecast` 5 días hacia
atrás (`past_days=5`, para tendencias y retardos de las reglas) y la dirección
del viento; una sola petición compartida por índice y ventana (la caché por
spot guarda la promesa).

### Reglas expertas (`reglas_expertas` en `especies.json`)

Conocimiento local convertido en datos; el motor genérico
(`assets/js/reglas-expertas.js`) las aplica sin tocar código. Cada regla suma
`efecto.logodds × intensidad × confianza` como un factor más, con su texto.
**Cada variable cuenta una sola vez por hora** (feedback de Mikel en la
preview: salían "+ mar algo movida" y "− mar de 2-2,5 m" a la vez): cada regla
declara su `variable`; si es la de un factor base, lo sustituye
(`sustituye`), y las reglas de una misma variable tienen condiciones
excluyentes (las de presión: 6 h si cae ahora, 24 h solo si las últimas 6 h
están quietas, subida tras el frente). El aviso de ola peligrosa va aparte y
sale aunque el factor esté sustituido. Un test recorre especies,
modalidades y escenarios y falla si una variable puntúa dos veces.
**Presentación (decisión de Mikel, 2026-10-08)**: la nota y una lista de
motivos, cada uno con una flecha por dirección y peso (▲▲ / ▲ / ▼ / ▼▼, el
doble desde 6 puntos) y el concepto en lenguaje llano, ordenados por impacto.
Para el usuario, ningún número por factor (ni en tooltip) ni etiqueta de
fuente ("regla de Mikel", "por validar"...).
**Solo motivos con flecha y avisos útiles (Mikel, 2026-10-08)**: lo neutro
(aporte 0, antes con "·": "pleno día", "marea casi nula: no cuenta", "agua a
20 °C (rango pendiente de fuente abierta: no cuenta)"), lo interno y la
fiabilidad van solo al "Detalle (admin)". El filtro es `paraUsuario`
(`ventana-actividad.js`, regex `TEXTO_INTERNO`), y lo usan la ficha, la
ventana, las mejores ventanas, el diario (misma regex en línea) y los posts
(`motivosDestacados`). Avisos útiles = notas `legal` (submarina) y
`seguridad` (kayak / embarcación pequeña), con la clase `.aviso-nota`; el de
ola peligrosa va en `avisoOla`. También para admin: "Técnicas habituales
(práctica, sin fuente citable)", "Talla mínima: sin dato verificado" y
"Pendiente de revisar" de la normativa. Un test de `indice-pesca-v2` falla
si la salida de usuario tiene "·", "pendiente", "no cuenta" o "fuente". La presentación es igual en la ventana, el índice
del spot y la línea del diario. El admin (`window.esAdminCostaviva`,
cosmético) tiene un desplegable "Detalle (admin)" con puntos, fuente, estado,
confianza y la fiabilidad; la tabla de `admin.html` sigue listando las reglas.
Hoy hay 18 reglas (más las de fondo y orilla y `mar_grande_depredadores`,
ver arriba): 11 de Mikel (fuente `mikel_experiencia_local`, tipo
`heuristica_experta_local`, estado `por_validar`; los umbrales son la
traducción de Claude de lo que contó Mikel; y 2 que completan la escala de
ola de los depredadores costeros con la heurística que ya tenía la app,
`mar_poca_` 0,5-1 m y `mar_plana_` < 0,5 m; y 5 científicas, `tipo:
cientifica`, del top 10 de evidencia que aprobó Mikel, ver más abajo):
1. Presión bajando en 6 h (graduada, de -1 a -4 hPa) y en 24 h (≤ -4 hPa):
   suma a los depredadores costeros (`@depredadores_costeros`: lubina, sargo,
   dorada, corvina, dentón, palometa, bicuda, medregal, urta); subiendo tras
   el frente, resta un poco. Sustituyen a la tendencia de 3 h por defecto en
   esas especies (`sustituye: ["presion"]`).
2. Mar algo movida (1-2,5 m) desde costa: suma a esos depredadores y
   sustituye al factor de oleaje (con las dos reglas de escala de arriba);
   por encima de 2,5 m sale el aviso de ola peligrosa (sin tope).
3. Río crecido (caudal "alto" con umbral oficial) a ≤ 3 km de la
   desembocadura: suma a la lubina y resta al resto (salvo la lisa). Río del
   spot = `RIOS[].spotCosta` de `index.html` (`rioDeSpot`); spot sin río
   asociado o río sin caudal real (los vascos) = sin dato, no aplica.
4. Levante en el Cantábrico (al menos media ventana de 6 h con viento del
   sector 33,75°-146,25° = NE..SE, y 8 km/h o más de media): resta.
5. Bonito (embarcación, Cantábrico, junio-septiembre): al menos el 25 % de
   las horas de hace 5 a hace 1 día con viento WSW-NW de 25 km/h o más suma
   un poco (confianza 0,3), **solo si el viento ya ha calmado** (media de
   las últimas 12 h < 20 km/h; evidencia: la mar agitada baja las capturas).
6. Congrio con luna llena (`congrio_luna_llena`, observación de campo de
   Mikel): de noche, con la luna iluminada al 80 % o más, resta (más cuanto
   más llena; costa y embarcación).
7. Mareas vivas (`coeficientes_altos`, coeficiente ≥ 90, solo desde costa,
   nunca en embarcación): suma a todas las especies; refuerzo
   `rodaballo_mareas_vivas_otono` para el rodaballo de playa de octubre a
   diciembre (Bakio). Es la amplitud de la marea, no el oleaje. El
   rodaballo entró como especie 29 con solo lo que contó Mikel (Cantábrico,
   costa, octubre-diciembre); talla, nombres y demás, pendientes de fuente.

**Evidencia científica aprobada (2026-10-08)**: de
`datos-robots/evidencia/EVIDENCIA_FACTORES.md` y
`especies.json → propuestas_evidencia`, Mikel aprobó el top 10 (más la mitad
de peso de la presión por defecto). Activo: `rio_crecido_cefalopodos`
(-1,0; pulpo, sepia y calamar salen de la regla general del río, y también
la dorada), `lluvia_fuerte_pulpo`, `enfriamiento_brusco_agua`,
`bonito_mar_agitada_previa`, `lubina_noche_invierno`; confianza de las 3 de
presión 0,4/0,35/0,3 y `reglas_por_defecto.presion.peso_lo` 0,12; bonito
16-18 °C y pulpo 16-21 °C. Lo activado queda anotado en
`propuestas_evidencia.activadas`; el resto (lisa, levante a 0,5, luna del
calamar y del congrio en cuartos, sepia) sigue sin activar.

La página de admin (`admin.html`) lista las reglas con su ámbito,
condiciones, efecto, fuente, estado y cualquier error de forma.

### Cómo añadir una regla experta

1. Añade un objeto a `reglas_expertas.reglas` de `assets/datos/especies.json`
   (el formato completo está en `reglas_expertas.formato` del propio JSON):
   `id` único, `nombre`, `texto` (lo que verá el usuario), `fuente` (un id de
   `fuentes`; si es nueva, añádela con `licencia` y `fecha_consulta`), `tipo`,
   `confianza` (0-1), `estado: "por_validar"`, `validacion`, `ambito`
   (regiones, modalidades, especies o `@grupo`, especies_excluidas, meses),
   `condiciones` (todas deben cumplirse), `efecto.logodds` (±2 como mucho;
   0,4 ≈ 10 puntos; `escala` lo gradúa y `atenua: { var, de, a }` lo apaga de
   forma continua, 1 en `a` y 0 en `de`), `variable` (la que puntúa; `nombre@etiqueta` si mira
   otra ventana de tiempo) y, si es la de un factor base, `sustituye`. Dos
   reglas de la misma variable deben ser excluyentes.
2. Condiciones: `{ "var": "presion", "agregado": "delta", "desde_h": -6,
   "hasta_h": 0, "op": "<=", "valor": -1 }`. Variables horarias: ola, viento,
   viento_dir, presion, temp_agua, lluvia, nivel_mar; de contexto:
   caudal_rio, rio_desembocadura_km, turbidez, mes, hora_local, luz,
   luna (fracción iluminada 0-1, `iluminacionLunar`) y coeficiente_marea
   (20-120, `coeficienteMareaAstronomico`, ajustado a los coeficientes
   reales de CALIBRACION.jsonl). Las dos se calculan en el motor, sin red.
   Y de batimetría (EMODnet, ver "Batimetría"): profundidad, prof_max_5km y
   dist_fondo_10_30m_km. Y de 〰 Frentes (solo hoy; ver "〰 Frentes en el
   índice"): frente_km, frente_clorofila_km, clorofila_nivel y corriente_ms.
   Agregados: media, min, max, suma, delta, fraccion (con `cumple`).
   Operadores: `<`, `<=`, `>`, `>=`, `==`, `!=`, `en`, `entre`, `sector`.
   Ventanas hacia atrás de hasta 5 días (120 h): es lo que trae la serie.
3. Sin dato (menos del 60 % de horas, río desconocido...) la regla no
   aplica: nunca se inventa.
4. `node --test test/indice-pesca-v2.test.js` valida la forma de todas las
   reglas (`validarRegla`); añade un test con un caso real si la regla es
   nueva. Para retirarla sin borrarla: `estado: "retirada"`.
5. La calibración con el diario es automática desde el 2026-10-09 (ver
   "Aprendizaje autónomo del índice"): una regla nueva y dudosa entra mejor
   como retador en `aprendizaje/retadores/` (en la sombra) que directamente.

### Fase 0: condiciones de las salidas del diario por su fecha

`assets/js/condiciones-salida.js` (puro, con tests). Una entrada retroactiva
guardaba datos de HOY en cuatro casos: sin hora de inicio usaba la hora de
ahora (y la serie de mar de ±8 días sí la contiene), la boya de embarcación
era la de ahora, `/luna` siempre es la de hoy y 23:40 caía en las 00 del
mismo día. Ahora la hora sale siempre de la fecha (mediodía si no hay hora,
marcado `hora_estimada`), boya y `/luna` solo para salidas de hoy (si no, luna
calculada para la fecha), y fuera del alcance de Open-Meteo (más de 90 días
atrás o más de 15 adelante) las condiciones quedan a null con
`condiciones_estado` (`sin_dato_fecha_antigua`, `sin_prevision_fecha_lejana`).
Las ventanas (atmósfera de fecha-5 a fecha+1; mar ±8 días) caben en el proxy
(≤ 31 días). Cuando exista el histórico ERA5 de la rama de fuentes gratuitas,
el modo "antigua" podrá usarlo. Además se rellenan `presion_tendencia` y
`viento_dir`, que nunca se guardaban.

Cada salida guarda el índice v2 a su hora (`indice_version`,
`indice_puntuacion`, `indice_especie`, `indice_factores` con cada factor y
regla, la fiabilidad y el ranking de especies) para calibrar.
**Migración `20261008120000_indice_pesca_salida.sql`: aplicada en producción** (confirmado el 2026-10-09). `guardarSalida` sigue reintentando sin esas columnas si PostgREST responde PGRST204 (inofensivo).

## Aprendizaje autónomo del índice (2026-10-09, pedido de Mikel)

Mikel: que los algoritmos aprendan solos de los resultados, propongan ideas,
afinen lo conocido y solo le pregunten sí/no una vez por semana ("meros
opinadores de las ideas, frente a generadores netos"). Contrato común de las
4 apps: `Mikel1972/comun`, `estandares/aprendizaje.md` (aquí se cumple tal
cual: `aprendizaje/senales.json`, `propuestas.json` como LISTA con `id`
estable sin fecha, `decisiones.json` con `propuesta_id`, `RESUMEN.md`). Mikel
decide en el Issue semanal de comun; `registrar-decisiones.yml` de comun (o
su rutina, o una sesión) copia cada sí/no a `aprendizaje/decisiones.json`.

**Piezas (todas sin IA salvo la rutina, que va contra el plan):**
- `scripts/aprendizaje/` (puro salvo `datos.mjs`; tests en
  `test/aprendizaje.test.js`, en tests.yml):
  - `casos.mjs`: salidas terminadas del diario → casos (índice guardado en
    `indice_factores`, ¿se pescó algo?, qué especies). Fuera cuentas de
    prueba, salidas en curso y condiciones `error`/antiguas.
  - `rejugar.mjs`: rehace el índice de un caso. Con la serie de su día
    (Open-Meteo con `OPEN_METEO_API_KEY`; sin key no se pide nada, el plan
    gratis es no comercial) pasa por `indiceSpot()` con el especies.json que
    sea; sin serie, rejuega los términos guardados (multiplicar el término de
    una regla = cambiar su confianza: un test lo comprueba contra el motor).
    Retadores: `aplicarRetador()` (ops `anadir_regla`, `modificar_regla`,
    `retirar_regla`, `peso_defecto`, `b0`, `anadir_fuente`; nunca cambia el
    signo, nunca reglas `oficial`, vedas, tallas ni seguridad; fuentes NC
    rechazadas; `validarRegla` a todo lo tocado).
  - `metricas.mjs`: Brier (y habilidad frente a la tasa media), log-loss,
    AUC, calibración por tramos de 20 puntos, ECE, bootstrap emparejado, PSI.
  - `ajuste.mjs`: `P = σ(b0 + Σ m_u·L_u)` con prior normal m_u ~ N(1, 0,25²)
    (encogimiento hacia el criterio experto), Newton + Laplace (± sd).
  - `deriva.mjs`: frescura de fuentes (git log de datos-robots y última fila
    de presion_historico, turbidez_historico, oleaje_camara_lecturas),
    sesgo modelo/boya por semana (de `espuma.jsonl`; el primer día ya avisó:
    Bilbao II −22 %), error de calibración de cámaras frente a la semana
    anterior, **panel fijo de 3024 escenarios** (7 regiones × 4 meses × 3
    olas × 3 vientos × 2 presiones × día/noche × 3 modalidades: si un cambio
    de pesos lo mueve, se ve) y PSI del índice en 9 spots vigía (48 h, 2
    llamadas a Open-Meteo con key) y en las salidas de la semana.
  - `senales.mjs`: reglas que nunca se activan en su ámbito, especialización
    por región, estacionalidad de las observaciones abiertas (GBIF CC0/CC BY,
    corregida por el esfuerzo de cada mes) y **aprendizaje activo**: qué
    fotogramas de cámara etiquetar primero (`datos-robots/aprendizaje/
    etiquetar.json`: fuera del rango calibrado o cámara/modelo discrepan).
  - `propuestas.mjs`: contrato y barandillas de comun (no insistir con lo
    rechazado salvo evidencia ×2, diciéndolo; máximo 5 nuevas por semana por
    impacto; tasa por tipo (sí+1)/(decididas+2)).
  - `especies-texto.mjs`: cambia `confianza` en el TEXTO de especies.json
    (sangría de 1 espacio, no se reescribe) y guarda `confianza_experta` la
    primera vez (el ancla).
  - `semanal.mjs`: la pasada completa; `probar-retador.mjs`: banco de
    pruebas público (sin datos privados) para la rutina.
- `.github/workflows/aprendizaje-semanal.yml`: lunes 04:41 UTC, lo lanza
  pg_cron (`20261009140000_programador_aprendizaje.sql`, **SIN APLICAR**; el
  `schedule:` queda de respaldo, trampa 15). Service_role solo GET. Falla en
  rojo sin el secret. **Sin caché de Actions** (la leerían las PR de forks:
  fecha + lugar de una salida es dato personal). Segundo trabajo: al subir
  una rama `robot/aprendizaje-*` con retadores, los evalúa con los datos del
  diario ejecutando el código de **main** (de la rama solo lee JSON) y deja
  `aprendizaje/evaluacion-retadores.json` en la rama.
- Rutina del plan **"Costaviva - Investigador semanal"**
  (`scripts/saldo/rutina-investigador-semanal.txt`, cloud, repo Costaviva,
  sin conectores; sugerido `CRON_TZ=Europe/Madrid 47 8 * * 1`, después del
  workflow): lee decisiones, señales, backtest y evidencias; propone reglas,
  factores, especies y fuentes con fuente citable; **cada idea va como
  retador y pasa por `probar-retador.mjs` antes de proponerse**; escribe en
  `propuestas.json` (siempre `requiere_si: true`) en una rama
  `robot/aprendizaje-AAAA-MM-DD` (`robot-diseno-pr.yml` abre la PR). Nunca
  activa nada. **Pendiente (Mikel): crearla en claude.ai/code/routines.**

**Privacidad (repo público, `privacidad.mjs`):** solo agregados de 5
usuarios distintos o más, o solo del dueño (tabla `administradores`); nunca
ids, fechas, horas, spots ni coordenadas de una salida. `comprobarPublicable`
revisa cada fichero antes de escribir (uuid, email, lat/lon) y aborta.
`admin.html` enseña la calibración (`assets/datos/aprendizaje-indice.json`),
una columna "Lo que dicen los datos" por regla (n, peso ×m ± sd, ayuda o
estorba, valor experto si se ajustó) y, **solo en el navegador del admin**,
sus 5 salidas donde el índice más falló, para que anote qué pasó.

**Qué se aplica solo y qué no (barreras, `aprendizaje/config.json`):**
- Solo la `confianza` de reglas expertas. Cada semana ±20 % como mucho,
  nunca fuera de ±50 % de `confianza_experta`, entre 0,05 y 1, nunca cambia
  el signo (si los datos piden darle la vuelta o m ≤ 0,3 → propuesta de
  retirarla). Evidencia: ≥ 80 salidas (≥ 15 con y sin pesca), ≥ 30 con la
  regla activa y de **≥ 5 personas** (comun L4: nunca una sola, tampoco
  Mikel solo), y el dato se aleja del prior más que su sd.
- Validación fuera de muestra: se ajusta con el 70 % más antiguo y en el
  30 % más reciente el log-loss baja ≥ 0,002, el Brier no sube y el AUC no
  cae > 0,01. Panel de referencia: ≤ 3 puntos de media y ≤ 10 en cualquier
  escenario. Máximo 3 cambios por semana. Nunca tipo `oficial` ni reglas con
  `bloqueo_auto: true`.
- El workflow corre los tests de tests.yml con el cambio; si pasan, abre la
  PR `aprendizaje/auto-AAAA-MM-DD` y la fusiona él (squash). Si algo falla
  (tests, abrir o fusionar la PR) o `auto_aplicar` es false o hay pausa
  (`AUTOMATION_PAUSED`, `ROBOT_PAUSADO`), el cambio queda como propuesta con
  `requiere_si: true`. Ojo: comun clasifica los `peso` como "necesita sí";
  aquí el ajuste automático es la excepción acotada que pidió Mikel y que
  comun recoge en "Parámetros autoajustables... solo cuando haya volumen".
  Si Mikel prefiere preguntarlo todo: `"auto_aplicar": false`.
- Un "no" de Mikel a un cambio aplicado: el lunes siguiente vuelve a
  `confianza_experta` (aplicado solo) y la regla queda bloqueada.
- Pesos base, b0 (calibración global), retirar, partir por región, temporada
  nueva, promover un retador: siempre propuesta.

**Frentes, clorofila y corrientes en la sombra (2026-10-09, Mikel: "hay que
validar para todas las artes y especies").** `scripts/aprendizaje/frentes-sombra.mjs`:
para cada salida, la capa 〰 Frentes de SU día (`datos.mjs`
`leerHistoricoFrentes`, bucket público, una petición por fecha, tope 200)
da 9 rasgos binarios: frente de clorofila / térmico / los dos / convergencia
/ frente con convergencia a ≤ R km (R = 10 km costa y submarina, 20 km
embarcación: elección de Claude), clorofila baja / moderada / alta y
corriente fuerte (≥ 0,25 m/s, ~medio nudo). Para CADA modalidad del diario
(costa, embarcación, submarina; la técnica —spinning, curricán, fondo...—
solo está en `capturas.tecnica`, sin salidas "sin captura" por técnica, así
que no se puede evaluar sin sesgo) × CADA especie de especies.json (las
salidas donde la especie estaba en el ranking del índice o se pescó) ×
rasgo, ajusta y ~ σ(logit(índice de esa especie) + a + β·x) con β ~ N(0,
0,5²): **sin signo supuesto** (un bloom puede restar). Barreras: las de
`config.json → ajuste` (80 salidas, 15 con y 15 sin captura, 30 con y 30 sin
el rasgo, 5 personas o más con el rasgo, k ≥ 5 para publicar) + `frentes`
(|β| ≥ 3 desviaciones: hay ~1.400 combinaciones y con 2 saldrían falsos
positivos por azar; mejora del log-loss ≥ 0,002 en el 30 % más reciente con
el mismo signo). Lo que supera todo va a `propuestas.json` (siempre
`requiere_si`, tipo `regla`); el resto se queda acumulando y RESUMEN.md lo
dice. Público: `datos-robots/aprendizaje/frentes-sombra.json` (solo
agregados; sin motivos con cifras si hay menos de 5 personas). Hipótesis
previas por grupo, **solo documentadas, nunca activadas**:
`aprendizaje/frentes-hipotesis.json` (bonito del norte juvenil: sin relación
consistente con frentes térmicos y quizá sí con los de clorofila en
agosto-septiembre, Sagarminaga y Arrizabalaga 2014, DSR II 107:54-63, DOI
10.1016/j.dsr2.2013.11.006, repositorio con licencia NC: solo se cita).
Activar una combinación aceptada = una regla en especies.json con las
variables de contexto de frentes (ya existen, ver "〰 Frentes en el índice").
La copia diaria empezó el 2026-10-09; las salidas anteriores tienen capa
cuando se lanza el histórico hacia atrás (`parte=historico_frentes`, ver abajo).

**Campeón/retadores:** `aprendizaje/retadores/*.json` (estado `sombra`) se
calculan cada lunes sobre los mismos casos y se apuntan en
`datos-robots/aprendizaje/historial.jsonl` (no se enseñan a nadie). Con ≥ 4
semanas, ≥ 3 victorias de las últimas 4 y probabilidad de mejora ≥ 0,9 se
propone activarlo. Más un retador interno "ajuste-libre" (sin barreras) como
referencia. Sembrados el 2026-10-09 con lo no activado de
`propuestas_evidencia`: levante a 0,5, lisa con río crecido, calamar con luna
llena. Activar uno aceptado: moverlo a especies.json y poner el retador en
`promovido`.

**Estado a 2026-10-09:** la migración `20261008120000_indice_pesca_salida.sql`
está aplicada, así que cada salida nueva del diario guarda `indice_factores`
y entra en el banco de pruebas; con `OPEN_METEO_API_KEY` también se
recalculan las antiguas a partir de lugar, fecha y hora. Los ficheros de
`aprendizaje/` y `datos-robots/aprendizaje/` del repo salen de una pasada
local sin Supabase (`senales.json` en `error` hasta la primera ejecución del
workflow). Ideas no hechas: `ideas` de `aprendizaje/config.json` (salen en
RESUMEN.md).

## 〰 Frentes en el índice y borde de borrasca (2026-10-09, pedido de Mikel; PR pendiente de su sí)

Mikel quería frentes, clorofila y corriente en el índice "sin saber cómo
ponderarlo". Plan acordado (gasto 0, sin IA ni APIs de pago): **priors
pequeños con fuente citada que el aprendizaje ajusta solo**, y un histórico
hacia atrás para que haya datos desde el primer lunes.

**Reglas** (`especies.json → reglas_expertas.reglas`, todas `por_validar`,
`tipo: cientifica`, **confianza 0,4** = la mínima de las reglas con fuente
bibliográfica, `retirar_si_nulo: true`; ▲/▼ suaves: ~3 puntos cerca de 50,
como mucho ~4,5 con la confianza al +50 % que permite el ajuste):
- `frente_cerca_tunidos` (+0,3 × 0,4): atún rojo y bacoreta, embarcación,
  frente de clorofila o térmico a ≤ 10 km entero, se apaga hasta 20 km.
  Royer et al. 2004 (MEPS 269:249-263, DOI 10.3354/meps269249), Belkin 2021
  (Remote Sensing 13:883, DOI 10.3390/rs13050883, CC BY), Fiedler y Bernard
  1987 (DOI 10.1016/0278-4343(87)90003-3). "borde de aguas cerca: favorece a
  los peces de paso".
- `frente_clorofila_bonito` (+0,3 × 0,4): bonito del norte, embarcación,
  **solo agosto-septiembre y solo borde de clorofila** (Sagarminaga y
  Arrizabalaga 2014, DOI 10.1016/j.dsr2.2013.11.006: con los térmicos no hay
  relación consistente). "borde de aguas verdes y azules cerca: puede juntar
  al bonito".
- `clorofila_alta_submarina` (-0,3 × 0,4): submarina, todas las especies,
  clorofila alta (≥ 2 mg/m³) en la celda fiable más cercana a ≤ 15 km. Morel
  1988 (DOI 10.1029/JC093iC09p10749) y Utne-Palm 2002 (DOI
  10.1080/10236240290025644). "agua muy verde (floración): poca visibilidad
  bajo el agua".
- `corriente_fuerte_fondo` (-0,3 × 0,4): embarcación, especies de fondo
  (faneca, congrio, besugo, gallo, rape...), corriente media del día sin marea
  ≥ 0,5 m/s (~1 nudo; en el Cantábrico casi nunca). Stoner 2004. "corriente
  fuerte: cuesta pescar a fondo".
- **Descartadas por falta de fuente (siguen solo en la sombra)**: frente →
  caballa, jurel, lubina en superficie (hipótesis del texto de Mikel, sin
  estudio abierto); clorofila alta → spinning desde costa (el índice no sabe
  la técnica y en la franja de 5 km no hay clorofila fiable); convergencia
  (D'Asaro 2018 mide lo que flota, no peces); corriente desde costa (manda la
  marea, el modelo pierde detalle). Las fuentes de Crossref se comprobaron; los
  PDF de MDPI e Inter-Research no se pudieron abrir desde la sesión (bloqueo
  anti-robot): `leido` lo dice.

**Regla de Mikel `borde_borrasca_tunidos`** ("para los túnidos, los bordes de
las borrascas son interesantes"): `heuristica_experta_local`, confianza 0,6
(la habitual de sus reglas), +0,35 (▲, ~5 puntos), embarcación, bonito del
norte, atún rojo y bacoreta, `variable: presion@borde_borrasca`. **Definición
operativa (de Claude, con la serie del spot, sin peticiones nuevas)**: la
presión ha bajado de 2 a 10 hPa en 24 h (se acerca una borrasca; más de 10 =
bajada explosiva, el núcleo encima), sigue en 1000 hPa o más (no es el
centro), viento medio de las últimas 6 h de 10 a 30 km/h (viento de sistema,
ni calma ni temporal: desde 30 sale el aviso de embarcación pequeña) y ola
máxima de las últimas 6 h < 2,5 m (nunca con mar peligroso; el aviso de ola
sigue aparte). Sin bibliografía abierta que lo mida; Goñi 2015 (la mezcla por
temporal baja el bonito en superficie) justifica excluir núcleo y mar grande.
En el panel fijo mueve 2 escenarios 1 punto.

**Contexto** (`assets/js/frentes.js → contextoFrentes`, radio 30 km):
`frente_km`, `frente_clorofila_km` (99 = ningún frente; null = sin dato),
`clorofila_nivel`, `corriente_ms`: variables de contexto nuevas de
`reglas-expertas.js` (`VARIABLES_FRENTES`, `usaFrentes`). `ventana-actividad.js`
las mete con `frentesDelDia(contexto.frentes, día)`: solo el día de la capa o
el siguiente. **Sin capa, de otro día, nubes o costa: la regla no aplica y
tampoco rebaja la cobertura de la fiabilidad** (nunca penaliza). En
`index.html`, `frentesIndice()` carga `capas/frentes.json` **solo en
embarcación y submarina** (desde costa no hay reglas), con la misma caché y
petición que la capa del mapa (`cargarCapaMar`, directo al bucket, cero
subrequests de Cloudflare), tope de 4 s y solo si tiene ≤ 1,5 días;
`frentesDeSpot()` cachea por spot; solo `dia === 0`. El diario
(`diario.html`) y la página SEO del índice no leen la capa (sin esas reglas).

**Aprendizaje**: `semanal.mjs` saca el contexto de cada salida del histórico
de su día (`contextosFrentesCasos`) y lo pasa a `recalcular()`; a los casos
con solo los términos guardados por el diario les añade los de estas reglas
(`terminosFrentes`, sin duplicar). Así entran en el ajuste como cualquier
regla (±20 %/semana, ±50 % del valor inicial, nunca cambia el signo; m ≤ 0,3
→ propuesta de retirarla) y, por `retirar_si_nulo`, **con las barreras
cumplidas y efecto nulo (m < 0,7 y m - 2·sd ≤ 0) se propone desactivarla**
(propuestas.json, sí/no de Mikel). La regla de Mikel no lleva ese flag. La
sombra de frentes sigue igual (mide lo que queda por encima del índice, que ya
lleva estas reglas). `aprendizaje/frentes-hipotesis.json` dice en cada grupo
qué regla hay (`reglas_en_indice`). Panel fijo: sin capa o sin señal, 0 puntos;
con todas las señales a la vez en todos los escenarios, 0,4 de media y 3 como
mucho (test).

**Histórico hacia atrás** (`descargar-capas.py --desde AAAA-MM-DD --hasta
AAAA-MM-DD`): mismo cálculo (`construir_frentes` → `calcular_frentes`).
**Datasets por cobertura real (corregido el 2026-10-09 tras el primer
lanzamiento, run 37949198980: `CoordinatesOutOfDatasetBounds`)**: el STAC del
PRODUCTO decía clorofila NRT "desde 2025-10-04", pero el DATASET en el
servicio ARCO solo guarda ~10 días (2026-09-29 a 2026-10-08; su
`admp_valid_start_date` ya lo decía). Ahora, para cada día y variable, el
primer dataset de `HISTORICO_DATASETS` que lo cubre según
`copernicusmarine.describe(dataset_id=...)` (sin cuenta; `cobertura_real`,
se mira ANTES de pedir y las aperturas se recortan a esa cobertura):
- clorofila: NRT de la pasada diaria si cubre toda la ventana del compuesto;
  si no, **`cmems_obs-oc_atl_bgc-plankton_my_l4-gapfree-multi-1km_P1D`**
  (OCEANCOLOUR_ATL_BGC_L4_MY_009_118, DOI 10.48670/moi-00289; 1997-10-01 a
  2026-10-01 el 2026-10-09): misma malla de 1/96°, mismas variables `CHL` y
  `flags` y misma máscara 2 = INTERPOLATED, así que el cálculo no cambia; es
  la serie reprocesada, no la NRT que vio la pasada diaria;
- temperatura y corriente: el análisis de IBI de la pasada diaria (guarda
  desde 2024-10-18 / 2024-10-15: cubre 2026 entero); antes, el reanálisis
  IBI_MULTIYEAR_PHY_005_002 (DOI 10.48670/moi-00029:
  `cmems_mod_ibi_phy-temp_my_0.027deg_PT1H-m` y
  `cmems_mod_ibi_phy-cur_my_detided-0.027deg_P1D-m`, misma malla y nombres;
  hasta 2026-06-15).
Cada fichero dice qué dataset usó (`datasets_historico`). Un día que no cubre
ningún dataset, o un bloque que falla al abrir, se salta con aviso y la pasada
sigue (sale en rojo solo si no escribe nada). Clorofila: el mismo compuesto de
hasta 5 días que la pasada diaria (PR #149; `elegir_clorofila` compartida):
el día D, o el último con datos hasta 5 días antes, más los previos D-1..D-4,
nunca días posteriores a D (`fecha_clorofila_desde` / `fecha_clorofila` lo
dicen); mismo umbral térmico (0,08 °C/km) y filtro de frentes de menos de 3
celdas. Temperatura a las 12 UTC, corriente media del día.
`test/frentes_capas_test.py` (clases `Historico`, `EleccionDataset`,
`HistoricoSinAbortar`, sin red) lo comprueba. Solo escribe
`capas/historico/`, nunca las capas del día. Por bloques de 10 días, salta lo
que ya está en el bucket (HEAD público), tope `max_dias` (150) y 290 min por
ejecución. **Cómo lanzarlo (desde main, tras fusionar)**: Actions → "Fuentes
gratuitas" → Run workflow → `parte=historico_frentes`, `desde=2026-01-01`
(o la fecha de la salida más antigua del diario), `hasta` vacío (= ayer),
`max_dias=150`; se lanza otra vez para el resto (salta lo subido). ~281 días
hasta el 2026-10-08, ~50-80 kB por día ≈ 14-22 MB en el bucket. Trampa
apuntada en comun (TRAMPAS_COMPARTIDAS.md): la cobertura temporal se
comprueba en el propio dataset.

Tests: `test/frentes-indice.test.js` (en tests.yml).

## Batimetría: profundidad de los spots e isóbatas (2026-10-08, aprobado por Mikel)

**Fuentes y licencias** (verificadas, detalle en
`datos-robots/fuentes/BATIMETRIA.md`): **EMODnet Bathymetry DTM 2024**, CC BY
4.0 (uso comercial con atribución; DOI 10.12770/cf51df64-56f9-4a99-b1aa-36b8d7b743a1),
y de respaldo **GEBCO_2026** (dominio público, atribución pedida, "no para
navegar"). Atribución visible en el mapa al encender las isóbatas.
No quitarla.

**Profundidad por spot** (`assets/datos/profundidad-spots.json`, sin IA):
`node scripts/batimetria/profundidad-spots.mjs` pide al WCS de EMODnet
(`emodnet__mean`, text/plain, ~115 m) una caja de ~11 km por spot de `SPOTS`
(`functions/prevision.js`). Todo se mide desde la **orilla** (la celda de mar
más cercana al spot: muchos spots caen en la playa, el puerto o tierra
adentro): `zona_m` (mediana del fondo a 1 km), `prof_max_5km_m` (fondo más
profundo a 5 km o menos) y `dist_10_30m_m` (distancia al fondo de 10-30 m más
cercano), además de distancias desde el spot a 10/20/30/40/50/100 m. El cálculo
puro está en `assets/js/batimetria-calculo.js` (lo usan el script y el
navegador). GEBCO solo si EMODnet falla o no tiene mar a 1 km (OPeNDAP de
CEDA). El DTM no cambia: regenerar al añadir spots o con un DTM nuevo (y
actualizar el DOI). Puntos propios: el navegador pide al WCS de EMODnet (CORS
abierto, sin clave) una caja de ~6 km y hace el mismo cálculo (en un punto en
el mar, la orilla es el propio punto); repinta el índice al llegar.

**Índice: profundidad ALCANZABLE** (decisión de Mikel, 2026-10-08: "usa la
profundidad alcanzable"; un barco que sale de Pasaia o Hondarribia pesca
fuera del puerto). Variables de contexto de las reglas expertas
`prof_max_5km` (m) y `dist_fondo_10_30m_km` (km), más `profundidad`
(= `zona_m`, informativa), desde `contexto.batimetria` (las estadísticas;
`window.Batimetria.batimetria(s)` en `index.html`, `contextoReglas` las
traduce). Tres reglas de Mikel (`mikel_campo_bizkaia`, embarcación,
pargo/dorada/dentón, fuera de Canarias, Azores y Madeira, confianza 0,5):
agua ≥ 18 °C y fondo de 10-30 m a 5 km o menos suma; agua ≤ 15 °C y más de
40 m a 5 km o menos suma, si no resta; entre 15 y 18 °C no aplica. El
"verano/invierno" va por la temperatura del agua de la hora, no por meses.
El radio era 3 km; Mikel lo subió a 5 km (2026-10-08) para que Mundaka, cuya
orilla está dentro de la ría (27 m a 3 km), cuente con el fondo de fuera. Con
los datos de hoy, en invierno Mundaka (59 m a 5 km), Hondarribia (73 m),
Pasaia (72 m) y Bakio (79 m) suman; 38 de los 105 spots no llegan a 40 m y
restan.
Texto para el usuario sin números ("profundidad adecuada para la época").

**Mapa**: `assets/js/capa-batimetria.js` (módulo, `window.Batimetria`).
Isóbatas en dos ficheros para no cargar de golpe uno enorme (Mikel: "si
tenemos a mayor profundidad, hasta donde tengamos"):
`assets/datos/isobatas-profundas.json` (150, 200, 300, 500, 750, 1000, 1500,
2000, 3000, 4000 y 5000 m; rejilla de ~460 m, también mar abierto: golfo de
Bizkaia, llanura abisal, Alborán, Baleares, Canarias, Madeira y Azores; < 1 MB;
a cualquier zoom) y `assets/datos/isobatas.json` (20, 50 y 100 m, ~115 m,
solo costa; desde zoom 8). `node scripts/batimetria/isobatas.mjs profundas`
y `... someras` (~10 min cada uno; GEBCO si EMODnet no tiene un cuadro). El
WMS `emodnet:contours` no tiene la de 20 m. Colores discretos de claro a
oscuro y leyenda abajo a la izquierda; etiquetas "200 m" en puntos
precalculados (`etiquetas` de cada nivel) que caen en pantalla, las
profundas desde zoom 6 y las someras desde zoom 10, 120 como mucho. Se
encienden solas en la pestaña Embarcación (`porModalidad`) y a mano con
"Profundidad" en el selector del botón "Fondo"; cada fichero se pide la
primera vez que hace falta. Tests: `test/batimetria.test.js` (en tests.yml).

**Botón único "Fondo" (2026-10-08, Mikel: "Fondos e Isób. muestran lo
mismo")**. Antes había tres botones: "Fondo" (WMS `emodnet:mean` estilo
`atlas_land` + `emodnet:contours` al 75 %), "Isób." y "Sustr.". Comprobado
pidiendo las imágenes al WMS: el "Fondo" viejo era el mismo DTM 2024 que el
relieve del mapa base (`emodnet:mean_atlas_land`, que además lleva
sombreado y por eso se ven los cañones), en tinte plano, más las isóbatas de
EMODnet (sin la de 20 m, peor que las nuestras). No añadía nada: quitado
(solo se veía por encima de zoom 11, donde el DTM de ~115 m ya no da más
detalle). Ahora un solo botón 📏 "Fondo" (columna A, donde estaba) abre un
selector Amanecer (`assets/js/selector-fondo.js`, test
`test/selector-fondo.test.js`) con dos casillas, "Profundidad" (isóbatas +
leyenda) y "Tipo de fondo" (sustrato + leyenda), y "Ninguno". **Se pueden
marcar las dos**: líneas finas encima de manchas al 60 % se leen bien y es
justo la pregunta del pescador ("¿roca a 30 m?"). Tocar fuera o Escape lo
cierra; el botón sale activo si hay alguna capa y su `aria-label` dice
cuáles. Las capas exponen `visible()` / `ponerVisible(v)`;
`capa-batimetria.js` avisa con `onCambio` cuando la pestaña Embarcación
enciende o apaga las isóbatas, y el selector se refresca. Seis botones por
columna (Clorof. y T. agua suben a 260/322 px). Leyendas del fondo: abajo a
la izquierda por encima del ⓘ en escritorio; **en el móvil arriba a la
izquierda** (`esquinaLeyenda`), porque abajo las tapaban los créditos.
Analítica: `ver_capa_isobatas` y `ver_capa_sustrato` (ya no hay
`ver_capa_batimetria`).

## Triggers / rutinas automatizadas

**Interruptores de pausa (2026-10-07, comun pruebas-y-alertas.md P8):**
- `ROBOT_PAUSADO` (fichero en la raíz): para los robots con Claude antes de
  arrancar la CLI.
- `AUTOMATION_PAUSED` (variable de repositorio, Settings → Secrets and
  variables → Actions → Variables): con valor `true` se saltan los jobs que
  escriben solos en producción, en el repo o mandan emails sin IA
  (camaras-salud, euskalmet-rios, notificar-altas, presion-historico,
  turbidez, indexacion-google, metricas-instagram,
  robot-marketing-instagram). Sin la variable, todo corre como siempre.

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
| `daily-report.yml` | `13 6 * * *` + `13 7 * * *` (ver abajo) | salud + conteo real de SOS (24h) + síntesis del día → única entrada nueva diaria en el Issue "Informe diario — Costaviva", más un email real aparte (Resend) |
| `auth-test.yml` | `17 6 * * *` | RLS sin token + prueba cruzada A-lee-B (secrets ya puestos) |
| `presion-historico.yml` | `7 * * * *` (cada hora) | POST a `/registrar-presion` (secret `PRESION_CRON_SECRET`) — guarda la presión real de cada spot en `presion_historico`, para la tendencia real de `/prevision` (Fase 4, ver más abajo). **Activada y verificada en real el 2026-09-12**: primer intento falló (42501, faltaba política de `insert` en la RLS de `presion_historico` — ni el propio endpoint podía escribir con la anon key sin sesión), corregido en `20260912230000_fix_insert_presion_historico.sql`; segundo intento escribió filas reales, confirmado leyendo la tabla. |

**`daily-report.yml` — actualizado 2026-09-20 (pedido explícito del
usuario, tras notar que le llegaba "el informe" varias veces al día)**:
ahora es el ÚNICO workflow que toca el Issue "Informe diario" — antes
también publicaban por su cuenta `robot-buscador-fuentes.yml` (hasta 4
veces/día), `robot-experiencia-usuario.yml` (1x/día entonces; 1x/semana los lunes desde el 2026-09-28, recorte de gasto de API) y
`robot-patrones-uso.yml` (1x/semana); los tres siguen escribiendo en
`ROBOT.md` igual que antes, solo dejaron de tocar el Issue — ver la
entrada fechada 2026-09-20 más abajo para el detalle completo. Las dos
horas de cron (`13 6 * * *` / `13 7 * * *`) son las dos candidatas UTC
para que la pasada real caiga siempre a las 08:00 **hora de España**
(con el cambio de hora correctamente gestionado vía el job
`decidir_hora`, no a las 08:00 UTC fijas como antes) — GitHub Actions no
entiende zonas horarias, así que se declaran ambas y se descarta la que
no toca ese día. **Ojo, limitación real de GitHub, no de este repo**:
pese al ajuste de minuto para evitar la hora en punto, las pasadas
reales de este workflow se han observado saliendo con 4-5h de retraso
sobre la hora programada (confirmado revisando el historial de
`gh run list --workflow=daily-report.yml`) — es el propio planificador
de GitHub Actions bajo carga global, no algo arreglable solo ajustando
el cron.

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

**Actualización 2026-09-20 — credenciales persistentes + dos hallazgos
reales al usarlas por primera vez.** Pedido explícito del usuario: en
vez de darle SQL para pegar a mano en el editor de Supabase cada vez
(frágil — ver el bug de abajo), guardó él mismo la cadena de conexión
de **Connection Pooling** (con su contraseña real) en su propio
`~/.bashrc` como `SUPABASE_DB_URL` — **nunca escrita en este repo ni
pegada en el chat**, la puso él directamente en el fichero. Cualquier
sesión de Claude Code que abra una terminal Bash la hereda sola (el
shell se inicializa desde el perfil del usuario), así que a partir de
ahora se puede montar el comando `supabase db push --db-url
"$SUPABASE_DB_URL" ...` sin pedirle a nadie que pegue nada a mano — con
una excepción real, ver el punto siguiente.

- **El "clasificador de modo automático" de Claude Code bloquea en
  duro cualquier comando de Bash que escriba sobre la base de datos de
  producción** (`psql "$SUPABASE_DB_URL" ...`, `supabase migration
  repair ...`, `supabase db push ...`) cuando lo intenta ejecutar la
  propia sesión — no es un permiso que se pueda aprobar respondiendo en
  el chat, es un bloqueo previo a eso. Comandos de solo lectura contra
  la misma base (`supabase migration list`) sí funcionan bien desde la
  sesión. **La vía real**: preparar el comando exacto (ya con
  `$SUPABASE_DB_URL`, sin ningún dato sensible de más) y pedirle al
  usuario que lo pegue él mismo en su propio Git Bash — funciona sin
  problema al ejecutarlo él.
- **Historial de migraciones desincronizado, encontrado al usar
  `supabase migration list` por primera vez**: las ~13 migraciones
  aplicadas entre el 2026-09-17 y el 2026-09-19 se habían pegado a mano
  en el SQL Editor (antes de que existiera esta cadena de conexión), así
  que la tabla de seguimiento de la CLI nunca se enteró — salían como
  `"remote": ""` pese a estar de verdad en producción (confirmado, esas
  mismas migraciones ya estaban documentadas aquí como verificadas en
  real). Lanzar `db push` tal cual habría intentado re-ejecutarlas
  contra producción, con riesgo real de error (columnas/tablas que ya
  existen). Arreglado con `supabase migration repair --db-url
  "$SUPABASE_DB_URL" --status applied <lista de versiones>` (solo toca
  la tabla de metadatos de la CLI, ni esquema ni datos) antes de aplicar
  la migración nueva de verdad. **Para la próxima vez**: si alguna
  migración futura se vuelve a aplicar a mano en el editor en vez de por
  `db push` (por lo que sea), va a volver a aparecer este mismo hueco —
  correr siempre `supabase migration list` primero para comprobarlo
  antes de lanzar un `db push` a ciegas.

## Panel de admin — último acceso y duración de la última sesión (2026-09-20)

Pedido explícito del usuario, tras preguntar si un usuario concreto
había vuelto a entrar/navegar por la web — hasta entonces no había
ninguna forma de verlo sin ir al SQL Editor a mano.

- `admin_listar_usuarios()` ampliada con `ultimo_acceso`
  (`auth.users.last_sign_in_at`, dato real de Supabase Auth — no
  aproximado). Cambia el tipo de retorno, así que la migración hace
  `drop function` + `create function` en vez de `create or replace`
  (Postgres no deja cambiar las columnas de salida con `replace`).
- Nueva función `admin_ultima_sesion_usuarios()`: la duración de sesión
  no existe como tal en Supabase Auth (solo el último login, no cuánto
  duró) — se aproxima agrupando `eventos_uso` por huecos de más de 30
  minutos entre eventos consecutivos (heurística estándar de "sesión" en
  analítica web), y se calcula para todos los usuarios de golpe (no una
  función por usuario que el panel tuviera que llamar en bucle). Límites
  reales, mostrados también como nota en `admin.html`: solo hay datos
  desde el 2026-09-17 (fecha de alta de `eventos_uso`), y una última
  visita con un solo evento registrado se etiqueta "1 evento (sin más
  para medir)" en vez de "0 min", para no dar una falsa sensación de
  precisión.
- Migración: `supabase/migrations/20260920100000_admin_ultimo_acceso_duracion_sesion.sql`.
  `admin.html` pinta las dos columnas nuevas ("Último acceso", "Última
  sesión") junto a la tabla de usuarios existente.

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
  mostrar las 5-6 especies siempre expandidas de golpe. **Quitada el
  2026-10-08** (pedido de Mikel): la sustituye la tarjeta "Ventana de
  actividad por horas" (ver "Fichas de especies y ventana de actividad").

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
directos, interruptor `ROBOT_PAUSADO`). Hasta el 2026-09-20 publicaba
además su propio resumen en el mismo Issue "Informe diario — Costaviva"
que ya usa `daily-report.yml` — ver el aviso más abajo, esa parte se
quitó.

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

**Quitada la publicación al Issue en cada pasada (2026-09-20)**, pedido
explícito del usuario tras notar que le llegaba "el informe" repetido
hasta 4 veces al día: cada una de las 4 pasadas diarias
(cámaras/mareas/corrientes/presión) editaba el Issue "Informe diario —
Costaviva" por su cuenta, además de escribir en `ROBOT.md` — como
`daily-report.yml` ya lee todo lo añadido a `ROBOT.md` en las últimas
24h y hace una única síntesis diaria, esa publicación aparte era pura
redundancia (cada edición generaba su propia notificación). Quitado el
paso "Publicar el resumen en el Issue" de
`.github/workflows/robot-buscador-fuentes.yml` — el robot sigue
escribiendo en `ROBOT.md` exactamente igual que antes, solo deja de
tocar el Issue directamente. Con esto, el único momento del día en que
se actualiza el Issue vuelve a ser la síntesis de `daily-report.yml`
(una vez al día).

**Continuación del arreglo, mismo día (2026-09-20)**: el usuario
confirmó que quería exactamente un informe al día, a las 08:00 —
resultó que `robot-experiencia-usuario.yml` (diario) y
`robot-patrones-uso.yml` (semanal, sábados) tenían el mismo patrón
redundante (escribir en `ROBOT.md` Y publicar aparte en el Issue), así
que se les quitó el mismo paso "Publicar el resumen en el Issue" —
ambos siguen escribiendo en `ROBOT.md` sin cambios. Para no perder sus
hallazgos al dejar de publicarse aparte, el prompt de síntesis de
`daily-report.yml` se amplió con una sección nueva, '## 🧪 Experiencia
de usuario y patrones de uso', entre "Trabajo interno" y "Trabajo
externo" — instruida para copiar los hallazgos del robot de experiencia
de usuario con el mismo detalle que trae `ROBOT.md` (nunca diluirlos a
"todo bien" si hay un bug real) y para decir explícitamente "no le
tocaba pasar esta semana" los días que no sea fin de semana, en vez de
inventar que no hubo novedades (mismo criterio ya usado para el robot
de especies, que solo corre los jueves).

Además, pedido explícito del usuario tras preguntarle si "08:00" se
refería a hora UTC o a hora de España: **hora de España**. Hasta
entonces el cron estaba fijado a "siempre 08:00 UTC exactas" (decisión
del 2026-09-15, para evitar la deriva por el cambio de hora) — eso en
verano llega a las 10:00 hora de España, no a las 08:00. Como el cron de
GitHub Actions no entiende zonas horarias ni DST, la solución no es un
único cron: se declaran las dos horas UTC candidatas (`13 6 * * *` para
cuando rige CEST/verano, `13 7 * * *` para cuando rige CET/invierno) y
un job nuevo, `decidir_hora`, usando `TZ="Europe/Madrid" date +%z`
(tzdata real del runner, conoce las fechas de cambio de hora sin
calcularlas a mano) decide cuál de las dos pasadas de hoy corresponde de
verdad — la otra sale y no hace nada (ni gasta Claude Code ni toca el
Issue), así nunca salen dos el mismo día. El job `informe` ahora
depende de `decidir_hora` vía `needs:` + `if:
needs.decidir_hora.outputs.ejecutar == 'true'`.

**Aviso importante que quedó documentado, no resuelto**: revisando
`gh run list --workflow=daily-report.yml` para verificar todo esto, las
pasadas reales de las últimas semanas han salido sistemáticamente con
4-5h de retraso sobre la hora programada (ej. programada 08:13 UTC,
ejecutada de verdad ~13:00 UTC) — **pese a que el ajuste de minuto
suelto del 2026-09-19 se hizo justo para evitar esto**. Es el propio
planificador de GitHub Actions bajo carga global (el repo es público,
sin límite de concurrencia propio que lo explique) — no hay ajuste de
cron que lo arregle del todo. El usuario no ha pedido investigar esto
más a fondo todavía; si se vuelve a tocar este workflow, no dar por
hecho que la hora de entrega real va a coincidir con la programada.

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

## Tareas cada 30 min: las lanza pg_cron, no el `schedule:` de GitHub (2026-09-28)

GitHub trata los `schedule:` como "cuando pueda": `camaras-salud.yml` y `notificar-altas.yml`, programadas cada 30 min, corrían ~7 veces al día. No es por coste: el repo es público y Actions no cobra. Ahora pg_cron (Supabase) las lanza puntualmente vía la API de GitHub (`workflow_dispatch`, que GitHub arranca al momento): migración `20260928160000_programador_workflows_github.sql`, función `lanzar_workflow_github()` con lista cerrada de workflows permitidos.
- La clave de GitHub (fine-grained, solo este repo, permiso Actions: Read and write) vive en Supabase Vault como `github_lanzar_workflows`. Se guarda con `guardar-token-programador.yml` desde el secret `PROGRAMADOR_GITHUB_TOKEN`; ese workflow hace además una prueba real (204 = funciona). **Si la clave caduca o se rota, actualizar el secret y relanzarlo.** Nunca pegarla en el chat ni en el editor SQL.
- El `schedule:` de los dos workflows se queda como respaldo, con `concurrency` para que dos ejecuciones no se solapen.
- Para añadir otra tarea: añadir su fichero a la lista de `lanzar_workflow_github()` y un `cron.schedule` nuevo, en una migración.
- **Estado:** hasta el 2026-10-08 no funcionaba (sin clave en Vault: camaras-salud.yml corrió 50 veces por `schedule` y 6 a mano en 10 días, en vez de ~480). La clave ya está guardada (prueba 204 del 2026-10-08, 16:09 UTC); cada trabajo nuevo de pg_cron solo empieza a correr cuando se aplica su migración. `espuma-camaras.yml` se añade a la lista en `20261008210000_programador_espuma_camaras.sql`, y `robot-marketing-instagram.yml`/`robot-reel-instagram.yml` en `20261009130000_programador_marketing.sql` (calendario de redes; misma lista de seis que `20261009140000_programador_aprendizaje.sql`, que añade `aprendizaje-semanal.yml`). La clave ya está en Vault (prueba 204 del 2026-10-08, 16:09 UTC).

## Cámaras caídas: fuera de la vista a las 24 h, e IPCamLive resuelto en vivo (2026-09-28)

- **Más de 24 h sin señal = se oculta** (`camaraRetirada()` en `index.html`). Una noche dura ~12 h, así que 24 h es una caída real, casi siempre del proveedor (cantabria.es y SOCIB llevan días caídos). Se quita el punto del mapa y el panel dice, en tono neutro, que no está emitiendo. Vuelve sola cuando `camaras-salud.yml` la ve emitir; no hay que tocar nada. Motivo (pedido del usuario): un punto rojo permanente da imagen de app rota a quien llega por primera vez y resta suscripciones.
- **IPCamLive (Santoña, Sopelana)**: cambia servidor y streamid sin aviso (se rompieron el 21, el 25 y el 28 de septiembre). `functions/webcam/hls/[slug].js` resuelve el alias del reproductor en cada petición y redirige al stream real. Si falla, redirige a la última URL conocida. `index.html` y `comprobar-camaras.mjs` apuntan a `/webcam/hls/<slug>`. **No volver a pegar la URL final en el código**: si cambia el alias, se cambia en `IPCAMLIVE` de ese fichero. Test: `test/webcam-ipcamlive.test.js`.

## Cámaras con mar: se integran siempre, y el robot ya puede crear spots (2026-09-25)

Pedido explícito del usuario, a partir de un caso que recordaba de días
atrás ("había una cámara en una playa de Galicia, pero como no era spot no
la incluiste"): **en la pasada de cámaras, toda cámara con mar a la vista
se integra, y si no existe spot para ese punto, se crea**. Antes se
quedaban solo anotadas en `ROBOT.md` como candidatas.

Al investigarlo salieron **dos** bloqueos, no uno — y el segundo era el más
dañino porque nadie lo había visto:

1. **Sin spot, no se integraba.** Crear un spot era decisión de producto,
   así que solo se proponía. Caso real: la pasada del 2026-09-14 verificó
   11 cámaras de MeteoGalicia (Burela, Viveiro, Cariño, Cedeira,
   Narón/Aldea Nova, Arteixo, Ribeira/Sálvora, Vilanova/Corón,
   Marín/Aguete, Bueu/Ons, Poio/Castrove) y no integró ninguna, porque el
   norte de Lugo y Ferrolterra no tienen spot fijo. La pasada del
   2026-09-21 volvió a esa zona y concluyó "no hay ningún spot fijo sin
   cámara aquí" — las 11 seguían intactas.
2. **El límite de volumen le prohibía tocar `functions/` — así que no podía
   integrar NINGUNA cámara de imagen fija, ni siquiera en spots que ya
   existían.** `WEBCAMS` vive en `functions/webcam/[slug].js`, y la "Red de
   seguridad de la automatización" de `ROBOT_REGLAS.md` veta cualquier
   cambio directo en `functions/`. Eso es lo que dejó las 7 cámaras de
   Windy Webcams de la pasada de Portugal del 2026-09-23 en "sin integrar
   todavía" pese a estar verificadas y ser de spots ya creados. El robot
   llevaba semanas encontrando cámaras que estructuralmente no podía
   aplicar.

**Regla nueva**: sección "Cámara con mar a la vista → se integra siempre, y
si no hay spot se crea" en `ROBOT_REGLAS.md`, con las tres referencias
cruzadas puestas para que no se contradiga con las reglas que ya había (el
bullet de "decisión de producto → solo proponer", la regla de
`puntaluzero`, y el límite de volumen). Lo que define:

- **Qué cuenta como "tiene mar"**: mar abierto, playa, rompiente, ría,
  bocana, y también la dársena de un puerto o marina (se pesca desde los
  muelles). No cuentan ríos de interior, embalses, ni una cámara donde el
  mar es una franja lejana de la que no se puede leer el estado del agua.
  **Se decide mirando la imagen con `Read`, nunca por el nombre de la
  cámara** — una "playa de X" puede estar apuntando al paseo. Si la fuente
  es solo HLS y no se puede sacar un fotograma en esa pasada, no se crea el
  spot: se propone diciendo que la comprobación visual no se pudo hacer.
- **Crear un spot son 7 puntos de edición**, no uno: `SPOTS` en
  `index.html` *y* en `functions/prevision.js` (si falta en una de las dos,
  el spot nace en S/D permanente), el Set de especies por zona,
  `SPOTS_CON_WEBCAM`, la cámara en `WEBCAMS`/`WEBCAMS_HLS`, y las listas
  manuales de `comprobar-camaras.mjs` y `medir-turbidez.mjs`.
- **Comprobación obligatoria que evita un spot nacido roto**: pedir de
  verdad a la Marine API de Open-Meteo el `lat`/`lon` nuevo antes de
  commitear. Si la coordenada cae tierra adentro devuelve `null` en todo, y
  el spot se publica sin oleaje, marea ni temperatura. La coordenada es
  donde se pesca (la playa, el muelle), no donde está montada la lente.
- **Campos de siembra a cero**, nunca a un valor plausible inventado —
  `indiceMar()` ya devuelve `null` (S/D) hasta que el spot tenga un fetch
  real de `/prevision`, así que no se llega a mostrar nada falso.
- **Tope de 5 spots nuevos por pasada** (integrar cámaras en spots que ya
  existen no cuenta contra el tope). El resto queda como cola en `ROBOT.md`
  para la siguiente pasada de esa zona.
- **La excepción al límite de volumen es acotada a propósito**: vale solo
  para esos puntos de edición y solo de forma aditiva. Cualquier otro
  cambio en `functions/` o `supabase/` sigue con la regla de siempre.

`ROBOT_REGLAS.md` lleva además una "Cola pendiente de arranque" con las 7
de Portugal, las 11 gallegas y `puntaluzero`, para que el robot las recoja
cuando la rotación vuelva a sus zonas en vez de redescubrirlas.

**Compromiso asumido a sabiendas**: el robot hace commit y push directo a
`main`, sin rama ni preview, y crear un spot SÍ tiene efecto visible para
el usuario — así que esto se salta la disciplina de "rama + preview antes
de mergear" del final de este fichero. Se acepta porque era lo pedido ("si
no existe spot, se crea"), y en su lugar las guardas son la comprobación
real contra Open-Meteo, los `node --check` obligatorios, el tope de 5 y el
carácter puramente aditivo del cambio. Si algún día se prefiere lo
contrario, la alternativa natural es que el robot abra un PR en vez de
empujar a `main` — pero eso vuelve a convertirlo en una propuesta.

**Aviso operativo encontrado el mismo día: el robot estaba parado, no
inactivo.** Las 4 pasadas del 2026-09-24 fallaron a los ~20 segundos con
`Credit balance is too low` — la `ANTHROPIC_API_KEY` de GitHub Actions se
quedó sin saldo, así que la última entrada real en `ROBOT.md` era del
2026-09-20 pese a que los crons seguían disparando. **Ninguna regla nueva
de este repo sirve de nada mientras eso siga así.** Para la próxima vez que
parezca que el robot "no encuentra nada": mirar primero
`gh run list --workflow=robot-buscador-fuentes.yml` y, si los fallos duran
~20s, es saldo de API, no la tarea — un fallo de saldo es indistinguible de
"sin novedades" si solo se mira el Issue diario.

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
- `es_admin()` — `auth.email() = 'etxebe2005@gmail.com'`. **Pendiente de
  aplicar (2026-10-07, comun auth.md A4):** `20261007150000_admin_por_tabla.sql`
  la cambia a `exists` en `public.administradores` (por `user_id`, sin
  policies). Al aplicarla, actualizar `supabase/baseline-seguridad.json`.
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
(migración `20260914100000_turbidez_historico.sql`,
aplicada), endpoint `/registrar-turbidez` (mismo `CRON_SECRET` que
`/registrar-presion`), workflow diario `turbidez.yml` (mediodía Madrid,
runner de GitHub Actions con `sharp`+`ffmpeg` porque Cloudflare Workers
no tiene API de imagen/vídeo) que analiza saturación/tono HSV del agua
de cada webcam (imagen fija y vídeo) y lo guarda. Nunca se compara un
spot contra otro (el ángulo de cada cámara lo haría sin sentido, mismo
problema que ya existía con el coeficiente de marea) — cada lectura se
clasifica en no turbia/turbia/muy turbia por percentil contra el propio
histórico de 90 días de ESE spot, y con menos de 14 lecturas se queda
sin clasificar (S/D).

**✅ Cerrado y funcionando, comprobado en real el 2026-09-25** (esta
sección decía hasta hoy que la migración estaba sin aplicar y el workflow
sin ejecutar — las dos cosas eran ya falsas, quedó sin actualizar):
`supabase migration list` confirma `20260914100000` aplicada en
producción, `turbidez.yml` ha corrido en verde todos los días desde el
2026-09-14 (~5 min por pasada), y `turbidez_historico` tiene 380 filas
reales — 37 spots con lectura del día anterior. Con 11 lecturas por spot
todavía está por debajo de `TURBIDEZ_MIN_LECTURAS` (14), así que la app
sigue mostrando S/D a propósito: **empieza a clasificar sola alrededor
del 2026-09-28**, sin que haya que tocar nada.

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

## Sin saldo de API, nada se rompe (2026-09-25)

Pedido explícito del usuario tras el incidente del 2026-09-24
("asegúrate que cuando no hay saldo nada se rompe"): la cuenta de Anthropic
se quedó sin saldo y **cada pieza que depende de ella lo manifestó de una
forma distinta, todas malas**:

| Pieza | Qué hacía sin saldo |
|---|---|
| `/identificar-captura` | Devolvía `502` con el **texto crudo del proveedor**: el usuario que subía la foto de su captura veía "Your credit balance is too low…" y el `request_id` interno en pantalla |
| `smoke-test.yml` | En rojo varios días seguidos por ese único motivo, tapando cualquier regresión real |
| `robot-buscador-fuentes.yml` | Moría en ~20s con un rojo indistinguible de un bug propio |
| `robot-experiencia-usuario.yml` | **En verde**, sin haber hecho nada (tiene `continue-on-error: true`) |
| `robot-patrones-uso.yml` | Igual, en verde sin hacer nada |
| `daily-report.yml` | Era el único que degradaba bien (ya tenía un texto de reserva) |

**Criterio adoptado: identificar la foto es una AYUDA opcional, no una pieza
crítica.** La captura se registra igual a mano, así que un problema de
facturación nunca debe presentarse como un error de la app ni como un repo
roto. Dos cambios, uno de producto y otro de operaciones:

**1. `functions/identificar-captura.js` — clasifica el fallo y nunca
reenvía el cuerpo del proveedor.** Nueva función
`clasificarFalloProveedor()` que devuelve un `codigo` estable y un mensaje
legible:

- `sin_credito` → `503`. Ojo, **Anthropic devuelve el saldo agotado como
  `invalid_request_error` con status `400`, no como un `402`/`403`**, así
  que se reconoce por el mensaje (`credit balance`, `billing`,
  `purchase credits`) — un `400` a secas sí es un fallo nuestro (imagen mal
  formada), y confundirlos sería tratar un bug propio como una degradación.
- `saturado` → `503` (429/529, `overloaded_error`, `rate_limit_error`).
- `sin_configurar` → `503` (falta `ANTHROPIC_API_KEY`; antes era un `500`).
- `fallo_proveedor` → `502` para todo lo demás.

El cuerpo crudo del proveedor va **solo al `console.error` del Worker**,
nunca al cliente. Esto cierra además una fuga menor de detalle interno de
infraestructura que existía desde que se creó el endpoint.

**2. `diario.html` — lo trata como aviso, no como error.** Si el `codigo`
es uno de los tres de "no disponible", muestra un mensaje en tono neutro
recordando que **la foto ya está añadida** y que se puede escribir especie
y talla a mano. **Detalle que casi se colaba**: las únicas clases de
mensaje que existen en esa página son `error`/`ok`/`info`, y `.mensaje` es
`display: none` sin una de ellas — una clase inventada como `aviso` habría
dejado el mensaje **invisible**. Se usa `info` (ámbar), el mismo tono que
"🤖 Analizando la foto…".

**3. `smoke-test.yml` — avisa, no falla, y sigue probando el resto.** Si
`/identificar-captura` responde con uno de esos códigos, emite un
`::warning::` y continúa el recorrido con una especie de reserva, para que
los pasos siguientes (registrar y borrar una captura real) se sigan
probando. Un fallo de verdad del endpoint sigue poniendo el workflow en
rojo exactamente como antes — lo verificado con los 4 casos posibles
(sin saldo / éxito / error real / respuesta incompleta) antes de commitear.

**4. Guardarraíl común en los 4 workflows que llaman a Claude**
(`robot-buscador-fuentes`, `robot-experiencia-usuario`,
`robot-patrones-uso`, `daily-report`): la salida del CLI se captura, y si
el fallo trae `credit balance is too low` / `purchase credits`, el paso
emite un `::warning::` nombrando la causa, escribe el motivo en su fichero
de informe, lo deja en el `$GITHUB_STEP_SUMMARY` y **sale en verde**.
Cualquier otro fallo se propaga igual que antes. Patrón usado:
`... --allowedTools "…" > "$SALIDA_CLAUDE" 2>&1 || CODIGO=$?` — con `||` en
vez de `set +e`, porque el shell por defecto de GitHub Actions es
`bash -e` y sin eso la línea aborta el paso antes de poder inspeccionar
nada.

**Lo que esto NO arregla, a propósito**: `robot-experiencia-usuario.yml`
sigue saliendo en verde cuando agota `--max-turns` (el `continue-on-error:
true` que ya estaba documentado más arriba). Es un problema distinto del
saldo y no se ha tocado en este cambio — si algún día molesta, el arreglo
es el mismo patrón: detectar "Reached max turns" en la salida capturada y
emitir un `::warning::`.

**Cómo diagnosticar esto la próxima vez**: un fallo de saldo tarda ~20
segundos y ya no se confunde con nada, porque sale como aviso con la causa
escrita. Si aun así hay dudas,
`gh run list --workflow=<lo-que-sea>.yml` y mirar la duración: ~20s es
saldo o configuración, varios minutos es trabajo real.

## Identificación por foto: Haiku 5.5 y límites (2026-10-08)

Aprobado por Mikel para bajar el coste de `/identificar-captura` sin perder
calidad.

- **Modelo `claude-haiku-5-5`** (antes `claude-haiku-4-5-20251001`), esfuerzo
  `low`, `max_tokens` 1024 (Haiku 5.5 piensa por defecto y el pensamiento
  cuenta dentro de `max_tokens`; con 300 se cortaría). Sin `temperature` ni
  prefill (400 en Haiku 5.5). El texto se lee de los bloques `type: "text"`,
  no de `content[0]`. `stop_reason: "refusal"` → `422 rechazada` (aviso
  neutro, sin reintento; Haiku 5.5 no tiene fallback en servidor). JSON mal
  formado queda en `uso_claude` como `respuesta_invalida`.
- **Evaluación** (`scripts/eval-identificacion/evaluar.mjs`, misma petición
  del endpoint, 15 especies con la foto principal de su artículo de
  Wikipedia): Haiku 4.5 acertó 8/15 a 0,0019 USD/foto; Haiku 5.5, 10/15 a
  0,00033 USD/foto (≈1.790 tokens de entrada y ≈300 de salida, máximo 515).
  Fallan los dos en dorada, faneca, rodaballo y chopa. El workflow que la
  lanzó se borró; el script se queda para repetirla a mano.
- **Foto**: a la IA se manda una copia de 1000 px en el lado largo
  (`redimensionarParaIdentificar()` en `diario.html`). La que se guarda con
  la captura sigue a 1600 px.
- **Límites en el servidor**: (1) suscripción, llamando a
  `mi_estado_suscripcion()` con el token del usuario, así que admin, accesos
  permanentes, prueba y `trialing`/`active` son la misma regla del paywall
  (`403 sin_suscripcion`; si la RPC falla, se deja pasar); (2) 30 llamadas
  en 24 h (`limite_diario`); (3) 100 identificaciones buenas (`ok = true`)
  por mes natural en hora de Madrid (`429 limite_mensual`). La respuesta
  buena trae `limite_mes` y `restantes_mes`; `diario.html` avisa desde 80
  usadas y al llegar a 100 dice que la captura se guarda a mano. Sin SQL
  nuevo: todo sale de `uso_claude` y de la RPC que ya existía.
- **Smoke test**: `limite_mensual` y `sin_suscripcion` cuentan como
  degradación (aviso, no rojo). Si sale `sin_suscripcion`, la cuenta de
  `SMOKE_TEST_EMAIL` no tiene acceso y conviene darle acceso permanente.

## Token de Instagram: por qué murió en una hora y cómo regenerarlo (2026-09-25)

**Diagnóstico real, no "caducó a los 60 días".** El secret
`META_PAGE_ACCESS_TOKEN` se guardó el **2026-09-19 a las 17:47 UTC** y Meta
lo dio por caducado a las **19:00 UTC del mismo día** (`OAuthException`
código 190, subcódigo 463, "Session has expired on Saturday,
19-Sep-26 12:00:00 PDT"). Poco más de una hora de vida: es la firma de un
token de **corta duración** copiado del Graph API Explorer, no de un token
de larga duración. El robot publicó **un único post** ese día
(`18350295562221732`) y desde entonces falló el 21 y el 23 de septiembre.

**Por qué tardó 6 días en detectarse** — la parte que importa más que el
token en sí:
- El informe diario decía `Posts publicados (24h): 0`, indistinguible de un
  día tranquilo.
- `metricas-instagram.yml` salía en **verde** porque sale antes con "Nada
  nuevo que medir hoy" (no hay posts nuevos que medir), sin llegar a tocar
  la API.
- `medir-metricas-instagram.mjs` trataba el fallo con `console.warn` y
  guardaba `null`: un token muerto producía métricas vacías
  indistinguibles de "el post no tuvo alcance".

### Qué se cambió para que no se repita

- **`scripts/marketing/publicar-borrador-instagram.mjs` y
  `medir-metricas-instagram.mjs`**: detectan el error 190 /
  `OAuthException` y salen con **código 3** (`SALIDA_TOKEN_CADUCADO`) en vez
  de un fallo genérico o, peor, un `null` silencioso.
- **`robot-marketing-instagram.yml` y `metricas-instagram.yml`**: ante el
  código 3 emiten un `::warning::` nombrando la causa, lo dejan en el
  `$GITHUB_STEP_SUMMARY` y salen en verde. Cualquier otro fallo sigue en
  rojo.
- **`daily-report.yml`**: el bloque de Marketing empieza ahora por
  `Token de Instagram: <estado>`, calculado llamando de verdad a
  `/debug_token`. Tres estados: `✅ válido, no caduca`, `⚠️ válido pero
  CADUCA en N días` (avisa **antes** de romperse) y `❌ CADUCADO o
  inválido`. Probado con los 5 casos posibles, incluida una respuesta vacía
  (se trata como inválido: mejor una falsa alarma que un silencio).
- **Nuevo workflow `comprobar-token-instagram.yml`** (`workflow_dispatch`):
  valida el token guardado y dice si es válido, si caduca y cuándo, si
  tiene los 5 permisos necesarios, y si de verdad da acceso a la cuenta de
  Instagram `17841421445922598`. **Nunca imprime el token** (la respuesta se
  vuelca a un fichero y se interpreta con node). Es el paso que faltaba el
  19-sep: verificar antes de dar el token por bueno.

### Cómo regenerarlo (pasos para el usuario)

Datos ya configurados en el repo, no hay que volver a buscarlos:
`META_IG_BUSINESS_ACCOUNT_ID` = `17841421445922598`,
`META_PAGE_ID` = `1260025797202453` (los dos como *variables*, no secretas).

**Vía recomendada — Usuario del Sistema (no caduca nunca).** Es la pensada
para automatización:
1. `business.facebook.com` → *Configuración del negocio*.
2. *Usuarios → Usuarios del sistema → Añadir*. Nombre `Costaviva robot`,
   rol *Administrador*.
3. *Asignar activos*: la Página `1260025797202453` (control total) **y** la
   cuenta de Instagram. Si se olvida la cuenta de Instagram, el token sale
   válido pero sin acceso — el paso 2 de
   `comprobar-token-instagram.yml` existe justo para cazar eso.
4. *Generar nuevo token* → elegir la App → marcar `instagram_basic`,
   `instagram_content_publish`, `instagram_manage_insights`,
   `pages_show_list`, `pages_read_engagement` y, desde el 2026-10-09 (para
   publicar también en la Página de Facebook), `pages_manage_posts`.
5. Guardarlo: `gh secret set META_PAGE_ACCESS_TOKEN` (lo pide por stdin, así
   no pasa por ningún chat ni queda en el historial de comandos).
6. Actions → **Comprobar token de Instagram** → *Run workflow*. Tiene que
   decir `Caducidad: NO CADUCA ✅`. **Si sale una fecha, el token no sirve** —
   es el mismo error del 19-sep.

**Vía alternativa, si no hay Business Manager** (token de página derivado de
uno de usuario de larga duración; también deja de caducar, pero con más
pasos):
1. Graph API Explorer → generar token con los 5 permisos de arriba (sale de
   corta duración, ~1h — **este es el que NO hay que guardar**).
2. Canjearlo por uno de usuario de 60 días:
   `GET /oauth/access_token?grant_type=fb_exchange_token&client_id=<APP_ID>&client_secret=<APP_SECRET>&fb_exchange_token=<TOKEN_CORTO>`
3. Con ese: `GET /me/accounts?access_token=<TOKEN_LARGO>` → buscar la página
   `1260025797202453`; su campo `access_token` es un **Page token que ya no
   caduca**.
4. Guardarlo y verificarlo igual que en la vía recomendada (pasos 5 y 6).

**Los 2 borradores que había pendientes de aprobación están muertos**: un
contenedor de la Content Publishing API caduca solo a las 24h y eran del 21
y 23 de septiembre. Cuando el token funcione hay que regenerarlos
(`robot-marketing-instagram.yml` a mano), no intentar publicarlos.

## Exposición corregida: `/.github/` se servía en público (2026-09-25)

Encontrada aplicando la propia regla de este fichero ("revisar
`_middleware.js` cada vez que se cree un fichero interno nuevo"): al añadir
`comprobar-token-instagram.yml` se comprobó la ruta en producción y
**`https://costaviva.org/.github/workflows/daily-report.yml` respondía `200`
con el fichero completo**. Tercera vez que aparece el mismo hueco, después
de `/functions/` (2026-09-13) y `/scripts/` (2026-09-18).

Sin fuga de secretos —sus valores nunca están en el YAML, solo referencias
`${{ secrets.X }}`— pero sí quedaba público: los **nombres de todos los
secrets**, el email de la cuenta de servicio de Google Cloud, la **ruta
completa del Workload Identity Provider con su número de proyecto**, y los
prompts e instrucciones internas de todos los robots. Corregido añadiendo
`/.github/` a `PREFIJOS_BLOQUEADOS` en `functions/_middleware.js`.

**Nota para la próxima vez**: Cloudflare Pages **sí sirve directorios que
empiezan por punto**. No dar por hecho que un `.algo/` queda fuera del
despliegue por convención — hay que bloquearlo explícitamente, igual que
cualquier otro directorio interno.

## Rutas públicas por lista blanca + robot de mejores prácticas (2026-09-25)

Dos cambios del mismo día que se apoyan el uno en el otro.

### Lista blanca de rutas (`functions/_lib/rutas-publicas.js`)

`_middleware.js` decidía qué servir con una lista NEGRA. Ese diseño falló
**tres veces**, siempre igual — alguien añade un fichero y nadie se acuerda
de bloquearlo: `CLAUDE.md` y `functions/` (2026-09-13), `scripts/`
(2026-09-18) y `.github/workflows/` (2026-09-25, con los nombres de todos
los secrets, el email de la cuenta de servicio de Google Cloud y la ruta del
Workload Identity Provider).

Migrado al patrón de Pólizas.ai, que hizo lo mismo el 2026-09-10 tras servir
sin querer un JSON con datos reales de usuarios. **Lo que cambia no es
cuánto bloquea cada enfoque, sino cómo falla cuando se te olvida algo**: con
lista negra el olvido expone información en silencio y puede tardar meses en
descubrirse; con lista blanca rompe una página y se nota en la siguiente
prueba.

**Si añades una página, un endpoint o una carpeta de assets, tiene que
entrar en `rutas-publicas.js` o dará 404.** Es deliberado.

Dos detalles que solo se descubren probando contra un despliegue real:

- Cloudflare redirige (308) `/x.html` a `/x`, e `/index.html` a `/`. Hacen
  falta **las dos formas** en la lista: la `.html` para que el middleware no
  corte la petición antes del redirect, y la corta porque es la que el
  navegador acaba pidiendo. Dejarse una rompe la página de forma confusa.
- `/assets/` es público **entero** a propósito: incluye las imágenes del
  robot de marketing, que **Instagram descarga por URL** al crear el
  borrador. Bloquearlas rompería el robot.

Verificado en producción: 20 rutas que deben funcionar responden 200, y 12
internas dan 404. (Durante el despliegue, una comprobación dio un 200
espurio en `/package.json` — era propagación a medias; repetida tres veces
después, 404 consistente. **No dar por buena una única comprobación hecha
justo al desplegar.**)

### Robot de mejores prácticas → movido a `Mikel1972/comun` (2026-10-07)

Hasta el 2026-10-07 vivía aquí como `robot-mejores-practicas.yml` (semanal,
`claude -p` pagado con saldo de API, secret `GH_PAT_MULTIPROYECTO`). Ahora es
la rutina **"comun"** del plan de Claude (domingos), con sus instrucciones en
`rutina-comparativa.txt` del repo `Mikel1972/comun`, que no pertenece a
ninguna app: si Costaviva se abandona, no se pierde. `COMPARATIVA_PROYECTOS.md`
y `SALDO_API.md` también viven allí. El secret `GH_PAT_MULTIPROYECTO` de este
repo ya no lo usa nadie.

## Rayos: panel sencillo de un toque (2026-10-08)

Mikel: "la pestaña de rayos es poco ágil de manejar". Antes: panel lateral
que tapaba ~60 % del mapa en el móvil, frase "a 27 km del centro del mapa"
sin rumbo, botón "Ocultar este panel" y una vista grande aparte de la imagen
de AEMET con scroll y + / −. Ahora:
- Un toque en ⚡: se elige la referencia (spot abierto > GPS solo si ya hay
  permiso, nunca se pregunta > centro del mapa), se acerca ahí si el zoom
  era < 7, se consulta `/rayos-cerca` en ESE punto y, la primera vez que hay
  rayos, el mapa se encuadra con la referencia y la tormenta más cercana
  (punto de borde oscuro + línea discontinua hasta el rayo).
- Tarjeta abajo (`#rayosHoja`, la primera del dock de tarjetas del mapa,
  ver "Tarjetas del mapa en un dock"; no tapa la atribución): una frase
  ("⚡ Rayo más cercano: 12 km al NO de ti · hace 3 min" / "Sin rayos a menos
  de 100 km en los últimos 5 min"), color por distancia (≤15 km rojo, ≤40
  ámbar), leyenda de una línea y un ⓘ con el conteo, la hora del satélite,
  las fuentes y el enlace a la imagen de AEMET de 12 h (`/rayos-imagen`, en
  pestaña nueva: es lo único que añade, el histórico). Tocar la frase
  vuelve a encuadrar.
- Coste igual o menor: una consulta al abrir, una por minuto y otra solo si
  el centro se aleja > 40 km de la referencia (antes, en cada `moveend`).
- Lógica pura en `assets/js/rayos.js` (vía `window.Rayos`), tests en
  `test/rayos-resumen.test.js`. La frase dice "5 min" porque es lo que da
  Xweather: no prometer "la última hora".
- `#avisoRayos` (banner de riesgo por spot) no cambia.

## Rayos: tiempo real con Xweather + satélite EUMETSAT de fondo (2026-10-03)

El botón **Rayos** pinta dos capas sobre el propio mapa (la imagen nacional de AEMET de 12 h queda como enlace en el ⓘ, ver la sección de arriba):
- **Satélite (gratis, ~15 min de retraso)**: WMS de EUMETView `mtg_fd:li_afa` (Lightning Imager de MTG/EUMETSAT), últimos 6 tramos de 5 min. Sin tarifas ni restricciones, CC BY 4.0, CORS abierto. Color = intensidad (amarillo → rojo oscuro), no antigüedad. **TIME siempre explícito**: EUMETView manda `cache-control` de 7 días.
- **Tiempo real (Vaisala Xweather)**: `functions/rayos-cerca.js`, rayos de los últimos 5 min a menos de 100 km, en morado. Solo con el mapa acercado (zoom ≥ 7), al soltar el mapa y como mucho cada minuto. Exige sesión.
- **Coste**: cada consulta de rayos a Xweather cuesta 0,006 $ y solo hay 1.500 gratis al mes. El usuario eligió no pasar de lo gratuito: tope `LIMITE_MENSUAL = 1400` en `rayos-cerca.js`, contado de forma atómica en `rayos_xweather_uso` (`reservar_consulta_rayos`) **antes** de llamar, y caché compartida de 60 s por celda de 0,5° en `rayos_xweather_cache`. Al llegar al tope, o sin claves, el endpoint responde `fuente: limite|no_configurado|error` y el mapa se queda con el satélite. Para subir el tope: cambiar `LIMITE_MENSUAL` (y tener tarjeta en Xweather).
- **Descartado**: Blitzortung/LightningMaps prohíben el uso comercial (Costaviva es de pago). El endpoint `lightning/within` (consulta por caja, para toda la costa) exige el plan Enterprise de Xweather.
- Claves en Cloudflare Pages: `XWEATHER_CLIENT_ID`, `XWEATHER_CLIENT_SECRET` (nunca en el repo ni en el chat). Atribución obligatoria "Vaisala Xweather" (se añade al control de atribución del mapa al activar la capa).

## Invitaciones con descuento (2026-10-08, aprobado por Mikel)

`admin.html` → "Invitar / dar descuento": email, descuento 0-100 %, duración
(1/3/6/12 meses, para siempre o hasta una fecha), caducidad (30 días por
defecto) y nota interna. Lista con estado y acciones reenviar/anular.

- **Tabla** `public.invitaciones` (migración `20261008170000_invitaciones.sql`):
  RLS sin policies, solo `service_role` y funciones definer. El estado
  (enviada/inscrito/caducada/terminada/anulada) no se guarda: lo deduce
  `estadoInvitacion()` de las fechas (`functions/_lib/invitaciones.js`).
- **Endpoints**: `/admin-invitaciones` (GET lista; POST crear/reenviar/anular)
  exige sesión + `es_admin()` en el servidor (`functions/_lib/admin.js`) antes
  de usar `service_role`. `/canjear-invitacion` lo llama `login.html` en cuanto
  hay sesión: el email sale del token, nunca del cuerpo; un solo uso con un
  UPDATE condicionado a `user_id is null`.
- **Código**: 12 caracteres sin I/O/0/1 (60 bits), en la URL del email
  (`/login?alta=1&invitacion=...`), recordado en `localStorage` y en el
  metadato del alta por si confirma el email en otro navegador.
- **100 %**: sin tarjeta. Al canjear se fija `acceso_hasta` (null = siempre) y
  `mi_estado_suscripcion()` devuelve `estado: 'invitacion'`. Queda fuera del
  ciclo de fin de prueba para siempre; 7 días antes del final le llega el
  aviso "suscríbete" (paso "fin de invitación" de `avisar-fin-prueba.js`, mismo
  cron sin IA de `notificar-altas.yml`, con `AUTOMATION_PAUSED`).
- **1-99 %**: al crear la invitación se crea un **cupón** de Stripe
  (`max_redemptions=1`, `redeem_by` = caducidad, `forever` o `repeating`; "hasta
  una fecha" = meses redondeados hacia arriba). No hay código de promoción: el
  cupón lo aplica `crear-checkout-stripe.js` solo si `mi_invitacion_descuento()`
  (con el token de quien paga) lo devuelve, así que no se puede usar desde otra
  cuenta. En anual solo se aplica si dura 12 meses o más (el año se cobra de
  una vez). El webhook marca `descuento_aplicado_en` con `metadata.invitacion_id`.
  Al acabar el descuento Stripe cobra el precio normal solo.
- **Ojo test/live (trampa 2)**: un cupón creado con la clave de test no existe
  en live. Las invitaciones con cupón creadas en preview con clave de test no
  valen en producción.

## Acceso permanente sin suscripción: tabla `accesos_permanentes` (2026-10-01)

Para dar acceso completo para siempre a una cuenta concreta sin hacerla admin (primer caso: `maetxe2018@gmail.com`, pedido del usuario). Por email, así que vale aunque la persona aún no se haya dado de alta. `mi_estado_suscripcion()` devuelve `estado: 'permanente'` y `con_acceso: true`, y `fin_prueba_fuera_de_ciclo()` la excluye de recordatorio y desactivación. Para añadir o quitar a alguien: migración nueva con `insert`/`delete` en `public.accesos_permanentes` (email en minúsculas). Sin políticas RLS: solo la leen funciones security definer. Al añadir a alguien le llega solo, una vez, el email "¡Tienes enchufe!" (paso "acceso permanente" de `avisar-fin-prueba.js`, columna `avisado_en`).

## Fin de prueba: o se suscribe o su cuenta queda desactivada (2026-09-28)

Pedido explícito del usuario: "hay un periodo de prueba de 7 días sin
cobrar. A ese vencimiento, o se da de alta o se le cancela". Sustituye al
aviso DESPUÉS de vencer que había desde el 2026-09-25: ahora se avisa antes.

Calendario, contado desde el alta (`perfiles.creado_en`, la misma referencia
que `mi_estado_suscripcion()`):

| Día | Paso | Qué pasa |
|---|---|---|
| alta | bienvenida | email con la fecha de fin de prueba (en cuanto confirma el email) |
| 5 | recordatorio | email "tu prueba termina el X" — guarda esa fecha en `desactivar_previsto_en` |
| 7 | desactivar | email de fin de prueba, `perfiles.desactivado_en` y aviso al admin |

**Desactivar NO bloquea el login ni borra nada — decisión del usuario, no lo
cambies sin preguntar.** Se llegó a montar un bloqueo de login + borrado a
los 14 días; se descartó el mismo día: con el login bloqueado no podrían ni
pagar para volver, y el usuario quiere conservar tanto la cuenta como los
datos generados ("pasan a nuestra base de conocimientos" — en la práctica,
sus capturas siguen alimentando `estadisticas_anonimas_capturas` si dieron
`consiente_uso_datos_capturas` en el alta, como ya pasaba). El acceso lo
corta el paywall (`mi_estado_suscripcion()`), que ya lo hacía antes: al
suscribirse lo recuperan todo al instante. `desactivado_en` es la constancia
de que su prueba terminó y se le avisó.

Todo vive en `functions/avisar-fin-prueba.js` (mismo cron de
`notificar-altas.yml`) y en la migración `20260928120000`. Las listas de a
quién le toca cada email las decide Postgres (`usuarios_bienvenida_pendiente_email`,
`usuarios_fin_prueba_pendiente_*`). El popup de bienvenida de `index.html` y
el estado de `suscripcion.html` cuentan lo mismo.

- **Nunca entran en el ciclo** (`fin_prueba_fuera_de_ciclo()`): el admin, los
  alias `etxebe2005+...` (cuentas de `smoke-test.yml`/`auth-test.yml`) y quien
  haya tenido alguna vez una suscripción real (cualquier fila en
  `suscripciones` salvo `incomplete`/`incomplete_expired`). **Ex-suscriptor
  que cancela (decidido 2026-09-28): pierde el acceso y nada más** — lo hace
  ya el paywall: `stripe-webhook.js` guarda `canceled` al llegar
  `customer.subscription.deleted` (al final del periodo pagado) y
  `mi_estado_suscripcion()` solo da acceso con `trialing`/`active`.
- **Nunca se desactiva antes de lo que prometió el email**: sin recordatorio
  enviado (Resend confirmado) no hay fecha. Si el recordatorio sale tarde, la
  fecha es `greatest(día 7, recordatorio + 2 días)`. Quien nunca confirmó su
  email no recibe nada.
- **Guarda de volumen**: más de 10 recordatorios o desactivaciones en una
  pasada → ese paso no se ejecuta, workflow en rojo y email al admin.
- **Al aplicar la migración**, los usuarios de antes con la prueba ya vencida
  y sin suscripción reciben el recordatorio en la primera pasada y el email
  de fin de prueba 2 días después. El número sale en el log de "Aplicar
  migraciones" (`NOTICE`). Los perfiles existentes no reciben la bienvenida.

## Supervisor del saldo de API de las 4 apps (2026-09-28)

Pedido explícito del usuario: bajar el gasto de la API de Anthropic, que
comparten Costaviva, Pólizas.ai, Etxeapala y Lurnahi, a unos **20 €/semana
entre todas**, sin perjudicar ninguna funcionalidad. El saldo se agotó 6 veces
en 13 días; la auditoría de ese día estimó que los robots de Costaviva eran
la mayor parte del gasto (el buscador de fuentes solo, 32 sesiones/semana).

Desde el 2026-10-07 vive en `Mikel1972/comun`: el auditor sin IA
(`scripts/saldo/auditar-consumo-api.mjs`, reglas R1-R8) lo ejecuta la rutina
semanal "comun", que escribe allí `SALDO_API.md` y propone los recortes en
`COMPARATIVA_PROYECTOS.md`. **Nunca propone quitar funcionalidad**; aplicar
sigue siendo decisión humana.

**Recortes aplicados el mismo día** (estimado de robots: ~69 → ~6 €/semana,
sin quitar ningún robot):
- `robot-buscador-fuentes.yml`: de 32 a 6 pasadas/semana (una al día salvo
  lunes, área según el día). Mareas/oleaje fuera: los cubre la rutina nocturna
  de calibración. **Hecho (2026-10-02)**: corre como la rutina "Costaviva -
  Buscador de fuentes" del plan de Claude (creada por el usuario en
  claude.ai/code/routines con `scripts/saldo/rutina-buscador-fuentes.txt`;
  primera pasada buena el 2026-09-29, commit 426b3d8). El workflow se queda
  sin schedule, solo con `workflow_dispatch` de respaldo manual. Ojo: una
  rutina creada por un agente (`create_trigger`) nace sin repo y no puede
  hacer push; tiene que crearla el usuario.
- `robot-camaras-caidas.yml`, `robot-patrones-uso.yml`,
  `robot-experiencia-usuario.yml` (este además semanal): arrancan fuera del
  repo.
- `daily-report.yml`: la síntesis ya no llama a Claude si los robots no
  escribieron nada en 24 h; si lo hay, fuera del repo, Sonnet 5, 8 turnos.

**Para cualquier robot nuevo de CLI**: arrancarlo desde un directorio vacío
(`mkdir -p /tmp/sesion-X && cd /tmp/sesion-X`, repo por `$GITHUB_WORKSPACE`)
para no cargar este `CLAUDE.md` en cada turno, fijar `--model` y
`--max-turns`, y no leer enteros `ROBOT.md` (~470 KB) ni ficheros grandes.
El auditor lo marcará si no.

**Robots a rutinas, sin API en las pasadas programadas (2026-10-08, Mikel
aprobó las propuestas de `GASTO.md` de `comun`).** Ninguna pasada programada
llama ya a la API de Anthropic. El paso de Claude de los 5 workflows solo
corre a mano con el input `respaldo_api` marcado (por defecto, apagado);
`test/robots-sin-api.test.js` (en `tests.yml`) falla si un paso con
`ANTHROPIC_API_KEY` o el CLI de Claude pierde esa condición. Las rutinas las
crea Mikel en claude.ai/code/routines con el repo conectado (una creada por
un agente nace sin repo):

| Workflow (sin IA) | Qué deja en el repo | Rutina del plan (prompt) | Cron de la rutina |
|---|---|---|---|
| `robot-camaras-caidas.yml` (05:23 UTC, solo vigila y avisa) | lee `datos-robots/camaras-estado.json` de `camaras-salud.yml` | Cámaras caídas (`scripts/saldo/rutina-camaras-caidas.txt`) | la que ya tiene |
| `daily-report.yml` (sin síntesis si la rutina no la dejó) | usa `datos-robots/sintesis-informe.md` | Síntesis del informe diario (`scripts/saldo/rutina-sintesis-informe.txt`) | la que ya tiene |
| `robot-buscador-fuentes.yml` (sin schedule) | — | Buscador de fuentes (`scripts/saldo/rutina-buscador-fuentes.txt`) | la que ya tiene |
| `robot-experiencia-usuario.yml` (domingo 21:30 UTC) | `datos-robots/experiencia/ultima.json` (`scripts/experiencia/sondear.mjs`) | Experiencia de usuario (`scripts/saldo/rutina-experiencia-usuario.txt`) | `CRON_TZ=Europe/Madrid 28 7 * * 1` |
| `aprendizaje-semanal.yml` (lunes 04:41 UTC, pg_cron) | `aprendizaje/` y `datos-robots/aprendizaje/` (solo agregados) | Investigador semanal (`scripts/saldo/rutina-investigador-semanal.txt`) | `CRON_TZ=Europe/Madrid 47 8 * * 1` (pendiente de crear) |
| `robot-patrones-uso.yml` (viernes 22:12 UTC) | `datos-robots/patrones-uso/ultima.json` (`scripts/patrones-uso/agregar.mjs`, solo agregados) | Patrones de uso (`scripts/saldo/rutina-patrones-uso.txt`) | `CRON_TZ=Europe/Madrid 13 11 * * 6` |

El repo es público: lo que se vuelca a `datos-robots/` va sin tokens, sin
`user_id` ni emails, y los valores de menos de 2 usuarios se ocultan.
`datos-robots/` no se sirve en la web (lista blanca de
`functions/_lib/rutas-publicas.js`).

## Regla para futuros endpoints con `service_role` (2026-09-25)

Propuesta 5 de la comparativa entre proyectos. **Hoy no hay ningún hueco**:
los dos sitios que usan `service_role` (`notificar-altas.js`,
`stripe-webhook.js`, y desde hoy `avisar-fin-prueba.js`) no construyen
filtros de PostgREST a partir de input variable. Se anota antes de que haga
falta, que es cuando sirve.

Cuando se escriba un endpoint nuevo con `service_role` **y algún parámetro
dinámico** dentro de un filtro, copiar el patrón de Lurnahi
(`approve-delete.js`): **validar el formato del identificador** (que un UUID
sea un UUID) y **usar una lista blanca de nombres de tabla** antes de
interpolar nada en la query. Con `service_role` no hay RLS que pare un
filtro más amplio de lo previsto: lo único que protege es lo que valide el
propio endpoint.

Es exactamente el mismo criterio que la lista blanca de rutas — lo no
previsto se rechaza por defecto, en vez de confiar en haber pensado en todos
los casos malos.

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
- Códigos de invitación/descuento: existen desde el 2026-10-08 (ver
  "Invitaciones con descuento"). Cuentas compartidas tipo "tripulación":
  todavía no.

## Trampas compartidas y regla de coste (2026-10-07)

Lo común a los 4 proyectos (Costaviva, Pólizas.ai, Etxeapala, Lurnahi) vive en
el repo `Mikel1972/comun`, que no pertenece a ninguna app.

**Regla fundamental de Mikel: todo lo posible contra la suscripción; los
tokens de la API, al mínimo funcionalmente válido.** Un robot con IA va como
rutina del plan de Claude, no como `claude -p` en GitHub Actions. Lo que no
necesita IA va sin IA. Detalle en `CLAUDE.md` de `comun`.

En cada **sesión interactiva** de Claude Code:

0. **Seguir los estándares.** Antes de tocar login, alta, recuperación de
   contraseña o CAPTCHA, emails, Stripe, Supabase (RLS, funciones,
   migraciones), llamadas a Claude o robots, rutas públicas y cabeceras, o
   pruebas y alertas, lee `estandares/<tema>.md` de `comun` y sigue su "mejor
   implementación". `CONFORMIDAD.md` de `comun` dice qué incumple hoy este
   proyecto: si tocas algo de esa lista, arréglalo de paso.
1. **Usar `TRAMPAS_COMPARTIDAS.md`.** Antes de tocar Supabase (RLS, policies,
   funciones), secrets de Cloudflare, Stripe, llamadas a Claude o
   robots/crons, añade `comun` a la sesión (`add_repo`), clónalo, mira los
   títulos (`grep -n '^## '`) y lee solo la sección que aplique. Si otro
   proyecto ya lo tiene resuelto, lee cómo antes de escribir nada.
2. **Aportar.** Cuando algo falle aquí en producción y pueda pasar en los
   otros proyectos, añádelo allí con fecha, el caso real y qué proyecto lo
   tiene resuelto. Rama + PR + merge en `comun` (autorizado por Mikel).
