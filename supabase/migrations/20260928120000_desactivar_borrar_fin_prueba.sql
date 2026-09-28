-- Ciclo completo tras el fin de la prueba: aviso -> recordatorio ->
-- desactivar -> borrar (pedido explicito del usuario, 2026-09-28: "si no lo
-- hacen debemos eliminar su perfil y desactivarlo"). Decisiones del usuario:
-- desactivar primero y borrar despues, con un recordatorio antes. El
-- calendario va en semanas, al mismo ritmo que la prueba de 7 dias: una
-- semana hasta desactivar y otra hasta borrar.
--
-- Calendario, contado desde el email de fin de prueba (fin_prueba_avisado_en):
--   dia 0   aviso de fin de prueba (ya existia, ahora lleva las fechas)
--   dia 5   recordatorio: "el dia 7 se desactiva tu cuenta"
--   dia 7   desactivar: login bloqueado (auth.users.banned_until) y sesiones
--           cerradas. Los datos siguen ahi.
--   dia 14  borrar: delete de auth.users, cascada a todas sus tablas. Las
--           fotos del bucket las borra antes el endpoint (Storage API).
--
-- Mismo patron que 20260925180000: la lista de a quien le toca cada paso la
-- decide Postgres, nunca el endpoint. Todas las funciones son security
-- definer con grant SOLO a service_role.
--
-- QUIEN NUNCA ENTRA EN ESTE CICLO (fin_prueba_fuera_de_ciclo):
--   - El admin.
--   - Los alias de prueba etxebe2005+...@gmail.com: son las cuentas de
--     smoke-test.yml y auth-test.yml. Desactivarlas romperia esos dos
--     workflows cada mes.
--   - Quien haya tenido alguna vez una suscripcion de verdad (cualquier fila
--     en suscripciones salvo incomplete/incomplete_expired, que son checkouts
--     que nunca llegaron a cobrar). Sin esto, un suscriptor que cancela meses
--     despues quedaria desactivado al instante, porque su aviso de fin de
--     prueba es de hace mucho. La baja de un suscriptor es otra politica y no
--     se decide aqui.
--
-- PERDON MANUAL: si el admin quita el bloqueo desde el dashboard de Supabase
-- (Authentication -> Users -> Unban), banned_until deja de estar en el
-- futuro y el borrado ya no le toca (se comprueba el bloqueo REAL, no solo
-- desactivado_en). Tampoco se le vuelve a desactivar: desactivado_en sigue
-- relleno.

alter table public.perfiles
  add column if not exists fin_prueba_avisado_en timestamptz,
  add column if not exists fin_prueba_recordatorio_en timestamptz,
  add column if not exists desactivado_en timestamptz;

comment on column public.perfiles.fin_prueba_avisado_en is
  'Cuándo se le mandó el email de fin de prueba. Arranca el calendario de desactivación (día 7) y borrado (día 14).';
comment on column public.perfiles.fin_prueba_recordatorio_en is
  'Cuándo se le mandó el recordatorio previo a la desactivación (día 5).';
comment on column public.perfiles.desactivado_en is
  'Cuándo se bloqueó su acceso por no suscribirse tras la prueba. El borrado llega 7 días después si sigue bloqueado.';

-- Excepciones del ciclo, en un solo sitio para que las tres listas y el
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

-- El aviso inicial: mismas condiciones que antes, mas las excepciones del
-- ciclo (antes solo excluia al admin; los alias de prueba se libraban solo
-- por el grandfathering de la columna).
create or replace function public.usuarios_fin_prueba_pendiente_aviso()
returns table (user_id uuid, email text, prueba_termino_en timestamptz)
language sql
security definer
set search_path = public
as $$
  select p.id, u.email::text, p.creado_en + interval '7 days'
  from public.perfiles p
  join auth.users u on u.id = p.id
  where p.fin_prueba_avisado = false
    and p.creado_en + interval '7 days' < now()
    and u.email_confirmed_at is not null
    and not public.fin_prueba_fuera_de_ciclo(p.id)
    and not exists (
      select 1 from public.suscripciones s
      where s.user_id = p.id and s.estado in ('trialing', 'active')
    );
$$;
revoke all on function public.usuarios_fin_prueba_pendiente_aviso() from public, authenticated, anon;
grant execute on function public.usuarios_fin_prueba_pendiente_aviso() to service_role;

-- Marcar el aviso ahora guarda tambien CUANDO, que es lo que arranca el
-- calendario. Firma igual que antes: avisar-fin-prueba.js no cambia la llamada.
create or replace function public.marcar_fin_prueba_avisado(p_user_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.perfiles
  set fin_prueba_avisado = true,
      fin_prueba_avisado_en = coalesce(fin_prueba_avisado_en, now())
  where id = p_user_id;
$$;
revoke all on function public.marcar_fin_prueba_avisado(uuid) from public, authenticated, anon;
grant execute on function public.marcar_fin_prueba_avisado(uuid) to service_role;

-- Recordatorio (dia 5). Exige que el aviso inicial se mandara de verdad.
create or replace function public.usuarios_fin_prueba_pendiente_recordatorio()
returns table (user_id uuid, email text, desactivar_en timestamptz, borrar_en timestamptz)
language sql
security definer
set search_path = public
as $$
  select p.id, u.email::text,
         p.fin_prueba_avisado_en + interval '7 days',
         p.fin_prueba_avisado_en + interval '14 days'
  from public.perfiles p
  join auth.users u on u.id = p.id
  where p.fin_prueba_avisado_en is not null
    and p.fin_prueba_recordatorio_en is null
    and p.desactivado_en is null
    and p.fin_prueba_avisado_en + interval '5 days' < now()
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
  update public.perfiles set fin_prueba_recordatorio_en = now()
  where id = p_user_id and fin_prueba_recordatorio_en is null;
$$;
revoke all on function public.marcar_fin_prueba_recordatorio(uuid) from public, authenticated, anon;
grant execute on function public.marcar_fin_prueba_recordatorio(uuid) to service_role;

-- Desactivacion (dia 7). Exige que el recordatorio se mandara: si Resend
-- fallo con esta persona, se queda esperando en vez de desactivarla sin
-- haberle avisado. Y al menos 2 dias desde el recordatorio, para que un
-- recordatorio enviado con retraso no deje un margen de horas.
create or replace function public.usuarios_fin_prueba_pendiente_desactivar()
returns table (user_id uuid, email text, borrar_en timestamptz)
language sql
security definer
set search_path = public
as $$
  select p.id, u.email::text, now() + interval '7 days'
  from public.perfiles p
  join auth.users u on u.id = p.id
  where p.fin_prueba_avisado_en is not null
    and p.fin_prueba_recordatorio_en is not null
    and p.desactivado_en is null
    and p.fin_prueba_avisado_en + interval '7 days' < now()
    and p.fin_prueba_recordatorio_en + interval '2 days' < now()
    and not public.fin_prueba_fuera_de_ciclo(p.id)
    and not exists (
      select 1 from public.suscripciones s
      where s.user_id = p.id and s.estado in ('trialing', 'active')
    );
$$;
revoke all on function public.usuarios_fin_prueba_pendiente_desactivar() from public, authenticated, anon;
grant execute on function public.usuarios_fin_prueba_pendiente_desactivar() to service_role;

-- Desactivar = bloquear el login y cerrar las sesiones abiertas. Se hace en
-- SQL (como admin_eliminar_usuario) y no con la Admin API: asi el bloqueo y
-- la marca van en la misma transaccion y no puede quedar uno sin el otro.
-- Vuelve a comprobar las condiciones dentro: si entre la lista y esta
-- llamada la persona se suscribio, no se toca.
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

-- Borrado (dia 14 = 7 dias tras desactivar). Solo si SIGUE bloqueado de
-- verdad (ver "perdon manual" arriba).
create or replace function public.usuarios_fin_prueba_pendiente_borrar()
returns table (user_id uuid, email text)
language sql
security definer
set search_path = public
as $$
  select p.id, u.email::text
  from public.perfiles p
  join auth.users u on u.id = p.id
  where p.fin_prueba_avisado_en is not null
    and p.desactivado_en is not null
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

-- Quien ya recibio el aviso con el texto viejo ("tus datos siguen
-- guardados") no sabe que ahora su cuenta caduca. Se le vuelve a poner en
-- la cola del aviso para que reciba el nuevo, con las fechas, y su
-- calendario arranca desde ESE email, no desde el viejo. Son exactamente
-- quienes tienen fin_prueba_avisado = true sin fecha y cumplen las
-- condiciones del aviso: la migracion 20260925220000 ya dejo en true sin
-- avisar solo a quien no cumplia alguna (alias de prueba, sin confirmar,
-- con suscripcion).
do $$
declare
  v_afectados integer;
begin
  update public.perfiles p
  set fin_prueba_avisado = false
  where p.fin_prueba_avisado = true
    and p.fin_prueba_avisado_en is null
    and p.creado_en + interval '7 days' < now()
    and exists (
      select 1 from auth.users u
      where u.id = p.id and u.email_confirmed_at is not null
    )
    and not public.fin_prueba_fuera_de_ciclo(p.id)
    and not exists (
      select 1 from public.suscripciones s
      where s.user_id = p.id and s.estado in ('trialing', 'active')
    );
  get diagnostics v_afectados = row_count;
  raise notice 'Usuarios que recibiran de nuevo el aviso de fin de prueba, ya con fechas: %', v_afectados;
end $$;
