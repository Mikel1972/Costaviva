-- Rayos en tiempo real con Xweather (2026-10-03, pedido del usuario: "con
-- tanto retraso no vale, necesitamos tiempo real"). Ver functions/rayos-cerca.js.
--
-- Xweather cobra cada consulta de rayos (0,006 $; las primeras 1.500 de cada
-- mes son gratis). El usuario eligió quedarse SOLO en lo gratuito, así que:
--   - rayos_xweather_cache: una respuesta por celda de 0,5° durante 60 s,
--     compartida por todos los usuarios (diez personas mirando Bizkaia a la
--     vez = una sola consulta pagada);
--   - rayos_xweather_uso + reservar_consulta_rayos(): contador mensual que se
--     reserva ANTES de llamar a Xweather, de forma atómica, y se niega al
--     llegar al tope. Al negarse, la app vuelve a la capa gratuita de
--     EUMETSAT.
-- Ninguna de las dos tablas tiene políticas: solo las toca el endpoint con
-- service_role.

create table if not exists public.rayos_xweather_cache (
  celda text primary key,
  datos jsonb not null,
  consultado_en timestamptz not null default now()
);
alter table public.rayos_xweather_cache enable row level security;

create table if not exists public.rayos_xweather_uso (
  mes text primary key,
  consultas integer not null default 0
);
alter table public.rayos_xweather_uso enable row level security;

create or replace function public.reservar_consulta_rayos(p_limite integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mes text := to_char(now() at time zone 'UTC', 'YYYY-MM');
  v_consultas integer;
begin
  insert into public.rayos_xweather_uso (mes, consultas) values (v_mes, 0)
  on conflict (mes) do nothing;

  update public.rayos_xweather_uso
  set consultas = consultas + 1
  where mes = v_mes and consultas < p_limite
  returning consultas into v_consultas;

  return v_consultas is not null;
end;
$$;
revoke all on function public.reservar_consulta_rayos(integer) from public, anon, authenticated;
grant execute on function public.reservar_consulta_rayos(integer) to service_role;
