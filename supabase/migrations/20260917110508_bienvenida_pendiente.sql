-- Costaviva — popup de bienvenida, marcado por servidor (no localStorage)
--
-- Bug real encontrado en preview el 2026-09-17: el popup dependía de una
-- marca en localStorage puesta en el paso 1 del alta — si el email de
-- verificación se abre en otro navegador/dispositivo (típico: registro
-- en el móvil pero el enlace se abre dentro del propio visor de la app
-- de correo, con su propio almacenamiento aislado), la marca no está
-- disponible y el popup nunca sale, aunque el resto del alta funcione
-- bien (eso va por el servidor). Se sustituye por una columna en
-- perfiles — funciona en cualquier dispositivo/navegador.

alter table public.perfiles
  add column if not exists bienvenida_pendiente boolean not null default true;

-- Los perfiles que ya existían antes de este cambio no deben ver el
-- popup de "bienvenido, 7 días de prueba" — ya llevan tiempo usando la
-- app.
update public.perfiles set bienvenida_pendiente = false where bienvenida_pendiente = true;

create or replace function public.gestionar_alta_perfil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfiles (id, email, aprobado, consiente_uso_datos_capturas, codigo_postal, bienvenida_pendiente)
  values (
    new.id,
    new.email,
    true,
    coalesce((new.raw_user_meta_data ->> 'consiente_uso_datos_capturas')::boolean, false),
    new.raw_user_meta_data ->> 'codigo_postal',
    true
  );
  return new;
end;
$$;

-- El usuario no tiene permiso de UPDATE sobre perfiles (a propósito,
-- para que nadie pueda auto-aprobarse) — esta función security definer
-- solo permite apagar esta marca concreta, nada más.
create or replace function public.marcar_bienvenida_vista()
returns void
language sql
security definer
set search_path = public
as $$
  update public.perfiles set bienvenida_pendiente = false where id = auth.uid();
$$;
grant execute on function public.marcar_bienvenida_vista() to authenticated;
