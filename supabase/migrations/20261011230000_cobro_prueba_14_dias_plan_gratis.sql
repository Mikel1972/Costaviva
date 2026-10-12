-- Cobro con los precios confirmados por Mikel (2026-10-11): "adelante con el cobro".
--
--   1. Prueba de Premium de 14 DÍAS sin tarjeta desde el alta (antes 7).
--   2. Al acabar la prueba la cuenta pasa al PLAN GRATUITO (mapa, mareas y
--      condiciones básicas en todas las regiones). Ya no se bloquea la app:
--      mi_estado_suscripcion() sigue devolviendo con_acceso = "tiene Premium
--      en alguna región" (las páginas solo Premium —diario, grupos, alarma— y
--      /identificar-captura lo siguen usando igual), e index.html deja de
--      redirigir y enseña lo gratuito.
--   3. Ámbitos: plan regional (Premium en la región de contenido de su zona:
--      "es" o "nz") o Mundial (todas). La prueba, el admin, los accesos
--      permanentes y las invitaciones del 100 % cuentan como Mundial.
--   4. Precio fundador: 500 plazas compartidas entre regional y Mundial anual.
--   5. Lo que guarda el webhook: zona, moneda, país de facturación, código
--      promocional usado.
--   6. Emails del ciclo de prueba (avisar-fin-prueba.js): recordatorio el día
--      11 (3 días antes) y aviso de fin el día 14 ("pasas al plan gratuito").
--      desactivado_en pasa a significar "su prueba terminó y pasó a gratis".
--
-- Sin tablas nuevas ni policies nuevas: el baseline del vigía no cambia.

-- 1. suscripciones: lo que compró cada cliente ---------------------------------

alter table public.suscripciones
  add column if not exists primer_pago_en timestamptz,
  add column if not exists ambito text,
  add column if not exists region_contenido text,
  add column if not exists zona_precio text,
  add column if not exists moneda text,
  add column if not exists pais_facturacion text,
  add column if not exists fundador boolean not null default false,
  add column if not exists fundador_desde timestamptz,
  add column if not exists precio_lookup_key text,
  add column if not exists stripe_promotion_code_id text,
  add column if not exists codigo_promocional text;

alter table public.suscripciones drop constraint if exists suscripciones_ambito_check;
alter table public.suscripciones add constraint suscripciones_ambito_check
  check (ambito is null or ambito in ('regional', 'mundial'));

comment on column public.suscripciones.ambito is 'regional (Premium en region_contenido) o mundial (todas las regiones activas). null = suscripción anterior al 2026-10-11, se trata como regional "es".';
comment on column public.suscripciones.region_contenido is 'Región de contenido del plan regional ("es" = España y Portugal, "nz"). La pone crear-checkout-stripe.js según la zona del cliente.';
comment on column public.suscripciones.zona_precio is 'Zona de precios (functions/_lib/precios-zonas.json) con la que se cobró.';
comment on column public.suscripciones.pais_facturacion is 'País de facturación que dio en el checkout de Stripe (manda para el IVA).';
comment on column public.suscripciones.fundador is 'Su precio actual es el de fundador.';
comment on column public.suscripciones.fundador_desde is 'Primera vez que tuvo precio de fundador (cuenta para las 500 plazas). No se borra.';
comment on column public.suscripciones.codigo_promocional is 'Código promocional de Stripe usado en el checkout (texto), si hubo.';

-- 2. Plazas de fundador ---------------------------------------------------------
-- 500 = plazas_fundador de functions/_lib/precios-zonas.json (el test lo
-- compara). Gasta plaza quien tiene o ha tenido precio de fundador, salvo un
-- checkout que nunca llegó a cobrar ni a empezar (incomplete) o una prueba de
-- Stripe cancelada sin pagar nunca.
create or replace function public.plazas_fundador_restantes()
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select greatest(0, 500 - count(*))::integer
  from public.suscripciones s
  where s.fundador_desde is not null
    and (
      s.estado in ('trialing', 'active', 'past_due', 'unpaid')
      or s.primer_pago_en is not null
    );
$$;
revoke all on function public.plazas_fundador_restantes() from public, anon;
grant execute on function public.plazas_fundador_restantes() to authenticated, service_role;

-- 3. Estado de la cuenta ---------------------------------------------------------
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
  v_invitacion timestamptz;
  v_pagando boolean;
  v_en_prueba boolean;
