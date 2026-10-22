-- Costaviva — Flota pesquera faenando: histórico DIARIO de las zonas para el
-- ▶️ de los últimos 14 días (2026-10-23, pedido de Mikel: "un play de los
-- últimos 14 días, día a día").
--
-- SIN APLICAR: se aplica con aplicar-migraciones.yml desde main cuando
-- Mikel lo apruebe (etiqueta sql-aprobado en la PR).
--
-- Qué hace, en llano: tabla nueva flota_zonas_dia, igual que flota_zonas
-- pero por DÍA en vez de "últimas 24 h / ayer". Cada fila: un día, una celda
-- de 0,05° (~5 km), una clase de eslora (o "todas") y cuántos barcos
-- DISTINTOS faenaron allí ese día. Cada fotograma del ▶️ es un día suelto,
-- no un acumulado.
--   - Día = día de calendario de Madrid (Europe/Madrid): el día de la gente
--     que pesca en España y Portugal; el de UTC partiría la noche del cerco
--     a la 01:00/02:00 hora local.
--   - La rellena el robot (scripts/flota/flota-ais.mjs) tras cada escucha:
--     recalcula hoy y ayer (días de Madrid) y borra lo de más de 60 días.
--   - Privacidad, igual que flota_zonas: solo celdas con 3 barcos o más
--     (también el CHECK), y una fila por eslora solo si "todas" menos esa
--     eslora (y menos todas las publicadas) es 0 o >= 3. Ni barcos, ni
--     rutas, ni horas.
--   - calculado: cuándo se calculó la fila (para borrar las que dejan de
--     cumplir el umbral al recalcular el día).
--
-- Estándares (comun estandares/supabase.md): RLS (D5); una sola policy, de
-- LECTURA (anon-ok, abajo), ninguna de escritura: solo escribe service_role
-- (D7). Sin funciones nuevas. supabase/baseline-seguridad.json lleva
-- flota_zonas_dia en la misma PR.

create table if not exists public.flota_zonas_dia (
  dia date not null,
  celda_lat numeric(6,2) not null,
  celda_lon numeric(6,2) not null,
  clase text not null check (clase in ('todas', '<24', '24-40', '>40')),
  n_barcos integer not null check (n_barcos >= 3),
  especie_probable text,
  calculado timestamptz not null default now(),
  primary key (dia, celda_lat, celda_lon, clase)
);
alter table public.flota_zonas_dia enable row level security;
revoke all on public.flota_zonas_dia from anon, authenticated;
grant select on public.flota_zonas_dia to anon, authenticated;

drop policy if exists "lectura pública del histórico de zonas de flota" on public.flota_zonas_dia;
-- anon-ok: solo LECTURA de recuentos ya agregados por día (celdas de ~5 km
-- con 3 barcos distintos o más); ningún barco, ruta ni hora. Plan gratis.
create policy "lectura pública del histórico de zonas de flota"
  on public.flota_zonas_dia for select to anon, authenticated
  using (true);
comment on policy "lectura pública del histórico de zonas de flota" on public.flota_zonas_dia is 'anon-ok: solo lectura de recuentos agregados por día (>= 3 barcos por celda), sin barcos, rutas ni horas';
-- Sin policies de escritura: solo service_role (el robot).
comment on table public.flota_zonas_dia is 'Histórico diario (día de Madrid) de las zonas de la flota pesquera (AIS): barcos distintos faenando por celda de 0,05° y clase de eslora. Solo celdas con >= 3 barcos. 60 días. La escribe scripts/flota/flota-ais.mjs. 2026-10-23.';
