-- Costa Viva — sinónimos regionales de especies y cebos
--
-- Pedido explícito del usuario: enriquecer el sistema con las distintas
-- formas de llamar a un mismo pez/cebo según la zona (chipirón =
-- txipirón/txipi en Euskadi, lubina = róbalo en otras zonas, etc.),
-- investigado por el robot de datos ya existente (ver ROBOT_REGLAS.md,
-- sección "Sinónimos regionales de especies y cebos").
--
-- El robot solo PROPONE (inserta con verificado=false, nunca se marca a
-- sí mismo como verificado — mismo principio que la calibración de
-- oleaje: "el factor de corrección nunca se aplica en automático").
-- Verificación manual desde el Table Editor de Supabase, mismo patrón
-- que perfiles.aprobado.
create table if not exists public.sinonimos_especie (
  id uuid primary key default gen_random_uuid(),
  especie_canonica text not null,
  sinonimo text not null,
  region text,
  fuente text,
  verificado boolean not null default false,
  propuesto_en timestamptz not null default now()
);

alter table public.sinonimos_especie enable row level security;

create policy "lectura pública de sinónimos"
  on public.sinonimos_especie for select
  using (true);

-- El robot inserta con la anon key (sin sesión de usuario, es una
-- rutina automatizada) — solo puede proponer (verificado=false), nunca
-- insertar ya como verificado.
create policy "la anon key solo propone, nunca verifica"
  on public.sinonimos_especie for insert
  to anon
  with check (verificado = false);
