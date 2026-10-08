-- Costaviva — Captación (2/4): "Invita a un amigo" (2026-10-09, aprobado
-- por Mikel: activado desde el principio, con protecciones contra abusos).
--
-- SIN APLICAR: se aplica con aplicar-migraciones.yml desde main cuando
-- Mikel lo apruebe.
--
-- Qué hace, en llano:
--   - Cada usuario tiene un enlace para compartir
--     (costaviva.org/empieza?ref=CODIGO). El código se crea la primera vez
--     que abre "Invita a un amigo" en suscripcion.html.
--   - Si un amigo crea su cuenta con ese enlace, queda apuntado como
--     "pendiente". Cuando ese amigo PAGA de verdad (su suscripción pasa a
--     activa tras la prueba), quien le invitó gana 1 mes gratis:
--       · si ya está suscrito: Stripe le descuenta 3,99 € (un mes) de su
--         próximo cobro (saldo a favor en Stripe, lo hace stripe-webhook.js);
--       · si aún no lo está: el mes se suma a su prueba gratis cuando se
--         suscriba (crear-checkout-stripe.js, hasta 3 meses acumulados).
--
-- Protecciones contra abusos:
--   1. Un amigo solo cuenta UNA vez en la vida: se guarda un resumen
--      (hash SHA-256) de su email normalizado, nunca el email. Borrar la
--      cuenta y volver a crearla no vale.
--   2. Nada de invitarse a uno mismo: mismo email normalizado (Gmail sin
--      puntos, sin "+alias") = rechazado.
--   3. Misma casa: si el amigo paga con la MISMA tarjeta que quien invita, o
--      con una tarjeta ya usada por otro amigo de la misma persona, no hay
--      premio (lo comprueba stripe-webhook.js con la huella de la tarjeta que
--      da Stripe; aquí solo se guarda su hash).
--   4. Solo cuenta un pago real: un amigo que se da de baja en la prueba, o
--      que entra con una invitación gratis, no da premio.
--   5. Tope: 12 meses gratis por persona y año. Más de 10 altas con el mismo
--      código en 24 h = esas altas no cuentan (huele a bot).
--   6. Interruptor: ajustes_app 'referidos_activo' (true por defecto). Con
--      false, ni se crean códigos ni se apuntan amigos ni hay premios.
--
-- Estándares (comun estandares/supabase.md): RLS sin policies en las tablas
-- nuevas (D5/D6), search_path fijo (D9), EXECUTE revocado a public/anon y,
-- salvo las dos funciones "mi_*" que usa la app con la sesión del propio
-- usuario, también a authenticated (D10).

-- ---------------------------------------------------------------------------
-- Interruptores de la app
create table if not exists public.ajustes_app (
  clave text primary key,
  valor jsonb not null,
  actualizado_en timestamptz not null default now()
);
alter table public.ajustes_app enable row level security;
revoke all on public.ajustes_app from anon, authenticated;
comment on table public.ajustes_app is 'Interruptores de la app (clave/valor). Sin policies: solo funciones definer y service_role. 2026-10-09.';
insert into public.ajustes_app (clave, valor) values ('referidos_activo', 'true'::jsonb)
on conflict (clave) do nothing;

create or replace function public.referidos_activo()
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select coalesce((select (valor)::text = 'true' from public.ajustes_app where clave = 'referidos_activo'), false);
$$;
revoke all on function public.referidos_activo() from public, anon, authenticated;

-- Email normalizado para comparar personas: minúsculas, sin "+alias" y, en
-- Gmail, sin puntos y con googlemail = gmail. No es definer.
create or replace function public.email_canonico(p_email text)
returns text
language plpgsql
immutable
set search_path = public, extensions
as $$
declare
  v text := lower(trim(coalesce(p_email, '')));
  v_local text;
  v_dominio text;
begin
  if position('@' in v) < 2 then return v; end if;
  v_local := split_part(v, '@', 1);
  v_dominio := split_part(v, '@', 2);
  v_local := split_part(v_local, '+', 1);
  if v_dominio in ('gmail.com', 'googlemail.com') then
    v_local := replace(v_local, '.', '');
    v_dominio := 'gmail.com';
  end if;
  return v_local || '@' || v_dominio;
