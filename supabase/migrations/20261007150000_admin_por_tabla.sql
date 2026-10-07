-- Costa Viva — es_admin() deja de depender de un email fijo en SQL
--
-- MOTIVO (Mikel1972/comun, estandares/auth.md A4; 2026-10-07): es_admin()
-- comparaba auth.email() con un email escrito en la función. Un email no es
-- una identidad estable (se puede cambiar desde Auth) y la regla quedaba en
-- el código en vez de en datos. Ahora el rol vive en public.administradores,
-- por user_id, en una tabla que ningún usuario puede leer ni editar (sin
-- policies, solo service_role y las funciones security definer).
--
-- Comportamiento: idéntico para la cuenta de Mikel (la migración la da de
-- alta buscando su user_id una sola vez). Si no la encuentra, la migración
-- FALLA y no cambia nada: nunca deja la app sin administrador.
-- es_admin() sigue sin devolver NULL (exists, A5).
--
-- AL APLICAR: actualizar supabase/baseline-seguridad.json con la tabla nueva
-- (RLS activado, sin policies) en el mismo paso, para que el vigía de esquema
-- no se ponga en rojo.

create table if not exists public.administradores (
  user_id uuid primary key references auth.users (id) on delete cascade,
  creado_en timestamptz not null default now()
);
alter table public.administradores enable row level security;
-- Sin policies a propósito: solo service_role y las funciones definer.
revoke all on public.administradores from anon, authenticated;
comment on table public.administradores is 'Cuentas con rol de administrador (es_admin()). Sin policies: solo service_role. Mikel1972/comun auth.md A4.';

-- Alta única de la cuenta del dueño (la misma que tenía es_admin()). El
-- email solo se usa aquí para encontrar su user_id; la regla ya no lo usa.
insert into public.administradores (user_id)
select u.id from auth.users u where lower(u.email) = lower('etxebe2005@gmail.com')
on conflict (user_id) do nothing;

do $$
begin
  if not exists (select 1 from public.administradores) then
    raise exception 'administradores vacía: no se encontró la cuenta del dueño; no se cambia es_admin()';
  end if;
end;
$$;

create or replace function public.es_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.administradores a where a.user_id = auth.uid());
$$;
