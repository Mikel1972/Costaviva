-- Fin de la prueba: o se suscribe o se cancela la cuenta (pedido explicito
-- del usuario, 2026-09-28): "hay un periodo de prueba de 7 dias sin cobrar.
-- A ese vencimiento, o se da de alta o se le cancela". Y despues, una semana
-- mas hasta borrar la cuenta con todos sus datos.
--
-- Calendario, contado desde el ALTA (perfiles.creado_en, la misma referencia
-- que usa mi_estado_suscripcion() para la prueba):
--   alta    email de bienvenida: la prueba acaba el dia 7, que pasa despues
--   dia 5   recordatorio: "tu prueba acaba el dia 7"
--   dia 7   fin de prueba sin suscripcion -> cuenta cancelada: login
--           bloqueado (auth.users.banned_until) y sesiones cerradas. Los
--           datos siguen ahi una semana mas.
--   dia 14  borrar: delete de auth.users, cascada a todas sus tablas. Las
--           fotos del bucket las borra antes el endpoint (Storage API).
--
-- La fecha de cancelacion que se le PROMETE en el recordatorio se guarda
-- (desactivar_previsto_en) y es la que manda: nunca se cancela antes de lo
-- que dijo el email. Es el dia 7, salvo que el recordatorio saliera tarde
-- (fallo de Resend, o usuarios de antes de este cambio con la prueba ya
-- vencida): entonces se le dan al menos 2 dias desde el recordatorio.
--
-- Mismo patron que 20260925180000: la lista de a quien le toca cada paso la
-- decide Postgres, nunca el endpoint (functions/avisar-fin-prueba.js). Todas
-- las funciones son security definer con grant SOLO a service_role.
--
-- QUIEN NUNCA ENTRA EN ESTE CICLO (fin_prueba_fuera_de_ciclo):
--   - El admin.
--   - Los alias de prueba etxebe2005+...@gmail.com: son las cuentas de
--     smoke-test.yml y auth-test.yml. Cancelarlas romperia esos workflows.
--   - Quien haya tenido alguna vez una suscripcion de verdad (cualquier fila
--     en suscripciones salvo incomplete/incomplete_expired, checkouts que
--     nunca cobraron). Decision del usuario: el ex-suscriptor que cancela
--     solo pierde el acceso (lo hace ya el paywall), ni se cancela ni se
--     borra su cuenta.
-- Y quien nunca confirmo su email: no se le puede avisar, asi que tampoco se
-- le cancela.
--
-- REACTIVAR A MANO: si el admin quita el bloqueo desde el dashboard de
-- Supabase (Authentication -> Users -> Unban), banned_until deja de estar en
-- el futuro y el borrado ya no le toca (se comprueba el bloqueo REAL). Tampoco
-- se le vuelve a cancelar: desactivado_en sigue relleno.
--
-- Sustituye al aviso de fin de prueba de 20260925180000 (que avisaba DESPUES
-- de vencer): ahora el aviso es previo y el fin de prueba es la cancelacion.
-- La columna fin_prueba_avisado se queda, sin uso, por historico.

alter table public.perfiles
  add column if not exists bienvenida_email_en timestamptz,
  add column if not exists fin_prueba_recordatorio_en timestamptz,
  add column if not exists desactivar_previsto_en timestamptz,
  add column if not exists desactivado_en timestamptz;

comment on column public.perfiles.bienvenida_email_en is
  'Cuándo se le mandó el email de bienvenida con las fechas de la prueba. Los perfiles anteriores al 2026-09-28 lo tienen relleno sin haberlo recibido.';
comment on column public.perfiles.fin_prueba_recordatorio_en is
  'Cuándo se le mandó el recordatorio de que su prueba termina (día 5).';
comment on column public.perfiles.desactivar_previsto_en is
  'Fecha de cancelación prometida en el recordatorio. Nunca se cancela antes.';
comment on column public.perfiles.desactivado_en is
  'Cuándo se canceló su cuenta por no suscribirse al terminar la prueba. El borrado llega 7 días después si sigue bloqueada.';

-- Los perfiles que ya existen no reciben el email de bienvenida: ya llevan
-- tiempo en la app. Mismo criterio que bienvenida_pendiente (20260917110508).
update public.perfiles set bienvenida_email_en = now() where bienvenida_email_en is null;

-- El aviso de despues del vencimiento deja de existir.
drop function if exists public.usuarios_fin_prueba_pendiente_aviso();
drop function if exists public.marcar_fin_prueba_avisado(uuid);

