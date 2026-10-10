-- Costaviva — código postal de Nueva Zelanda en el alta (fase 2 de NZ,
-- 2026-10-09).
--
-- El alta (login.html) pide el código postal y el trigger
-- gestionar_alta_perfil() lo copia a perfiles.codigo_postal. El CHECK solo
-- admitía 5 cifras (España): un alta desde NZ (4 cifras, p. ej. 1010 en
-- Auckland) fallaría entera al insertar el perfil. Se admiten 4 o 5 cifras;
-- login.html exige 4 en la región NZ y 5 en el resto, y /geocodificar
-- busca 4 cifras en New Zealand y 5 en Spain.
--
-- Sin cambios de datos: todo lo que ya hay tiene 5 cifras o es null.

alter table public.perfiles
  drop constraint if exists perfiles_codigo_postal_formato;

alter table public.perfiles
  add constraint perfiles_codigo_postal_formato
    check (codigo_postal is null or codigo_postal ~ '^[0-9]{4,5}$');
