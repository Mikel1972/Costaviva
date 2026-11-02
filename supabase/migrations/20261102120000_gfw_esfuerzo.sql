-- Costaviva — Actividad pesquera comercial de Global Fishing Watch
-- (2026-11-02). GFW (Leah Buckley, 02-11) no pide licencia comercial
-- mientras esta capa vaya en la parte GRATIS de la app.
--
-- SIN APLICAR: se aplica con aplicar-migraciones.yml desde main cuando
-- Mikel lo apruebe (etiqueta sql-aprobado en la PR).
--
-- Qué hace, en llano: tabla nueva gfw_esfuerzo con las horas de pesca
-- APARENTE (inferida del AIS por GFW) de los 7 días que acaban hace 4, por
-- celda de 0,1° y región (iberia, nz). La escribe una vez al día
-- scripts/gfw/esfuerzo-gfw.mjs (esfuerzo-gfw.yml). Solo celdas y horas:
-- ni barcos, ni MMSI, ni banderas, ni rutas (el robot los tira).
--
-- Estándares (comun estandares/supabase.md): RLS (D5); una sola policy, de
-- LECTURA (anon-ok, abajo): es la capa gratis del mapa; ninguna de
-- escritura: solo escribe service_role (D7). Sin funciones nuevas.
-- supabase/baseline-seguridad.json lleva gfw_esfuerzo en la misma PR.

create table if not exists public.gfw_esfuerzo (
  region text not null check (region in ('iberia', 'nz')),
  celda_lat numeric(5,1) not null,
  celda_lon numeric(5,1) not null,
  horas numeric(10,1) not null check (horas > 0),
  desde date not null,
  hasta date not null,
  calculado timestamptz not null,
  primary key (region, celda_lat, celda_lon)
);
alter table public.gfw_esfuerzo enable row level security;
revoke all on public.gfw_esfuerzo from anon, authenticated;
grant select on public.gfw_esfuerzo to anon, authenticated;

drop policy if exists "lectura pública del esfuerzo pesquero de GFW" on public.gfw_esfuerzo;
-- anon-ok: solo LECTURA de horas agregadas por celda de ~10 km (datos
-- públicos de Global Fishing Watch, capa gratis); ningún barco ni ruta.
create policy "lectura pública del esfuerzo pesquero de GFW"
  on public.gfw_esfuerzo for select to anon, authenticated
  using (true);
comment on policy "lectura pública del esfuerzo pesquero de GFW" on public.gfw_esfuerzo is 'anon-ok: solo lectura de horas de pesca aparente agregadas por celda de 0,1° (GFW, capa gratis), sin barcos ni rutas';
comment on table public.gfw_esfuerzo is 'Esfuerzo pesquero aparente de Global Fishing Watch (4Wings), 7 días que acaban hace 4, por celda de 0,1°. Capa GRATIS (condición de GFW). La escribe scripts/gfw/esfuerzo-gfw.mjs. 2026-11-02.';
