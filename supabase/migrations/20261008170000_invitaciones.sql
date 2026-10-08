-- Costa Viva — invitaciones con descuento (panel de admin, 2026-10-08)
--
-- Aprobado por Mikel el 2026-10-08. SIN APLICAR: se aplica con
-- aplicar-migraciones.yml desde main cuando Mikel lo apruebe. En el MISMO
-- cambio va supabase/baseline-seguridad.json con la tabla nueva (RLS activado,
-- sin policies), para que el vigía de esquema no se ponga en rojo.
--
-- Qué hace:
--   * public.invitaciones: una fila por invitación enviada desde admin.html.
--     Código único de un solo uso, ligado a un email. Descuento 0-100 %,
--     duración (1/3/6/12 meses, para siempre o hasta una fecha), caducidad y
--     nota interna. El estado (enviada / inscrito / caducada / terminada /
--     anulada) NO se guarda: se deduce de las fechas (estadoInvitacion() en
--     functions/_lib/invitaciones.js), así no puede quedar desfasado.
--   * Sin policies (comun supabase.md D6): la tabla es solo de backend. La
--     escriben y la leen functions/admin-invitaciones.js (admin, comprobado
--     con es_admin() antes de usar service_role), functions/canjear-invitacion.js
--     (el propio invitado, con su sesión) y stripe-webhook.js; el cliente
--     nunca la toca directamente.
--   * 100 %: sin tarjeta. Al canjear el código se fija acceso_hasta (null =
--     para siempre) y mi_estado_suscripcion() da acceso hasta esa fecha.
--     7 días antes, avisar-fin-prueba.js manda un email invitando a
--     suscribirse (invitaciones_pendiente_aviso_fin()).
--   * < 100 %: el descuento es un cupón de Stripe (un uso, caduca con la
--     invitación) que crear-checkout-stripe.js aplica solo si
--     mi_invitacion_descuento() lo devuelve para el usuario que paga.
--   * Quien haya canjeado una invitación del 100 % queda fuera del ciclo de
--     fin de prueba (fin_prueba_fuera_de_ciclo), igual que un ex-suscriptor:
--     cuando termina su acceso, recibe el aviso de la invitación, no el de
--     "tu prueba termina".
--
-- Funciones: search_path = public, extensions (D9) y EXECUTE mínimo (D10).

create table if not exists public.invitaciones (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique check (codigo ~ '^[A-HJ-NP-Z2-9]{12}$'),
  email text not null check (email = lower(email) and position('@' in email) > 1),
  descuento smallint not null check (descuento between 0 and 100),
  duracion_tipo text not null check (duracion_tipo in ('meses', 'siempre', 'hasta_fecha')),
  duracion_meses smallint check (duracion_meses in (1, 3, 6, 12)),
  duracion_hasta date,
  caduca_en timestamptz not null,
  nota text check (char_length(nota) <= 500),
  creada_por uuid references auth.users (id) on delete set null,
  creada_en timestamptz not null default now(),
  -- Solo tras confirmar Resend el envío (comun emails.md E8).
  email_enviado_en timestamptz,
  stripe_coupon_id text,
  -- Canje: quién y cuándo. Un solo uso: se rellena con un UPDATE condicionado
  -- a user_id is null.
  user_id uuid references auth.users (id) on delete set null,
  inscrito_en timestamptz,
  -- 100 %: fin del acceso sin suscripción (null = para siempre).
  acceso_hasta timestamptz,
  -- < 100 %: checkout completado con el cupón, y fin aproximado del descuento.
  descuento_aplicado_en timestamptz,
  descuento_hasta timestamptz,
  aviso_fin_enviado_en timestamptz,
  anulada_en timestamptz,
  check (
    (duracion_tipo = 'meses' and duracion_meses is not null and duracion_hasta is null)
    or (duracion_tipo = 'siempre' and duracion_meses is null and duracion_hasta is null)
    or (duracion_tipo = 'hasta_fecha' and duracion_meses is null and duracion_hasta is not null)
  )
);
create index if not exists invitaciones_email_idx on public.invitaciones (email);
create index if not exists invitaciones_user_id_idx on public.invitaciones (user_id);
alter table public.invitaciones enable row level security;
-- Sin policies a propósito: solo service_role y las funciones definer.
revoke all on public.invitaciones from anon, authenticated;
comment on table public.invitaciones is 'Invitaciones con descuento desde admin.html (2026-10-08). Sin policies: solo service_role y funciones definer.';