end;
$$;
revoke all on function public.email_canonico(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Tablas
create table if not exists public.codigos_referido (
  user_id uuid primary key references auth.users (id) on delete cascade,
  codigo text not null unique check (codigo ~ '^[A-HJ-NP-Z2-9]{8}$'),
  creado_en timestamptz not null default now()
);
alter table public.codigos_referido enable row level security;
revoke all on public.codigos_referido from anon, authenticated;

create table if not exists public.referidos (
  id uuid primary key default gen_random_uuid(),
  referidor_id uuid references auth.users (id) on delete set null,
  referido_id uuid unique references auth.users (id) on delete set null,
  -- SHA-256 del email normalizado del amigo: "un amigo, una vez" aunque
  -- borre la cuenta. Nunca el email en claro.
  email_hash text not null unique check (email_hash ~ '^[0-9a-f]{64}$'),
  creado_en timestamptz not null default now(),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'rechazado', 'pagado', 'recompensado')),
  motivo text check (motivo is null or motivo in ('mismo_email', 'demasiadas_altas', 'misma_tarjeta', 'tarjeta_repetida', 'tope_anual', 'desactivado')),
  pagado_en timestamptz,
  -- Hash de la huella de la tarjeta con la que pagó el amigo (Stripe
  -- fingerprint), para detectar la misma tarjeta en varios "amigos".
  huella_tarjeta text check (huella_tarjeta is null or huella_tarjeta ~ '^[0-9a-f]{64}$'),
  recompensa_tipo text check (recompensa_tipo is null or recompensa_tipo in ('saldo_stripe', 'dias_prueba')),
  recompensa_en timestamptz,
  recompensa_ref text check (recompensa_ref is null or char_length(recompensa_ref) <= 120)
);
create index if not exists referidos_referidor_idx on public.referidos (referidor_id, estado);
alter table public.referidos enable row level security;
revoke all on public.referidos from anon, authenticated;
comment on table public.referidos is '"Invita a un amigo" (2026-10-09). Sin emails en claro. Sin policies: solo funciones definer y service_role.';

-- ---------------------------------------------------------------------------
-- Código propio (8 caracteres sin I, O, 0 ni 1, 40 bits)
create or replace function public.generar_codigo_referido()
returns text
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  alfabeto constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bytes bytea := extensions.gen_random_bytes(8);
  v text := '';
begin
  for i in 0..7 loop
    v := v || substr(alfabeto, (get_byte(bytes, i) % 32) + 1, 1);
  end loop;
  return v;
end;
$$;
revoke all on function public.generar_codigo_referido() from public, anon, authenticated;

-- Lo que ve el usuario en "Invita a un amigo" (suscripcion.html). Crea su
-- código si no lo tiene. Nunca devuelve datos de los amigos, solo cuentas.
create or replace function public.mi_invitar_amigo()
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_codigo text;
  v_intento int := 0;
begin
  if v_uid is null then raise exception 'sin sesión'; end if;
  if not public.referidos_activo() then return jsonb_build_object('activo', false); end if;

  select codigo into v_codigo from public.codigos_referido where user_id = v_uid;
  while v_codigo is null and v_intento < 5 loop
    v_intento := v_intento + 1;
    begin
      insert into public.codigos_referido (user_id, codigo)
      values (v_uid, public.generar_codigo_referido())
      on conflict (user_id) do nothing;
    exception when unique_violation then
      null; -- código repetido (muy raro): otro intento
    end;
    select codigo into v_codigo from public.codigos_referido where user_id = v_uid;
  end loop;

  return jsonb_build_object(
    'activo', true,
    'codigo', v_codigo,
    'apuntados', (select count(*) from public.referidos where referidor_id = v_uid and estado <> 'rechazado'),
    'pagados', (select count(*) from public.referidos where referidor_id = v_uid and estado in ('pagado', 'recompensado')),
    'meses_ganados', (select count(*) from public.referidos where referidor_id = v_uid and estado = 'recompensado'),
    'meses_pendientes', (select count(*) from public.referidos where referidor_id = v_uid and estado = 'pagado' and recompensa_tipo is null),
    'tope_anual', 12
  );
