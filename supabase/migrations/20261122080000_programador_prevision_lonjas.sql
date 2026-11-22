-- Costaviva — pg_cron lanza también la previsión precalculada
-- (prevision-precalculada.yml) y el histórico de lonjas (lonjas-historico.yml)
-- (2026-11-22).
--
-- SIN APLICAR: se aplica con aplicar-migraciones.yml desde main cuando
-- Mikel lo apruebe (etiqueta sql-aprobado en la PR).
--
-- Por qué (trampa 15 de comun): GitHub trata los `schedule:` como "cuando
-- pueda". prevision-precalculada.yml (cada 30 min desde el 22/11 00:31 UTC)
-- solo se lanzó sola una vez en 7 horas (07:23 UTC); mientras tanto /prevision
-- se calcula en Cloudflare, que es lo que gasta la CPU. lonjas-historico.yml
-- (02:41 UTC) se lanzó el 21/11 a las 10:09 y el 22/11 a las 07:30 aún no.
--
-- Qué hace, en llano:
--   1. lanzar_workflow_github() admite esos dos ficheros en su lista cerrada.
--      La lista es la de producción del 22/11 (comprobada con
--      pg_get_functiondef) más estos dos. Sigue sin poder lanzar
--      publicar-post-instagram.yml ni aplicar-migraciones.yml.
--   2. pg_cron los lanza: la previsión a los 22 y 52 de cada hora (dura
--      ~20 s; no coincide con las :07/:37 de su `schedule:` ni de las
--      cámaras) y las lonjas a las 02:41 UTC. Los `schedule:` se quedan de
--      respaldo, con su `concurrency`.
--
-- Estándares: la función sigue con search_path vacío, SECURITY DEFINER y
-- sin EXECUTE para public, anon ni authenticated (D9-D10).

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
                      'robot-marketing-instagram.yml', 'robot-reel-instagram.yml',
                      'aprendizaje-semanal.yml', 'publicar-con-veto.yml', 'flota-ais.yml',
                      'boyas-copernicus.yml', 'prevision-precalculada.yml', 'lonjas-historico.yml') then
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

select cron.schedule('lanzar-prevision-precalculada', '22,52 * * * *', $$select public.lanzar_workflow_github('prevision-precalculada.yml')$$);
select cron.schedule('lanzar-lonjas-historico', '41 2 * * *', $$select public.lanzar_workflow_github('lonjas-historico.yml')$$);
