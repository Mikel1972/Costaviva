# COMPARATIVA_PROYECTOS.md — Costaviva vs. Pólizas.ai / Etxeapala / Lurnahi

**Generado: 2026-09-25.** Primera pasada de este robot — no hay una versión de
la semana anterior con la que comparar, así que no hay nada todavía marcado
como "ya portado". A partir de la próxima pasada, esta cabecera dirá qué de
lo de abajo se implementó entre medias.

Reescrito entero cada semana (no se acumula). Los otros tres repos se leyeron
en solo lectura desde `/tmp/hermanos/`, sin tocar nada allí. Ya se leyó
`TRAMPAS_COMPARTIDAS.md` (en `polizas-ai`) antes de esta pasada — lo de aquí
abajo no repite lo que ya está ahí, lo complementa con hallazgos nuevos de
esta ronda de 5 dimensiones.

Orden: de más a menos valor si se portara a Costaviva.

---

## 1. Detección de drift de esquema/RLS sin migración asociada — Costaviva no tiene nada parecido

**Pólizas.ai lo resuelve, ningún otro de los 4 proyectos lo tiene**:
`vigia-esquema.yml` (cron `52 3 * * *`) compara el esquema/RLS real de
producción contra lo que las migraciones versionadas dicen que debería haber,
y avisa si hay una diferencia — es decir, detecta si alguien tocó algo a mano
en el SQL Editor sin dejar rastro en `supabase/migrations/`.

**Por qué esto es justo el hueco de Costaviva, no una mejora genérica**: el
propio `CLAUDE.md` de este repo documenta el problema exacto que esta pieza
previene — el hallazgo del 2026-09-20 de que ~13 migraciones aplicadas entre
el 2026-09-17 y el 2026-09-19 se habían pegado a mano en el SQL Editor y la
CLI nunca se enteró (`supabase migration list` las mostraba como
`"remote": ""` pese a estar ya en producción). Se resolvió esa vez con
`supabase migration repair`, pero fue una reconstrucción manual después del
hecho — nada avisó de la desincronización cuando ocurrió. Con un vigilante
como el de Pólizas.ai, ese hallazgo habría llegado como aviso automático el
mismo día, no descubierto varios días después al usar `migration list` por
primera vez.

---

## 2. Test unitario que fija el comportamiento fail-closed de la lista blanca de rutas — falta en Costaviva

Costaviva migró de lista negra a lista blanca el 2026-09-25
(`functions/_lib/rutas-publicas.js`, usado por `functions/_middleware.js:21-28`)
tras el tercer incidente de exposición (`/functions/`, `/scripts/`,
`/.github/`). El mecanismo en sí ya es tan bueno como el de Pólizas.ai — pero
Pólizas.ai además tiene `test/rutas-publicas.test.js:1-20`, un test unitario
que fija como caso central "un fichero nunca visto sigue bloqueado por
defecto" (fail-closed).

**Por qué importa portarlo ahora, no en abstracto**: el mecanismo de lista
blanca de Costaviva solo se verificó una vez a mano contra producción
(`curl` real tras el despliegue del 2026-09-25). Un test así habría
detectado en CI, sin depender de acordarse de probarlo en real, cualquier
regresión futura del tipo "se añadió una ruta nueva a `PREFIJOS_PUBLICOS`
demasiado amplia" o "se quitó por error una entrada existente". Es barato de
escribir (el propio test de Pólizas.ai es de 20 líneas) y cierra el mismo
tipo de hueco que ya costó tres incidentes reales.

---

## 3. Clasificación de fallos de proveedor centralizada en un único helper — Costaviva la duplica por endpoint

Costaviva ya tiene la pieza correcta (`clasificarFalloProveedor()` en
`functions/identificar-captura.js:39-64`, y el mismo criterio aplicado
por separado en `functions/crear-checkout-stripe.js:182-194`) — nunca
reenvía el cuerpo crudo del proveedor, degrada con mensaje neutro. Eso ya
pone a Costaviva por delante de Etxeapala y Lurnahi en esta dimensión (ver
más abajo, sección "Costaviva ya va por delante").