begin
  if public.es_admin() then
    return jsonb_build_object('estado', 'admin', 'plan', 'admin', 'con_acceso', true, 'premium', true,
      'ambito', 'mundial', 'region_contenido', null, 'en_prueba', false,
      'prueba_termina_en', null, 'periodo_actual_fin', null, 'periodo', null, 'fundador', false);
  end if;

  if public.tiene_acceso_permanente(auth.email()) then
    return jsonb_build_object('estado', 'permanente', 'plan', 'permanente', 'con_acceso', true, 'premium', true,
      'ambito', 'mundial', 'region_contenido', null, 'en_prueba', false,
      'prueba_termina_en', null, 'periodo_actual_fin', null, 'periodo', null, 'fundador', false);
  end if;

  v_invitacion := public.invitacion_gratis_vigente(auth.uid());
  if v_invitacion is not null then
    return jsonb_build_object('estado', 'invitacion', 'plan', 'invitacion', 'con_acceso', true, 'premium', true,
      'ambito', 'mundial', 'region_contenido', null, 'en_prueba', false,
      'acceso_hasta', case when v_invitacion = 'infinity'::timestamptz then null else v_invitacion end,
      'prueba_termina_en', null, 'periodo_actual_fin', null, 'periodo', null, 'fundador', false);
  end if;

  select creado_en into v_creado_en from public.perfiles where id = auth.uid();
  if v_creado_en is null then
    return jsonb_build_object('estado', 'sin_perfil', 'plan', 'gratis', 'con_acceso', false, 'premium', false,
      'ambito', null, 'region_contenido', null, 'en_prueba', false,
      'prueba_termina_en', null, 'periodo_actual_fin', null, 'periodo', null, 'fundador', false);
  end if;
  v_prueba_termina_en := v_creado_en + interval '14 days';

  select estado, periodo, periodo_actual_fin, ambito, region_contenido, fundador
    into v_sub
    from public.suscripciones
    where user_id = auth.uid();

  v_pagando := coalesce(v_sub.estado in ('trialing', 'active'), false);
  v_en_prueba := now() < v_prueba_termina_en;

  return jsonb_build_object(
    'estado', coalesce(v_sub.estado, 'sin_suscripcion'),
    'plan', case when v_pagando then 'premium' when v_en_prueba then 'prueba' else 'gratis' end,
    'con_acceso', v_pagando or v_en_prueba,
    'premium', v_pagando or v_en_prueba,
    -- Con suscripción manda su ámbito; en la prueba, Mundial.
    'ambito', case when v_pagando then coalesce(v_sub.ambito, 'regional') when v_en_prueba then 'mundial' else null end,
    'region_contenido', case when v_pagando then coalesce(v_sub.region_contenido, 'es') else null end,
    'en_prueba', v_en_prueba and not v_pagando,
    'prueba_termina_en', v_prueba_termina_en,
    'periodo_actual_fin', v_sub.periodo_actual_fin,
    'periodo', v_sub.periodo,
    'fundador', coalesce(v_sub.fundador, false)
  );
end;
$$;
revoke execute on function public.mi_estado_suscripcion() from public, anon;
grant execute on function public.mi_estado_suscripcion() to authenticated;

-- 4. Ciclo de emails de la prueba (14 días) ---------------------------------------
-- Mismo diseño que 20260928120000 (Postgres decide a quién, se marca solo tras
-- confirmar Resend, guarda de volumen en el endpoint). Cambia el calendario:
--   alta    bienvenida (hasta el día 11)
--   día 11  recordatorio: "tu prueba de Premium acaba el día 14"
--   día 14  aviso de fin: pasa al plan gratuito (desactivado_en). No bloquea.
-- Se añade el idioma del perfil (user_metadata.idioma) para escribir en
-- inglés a quien usa la app en inglés.

comment on column public.perfiles.desactivado_en is
  'Desde 2026-10-11: cuándo terminó su prueba de Premium sin suscripción y pasó al plan gratuito (con su email). No bloquea nada.';
comment on column public.perfiles.desactivar_previsto_en is
  'Fecha de fin de prueba prometida en el recordatorio. Nunca se pasa a gratis antes.';