-- Invitación del 100 % en vigor para un usuario (la usan las dos funciones
-- de abajo). Sin EXECUTE para nadie salvo service_role: las definer que la
-- llaman se ejecutan como su dueño.
create or replace function public.invitacion_gratis_vigente(p_user_id uuid)
returns timestamptz
language sql
security definer
set search_path = public, extensions
stable
as $$
  -- Devuelve el fin del acceso ('infinity' si es para siempre) o null.
  select max(coalesce(i.acceso_hasta, 'infinity'::timestamptz))
  from public.invitaciones i
  where i.user_id = p_user_id
    and i.descuento = 100
    and i.inscrito_en is not null
    and i.anulada_en is null
    and (i.acceso_hasta is null or i.acceso_hasta > now());
$$;
revoke all on function public.invitacion_gratis_vigente(uuid) from public, anon, authenticated;
grant execute on function public.invitacion_gratis_vigente(uuid) to service_role;

-- Igual que la versión de 20261001100000_accesos_permanentes.sql, con dos
-- cambios: tras el acceso permanente, una invitación del 100 % en vigor da
-- estado 'invitacion' y con_acceso=true (acceso_hasta = su fin, null si es
-- para siempre); y search_path con extensions (D9).
create or replace function public.mi_estado_suscripcion()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
stable
as $$
declare
  v_creado_en timestamptz;
  v_prueba_termina_en timestamptz;
  v_sub record;
  v_con_acceso boolean;
  v_invitacion timestamptz;
begin
  if public.es_admin() then
    return jsonb_build_object(
      'estado', 'admin',
      'con_acceso', true,
      'prueba_termina_en', null,
      'periodo_actual_fin', null,
      'periodo', null
    );
  end if;

  if public.tiene_acceso_permanente(auth.email()) then
    return jsonb_build_object(
      'estado', 'permanente',
      'con_acceso', true,
      'prueba_termina_en', null,
      'periodo_actual_fin', null,
      'periodo', null
    );
  end if;

  v_invitacion := public.invitacion_gratis_vigente(auth.uid());
  if v_invitacion is not null then
    return jsonb_build_object(
      'estado', 'invitacion',
      'con_acceso', true,
      'acceso_hasta', case when v_invitacion = 'infinity'::timestamptz then null else v_invitacion end,
      'prueba_termina_en', null,
      'periodo_actual_fin', null,
      'periodo', null
    );
  end if;

  select creado_en into v_creado_en from public.perfiles where id = auth.uid();
  if v_creado_en is null then
    return jsonb_build_object(
      'estado', 'sin_perfil',
      'con_acceso', false,
      'prueba_termina_en', null,
      'periodo_actual_fin', null,
      'periodo', null
    );
  end if;
  v_prueba_termina_en := v_creado_en + interval '7 days';

  select estado, periodo, periodo_actual_fin
    into v_sub
    from public.suscripciones
    where user_id = auth.uid();

  if now() < v_prueba_termina_en then
    v_con_acceso := true;
  elsif v_sub.estado in ('trialing', 'active') then
    v_con_acceso := true;
  else
    v_con_acceso := false;
  end if;

  return jsonb_build_object(
    'estado', coalesce(v_sub.estado, 'sin_suscripcion'),
    'con_acceso', v_con_acceso,
    'prueba_termina_en', v_prueba_termina_en,
    'periodo_actual_fin', v_sub.periodo_actual_fin,
    'periodo', v_sub.periodo
  );
end;
$$;
revoke execute on function public.mi_estado_suscripcion() from public, anon;
grant execute on function public.mi_estado_suscripcion() to authenticated;

