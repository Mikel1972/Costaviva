-- Costa Viva — precipitación/presión real de estaciones de monte para los
-- 6 ríos vascos sin caudal (2026-09-18)
--
-- URA/Diputación de Bizkaia bloquean el acceso automático a su catálogo de
-- caudal (ver comentario en functions/prevision.js sobre RIOS), así que
-- Lea, Oka, Estepona (Zarraga), Butroe, Arroyo Sopelana y Nervión se
-- quedan con "caudal: null" en los 3 puntos de cada uno. Como
-- complemento (no como sustituto — no es caudal, es lluvia/presión real
-- cerca de esa zona), se añade aquí precipitación real de la estación de
-- Euskalmet más cercana a la CABECERA y al tramo MEDIO de cada río (nunca
-- a la desembocadura — ese punto ya tiene datos reales de Open-Meteo vía
-- su spotCosta asociado).
--
-- Solo 12 filas en total (una por rio+punto), sobrescritas una vez al día
-- por functions/actualizar-euskalmet-rios.js — no hace falta más
-- frecuencia (decisión explícita del usuario). Mismo patrón de RLS que
-- camara_estado/turbidez_historico: lectura pública, solo escribe el
-- endpoint protegido con el secreto compartido, usando la anon key.
create table if not exists public.euskalmet_rios (
  rio text not null,
  punto text not null,
  estacion_precip_id text,
  estacion_precip_nombre text,
  precipitacion_mm real,
  estacion_presion_id text,
  estacion_presion_nombre text,
  presion_hpa real,
  actualizado_en timestamptz not null default now(),
  primary key (rio, punto)
);

alter table public.euskalmet_rios enable row level security;

create policy "lectura pública de precipitación/presión de ríos vascos"
  on public.euskalmet_rios for select
  using (true);

create policy "solo la anon key inserta (protegido por secreto en la función)"
  on public.euskalmet_rios for insert
  to anon
  with check (true);

create policy "solo la anon key actualiza (protegido por secreto en la función)"
  on public.euskalmet_rios for update
  to anon
  using (true)
  with check (true);