Lo que le falta frente a **Pólizas.ai**: allí la clasificación vive en un
único helper (`functions/api/polizas/_claude.js:124-135`,
`clasificarFalloClaude()`) reutilizado literalmente por 8 endpoints distintos
(`process.js:181-189`, `pregunta.js:129-134`, `comparar-cotizacion.js:144-146`,
`evento-vida-custom.js:140-141`, `prueba-estres.js:187`,
`miembro-familia.js:129-184`, entre otros). En Costaviva, en cambio, la
misma idea está escrita dos veces con criterios ligeramente distintos (una
vez para Anthropic, otra para Stripe) en dos ficheros separados sin un
helper común.

**Por qué portarlo ahora**: hoy Costaviva solo tiene un endpoint real que
llama a Anthropic (`identificar-captura.js`), así que la duplicación
todavía es barata. Pero si aparece un segundo uso de Claude en este repo
(el propio `ROBOT.md`/`CLAUDE.md` menciona que la app puede crecer en este
sentido), la lógica se volvería a copiar-pegar por tercera vez sin un sitio
único que corregir. Extraer un `functions/_lib/clasificar-fallo-proveedor.js`
ahora, con los dos casos ya conocidos (Anthropic y Stripe) parametrizados,
es más barato que hacerlo después de que exista un tercer caso.

---

## 4. Histórico legible "esperado vs. real" por cada pasada de smoke test — Costaviva no lo tiene

Costaviva ya tiene el smoke test más completo de los cuatro proyectos en
cuanto a **cobertura** (`smoke-test.yml`: login real, `/prevision`,
`/webcam/mundaka`, sube foto real a `/identificar-captura` con degradación
si falla por saldo, crea/borra salida de pesca real, y con dos cuentas
completa el ciclo de un grupo hasta borrarlo y confirmar que no queda fila
— líneas 94-99, 101-118, 156-167, 209-298). Lo que le falta es
**legibilidad histórica**: Pólizas.ai documenta cada pasada de su propio
smoke test (`test/e2e-smoke.mjs`) en `PRUEBA_E2E.md` como una bitácora
cronológica, comparando explícitamente qué se esperaba contra qué pasó de
verdad en cada ejecución (incluye, por ejemplo, una entrada real sobre una
caída por saldo agotado de Anthropic).

**Por qué importa**: hoy, para saber si el smoke test de Costaviva ha fallado
alguna vez por algo distinto a saldo/configuración, hay que ir a
`gh run list --workflow=smoke-test.yml` y abrir logs uno a uno. Un fichero
tipo `PRUEBA_E2E.md` actualizado en cada pasada (aunque sea de forma
resumida) daría una vista rápida de qué se ha probado y qué salió distinto
de lo esperado, sin tener que reconstruirlo desde los logs de Actions cada
vez.

---

## 5. Mitigación de inyección al usar `service_role` con filtros construidos dinámicamente

Costaviva usa `service_role` en solo dos sitios, ambos ya justificados y sin
construir filtros PostgREST a partir de input variable de tabla
(`notificar-altas.js`, secreto compartido; `stripe-webhook.js`, firma HMAC
verificada). No hay un hueco activo hoy. Pero **Lurnahi** tiene un patrón de
defensa en profundidad que vale la pena anotar para cuando Costaviva
construya un endpoint nuevo con `service_role` y un parámetro dinámico:
`approve-delete.js:57,82-96` valida el formato UUID del identificador
recibido y usa una **lista blanca de nombres de tabla** antes de
interpolarlos en un filtro de PostgREST — evita que un parámetro mal
formado o un nombre de tabla no esperado llegue a construir una query con
más alcance del previsto.

**Por qué anotarlo ahora aunque no haya hueco activo**: es el tipo de
detalle fácil de olvidar la primera vez que se escribe un endpoint nuevo con
`service_role` y algún filtro parametrizado — mejor tenerlo documentado
antes de que haga falta que descubrirlo tras un incidente.

