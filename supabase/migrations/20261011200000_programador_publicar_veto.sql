-- Costa Viva — pg_cron lanza publicar-con-veto.yml cada 30 min (2026-10-11)
--
-- SIN APLICAR: se aplica con aplicar-migraciones.yml desde main cuando
-- Mikel lo apruebe. Sin ella todo funciona igual, solo que con el `schedule:`
-- de respaldo del workflow ("17,47 * * * *"), que GitHub corre "cuando
-- puede" (trampa 15 de comun): la pieza saldría con algo de retraso.
--
-- Qué es: publicación automática con veto de 12 h en Instagram y Facebook
-- (decisión de Mikel del 2026-10-11, "Automático con veto"). El workflow
-- publica una pieza a su hora si nadie la ha vetado y la variable de
-- repositorio PUBLICACION_AUTOMATICA vale "true"; si no, no hace nada.
--
-- Qué cambia:
--   1. lanzar_workflow_github() admite 'publicar-con-veto.yml' en su lista
--      cerrada. La lista incluye TODOS los anteriores (20261009130000 y
--      20261009140000): se apliquen en el orden que sea, la lista final
--      contiene a todos. Sigue sin poder lanzar publicar-post-instagram.yml
--      (el manual) ni aplicar-migraciones.yml.
--   2. Un trabajo de pg_cron a los 05 y 35 de cada hora: las horas del
--      calendario (08:00, 09:00, 13:00) salen a los 5 min.
--
-- Estándares (comun estandares/supabase.md): security definer con
-- search_path vacío, sin EXECUTE para public, anon ni authenticated
-- (D9-D11). Sin tablas ni policies nuevas: supabase/baseline-seguridad.json
-- no cambia.

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
                      'aprendizaje-semanal.yml', 'publicar-con-veto.yml') then
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

select cron.schedule('lanzar-publicar-con-veto', '5,35 * * * *', $$select public.lanzar_workflow_github('publicar-con-veto.yml')$$);
