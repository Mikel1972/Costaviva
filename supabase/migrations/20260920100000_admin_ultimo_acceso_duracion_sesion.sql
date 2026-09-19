-- Costaviva — último acceso y duración de la última sesión, en el panel de admin
--
-- Pedido explícito del usuario (2026-09-20): tras preguntar si un
-- usuario concreto había vuelto a entrar/navegar por la web, se decidió
-- añadir esto al panel (admin.html) en vez de tener que ir cada vez al
-- SQL Editor de Supabase.
--
-- "Último acceso" = auth.users.last_sign_in_at (dato real de Supabase
-- Auth, no aproximado). Se añade a admin_listar_usuarios() con un LEFT
-- JOIN contra auth.users — el rol que ejecuta esta función ya tenía
-- permiso sobre el esquema auth desde antes (admin_eliminar_usuario ya
-- borra de auth.users directamente, ver
-- 20260913090000_panel_administrador.sql).
--
-- El tipo de retorno cambia (columna nueva), así que hace falta DROP +
-- CREATE en vez de CREATE OR REPLACE (Postgres no deja cambiar las
-- columnas de salida de una función con REPLACE).
drop function if exists public.admin_listar_usuarios();

create function public.admin_listar_usuarios()
returns table (id uuid, email text, aprobado boolean, creado_en timestamptz, nombre text, ultimo_acceso timestamptz)
language sql
security definer
set search_path = public
stable
as $$
  select p.id, p.email, p.aprobado, p.creado_en, p.nombre, u.last_sign_in_at
  from public.perfiles p
  left join auth.users u on u.id = p.id
  where public.es_admin()
  order by p.creado_en desc;
$$;
grant execute on function public.admin_listar_usuarios() to authenticated;

-- "Duración de la última sesión" — Supabase Auth no guarda esto (solo
-- el último login, no cuánto duró). Se aproxima agrupando eventos_uso
-- por huecos de más de 30 minutos entre eventos consecutivos (un hueco
-- así se cuenta como el fin de una visita y el principio de la
-- siguiente, heurística estándar de "duración de sesión" en analítica
-- web) — la duración de la última sesión es la diferencia entre el
-- primer y el último evento de ese grupo. LIMITACIÓN real, documentada
-- también en admin.html: eventos_uso existe desde el 2026-09-17, así
-- que no hay datos de sesión anteriores a esa fecha; y si la última
-- sesión de alguien tiene un solo evento registrado, la duración sale
-- en 0 (no significa "entró y salió al instante", significa "solo hay
-- un evento de esa visita para medir contra").
--
-- Se calcula para TODOS los usuarios de golpe (no una función por
-- usuario que el panel tendría que llamar una vez por fila) — mismo
-- criterio que admin_listar_usuarios/admin_resumen_eventos_uso.
create or replace function public.admin_ultima_sesion_usuarios()
returns table (user_id uuid, inicio timestamptz, fin timestamptz, duracion interval, eventos bigint)
language sql
security definer
set search_path = public
stable
as $$
  with eventos_con_hueco as (
    select
      e.user_id,
      e.creado_en,
      e.creado_en - lag(e.creado_en) over (partition by e.user_id order by e.creado_en) as hueco
    from public.eventos_uso e
    where public.es_admin()
  ),
  sesiones as (
    select
      user_id,
      creado_en,
      sum(case when hueco is null or hueco > interval '30 minutes' then 1 else 0 end)
        over (partition by user_id order by creado_en) as sesion_id
    from eventos_con_hueco
  ),
  ultima_sesion_por_usuario as (
    select user_id, max(sesion_id) as sesion_id
    from sesiones
    group by user_id
  )
  select s.user_id, min(s.creado_en), max(s.creado_en), max(s.creado_en) - min(s.creado_en), count(*)
  from sesiones s
  join ultima_sesion_por_usuario u on u.user_id = s.user_id and u.sesion_id = s.sesion_id
  group by s.user_id;
$$;
grant execute on function public.admin_ultima_sesion_usuarios() to authenticated;
