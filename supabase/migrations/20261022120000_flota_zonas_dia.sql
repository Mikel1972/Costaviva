-- Costaviva — Flota pesquera faenando, fase 2: zonas calientes DEL DÍA en el
-- mapa (2026-10-22, diseño aprobado por Mikel: "cada pez tiene su momento:
-- anchoa 3 días, luego chicharro").
--
-- SIN APLICAR: se aplica con aplicar-migraciones.yml desde main cuando
-- Mikel lo apruebe (etiqueta sql-aprobado en la PR).
--
-- Qué hace, en llano:
--   1. flota_faena guarda también la HORA de la escucha (empezada la hora en
--      punto, UTC). Con una escucha cada 2 h, "las últimas 24 h" necesita
--      saber cuándo se vio, no solo el día. La clave pasa a ser (hora, celda,
--      barco): un barco cuenta una vez por celda y escucha. Las filas que ya
--      hay (pruebas de la fase 1) se quedan con la medianoche UTC de su día.
--      La tabla sigue CERRADA (sin policies, solo service_role).
--   2. Tabla nueva flota_zonas: lo ÚNICO que ve la app. La rellena el robot
--      (scripts/flota/flota-ais.mjs) al final de cada escucha: por periodo
--      ("24h" = últimas 24 h; "ayer" = las 24 h anteriores), celda de 0,05°
--      (~5 km) y clase de eslora (o "todas"), cuántos barcos DISTINTOS
--      faenaron. Solo celdas con 3 barcos o más: lo exige también el CHECK
--      (n_barcos >= 3), aunque el robot se equivocara. Ni barcos, ni rutas,
--      ni horas. especie_probable queda null hasta cruzar con las lonjas.
--   3. pg_cron lanza flota-ais.yml cada 2 h (a los 11 min de las horas
--      pares), porque GitHub no cumple los `schedule:` frecuentes (trampa 15
--      de comun). lanzar_workflow_github() admite 'flota-ais.yml' en su lista
--      cerrada; la lista incluye TODOS los anteriores (hasta
--      20261011200000_programador_publicar_veto.sql). Sigue sin poder lanzar
--      publicar-post-instagram.yml ni aplicar-migraciones.yml.
--
-- Por qué una tabla de agregados y no una vista o una función para anon
-- (comun estandares/supabase.md):
--   - una vista sobre flota_faena se ejecuta con los permisos de su dueño y
--     se salta la RLS (el aviso "security definer view" del Advisor);
--   - una función SECURITY DEFINER no puede tener EXECUTE para anon (D10);
--   - una vista o función SECURITY INVOKER obligaría a abrir flota_faena a
--     anon, y entonces se podría leer barco por barco.
--   Con flota_zonas, la clave anon solo puede leer lo ya agregado: la
--   tabla con los barcos no se abre nunca.
--
-- Estándares: RLS en las dos tablas (D5); flota_faena sin policies (solo
-- backend, D6); en flota_zonas una sola policy, de LECTURA (anon-ok, abajo),
-- y ninguna de escritura: solo escribe service_role (D7). La función sigue
-- con search_path vacío y sin EXECUTE para public, anon ni authenticated
-- (D9-D10). supabase/baseline-seguridad.json lleva flota_zonas en la misma PR.

-- 1. flota_faena: hora de la escucha ------------------------------------------
alter table public.flota_faena add column if not exists hora timestamptz;
update public.flota_faena set hora = (dia::timestamp at time zone 'UTC') where hora is null;
alter table public.flota_faena alter column hora set not null;
alter table public.flota_faena drop constraint if exists flota_faena_pkey;
alter table public.flota_faena add constraint flota_faena_pkey primary key (hora, celda_lat, celda_lon, barco);
create index if not exists flota_faena_dia_idx on public.flota_faena (dia);
comment on column public.flota_faena.hora is 'Hora en punto (UTC) en que empezó la escucha que vio faenar al barco. Para las últimas 24 h. 2026-10-22.';

-- 2. flota_zonas: lo agregado que ve la app ----------------------------------
create table if not exists public.flota_zonas (
  periodo text not null check (periodo in ('24h', 'ayer')),
  celda_lat numeric(6,2) not null,
  celda_lon numeric(6,2) not null,
  clase text not null check (clase in ('todas', '<24', '24-40', '>40')),
  n_barcos integer not null check (n_barcos >= 3),
  especie_probable text,
  calculado timestamptz not null,
  primary key (periodo, celda_lat, celda_lon, clase)
);
alter table public.flota_zonas enable row level security;
revoke all on public.flota_zonas from anon, authenticated;
grant select on public.flota_zonas to anon, authenticated;

drop policy if exists "lectura pública de las zonas de flota faenando" on public.flota_zonas;
-- anon-ok: solo LECTURA de recuentos ya agregados (celdas de ~5 km con 3
-- barcos distintos o más); ningún barco, ruta ni hora. Plan gratis.
create policy "lectura pública de las zonas de flota faenando"
  on public.flota_zonas for select to anon, authenticated
  using (true);
comment on policy "lectura pública de las zonas de flota faenando" on public.flota_zonas is 'anon-ok: solo lectura de recuentos agregados (>= 3 barcos por celda), sin barcos, rutas ni horas';
-- Sin policies de escritura: solo service_role (el robot).
comment on table public.flota_zonas is 'Zonas calientes de la flota pesquera (AIS): barcos distintos faenando por celda de 0,05°, periodo (24h/ayer) y clase de eslora. Solo celdas con >= 3 barcos. La escribe scripts/flota/flota-ais.mjs. 2026-10-22.';

-- 3. pg_cron lanza flota-ais.yml cada 2 h ------------------------------------
create or replace function public.lanzar_workflow_github(workflow text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  token text;
  peticion bigint;
begin
  if workflow not in ('camaras-salud.yml', 'notificar-altas.yml', 'espuma-camaras.yml',
                      'robot-marketing-instagram.yml', 'robot-reel-instagram.yml',
                      'aprendizaje-semanal.yml', 'publicar-con-veto.yml', 'flota-ais.yml') then
    raise exception 'Workflow no permitido: %', workflow;
  end if;

  select decrypted_secret into token
  from vault.decrypted_secrets
  where name = 'github_lanzar_workflows'
  limit 1;

  if token is null then
    raise notice 'Falta la clave github_lanzar_workflows en Vault: no se lanza %', workflow;
    return null;
  end if;

  select net.http_post(
    url := format('https://api.github.com/repos/Mikel1972/Costaviva/actions/workflows/%s/dispatches', workflow),
    body := jsonb_build_object('ref', 'main'),
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || token,
      'Accept', 'application/vnd.github+json',
      'X-GitHub-Api-Version', '2022-11-28',
      'User-Agent', 'costaviva-pg-cron',
      'Content-Type', 'application/json'
    )
  ) into peticion;

  return peticion;
end;
$$;

revoke all on function public.lanzar_workflow_github(text) from public, anon, authenticated;
grant execute on function public.lanzar_workflow_github(text) to service_role;

select cron.schedule('lanzar-flota-ais', '11 */2 * * *', $$select public.lanzar_workflow_github('flota-ais.yml')$$);
