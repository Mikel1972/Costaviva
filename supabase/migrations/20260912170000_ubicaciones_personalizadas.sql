-- Costa Viva — ubicaciones personalizadas (Fase 2 del plan de mejoras)
--
-- Hoy el mapa y el diario solo ofrecen la lista fija de ~90 spots
-- (duplicada a mano en index.html, diario.html y functions/prevision.js).
-- Esta migración añade la posibilidad de que cualquier usuario marque un
-- punto nuevo en el mapa (o use su GPS), con el nombre resuelto siempre
-- por geocodificación inversa (nunca texto libre, ver
-- functions/geocodificar.js) y visibilidad privada o pública a su
-- elección. La visibilidad "compartida con mi grupo" (Fase 5, grupos
-- privados) se añadirá más adelante vía funciones RPC aparte — esta
-- tabla y su RLS no se tocan para eso.

create table if not exists public.spots_usuario (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  nombre text not null,
  pais text,
  ccaa text,
  lat double precision not null,
  lon double precision not null,
  publica boolean not null default false,
  creado_en timestamptz not null default now()
);

alter table public.spots_usuario enable row level security;

create policy "ver mis ubicaciones o las públicas"
  on public.spots_usuario for select
  using (auth.uid() = user_id or publica = true);

create policy "crear solo mis ubicaciones"
  on public.spots_usuario for insert
  with check (auth.uid() = user_id);

create policy "editar solo mis ubicaciones"
  on public.spots_usuario for update
  using (auth.uid() = user_id);

create policy "borrar solo mis ubicaciones"
  on public.spots_usuario for delete
  using (auth.uid() = user_id);

-- Favoritos: funciona igual para un spot fijo (spot_slug, de la lista
-- estática) que para uno personalizado (spot_usuario_id) — exactamente
-- uno de los dos debe estar puesto, nunca los dos ni ninguno.
create table if not exists public.spots_favoritos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  spot_slug text,
  spot_usuario_id uuid references public.spots_usuario (id) on delete cascade,
  creado_en timestamptz not null default now(),
  constraint spots_favoritos_un_solo_tipo check (
    (spot_slug is not null and spot_usuario_id is null) or
    (spot_slug is null and spot_usuario_id is not null)
  )
);

-- Un unique normal no sirve aquí: en SQL estándar NULL nunca es igual a
-- NULL a efectos de unicidad, así que "unique (user_id, spot_slug,
-- spot_usuario_id)" no evitaría duplicados (spot_slug es NULL en todas
-- las filas de un spot personalizado, y viceversa). Dos índices únicos
-- parciales, uno por tipo, sí lo evitan.
create unique index if not exists spots_favoritos_unico_fijo
  on public.spots_favoritos (user_id, spot_slug) where spot_slug is not null;
create unique index if not exists spots_favoritos_unico_personalizado
  on public.spots_favoritos (user_id, spot_usuario_id) where spot_usuario_id is not null;

alter table public.spots_favoritos enable row level security;

create policy "cada usuario ve solo sus favoritos"
  on public.spots_favoritos for select
  using (auth.uid() = user_id);

create policy "cada usuario marca solo sus favoritos"
  on public.spots_favoritos for insert
  with check (auth.uid() = user_id);

create policy "cada usuario borra solo sus favoritos"
  on public.spots_favoritos for delete
  using (auth.uid() = user_id);
