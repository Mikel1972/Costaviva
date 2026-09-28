-- Reloj fiable para las tareas de GitHub Actions que tienen que correr
-- cada 30 min (2026-09-28, pedido del usuario).
--
-- Problema: GitHub trata los `schedule:` como "cuando pueda". camaras-salud.yml
-- y notificar-altas.yml están programadas cada 30 min (48 veces al día) y
-- en la práctica corrían unas 7 veces al día (69 ejecuciones en 10 días):
-- una cámara caída o recuperada tardaba 3-5 h en reflejarse, y los avisos
-- de fin de prueba llegaban con horas de retraso. No era por coste: el repo
-- es público y Actions no cobra.
--
-- Solución: pg_cron (el programador de Postgres, sí es puntual) llama cada
-- 30 min a la API de GitHub para lanzar esas tareas a mano
-- (workflow_dispatch), que GitHub arranca al momento. Los `schedule:` de
-- los workflows se quedan como respaldo; los dos llevan `concurrency` para
-- que dos ejecuciones nunca se pisen.
--
-- La clave de GitHub (fine-grained, solo este repo, permiso Actions) NO
-- está aquí: vive cifrada en Supabase Vault con el nombre
-- 'github_lanzar_workflows'. La guarda el workflow
-- guardar-token-programador.yml desde el secret de GitHub
-- PROGRAMADOR_GITHUB_TOKEN, para que nunca pase por el chat ni por el
-- editor SQL. Sin esa clave, la función no hace nada (avisa y sale).

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

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
  -- Lista cerrada: aunque alguien llegara a llamar a esta función, solo
  -- puede lanzar estas tareas, nunca (por ejemplo) aplicar-migraciones.yml.
  if workflow not in ('camaras-salud.yml', 'notificar-altas.yml') then
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

-- Desfasadas 15 min entre sí para no arrancar las dos a la vez.
-- cron.schedule con nombre sustituye el trabajo si ya existe.
select cron.schedule('lanzar-camaras-salud', '*/30 * * * *', $$select public.lanzar_workflow_github('camaras-salud.yml')$$);
select cron.schedule('lanzar-notificar-altas', '15,45 * * * *', $$select public.lanzar_workflow_github('notificar-altas.yml')$$);
