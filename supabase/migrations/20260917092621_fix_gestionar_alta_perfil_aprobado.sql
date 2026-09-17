-- Costaviva — arregla la funcion de alta de verdad
--
-- Bug encontrado en real el 2026-09-17: la migracion
-- 20260917080000_alta_autoaprobada.sql arreglo handle_new_user(), pero
-- el trigger on_auth_user_created de verdad en produccion llama a OTRA
-- funcion, gestionar_alta_perfil() (definida en
-- schema_diario_alarma.sql, con la logica de
-- consiente_uso_datos_capturas) — esa seguia insertando aprobado=false
-- en cada alta nueva. handle_new_user() no esta enganchada a ningun
-- trigger, es codigo huerfano. Confirmado con una alta de prueba real:
-- la cuenta quedo bloqueada al segundo login pese a la migracion
-- anterior.

create or replace function public.gestionar_alta_perfil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfiles (id, email, aprobado, consiente_uso_datos_capturas)
  values (
    new.id,
    new.email,
    true,
    coalesce((new.raw_user_meta_data ->> 'consiente_uso_datos_capturas')::boolean, false)
  );
  return new;
end;
$$;

-- Corrige tambien cualquier alta real que haya caido en el bug entre
-- el merge de la migracion anterior (2026-09-17 ~08:13 UTC) y este
-- arreglo.
update public.perfiles set aprobado = true where aprobado = false;
