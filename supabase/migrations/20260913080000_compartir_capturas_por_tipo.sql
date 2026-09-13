-- Costa Viva — compartir capturas por tipo de salida dentro de un grupo
--
-- Pedido explícito del usuario (2026-09-13): "compartir capturas" en un
-- grupo era todo o nada — no se podía compartir solo las de costa y no
-- las de embarcación, por ejemplo. Aclarado también que cada checkbox
-- debe ser independiente POR GRUPO (miembros_grupo ya es por
-- (grupo_id, user_id), así que esto ya sale gratis: el mismo usuario
-- puede compartir "costa" en un grupo y "embarcación" en otro).
--
-- Tres columnas nuevas en vez de una lista/array: mismo estilo que las
-- tres ya existentes (compartir_ubicaciones/capturas/calendario), más
-- simple de leer y de armar en checkboxes que un tipo array.
--
-- Default TRUE a propósito: quien ya tenía compartir_capturas=true
-- estaba compartiendo TODO — con este cambio debe seguir compartiendo
-- todo por defecto (afinar a menos es una acción explícita suya, nunca
-- un recorte silencioso de lo que ya compartía).
alter table public.miembros_grupo
  add column if not exists compartir_capturas_costa boolean not null default true,
  add column if not exists compartir_capturas_embarcacion boolean not null default true,
  add column if not exists compartir_capturas_submarinismo boolean not null default true;

-- crear_grupo() sigue dando al creador todo activado por defecto (igual
-- que ya hacía con los tres booleanos originales) — se hace explícito
-- aquí en vez de depender solo del default de la columna, por claridad.
create or replace function public.crear_grupo(p_nombre text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.grupos (nombre, creado_por) values (p_nombre, auth.uid()) returning id into v_id;
  insert into public.miembros_grupo (
    grupo_id, user_id,
    compartir_ubicaciones, compartir_capturas, compartir_calendario,
    compartir_capturas_costa, compartir_capturas_embarcacion, compartir_capturas_submarinismo
  )
    values (v_id, auth.uid(), true, true, true, true, true, true);
  return v_id;
end;
$$;
grant execute on function public.crear_grupo(text) to authenticated;

-- obtener_capturas_grupo() ahora une con salidas_pesca para conocer el
-- tipo_salida de cada captura (capturas.salida_id -> salidas_pesca.id) y
-- exige, además de compartir_capturas, que el sub-tipo correspondiente
-- esté activado. tipo_salida puede ser NULL en filas antiguas (creadas
-- antes de que esa columna existiera, migración
-- 20260912152028_franja_horaria_tipo_salida.sql) — esas se tratan como
-- "costa" para este filtro, ya que costa era el único tipo posible antes
-- de que existiera la distinción.
create or replace function public.obtener_capturas_grupo(p_grupo_id uuid)
returns setof jsonb
language sql
security definer
set search_path = public
stable
as $$
  select to_jsonb(c.*) || jsonb_build_object('autor_nombre', coalesce(p.nombre, 'Miembro del grupo'))
  from public.capturas c
  join public.salidas_pesca s on s.id = c.salida_id
  join public.miembros_grupo mg on mg.user_id = c.user_id and mg.grupo_id = p_grupo_id and mg.compartir_capturas
  left join public.perfiles p on p.id = c.user_id
  where es_miembro_de(p_grupo_id)
    and (
      (coalesce(s.tipo_salida, 'costa') = 'costa' and mg.compartir_capturas_costa)
      or (s.tipo_salida = 'embarcacion' and mg.compartir_capturas_embarcacion)
      or (s.tipo_salida = 'submarinismo' and mg.compartir_capturas_submarinismo)
    );
$$;
grant execute on function public.obtener_capturas_grupo(uuid) to authenticated;
