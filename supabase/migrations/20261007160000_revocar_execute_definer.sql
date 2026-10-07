-- Costa Viva — EXECUTE de las funciones security definer, mínimo necesario
--
-- MOTIVO (Mikel1972/comun, estandares/supabase.md D10; 2026-10-07): en
-- Supabase toda función nueva nace ejecutable por PUBLIC (y con grants
-- explícitos a anon y authenticated). Una security definer ejecutable por
-- anon es una puerta sin sesión. Esta migración deja, para las 27 funciones
-- definer del repo que no tenían revoke:
--
--   1) Triggers: sin EXECUTE para nadie. Un trigger no comprueba EXECUTE al
--      dispararse, así que no cambia nada en el alta ni en las estadísticas.
--   2) contar_alertas_sos_24h: solo service_role. La llamaba el informe
--      diario con la anon key; desde este mismo cambio la llama con
--      SUPABASE_SERVICE_ROLE_KEY (daily-report.yml). Desplegar el workflow
--      ANTES de aplicar esto (va en la misma PR, así que basta con fusionar
--      primero).
--   3) El resto (RPC de la app con sesión, funciones de admin que ya
--      comprueban es_admin() dentro, y es_miembro_de/es_admin que usan las
--      policies): sin PUBLIC ni anon, con authenticated.
--
-- Efecto visible esperado: un anon que consulte grupos/miembros_grupo/
-- invitaciones_grupo (policies con es_miembro_de) recibe "permission denied"
-- en vez de una lista vacía. Ninguna página lo hace sin sesión, y esas
-- tablas no están en test/endpoints-auth.test.js.
--
-- Idempotente y tolerante a la deriva (trampa 10): si una función no existe
-- en producción, se avisa con NOTICE y se sigue, en vez de fallar.
-- No cambia RLS ni policies: baseline-seguridad.json no se toca.

do $$
declare
  par text[];
  sig text;
begin
  -- 1) Triggers: nadie.
  foreach par slice 1 in array array[
    ['gestionar_alta_perfil', ''],
    ['handle_new_user', ''],
    ['actualizar_max_miembros_grupo', ''],
    ['registrar_estadistica_salida_anonima', ''],
    ['registrar_estadistica_captura_anonima', '']
  ] loop
    sig := format('public.%I(%s)', par[1], par[2]);
    if to_regprocedure(sig) is null then raise notice 'no existe en esta base: %', sig; continue; end if;
    execute format('revoke execute on function %s from public, anon, authenticated', sig);
  end loop;

  -- 2) Solo service_role.
  foreach par slice 1 in array array[
    ['contar_alertas_sos_24h', '']
  ] loop
    sig := format('public.%I(%s)', par[1], par[2]);
    if to_regprocedure(sig) is null then raise notice 'no existe en esta base: %', sig; continue; end if;
    execute format('revoke execute on function %s from public, anon, authenticated', sig);
    execute format('grant execute on function %s to service_role', sig);
  end loop;

  -- 3) Con sesión (authenticated), nunca anon.
  foreach par slice 1 in array array[
    ['es_admin', ''],
    ['es_miembro_de', 'uuid, uuid'],
    ['marcar_bienvenida_vista', ''],
    ['crear_grupo', 'text'],
    ['unirse_a_grupo', 'text'],
    ['eliminar_grupo', 'uuid'],
    ['obtener_calendario_grupo', 'uuid'],
    ['obtener_capturas_grupo', 'uuid'],
    ['obtener_ubicaciones_grupo', 'uuid'],
    ['hay_novedades_grupos', ''],
    ['marcar_grupos_visitados', ''],
    ['mi_estado_suscripcion', ''],
    ['admin_listar_usuarios', ''],
    ['admin_fijar_acceso', 'uuid, boolean'],
    ['admin_eliminar_usuario', 'uuid'],
    ['admin_ultima_sesion_usuarios', ''],
    ['admin_listar_grupos_historico', ''],
    ['admin_listar_estadisticas_capturas', ''],
    ['admin_listar_estadisticas_salidas', ''],
    ['admin_resumen_eventos_uso', ''],
    ['admin_eventos_uso_usuario', 'uuid']
  ] loop
    sig := format('public.%I(%s)', par[1], par[2]);
    if to_regprocedure(sig) is null then raise notice 'no existe en esta base: %', sig; continue; end if;
    execute format('revoke execute on function %s from public, anon', sig);
    execute format('grant execute on function %s to authenticated', sig);
  end loop;
end;
$$;
