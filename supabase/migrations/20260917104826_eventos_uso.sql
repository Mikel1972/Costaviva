-- Costaviva — analitica de uso por evento
--
-- Pedido explicito del usuario (2026-09-17): entender que hace cada
-- usuario para (1) poder ofrecer mejor servicio y (2) rediseñar la app
-- en base a lo que de verdad se usa. Cloudflare Web Analytics no sirve
-- para esto (es agregado/anonimo, sin usuario) — se guarda cada evento
-- clave en una tabla propia, con su user_id.
--
-- "detalle" es jsonb libre para contexto extra segun el evento (ej. que
-- capa se activo, que spot, importe de checkout) — no forma parte del
-- analisis por defecto, solo esta disponible si hace falta profundizar.

create table if not exists public.eventos_uso (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  tipo text not null,
  detalle jsonb,
  creado_en timestamptz not null default now()
);

alter table public.eventos_uso enable row level security;

-- Cada usuario solo puede insertar sus propios eventos — nunca leerlos
-- (ni los suyos ni los de nadie): esto es analitica para el admin, no
-- un historial que el usuario deba poder consultar desde el cliente.
create policy "cada usuario registra solo sus propios eventos"
  on public.eventos_uso for insert
  with check (auth.uid() = user_id);

create index if not exists eventos_uso_tipo_idx on public.eventos_uso (tipo);
create index if not exists eventos_uso_user_id_idx on public.eventos_uso (user_id);

-- Resumen agregado (que tan popular es cada tipo de evento, cuanta
-- gente distinta lo ha usado) — mismo patron que admin_listar_usuarios,
-- el "where public.es_admin()" en vez de "raise exception" porque es
-- una funcion de solo lectura: si no eres admin, simplemente no ves
-- filas, no hace falta un error.
create or replace function public.admin_resumen_eventos_uso()
returns table (tipo text, total bigint, usuarios_distintos bigint, ultimo_uso timestamptz)
language sql
security definer
set search_path = public
stable
as $$
  select tipo, count(*), count(distinct user_id), max(creado_en)
  from public.eventos_uso
  where public.es_admin()
  group by tipo
  order by count(*) desc;
$$;
grant execute on function public.admin_resumen_eventos_uso() to authenticated;

-- Desglose por un usuario concreto (para "ofrecer mejor servicio" a
-- alguien en particular, ej. si escribe con un problema).
create or replace function public.admin_eventos_uso_usuario(p_user_id uuid)
returns table (tipo text, total bigint, ultimo_uso timestamptz)
language sql
security definer
set search_path = public
stable
as $$
  select tipo, count(*), max(creado_en)
  from public.eventos_uso
  where public.es_admin() and user_id = p_user_id
  group by tipo
  order by count(*) desc;
$$;
grant execute on function public.admin_eventos_uso_usuario(uuid) to authenticated;
