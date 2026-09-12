# CLAUDE.md — Costa Viva / Fishnow

Este fichero se lee al empezar cada sesión y se reescribe libremente cuando
cambian las convenciones — no es un historial (para eso está `ROBOT.md`).
Si algo de aquí queda desactualizado, corrígelo en el momento en que lo
detectes, no lo dejes para luego.

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
  tal cual, salvo lo que bloquee `_redirects` — **cualquier fichero que
  añadas al repo fuera de `functions/` es servido en público** salvo que
  lo excluyas explícitamente. Antes de añadir un fichero con datos
  internos/operativos a la raíz, añádelo a `_redirects`.
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
- **Verificado en vivo el 2026-09-12**: petición sin token de sesión (solo
  anon apikey) contra las 6 tablas de usuario devuelve `200 []` en todas
  — RLS está activo y funcionando, no solo declarado en el `.sql`.
  Pendiente (no hecho todavía, requiere confirmación antes de crear
  cuentas de prueba reales): la prueba cruzada "token de usuario A leyendo
  fila de usuario B".
- Ningún endpoint de `functions/*.js` usa `service_role` — solo el token
  que llega en `Authorization: Bearer <token>` del propio usuario
  (`sos-alerta.js` es el único que toca tablas de usuario).

## Endpoints (`functions/`)

| Ruta | Fichero | Qué hace | Auth |
|---|---|---|---|
| `/prevision` | `prevision.js` | Oleaje/viento/marea/corriente (Open-Meteo + boyas Puertos del Estado) + caudal de ríos por spot | No requiere sesión |
| `/luna` | `luna.js` | Fase y posición lunar por coordenadas (`?lat=&lon=`) | No requiere sesión |
| `/rayos-imagen` | `rayos-imagen.js` | Proxy del mapa de rayos de AEMET | No requiere sesión |
| `/webcam/<slug>` | `webcam/[slug].js` | Proxy de imagen de webcam (evita CORS/hotlinking) | No requiere sesión |
| `/sos-alerta` | `sos-alerta.js` | POST: manda el aviso SOS (email vía Resend) a los contactos de emergencia del usuario que llama | **Requiere** `Authorization: Bearer <token de sesión>` |

Ninguno de los cuatro primeros toca tablas de usuario en Supabase.
`sos-alerta.js` es el único que sí, y usa siempre el token de quien llama.

## URL de producción

**`https://fishnow-59u.pages.dev/`** (confirmado 2026-09-12: `Server:
cloudflare`, `/login`, `/manifest.json` y todos los endpoints de
`functions/` responden como se espera). `costaviva.app` NO es este
despliegue — responde con cabeceras de Vercel y 404 en rutas que sí
existen aquí; no usarlo para verificar nada de este repo.

**Exposición pública confirmada y corregida el 2026-09-12**: antes de
añadir `_redirects`, `ROBOT.md`, `CALIBRACION.jsonl`, `README.md`,
`start.ps1` y ambos `supabase/*.sql` se servían con `200` en producción
(contenido revisado: sin secretos ni datos reales de usuarios, pero sí
detalle interno de esquema/RLS e historial operativo — exposición de
información, no fuga de datos de usuario). El `_redirects` los bloquea;
falta desplegarlo (commit + push) para que el arreglo llegue a
producción — hasta entonces `git status`/este fichero no reflejan lo que
de verdad sirve `fishnow-59u.pages.dev`.

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

**No cubre** la prueba más estricta (token de usuario A leyendo una fila
de usuario B) — necesita dos cuentas reales y confirmadas (el alta tiene
"Confirm email" activo en este proyecto), así que no se puede automatizar
sin que el usuario aporte esas credenciales o decida otra vía.

## Pendiente conocido (no tocar sin confirmar)

- Prueba cruzada usuario-A-lee-fila-de-usuario-B (ver arriba: necesita
  credenciales de dos cuentas reales confirmadas, o decidir otra vía).
- Desplegar lo de esta sesión (commit + push) para que llegue de verdad a
  producción: `_redirects`, el test de autenticación programado, la
  vigencia de 1h del índice de mar/pesca.
- Escaneo de seguridad tipo OWASP ZAP contra producción — diseño
  propuesto, pendiente de decisión sobre a quién avisar y si activarlo ya.
- Informe diario de salud (fuentes externas, alarmas SOS disparadas sin
  exponer datos personales, incidentes) — pendiente de decidir
  destinatario y mecanismo de envío.
