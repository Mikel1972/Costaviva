-- Costa Viva — temperatura/viento real en euskalmet_rios (2026-09-18)
--
-- Pedido explícito del usuario: la mayoría de las estaciones de
-- precipitación ya elegidas para los 6 ríos vascos también tienen sensor
-- real de temperatura/humedad del aire (measuresForAir), y varias además
-- de viento (measuresForWind) — se añade aquí, sacado de la MISMA
-- estación de precipitación de cada punto (nunca de la de presión, más
-- lejana) porque el viento en superficie varía mucho más por el relieve
-- local que la presión — no sería representativo tomarlo de una estación
-- a 20-30 km.
alter table public.euskalmet_rios
  add column if not exists temperatura_c real,
  add column if not exists humedad_pct real,
  add column if not exists viento_vel_kmh real,
  add column if not exists viento_dir_grados real;