-- Igual que la versión de 20261001100000_accesos_permanentes.sql, más quien
-- haya canjeado alguna vez una invitación del 100 % (aunque ya haya
-- terminado): su aviso es el de la invitación, no el de la prueba.
create or replace function public.fin_prueba_fuera_de_ciclo(p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public, extensions
stable
as $$
  select
    exists (
      select 1 from auth.users u
      where u.id = p_user_id
        and (
          u.email = 'etxebe2005@gmail.com'
          or u.email like 'etxebe2005+%'
          or public.tiene_acceso_permanente(u.email)
        )
    )
    or exists (
      select 1 from public.suscripciones s
      where s.user_id = p_user_id
        and coalesce(s.estado, '') not in ('', 'incomplete', 'incomplete_expired')
    )
    or exists (
      select 1 from public.invitaciones i
      where i.user_id = p_user_id and i.descuento = 100 and i.inscrito_en is not null
    );
$$;
revoke all on function public.fin_prueba_fuera_de_ciclo(uuid) from public, authenticated, anon;
grant execute on function public.fin_prueba_fuera_de_ciclo(uuid) to service_role;

-- Descuento (< 100 %) que le toca al usuario que llama, si lo hay: lo usa
-- crear-checkout-stripe.js con el token del propio usuario (nunca acepta un
-- cupón del cliente) y suscripcion.html para enseñarlo. Solo invitaciones
-- canjeadas por él, sin anular, sin caducar y aún no aplicadas.
create or replace function public.mi_invitacion_descuento()
returns jsonb
language sql
security definer
set search_path = public, extensions
stable
as $$
  select jsonb_build_object(
    'id', i.id,
    'descuento', i.descuento,
    'duracion_tipo', i.duracion_tipo,
    'duracion_meses', i.duracion_meses,
    'duracion_hasta', i.duracion_hasta,
    'caduca_en', i.caduca_en,
    'stripe_coupon_id', i.stripe_coupon_id
  )
  from public.invitaciones i
  where i.user_id = auth.uid()
    and i.descuento between 1 and 99
    and i.stripe_coupon_id is not null
    and i.anulada_en is null
    and i.descuento_aplicado_en is null
    and i.caduca_en > now()
  order by i.inscrito_en desc
  limit 1;
$$;
revoke execute on function public.mi_invitacion_descuento() from public, anon;
grant execute on function public.mi_invitacion_descuento() to authenticated;

-- Aviso de fin del acceso gratis (100 %): 7 días antes, una vez. Si el cron
-- llega tarde, hasta 3 días después del fin; más tarde ya no se manda. No a
-- quien ya se ha suscrito.
create or replace function public.invitaciones_pendiente_aviso_fin()
returns table (id uuid, email text, acceso_hasta timestamptz)
language sql
security definer
set search_path = public, extensions
stable
as $$
  select i.id, u.email::text, i.acceso_hasta
  from public.invitaciones i
  join auth.users u on u.id = i.user_id
  where i.descuento = 100
    and i.inscrito_en is not null
    and i.anulada_en is null
    and i.acceso_hasta is not null
    and i.aviso_fin_enviado_en is null
    and i.acceso_hasta <= now() + interval '7 days'
    and i.acceso_hasta > now() - interval '3 days'
    and not exists (
      select 1 from public.suscripciones s
      where s.user_id = i.user_id and s.estado in ('trialing', 'active')
    )
  order by i.acceso_hasta;
$$;
revoke all on function public.invitaciones_pendiente_aviso_fin() from public, anon, authenticated;
grant execute on function public.invitaciones_pendiente_aviso_fin() to service_role;

create or replace function public.marcar_invitacion_aviso_fin(p_id uuid)
returns void
language sql
security definer
set search_path = public, extensions
as $$
  update public.invitaciones
  set aviso_fin_enviado_en = now()
  where id = p_id and aviso_fin_enviado_en is null;
$$;
revoke all on function public.marcar_invitacion_aviso_fin(uuid) from public, anon, authenticated;
grant execute on function public.marcar_invitacion_aviso_fin(uuid) to service_role;

-- Comprobación final (trampa 10): la tabla nace con RLS y sin policies.
do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.invitaciones'::regclass) then
    raise exception 'invitaciones sin RLS';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'invitaciones') then
    raise exception 'invitaciones no debe tener policies';
  end if;
end;
$$;
