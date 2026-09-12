-- Costa Viva — especies dadas de alta por la comunidad
--
-- La lista de especies del diario (ESPECIES en diario.html) es fija y
-- corta — cuando alguien pesca algo que no está y elige "Otra", escribe
-- el nombre a mano. Pedido explícito del usuario: esa especie debe
-- quedar disponible como opción real para todo el mundo a partir de la
-- siguiente vez que alguien abra el formulario, no perderse en el campo
-- de texto libre de esa única captura.
--
-- Público de lectura (cualquiera logueado ve la lista completa —
-- necesario para que el desplegable la muestre a todos) y de escritura
-- (cualquiera puede añadir una especie nueva) porque es exactamente el
-- mismo patrón de "enriquecer la lista entre todos" ya usado en
-- spots_usuario — el riesgo (alguien escribe un nombre raro) es
-- aceptado igual que ahí, no son datos personales de nadie.
create table if not exists public.especies_comunidad (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  nombre_cientifico text,
  creado_por uuid not null references auth.users (id) on delete cascade,
  creado_en timestamptz not null default now()
);

alter table public.especies_comunidad enable row level security;

create policy "cualquiera logueado ve la lista de especies"
  on public.especies_comunidad for select
  to authenticated
  using (true);

create policy "cualquiera logueado añade una especie nueva"
  on public.especies_comunidad for insert
  to authenticated
  with check (auth.uid() = creado_por);
