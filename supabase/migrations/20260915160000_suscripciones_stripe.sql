-- Costa Viva — paywall de suscripcion (Stripe)
--
-- Pedido explicito del usuario: 7 dias de prueba gratis desde el alta
-- (perfiles.creado_en, ya existe, no hace falta columna nueva), despues
-- de pago (3,99E/mes o 39,99E/anyo). Bloqueo total (no freemium) cuando
-- termina la prueba o el pago sin suscripcion activa. El admin
-- (es_admin(), ya existe) nunca se bloquea.
--
-- Diseño de la tabla: "deny by default", igual patron que
-- estadisticas_anonimas_capturas (RLS activada, SOLO politica de
-- lectura para el propio usuario, SIN politicas de escritura). La
-- unica escritura posible es desde el webhook de Stripe
-- (functions/stripe-webhook.js), que usa la service_role key
-- (bypassa RLS a proposito) porque ahi la "prueba de autenticidad" no
-- es sesion de usuario ni secreto compartido, sino la firma
-- criptografica que manda Stripe (Stripe-Signature) -- exactamente el
-- mismo razonamiento que ya justifica el unico otro uso de
-- service_role del repo (aviso-alta.js: sin sesion todavia, se
-- verifica la autenticidad contra Supabase Auth Admin en vez del
-- cliente). NO se usa la anon key para escribir esta tabla (a
-- diferencia de registrar-presion.js) porque el estado de suscripcion
-- es sensible -- determina el acceso de pago -- y la anon key es
-- publica (va hardcodeada en cada HTML), asi que una politica de
-- insert/update abierta a "anon" dejaria falsificar un "pagado" para
-- cualquier user_id.
--
-- "estado" refleja tal cual subscription.status de Stripe
-- (trialing/active/past_due/canceled/incomplete/incomplete_expired/
-- unpaid/paused) -- no se inventan valores nuevos, asi el webhook solo
-- copia el campo sin traducir nada.

create table if not exists public.suscripciones (
  user_id uuid primary key references auth.users (id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  estado text,
  periodo text check (periodo is null or periodo in ('mensual', 'anual')),
  periodo_actual_fin timestamptz,
  actualizado_en timestamptz not null default now()
);

alter table public.suscripciones enable row level security;

create policy "cada usuario ve su propia suscripcion"
  on public.suscripciones for select
  using (auth.uid() = user_id);

-- Sin politicas de insert/update/delete a proposito -- solo
-- service_role (que bypassa RLS) puede escribir, desde stripe-webhook.js.

-- Punto de entrada unico para el frontend: decide si el usuario tiene
-- acceso ahora mismo y con que datos mostrar en la UI de paywall.
-- security definer + auth.uid() interno (no recibe user_id por
-- parametro, igual patron que otras funciones "mi_*" del repo: nunca
-- confiar en un id que mande el cliente).
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
