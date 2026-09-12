-- Costa Viva — hora exacta (HH:MM) en vez de franja fija
--
-- franja_horaria (6 franjas fijas: amanecer/mañana/...) se sustituye por
-- una hora exacta con minutos, tanto para la salida completa (para qué
-- hora se calcula marea/oleaje/viento/luna) como por captura (a qué hora
-- se pescó cada pez en concreto). No hay datos reales todavía usando
-- franja_horaria (solo pruebas ya limpiadas), así que se elimina en vez
-- de dejarla huérfana.
alter table public.salidas_pesca
  drop column if exists franja_horaria,
  add column if not exists hora time;

alter table public.capturas
  add column if not exists hora time;
