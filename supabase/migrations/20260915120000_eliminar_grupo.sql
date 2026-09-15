-- Costa Viva — eliminar_grupo() (Fase 5, complemento)
--
-- Hasta ahora no existía forma de borrar un grupo de verdad: "Salir del
-- grupo" en grupos.html solo borra la propia fila de miembros_grupo — la
-- fila de grupos en sí se queda huérfana para siempre, sin política de
-- delete. Esto se detectó al diseñar el smoke test diario multi-cuenta
-- (crear un grupo de prueba cada día sin poder limpiarlo del todo), pero
-- es una limitación real de la app para cualquier usuario, no solo para
-- pruebas — se corrige aquí como función real, usada tanto por el smoke
-- test como por grupos.html.
--
-- Seguridad: solo se puede borrar un grupo con 0 o 1 miembros, y si
-- queda 1 debe ser quien llama — así nadie puede borrar un grupo con
-- más gente dentro sin que esa gente haya salido antes. miembros_grupo e
-- invitaciones_grupo ya tienen "on delete cascade" hacia grupos.id, así
-- que basta con borrar la fila de grupos.
create or replace function public.eliminar_grupo(p_grupo_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_num_miembros int;
begin
  select count(*) into v_num_miembros from public.miembros_grupo where grupo_id = p_grupo_id;

  if v_num_miembros > 1 then
    raise exception 'No se puede borrar un grupo con más de un miembro — que salgan los demás primero';
  end if;

  if v_num_miembros = 1 and not es_miembro_de(p_grupo_id) then
    raise exception 'Solo un miembro del grupo puede borrarlo';
  end if;

  delete from public.grupos where id = p_grupo_id;
end;
$$;
grant execute on function public.eliminar_grupo(uuid) to authenticated;
