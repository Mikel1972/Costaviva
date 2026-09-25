# ROBOT_REGLAS.md — reglas estables del robot de datos de Costaviva

Este fichero contiene solo las reglas de negocio vigentes para el robot de
investigación/auditoría de datos. Se reescribe libremente cuando el
usuario afina un criterio — no es un historial (para eso está `ROBOT.md`).

- Nunca inventar un dato. `null`/sin-dato es siempre preferible a un
  número inventado, tal como pide el resto del proyecto.
- Fuente nueva de bajo riesgo y fácil de integrar (endpoint tipo
  `functions/*.js` siguiendo el patrón existente) → intégrala e implementa
  en una rama `robot/AAAA-MM-DD`, verifica con `node --check` antes de
  commitear.
- Cualquier cosa que cambie mucho el frontend, el diseño del mapa, o que
  sea una decisión de producto → no implementar, solo proponer aquí. Con
  UNA excepción acotada (ver la sección "Cámara con mar a la vista" más
  abajo): una cámara con mar a la vista sí se integra siempre, y si no
  existe spot para ella, el spot se crea en esa misma pasada.
- Corrección de auditoría trivial (un campo de un JSON, una URL que
  cambió de dominio) → corregir directamente. Cualquier otra cosa →
  proponer.
- El factor de corrección de calibración nunca se aplica en automático:
  siempre es una propuesta a confirmar por el usuario.
- **Candidatos a webcam nueva, priorizados (añadido 2026-09-13, pedido
  explícito del usuario)**: antes de buscar cámaras a ciegas, mira
  primero `spots_usuario` (tabla de ubicaciones personalizadas, ver
  Fase 2 en `CLAUDE.md`) — prioriza las que tengan más actividad real
  asociada (más `salidas_pesca`/`capturas` con ese `spot_usuario_id`,
  o simplemente las más recientes si no hay forma fácil de contar
  actividad todavía) como candidatas para investigar webcam antes que
  spots aleatorios de la lista fija. Sigue aplicando todo lo demás de
  este fichero (nunca inventar una URL, límite de volumen, proponer si
  no es trivial).
