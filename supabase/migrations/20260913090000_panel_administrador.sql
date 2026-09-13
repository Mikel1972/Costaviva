-- Costa Viva — panel de administrador
--
-- Pedido explícito del usuario: un panel donde vea quién está inscrito,
-- pudiendo pausarlo o eliminarlo — "como en Pólizas.ai".
--
-- DECISIÓN DE DISEÑO: en vez de montar otro endpoint de Cloudflare con
-- service_role (que sería el segundo uso de esa clave en todo el
-- repo), esto se hace con 3 funciones `security definer` en Postgres,
-- cada una comprobando que quien llama es exactamente el email del
-- admin antes de hacer nada. Más simple, menos superficie nueva, y
-- sigue el mismo patrón ya usado para RLS recursivo
-- (es_miembro_de()) y para el conteo de SOS
-- (contar_alertas_sos_24h()).
--
-- ADMIN_EMAIL hardcodeado a propósito (app de un solo dueño, no hace
-- falta una tabla de roles para esto) — pedido explícito del usuario:
-- "solo mi cuenta (etxebe2005@gmail.com)".
create or replace function public.es_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select auth.email() = 'etxebe2005@gmail.com';
$$;

-- Lista todos los perfiles (RLS de "perfiles" solo deja ver la fila
-- propia — esto la salta a propósito, solo para el admin).
create or replace function public.admin_listar_usuarios()
returns table (id uuid, email text, aprobado boolean, creado_en timestamptz, nombre text)
language sql
security definer
set search_path = public
stable
as $$
  select p.id, p.email, p.aprobado, p.creado_en, p.nombre
  from public.perfiles p
  where public.es_admin()
  order by p.creado_en desc;
$$;
grant execute on function public.admin_listar_usuarios() to authenticated;

-- Pausar/reactivar reutiliza la columna "aprobado" que ya existe y ya
-- está probada (login.html bloquea el acceso si aprobado=false) — no
-- hace falta una columna "pausado" aparte, es el mismo estado real:
-- "esta cuenta no tiene acceso ahora mismo", venga de pendiente de
-- aprobar o de haber sido pausada después.
create or replace function public.admin_fijar_acceso(p_user_id uuid, p_aprobado boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.es_admin() then
    raise exception 'no autorizado';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'no puedes pausarte a ti mismo';
  end if;
  update public.perfiles set aprobado = p_aprobado where id = p_user_id;
end;
$$;
grant execute on function public.admin_fijar_acceso(uuid, boolean) to authenticated;

-- Elimina el usuario de auth.users directamente (sin pasar por la
-- Admin API de Supabase ni service_role) — el rol que ejecuta esta
-- función (postgres, dueño de la función) tiene permiso sobre el
-- esquema auth. Cascada automática: todas las tablas de usuario
-- (salidas_pesca, capturas, contactos_emergencia, alertas_sos,
-- spots_usuario, miembros_grupo, perfiles...) ya tienen
-- "references auth.users(id) on delete cascade", así que borrar aquí
-- se lleva todo lo suyo de un tirón. IRREVERSIBLE — confirmar en el
-- cliente antes de llamar a esto.
create or replace function public.admin_eliminar_usuario(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.es_admin() then
    raise exception 'no autorizado';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'no puedes eliminarte a ti mismo';
  end if;
  delete from auth.users where id = p_user_id;
end;
$$;
grant execute on function public.admin_eliminar_usuario(uuid) to authenticated;
