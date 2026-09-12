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
