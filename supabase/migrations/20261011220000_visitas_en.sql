-- Costaviva — Visitas de las páginas de Nueva Zelanda (/en/...) en el
-- contador propio, para los KPIs por país (2026-10-11).
--
-- SIN APLICAR: espera el sí de Mikel ("Claude pregunta, Claude ejecuta");
-- se aplica con aplicar-migraciones.yml desde main.
--
-- Qué hace, en llano: el contador de visitas solo aceptaba las páginas en
-- español (empieza, mareas, spots, especies, login). Añade tres tipos más,
-- en_spots, en_tides y en_species, para contar aparte las visitas a /en/spots,
-- /en/tides y /en/species (Nueva Zelanda). No cambia nada más: misma tabla,
-- mismas fuentes, mismo tope y mismos permisos. Sin datos personales.
-- Hasta aplicarla, functions/_lib/visitas.js ya manda esos tipos y la función
-- de antes los ignora sin error.

alter table public.visitas_publicas drop constraint if exists visitas_publicas_pagina_check;
alter table public.visitas_publicas add constraint visitas_publicas_pagina_check
  check (pagina in ('empieza', 'mareas', 'spots', 'especies', 'login', 'en_spots', 'en_tides', 'en_species'));

create or replace function public.contar_visita_publica(p_pagina text, p_fuente text, p_campana text default null)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_fuente text := lower(coalesce(p_fuente, ''));
  v_campana text := lower(coalesce(p_campana, ''));
begin
  if p_pagina is null or p_pagina not in ('empieza', 'mareas', 'spots', 'especies', 'login', 'en_spots', 'en_tides', 'en_species') then
    return;
  end if;
  if v_fuente not in ('instagram', 'facebook', 'google', 'bing', 'duckduckgo', 'ecosia', 'yahoo',
      'whatsapp', 'telegram', 'x', 'email', 'referido', 'invitacion', 'directo', 'otro') then
    v_fuente := 'otro';
  end if;
  if v_campana !~ '^[a-z0-9][a-z0-9_-]{0,59}$' then v_campana := ''; end if;

  insert into public.visitas_publicas as v (dia, pagina, fuente, campana, visitas)
  values ((now() at time zone 'Europe/Madrid')::date, p_pagina, v_fuente, v_campana, 1)
  on conflict (dia, pagina, fuente, campana)
  do update set visitas = least(v.visitas + 1, 1000000);
end;
$$;
revoke all on function public.contar_visita_publica(text, text, text) from public, anon, authenticated;
-- anon-ok: la llama el middleware con la clave anon; solo suma 1 a un
-- recuento agregado con valores de listas cerradas, no lee ni devuelve nada.
grant execute on function public.contar_visita_publica(text, text, text) to anon, authenticated, service_role;

do $$
begin
  raise notice 'Visitas /en/: constraint y función actualizadas (% filas en visitas_publicas).',
    (select count(*) from public.visitas_publicas);
end $$;