drop function if exists public.usuarios_bienvenida_pendiente_email();
create function public.usuarios_bienvenida_pendiente_email()
returns table (user_id uuid, email text, prueba_termina_en timestamptz, idioma text)
language sql
security definer
set search_path = public
as $$
  select p.id, u.email::text, p.creado_en + interval '14 days',
         case when u.raw_user_meta_data->>'idioma' = 'en' then 'en' else 'es' end
  from public.perfiles p
  join auth.users u on u.id = p.id
  where p.bienvenida_email_en is null
    and u.email_confirmed_at is not null
    and p.creado_en + interval '11 days' > now()
    and not public.fin_prueba_fuera_de_ciclo(p.id);
$$;
revoke all on function public.usuarios_bienvenida_pendiente_email() from public, authenticated, anon;
grant execute on function public.usuarios_bienvenida_pendiente_email() to service_role;

drop function if exists public.usuarios_fin_prueba_pendiente_recordatorio();
create function public.usuarios_fin_prueba_pendiente_recordatorio()
returns table (user_id uuid, email text, desactivar_en timestamptz, idioma text)
language sql
security definer
set search_path = public
as $$
  select p.id, u.email::text,
         greatest(p.creado_en + interval '14 days', now() + interval '2 days'),
         case when u.raw_user_meta_data->>'idioma' = 'en' then 'en' else 'es' end
  from public.perfiles p
  join auth.users u on u.id = p.id
  where p.fin_prueba_recordatorio_en is null
    and p.desactivado_en is null
    and p.creado_en + interval '11 days' < now()
    and u.email_confirmed_at is not null
    and not public.fin_prueba_fuera_de_ciclo(p.id)
    and not exists (
      select 1 from public.suscripciones s
      where s.user_id = p.id and s.estado in ('trialing', 'active')
    );
$$;
revoke all on function public.usuarios_fin_prueba_pendiente_recordatorio() from public, authenticated, anon;
grant execute on function public.usuarios_fin_prueba_pendiente_recordatorio() to service_role;

create or replace function public.marcar_fin_prueba_recordatorio(p_user_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.perfiles
  set fin_prueba_recordatorio_en = now(),
      desactivar_previsto_en = greatest(creado_en + interval '14 days', now() + interval '2 days')
  where id = p_user_id and fin_prueba_recordatorio_en is null;
$$;
revoke all on function public.marcar_fin_prueba_recordatorio(uuid) from public, authenticated, anon;
grant execute on function public.marcar_fin_prueba_recordatorio(uuid) to service_role;

drop function if exists public.usuarios_fin_prueba_pendiente_desactivar();
create function public.usuarios_fin_prueba_pendiente_desactivar()
returns table (user_id uuid, email text, idioma text)
language sql
security definer
set search_path = public
as $$
  select p.id, u.email::text,
         case when u.raw_user_meta_data->>'idioma' = 'en' then 'en' else 'es' end
  from public.perfiles p
  join auth.users u on u.id = p.id
  where p.desactivar_previsto_en is not null
    and p.desactivar_previsto_en < now()
    and p.desactivado_en is null
    and not public.fin_prueba_fuera_de_ciclo(p.id)
    and not exists (
      select 1 from public.suscripciones s
      where s.user_id = p.id and s.estado in ('trialing', 'active')
    );
$$;
revoke all on function public.usuarios_fin_prueba_pendiente_desactivar() from public, authenticated, anon;
grant execute on function public.usuarios_fin_prueba_pendiente_desactivar() to service_role;

-- 5. Quien está a mitad del ciclo antiguo de 7 días ------------------------------
-- Su prueba pasa a durar 14 días desde el alta. Si aún no han llegado al día
-- 14, se reinicia su ciclo: recibirán el recordatorio el día 11 y el aviso de
-- fin el 14 (y no un "tu cuenta se desactiva" con la fecha antigua). A
-- quienes ya se les desactivó con la regla de 7 días y siguen dentro de los
-- 14, se les quita la marca: vuelven a estar en prueba.
do $$
declare
  v_reiniciados integer;
begin
  update public.perfiles p
  set fin_prueba_recordatorio_en = null,
      desactivar_previsto_en = null,
      desactivado_en = null
  where p.creado_en + interval '14 days' > now()
    and (p.fin_prueba_recordatorio_en is not null or p.desactivado_en is not null);
  get diagnostics v_reiniciados = row_count;
  raise notice 'Perfiles con la prueba ampliada a 14 días y el ciclo de emails reiniciado: %', v_reiniciados;
  raise notice 'Plazas de fundador libres: %', public.plazas_fundador_restantes();
end $$;