end;
$$;
revoke all on function public.mi_invitar_amigo() from public, anon;
grant execute on function public.mi_invitar_amigo() to authenticated;

-- Meses ganados que aún no se han usado (para sumar días de prueba al
-- suscribirse). Solo los del propio usuario; como mucho 3.
create or replace function public.mis_recompensas_referido_pendientes()
returns uuid[]
language sql
stable
security definer
set search_path = public, extensions
as $$
  select coalesce(array_agg(id), '{}')
  from (
    select id from public.referidos
    where referidor_id = auth.uid() and estado = 'pagado' and recompensa_tipo is null
      and public.referidos_activo()
    order by pagado_en
    limit 3
  ) t;
$$;
revoke all on function public.mis_recompensas_referido_pendientes() from public, anon;
grant execute on function public.mis_recompensas_referido_pendientes() to authenticated;

-- ---------------------------------------------------------------------------
-- Al crearse el perfil: si el alta trae metadato "ref", se apunta el amigo.
create or replace function public.registrar_referido_alta()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_ref text;
  v_email text;
  v_referidor uuid;
  v_email_referidor text;
  v_hash text;
  v_estado text := 'pendiente';
  v_motivo text;
begin
  begin
    select upper(coalesce(u.raw_user_meta_data ->> 'ref', '')), u.email
      into v_ref, v_email
    from auth.users u where u.id = new.id;
    if v_ref !~ '^[A-HJ-NP-Z2-9]{8}$' or v_email is null then return new; end if;
    if not public.referidos_activo() then return new; end if;

    select c.user_id, u.email into v_referidor, v_email_referidor
    from public.codigos_referido c join auth.users u on u.id = c.user_id
    where c.codigo = v_ref;
    if v_referidor is null or v_referidor = new.id then return new; end if;

    if public.email_canonico(v_email) = public.email_canonico(v_email_referidor) then
      v_estado := 'rechazado'; v_motivo := 'mismo_email';
    elsif (select count(*) from public.referidos
           where referidor_id = v_referidor and creado_en > now() - interval '24 hours') >= 10 then
      v_estado := 'rechazado'; v_motivo := 'demasiadas_altas';
    end if;

    v_hash := encode(extensions.digest(public.email_canonico(v_email), 'sha256'), 'hex');
    insert into public.referidos (referidor_id, referido_id, email_hash, estado, motivo)
    values (v_referidor, new.id, v_hash, v_estado, v_motivo)
    on conflict do nothing; -- ese amigo ya contó una vez: no vuelve a contar
  exception when others then
    raise warning 'registrar_referido_alta: % (%)', sqlerrm, sqlstate;
  end;
  return new;
end;
$$;
revoke all on function public.registrar_referido_alta() from public, anon, authenticated;

drop trigger if exists perfiles_registrar_referido on public.perfiles;
create trigger perfiles_registrar_referido
  after insert on public.perfiles
  for each row execute function public.registrar_referido_alta();

-- ---------------------------------------------------------------------------
-- Funciones para stripe-webhook.js y crear-checkout-stripe.js (service_role)

