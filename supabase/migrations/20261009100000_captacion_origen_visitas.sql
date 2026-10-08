-- Costaviva — Captación (1/4): de dónde llega cada alta y visitas a las
-- páginas públicas, sin datos personales (2026-10-09, fase de captación
-- decidida por Mikel).
--
-- SIN APLICAR: se aplica con aplicar-migraciones.yml desde main cuando
-- Mikel lo apruebe.
--
-- Qué hace, en llano:
--   1. Tabla origen_altas: para cada cuenta nueva, por dónde llegó la
--      primera vez (instagram, facebook, google, un amigo...), el medio y el
--      nombre de la campaña. Solo valores de listas cerradas: ni emails, ni
--      URLs, ni IPs. Se rellena sola al crearse el perfil, leyendo el
--      metadato "origen" que manda login.html. Si algo falla, el alta sigue
--      adelante igual (el trigger nunca rompe un alta).
--   2. Tabla visitas_publicas: un recuento por día, tipo de página
--      (empieza, mareas, spots, especies, login), fuente y campaña. Solo
--      números. La suma functions/_middleware.js en segundo plano.
--   3. suscripciones.primer_pago_en: cuándo pasó a "active" por primera vez
--      (= primer cobro de verdad tras la prueba). Es lo que mide la
--      conversión de prueba a pago. Lo rellena stripe-webhook.js.
--
-- Estándares (comun estandares/supabase.md):
--   D5/D6: RLS en las dos tablas, sin policies (solo funciones definer y
--          service_role).
--   D9:    funciones definer con search_path fijo.
--   D10:   EXECUTE revocado a public/anon/authenticated, salvo
--          contar_visita_publica, que la llama la clave anon desde el
--          middleware: anon-ok: solo suma 1 a un recuento agregado con
--          valores de listas cerradas; no lee ni devuelve nada.

-- ---------------------------------------------------------------------------
-- 1. Origen de cada alta (primer contacto)
create table if not exists public.origen_altas (
  user_id uuid primary key references auth.users (id) on delete cascade,
  fuente text not null check (fuente in (
    'instagram', 'facebook', 'google', 'bing', 'duckduckgo', 'ecosia', 'yahoo',
    'whatsapp', 'telegram', 'x', 'email', 'referido', 'invitacion', 'directo', 'otro',
    'desconocido')),
  medio text check (medio is null or medio in ('social', 'organico', 'email', 'referido', 'directo', 'otro')),
  campana text check (campana is null or campana ~ '^[a-z0-9][a-z0-9_-]{0,59}$'),
  pagina text check (pagina is null or pagina in ('empieza', 'mareas', 'spots', 'especies', 'login', 'otra')),
  creado_en timestamptz not null default now()
);
alter table public.origen_altas enable row level security;
revoke all on public.origen_altas from anon, authenticated;
comment on table public.origen_altas is 'Primer contacto de cada alta (fuente/medio/campaña de listas cerradas, sin datos personales). Sin policies: solo funciones definer y service_role. 2026-10-09.';

create or replace function public.registrar_origen_alta()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_meta jsonb;
  v_fuente text;
  v_medio text;
  v_campana text;
  v_pagina text;
