-- Costaviva — Captación (4/4): pg_cron lanza el calendario de contenido
-- (2026-10-09).
--
-- SIN APLICAR: se aplica con aplicar-migraciones.yml desde main cuando
-- Mikel lo apruebe.
--
-- Qué hace, en llano: el calendario de redes (3 posts y 1 reel por semana)
-- deja los borradores listos LA TARDE ANTERIOR para que Mikel solo tenga que
-- aprobarlos por la mañana. GitHub no es puntual con sus `schedule:`
-- (trampa 15 de comun), así que, como ya se hace con camaras-salud y
-- espuma-camaras, el reloj es pg_cron:
--   - robot-marketing-instagram.yml: lunes, miércoles y jueves a las 17:30
--     UTC (19:30 en verano, 18:30 en invierno) -> posts de martes, jueves y
--     viernes.
--   - robot-reel-instagram.yml: viernes a las 17:10 UTC -> reel del sábado.
-- Los dos workflows saben qué pieza toca mañana (scripts/marketing/
-- calendario.mjs) y no repiten si ya la hicieron: el `schedule:` de GitHub
-- se queda como respaldo una hora después sin riesgo de duplicar.
--
-- Solo añade esos dos ficheros a la lista cerrada de
-- lanzar_workflow_github(); nunca puede lanzar, por ejemplo,
-- aplicar-migraciones.yml ni publicar-post-instagram.yml (publicar SIEMPRE
-- es manual, con el OK de Mikel).
--
-- REQUISITO: la clave 'github_lanzar_workflows' en Vault (secret
-- PROGRAMADOR_GITHUB_TOKEN + workflow guardar-token-programador.yml). A
-- 2026-10-09 no está guardada: hasta entonces la función avisa y sale, y
-- solo corre el respaldo de GitHub.
--
-- Estándares: security definer con search_path vacío, sin EXECUTE para
-- public, anon ni authenticated (D9-D11).

create or replace function public.lanzar_workflow_github(workflow text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  token text;
  peticion bigint;
begin
  if workflow not in ('camaras-salud.yml', 'notificar-altas.yml', 'espuma-camaras.yml',
                      'robot-marketing-instagram.yml', 'robot-reel-instagram.yml') then
    raise exception 'Workflow no permitido: %', workflow;
  end if;

  select decrypted_secret into token
  from vault.decrypted_secrets
  where name = 'github_lanzar_workflows'
  limit 1;

  if token is null then
    raise notice 'Falta la clave github_lanzar_workflows en Vault: no se lanza %', workflow;
    return null;
  end if;

  select net.http_post(
    url := format('https://api.github.com/repos/Mikel1972/Costaviva/actions/workflows/%s/dispatches', workflow),
    body := jsonb_build_object('ref', 'main'),
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || token,
      'Accept', 'application/vnd.github+json',
      'X-GitHub-Api-Version', '2022-11-28',
      'User-Agent', 'costaviva-pg-cron',
      'Content-Type', 'application/json'
    )
  ) into peticion;

  return peticion;
end;
$$;

revoke all on function public.lanzar_workflow_github(text) from public, anon, authenticated;
grant execute on function public.lanzar_workflow_github(text) to service_role;

select cron.schedule('lanzar-marketing-posts', '30 17 * * 1,3,4', $$select public.lanzar_workflow_github('robot-marketing-instagram.yml')$$);
select cron.schedule('lanzar-marketing-reel', '10 17 * * 5', $$select public.lanzar_workflow_github('robot-reel-instagram.yml')$$);
