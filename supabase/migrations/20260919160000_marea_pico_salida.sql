-- Costa Viva — pico de marea de la salida (2026-09-19)
--
-- Pedido explícito del usuario: la altura de marea suelta no tiene
-- mucha lógica para quien no es oceanógrafo ("el dato de marea no tiene
-- mucha lógica tal cual"). En vez de un número relativo, se guarda el
-- próximo pico (pleamar/bajamar) relevante para la salida entera: el que
-- caiga dentro de [hora_inicio, hora_fin], o el más cercano por fuera si
-- no hay ninguno dentro. Ver picoDeMareaEnIntervalo() en diario.html.
--
-- marea_altura/marea_tendencia (inicio) y marea_altura_fin/
-- marea_tendencia_fin siguen existiendo tal cual -- siguen siendo útiles
-- como "qué hacía la marea en ese instante concreto" (de ahí salen las
-- flechas ▲/▼ junto a cada hora). Esto es un dato nuevo y distinto: el
-- resumen de toda la sesión.
alter table public.salidas_pesca
  add column if not exists marea_pico_tipo text,
  add column if not exists marea_pico_hora text;
