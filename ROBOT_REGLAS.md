# ROBOT_REGLAS.md — reglas estables del robot de datos de Costa Viva

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
  sea una decisión de producto → no implementar, solo proponer aquí.
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
  Fishbrain, Meteoblue, Puertos del Estado o AEMET que Costa Viva no
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
NO Cantábrico, Galicia ni la costa atlántica de Portugal** (Costa Viva
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
  propuesta en `ROBOT.md` para que el usuario lo revise. El límite es
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
