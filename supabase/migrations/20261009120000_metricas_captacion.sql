-- Costaviva — Captación (3/4): números semanales de captación, sin IA
-- (2026-10-09).
--
-- SIN APLICAR: se aplica con aplicar-migraciones.yml desde main cuando
-- Mikel lo apruebe. Necesita antes 20261009100000 y 20261009110000.
--
-- Qué hace, en llano: una función que cuenta, por semana (lunes a domingo,
-- hora de España), las visitas a las páginas públicas por fuente, las
-- altas (y por dónde llegaron), las invitaciones canjeadas, los amigos
-- invitados, cuántas pruebas acaban en pago y cuántos siguen usando la app
-- en su semana 2 y su semana 4. Solo devuelve recuentos, nunca quién.
--
-- Métrica principal (estrella del norte): % de pruebas terminadas que pasan
-- a pago. Una "prueba" es un alta con el email confirmado, sin contar al
-- admin, las cuentas de pruebas automáticas (etxebe2005+...), los accesos
-- permanentes ni quien entró con una invitación del 100 %. "Paga" =
-- suscripciones.primer_pago_en relleno (primer cobro real tras la prueba).
-- "Terminada" = han pasado 8 días desde el alta (7 de prueba + 1 de margen
-- para que Stripe cobre y avise).
--
-- Dos puertas, mismo cálculo:
--   - metricas_captacion(semanas): solo service_role (informe diario de los
--     lunes, daily-report.yml).
--   - admin_metricas_captacion(semanas): para admin.html, exige es_admin().
-- Estándares: search_path fijo (D9) y EXECUTE mínimo (D10).

create or replace function public.metricas_captacion(p_semanas int default 8)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_semanas int := least(greatest(coalesce(p_semanas, 8), 1), 52);
  v_hoy date := (now() at time zone 'Europe/Madrid')::date;
  v_lunes date := date_trunc('week', v_hoy)::date;
  v_desde date := v_lunes - (v_semanas - 1) * 7;
  v_resultado jsonb;
begin
  with
  semanas as (
    select generate_series(v_desde, v_lunes, interval '7 days')::date as semana
  ),
  pruebas as (
    -- Altas que cuentan como prueba de verdad.
    select p.id as user_id, p.creado_en,
           date_trunc('week', (p.creado_en at time zone 'Europe/Madrid'))::date as semana,
           (u.email_confirmed_at is not null) as confirmada,
           o.fuente,
           s.primer_pago_en
    from public.perfiles p
    join auth.users u on u.id = p.id
    left join public.origen_altas o on o.user_id = p.id
    left join public.suscripciones s on s.user_id = p.id
    where p.creado_en >= (v_desde::timestamp at time zone 'Europe/Madrid')
      and not exists (select 1 from public.administradores a where a.user_id = p.id)
      and lower(u.email) not like 'etxebe2005+%'
      and not public.tiene_acceso_permanente(u.email)
      and not exists (select 1 from public.invitaciones i where i.user_id = p.id and i.descuento = 100)
  ),
  visitas as (
    select date_trunc('week', v.dia)::date as semana, v.fuente, sum(v.visitas)::bigint as n
    from public.visitas_publicas v
    where v.dia >= v_desde
    group by 1, 2
  ),
  actividad as (
    -- Activo en la semana 2 (días 7-13) y en la semana 4 (días 21-27).
    select t.user_id,
      exists (select 1 from public.eventos_uso e where e.user_id = t.user_id
              and e.creado_en >= t.creado_en + interval '7 days' and e.creado_en < t.creado_en + interval '14 days') as activo_s2,
      exists (select 1 from public.eventos_uso e where e.user_id = t.user_id
              and e.creado_en >= t.creado_en + interval '21 days' and e.creado_en < t.creado_en + interval '28 days') as activo_s4
    from pruebas t where t.confirmada
  ),
  por_semana as (
    select s.semana,
      coalesce((select sum(n) from visitas v where v.semana = s.semana), 0) as visitas,
      coalesce((select jsonb_object_agg(v.fuente, v.n) from visitas v where v.semana = s.semana), '{}'::jsonb) as visitas_por_fuente,
      (select count(*) from pruebas t where t.semana = s.semana) as altas,
      (select count(*) from pruebas t where t.semana = s.semana and t.confirmada) as altas_confirmadas,
      coalesce((select jsonb_object_agg(f, n) from (
         select coalesce(t.fuente, 'desconocido') as f, count(*) as n
         from pruebas t where t.semana = s.semana and t.confirmada group by 1) x), '{}'::jsonb) as altas_por_fuente,
      (select count(*) from public.invitaciones i
        where date_trunc('week', (i.inscrito_en at time zone 'Europe/Madrid'))::date = s.semana) as invitaciones_canjeadas,
      (select count(*) from public.referidos r
        where date_trunc('week', (r.creado_en at time zone 'Europe/Madrid'))::date = s.semana and r.estado <> 'rechazado') as amigos_apuntados,
      (select count(*) from public.referidos r
        where date_trunc('week', (r.pagado_en at time zone 'Europe/Madrid'))::date = s.semana and r.estado in ('pagado', 'recompensado')) as amigos_que_pagan,
      (select count(*) from pruebas t where t.semana = s.semana and t.confirmada
         and t.creado_en + interval '8 days' <= now()) as pruebas_terminadas,
      (select count(*) from pruebas t where t.semana = s.semana and t.confirmada
         and t.creado_en + interval '8 days' <= now() and t.primer_pago_en is not null) as pagan,
      (select count(*) from pruebas t where t.semana = s.semana and t.confirmada
         and t.creado_en + interval '14 days' <= now()) as base_s2,
      (select count(*) from pruebas t join actividad a using (user_id) where t.semana = s.semana
         and t.creado_en + interval '14 days' <= now() and a.activo_s2) as activos_s2,
      (select count(*) from pruebas t where t.semana = s.semana and t.confirmada
         and t.creado_en + interval '28 days' <= now()) as base_s4,
      (select count(*) from pruebas t join actividad a using (user_id) where t.semana = s.semana
         and t.creado_en + interval '28 days' <= now() and a.activo_s4) as activos_s4
    from semanas s
  )
  select jsonb_build_object(
    'generado_en', now(),
    'semanas', coalesce((select jsonb_agg(to_jsonb(p) order by p.semana desc) from por_semana p), '[]'::jsonb),
    'norte', (select jsonb_build_object(
        'pruebas_terminadas', coalesce(sum(pruebas_terminadas), 0),
        'pagan', coalesce(sum(pagan), 0),
        'pct', case when coalesce(sum(pruebas_terminadas), 0) = 0 then null
                    else round(100.0 * sum(pagan) / sum(pruebas_terminadas), 1) end)
      from por_semana)
  ) into v_resultado;
  return v_resultado;
end;
$$;
revoke all on function public.metricas_captacion(int) from public, anon, authenticated;
grant execute on function public.metricas_captacion(int) to service_role;

create or replace function public.admin_metricas_captacion(p_semanas int default 8)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
begin
  if not public.es_admin() then
    raise exception 'No autorizado';
  end if;
  return public.metricas_captacion(p_semanas);
end;
$$;
revoke all on function public.admin_metricas_captacion(int) from public, anon;
grant execute on function public.admin_metricas_captacion(int) to authenticated;
