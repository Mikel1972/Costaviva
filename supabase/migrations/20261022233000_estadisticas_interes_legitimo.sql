-- Costaviva — estadísticas anónimas por interés legítimo, con oposición
-- (2026-10-22, hoja de condiciones del alta aprobada por Mikel).
--
-- Antes: casilla opcional del alta "Autorizo el uso anónimo de mis capturas"
-- -> perfiles.consiente_uso_datos_capturas (lo copia gestionar_alta_perfil()
-- desde el metadato del alta). Los triggers de estadísticas
-- (20260915140000) solo cuentan a quien lo tiene a true.
--
-- Ahora: las estadísticas anónimas van por interés legítimo (art. 6.1.f
-- RGPD), explicado en la hoja de condiciones del alta. login.html manda el
-- metadato a true en cada alta nueva (sin cambio de esquema ni del trigger),
-- y el usuario puede oponerse cuando quiera en suscripcion.html ("Tus
-- datos"), que llama a esta función. Oponerse pone la MISMA columna a false,
-- así que los triggers y el aprendizaje del índice dejan de contarle sin
-- tocar nada más.
--
-- El usuario no tiene UPDATE sobre perfiles salvo la columna nombre (a
-- propósito: que nadie se auto-apruebe, 20260913010000). Por eso, como
-- marcar_bienvenida_vista(), una función security definer que solo cambia
-- esta columna de su propia fila.
--
-- Sin tablas nuevas ni cambios de RLS/policies: baseline-seguridad.json no
-- se toca. EXECUTE solo para authenticated (D10 de comun): nunca anon.
-- NO cambia a los usuarios que ya existen (los que no marcaron la casilla
-- siguen a false): pasarlos a true es decisión de Mikel, aparte.

create or replace function public.fijar_uso_capturas_estadisticas(p_usar boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'sin sesión';
  end if;
  update public.perfiles
     set consiente_uso_datos_capturas = coalesce(p_usar, false)
   where id = auth.uid();
  return coalesce(p_usar, false);
end;
$$;

revoke execute on function public.fijar_uso_capturas_estadisticas(boolean) from public, anon;
grant execute on function public.fijar_uso_capturas_estadisticas(boolean) to authenticated;
