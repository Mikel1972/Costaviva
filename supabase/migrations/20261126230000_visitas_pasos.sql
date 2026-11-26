-- Costaviva — Pasos del embudo en el contador de visitas (2026-11-26).
--
-- Qué hace, en llano: el contador propio (visitas_publicas) solo cuenta
-- visitas a páginas. Añade tres «páginas» que son pasos: paso_cta (clic en
-- «Empieza gratis» de una página pública), paso_alta (empieza a escribir el
-- email del alta) y paso_alta_ok (envía el alta). Así se ve dónde se pierde
-- la gente. Misma tabla, mismas fuentes, mismo tope y mismos permisos. Sin
-- datos personales: solo un recuento por día, paso, fuente y campaña.

alter table public.visitas_publicas drop constraint if exists visitas_publicas_pagina_check;
alter table public.visitas_publicas add constraint visitas_publicas_pagina_check
  check (pagina in ('empieza', 'mareas', 'spots', 'especies', 'login', 'en_spots', 'en_tides', 'en_species',
                    'paso_cta', 'paso_alta', 'paso_alta_ok'));

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
  if p_pagina is null or p_pagina not in ('empieza', 'mareas', 'spots', 'especies', 'login', 'en_spots', 'en_tides', 'en_species',
                                          'paso_cta', 'paso_alta', 'paso_alta_ok') then
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
-- anon-ok: la llama el servidor con la clave anon; solo suma 1 a un
-- recuento agregado con valores de listas cerradas, no lee ni devuelve nada.
grant execute on function public.contar_visita_publica(text, text, text) to anon, authenticated, service_role;
