-- Costaviva — codigo postal en el alta (nuevo flujo en 2 pasos)
--
-- Pedido explicito del usuario (2026-09-17): el alta pasa a ser en pasos
-- dentro de la misma caja de login.html: 1) email + codigo postal, 2)
-- verificar email (enlace magico, sin contrasena todavia), 3) al volver
-- del enlace, crear la contrasena (minimo 6, con mayuscula, numero y
-- simbolo). El codigo postal se usa luego para centrar el mapa de
-- index.html en esa zona la primera vez que entra (cambio aparte, en
-- index.html).
--
-- El alta ahora usa signInWithOtp() en vez de signUp() (no hay
-- contrasena en el paso 1) — el codigo postal viaja igual que
-- consiente_uso_datos_capturas, como metadato del propio alta
-- (raw_user_meta_data), y el trigger lo copia a la columna nueva.

alter table public.perfiles
  add column if not exists codigo_postal text,
  add constraint perfiles_codigo_postal_formato
    check (codigo_postal is null or codigo_postal ~ '^[0-9]{5}$');

create or replace function public.gestionar_alta_perfil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfiles (id, email, aprobado, consiente_uso_datos_capturas, codigo_postal)
  values (
    new.id,
    new.email,
    true,
    coalesce((new.raw_user_meta_data ->> 'consiente_uso_datos_capturas')::boolean, false),
    new.raw_user_meta_data ->> 'codigo_postal'
  );
  return new;
end;
$$;
