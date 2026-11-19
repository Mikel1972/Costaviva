-- Costaviva — pg_cron lanza también las boyas (boyas-copernicus.yml)
-- (2026-11-19).
--
-- SIN APLICAR: se aplica con aplicar-migraciones.yml desde main cuando
-- Mikel lo apruebe (etiqueta sql-aprobado en la PR).
--
-- Por qué: boyas-copernicus.yml tiene `schedule:` cada 2 h, pero GitHub
-- trata los `schedule:` frecuentes como "cuando pueda" (trampa 15 de
-- comun). El 19/11 solo corrió a las 10:13 y a las 20:28 UTC. En ese
-- hueco, las boyas de Bilbao y Pasaia salían "sin datos de las últimas
-- 6 h": sin boya en el mapa, en la columna «Medido» de la hoja ni en la
-- corrección desde la boya.
--
-- Qué hace, en llano:
--   1. lanzar_workflow_github() admite 'boyas-copernicus.yml' en su lista
--      cerrada. La lista es la de producción del 19/11 (comprobada contra
--      pg_get_functiondef) más esta. Sigue sin poder lanzar
--      publicar-post-instagram.yml ni aplicar-migraciones.yml.
--   2. pg_cron la lanza cada 2 h, a los 13 min de las horas pares, como su
--      `schedule:`. Ese `schedule:` se queda de respaldo; si coinciden, la
--      `concurrency` del workflow cancela la anterior (dura ~40 s y no
--      escribe nada más que la instantánea).
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
                      'boyas-copernicus.yml') then
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

select cron.schedule('lanzar-boyas-copernicus', '13 */2 * * *', $$select public.lanzar_workflow_github('boyas-copernicus.yml')$$);
