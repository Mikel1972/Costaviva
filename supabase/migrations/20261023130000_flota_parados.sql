-- Costaviva — Flota pesquera PARADA: en puerto y en el mar (2026-10-23,
-- pedido de Mikel: "flota parada en rojo, nunca barcos sueltos").
--
-- SIN APLICAR: se aplica con aplicar-migraciones.yml desde main cuando
-- Mikel lo apruebe (etiqueta sql-aprobado en la PR).
--
-- Qué hace, en llano: tabla nueva flota_parados con la FOTO de la última
-- escucha del robot (scripts/flota/flota-ais.mjs), no de 24 h:
--   - tipo 'puerto': pesqueros parados (velocidad mediana < 0,5 nudos) a
--     menos de 2 km de un puerto conocido (scripts/flota/puertos.json y las
--     lonxas de Galicia); lat/lon = las del PUERTO (aproximadas, ~1 km).
--   - tipo 'mar': parados lejos de puerto, por celda de 0,05° (~5 km);
--     lat/lon = esquina sur-oeste de la celda.
--   - n_barcos: barcos DISTINTOS; solo filas con 3 o más (también el
--     CHECK). Sin desglose por eslora: así no hay restas que delaten a un
--     barco suelto.
--   - escucha: cuándo terminó la escucha ("Última escucha: HH:MM"). Cada
--     escucha escribe lo suyo y borra lo anterior.
-- Ni barcos, ni MMSI, ni rutas, ni posiciones de barcos.
--
-- Estándares (comun estandares/supabase.md): RLS (D5); una sola policy, de
-- LECTURA (anon-ok, abajo), ninguna de escritura: solo escribe service_role
-- (D7). Sin funciones nuevas. supabase/baseline-seguridad.json lleva
-- flota_parados en la misma PR.

create table if not exists public.flota_parados (
  clave text primary key check (clave ~ '^(puerto:[a-z0-9-]+|mar:-?[0-9]+\.[0-9]{2},-?[0-9]+\.[0-9]{2})$'),
  tipo text not null check (tipo in ('puerto', 'mar')),
  puerto text,
  lat numeric(7,4) not null,
  lon numeric(7,4) not null,
  n_barcos integer not null check (n_barcos >= 3),
  escucha timestamptz not null,
  check ((tipo = 'puerto') = (puerto is not null))
);
alter table public.flota_parados enable row level security;
revoke all on public.flota_parados from anon, authenticated;
grant select on public.flota_parados to anon, authenticated;

drop policy if exists "lectura pública de la flota parada" on public.flota_parados;
-- anon-ok: solo LECTURA de recuentos ya agregados por puerto o celda de
-- ~5 km (3 barcos distintos o más); ningún barco, ruta ni posición de barco.
create policy "lectura pública de la flota parada"
  on public.flota_parados for select to anon, authenticated
  using (true);
comment on policy "lectura pública de la flota parada" on public.flota_parados is 'anon-ok: solo lectura de recuentos agregados (>= 3 barcos por puerto o celda), sin barcos, rutas ni posiciones de barcos';
-- Sin policies de escritura: solo service_role (el robot).
comment on table public.flota_parados is 'Flota pesquera parada (AIS) en la última escucha: por puerto (< 2 km) o celda de 0,05° en el mar, barcos distintos, solo >= 3. La escribe scripts/flota/flota-ais.mjs. 2026-10-23.';