-- ¿Este usuario que acaba de pagar vino invitado y está pendiente?
create or replace function public.referido_pendiente_de(p_referido uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, extensions
as $$
  select jsonb_build_object(
    'id', r.id,
    'referidor_id', r.referidor_id,
    'referidor_customer', (select s.stripe_customer_id from public.suscripciones s where s.user_id = r.referidor_id)
  )
  from public.referidos r
  where r.referido_id = p_referido and r.estado = 'pendiente' and r.referidor_id is not null
    and public.referidos_activo();
$$;
revoke all on function public.referido_pendiente_de(uuid) from public, anon, authenticated;
grant execute on function public.referido_pendiente_de(uuid) to service_role;

-- Decide el premio de un amigo que ha pagado. p_huella = hash de la huella
-- de su tarjeta (o null si Stripe no la dio); p_misma_tarjeta = el webhook
-- ha visto esa misma tarjeta en el cliente de Stripe de quien invita.
-- Devuelve {resultado: 'saldo'|'dias'|'rechazado'|'nada', motivo, referidor_customer}.
create or replace function public.referido_resolver_pago(p_id uuid, p_huella text, p_misma_tarjeta boolean)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  r public.referidos%rowtype;
  v_customer text;
  v_estado_sus text;
  v_motivo text;
begin
  select * into r from public.referidos where id = p_id for update;
  if not found or r.estado <> 'pendiente' or r.referidor_id is null then
    return jsonb_build_object('resultado', 'nada');
  end if;
  if p_huella is not null and p_huella !~ '^[0-9a-f]{64}$' then p_huella := null; end if;

  if not public.referidos_activo() then
    v_motivo := 'desactivado';
  elsif coalesce(p_misma_tarjeta, false) then
    v_motivo := 'misma_tarjeta';
  elsif p_huella is not null and exists (
      select 1 from public.referidos o
      where o.referidor_id = r.referidor_id and o.id <> r.id and o.huella_tarjeta = p_huella
        and o.estado in ('pagado', 'recompensado')) then
    v_motivo := 'tarjeta_repetida';
  elsif (select count(*) from public.referidos o
         where o.referidor_id = r.referidor_id and o.estado in ('pagado', 'recompensado')
           and o.pagado_en > now() - interval '365 days') >= 12 then
    v_motivo := 'tope_anual';
  end if;

  if v_motivo is not null then
    update public.referidos set estado = 'rechazado', motivo = v_motivo, pagado_en = now(), huella_tarjeta = p_huella where id = r.id;
    return jsonb_build_object('resultado', 'rechazado', 'motivo', v_motivo);
  end if;

  select s.stripe_customer_id, s.estado into v_customer, v_estado_sus
  from public.suscripciones s where s.user_id = r.referidor_id;
  if v_customer is not null and v_estado_sus in ('trialing', 'active', 'past_due') then
    -- No se escribe nada todavía: el webhook da el saldo en Stripe (con
    -- clave de idempotencia) y luego llama a referido_marcar_recompensa. Si
    -- Stripe falla, el evento se reintenta y se vuelve a llegar aquí.
    return jsonb_build_object('resultado', 'saldo', 'referidor_customer', v_customer);
  end if;
  update public.referidos set estado = 'pagado', pagado_en = now(), huella_tarjeta = p_huella where id = r.id;
  return jsonb_build_object('resultado', 'dias');
end;
$$;
revoke all on function public.referido_resolver_pago(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.referido_resolver_pago(uuid, text, boolean) to service_role;

-- Marca el premio como dado (una sola vez). p_referidor: si se pasa, el
-- premio tiene que ser de esa persona (los ids de días de prueba llegan en
-- el metadata del checkout y se comprueban contra quien pagó).
create or replace function public.referido_marcar_recompensa(p_id uuid, p_tipo text, p_ref text, p_referidor uuid default null, p_huella text default null)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_n int;
begin
  if p_tipo not in ('saldo_stripe', 'dias_prueba') then raise exception 'tipo de premio no válido'; end if;
  if p_huella is not null and p_huella !~ '^[0-9a-f]{64}$' then p_huella := null; end if;
  -- Días de prueba: el amigo ya estaba "pagado". Saldo en Stripe: se marca
  -- directamente desde "pendiente" (ver referido_resolver_pago).
  update public.referidos
  set estado = 'recompensado', recompensa_tipo = p_tipo, recompensa_en = now(), recompensa_ref = left(p_ref, 120),
      pagado_en = coalesce(pagado_en, now()), huella_tarjeta = coalesce(huella_tarjeta, p_huella)
  where id = p_id and recompensa_tipo is null
    and (estado = 'pagado' or (estado = 'pendiente' and p_tipo = 'saldo_stripe'))
    and (p_referidor is null or referidor_id = p_referidor);
  get diagnostics v_n = row_count;
  return v_n = 1;
end;
$$;
revoke all on function public.referido_marcar_recompensa(uuid, text, text, uuid, text) from public, anon, authenticated;
grant execute on function public.referido_marcar_recompensa(uuid, text, text, uuid, text) to service_role;

do $$
begin
  raise notice 'Captación 2/4: "Invita a un amigo" listo (referidos_activo = %).', public.referidos_activo();
end;
$$;
