-- Costa Viva — límite de 2 dispositivos por cuenta (2026-11-09, Mikel:
-- "¿cómo podemos asegurar que un usuario no pasa el usuario y la contraseña
-- a otros? Podría comprar uno y compartirlo entre 3 o 4"; "Ok" al límite).
--
-- Las sesiones las guarda Supabase Auth en auth.sessions (una por navegador
-- o app en la que se ha entrado). El cliente no puede leer el esquema auth,
-- así que dos funciones, SOLO para service_role, que usa
-- functions/dispositivos.js después de validar el token del usuario (D12):
--
--   sesiones_usuario(p_user)            sesiones de ESE usuario usadas en los
--                                       últimos 14 días: id, navegador
--                                       (user_agent), creada, última vez. Sin IP.
--   cerrar_sesion_usuario(p_user, p_sesion)
--                                       borra esa sesión si es de ese usuario.
--                                       Sus refresh tokens caen con ella (FK en
--                                       cascada de Supabase Auth): ese
--                                       dispositivo tendrá que volver a entrar.
--
-- Estándares (comun estandares/supabase.md): SECURITY DEFINER con
-- search_path vacío (D9) y sin EXECUTE para public, anon ni authenticated
-- (D10): solo service_role. No crea tablas ni toca policies.

create or replace function public.sesiones_usuario(p_user uuid)
returns table (id uuid, user_agent text, creada timestamptz, ultima timestamptz)
language sql
security definer
set search_path = ''
stable
as $$
  select s.id, s.user_agent, s.created_at,
         coalesce(s.refreshed_at, s.updated_at, s.created_at)
  from auth.sessions s
  where s.user_id = p_user
    and (s.not_after is null or s.not_after > now())
    and coalesce(s.refreshed_at, s.updated_at, s.created_at) > now() - interval '14 days'
  order by coalesce(s.refreshed_at, s.updated_at, s.created_at) desc;
$$;

create or replace function public.cerrar_sesion_usuario(p_user uuid, p_sesion uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  delete from auth.sessions where id = p_sesion and user_id = p_user;
  get diagnostics n = row_count;
  return n > 0;
end;
$$;

revoke all on function public.sesiones_usuario(uuid) from public, anon, authenticated;
revoke all on function public.cerrar_sesion_usuario(uuid, uuid) from public, anon, authenticated;
grant execute on function public.sesiones_usuario(uuid) to service_role;
grant execute on function public.cerrar_sesion_usuario(uuid, uuid) to service_role;

comment on function public.sesiones_usuario(uuid) is 'Sesiones de un usuario usadas en los últimos 14 días (sin IP). Solo service_role: functions/dispositivos.js tras validar el token. 2026-11-09.';
comment on function public.cerrar_sesion_usuario(uuid, uuid) is 'Cierra una sesión de un usuario (sus refresh tokens caen en cascada). Solo service_role: functions/dispositivos.js. 2026-11-09.';
