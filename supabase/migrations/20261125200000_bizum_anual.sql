-- "Pagar 1 año con Bizum" (2026-11-25, aprobado por Mikel; interruptor
-- BIZUM_ACTIVO apagado hasta que Stripe apruebe Bizum en la cuenta).
--
-- Bizum en Stripe es solo de pago único (sin suscripciones ni cobros
-- recurrentes): un pago da 12 meses de Premium y no hay suscripción de Stripe
-- que lo cancele al acabar. Por eso el acceso de una fila pagada con Bizum
-- termina en periodo_actual_fin, lo diga o no la columna estado.
--
-- Sin tablas nuevas ni cambios de RLS/policies (suscripciones sigue igual:
-- el usuario lee la suya y solo escribe el service_role).

-- 1. Cómo se pagó el periodo actual. NULL = filas de antes (tarjeta).
alter table public.suscripciones
  add column if not exists metodo_pago text;
alter table public.suscripciones
  drop constraint if exists suscripciones_metodo_pago_check;
alter table public.suscripciones
  add constraint suscripciones_metodo_pago_check
  check (metodo_pago is null or metodo_pago in ('tarjeta', 'bizum'));

-- 2. Último pago de Bizum aplicado (id de la Checkout Session de Stripe):
--    si Stripe reenvía el mismo pago, no se suma otro año.
alter table public.suscripciones
  add column if not exists bizum_sesion_id text;

-- 3. Avisos de renovación ya enviados, guardando el fin del periodo avisado:
--    nunca dos veces para el mismo periodo, y al renovar (fin nuevo) vuelven
--    a tocar solos.
alter table public.suscripciones
  add column if not exists renovacion_avisada_fin timestamptz;
alter table public.suscripciones
  add column if not exists renovacion_ultimo_dia_fin timestamptz;

-- 4. Acceso: con Bizum, solo hasta periodo_actual_fin. Al vencer, estado
--    "caducada" y plan gratuito (o la prueba, si aún la tuviera). Devuelve
--    también metodo_pago para la página de suscripción. Resto, igual que en
--    producción (definición leída el 2026-11-25).
create or replace function public.mi_estado_suscripcion()
 returns jsonb
 language plpgsql
 stable security definer
 set search_path = public, extensions
as $function$
declare
  v_creado_en timestamptz;
  v_prueba_termina_en timestamptz;
  v_sub record;
  v_invitacion timestamptz;
  v_pagando boolean;
  v_en_prueba boolean;
  v_bizum_caducado boolean;
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

  select estado, periodo, periodo_actual_fin, ambito, region_contenido, fundador, metodo_pago
    into v_sub
    from public.suscripciones
    where user_id = auth.uid();

  -- Bizum: sin fecha de fin o con ella pasada, no hay acceso.
  v_bizum_caducado := coalesce(v_sub.metodo_pago = 'bizum', false)
    and coalesce(v_sub.periodo_actual_fin <= now(), true);
  v_pagando := coalesce(v_sub.estado in ('trialing', 'active'), false) and not v_bizum_caducado;
  v_en_prueba := now() < v_prueba_termina_en;

  return jsonb_build_object(
    'estado', case when v_bizum_caducado then 'caducada' else coalesce(v_sub.estado, 'sin_suscripcion') end,
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
    'fundador', coalesce(v_sub.fundador, false),
    'metodo_pago', coalesce(v_sub.metodo_pago, case when v_sub.estado is not null then 'tarjeta' end)
  );
end;
$function$;

-- Los permisos no cambian con create or replace; se repiten por claridad
-- (D7 de comun: EXECUTE mínimo).
revoke execute on function public.mi_estado_suscripcion() from public, anon;
grant execute on function public.mi_estado_suscripcion() to authenticated;
