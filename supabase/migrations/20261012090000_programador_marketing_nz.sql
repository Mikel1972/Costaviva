-- Costaviva — pg_cron lanza también las piezas de Nueva Zelanda (2026-10-12,
-- sí de Mikel).
--
-- SIN APLICAR: se aplica con aplicar-migraciones.yml desde main.
--
-- Qué hace, en llano: las piezas de NZ (en inglés, para las 07:00 hora de
-- NZ; scripts/marketing/calendario.mjs, mercado "nz") se preparan la víspera
-- por la tarde de NZ. GitHub no es puntual con sus `schedule:` (trampa 15 de
-- comun), así que, como con las de España, el reloj es pg_cron:
--   - robot-marketing-instagram.yml: lunes y jueves a las 05:40 UTC (18:40
--     en NZ con horario de verano, 17:40 en invierno) -> posts del martes y
--     del viernes de NZ.
--   - robot-reel-instagram.yml: viernes a las 05:20 UTC -> reel del sábado
--     de NZ.
-- El `schedule:` de GitHub (06:40 y 06:20 UTC) se queda de respaldo una hora
-- después; no repite porque calendario-estado.json ya tiene la pieza.
--
-- Por qué una función nueva y no lanzar_workflow_github(): esa lanza sin
-- inputs, y sin `mercado` los robots preparan la pieza de España. Esta solo
-- admite los dos robots de marketing y SIEMPRE manda mercado = "nz"; no
-- recibe inputs de nadie. No toca lanzar_workflow_github() ni su lista. Nunca
-- puede lanzar publicar-post-instagram.yml: publicar sigue siendo manual, con
-- el OK de Mikel.
--
-- Usa la misma clave 'github_lanzar_workflows' de Vault (ya guardada).
--
-- Estándares: security definer con search_path vacío, sin EXECUTE para
-- public, anon ni authenticated (D9-D10).

create or replace function public.lanzar_marketing_nz(workflow text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  token text;
  peticion bigint;
begin
  if workflow not in ('robot-marketing-instagram.yml', 'robot-reel-instagram.yml') then
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
    body := jsonb_build_object('ref', 'main', 'inputs', jsonb_build_object('mercado', 'nz')),
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

revoke all on function public.lanzar_marketing_nz(text) from public, anon, authenticated;
grant execute on function public.lanzar_marketing_nz(text) to service_role;

select cron.schedule('lanzar-marketing-posts-nz', '40 5 * * 1,4', $$select public.lanzar_marketing_nz('robot-marketing-instagram.yml')$$);
select cron.schedule('lanzar-marketing-reel-nz', '20 5 * * 5', $$select public.lanzar_marketing_nz('robot-reel-instagram.yml')$$);
