-- Costa Viva — histórico anónimo de grupos borrados
--
-- Pedido explícito del usuario: cuando un grupo se borra (eliminar_grupo(),
-- migración anterior), la app debe quedarse con un rastro interno anónimo
-- para análisis propio — nunca visible a usuarios, nunca con datos que
-- identifiquen a nadie (sin user_id, sin nombre del grupo, sin contenido).
-- Solo estadísticas de uso: cuándo se creó, cuándo se borró, y el número
-- máximo de miembros que llegó a tener.

-- miembros_grupo solo refleja la membresía ACTUAL (las filas se borran al
-- salir), así que "cuántos llegó a tener" necesita su propio contador que
-- nunca baja — se guarda en la propia fila de grupos y se actualiza cada
-- vez que entra alguien nuevo.
alter table public.grupos add column if not exists max_miembros_alcanzado int not null default 1;

create or replace function public.actualizar_max_miembros_grupo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
v_actual int;
begin
select count(*) into v_actual from public.miembros_grupo where grupo_id = new.grupo_id;
update public.grupos set max_miembros_alcanzado = greatest(max_miembros_alcanzado, v_actual) where id = new.grupo_id;
return new;
end;
$$;

drop trigger if exists trg_actualizar_max_miembros on public.miembros_grupo;
create trigger trg_actualizar_max_miembros
after insert on public.miembros_grupo
for each row execute function public.actualizar_max_miembros_grupo();

-- Tabla de histórico: sin política de select/insert/update/delete para
-- authenticated/anon -> nadie del cliente puede leer ni escribir aquí
-- directamente. Solo eliminar_grupo() (security definer, corre como
-- dueño de la tabla) escribe, y admin_listar_grupos_historico() (más
-- abajo) lee, ambas saltándose RLS a propósito, mismo patrón que el
-- panel de administrador.
create table if not exists public.grupos_historico (
id uuid primary key default gen_random_uuid(),
grupo_id_original uuid not null,
creado_en timestamptz not null,
borrado_en timestamptz not null default now(),
max_miembros_alcanzado int not null
);
alter table public.grupos_historico enable row level security;

create or replace function public.admin_listar_grupos_historico()
returns setof public.grupos_historico
language sql
security definer
set search_path = public
stable
as $$
select * from public.grupos_historico where public.es_admin() order by borrado_en desc;
$$;
grant execute on function public.admin_listar_grupos_historico() to authenticated;

-- eliminar_grupo() ampliada: guarda el rastro anónimo justo antes de
-- borrar la fila de grupos. Mismas reglas de seguridad de siempre (0 o 1
-- miembros, y si es 1 debe ser quien llama).
create or replace function public.eliminar_grupo(p_grupo_id uuid) returns void language plpgsql security definer set search_path = public as $$
declare
v_num_miembros int;
v_creado_en timestamptz;
v_max_miembros int;
begin
select count(*) into v_num_miembros from public.miembros_grupo where grupo_id = p_grupo_id;
if v_num_miembros > 1 then
raise exception 'No se puede borrar un grupo con mas de un miembro';
end if;
if v_num_miembros = 1 and not es_miembro_de(p_grupo_id) then
raise exception 'Solo un miembro del grupo puede borrarlo';
end if;
select creado_en, max_miembros_alcanzado into v_creado_en, v_max_miembros from public.grupos where id = p_grupo_id;
insert into public.grupos_historico (grupo_id_original, creado_en, max_miembros_alcanzado) values (p_grupo_id, v_creado_en, v_max_miembros);
delete from public.grupos where id = p_grupo_id;
end;
$$;
grant execute on function public.eliminar_grupo(uuid) to authenticated;
