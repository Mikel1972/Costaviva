-- Costa Viva — cada picada con su hora y sus condiciones (2026-11-16, Mikel:
-- "cuando marco picadas, deberá guardarse la hora y demás datos
-- automáticamente para tratar de buscar lógicas")
--
-- Hasta ahora salidas_pesca.picadas era solo un número. Con "+1 picada" se
-- guarda además una fila aquí con la hora del toque y lo que había en ese
-- momento: la marea (como las capturas) y, en `condiciones`, presión, viento,
-- ola, nubosidad y luna de esa hora. El aprendizaje semanal cruza picadas y
-- capturas por hora para buscar patrones. El número de salidas_pesca.picadas
-- se sigue llevando igual (las salidas antiguas no tienen filas aquí).
--
-- Dato privado de cada usuario: solo lo ve y lo toca su dueño (authenticated,
-- auth.uid() = user_id), y solo en sus propias salidas. anon no tiene nada.
-- Se borra con la salida.

create table if not exists public.picadas_pesca (
  id uuid primary key default gen_random_uuid(),
  salida_id uuid not null references public.salidas_pesca (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  hora time not null,
  marea_altura numeric,
  marea_tendencia text check (marea_tendencia is null or marea_tendencia in ('subiendo', 'bajando')),
  condiciones jsonb check (condiciones is null or jsonb_typeof(condiciones) = 'object'),
  creado_en timestamptz not null default now()
);
create index if not exists picadas_pesca_salida_idx on public.picadas_pesca (salida_id);
create index if not exists picadas_pesca_user_idx on public.picadas_pesca (user_id);

alter table public.picadas_pesca enable row level security;
revoke all on public.picadas_pesca from anon, authenticated;
grant select, insert, update, delete on public.picadas_pesca to authenticated;

drop policy if exists "cada usuario ve solo sus picadas" on public.picadas_pesca;
create policy "cada usuario ve solo sus picadas"
  on public.picadas_pesca for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "cada usuario inserta solo sus picadas" on public.picadas_pesca;
create policy "cada usuario inserta solo sus picadas"
  on public.picadas_pesca for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.salidas_pesca s where s.id = salida_id and s.user_id = auth.uid())
  );

drop policy if exists "cada usuario actualiza solo sus picadas" on public.picadas_pesca;
create policy "cada usuario actualiza solo sus picadas"
  on public.picadas_pesca for update to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.salidas_pesca s where s.id = salida_id and s.user_id = auth.uid())
  );

drop policy if exists "cada usuario borra solo sus picadas" on public.picadas_pesca;
create policy "cada usuario borra solo sus picadas"
  on public.picadas_pesca for delete to authenticated
  using (auth.uid() = user_id);

comment on table public.picadas_pesca is 'Cada picada de una salida (sin sacar el pez) con su hora, la marea y las condiciones de ese momento. Privadas de cada usuario. 2026-11-16.';