-- Excepciones del ciclo, en un solo sitio para que todas las listas y el
-- borrado apliquen exactamente las mismas.
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
        and (u.email = 'etxebe2005@gmail.com' or u.email like 'etxebe2005+%')
    )
    or exists (
      select 1 from public.suscripciones s
      where s.user_id = p_user_id
        and coalesce(s.estado, '') not in ('', 'incomplete', 'incomplete_expired')
    );
$$;
revoke all on function public.fin_prueba_fuera_de_ciclo(uuid) from public, authenticated, anon;
grant execute on function public.fin_prueba_fuera_de_ciclo(uuid) to service_role;

-- Bienvenida. Solo mientras quede margen (antes del dia 5): si alguien
-- confirma el email tarde, el recordatorio ya le cuenta lo mismo.
create or replace function public.usuarios_bienvenida_pendiente_email()
returns table (user_id uuid, email text, prueba_termina_en timestamptz, borrar_en timestamptz)
language sql
security definer
set search_path = public
as $$
  select p.id, u.email::text,
         p.creado_en + interval '7 days',
         p.creado_en + interval '14 days'
  from public.perfiles p
  join auth.users u on u.id = p.id
  where p.bienvenida_email_en is null
    and u.email_confirmed_at is not null
    and p.creado_en + interval '5 days' > now()
    and not public.fin_prueba_fuera_de_ciclo(p.id);
$$;
revoke all on function public.usuarios_bienvenida_pendiente_email() from public, authenticated, anon;
grant execute on function public.usuarios_bienvenida_pendiente_email() to service_role;

