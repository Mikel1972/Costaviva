-- Costa Viva — pg_cron lanza también espuma-camaras.yml (2026-10-08)
--
-- SIN APLICAR: se aplica con aplicar-migraciones.yml desde main cuando
-- Mikel lo apruebe.
--
-- Problema: espuma-camaras.yml (oleaje por cámara, cada 30 min con luz) se
-- fusionó a las 12:00 UTC del 2026-10-08 y a las 15:46 su `schedule:` no
-- había corrido NI UNA vez. No es un fallo del fichero (la ejecución manual
-- 37803551456 fue bien y publicó 13 lecturas): GitHub trata los
-- `schedule:` como "cuando pueda" y en este repo se salta casi todas las
-- ejecuciones frecuentes (ese mismo día, boyas-copernicus.yml cada 2 h y
-- fuentes-gratuitas.yml cada 3 h tampoco corrieron; camaras-salud.yml,
-- cada 30 min, corrió 4 veces en 24 h). Es el mismo caso que resolvió
-- 20260928160000_programador_workflows_github.sql.
--
-- Solución: añadir espuma-camaras.yml a la lista cerrada de
-- lanzar_workflow_github() y un trabajo de pg_cron con el mismo horario que
-- el `schedule:` del workflow (minutos 7 y 37, de 05 a 18 UTC: cubre la luz
-- de todo el año; con poca luz el workflow corta en ~15 s). El `schedule:`
-- se queda de respaldo; el workflow lleva `concurrency` para no solaparse.
--
-- REQUISITO: la clave 'github_lanzar_workflows' en Vault. A 2026-10-08
-- guardar-token-programador.yml no se ha ejecutado nunca, así que el
-- programador de 20260928160000 no lanza nada todavía (ni camaras-salud ni
-- notificar-altas). Hasta que Mikel cree PROGRAMADOR_GITHUB_TOKEN y lance
-- ese workflow, esta migración no tiene efecto (la función avisa y sale).
--
-- Estándares (comun estandares/supabase.md): la función sigue siendo
-- security definer con search_path vacío, sin EXECUTE para public, anon ni
-- authenticated (D9-D11). Lista cerrada: nunca puede lanzar, por ejemplo,
-- aplicar-migraciones.yml.

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
  if workflow not in ('camaras-salud.yml', 'notificar-altas.yml', 'espuma-camaras.yml') then
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

-- Mismo horario que el `schedule:` de espuma-camaras.yml (UTC).
select cron.schedule('lanzar-espuma-camaras', '7,37 5-18 * * *', $$select public.lanzar_workflow_github('espuma-camaras.yml')$$);
