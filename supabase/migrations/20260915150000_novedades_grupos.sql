-- Costa Viva — punto de novedades en el boton de Grupos
--
-- Pedido explicito del usuario: si un grupo tiene novedades (un registro
-- nuevo compartido por otro miembro), debe verse un punto verde
-- parpadeando en el boton de Grupos del menu inferior, para que el resto
-- sepa que hay algo nuevo sin tener que entrar a comprobar.
--
-- ultima_visita por miembro y grupo -- se pone a "ahora" cada vez que
-- grupos.html carga la actividad compartida de ese grupo (ya la carga
-- entera al abrir la pagina, no hace falta nada por-grupo mas fino).
alter table public.miembros_grupo add column if not exists ultima_visita timestamptz;

-- Hay novedades si, en CUALQUIER grupo del que el usuario es miembro,
-- otro miembro (con el interruptor de compartir correspondiente activo
-- PARA ESE GRUPO) ha creado una salida o una captura despues de la
-- ultima visita del usuario a ese grupo. Mismo criterio de "quien
-- comparte que" que ya usan obtener_calendario_grupo/
-- obtener_capturas_grupo -- no se inventa una regla nueva de
-- visibilidad, se reutiliza la ya existente.
create or replace function public.hay_novedades_grupos()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
select exists (
select 1
from public.miembros_grupo yo
where yo.user_id = auth.uid()
and (
exists (
select 1 from public.salidas_pesca s
join public.miembros_grupo autor on autor.user_id = s.user_id and autor.grupo_id = yo.grupo_id and autor.compartir_calendario
where autor.user_id <> yo.user_id and s.creado_en > coalesce(yo.ultima_visita, 'epoch'::timestamptz)
)
or exists (
select 1 from public.capturas c
join public.miembros_grupo autor on autor.user_id = c.user_id and autor.grupo_id = yo.grupo_id and autor.compartir_capturas
where autor.user_id <> yo.user_id and c.creado_en > coalesce(yo.ultima_visita, 'epoch'::timestamptz)
)
)
);
$$;
grant execute on function public.hay_novedades_grupos() to authenticated;

-- Se llama al abrir grupos.html, despues de pintar la actividad de todos
-- los grupos (que ya se carga entera, sin paginar) -- marca todos los
-- grupos del usuario como vistos de una vez.
create or replace function public.marcar_grupos_visitados()
returns void
language sql
security definer
set search_path = public
as $$
update public.miembros_grupo set ultima_visita = now() where user_id = auth.uid();
$$;
grant execute on function public.marcar_grupos_visitados() to authenticated;
