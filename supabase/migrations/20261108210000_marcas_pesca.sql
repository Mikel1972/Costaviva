-- Costa Viva — marcas de pesca desde embarcación (2026-11-08, pedido de Mikel)
--
-- Desde un barco no hay un único punto de pesca: en una salida se pesca en
-- varios sitios y cada uno se guarda como una "marca" (como en las sondas y
-- plotters), con un nombre opcional (el pez que salió, el pico que hay...).
-- Solo el punto y el nombre: el recorrido del barco no interesa.
--
-- Dato privado de cada usuario: solo lo ve y lo toca su dueño (authenticated,
-- auth.uid() = user_id). anon no tiene nada. Se borra con la salida.

create table if not exists public.marcas_pesca (
  id uuid primary key default gen_random_uuid(),
  salida_id uuid not null references public.salidas_pesca (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nombre text check (nombre is null or char_length(nombre) <= 60),
  lat double precision not null check (lat between -90 and 90),
  lon double precision not null check (lon between -180 and 180),
  creado_en timestamptz not null default now()
);
create index if not exists marcas_pesca_salida_idx on public.marcas_pesca (salida_id);
create index if not exists marcas_pesca_user_idx on public.marcas_pesca (user_id);

alter table public.marcas_pesca enable row level security;
revoke all on public.marcas_pesca from anon, authenticated;
grant select, insert, update, delete on public.marcas_pesca to authenticated;

drop policy if exists "cada usuario ve solo sus marcas" on public.marcas_pesca;
create policy "cada usuario ve solo sus marcas"
  on public.marcas_pesca for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "cada usuario inserta solo sus marcas" on public.marcas_pesca;
create policy "cada usuario inserta solo sus marcas"
  on public.marcas_pesca for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.salidas_pesca s where s.id = salida_id and s.user_id = auth.uid())
  );

drop policy if exists "cada usuario actualiza solo sus marcas" on public.marcas_pesca;
create policy "cada usuario actualiza solo sus marcas"
  on public.marcas_pesca for update to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.salidas_pesca s where s.id = salida_id and s.user_id = auth.uid())
  );

drop policy if exists "cada usuario borra solo sus marcas" on public.marcas_pesca;
create policy "cada usuario borra solo sus marcas"
  on public.marcas_pesca for delete to authenticated
  using (auth.uid() = user_id);

comment on table public.marcas_pesca is 'Marcas de pesca de una salida en embarcación: punto (lat, lon) y nombre opcional, como las marcas de una sonda/plotter. Privadas de cada usuario. 2026-11-08.';
