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

## Calibración del retraso de marea por zona (añadido 2026-09-13)

`coeficienteMarea()` (`functions/prevision.js` y `diario.html`) calcula
el coeficiente de marea por fase lunar, con un `RETRASO_MAREA_DIAS`
("edad de la marea" — la marea real no responde al instante a la luna
nueva/llena) calibrado el 2026-09-13 SOLO para Armintza/costa cantábrica
(comparado contra tides4fishing.com, ver `CALIBRACION.jsonl`,
`tipo: "coeficiente_marea_vs_tides4fishing"` — sin ese retraso, la
fórmula salía sistemáticamente ~2 días adelantada). Ese mismo valor
(2 días) se usa hoy como mejor estimación disponible para TODAS las
zonas (Mediterráneo, Golfo de Cádiz, Canarias, Atlántico portugués) sin
haberse verificado ahí — puede que el retraso real sea distinto en cada
una (el fenómeno depende de la geometría de cada costa/puerto).

**Regla para cuando se añadan spots nuevos en una zona todavía sin
calibrar** (pedido explícito del usuario — llevar un archivo interno
con los datos ya calibrados por zona + cómo calibrar las que falten):

1. Elige un puerto real de esa zona con coeficiente de marea publicado
   (ej. `tides4fishing.com/es/<provincia>/<puerto>`) — verifica con una
   petición/lectura real, nunca de memoria.
2. Anota el coeficiente real de 5-6 días consecutivos.
3. Calcula lo que da `coeficienteMarea()` SIN retraso para esas mismas
   fechas (edad de marea = fecha, sin restar nada).
4. El desfase en días entre la curva calculada y la real (cuánto hay que
   restar para que ambas curvas casen) es el `RETRASO_MAREA_DIAS` de esa
   zona — normalmente entre 0 y 3 días.
5. Añade las observaciones a `CALIBRACION.jsonl` (mismo `tipo:
   "coeficiente_marea_vs_tides4fishing"`, con el `spot`/`region`
   correspondiente) y **propón** en `ROBOT.md` el nuevo valor por zona —
   nunca lo apliques tú solo al código: es un cambio de fórmula que
   afecta a un dato que se le muestra al usuario como si fuera fiable,
   así que sigue la regla general de "cambio de producto → proponer, no
   implementar".

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
