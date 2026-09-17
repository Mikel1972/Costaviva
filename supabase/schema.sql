-- Costaviva — acceso, alta abierta (auto-aprobada desde 2026-09-17)
--
-- Cómo usar: pega esto entero en el SQL Editor del proyecto de Supabase que
-- decidas usar (nuevo o uno ya existente) y dale a "Run". No depende de qué
-- proyecto elijas — es autocontenido y no toca ninguna tabla existente.
--
-- Qué hace:
--   1) Crea la tabla "perfiles" (una fila por usuario registrado)
--   2) Activa Row Level Security: cada usuario solo puede leer su propia fila
--   3) Crea un trigger: al registrarse alguien en Supabase Auth, se le crea
--      automáticamente su fila en "perfiles" con aprobado = true
--
-- "aprobado" ya NO es aprobación manual inicial (eso era el patrón de
-- Etxeapala, no aplica aquí — alta abierta) — solo sirve para que el admin
-- pause una cuenta después, desde admin.html (Table Editor > perfiles >
-- cambiar "aprobado" a false, o el botón "Pausar").

create table if not exists public.perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  aprobado boolean not null default true,
  creado_en timestamptz not null default now()
);

alter table public.perfiles enable row level security;

create policy "cada usuario ve su propio perfil"
  on public.perfiles for select
  using (auth.uid() = id);

create or replace function public.gestionar_alta_perfil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfiles (id, email, aprobado)
  values (new.id, new.email, true);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.gestionar_alta_perfil();