begin
  begin
    select coalesce(u.raw_user_meta_data, '{}'::jsonb) into v_meta from auth.users u where u.id = new.id;
    v_fuente := lower(coalesce(v_meta #>> '{origen,fuente}', ''));
    v_medio := lower(coalesce(v_meta #>> '{origen,medio}', ''));
    v_campana := lower(coalesce(v_meta #>> '{origen,campana}', ''));
    v_pagina := lower(coalesce(v_meta #>> '{origen,pagina}', ''));

    -- Quien llega con código de amigo cuenta como "referido" aunque no traiga origen.
    if v_fuente = '' and coalesce(v_meta ->> 'ref', '') <> '' then
      v_fuente := 'referido'; v_medio := 'referido';
    end if;
    if v_fuente = '' and coalesce(v_meta ->> 'codigo_invitacion', '') <> '' then
      v_fuente := 'invitacion'; v_medio := 'email';
    end if;

    if v_fuente not in ('instagram', 'facebook', 'google', 'bing', 'duckduckgo', 'ecosia', 'yahoo',
        'whatsapp', 'telegram', 'x', 'email', 'referido', 'invitacion', 'directo', 'otro') then
      v_fuente := case when v_fuente = '' then 'desconocido' else 'otro' end;
    end if;
    if v_fuente = 'referido' and v_medio = '' then v_medio := 'referido'; end if;
    if v_medio not in ('social', 'organico', 'email', 'referido', 'directo', 'otro') then v_medio := null; end if;
    if v_campana !~ '^[a-z0-9][a-z0-9_-]{0,59}$' then v_campana := null; end if;
    if v_pagina not in ('empieza', 'mareas', 'spots', 'especies', 'login', 'otra') then v_pagina := null; end if;

    insert into public.origen_altas (user_id, fuente, medio, campana, pagina)
    values (new.id, v_fuente, v_medio, v_campana, v_pagina)
    on conflict (user_id) do nothing;
  exception when others then
    -- Nunca se rompe un alta por la analítica.
    raise warning 'registrar_origen_alta: % (%)', sqlerrm, sqlstate;
  end;
  return new;
end;
$$;
revoke all on function public.registrar_origen_alta() from public, anon, authenticated;

drop trigger if exists perfiles_registrar_origen on public.perfiles;
create trigger perfiles_registrar_origen
  after insert on public.perfiles
  for each row execute function public.registrar_origen_alta();

-- ---------------------------------------------------------------------------
-- 2. Visitas a páginas públicas (recuento agregado)
create table if not exists public.visitas_publicas (
  dia date not null,
  pagina text not null check (pagina in ('empieza', 'mareas', 'spots', 'especies', 'login')),
  fuente text not null check (fuente in (
    'instagram', 'facebook', 'google', 'bing', 'duckduckgo', 'ecosia', 'yahoo',
    'whatsapp', 'telegram', 'x', 'email', 'referido', 'invitacion', 'directo', 'otro')),
  campana text not null default '' check (campana = '' or campana ~ '^[a-z0-9][a-z0-9_-]{0,59}$'),
  visitas integer not null default 0 check (visitas >= 0),
  primary key (dia, pagina, fuente, campana)
);
alter table public.visitas_publicas enable row level security;
revoke all on public.visitas_publicas from anon, authenticated;
comment on table public.visitas_publicas is 'Recuento diario de visitas a páginas públicas por tipo de página, fuente y campaña. Sin datos personales. Sin policies. 2026-10-09.';

create or replace function public.contar_visita_publica(p_pagina text, p_fuente text, p_campana text default null)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_fuente text := lower(coalesce(p_fuente, ''));
  v_campana text := lower(coalesce(p_campana, ''));
begin
  if p_pagina is null or p_pagina not in ('empieza', 'mareas', 'spots', 'especies', 'login') then
    return;
  end if;
  if v_fuente not in ('instagram', 'facebook', 'google', 'bing', 'duckduckgo', 'ecosia', 'yahoo',
      'whatsapp', 'telegram', 'x', 'email', 'referido', 'invitacion', 'directo', 'otro') then
    v_fuente := 'otro';
  end if;
  if v_campana !~ '^[a-z0-9][a-z0-9_-]{0,59}$' then v_campana := ''; end if;

  insert into public.visitas_publicas as v (dia, pagina, fuente, campana, visitas)
  values ((now() at time zone 'Europe/Madrid')::date, p_pagina, v_fuente, v_campana, 1)
  on conflict (dia, pagina, fuente, campana)
  -- Tope por fila y día: alguien que martillee la función no puede hacer
  -- crecer el número sin límite (ni la tabla: las claves son de listas).
  do update set visitas = least(v.visitas + 1, 1000000);
end;
$$;
revoke all on function public.contar_visita_publica(text, text, text) from public, anon, authenticated;
-- anon-ok: la llama el middleware con la clave anon; solo suma 1 a un
-- recuento agregado con valores de listas cerradas, no lee ni devuelve nada.
grant execute on function public.contar_visita_publica(text, text, text) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Primer cobro de verdad (conversión de prueba a pago)
alter table public.suscripciones add column if not exists primer_pago_en timestamptz;
comment on column public.suscripciones.primer_pago_en is 'Primera vez que la suscripción pasó a active (primer cobro tras la prueba). Lo rellena stripe-webhook.js. 2026-10-09.';

-- Las que ya están activas hoy: se toma su última actualización como
-- aproximación (no hay histórico de cuándo pasaron a active).
update public.suscripciones
set primer_pago_en = actualizado_en
where estado = 'active' and primer_pago_en is null;

do $$
begin
  raise notice 'Captación 1/4: % suscripciones activas con primer_pago_en; origen_altas y visitas_publicas listas.',
    (select count(*) from public.suscripciones where primer_pago_en is not null);
end;
$$;
