-- Costa Viva — franja horaria y tipo de salida (costa/embarcación)
--
-- Permite personalizar el contexto ambiental de una salida de pesca:
-- - franja_horaria: para qué hora del día se calcula marea/oleaje/viento/
--   luna, en vez de siempre "ahora mismo" (momento de rellenar el
--   formulario). Valores esperados (controlados por el <select> del
--   cliente, no hace falta CHECK): amanecer/manana/mediodia/tarde/
--   atardecer/noche.
-- - tipo_salida: 'costa' o 'embarcacion'. Cuando es 'embarcacion', el
--   cliente usa la boya real más cercana (Puertos del Estado) en vez del
--   modelo de oleaje por coordenadas — boya_usada guarda su nombre, solo
--   informativo.
alter table public.salidas_pesca
  add column if not exists franja_horaria text,
  add column if not exists tipo_salida text,
  add column if not exists boya_usada text;
