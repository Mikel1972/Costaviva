-- Costa Viva — eliminar_grupo(): error limpio para un grupo_id inexistente
--
-- Bug real encontrado el 2026-09-17 revisando el hallazgo del robot de
-- experiencia de usuario (2026-09-15, ver ROBOT.md): eliminar_grupo() no
-- distinguía "el grupo tiene 0 miembros" (caso normal, se borra) de "el
-- grupo_id ni siquiera existe" — en el segundo caso, el SELECT de
-- creado_en/max_miembros_alcanzado no encuentra fila y deja las
-- variables a NULL, y el INSERT posterior en grupos_historico revienta
-- con una violación NOT NULL fea (columna creado_en) en vez de un error
-- claro. No afecta al uso normal de grupos.html (el grupo_id siempre
-- sale de una fila real ya cargada), pero cualquier llamada con un id
-- inválido merece un mensaje de error legible, no un fallo de
-- restricción de base de datos.
create or replace function public.eliminar_grupo(p_grupo_id uuid) returns void language plpgsql security definer set search_path = public as $$
declare
v_num_miembros int;
v_creado_en timestamptz;
v_max_miembros int;
begin
select creado_en, max_miembros_alcanzado into v_creado_en, v_max_miembros from public.grupos where id = p_grupo_id;
if v_creado_en is null then
  raise exception 'Grupo no encontrado';
end if;

select count(*) into v_num_miembros from public.miembros_grupo where grupo_id = p_grupo_id;
if v_num_miembros > 1 then
raise exception 'No se puede borrar un grupo con mas de un miembro';
end if;
if v_num_miembros = 1 and not es_miembro_de(p_grupo_id) then
raise exception 'Solo un miembro del grupo puede borrarlo';
end if;
insert into public.grupos_historico (grupo_id_original, creado_en, max_miembros_alcanzado) values (p_grupo_id, v_creado_en, v_max_miembros);
delete from public.grupos where id = p_grupo_id;
end;
$$;
grant execute on function public.eliminar_grupo(uuid) to authenticated;