create or replace function public.marcar_bienvenida_email(p_user_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.perfiles set bienvenida_email_en = now()
  where id = p_user_id and bienvenida_email_en is null;
$$;
revoke all on function public.marcar_bienvenida_email(uuid) from public, authenticated, anon;
grant execute on function public.marcar_bienvenida_email(uuid) to service_role;

-- Recordatorio (dia 5). Las fechas que devuelve son las que se escriben en el
-- email y las que marcar_fin_prueba_recordatorio() guarda: la misma formula
-- en los dos sitios.
create or replace function public.usuarios_fin_prueba_pendiente_recordatorio()
returns table (user_id uuid, email text, desactivar_en timestamptz, borrar_en timestamptz)
language sql
security definer
set search_path = public
as $$
  select p.id, u.email::text,
         greatest(p.creado_en + interval '7 days', now() + interval '2 days'),
         greatest(p.creado_en + interval '7 days', now() + interval '2 days') + interval '7 days'
  from public.perfiles p
  join auth.users u on u.id = p.id
  where p.fin_prueba_recordatorio_en is null
    and p.desactivado_en is null
    and p.creado_en + interval '5 days' < now()
    and u.email_confirmed_at is not null
    and not public.fin_prueba_fuera_de_ciclo(p.id)
    and not exists (
      select 1 from public.suscripciones s
      where s.user_id = p.id and s.estado in ('trialing', 'active')
    );
$$;
revoke all on function public.usuarios_fin_prueba_pendiente_recordatorio() from public, authenticated, anon;
grant execute on function public.usuarios_fin_prueba_pendiente_recordatorio() to service_role;

-- Se marca SOLO despues de que Resend confirme el envio: si el correo falla,
-- no hay fecha prometida y la cuenta no se cancela.
create or replace function public.marcar_fin_prueba_recordatorio(p_user_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.perfiles
  set fin_prueba_recordatorio_en = now(),
      desactivar_previsto_en = greatest(creado_en + interval '7 days', now() + interval '2 days')
  where id = p_user_id and fin_prueba_recordatorio_en is null;
$$;
revoke all on function public.marcar_fin_prueba_recordatorio(uuid) from public, authenticated, anon;
grant execute on function public.marcar_fin_prueba_recordatorio(uuid) to service_role;

-- Cancelacion (dia 7, o la fecha prometida si fue mas tarde).
create or replace function public.usuarios_fin_prueba_pendiente_desactivar()
returns table (user_id uuid, email text, borrar_en timestamptz)
language sql
security definer
set search_path = public
as $$
  select p.id, u.email::text, now() + interval '7 days'
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

-- Cancelar = bloquear el login y cerrar las sesiones abiertas. Se hace en SQL
-- (como admin_eliminar_usuario) y no con la Admin API: asi el bloqueo y la
-- marca van en la misma transaccion. Vuelve a comprobar las condiciones
-- dentro: si entre la lista y esta llamada la persona se suscribio, no se toca.
create or replace function public.desactivar_usuario_fin_prueba(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.usuarios_fin_prueba_pendiente_desactivar() c
    where c.user_id = p_user_id
  ) then
    return false;
  end if;
  -- 100 anos y no 'infinity': GoTrue lee esta columna como un time.Time de
  -- Go, que no sabe representar infinity. Es lo mismo que hace la Admin API
  -- con ban_duration = '876000h'.
  update auth.users set banned_until = now() + interval '100 years' where id = p_user_id;
  delete from auth.sessions where user_id = p_user_id;
  update public.perfiles set desactivado_en = now() where id = p_user_id;
  return true;
end;
$$;
revoke all on function public.desactivar_usuario_fin_prueba(uuid) from public, authenticated, anon;
grant execute on function public.desactivar_usuario_fin_prueba(uuid) to service_role;

-- Borrado (7 dias tras cancelar). Solo si SIGUE bloqueado de verdad (ver
-- "reactivar a mano" arriba).
create or replace function public.usuarios_fin_prueba_pendiente_borrar()
returns table (user_id uuid, email text)
language sql
security definer
set search_path = public
as $$
  select p.id, u.email::text
  from public.perfiles p
  join auth.users u on u.id = p.id
  where p.desactivado_en is not null
    and p.desactivado_en + interval '7 days' < now()
    and u.banned_until is not null
    and u.banned_until > now()
    and not public.fin_prueba_fuera_de_ciclo(p.id)
    and not exists (
      select 1 from public.suscripciones s
      where s.user_id = p.id and s.estado in ('trialing', 'active')
    );
$$;
revoke all on function public.usuarios_fin_prueba_pendiente_borrar() from public, authenticated, anon;
grant execute on function public.usuarios_fin_prueba_pendiente_borrar() to service_role;

-- Borrar. IRREVERSIBLE. Vuelve a comprobar las condiciones dentro.
--
-- La cascada de auth.users se lleva cosas que NO son solo suyas, y eso se
-- arregla antes del delete:
--   - grupos.creado_por: borrar al creador borraria el grupo ENTERO para el
--     resto de miembros. Si quedan otros miembros, el grupo pasa al miembro
--     mas antiguo. Si no queda nadie mas, se borra y queda el rastro anonimo
--     en grupos_historico, igual que eliminar_grupo().
--   - especies_comunidad.creado_por: la lista de especies es de todos. Pasan
--     al admin en vez de desaparecer. Si no se encuentra al admin, se aborta
--     el borrado entero antes que perder especies.
-- Las fotos del bucket capturas-fotos NO se pueden borrar desde SQL: las
-- borra avisar-fin-prueba.js con la Storage API justo antes de llamar a esto.
create or replace function public.borrar_usuario_fin_prueba(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid;
begin
  if not exists (
    select 1 from public.usuarios_fin_prueba_pendiente_borrar() c
    where c.user_id = p_user_id
  ) then
    return false;
  end if;

  select id into v_admin from auth.users where email = 'etxebe2005@gmail.com';
  if v_admin is null then
    raise exception 'no se encuentra la cuenta admin para heredar especies_comunidad';
  end if;

  update public.grupos g
  set creado_por = (
    select m.user_id from public.miembros_grupo m
    where m.grupo_id = g.id and m.user_id <> p_user_id
    order by m.unido_en
    limit 1
  )
  where g.creado_por = p_user_id
    and exists (
      select 1 from public.miembros_grupo m
      where m.grupo_id = g.id and m.user_id <> p_user_id
    );

  insert into public.grupos_historico (grupo_id_original, creado_en, max_miembros_alcanzado)
  select g.id, g.creado_en, g.max_miembros_alcanzado
  from public.grupos g
  where g.creado_por = p_user_id;

  update public.especies_comunidad set creado_por = v_admin where creado_por = p_user_id;

  delete from auth.users where id = p_user_id;
  return true;
end;
$$;
revoke all on function public.borrar_usuario_fin_prueba(uuid) from public, authenticated, anon;
grant execute on function public.borrar_usuario_fin_prueba(uuid) to service_role;

-- Cuantas personas de ANTES de este cambio (prueba ya vencida, sin
-- suscripcion) entran en el ciclo: recibiran el recordatorio en la primera
-- pasada y se les cancelara la cuenta 2 dias despues. Sale en el log de
-- "Aplicar migraciones" para saberlo antes de que el cron escriba a nadie.
-- Si pasa de 10, la guarda de volumen del endpoint frena el recordatorio y
-- avisa al admin.
do $$
declare
  v_afectados integer;
begin
  select count(*) into v_afectados
  from public.usuarios_fin_prueba_pendiente_recordatorio();
  raise notice 'Usuarios que recibiran ya el recordatorio de fin de prueba: %', v_afectados;
end $$;
