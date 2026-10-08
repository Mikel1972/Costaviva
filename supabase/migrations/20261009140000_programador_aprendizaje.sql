-- Costa Viva — pg_cron lanza también aprendizaje-semanal.yml (2026-10-09)
--
-- SIN APLICAR: se aplica con aplicar-migraciones.yml desde main cuando
-- Mikel lo apruebe.
--
-- Qué es: el aprendizaje semanal del índice de pesca (sin IA,
-- scripts/aprendizaje/) corre los lunes de madrugada. El `schedule:` de
-- GitHub se salta ejecuciones en este repo (trampa 15 de comun), así que,
-- igual que camaras-salud, notificar-altas y espuma-camaras, lo lanza
-- pg_cron con workflow_dispatch.
--
-- Qué cambia:
--   1. lanzar_workflow_github() admite 'aprendizaje-semanal.yml' en su lista
--      cerrada. La lista incluye TODOS los demás (espuma-camaras.yml de
--      20261008210000 y los dos de marketing de 20261009130000, PR #142): se
--      apliquen en el orden que sea, la lista final es la misma.
--   2. Un trabajo de pg_cron los lunes a las 04:41 UTC (el mismo minuto que
--      el `schedule:` de respaldo del workflow; el workflow lleva
--      `concurrency` para no solaparse).
--
-- La clave 'github_lanzar_workflows' ya está en Vault (guardar-token-
-- programador.yml, prueba real 204 el 2026-10-08 a las 16:09 UTC): al
-- aplicar esta migración, el lunes siguiente ya lo lanza pg_cron.
--
-- Estándares (comun estandares/supabase.md): security definer con
-- search_path vacío, sin EXECUTE para public, anon ni authenticated
-- (D9-D11). Lista cerrada: nunca puede lanzar aplicar-migraciones.yml.
-- Sin tablas ni policies nuevas: supabase/baseline-seguridad.json no cambia.

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
                      'aprendizaje-semanal.yml') then
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

-- Lunes 04:41 UTC (06:41 en verano, 05:41 en invierno, hora de Madrid):
-- antes de la rutina "Costaviva - Investigador semanal" de la mañana.
select cron.schedule('lanzar-aprendizaje-semanal', '41 4 * * 1', $$select public.lanzar_workflow_github('aprendizaje-semanal.yml')$$);