---

## Costaviva ya va por delante en esto (no hace falta portar nada, es información)

- **Reenvío crudo de errores de proveedor**: Etxeapala reenvía el JSON
  completo de Anthropic sin clasificar (`functions/ai.js:44-45`) y además
  propaga el mensaje crudo hacia una excepción visible en cliente
  (`subir.html:668`). Lurnahi hace lo mismo y peor: reenvía status+JSON
  crudo (`functions/api/claude.js:92-95`), reenvía también `err.message` de
  su propio `catch` (`functions/api/claude.js:98`), y mete hasta 300
  caracteres de texto crudo de Anthropic en la respuesta al cliente
  (`functions/api/analyze.js:180`). Costaviva ya resolvió exactamente este
  problema el 2026-09-25 (ver arriba). No hace falta ninguna acción — es
  una confirmación de que la sección "Sin saldo de API, nada se rompe" de
  `CLAUDE.md` sigue siendo la referencia correcta, y que dos de los tres
  hermanos todavía no la tienen.
- **Degradación visible en workflows con IA**: de los cuatro proyectos,
  Costaviva es el único que llama a Claude directamente desde varios
  workflows y clasifica el fallo de saldo con `::warning::` +
  `$GITHUB_STEP_SUMMARY` (`robot-buscador-fuentes.yml:164`,
  `robot-patrones-uso.yml:68-90`, `robot-mejores-practicas.yml:106-119`).
  `daily-report.yml:474-514` va un paso más allá: si la síntesis del día
  queda vacía por un fallo de saldo, el propio Issue público lo dice — doble
  aviso (Actions + Issue), el patrón más completo de los cuatro repos en
  esta dimensión concreta. Ningún hermano tiene una pieza equivalente
  (ninguno llama a Claude desde sus YAML con esta granularidad).
- **Lista blanca de rutas**: ya al nivel de Pólizas.ai (la mejor referencia),
  muy por delante de Etxeapala (sin ningún filtrado de rutas — ni lista
  blanca ni negra, `functions/_middleware.js:6-27` solo toca cabeceras CSP)
  y Lurnahi (ni siquiera tiene `_middleware.js`).

---

## Pendiente propio de Costaviva, sin solución mejor en ningún hermano (no es "portar", es deuda ya conocida)

**`robot-experiencia-usuario.yml:134`** tiene `continue-on-error: true` y
detecta el caso de saldo agotado (línea 154), pero cualquier otro fallo (el
caso ya documentado de agotar `--max-turns` sin llegar a escribir el
informe) también queda en verde, detectable solo si alguien abre el Issue y
ve el texto de reserva. Ninguno de los tres hermanos ofrece un patrón mejor
para copiar aquí, porque ninguno invoca Claude directamente desde un YAML
con esta forma — así que esto sigue siendo tarea propia de Costaviva, no
algo que un hermano ya haya resuelto mejor. Queda anotado para no perderlo
de vista, tal como ya lo señala `CLAUDE.md`.

---

## Dimensiones cubiertas donde uno o más proyectos no aplican

- **RLS / `security definer` / `service_role` (dimensión 3)**: los cuatro
  usan Supabase, todos aplican. Hallazgo adicional a lo ya recogido arriba:
  Etxeapala no versiona su RLS en absoluto (no hay ningún `.sql` en su
  repo — se gestiona a mano en el panel de Supabase), lo que lo deja
  expuesto al mismo tipo de deriva silenciosa que motivó el punto 1 de este
  informe, pero sin ninguna migración de la que partir para detectarla.
  Esto no es portable *a* Costaviva (Costaviva ya versiona su esquema) —
  se anota solo como contexto de por qué la pieza del punto 1 importa tanto.
- **Stripe**: solo Costaviva lo usa de los cuatro (Pólizas.ai lo tiene
  explícitamente pendiente, `functions/api/polizas/canjear-codigo.js:6-8`;
  Etxeapala y Lurnahi no lo usan). No hay nada que comparar en esta ronda.
