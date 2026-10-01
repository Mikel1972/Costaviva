-- Acceso permanente sin suscripción para cuentas concretas (2026-10-01,
-- pedido del usuario: "maetxe2018@gmail.com dale permiso permanente").
--
-- Hasta ahora el único acceso permanente era el del admin, escrito a mano
-- en es_admin(). Esto lo generaliza sin darle a nadie poderes de admin: una
-- lista de emails que tienen acceso completo para siempre y quedan fuera
-- del ciclo de fin de prueba (ni recordatorio ni desactivación).
--
-- Por email, no por user_id, para que funcione también si la persona aún no
-- se ha dado de alta. Para añadir o quitar a alguien: una migración nueva
-- con insert/delete en esta tabla. Sin políticas RLS a propósito: solo la
-- leen las funciones security definer de abajo, nunca el cliente.

create table if not exists public.accesos_permanentes (
  email text primary key check (email = lower(email)),
  motivo text not null,
  creado_en timestamptz not null default now()
);
alter table public.accesos_permanentes enable row level security;

insert into public.accesos_permanentes (email, motivo)
values ('maetxe2018@gmail.com', 'Acceso permanente concedido por el administrador (2026-10-01)')
on conflict (email) do nothing;

create or replace function public.tiene_acceso_permanente(p_email text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.accesos_permanentes where email = lower(p_email));
$$;
revoke all on function public.tiene_acceso_permanente(text) from public, anon, authenticated;
grant execute on function public.tiene_acceso_permanente(text) to service_role;

-- Igual que la versión de 20260915160000_suscripciones_stripe.sql, con un
-- único cambio: tras el admin, las cuentas de accesos_permanentes devuelven
-- estado 'permanente' y con_acceso=true.
create or replace function public.mi_estado_suscripcion()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_creado_en timestamptz;
  v_prueba_termina_en timestamptz;
  v_sub record;
  v_con_acceso boolean;
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

  select creado_en into v_creado_en from public.perfiles where id = auth.uid();
  if v_creado_en is null then
    -- Sin perfil (no deberia pasar, pero por si acaso): sin acceso.
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

  -- En prueba: acceso si todavia no ha pasado prueba_termina_en,
  -- independientemente de si hay fila en suscripciones o no (Checkout
  -- crea la fila real solo al completar el pago/alta de suscripcion).
  if now() < v_prueba_termina_en then
    v_con_acceso := true;
  -- Pasada la prueba: acceso solo si hay suscripcion con estado
  -- "activo" en el sentido de Stripe (trialing tambien cuenta: Stripe
  -- puede llevar su propio trial en paralelo, ver crear-checkout-stripe.js).
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
grant execute on function public.mi_estado_suscripcion() to authenticated;

-- Igual que la versión de 20260928120000_fin_prueba_bienvenida_recordatorio.sql,
-- más las cuentas con acceso permanente: ni recordatorio ni desactivación.
create or replace function public.fin_prueba_fuera_de_ciclo(p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
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
    );
$$;
revoke all on function public.fin_prueba_fuera_de_ciclo(uuid) from public, authenticated, anon;
grant execute on function public.fin_prueba_fuera_de_ciclo(uuid) to service_role;

-- Si la cuenta ya existía y había quedado desactivada por fin de prueba,
-- se borra esa marca (el acceso ya lo da mi_estado_suscripcion()).
update public.perfiles p
set desactivado_en = null
from auth.users u
where u.id = p.id
  and public.tiene_acceso_permanente(u.email)
  and p.desactivado_en is not null;

do $$
declare
  v_existe boolean;
begin
  select exists (
    select 1 from auth.users u
    join public.accesos_permanentes a on a.email = lower(u.email)
  ) into v_existe;
  raise notice 'Accesos permanentes: % email(s); alguno ya tiene cuenta: %',
    (select count(*) from public.accesos_permanentes), v_existe;
end;
$$;