- **Cámaras que rotan y pueden enseñar tierra en vez de mar (añadido
  2026-09-15, bug real reportado por el usuario)**: vio una webcam de
  **imagen fija** (no las 6 de vídeo HLS de Gipuzkoa, esas van bien —
  "a ratos dan la playa pero no pasa nada" es normal en un vídeo en
  directo) mostrando solo la playa/tierra en vez del mar — probable
  cámara física que rota/PTZ (pan-tilt-zoom) entre varios encuadres, y
  la foto de esa hora en concreto cayó apuntando a tierra. **No
  intentar arreglarlo con visión artificial** (clasificar "esta foto es
  mar/no es mar") — ya se probó ese enfoque para el oleaje visual y se
  quitó el 2026-09-15 por poco fiable (confundía barcos/edificios con
  oleaje), mismo riesgo aquí. En vez de eso, revisar CADA cámara de
  imagen fija de `functions/webcam/[slug].js` (~40 entradas) para
  comprobar: (1) si el proveedor documenta que esa cámara es rotativa/
  PTZ (a veces lo dice en su propia web), y (2) si su URL/API soporta
  pedir un encuadre o preset concreto (muchos sistemas PTZ tienen un
  parámetro tipo `?preset=` o una URL distinta por posición) que se
  pueda fijar apuntando siempre al mar, en vez de la última posición de
  rotación. Si se encuentra una URL de preset real y verificable con
  una petición HTTP, es una corrección de auditoría trivial (cambiar la
  URL en `WEBCAMS`) — aplicar directo. Si no existe esa opción para una
  cámara en concreto, dejarlo anotado en `ROBOT.md` como limitación
  conocida de esa cámara, nunca inventar un parámetro que no esté
  documentado ni verificado.
- **Fallos correlados por proveedor, nunca N problemas sueltos (añadido
  2026-09-19, caso real)**: `camara-salud.yml` (comprobación cada 30 min,
  ver `supabase/migrations/20260918120000_camara_estado.sql` y
  `20260918130000_camara_estado_frame_congelado.sql`) marcó a la vez
  "sin señal" a bakio+sopelana+pasaia+getaria (mismo proveedor AZTI/
  detectia.net, las 4 con frame congelado) y por separado a las 6
  cámaras de Cantabria (`cantabria.es`, las 6 con `http_502`) el mismo
  día — confirmado revisando el log real del workflow, no una
  suposición. **Antes de investigar o proponer nada sobre una cámara
  marcada "sin señal", agrupa las que fallan por proveedor/dominio real
  (mirar la URL en `WEBCAMS`/`WEBCAMS_HLS`, no solo el nombre del
  spot)**: si varias cámaras del MISMO proveedor caen o se congelan a la
  vez, es una caída del proveedor entero, no una integración rota
  nuestra — no hace falta investigar cámara por cámara ni buscar
  reemplazo el mismo día, solo anotarlo en `ROBOT.md` con la lista de
  cámaras afectadas y el proveedor común, y comprobar en la siguiente
  pasada si se ha recuperado solo (lo normal). Solo tiene sentido buscar
  una fuente alternativa para una cámara en concreto si ESE proveedor
  lleva fallando de forma repetida durante varios días/semanas — un
  patrón real de abandono, no un bache puntual.
- **Buscar webcams fuera de las redes/agregadores nacionales, no solo
  ampliar los proveedores ya conocidos (añadido 2026-09-19, pedido
  explícito del usuario tras un caso real)**: `sopelana` lleva desde
  2026-09-13 con la webcam de AZTI/detectia.net (que se congela con
  cierta frecuencia, ver regla anterior), pero el propio ayuntamiento
  (`https://sopela.eus/webcam-olas/`) tiene SU PROPIA cámara en directo
  vía IPCamLive, nunca encontrada en ~6 días de pasadas de "cámaras"
  porque las búsquedas hasta ahora se centraban en ampliar proveedores
  ya integrados (AZTI/detectia.net, cantabria.es...) en vez de mirar
  población por población. Para cada spot fijo SIN cámara todavía, y
  también para los que ya tienen una pero de un proveedor con historial
  de caídas (ver regla anterior), añadir a la búsqueda: `"<nombre del
  pueblo/playa>" webcam directo`, y revisar explícitamente la web del
  ayuntamiento/turismo local y de escuelas de surf/clubs náuticos de esa
  población — no solo repetir búsquedas de agregadores ya conocidos.
  Patrón útil ya visto en real: una web local embebe un reproductor de
  un proveedor de streaming genérico (IPCamLive, YouTube Live, etc.) —
  hay que mirar el HTML/JS de la propia página (`curl` con
  `-A "Mozilla/5.0"`, un `<iframe>`/`<script>` con `src=`) para sacar la
  URL real del stream/snapshot, la página del ayuntamiento en sí casi
  nunca sirve la imagen directamente. Sigue aplicando todo lo demás de
  este fichero (verificar con una petición HTTP real antes de proponer o
  integrar, nunca inventar una URL).
  **Diccionario de tipos de entidad (fuente de los términos de
  búsqueda, añadido/formalizado 2026-09-20, pedido explícito del
  usuario)**: la razón de que "webcam surf" o "webcam ayuntamiento"
  funcionen no es casualidad de la palabra en sí — es que revelan qué
  TIPO de entidad no oficial suele colgar una webcam por su cuenta
  (escuela de surf, ayuntamiento pequeño, cofradía de pescadores...).
  La lista de modificadores de abajo es la traducción a término de
  búsqueda de este diccionario de tipos, no una lista de palabras
  sueltas elegidas al azar. **Cada vez que se integra o propone una
  cámara nueva, clasifica de qué TIPO de entidad es su dueño** (mirar
  el dominio/titularidad de la página, no hace falta leer el texto de
  la página en detalle) contra los tipos ya conocidos:
  - Ayuntamiento / turismo local
  - Escuela de surf / surf school
  - Cofradía de pescadores / puerto pesquero
  - Club náutico / puerto deportivo (categoría candidata, sin ningún
    caso real confirmado todavía — la lógica es la misma que cofradías:
    suelen tener cámara de sus instalaciones/bahía)

  Si la cámara nueva encaja en un tipo YA conocido, no hace falta hacer
  nada más aquí (el término correspondiente ya está en la lista). Si es
  un tipo de entidad genuinamente NUEVO (no encaja en ninguno de
  arriba), añádelo a esta lista con el caso real que lo confirmó, deriva
  de él un término de búsqueda nuevo (`webcam <tipo>`) y méteselo a la
  lista de modificadores de abajo con el mismo protocolo de
  promoción/poda que el resto — así el diccionario crece solo con cada
  cámara nueva, en vez de depender de que el usuario proponga la
  siguiente palabra a mano.

  **Lista de modificadores de búsqueda, en expansión constante (pedido
  explícito del usuario 2026-09-19: "si con surf encuentro cámaras que
  me valen, el robot debe incluir surf para buscar más")** — para cada
  población de la zona del día, combinar el nombre con CADA uno de
  estos términos (no solo "webcam directo"), y si uno nuevo (no listado
  aquí) resulta productivo (encuentra una cámara real que se termina
  integrando o proponiendo), AÑADIRLO a esta lista con una nota de qué
  población lo confirmó — así la propia lista de búsqueda mejora sola
  con cada pasada, sin que haga falta que el usuario lo pida cada vez:
  - `webcam directo` (línea base, ya en uso)
  - `webcam surf` — tipo de entidad: escuela de surf. Confirmado
    productivo 2026-09-19: encontró escuelas de surf con cámara propia
    en Plentzia/Bakio/Zarautz/Zurriola/Muskiz/Laga/Arrigunaga
    (`escueladesurfsopelana.com`) y en Santoña/playa de Berria
    (`watsaysurfschool.com`) — las escuelas de surf resultaron de las
    fuentes más fiables de todo el día (dueño identificado, cámara
    fija, buena resolución). Recuento por zona: Galicia — Rías Altas
    (A Coruña, Ribadeo — con resultado parcial: apareció Razo Beach,
    `artsurfcamp.com`, pero es una playa distinta en Carballo, no el
    spot de A Coruña; no se propone para ese spot, solo confirma que
    el término sigue vivo); Galicia — Rías Baixas (A Guarda, Sanxenxo —
    sin resultado: Riders Surf School en Sanxenxo solo enlaza a una
    cámara externa rota (`camaramar.com/spots/foxos.html`, 404),
    ninguna escuela de surf con cámara propia confirmada en ninguna de
    las dos poblaciones).
  - `webcam ayuntamiento` — tipo de entidad: ayuntamiento/turismo
    local. Confirmado productivo 2026-09-19: Zumaia (zumaia.eus),
    Sopela (sopela.eus), turismo de Castro-Urdiales. Recuento por
    zona: Galicia — Rías Altas (A Coruña, Ribadeo — sin resultado, solo
    agregadores comerciales tipo camaramar.com/g24.gal, ningún
    ayuntamiento con cámara propia); Galicia — Rías Baixas (A Guarda,
    Sanxenxo — sin resultado: `turismoaguarda.es` solo enlaza a
    CRTVG/`g24.gal`, ningún ayuntamiento con cámara propia).
  - `webcam pesca` / `webcam puerto` / `webcam cofradía de pescadores`
    — tipo de entidad: cofradía de pescadores/puerto pesquero.
    Sugeridos por el usuario 2026-09-19. **Confirmado productivo
    2026-09-20**: Asturias (Llanes/Ribadesella) — Puerto de Llanes, en
    colaboración real con la Cofradía de Pescadores Santa Ana de
    Llanes (cámara real encontrada, aunque no se pudo integrar por el
    backend `rtsp.me`, ver zona Asturias más abajo) — el término se
    queda activo indefinidamente. Recuento por zona: Asturias (con
    resultado); Galicia — Rías Altas (A Coruña, Ribadeo — con
    resultado: Puerto de Ribadeo, mismo bloqueo técnico `rtsp.me` que
    Asturias, ver zona Galicia más abajo); Galicia — Rías Baixas
    (A Guarda, Sanxenxo — sin resultado: la Cofradía "Santa Tecla" de A
    Guarda existe pero sin webcam propia asociada, ninguna cofradía con
    cámara encontrada en ninguna de las dos poblaciones).
  - `webcam club náutico` / `webcam puerto deportivo` — tipo de
    entidad: club náutico/puerto deportivo. Añadido 2026-09-20.
    **Confirmado productivo el mismo día**: Asturias (Ribadesella) —
    Puerto deportivo de Ribadesella / Club Náutico Arra (cámara real,
    mismo problema de integración que arriba) — término activo
    indefinidamente. Recuento por zona: Asturias (con resultado);
    Galicia — Rías Altas (A Coruña, Ribadeo — con resultado: Real Club
    Náutico de Ribadeo, mismo bloqueo `rtsp.me`); Galicia — Rías Baixas
    (A Guarda, Sanxenxo — con resultado: Club Náutico de Portonovo
    (Sanxenxo) tiene página propia con dos cámaras reales embebidas,
    aunque ambas rotas/no en directo — ver zona Galicia — Rías Baixas
    más abajo; A Guarda sin club náutico con cámara).

  **Poda de términos improductivos — protocolo mecánico, sin juicio
  subjetivo (pedido explícito del usuario 2026-09-19, versión final
  tras descartar un primer intento basado en "si tenía sentido
  probarlo ahí" por ser demasiado subjetivo)**: probar cada término en
  **exactamente 2 poblaciones por zona, en las 10 zonas de la
  rotación** (ver la lista en `robot-buscador-fuentes.yml`) — sin
  excepciones ni criterio propio sobre si una zona "pinta bien" o no
  para ese término, siempre las mismas 2 por zona. Un término se
  retira de la lista activa únicamente cuando se ha probado así en las
  10 zonas (20 poblaciones en total) y no ha dado NINGÚN resultado en
  NINGUNA — si aparece aunque sea una sola cámara real en una sola
  población, el término se queda activo indefinidamente, no hace falta
  seguir contando fallos para él.

  Cómo llevar la cuenta: cada término de la lista lleva debajo su
  propio recuento por zona, formato `Zona — <nombre>: <2 poblaciones
  probadas> (sin resultado / con resultado)`. Se rellena una zona cada
  vez que la rotación automática (o una sesión interactiva) investiga
  esa zona y prueba el término en 2 de sus poblaciones — nunca antes,
  nunca de golpe simulando las 10. En cuanto un término tenga las 10
  zonas registradas y ninguna con resultado, muévelo (con su recuento
  completo) al apartado "Términos retirados" al final de esta sección
  y dejar de incluirlo por defecto en las búsquedas nuevas — el
  historial se queda ahí para poder revisarlo, nunca se borra.

### Términos retirados

(ninguno todavía)

## Cámara con mar a la vista → se integra siempre, y si no hay spot se crea (añadido 2026-09-25, pedido explícito del usuario)

Hasta hoy, una cámara verificada podía quedarse sin integrar por dos
motivos que no tenían nada que ver con su calidad:

- **No había spot para ella.** Crear un spot nuevo se trataba como decisión
  de producto. La pasada de Galicia del 2026-09-14 verificó 11 cámaras de
  MeteoGalicia (Burela, Viveiro/Penedo do Galo, Cariño, Cedeira/Punta
  Candieira, Narón/Aldea Nova, Arteixo/Langosteira, Ribeira/Sálvora,
  Vilanova/Corón, Marín/Aguete, Bueu/Ons, Poio/Castrove) y no integró
  ninguna, porque el norte de Lugo y Ferrolterra no tienen spot fijo. Eran
  cámaras reales, vivas y con mar a la vista, descartadas por un motivo
  puramente estructural. La pasada del 2026-09-21 volvió a pasar por esa
  misma zona y concluyó "no hay ningún spot fijo sin cámara aquí" — las 11
  seguían ahí sin tocar.
- **El límite de volumen le prohibía tocar `functions/`.** Una cámara de
  imagen fija vive en `WEBCAMS`, dentro de `functions/webcam/[slug].js` —
  así que la regla de "nunca aplicar nada en `functions/` directo" le
  impedía integrar cámaras **incluso para spots que ya existían**. Es lo
  que dejó las 7 cámaras de Windy Webcams de la pasada de Portugal del
  2026-09-23 en "sin integrar todavía" pese a estar verificadas y ser de
  spots fijos ya creados.

**Regla nueva, que sustituye a los dos criterios anteriores para el caso de
las cámaras:** si una cámara tiene mar a la vista y pasa las comprobaciones
de abajo, se integra **siempre**. Si no existe spot para ese punto, **el
spot se crea en la misma pasada** — ya no se propone, se hace. El resto del
fichero sigue igual: esta regla es una excepción acotada a las cámaras, no
un permiso general para tomar decisiones de producto ni para editar
`functions/` a discreción.

### Qué cuenta como "tiene mar a la vista"

Cuenta: mar abierto, playa, rompiente, acantilado con agua en el encuadre,
ría o estuario, bocana, y la dársena de un puerto o marina (se pesca desde
los muelles — el agua salada de un puerto es tan válida como una playa).

No cuenta: ríos de interior, embalses, piscinas, y vistas de monte o casco
urbano sin agua. Tampoco cuenta una cámara donde el mar es solo una franja
lejana en el horizonte: si del encuadre no se puede leer el estado del
agua, no aporta nada a la app.

**Se decide MIRANDO la imagen, nunca por el nombre de la cámara ni del
concello.** Una cámara llamada "playa de X" puede estar apuntando al paseo,
y una llamada "castillo de X" puede tener toda la bahía delante.
Descárgala a un fichero temporal y ábrela con la herramienta `Read` (esta
sesión sí ve imágenes). En `ROBOT.md` deja escrito en una frase qué se ve
de verdad en el encuadre ("playa con rompiente en primer plano", "dársena
del puerto, agua en calma") — es la prueba de que la comprobación se hizo.

Si la fuente es solo vídeo (HLS) y en esa pasada no se puede extraer un
fotograma, **no se crea el spot**: se propone en `ROBOT.md` diciendo
explícitamente que la comprobación visual no se pudo hacer. Sin ver el
encuadre no hay forma honesta de afirmar que tiene mar.

Antes de esto siguen aplicando, en este orden, las reglas que ya existen
más arriba en este fichero: cámara muerta (comprobar la fecha real de la
imagen con `Last-Modified`, no solo que responda 200), cámara rotativa/PTZ
que puede enseñar tierra, y fallos correlados por proveedor.

### Cómo se crea un spot nuevo

Solo cuando ya no queda duda de que la cámara es real, viva y con mar. Todo
lo de esta lista es **aditivo** — nunca se modifica ni se borra un spot o
una cámara que ya existan.

1. **Slug**: minúsculas, sin acentos, sin espacios ni guiones, y único.
   Mismo estilo que los que ya hay (`acoruna`, `castrourdiales`,
   `sanvicente`). El nombre visible sí lleva acentos y puede llevar
   paréntesis, como `"Vigo (Illas Cíes)"`.
2. **Coordenadas**: salen de una fuente real consultada en esa misma
   pasada (los metadatos del propio proveedor son lo mejor — la lista JSON
   de MeteoGalicia, por ejemplo, las trae), nunca estimadas a ojo sobre un
   mapa. Anota en `ROBOT.md` de dónde salieron. Dos detalles que importan:
   - La coordenada del spot es **el sitio donde se pesca** (la playa, la
     bocana, el muelle que vigila la cámara), no dónde está montada la
     lente. Una cámara en un monte a 3 km de la costa da un spot en la
     costa, no en el monte.
   - Tiene que estar **en el agua o justo en la orilla**. Si cae tierra
     adentro, la Marine API de Open-Meteo devuelve `null` en todo y el spot
     nace roto, sin oleaje ni marea ni temperatura.
3. **`SPOTS` en `index.html`** — **corregido 2026-09-25, al integrar
   Águilas: esto es más simple de lo que decía antes esta regla.** El array
   tiene dos bloques: los spots antiguos, en formato de objeto largo, y
   debajo un bloque **compacto** de `["slug", "Nombre", lat, lon],` que
   termina en un `.map()` (busca `].map(([slug, nombre, lat, lon])`) y que
   ya rellena solo todos los campos de siembra. **Un spot nuevo va SIEMPRE
   en el bloque compacto: una sola línea, nada más.** No copies el formato
   largo de los primeros ni escribas campos de siembra a mano — ese
   `.map()` se encarga, y así no hay forma de inventar un dato sin querer.
   (Tampoco hace falta preocuparse por lo que siembra: `indiceMar()`
   devuelve `null` —S/D en gris— hasta que el spot tenga un fetch real de
   `/prevision` de la última hora.)
4. **`SPOTS` en `functions/prevision.js`**: la misma entrada, pero ahí solo
   `slug`, `nombre`, `lat`, `lon`. Las dos listas tienen que cuadrar — si
   el slug no está en las dos, el backend nunca manda datos para ese spot y
   el frontend lo deja en S/D para siempre.
5. **Lista de especies por zona (`index.html`)**: añade el slug a
   `SPOTS_MEDITERRANEO`, `SPOTS_GOLFO_CADIZ` o `SPOTS_CANARIAS` si le
   corresponde. Cantábrico, Galicia, Asturias y la costa atlántica de
   Portugal no necesitan Set: usan `ESPECIES` por defecto. Un spot
   mediterráneo que se olvide aquí muestra especies del Cantábrico.
6. **La cámara**: `WEBCAMS` en `functions/webcam/[slug].js` si es imagen
   fija, o `WEBCAMS_HLS` + `WEBCAMS_HLS_FUENTE` en `index.html` si es
   vídeo. Y en los dos casos, el slug a `SPOTS_CON_WEBCAM` (`index.html`) —
   sin eso la cámara no se enseña aunque esté bien puesta.
7. **Monitorización** (no es opcional aunque parezca accesorio):
   - Imagen fija: nada que hacer, `scripts/camaras/comprobar-camaras.mjs`
     importa `WEBCAMS` directamente y la recoge sola en la pasada
     siguiente.
   - Vídeo: hay que añadirla **a mano** a `WEBCAMS_VIDEO` en ese mismo
     script (es una copia manual de `WEBCAMS_HLS`, no un import).
   - Turbidez: añade el slug a `SPOTS_IMAGEN` o `SPOTS_VIDEO` en
     `scripts/turbidez/medir-turbidez.mjs` (también copias manuales). Si
     no, ese spot no empieza a acumular histórico y tardará 14 días más en
     poder clasificar nada desde el día en que alguien se acuerde.

### Comprobaciones obligatorias antes de commitear

- **Que Open-Meteo devuelva datos de verdad para esa coordenada**: una
  petición real a la Marine API con el `lat`/`lon` nuevo. Si vuelve todo
  `null`, la coordenada está mal (casi siempre, tierra adentro) — corrígela
  o no crees el spot. Es más barato comprobarlo ahora que descubrirlo en
  producción con el spot ya publicado.
- `node --check functions/prevision.js` y
  `node --check "functions/webcam/[slug].js"`.
- Para `index.html`, `node --check` sobre el contenido del
  `<script type="module">` extraído a un fichero aparte, no sobre el
  `.html`. Ya hubo un `SyntaxError` real en producción por no hacer esto
  (ver `CLAUDE.md`, primer bug de la sección del paywall).
- Que el slug nuevo no choque con uno ya existente en ninguna de las dos
  listas `SPOTS`.

### Límites de esta excepción

- **Máximo 5 spots nuevos por pasada.** Lo que sobre se queda en `ROBOT.md`
  como cola pendiente para la siguiente pasada de esa zona, con todo lo ya
  verificado anotado para no repetir el trabajo. Integrar cámaras en spots
  que ya existen no cuenta contra este tope — ahí no hay límite, son
  siempre bienvenidas.
- **Excepción explícita al límite de volumen** de "Red de seguridad de la
  automatización": tanto crear un spot como añadir una cámara a un spot que
  ya existe pueden pasar de 3 ficheros y de ~80 líneas, y pueden tocar
  `functions/prevision.js` y `functions/webcam/[slug].js`. Vale **solo**
  para los puntos de edición de la lista de arriba y **solo** de forma
  aditiva. Cualquier otro cambio en `functions/` o en `supabase/` sigue con
  la regla de siempre: se propone, no se aplica.
- Una cámara con mar para un spot que **ya existe** se integra siempre:
  como fuente principal o como reserva, según el orden de "Prioridad entre
  varias cámaras de un mismo spot". Ahí no hay spot que crear, así que solo
  hacen falta la comprobación visual del encuadre, el punto 6 y el punto 7.
- `ROBOT_PAUSADO` sigue mandando por encima de todo esto.
- En `ROBOT.md`, cada spot creado se anota con: slug, nombre, coordenadas y
  de qué fuente salieron, URL de la cámara, qué se vio en el encuadre, y el
  resultado de la comprobación de Open-Meteo. Con eso `daily-report.yml` lo
  recoge solo en la síntesis del día.

### Cola pendiente de arranque

Cámaras ya verificadas en pasadas anteriores que se quedaron fuera por los
dos motivos que esta regla elimina. Son las primeras candidatas cuando
toque su zona en la rotación:

- ~~**4 cámaras de SkylineWebcams para `aguilas`**~~ — **HECHO el
  2026-09-25.** Integradas 3 de las 4 (`live5963` de la bahía como
  principal, `live260` y `live1448` como reserva). La cuarta, `live911`,
  se descartó a propósito por esta misma regla: es una panorámica de los
  tejados de la ciudad con el mar como franja lejana, no se puede leer el
  estado del agua. Sirve de precedente para dos cosas: (a) mirar las
  imágenes cambia la decisión —el robot había propuesto la del puerto
  deportivo como principal, y el agua de una marina está siempre en calma
  detrás del espigón, así que no dice nada del mar real—, y (b) descartar
  una candidata verificada y viva es una respuesta válida, no un fallo.
- ~~Texto original de la entrada, para referencia:~~ 4 cámaras para
  `aguilas`, spot que YA existe
  (pasada del 2026-09-25, zona Comunidad Valenciana y Murcia): verificadas
  con `Last-Modified` reciente, y la propia pasada las dejó sin integrar
  con el motivo textual "toca `functions/webcam/[slug].js` e `index.html`,
  cae fuera de corrección trivial" — o sea, el bloqueo exacto que esta
  regla levanta, ocurriendo el mismo día. `live1448.jpg` como principal y
  las otras 3 de reserva. Ojo a la limitación ya anotada por esa pasada:
  son 344x193px, peor resolución que el resto del repo; es motivo para
  avisar en `ROBOT.md`, no para no integrarlas (hoy `aguilas` no tiene
  ninguna cámara).
- **7 cámaras de Windy Webcams para spots portugueses que YA existen**
  (pasada del 2026-09-23, zona "Portugal — centro y norte"): solo hay que
  integrarlas, no crear nada. Reconfirmar `Last-Modified` antes, que en esa
  red se queda vieja con facilidad.
- **11 cámaras de MeteoGalicia sin spot** (pasada del 2026-09-14, zonas
  Rías Altas y Rías Baixas): les falta la comprobación visual del encuadre
  y coordenadas de fuente real — la lista JSON de MeteoGalicia las trae.
- **`puntaluzero`** (Punta Lucero, Zierbena — ver su regla más abajo):
  cámara viva de AZTI/kostasystem.com, sin spot. Mismo trabajo pendiente
  que las gallegas.

## Cámara caída: primero descarta que se haya MOVIDO (añadido 2026-09-25, pedido explícito del usuario)

Regla del robot de reparación (`.github/workflows/robot-camaras-caidas.yml`),
que a diferencia del buscador de fuentes **solo mira las cámaras en rojo** —
las que `camaras-salud.yml` ya dejó marcadas con `sin_senal = true` en
`camara_estado`. Vigilar y reparar son dos trabajos distintos: aquel
comprueba las 59 cada 30 minutos y anota; este coge las rotas y las arregla.

**El error que hay que evitar, con caso real detrás.** Sopelana estuvo 6
días marcada en rojo y el usuario la veía funcionando perfectamente. Las dos
cosas eran ciertas: la cámara estaba viva, pero el ayuntamiento había
cambiado su alias de IPCamLive y nuestra URL guardada daba `404` puro. Nadie
la había roto — **se había mudado**.

Por eso el orden de hipótesis importa tanto: **una cámara en rojo no está
rota hasta que se demuestre. Primero se descarta que haya cambiado de
dirección.**

### Orden de trabajo, sin saltarse pasos

**1. Cada cámara se trata por separado. Agrupar por proveedor NO sirve para
saltarse ninguna** (corregido el 2026-09-25, pedido explícito del usuario:
"cada cámara es diferente, agrupar no ayuda nada").

Que varias compartan proveedor es, como mucho, un **dato para el informe** —
"estas 6 son del mismo sitio" ayuda a entender el panorama. Nunca es un
motivo para darlas por resueltas ni para dejar de buscarles alternativa.

Por qué se cambió: la versión anterior de esta regla decía "anótalo y no las
investigues una a una", y el resultado fue que 6 cámaras de `cantabria.es` y
`apps.socib.es` llevaban **48 fallos seguidos y ninguna señal registrada
jamás** — muertas desde siempre, archivadas cada pasada como "caída del
proveedor". Agrupar se había convertido en una forma elegante de no hacer el
trabajo.

Lo único que sí conviene no repetir: si ya comprobaste que el proveedor
entero está caído, no hace falta volver a comprobar SU disponibilidad seis
veces. Pero cada spot necesita igualmente su propia búsqueda de alternativa,
porque **la alternativa siempre es local**: la cámara que sustituya a
Comillas no tiene nada que ver con la que sustituya a Suances.

**2. Lee el motivo, que ya orienta bastante:**

| Motivo | Qué sugiere |
|---|---|
| `404` en una URL que antes iba | **Movida o renombrada.** Es el caso de esta regla. |
| `http_502`, `sin_respuesta` en varias del mismo proveedor a la vez | Caída del proveedor. Esperar, no investigar una a una. |
| `frame_congelado` | La cámara responde pero da siempre la misma imagen: puede estar apagada de noche, o muerta de verdad. Comprobar `Last-Modified`. |
| `sin_respuesta` en una sola, con el resto del proveedor bien | Candidata clara a haberse movido. |

**3. Busca la web pública del dueño y mira qué embebe HOY.** No busques la
URL antigua: busca la página del ayuntamiento, la escuela de surf, el club
náutico o el puerto, y mira qué reproductor tiene puesto ahora. Es la fuente
de verdad, y se actualiza sola cuando ellos cambian algo.

**IPCamLive en concreto** (proveedor de Sopelana y Santoña): la página del
dueño embebe `ipcamlive.com/player/player.php?alias=<alias>`. Ese **alias es
el identificador duradero**; el servidor (`sXX`) y el `streamid` salen de él
y **los dos pueden cambiar sin aviso**. Descarga esa página del player y saca
`address = 'http://sXXX.ipcamlive.com/'` y `streamid = '...'` — con eso se
arman las URLs:

```
https://<servidor>/streams/<streamid>/stream.m3u8    (vídeo)
https://<servidor>/streams/<streamid>/snapshot.jpg   (imagen fija)
```

Anota SIEMPRE el alias en un comentario junto a la URL. Es lo que permite
resolverla de nuevo la próxima vez sin tener que redescubrir la página.

**4. Verifica antes de dar nada por bueno.** Un `200` no basta:

- Imagen fija: `Last-Modified` reciente de verdad (minutos, no días).
- Vídeo HLS: lee el manifiesto **dos veces separadas unos segundos** y
  comprueba que `EXT-X-MEDIA-SEQUENCE` ha avanzado. Un manifiesto puede
  responder 200 y estar congelado.
- **Y MIRA la imagen con `Read`**: que se vea mar, y que sea el sitio
  correcto. Una URL puede responder perfectamente y ser otra playa, u otro
  pueblo con el mismo nombre.

**5. Aplica el cambio en TODOS los sitios.** Una misma URL puede vivir en
cuatro ficheros distintos, y dejarse uno significa que el monitor sigue
marcando rojo aunque la app ya funcione (o al revés):

| Fichero | Qué contiene |
|---|---|
| `functions/webcam/[slug].js` | `WEBCAMS` — imagen fija, y las reservas |
| `index.html` | `WEBCAMS_HLS` y `WEBCAMS_HLS_FUENTE` — vídeo |
| `scripts/camaras/comprobar-camaras.mjs` | `WEBCAMS_VIDEO` — copia manual, no importa de index.html |
| `scripts/turbidez/medir-turbidez.mjs` | `SPOTS_IMAGEN` / `SPOTS_VIDEO` — copias manuales |

**Búscala con `Grep` por el identificador del stream, no por el slug** — así
salen todas las apariciones aunque estén en ficheros que no esperabas. En el
caso de Sopelana, la URL muerta estaba en 3 sitios y el snapshot de reserva
apuntaba al mismo alias caído.

**6. Cambiar una URL que se ha movido es una corrección trivial**: se aplica
directa con commit y push a main, aunque toque `functions/`. No es una
decisión de producto ni una integración nueva — es la misma cámara en otra
dirección. (Reemplazarla por una cámara **distinta**, de otro dueño, sí es
otra cosa: eso va por la regla "Cámara con mar a la vista".)

**7. SIEMPRE hay que buscar alternativa** (pedido explícito del usuario,
2026-09-25). Que una cámara no se haya movido no cierra el caso: cierra la
primera hipótesis. Si la fuente original está rota de verdad, el trabajo no
ha terminado — hay que buscar **otra cámara distinta, de otro dueño**, para
ese mismo punto, aplicando la regla "Cámara con mar a la vista" (verificación
HTTP real + mirar la imagen). Un spot sin cámara es un spot peor, venga el
fallo de donde venga.

Esto vale igual cuando varias comparten proveedor (ver punto 1): que el
fallo tenga un origen común no cambia que cada spot necesite SU propia
sustituta. Caso real que lo motivó: el 2026-09-25
había 6 cámaras caídas de `cantabria.es` y `apps.socib.es` con 48 fallos
seguidos y **ninguna señal registrada jamás** — llevaban muertas desde
siempre y nadie había buscado sustituta porque la regla las archivaba como
"caída del proveedor".

Criterio de esfuerzo, para no gastar la pasada entera en un caso perdido:

| Situación | Qué hacer |
|---|---|
| Caída hoy, funcionaba ayer | primero "¿se ha movido?"; si no, buscar alternativa |
| Varios días caída, o del mismo proveedor que otras | buscar alternativa directamente, sin perder tiempo en la hipótesis del movimiento |
| Sin señal registrada nunca, muchos fallos | buscar alternativa **con prioridad**: no es una avería, es que esa fuente nunca sirvió |

**8. Si tampoco hay alternativa, no inventes ninguna.** Déjalo escrito en
`ROBOT.md`: qué buscaste, qué descartaste y por qué. El objetivo es que la
pasada siguiente no repita el mismo trabajo a ciegas. Anota también **qué
términos de búsqueda ya probaste**, para que la siguiente empiece por otros
en vez de repetir los mismos.

### Señal de que esta regla hace falta

Si una cámara está en rojo y el usuario la ve funcionando, casi siempre es
uno de estos dos:

- **La fuente principal y la que se vigila no son la misma.** Un spot con
  vídeo en `WEBCAMS_HLS` y una imagen fija de reserva en `WEBCAMS`: si cae el
  vídeo, el monitor marca rojo aunque la reserva funcione, y al revés.
- **La URL se ha movido** y la cámara sigue viva en otra dirección.

Los dos se resuelven con el mismo método de arriba.

## Aprendizaje por zonas (añadido 2026-09-19, pedido explícito del usuario)

Principio general para la pasada diaria de "cámaras/webcams"
(`.github/workflows/robot-buscador-fuentes.yml`, cron `47 2 * * *`):
**el algoritmo tiene que ir mejorando solo, sin que el usuario tenga que
pedirlo cada vez** — la búsqueda de cámaras nuevas no es una tarea
puntual, es continua, pero yendo zona por zona (nunca todo el litoral de
golpe, para no disparar el volumen de llamadas a WebSearch/HTTP). Cada
pasada:

1. Investiga SOLO la zona del día (rotación automática por
   `date -u +%j % 10`, ver el workflow — no depende de que el robot
   recuerde nada entre pasadas).
2. Verifica cada fuente candidata con una petición HTTP real antes de
   proponerla o integrarla (regla general del fichero, se aplica igual
   aquí).
3. **Al terminar, si aprendiste algo que se generaliza más allá de una
   cámara suelta, añade o afina una regla aquí debajo (en esta misma
   sección)** — un proveedor que cubre varias poblaciones de una vez, un
   patrón de nombres en otro idioma co-oficial, un tipo de fuente que
   nunca funciona en esa zona, etc. Es la forma de que el conocimiento se
   quede aunque pasen días sin que nadie revise `ROBOT.md` a mano.
   Mantén cada edición pequeña (un párrafo por hallazgo, bajo la
   subsección de su zona) — esto NO es una excepción al límite de
   volumen de "Red de seguridad de la automatización" más abajo, sigue
   contando para ese límite.

**Nombres alternativos / co-oficiales**: antes de dar una población por
"sin webcam", busca también por su nombre en el otro idioma co-oficial de
la zona (euskera/castellano en País Vasco, galego/castellano en Galicia,
valencià/castellano en Comunitat Valenciana) — una fuente local a veces
solo aparece bajo un nombre. Ver
`scripts/camaras/nombres-alternativos.json` (aunque esté incompleto,
amplíalo tú mismo cuando confirmes un nombre alternativo real por una
fuente que lo use, nunca inventes una traducción).

**Prioridad entre varias cámaras de un mismo spot (criterio explícito del
usuario, 2026-09-19)**, en este orden:
1. **Vídeo antes que imagen fija.** Si encuentras una fuente de vídeo
   (HLS/RTSP/similar) para un spot que hoy solo tiene imagen fija, es
   candidata a reemplazarla como fuente principal — proponlo, no lo
   integres directo (cambiar de `WEBCAMS` a `WEBCAMS_HLS` toca
   `index.html` y varios scripts de monitorización a la vez, así que cae
   fuera de "corrección trivial").
2. **Entre imágenes fijas, la de mejor resolución/nitidez real** (no el
   tamaño en bytes — una imagen más pesada solo por menos compresión no
   es "más nítida"). Compara descargando ambas.
3. **Entre las que empatan de día, prioriza la que sea infrarroja** (o
   documente visión nocturna) — se nota comprobando una imagen de esa
   misma cámara de noche, no lo des por hecho por el nombre del producto.
4. Guarda las que no ganen igualmente como fuente de reserva en el array
   de `WEBCAMS[slug]` (ver `functions/webcam/[slug].js`) en vez de
   descartarlas — sirven para el failover aunque no sean la principal.

**Vídeo y estimaciones (turbidez, en su momento oleaje visual)**: cuando
la fuente principal de un spot es vídeo, la extracción de fotogramas para
cualquier estimación (turbidez ya activa en
`scripts/turbidez/medir-turbidez.mjs`; oleaje visual se probó y se quitó
el 2026-09-15 por poco fiable, no reactivarlo sin que el usuario lo pida
de nuevo) necesita varios frames espaciados en el tiempo, nunca uno solo
— un único frame de un vídeo en directo puede pillar un momento atípico
(un barco pasando, un reflejo). Ese patrón de varios-frames-y-descartar-
el-atípico ya existe en `medir-turbidez.mjs`, reutilízalo en vez de
reinventarlo si añades una estimación nueva sobre una fuente de vídeo.

### Zona: País Vasco — Bizkaia (última pasada real: 2026-09-19, interactiva con el usuario, no la rotación automática)

- **AZTI opera DOS redes de cámaras distintas, no una** —
  `detectia.net` (la que ya usamos: bakio/sopelana/lekeitio/getxo/pasaia/
  getaria) y, por separado, `kostasystem.com` (la que ya usamos solo para
  Mundaka). `kostasystem.com` tiene MUCHAS más carpetas de las que
  usamos (`/wp-content/uploads/irudiak/`, listado de directorio Apache
  abierto — útil para auditar de golpe qué está vivo) — pero comprobado
  en real el 2026-09-19 que casi todas llevan **meses sin actualizarse**
  (bakio, pasaia, malkorbe/getaria, arrigunaga, barinatxe, muskiz, laga,
  bermeo: todas con fecha de enero-marzo 2026, es decir, cámaras muertas
  aunque el fichero siga respondiendo 200 con una imagen vieja). Solo
  `mundaka` y `puntaluzero` tenían fecha de HOY. **No des por buena una
  carpeta de `kostasystem.com` solo porque responda 200 — comprueba
  SIEMPRE la fecha real del fichero** (cabecera `Last-Modified` de la
  imagen en sí, o el listado de directorio) antes de proponerla.
- **`puntaluzero` (zona de Punta Lucero, Santurtzi/Zierbena, bocana de la
  ría de Bilbao) es una cámara real y viva de AZTI/kostasystem.com que
  Costaviva no usa todavía** — 2 cámaras (`camara1`/`camara2`),
  actualizándose varias veces por hora, comprobado en real. No hay spot
  fijo ahí actualmente — sería un spot nuevo, no solo una cámara para uno
  existente. Desde el 2026-09-25 esto ya NO se queda en una propuesta:
  entra por la regla "Cámara con mar a la vista", así que el spot se crea
  — solo le faltan la comprobación visual del encuadre y unas coordenadas
  de fuente real.
  URLs verificadas: `https://www.kostasystem.com/wp-content/uploads/irudiak/puntaluzero/camara1_snap.jpeg`
  y `camara2_snap.jpeg` (mismo patrón).
- **Sopelana tiene una segunda fuente real, independiente de AZTI, Y
  ADEMÁS es vídeo real (no solo imagen fija)**: el propio ayuntamiento
  (`sopela.eus/webcam-olas/`) embebe un reproductor de IPCamLive.
  Verificado en vivo 2026-09-19: además de la imagen fija
  (`https://s61.ipcamlive.com/streams/3d0d8zpvutondjmwg/snapshot.jpg`,
  usada como reserva en `WEBCAMS` de `functions/webcam/[slug].js`), esa
  misma cámara sirve un HLS real y en directo en
  `https://s61.ipcamlive.com/streams/3d0d8zpvutondjmwg/stream.m3u8`
  (`EXT-X-MEDIA-SEQUENCE` avanzando en tiempo real, CORS abierto). Por el
  criterio de prioridad vídeo > imagen fija, esta URL pasó a ser la
  fuente principal de pantalla para `sopelana` en `WEBCAMS_HLS`
  (`index.html`) — la imagen fija de AZTI/detectia.net queda solo como
  dato de reserva, ya no se muestra a menos que esta entrada de vídeo se
  quite. Al ser un proveedor totalmente distinto de detectia.net, seguía
  sirviendo como ejemplo de por qué no depender de un único proveedor
  (ver "Fallos correlados por proveedor" más arriba).
- **Plentzia (spot ya existente, sin cámara desde su creación) sigue sin
  fuente real**: la escuela de surf `escueladesurfsopelana.com` enlaza
  una cámara IP directa (`62.99.56.33:81/jpg/1/image.jpg`, vía el proxy
  público `images.weserv.nl`) pero comprobado en real el 2026-09-19 que
  esa IP concreta no responde (fuera de servicio ahora mismo) — no
  integrar sin volver a comprobar en una pasada futura que ha vuelto.
- **Gorliz: descartado.** `visitgorliz.eus/webcam/` enlaza a
  `webcam.gorliz.net`, que resulta ser una página HTML estática guardada
  ("saved from url=...", comentario literal en el HTML) de hace tiempo,
  no una cámara en directo — la propia web de turismo local admite que
  "está fuera de servicio por mantenimiento". No investigar más esta
  población salvo que aparezca una fuente nueva y distinta.
- **Bermeo: sin verificar todavía, dos intentos reales fallidos por
  timeout de red** (`bermeo.eus/webcam.html`, 2026-09-19, con reintentos)
  — no es un 404 ni un rechazo, es que la conexión no llega a completarse
  desde este entorno; puede ser el propio servidor de bermeo.eus, no
  necesariamente un bloqueo de nuestro lado (ver la limitación ya
  documentada de red bloqueada en sesiones de robot/auditoría en la
  nube — aquí fue en una sesión interactiva, así que no está tan claro
  que sea lo mismo). Su carpeta en `kostasystem.com` lleva muerta desde
  2024. Pendiente de reintentar en una pasada futura, desde otra red si
  es posible verificarlo así.

### Zona: País Vasco — Gipuzkoa (última pasada real: 2026-09-19, interactiva con el usuario, no la rotación automática)

- **Directorio oficial completo de webcams de la Diputación Foral**:
  `gipuzkoa.eus/es/web/hondartzak/webcams` lista sus cámaras reales:
  Deba, Hondarribia, La Concha, Malkorbe (Getaria), Ondarreta, Orio,
  Puerto de Mutriku, Saturrarán, Zarautz, Zurriola (Donostia). Ni Zumaia
  ni Ondarroa aparecen en este directorio — confirmado que la Diputación
  no tiene cámara en esas dos poblaciones, no hace falta seguir buscando
  ahí.
- **Bug real corregido: Getaria (Malkorbe) SÍ tenía vídeo de la
  Diputación, el 404 de 2026-09-14 fue por probar el nombre equivocado.**
  La URL de su página web usa "malkorbe" (el nombre de la playa), pero el
  nombre real de la cámara en el servidor (`58f14c0895a20.streamlock.net`)
  es "getaria" (el nombre del pueblo) — mismo patrón que ya se sabía de
  "mutrikukaia" vs. el nombre de playa. **Lección para pasadas futuras de
  este proveedor**: cuando una URL con el nombre de la playa/página dé
  404, probar también con el nombre del pueblo antes de dar la cámara
  por inexistente — la Diputación no es consistente en qué nombre usa
  para cada cámara. Integrado como fuente principal de `getaria`
  (`WEBCAMS_HLS`), la imagen fija de AZTI se queda como reserva.
- **Zumaia (playa de Itzurun) tenía cámara real, nunca la habíamos
  encontrado**: no está en el directorio de la Diputación, pero el propio
  ayuntamiento (`zumaia.eus/.../webcam`) la aloja en el MISMO servidor
  streamlock.net que la Diputación, con un nombre de stream distinto
  (`GIP_zumaia2`) — verificado en vivo, 1280x960, CORS abierto. Primera
  cámara real de este spot. **Lección**: cuando un ayuntamiento no tenga
  su propia infraestructura de streaming, comprobar si usa el mismo
  proveedor/servidor que la Diputación/gobierno regional antes de
  descartar la población — puede estar ahí con un nombre distinto al que
  aparece en el directorio oficial.
- **Ondarroa: sin fuente real encontrada, confirmado con más
  profundidad que en la primera pasada.** Ni en el directorio de la
  Diputación, ni en `kostasystem.com`, ni intentando nombres de stream
  plausibles en streamlock.net (`ondarroa`, `ondarroa2`, `arrigorri`
  → 404). Existe `GIP_saturraran_169` (200, real) pero Saturrarán es una
  playa distinta, en término de Mutriku, ya descartada a propósito para
  el spot de Mutriku por el mismo motivo ("la cámara equivocada para
  este spot", no un problema de encuadre) — no reutilizarla para
  Ondarroa por la misma razón. EITB tiene página de "playas" para
  Arrigorri (Ondarroa) pero sin ninguna cámara real embebida (solo
  enlaces a su sección de cámaras de nieve/montaña, nada de costa). Dar
  por buena esta población como "sin fuente conocida" hasta que aparezca
  algo realmente nuevo — no repetir esta misma búsqueda sin una pista
  distinta.

### Zona: Cantabria (pasada puntual 2026-09-19, interactiva con el usuario, no la rotación automática — motivada por una caída real de cantabria.es que duró todo el día)

- **Red independiente `webcamsencantabria.com` (backend `tendsys.net`)
  confirmada real y viva**, totalmente aparte del Gobierno de Cantabria
  (`cantabria.es`/`puertosdecantabria.es`, caídos con `http_502` desde
  al menos las 05:46 hasta pasadas las 13:00 del 2026-09-19 — más de 7h,
  ver "Fallos correlados por proveedor"). Cada página de cámara de ese
  sitio embebe un `<video>`/iframe de `rswc.tendsys.net` con un HLS en
  directo (**sin CORS** — `Access-Control-Allow-Origin` ausente incluso
  mandando `Origin` explícito, comprobado con curl — no se puede cargar
  directo en el navegador como las HLS de Gipuzkoa) pero TAMBIÉN sirve un
  póster JPEG que se regenera cada pocos minutos en
  `https://rswc.tendsys.net/memfs/<uuid>.jpg` — ese sí es utilizable, vía
  nuestro proxy `/webcam/<slug>` (el CORS del origen da igual ahí, la
  petición la hace el propio Worker, no el navegador). Añadidas como
  reserva en `WEBCAMS` para `castrourdiales`
  (`56b44eac-9cc1-4487-98fc-3991c5a4874d`) y `laredo`
  (`4d8076d3-525d-4868-b02d-8126c51da987`), verificadas en vivo
  (`Last-Modified` a menos de 1 minuto de la comprobación).
- **No se encontró página de `webcamsencantabria.com` para Santoña**,
  pero SÍ apareció una fuente real por otra vía (pista del usuario):
  Watsay Surf School (`watsaysurfschool.com/webcam/`) tiene su propia
  cámara de la playa de Berria (término de Santoña) vía IPCamLive —
  vídeo HLS real, CORS abierto, 4K, cámara fija (no PTZ) — confirmado
  visualmente que enseña la playa/rompiente con gente real caminando,
  no una imagen de stock. Pasó a fuente PRINCIPAL de `santona` en
  `WEBCAMS_HLS` (sustituye a la imagen fija de cantabria.es, que se
  queda como reserva) — mejor caso posible: dueño identificado, vídeo
  real, resolución alta.
- **Bakio (Bizkaia, no Cantabria, pero mismo caso de fallo — frame
  congelado de AZTI/detectia.net desde antes de las 07:26)**: su
  ayuntamiento (`bakio.eus/.../Webcam.aspx`) tiene página de webcam pero
  exige login (SharePoint, redirige a `Authenticate.aspx`) — no hay forma
  de sacar una imagen real sin credenciales. `kostasystem.com` también
  tiene carpeta `bakio/` pero lleva muerta desde enero 2026 (mismo patrón
  ya documentado en la zona de Bizkaia).
  **Resuelto igualmente, de otra forma (pedido explícito del usuario,
  "como último recurso"):** `webviewcams.com/europe/spain/bakio` es un
  directorio de cámaras IP con control PTZ abierto a cualquier
  visitante — NO es una fuente oficial, cualquiera puede moverla en
  cualquier momento, y Workers no tiene forma de comprobar por píxeles
  que siga apuntando al mar en cada petición (sin API de imagen). Se
  añadió de todas formas como reserva de ÚLTIMA prioridad, ya avisada
  esta limitación y aceptada explícitamente — comprobado en el momento
  de añadirla que sí apuntaba a la playa de Bakio de verdad. Es un
  stream MJPEG (no una imagen suelta), necesitó una función nueva
  (`extraerFramePrimeroDeMjpeg` en `functions/webcam/[slug].js`) que
  extrae un frame por bytes (sin librería de imagen) y corta la
  conexión — nunca usar `Buffer` en código de Cloudflare Functions, no
  está garantizado en ese runtime; usar `Uint8Array` a mano.
- **`surf30.net` (blog de webcams de olas) tiene entradas viejas
  (~2018-2020) para `detectia.net/img/webcam-gorliz.webp` y
  `webcam-plentzia.webp`** — comprobado en vivo 2026-09-19: las dos dan
  `404` ahora, esas cámaras de AZTI ya no existen con esos nombres (el
  directorio `detectia.net/img/` da 403, no se puede listar para
  encontrar el nombre actual si lo cambiaron). Gorliz y Plentzia siguen
  sin fuente de reserva. También reveló una segunda cámara real de
  Bakio en el mismo proveedor que la principal
  (`bakio.2.snap.last.thumb.jpeg`, isurki.com) — no añadida como
  reserva porque es el MISMO proveedor que la principal, no aporta
  independencia frente a una caída de isurki.com/AZTI.
- **Si el HLS de tendsys.net se quisiera usar como vídeo de verdad en
  algún momento** (no solo el póster de reserva), haría falta un proxy
  propio de HLS (reescribir las URLs relativas de los segmentos dentro
  del `.m3u8`) — no es una corrección trivial, es un desarrollo nuevo;
  no intentarlo sin que el usuario lo pida explícitamente.

### Zona: Asturias (última pasada real: 2026-09-20, rotación automática)

Solo 2 spots fijos (`llanes`, `ribadesella`), ninguno con cámara.

- **Toda la red de webcams de Asturias corre sobre un único backend,
  `rtsp.me` — no hay un proveedor propio tipo AZTI/detectia.net con
  snapshot JPEG directo en esta zona.** Se encontró la misma cámara
  (mismo ID de `rtsp.me`, ej. Puerto de Llanes = `rtsp.me/embed/
  SfETz5yS`) republicada en al menos dos webs "distintas"
  (`webcamsdeasturias.com` y `hispacams.com`) — son espejos del mismo
  origen, no dos fuentes independientes. Cualquier otra vía que se
  encuentre para una cámara asturiana (ayuntamiento que solo enlaza,
  escuela de surf con embed de un tercero) hay que comprobar primero si
  en el fondo también apunta a `rtsp.me` antes de tratarla como una
  fuente nueva de verdad.
- **`rtsp.me` no tiene ningún snapshot/HLS público fijo, a diferencia de
  `tendsys.net` (Cantabria) que al menos daba un póster JPEG de
  reserva.** Sirve el vídeo real solo tras un intercambio de token vía
  su propia API (`/api/embed/<id>/token/<n>`, visto en el bundle JS
  minificado del embed). Probados 5 paths de snapshot típicos
  (`snapshot.jpg`, `snap.jpg`, `thumbnail.jpg`, `poster.jpg`,
  `image.jpg`) contra 3 IDs reales distintos — los 15, `404`. Integrar
  esto exigiría replicar el intercambio de token en un proxy propio:
  desarrollo nuevo, no una corrección trivial (mismo criterio que el
  HLS de tendsys.net de la regla anterior) — no intentarlo sin que el
  usuario lo pida explícitamente.
- **Un ayuntamiento que tiene página "Webcams" no implica que aloje
  cámara propia** — el de Ribadesella (`ayto-ribadesella.es/en/
  webcams`) solo enlaza a `webcamsdeasturias.com`. Comprobar siempre si
  el HTML de la página del ayuntamiento tiene un iframe/script propio o
  solo un `<a href>` de salida antes de darlo por una fuente
  independiente del agregador que ya se conoce.
- **Cuidado con agregadores que dicen "en directo" pero sirven una foto
  vieja**: `meteosurfcanarias.com` presenta una imagen de Ribadesella/
  Santa Marina como webcam en tiempo real, pero su cabecera
  `Last-Modified` es de 2017 — una comprobación de una sola petición
  `HEAD` la descarta al instante. Regla general para cualquier zona:
  antes de dar por buena la imagen de un agregador desconocido,
  comprobar `Last-Modified` (o pedirla dos veces separadas por unos
  segundos y comparar bytes/tamaño) antes de asumir que es una fuente
  viva.
- **El asturianu no tiene estatus de co-oficialidad** (a diferencia de
  euskera/galego/valencià en las otras zonas de la regla de "Nombres
  alternativos" de arriba) — probado igualmente por si acaso
  (`Ribeseya` por Ribadesella) y no apareció ninguna fuente nueva, solo
  el mismo agregador. No hace falta repetir esta comprobación en otras
  poblaciones asturianas salvo indicio concreto de que exista una
  fuente solo bajo el nombre en asturianu.
- **Pendiente de retomar, no descartado del todo**: `ribacam.es`
  (webcam propia de Surfcamp Ribadesella) no resuelve por DNS, y
  `surfcampribadesella.com` bloqueó la petición automatizada con `403`
  — a diferencia de un `404` claro, esto no confirma que la fuente esté
  muerta, solo que no se pudo verificar desde este entorno. Reintentar
  en una pasada futura antes de dar esta población por agotada.
- **Pista sin investigar, para la zona "Galicia — Rías Altas" (la
  siguiente en la rotación)**: `clubnauticoribadeo.com/webcams/` para
  Ribadeo (spot ya existente en `SPOTS`, sin cámara) — apareció al
  buscar "club náutico" para Ribadesella, pero Ribadeo cae en la
  siguiente zona de la rotación, no investigado todavía.

### Zona: Galicia — Rías Altas / costa norte (última pasada real: 2026-09-21, rotación automática)

Solo 3 spots fijos en esta zona (`acoruna`, `camarinas`, `ribadeo`), y
los 3 ya tienen cámara de MeteoGalicia — a diferencia de Asturias/
Cantabria, no hay ningún spot fijo sin cámara aquí. Verificados los 3
en real esta pasada (`ultima.jpg` de cada uno, `Last-Modified` a menos
de 2 minutos de la comprobación) — sin caída correlada de proveedor,
nada que reemplazar.

- **La pista de Ribadeo se confirma real, pero con el mismo bloqueo
  técnico ya documentado en Asturias — `rtsp.me` sin snapshot
  público.** `clubnauticoribadeo.com/webcams/` (Real Club Náutico de
  Ribadeo) embebe dos cámaras reales vía `rtsp.me`
  (`rtsp.me/embed/TEsbennT/` y `rtsp.me/embed/6QYaBsGS/`) — la segunda
  es la misma que replica `hispacams.com/en/webcams/puerto-de-ribadeo/`
  (mismo ID exacto, confirmado; mismo patrón de "espejos del mismo
  origen" ya visto en Asturias con `webcamsdeasturias.com`/
  `hispacams.com`). Probados los 5 paths de snapshot típicos
  (`snapshot.jpg`, `snap.jpg`, `thumbnail.jpg`, `poster.jpg`,
  `image.jpg`) contra los 2 IDs — los 10, `404`. **`rtsp.me` no es un
  caso aislado de Asturias, es un backend que aparece también en
  Galicia** — cualquier cámara nueva que en esta costa resulte estar
  detrás de `rtsp.me` tiene el mismo bloqueo (exige intercambio de
  token vía su API, desarrollo nuevo, no corrección trivial); no
  repetir la comprobación de los 5 paths de snapshot para cada ID
  nuevo de `rtsp.me` que aparezca, ya está confirmado que ninguno
  responde.
- **Trampa real encontrada, útil para cualquier zona con MeteoGalicia
  (Cantábrico gallego Y Rías Baixas): el "vídeo" de MeteoGalicia vía
  `streamlock.net` NO es en directo, es el mismo clip fijo siempre.**
  El agregador `camaramar.com` (aparece en casi cualquier búsqueda
  "webcam <pueblo gallego>") resultó ser solo un reproductor que
  reincrusta el mismo origen que ya usamos — para A Coruña, un HLS en
  `https://622a10e8864f7.streamlock.net/VODgrabaciones/meteo_Corunha.mp4/playlist.m3u8`
  (mismo `<carpeta>` que la URL JPEG que ya integramos,
  `meteogalicia.gal/datosred/camaras/MeteoGalicia/Corunha/`; confirmado
  el mismo patrón vivo también para `meteo_Ribadeoporto.mp4` y
  `meteo_Camarinhas.mp4` — parece existir para cualquier cámara con
  JPEG). CORS abierto, así que a primera vista parecía un ascenso claro
  por la regla "vídeo antes que imagen fija" — **pero verificado en
  real pidiendo el mismo segmento `.ts` dos veces con 75s de
  diferencia: mismo `ETag` y `Content-Length` exactos, sin ningún
  cambio** (mientras que el JPEG `ultima.jpg` de la misma cámara sí se
  actualiza cada ~1 minuto, comprobado en la misma pasada). Es un clip
  de ~54s grabado una vez y servido siempre igual (el nombre del
  `chunklist` cambia en cada petición al `playlist.m3u8`, pero el
  contenido real no) — **no usarlo nunca como fuente de vídeo en
  directo para ninguna cámara de MeteoGalicia**, la imagen fija sigue
  siendo la única fuente real y actualizada de este proveedor.
- **Real Club Náutico de A Coruña (`rcncoruna.com`) y el Club Náutico
  de Camariñas (aparece solo vía Windfinder) — sin cámara verificable.**
  Ninguna de las dos webs propias expone una imagen real por HTTP
  directo; la página de Windfinder para el club de Camariñas es un
  widget renderizado por JS (el `og:image` es un asset genérico de
  Windfinder, no una foto de la cámara) — no se pudo verificar con una
  petición simple, no se propone.
- **Ningún ayuntamiento propio con cámara independiente encontrado**
  para A Coruña ni Ribadeo — solo agregadores comerciales
  (`camaramar.com`, `g24.gal`, `meteosurfcanarias.com`, `enterat.com`),
  todos remitiendo al final a MeteoGalicia o a `rtsp.me`.

### Zona: Galicia — Rías Baixas / costa sur (última pasada real: 2026-09-22, rotación automática)

8 spots fijos (`baiona`, `aguarda`, `cangas`, `cies`, `sanxenxo`, `ons`,
`corrubedo`, `portosin`); 6 ya tienen cámara MeteoGalicia y sin caída
correlada — solo `aguarda` y `sanxenxo` quedan sin fuente, confirmado ya
varias veces que MeteoGalicia no los cubre.

- **`g24.gal` (CRTVG) tiene una ruta de snapshot con nombre de spot
  (`g24.gal/prog24/ARQUIVO/CAMARAS_WEB/<nombre>.jpg`) que responde `200
  image/jpeg` pero NO es una cámara en directo — es un archivo estático
  cacheado ~30 días (`cache-control: s-maxage=2592000`), verificado con
  dos peticiones reales espaciadas en el tiempo dando el mismo
  `Last-Modified`/`ETag` con `Age` de varias semanas.** El propio nombre
  de carpeta (`ARQUIVO`, "archivo" en gallego) ya lo delataba. Confirmado
  para `aguarda.jpg` y `sanxenxo.jpg` — **para cualquier población
  gallega nueva, no dar por buena una URL de esta ruta `g24.gal/prog24/
  ARQUIVO/CAMARAS_WEB/` solo por dar `200 image/jpeg`; comprobar siempre
  `Last-Modified`/`Age` antes de proponerla**, mismo criterio que ya
  existía para `meteosurfcanarias.com` en Asturias.
- **Hispacams/Simbiosys puede servir un ID de cámara con metadatos
  cruzados de OTRA ubicación distinta a la página que lo embebe** — el
  Club Náutico de Portonovo (Sanxenxo) embebe
  `hispacams.com/cam_embedded.php?id=000162`, pero el `caminfo.json` de
  ese mismo ID declara "Gijón - El Musel / El Arbeyal" (Asturias), y la
  imagen fue bit a bit idéntica en dos peticiones separadas 15s (no está
  en directo). **Antes de dar por buena una cámara de Hispacams
  encontrada embebida en la web de un club náutico/ayuntamiento,
  comprobar el `caminfo.json` (o equivalente) del propio ID contra la
  población esperada, y comparar dos descargas espaciadas en el tiempo**
  — no basta con que el `<iframe>` esté en la página correcta, el ID
  detrás puede estar mal indexado.
- **`rtsp.me` no es solo un patrón de Asturias/Rías Altas — aparece
  también aquí** (Hotel Minso, playa de Silgar/Sanxenxo,
  `rtsp.me/embed/ZtENkk9Y/`), mismo bloqueo ya confirmado (sin snapshot
  público). Refuerza que es un backend a evitar en cualquier zona
  costera española, no un caso aislado — no repetir la comprobación de
  paths de snapshot para IDs nuevos de este proveedor.
- **A Guarda: sin ningún club náutico ni escuela de surf con cámara
  propia encontrado** (a diferencia de Sanxenxo, que sí tiene puerto
  deportivo con cámara — rota, ver arriba). La Cofradía de Pescadores
  "Santa Tecla" existe pero no tiene presencia de webcam. Dar esta
  población por agotada con los términos actuales hasta que aparezca una
  pista nueva y distinta.

### Zona: Portugal — centro y norte (última pasada real: 2026-09-23, rotación automática, primera vez que se investiga con este sistema de zonas)

8 spots fijos (`moledo`, `vianadocastelo`, `povoadevarzim`, `matosinhos`,
`aveiro`, `figueiradafoz`, `nazare`, `peniche`), ninguno con cámara antes
de esta pasada. Beachcam (MEO), la red de referencia histórica de
Portugal, sigue muerta para integración (pasó a servicio de pago desde
antes del 2026-09-15, `403 Forbidden` reconfirmado hoy) — no perseguirla
más en esta zona ni en la de "Portugal — sur" (mismo proveedor
nacional).

- **Red Windy Webcams (`webcams.windy.com`) — hallazgo con
  generalización potencial MÁS ALLÁ de Portugal, no probada todavía en
  ninguna zona española.** Es una red global de cámaras subidas por
  particulares/negocios (no una fuente institucional), pero cubrió 7 de
  las 8 poblaciones de esta zona con cámaras reales en alta resolución
  (1280x720 o 1920x1080) — mucho más productiva que buscar
  ayuntamiento/surf/club náutico población por población. Se accede sin
  necesidad de scraping vía el agregador `portugalwebcams.pt` (cada
  cámara tiene página propia `portugalwebcams.pt/en/webcam/<slug>` con
  un ID numérico de Windy visible en el HTML, `data-id="<id>"` dentro de
  `<div class="webcam-detail-embed">`), y la imagen real, hotlinkable
  directamente sin token, vive en:
  `https://imgproxy.windy.com/_/full/plain/current/<id>/original.jpg`
  (CORS abierto). **Usar siempre la variante `full`, nunca `preview`**
  (esa segunda es solo una miniatura de 400x224, aparece primero al
  mirar el HTML y es fácil copiarla por error). **Recomendación para
  cualquier futura zona (España incluida)**: probar esta red antes que
  las búsquedas población por población de ayuntamiento/surf/club
  náutico — puede que sea productiva también fuera de Portugal, no
  comprobado todavía porque esta pasada solo cubría esta zona.
  **Importante — un ID de Windy puede llevar días sin actualizar pese a
  responder 200 con una imagen real** (visto en Moledo/Caminha,
  6 días de retraso) **o directamente dejar de existir** (visto en un ID
  de Póvoa de Varzim sacado de un resultado de búsqueda, 404 en
  `imgproxy.windy.com`) — comprobar SIEMPRE `Last-Modified` de la
  imagen real antes de proponer cualquier ID de esta red, igual que con
  cualquier otro proveedor de este fichero.
- **Panomax (`<ciudad>.panomax.com`) es un callejón sin salida público,
  mismo patrón que `g24.gal/prog24/ARQUIVO/` en Galicia**: la única
  imagen accesible sin autenticación (el `og:image` de la portada) es un
  cacheado estático de hace años (visto: mayo de 2022), no la vista en
  directo — la imagen real exige su API de pago. Probado en Matosinhos y
  Nazaré, mismo resultado en las dos. No perseguir esta vía para ninguna
  población, en ninguna zona, salvo que aparezca documentación de una
  API pública real.
- **Surftotal (`surftotal.com`) NO es solo un espejo de Beachcam, pese a
  titular sus páginas "Beachcam - ... HD"** — para Póvoa de Varzim sirve
  desde su propio dominio (`surftotal.com/camara/stream_files/`,
  `stream.surftotal.com`), confirmado real y actualizado, pero la imagen
  fija es una miniatura de solo 200x113px — muy por debajo de la
  resolución de Windy. Para el resto de poblaciones de esta pasada
  (Nazaré, Peniche) sus páginas sí parecen replicar Beachcam (mismo
  nombre "Beachcam - ... HD" en el título) — no verificado a fondo cada
  una, comprobar el HTML real (buscar `stream.surftotal.com` propio vs.
  un iframe/embed hacia `beachcam.meo.pt`) antes de asumir cuál es cuál
  en una población nueva.
- **Términos de búsqueda de `ROBOT_REGLAS.md`, recuento de esta zona
  (poblaciones fijas: Nazaré y Peniche)**: `webcam surf` — sin resultado
  confirmable (Baleal Surf Camp, Peniche, anuncia webcam propia pero no
  se pudo verificar el contenido real, respuesta `202` sin cuerpo desde
  este entorno); `webcam ayuntamiento`/`webcam câmara municipal` — sin
  resultado (`cm-nazare.pt`, `cm-peniche.pt`); `webcam pesca/puerto/
  cofradía`/`webcam porto de pesca/capitania` — sin resultado (Capitania
  do Porto de Peniche solo ficha de contacto; el único cámara del Porto
  de Abrigo de Nazaré es de Beachcam, ya descartado); `webcam club
  náutico`/`webcam clube naval/marina` — sin resultado (`cnpeniche.pt`,
  `cnnazare.pt`, ninguno con webcam propia visible).

### Zona: Comunidad Valenciana y Murcia (primera pasada con este sistema de zonas, 2026-09-25)

Casi toda la Comunitat Valenciana (valencia, gandia, denia, calpe,
alicante, benidorm, santapola, oropesa, cullera y varios spots
regionales mas) ya tiene camara de Turisme Comunitat Valenciana (imagen
PNG directa, 28 camaras, integrada desde 2026-09-09). De los spots
fijos de esta zona, solo los 2 de Murcia (cartagena, aguilas) seguian
sin ninguna camara, asi que esta pasada se centro en esas 2 poblaciones
(las 2 exigidas por el protocolo de poda de terminos).

- Aguilas: 4 camaras reales encontradas, red SkylineWebcams, nunca
  usada en el repo hasta ahora. Sirve un snapshot JPEG directo y
  estable en https://cdn.skylinewebcams.com/live<ID>.jpg, sin token
  necesario. El CORS no se comprobo pero es irrelevante porque el
  proxy propio (functions/webcam/[slug].js) hace la peticion desde el
  propio Worker, no desde el navegador (mismo patron ya usado con
  tendsys.net en Cantabria). El ID de cada camara sale del og:image
  (social<ID>.jpg) de su pagina propia en
  skylinewebcams.com/.../<slug>.html -- la propia pagina tambien lista
  "camaras cercanas" con el resto de IDs de la zona, asi que hay que
  restar la lista de la pagina para encontrar cual ID es el suyo (el
  que falta en su propia lista de "cercanas"). Verificadas las 4 con
  Last-Modified a menos de 10 minutos de la comprobacion:
  - live1448.jpg -- "Puerto deportivo de Aguilas" (marina completa mas
    castillo de fondo, mejor composicion de las 4).
  - live911.jpg -- "Aguilas" (vista panoramica de ciudad+puerto desde
    un cerro, la pagina principal de la localidad en SkylineWebcams).
  - live260.jpg -- "Aguilas Yacht Club" -- confirmado de forma cruzada
    e independiente que es de verdad la camara del Club Nautico de
    Aguilas: su propia web (cnaguilas.com/webcam.html) embebe la misma
    imagen exacta via embed.skylinewebcams.com/img/260.jpg. Tipo de
    entidad: club nautico/puerto deportivo (categoria ya conocida).
  - live5963.jpg -- "Aguilas - Bahia de Levante" (vista de playa con
    palmeras, buena composicion, pero geograficamente mas alejada del
    puerto que las otras 3).
  - Nota de calidad, valida para las 4: son 344x193, un tamano de
    miniatura bajo (SkylineWebcams las genera a partir de su propio
    video, no es la resolucion real de la camara) -- peor que la
    mayoria de proveedores ya integrados.
  - Limite real de esta red, para cualquier zona futura donde aparezca:
    el HLS de video real de SkylineWebcams (visto en el HTML como
    livee.m3u8?a=<token>) lleva un token de sesion que cambia en cada
    carga de pagina -- mismo bloqueo ya documentado para rtsp.me
    (Asturias/Galicia) y el HLS de tendsys.net (Cantabria): exigiria
    replicar la generacion del token en un proxy propio, desarrollo
    nuevo, no correccion trivial. El snapshot JPEG directo es la unica
    via viable sin ese desarrollo.
- Cartagena (puerto/ciudad): ninguna camara real verificable encontrada
  esta pasada, pese a que existe una candidata obvia sin poder
  confirmarla. La Autoridad Portuaria de Cartagena
  (apc.es/webapc/puerto/webcam) es la fuente que cualquier busqueda
  sugiere primero, y meteomurcia.com confirma que existe de verdad
  (embebe un iframe a controlvideo.apc.es:15378, un sistema de video
  propio del puerto) -- pero tanto www.apc.es como
  controlvideo.apc.es dieron HTTP 000 (conexion rechazada) desde este
  entorno, mismo patron de bloqueo de red ya documentado en ROBOT.md
  (2026-08-31) para dominios que no son de infraestructura reconocida
  -- no se puede descartar que la camara exista y funcione, solo que
  no se pudo verificar desde aqui. Pendiente de reintentar desde una
  sesion interactiva o confirmar a mano. El resto de candidatas
  encontradas se descartaron con evidencia real, no por falta de
  busqueda:
  - playawebcams.com/andy/webcam-cartagena.jpg y
    webcam-puerto-cartagena.jpg -- imagenes muertas desde 2018 y 2015
    respectivamente (Last-Modified confirmado, sin cambiar en dos
    peticiones separadas). Anadir playawebcams.com a la lista de
    agregadores que hay que comprobar siempre con Last-Modified antes
    de proponer nada (mismo criterio ya aplicado a g24.gal y
    meteosurfcanarias.com).
  - meteosurfcanarias.com/1-webcams/webcam-murcia.jpg -- SI se
    actualiza (Last-Modified a ~29 min), pero al abrir la imagen
    resulto ser la misma vista de Aguilas (ciudad+puerto+castillo,
    identica composicion a live911.jpg de SkylineWebcams), etiquetada
    genericamente "murcia" -- no vale para el spot de Cartagena.
    Refuerza la leccion ya escrita para Rias Baixas (Hispacams/
    Simbiosys): un agregador puede servir la imagen de una localidad
    distinta a la que promete su nombre de fichero/etiqueta; comprobar
    siempre el contenido visual, no solo que el Last-Modified sea
    reciente.
  - cabo-de-palos.jpg (mismo agregador) -- imagen real y actualizada,
    pero es Cabo de Palos, una localidad distinta (~20km de Cartagena
    puerto, cerca de La Manga) -- descartada por ser el spot
    equivocado, no por falta de datos.
  - SkylineWebcams no tiene camara del puerto de Cartagena -- solo
    tiene "La Manga del Mar Menor - Cartagena" (live490.jpg), que
    corresponde a la franja de La Manga (~37.7, -0.78), geograficamente
    muy alejada del spot cartagena de la app (37.605, -0.986, el
    puerto/ciudad) -- mismo tipo de error ya descartado a proposito
    para Orihuela ("la camara equivocada para este spot").
  - Windy tiene una pagina de camara para "Cartagena/Puerto"
    (windy.com/.../webcams/1265996057) pero, a diferencia de
    portugalwebcams.pt (que si listaba el ID de Windy en HTML
    estatico), la pagina de Windy en si es una SPA sin datos en el
    HTML servido -- no se pudo extraer el ID real para construir la
    URL imgproxy.windy.com sin usar su API (no investigada esta
    pasada). Pendiente de retomar: revisar si existe algun agregador
    espanol (tipo portugalwebcams.pt) que reincruste camaras de Windy
    con el ID visible en HTML estatico, antes de recurrir a su API.
  - Outdooractive lista una camara "Cartagena - North-east: Playa de
    Las Salinas" (id 811771320), pero es contenido de usuario (no
    institucional) de una playa distinta (Las Salinas, no el puerto) y
    su pagina tampoco expone ninguna URL de imagen/video en el HTML
    servido -- descartada por no poder verificarse.
- Terminos de busqueda de ROBOT_REGLAS.md, recuento de esta zona
  (poblaciones: Cartagena y Aguilas): `webcam directo` -- con resultado
  en Aguilas (las 4 camaras de arriba), sin resultado verificable en
  Cartagena; `webcam ayuntamiento` -- sin resultado en ninguna de las 2
  (ningun ayuntamiento con camara propia, todo lleva a agregadores o a
  la Autoridad Portuaria); `webcam club nautico`/`webcam puerto
  deportivo` -- con resultado en Aguilas (Club Nautico de Aguilas,
  live260.jpg, confirmado cruzado con cnaguilas.com), sin resultado
  verificable en Cartagena (Yacht Port Cartagena y Club Nautico La
  Isleta existen pero sin camara encontrada); `webcam surf` -- sin
  resultado en ninguna de las 2 (escuelas de surf reales en ambas
  poblaciones -- Aguilas Surf Club, Surf Nature Murcia -- pero ninguna
  con webcam propia visible, a diferencia de las escuelas de surf
  vascas/cantabras); `webcam pesca`/`webcam puerto`/`webcam cofradia de
  pescadores` -- sin resultado nuevo distinto del ya cubierto por
  apc.es (Cartagena) arriba, sin cofradia con camara propia en Aguilas.

## Sinónimos regionales de especies y cebos (añadido 2026-09-13)

Cuarta responsabilidad de esta rutina, pedida explícitamente por el
usuario: investigar las distintas formas de llamar a un mismo pez o
cebo según la zona de costa (ej. chipirón = txipirón/txipi en Euskadi,
lubina = róbalo en otras zonas de España) y guardarlas en la tabla
`sinonimos_especie` de Supabase para que, con el tiempo, el sistema
reconozca esas variantes.

- **Usa `WebSearch`, no peticiones directas a dominios de datos.** Esta
  es una investigación lingüística/de contenido (nombres, no APIs), y
  `WebSearch` ya funciona sin depender de la política de red saliente
  del entorno (ver `ROBOT.md`, 2026-08-31) — no hace falta pedir
  ampliar el allowlist de red para esto.
- **Cobertura**: revisa las especies ya conocidas por la app (`ESPECIES`
  en `diario.html` + lo que haya en `especies_comunidad`) y las zonas
  donde hay spots (fijos + `spots_usuario`) — prioriza sinónimos de
  zonas con más spots/actividad.
- **Nunca inventar un sinónimo ni una región** — si una fuente no es
  clara sobre si es de verdad un nombre regional usado (y no un error
  de la propia fuente), no lo propongas.
- **Solo propone, nunca verifica**: inserta en `sinonimos_especie` con
  `verificado=false` (la política de RLS ya lo obliga a nivel de base de
  datos — un intento de insertar `verificado=true` con la anon key
  falla). La verificación es manual, desde el Table Editor, mismo patrón
  que `perfiles.aprobado`. Añade también una entrada en `ROBOT.md`
  (nueva sección "Sinónimos regionales") resumiendo qué se propuso y de
  dónde sale, para que quede historial legible sin tener que abrir la
  tabla.
- **Sin límite de pasadas** para esto en concreto (a diferencia de otras
  responsabilidades): puede ir añadiendo sinónimos poco a poco, pasada a
  pasada, sin que cuente contra el límite de volumen de la red de
  seguridad de más abajo (esto es solo un insert por fila propuesta, no
  un cambio de código).

## Localismos/acepciones regionales por spot (añadido 2026-09-15)

Responsabilidad nueva, pedida explícitamente por el usuario, 1x/día por
ahora — distinta de los sinónimos de arriba (que van a la tabla
`sinonimos_especie`) pero del mismo espíritu: los textos libres
(`nota`/`alimento`) de `ESPECIES`/`ESPECIES_MEDITERRANEO`/
`ESPECIES_GOLFO_CADIZ`/`ESPECIES_CANARIAS` en `index.html` a veces
mencionan cómo se llama algo por esa zona (ej. "parrotxa" para la cría
de sardina) — motivado por un bug real: ese término solo se usa en el
Cantábrico según el propio usuario, pero apareció puesto también en
Mediterráneo hasta que se corrigió a mano el 2026-09-15.

- **Objetivo**: para cada spot/zona que ya tiene un localismo puesto
  (como "parrotxa" en Cantábrico) pero le falta el equivalente en las
  otras 3 listas regionales (Mediterráneo, Golfo de Cádiz, Canarias),
  investigar con `WebSearch` si existe un término local real y
  verificable para lo mismo en esa zona — y proponerlo. Prioriza
  primero los huecos ya conocidos (ver arriba: falta el equivalente de
  "parrotxa" — cría de sardina — para Mediterráneo/Cádiz/Canarias).
- **Granularidad real, no solo las 4 zonas amplias**: si una fuente dice
  que un término es de un pueblo/comarca concreto y no de toda la
  región (ej. "en Cartagena no se dice así, se dice X"), anota esa
  matización tal cual en `ROBOT.md` en vez de generalizar a toda la
  lista regional — encaja con la visión a largo plazo del usuario de
  llegar a tener un estudio/fuente por spot, no solo por región amplia.
- **Nunca inventar ni asumir que un término vale para toda España** —
  mismo criterio que el resto de este fichero. Si no se encuentra una
  fuente clara y verificable de que un término se usa de verdad en esa
  zona concreta, no se propone, se deja como hueco explícito.
- **Solo propuesta en `ROBOT.md`**, nunca cambio directo a `index.html`
  — es texto que ve el usuario final, mismo criterio que el resto de
  contenido de `ESPECIES`.

**Segundo objetivo de esta misma pasada, pedido explícitamente por el
usuario (2026-09-15)**: cuestionar de forma sistemática — no dar por
buena para siempre — la propia agrupación de las 4 listas regionales
(`ESPECIES_MEDITERRANEO`/`ESPECIES_GOLFO_CADIZ`/`ESPECIES_CANARIAS`
comparten un único listado entre decenas de spots cada una; `ESPECIES`
por defecto cubre Euskadi+Cantabria+Asturias+Galicia+Portugal
atlántico entero). El usuario ve "muchos spots con los mismos peces" y,
aunque reconoce que tiene cierta lógica biológica (fauna similar en una
misma costa), quiere que el robot lo audite activamente en vez de
asumirlo sin más. Cada pasada de esta responsabilidad debe, además de
localismos, elegir 1-2 spots de una lista regional amplia (rotando cuál,
para cubrir distintos con el tiempo) e investigar con `WebSearch` si su
fauna real difiere de forma notable del resto de spots de esa misma
lista (ej. "¿las especies que se pescan en A Coruña son de verdad las
mismas que en Bermeo, o hay diferencias documentadas?"). Si encuentra
una diferencia real y verificable, proponerla en `ROBOT.md` como
candidata a separar ese spot (o grupo de spots) en su propia lista —
nunca aplicar el cambio directo, es una decisión de producto/estructura
de datos. Si no encuentra diferencias, decirlo explícitamente
("verificado: A Coruña no muestra diferencias documentadas frente al
resto de ESPECIES") para que quede constancia de que SÍ se comprobó, no
solo que se asumió.

## Variables adicionales para el índice de pesca + turbidez por especie (añadido 2026-09-14)

Sexta responsabilidad, pedida explícitamente por el usuario: investigar
variables reales que puedan mejorar `indicePesca` (hoy solo usa rango de
temperatura por especie) y cómo afecta la turbidez del agua a cada
especie/técnica/cebo.

- **Variables candidatas a investigar**: tendencia de presión (ya hay
  histórico real en `presion_historico`, falta usarlo como modificador
  del índice, no solo mostrarlo), ventana de cambio de marea (entrando/
  saliendo suele ser mejor que la pleamar/bajamar de reposo), fase
  solunar (heurística tradicional entre pescadores, no ciencia dura —
  si se añade, dejarlo dicho así de claro en la UI).
- **Turbidez**: afecta mucho según la especie (especies de acecho como
  la lubina suelen ir mejor con turbidez moderada; especies que cazan a
  la vista rinden peor). Open-Meteo no expone turbidez — investigar
  productos de color del océano por satélite (Copernicus Marine tiene
  capas de turbidez) o usar el caudal de ríos que ya tenemos
  (`datosCaudalTodos()` en `functions/prevision.js`) como aproximación
  cerca de desembocaduras, ya que una crecida suele traer turbidez a la
  costa cercana.
- **Fuentes a revisar primero, encontradas el 2026-09-14**: AZTI tiene
  su propia app de pesca recreativa, **RecreAPP** (`aztidata.es/recreapp`),
  centrada en esta misma zona (Golfo de Bizkaia) — mirar si publican
  datos agregados abiertos o estudios derivados. **Open Data Euskadi**
  (`opendata.euskadi.eus`) tiene datasets del Gobierno Vasco sobre
  fauna/pesca — revisar si hay algo de calidad de agua/turbidez o
  biología de especies aprovechable. Ninguna de las dos se ha
  comprobado todavía con una petición real — verificar antes de dar
  nada por buena, como con cualquier fuente nueva.
- **Completar `RIOS` en `index.html` (pedido explícito 2026-09-14)**:
  el array `RIOS` (río + 3 puntos aproximados + `spotCosta`) solo cubre
  ~15 de los ~95 spots fijos ahora mismo — para el resto del río más
  cercano a la desembocadura de cada spot sin entrada todavía, sirve de
  base tanto para el caudal que ya se muestra como para la aproximación
  de turbidez por caudal de arriba. Mismo criterio que ya usa el array:
  posiciones ilustrativas basadas en geografía real (cabecera/medio/
  desembocadura), no coordenadas oficiales de estación — verificar con
  un mapa real que el río de verdad desemboca en o cerca de ese spot
  antes de proponerlo, nunca inventar un nombre de río. Si un spot no
  tiene ningún río real cerca (costa rocosa sin cuenca relevante), no
  forzar una entrada — es un dato correcto que ese spot simplemente no
  tenga río asociado.
- **Siempre propuesta en `ROBOT.md`, nunca cambio directo** a
  `indicePesca` ni a `ESPECIES` — es un dato que se le muestra al
  usuario como fiable para decidir cuándo y qué pescar.

## Coeficiente de marea: por spot, no por zona (revisado 2026-09-13)

Esta sección decía originalmente que había que calibrar un
`RETRASO_MAREA_DIAS` distinto por zona (Cantábrico, Mediterráneo, Golfo
de Cádiz, Canarias...). **Al comprobarlo, resultó falso**: se verificó
contra tides4fishing.com en 6 puertos de zonas distintas (Armintza,
Vigo, Cádiz, Valencia, Las Palmas, Peniche) y el coeficiente publicado
es EXACTAMENTE el mismo, día a día, en los seis — no es un dato por
puerto, es un índice astronómico nacional/compartido (ver
`CALIBRACION.jsonl`, `tipo: "coeficiente_marea_vs_tides4fishing"`).
Calibrar un retraso por zona no tenía sentido: el número de referencia
contra el que se compararía no cambia entre zonas.

Por eso `coeficientePorSpot()` (`functions/prevision.js` y
`diario.html`) ya no usa ese índice nacional como fuente principal —
calcula uno real y distinto por spot a partir del propio rango de marea
que Open-Meteo modela para esa coordenada exacta (ver el comentario
largo en `functions/prevision.js` y la entrada de `CLAUDE.md` del
2026-09-13). `coeficienteMarea()` (la fórmula astronómica con el
retraso de 2 días, verificado con la comparación de arriba) se queda
solo como **respaldo** para cuando la ventana de datos ancha no alcance.

**Si en el futuro se sospecha que `coeficientePorSpot()` da valores
raros para algún spot concreto** (rango casi sin variación, un fallo de
Open-Meteo para esas coordenadas, etc.): compara el resultado contra
tides4fishing.com u otra fuente real para ESE punto en varios días
consecutivos, anota la comparación en `CALIBRACION.jsonl` (mismo
`tipo`), y **propón** el ajuste en `ROBOT.md` — nunca lo apliques
directamente: es un cambio de fórmula que afecta a un dato que se le
muestra al usuario como si fuera fiable, sigue la regla general de
"cambio de producto → proponer, no implementar".

## Regla general: nunca normalizar/agregar con un día a medias (añadida 2026-09-13)

Bug real encontrado comparando un mes completo de Armintza y A Coruña
contra tides4fishing.com: `coeficientePorSpot()` pedía una ventana ancha
de `sea_level_height_msl` a Open-Meteo (`forecast_days=16`), pero el
horizonte real de previsión de esa variable concreta es más corto — a
partir de ~9 días vista, Open-Meteo sigue devolviendo el hueco horario
completo en el JSON, pero con solo 1-2 horas con valor real y el resto
`null`. Ese día "a medias" entraba igual en el cálculo de
`rangoMin`/`rangoMax` de toda la ventana con un rango de marea
falsamente pequeño, y eso desplazaba al alza el coeficiente de TODOS los
demás días de la ventana, no solo el de ese día — confirmado en 3 spots
de costas distintas (Armintza, Bakio, A Coruña), así que no es un caso
aislado. Corregido exigiendo un mínimo de horas válidas (20 de 24) antes
de dejar entrar un día en cualquier cálculo que agregue/normalice contra
una ventana temporal — ver `HORAS_MINIMAS_POR_DIA` en
`functions/prevision.js` y su copia en `diario.html`.

**Regla para cualquier fuente de datos nueva que este robot integre, y
para cualquier revisión futura de las que ya existen**: si un cálculo
agrega u normaliza datos horarios/diarios de una API externa dentro de
una ventana temporal (no solo mareas — vale igual para oleaje, viento,
presión, o lo que venga), comprobar primero cuántas muestras válidas
(no `null`) trae cada punto de la ventana, no solo si el punto
"aparece" en el JSON. Un punto con muy pocas muestras reales debe
descartarse de la agregación, nunca tratarse como un dato completo. Si
al integrar una fuente nueva no está claro cuál es su horizonte real de
fiabilidad (puede ser distinto del `forecast_days`/rango que el propio
parámetro de la API deja pedir), es una corrección de auditoría, no
trivial — documentar el hallazgo en `CALIBRACION.jsonl` y proponer en
`ROBOT.md`, no aplicar directo si toca `functions/` (ver límite de
volumen más abajo).

## Cuota de Open-Meteo cuenta por ubicación, no solo por petición HTTP (añadido 2026-09-14)

Hallazgo real: Open-Meteo cuenta cada ubicación de una petición con
varias coordenadas combinadas como una llamada aparte contra su cuota
(10.000/día en el plan gratuito) — una sola petición a la Marine API
con las ~95 coordenadas de `SPOTS` (como hace `functions/prevision.js`)
gasta de golpe ~95 llamadas de esa cuota, no 1. Con tráfico de pruebas
más el cron horario de `presion-historico.yml`, esto agotó la cuota
diaria en un solo día (ver `CLAUDE.md`, incidente del 2026-09-13/14 —
casi todos los spots del mapa se quedaron sin datos, HTTP 429).
Corregido con caché real (Cache API de Cloudflare) en `/prevision`, no
tocar esa protección al investigar fuentes nuevas de Open-Meteo. **Para
cualquier fuente nueva que este robot proponga o integre**: si combina
varias ubicaciones en una sola petición (patrón habitual de Open-Meteo
y de otras APIs meteorológicas/marinas), asumir que la cuota se cuenta
por ubicación, no por petición HTTP, y tenerlo en cuenta al estimar si
una fuente nueva es viable dentro de un plan gratuito.

## `/prevision` cerca del límite de 50 sub-peticiones de Cloudflare (añadido 2026-09-15)

Hallazgo real de una auditoría de fallos silenciosos pedida por el
usuario: cada petición a `/prevision` hace ~39 sub-peticiones de red de
las 50 que permite el plan gratuito de Cloudflare Pages Functions antes
de cortar la petición entera (mismo error 1102 que ya rompió
`registrar-presion.js` — ver más abajo, "Red de seguridad"). El grueso
son las **26 boyas de `BOYAS`** en `functions/prevision.js`
(`datosBoya()`, una petición HTTP por boya a
`poem.puertos.es/portus/StationData?code=<código>`) — ya se comprobó en
real el 2026-09-15 que esa API **no admite varios códigos separados por
comas en el mismo parámetro** (`code=2136,1117,1101` → `500 Internal
Server Error`), así que no hay forma trivial de agruparlas en menos
peticiones sin más investigación (¿existe algún otro endpoint de
Puertos del Estado que sí sea "todas las boyas en una llamada"? No se ha
encontrado todavía).

**Regla para cualquier pasada de este robot que toque `BOYAS` u otra
lista que se recorra con `.map()` haciendo un fetch por elemento dentro
de `/prevision`**: antes de añadir una boya/estación nueva a esa lista,
comprobar cuántas hay ya (contar las entradas de `BOYAS` en
`functions/prevision.js`) y tener en cuenta que cada una es una
sub-petición más cerca del límite — con margen para poco más de 10
boyas nuevas antes de arriesgarse a romper `/prevision` en silencio
para TODOS los usuarios (no solo un cron interno, como pasó con la
presión). Si se encuentra una fuente de boyas nueva, investigar primero
si tiene una variante de "todas las estaciones en una sola petición"
(patrón bulk) — si no la tiene, proponerla en `ROBOT.md` marcando
explícitamente este riesgo, nunca integrarla directa sin más si ya hay
boyas cerca del límite.

## Mar de fondo: boyas exteriores + batimetría + webcams (añadido 2026-09-14)

Quinta responsabilidad de esta rutina, pedida explícitamente por el
usuario: investigar si es viable estimar la mar de fondo (swell de
periodo largo) que va a llegar a cada spot en las próximas horas,
combinando tres fuentes:

- **Boyas exteriores** (aguas profundas) de Puertos del Estado — el
  oleaje de fondo viaja con poca pérdida de energía y a una velocidad
  de grupo calculable por su periodo, así que se podría propagar la
  lectura hasta cada spot.
- **Batimetría** para modelar cómo se transforma esa mar de fondo al
  llegar a aguas más someras cerca de cada spot.
- **Imágenes de webcam** como corroboración cualitativa (nunca como
  fuente numérica independiente — visión artificial para altura de ola
  real es frágil y necesitaría calibración por cámara).

**Encaja en la pasada de "mareas y oleaje"** (cron `47 8 * * *`) del
robot buscador de fuentes. Cualquier modelo resultante debe calibrarse
contra boyas costeras reales antes de proponerse (mismo patrón que la
calibración de oleaje y el coeficiente de marea por spot, ver
`CALIBRACION.jsonl`) — **siempre propuesta en `ROBOT.md`, nunca
aplicación directa**, es un cambio a un dato que se muestra al usuario
como fiable.

## Buenas prácticas de otras apps y biología de especies (añadido 2026-09-13)

Tres responsabilidades más, pedidas explícitamente por el usuario, que
se suman a las 4 originales del robot buscador de fuentes — a
diferencia de esas (datos en tiempo real, verificables con una
petición HTTP), estas tres son de investigación/contenido, así que
corren solo 1 vez al día cada una (no 4):

- **Buenas prácticas de otras apps de mareas/pesca**: qué datos en
  tiempo real o funciones tienen apps como Windy, Tides4fishing,
  Fishbrain, Meteoblue, Puertos del Estado o AEMET que Costaviva no
  tenga todavía. Usa `WebSearch`. **Esto es siempre una propuesta, nunca
  una implementación directa** — "otra app hace X" es una decisión de
  producto por definición (ver la regla general de este fichero: cambio
  de frontend/diseño/producto → proponer, no implementar), así que
  aplica aquí sin excepción, no solo cuando la pasada decida que el
  cambio es grande. Añade una entrada a `ROBOT.md` con lo encontrado,
  aunque sea "sin novedades esta pasada".
- **Migración y cría de especies**: para las especies ya en `ESPECIES`
  (`diario.html`), investigar épocas de migración y rangos de
  temperatura para reproducción/cría/reposo (no solo el rango de pesca
  que ya se usa en `indicePesca`). Mismo criterio que los sinónimos
  regionales de especies: **nunca inventar un dato** — si una fuente no
  da un rango claro y verificable para una especie/zona concreta, no lo
  propongas. Esto es también siempre una propuesta en `ROBOT.md` (nunca
  un cambio directo a `ESPECIES` ni a la fórmula de `indicePesca`),
  porque cambia lo que se le muestra al usuario como dato fiable.
- **Estudios institucionales/académicos, tipo DIGIPESCA** (añadido
  2026-09-15, pedido explícito del usuario): buscar con `WebSearch`
  bases de datos y estudios reales — de universidades, organismos
  públicos de pesca, proyectos de investigación financiados (Next
  Generation EU, Ministerio de Agricultura/Pesca, Xunta, Generalitat,
  Junta de Andalucía, equivalentes portugueses como el IPMA...) — que
  aporten datos verificables de especies/lonjas/capturas/precios por
  zona y fecha, del estilo del proyecto DIGIPESCA (ver la entrada
  dedicada más abajo). El **ámbito geográfico actual es España y
  Portugal** (visión del usuario: si funciona bien ahí, se expandirá a
  otros países más adelante — no asumir que el proyecto es solo del
  Cantábrico ni solo de España). Cada estudio nuevo que se encuentre
  debe pasar, antes de proponer nada con él, por las mismas reglas ya
  documentadas para DIGIPESCA en esta sección: separar bajura/altura,
  cruzar con hábitos/costumbres reales de captura, cuidado con
  localismos regionales (un término/dato de una zona no vale para
  otra sin verificar), y nunca inventar un dato que la fuente no dé
  claro. Propuesta en `ROBOT.md` primero; solo aplicar directo a
  `ESPECIES`/`index.html` cuando el dato esté genuinamente contrastado
  y dentro de los límites de volumen de este fichero.

**Fuente DIGIPESCA — acceso real conseguido el 2026-09-15, 1 corrección
ya aplicada a `ESPECIES_MEDITERRANEO`**: proyecto DIGIPESCA (Universitat
Politècnica de València), datos reales de venta en lonja por especie —
cantidad, precio medio, facturación — desglosados por lonja y por mes.
Cobertura: **Mediterráneo español + Atlántico de Andalucía únicamente —
NO Cantábrico, Galicia ni la costa atlántica de Portugal** (Costaviva
cubre España y Portugal enteros, así que esa zona se queda sin esta
fuente).

**Cómo acceder de verdad (la web/notas de prensa NUNCA enlazan el
fichero directo — esto es lo que costó encontrar, reutilizar en futuras
pasadas)**: la API REST de discovery de RiuNet.
`https://riunet.upv.es/server/api/discover/search/objects?query=digipesca`
devuelve un item por año (2011-2021, faltan 2016-2018 sin indexar con
ese término), cada uno con su propio `handle` (`10251/1957XX`). Cada
item trae 2 bundles descargables sin login (licencia ODC-PDDL/dominio
público) en `/server/api/core/bitstreams/{uuid}/content`: un README y un
`.xlsx` real (~2MB, ~480.000 celdas, una hoja por lonja/cofradía).

**Resultado real de cruzar el `.xlsx` de 2021 con nuestras especies**
(solo bajura, `zona: "costa"`, por la regla de arriba):
- Dorada, Calamar y Choco/Sepia: confirman sin cambios los `meses` que
  ya teníamos.
- **Breca (aplicado)**: las 3 lonjas catalanas con desglose mensual
  (Roses/Blanes/Cambrils) muestran volumen real casi todos los meses,
  sin el hueco (mayo, agosto-noviembre) que teníamos — `meses` ampliado
  a todo el año, citando DIGIPESCA en la nota.
- Cartagena (spot propio): sin desglose mensual en 2021, solo totales
  anuales — no sirve para refinar `meses` ahí.
- Golfo de Cádiz: sí hay desglose mensual pero volúmenes minúsculos (ej.
  Sargo, 65 kg/año total) — demasiado ruido para una conclusión fiable,
  no se tocó nada ahí.
- Palometa: descartada — DIGIPESCA mezcla 3 nombres distintos ("japuta/
  palometa negra", "capellán/palometa", "palometa blanca") sin que quede
  claro cuál es la nuestra; coincide con que ya estaba marcada como dato
  dudoso.

**Pendiente para una futura pasada**: hay 6 años más descargables
(2011-2015, 2019-2021 ya visto) que podrían confirmar si el patrón de
Breca es consistente o fue solo cosa de 2021, y localizar los años
2016-2018 (no indexados por "digipesca" en la búsqueda — probar otros
términos en la misma API de discovery).

**Advertencia explícita del usuario, obligatoria antes de usar cualquier
dato de lonja/desembarque para nada de esto**: hay que separar bajura de
altura, y el criterio ya existe en el código — el campo `zona` de cada
especie en `ESPECIES` (`"costa"` = bajura, `"mar adentro"` = altura). Un
dato de precio/volumen en una lonja concreta es un proxy razonable de
"se está pescando cerca de aquí" SOLO para especies de bajura (barcos que
salen y vuelven el mismo día, cerca del puerto). Para especies de altura
(ej. Bonito del norte, Dentón, Urta, Medregal — cualquiera con
`zona: "mar adentro"`) el dato de desembarque NO sirve como proxy de
zona: el pez puede llevar días de viaje y haberse capturado a cientos de
km del puerto donde se vendió, así que usar su precio/volumen de lonja
para inferir "hay actividad de esta especie en ESTA zona costera" sería
un dato mal interpretado, no uno fiable. Cualquier propuesta que use
datos de lonja debe distinguir explícitamente bajura/altura y, para
altura, contrastar con al menos otra fuente (zona de pesca real del
barco, no solo puerto de venta) antes de dar el dato por bueno — si no
se puede contrastar, se descarta esa especie para esta idea en concreto,
no se propone con la salvedad "puede que no sea exacto".

**Segundo cruce obligatorio, añadido por el usuario (2026-09-15)**: que
una especie esté abundante y barata en lonja un mes concreto (indicativo
de que hay muchas capturas) NO significa que un pescador de costa vaya a
poder pescarla — el ejemplo del propio usuario: mucho pargo a buen
precio no quiere decir que se pesque bien de costa, "alguno saldrá pero
es raro", porque el pargo vive y se captura sobre todo en fondos
profundos/embarcación. Antes de traducir "abundante+barato en lonja este
mes" en una propuesta tipo "buen mes para pescar esta especie [en esta
zona]", hay que cruzarlo con los **usos y costumbres reales de la
especie** — hábitat (profundidad, tipo de fondo), si se captura
normalmente desde costa/embarcación (mismo campo `zona` de arriba, pero
mirado ahora desde el ángulo "¿es realista para alguien tirando desde la
orilla?", no solo "¿dónde se desembarcó?") y método de pesca habitual —
no solo la fase bajura/altura del barco. Una especie de bajura (zona:
"costa") puede seguir siendo predominantemente de fondo profundo cerca
de la costa y poco realista a lanzado desde la orilla; el dato de lonja
por sí solo no lo distingue. Si la especie/mes en cuestión no tiene una
fuente clara sobre sus hábitos reales de captura (no solo su biología
general), no proponer la conclusión de "buen mes de costa" — proponer
como mucho el dato de lonja en bruto, marcado explícitamente como sin
contrastar con hábitos.

**Localismos regionales en los textos de `ESPECIES` (añadido
2026-09-15, bug real encontrado por el usuario)**: cada campo `nota` y
`alimento` puede mencionar cómo llaman a algo por esa zona en concreto
(ej. "parrotxa" para cría de sardina, propio del valenciano/catalán) —
pero SOLO si ese texto vive en el array regional correcto
(`ESPECIES_MEDITERRANEO`, `ESPECIES_GOLFO_CADIZ`, etc.), nunca en
`ESPECIES` (Cantábrico/Atlántico Norte) ni copiado sin más a otra
región. Se encontró exactamente este bug: "parrotxa" aparecía en dos
entradas de `ESPECIES` (Cantábrico) y una frase genérica al pie del
panel de especies ("así la llaman por aquí") se mostraba siempre, para
cualquier spot de España o Portugal — ya corregido (el término solo
sigue en la entrada de Lubina de `ESPECIES_MEDITERRANEO`, y la frase del
pie solo se pinta si esa palabra aparece de verdad en la lista de
especies de temporada de ESE spot). Antes de proponer o aplicar un
localismo nuevo: verificar con una fuente real que se usa en ESA zona en
concreto (no asumir que un término vale para toda España), y nunca
reutilizarlo sin comprobar en una región distinta.

**Visión a largo plazo, pedida explícitamente por el usuario
(2026-09-15)**: el objetivo no es solo tener 4 listas regionales de
especies (`ESPECIES`/`_MEDITERRANEO`/`_GOLFO_CADIZ`/`_CANARIAS`), sino ir
buscando progresivamente estudios de todo tipo — locales, comarcales,
nacionales — que enriquezcan CADA spot en concreto, no solo su región
amplia. El ideal declarado por el usuario es que exista una fuente/
estudio de este tipo por spot. Esto es un objetivo a muy largo plazo,
no una tarea de una sola pasada — cada vez que el robot (en la pasada de
"migración y cría de especies" o en la de "buenas prácticas") encuentre
un estudio con alcance más fino que las 4 regiones actuales (un puerto,
una ría, una comarca costera concreta), debe proponerlo en `ROBOT.md`
como candidato a granularidad extra para ese spot en particular, aunque
de momento no exista mecanismo en el código para aplicar datos por spot
individual dentro de una lista regional (eso sería, en sí mismo, un
cambio de diseño a proponer aparte, nunca aplicado directo).

## Red de seguridad de la automatización (añadido 2026-09-12)

Estas reglas existen porque "el propio prompt dice que esto es
aditivo/seguro" no es una comprobación — es una promesa. Aplican a
cualquier pasada de esta rutina que escriba directamente en el repo
(rama `robot/AAAA-MM-DD`) sin pasar por revisión humana antes:

- **Límite de volumen — cuarentena, no aplicar a ciegas.** Si una misma
  pasada va a tocar más de 3 ficheros, o más de ~80 líneas en total, o
  cualquier fichero de `functions/` o `supabase/`, eso ya no es una
  "corrección trivial": para, no lo commitees directo, y déjalo como
  propuesta en `ROBOT.md` para que el usuario lo revise. Única
  excepción, acotada y explícita: integrar una cámara con mar a la vista,
  y crear su spot si no existe (ver esa sección) — ahí sí se permite pasar
  del límite y tocar `functions/prevision.js` y `functions/webcam/[slug].js`,
  siempre de forma aditiva y solo en los puntos de edición que esa sección
  lista. El límite es
  deliberadamente bajo — las correcciones triviales que este fichero
  autoriza a aplicar directo (un campo de un JSON, una URL de dominio)
  caben de sobra dentro de él.
- **Interruptor de pausa.** Si existe un fichero `ROBOT_PAUSADO` en la
  raíz del repo, esta rutina no debe escribir nada (ni commits ni ramas
  nuevas) en esa pasada — solo puede leer y, como mucho, añadir una nota
  de diagnóstico en `ROBOT.md` explicando que está pausada. Es la forma
  de que el usuario pare toda la automatización de golpe sin tener que
  cambiar permisos ni credenciales.
- **Muestreo periódico.** Cuando exista una auditoría de seguridad/fiabilidad
  periódica para este repo (ver `CLAUDE.md`, sección de pendientes), debe
  incluir una revisión de las últimas pasadas de esta rutina — no solo del
  código de la app — para confirmar que estas guardas se están respetando
  de verdad y no solo están escritas aquí.
