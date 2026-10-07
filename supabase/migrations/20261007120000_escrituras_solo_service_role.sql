-- Costa Viva — escrituras de las tablas de cron solo con service_role
--
-- MOTIVO (Mikel1972/comun, estandares/supabase.md D7 y D12; 2026-10-07):
-- camara_estado, euskalmet_rios, turbidez_historico, coeficiente_marea_actual
-- y presion_historico tenían policies de INSERT/UPDATE `to anon` con
-- `with check (true)`, porque las Functions de cron que las rellenan
-- (registrar-estado-camaras.js, actualizar-euskalmet-rios.js,
-- registrar-turbidez.js, registrar-presion.js) escribían con la anon key fija
-- en el código y "se protegían" con X-Cron-Secret dentro de la Function.
-- Pero la anon key es pública (va en el JS del navegador): cualquiera podía
-- escribir directamente por REST en estas tablas saltándose la Function y su
-- secreto.
--
-- Desde el commit "Functions de cron: escribir con SUPABASE_SERVICE_ROLE_KEY"
-- esas Functions escriben con service_role, que se salta RLS y no necesita
-- ninguna policy de escritura. Aquí se quitan las de anon y se dejan
-- intactas las de SELECT (lectura pública, que sí usa la app).
--
-- ORDEN DE DESPLIEGUE: primero el código (Cloudflare Pages con
-- SUPABASE_SERVICE_ROLE_KEY) y comprobar que los crons siguen escribiendo;
-- DESPUÉS esta migración. Al revés, los crons fallarían con 42501 hasta
-- desplegar el código.
--
-- NOMBRES: son los EXACTOS de producción según supabase/baseline-seguridad.json
-- (foto real de pg_policy), no solo los de las migraciones, porque:
--   * Postgres trunca los identificadores a 63 bytes: "solo la anon key
--     actualiza (protegido por secreto en la función)" (65 bytes) quedó como
--     "...en la funció", y "la anon key actualiza (protegido por secreto en la
--     función), update" (68 bytes) como "...función), u".
--   * Producción ha divergido del repo (trampa 10): turbidez_historico tiene
--     además "solo la anon key inserta" y "solo la anon key actualiza su fila
--     del dia" (sin migración), y la de update de euskalmet_rios figura como
--     "solo la anon key actualiza (pnción)".
-- Se borran ambas variantes con `if exists`; el bloque final aborta la
-- migración si queda CUALQUIER policy de escritura en estas tablas, para no
-- dejar un agujero por un nombre que no conozcamos.
--
-- sinonimos_especie NO se toca: su insert anon solo admite verificado=false
-- (el robot propone, nunca verifica). Se documenta la excepción (D7).
--
-- Verificación tras aplicar (solo lectura; debe devolver solo filas SELECT):
--   select tablename, policyname, cmd, roles
--   from pg_policies
--   where schemaname = 'public'
--     and tablename in ('camara_estado','euskalmet_rios','turbidez_historico',
--                       'coeficiente_marea_actual','presion_historico')
--   order by tablename, policyname;

-- camara_estado
drop policy if exists "solo la anon key inserta (protegido por secreto en la función)" on public.camara_estado;
drop policy if exists "solo la anon key actualiza (protegido por secreto en la funció" on public.camara_estado;

-- euskalmet_rios
drop policy if exists "solo la anon key inserta (protegido por secreto en la función)" on public.euskalmet_rios;
drop policy if exists "solo la anon key actualiza (protegido por secreto en la funció" on public.euskalmet_rios;
drop policy if exists "solo la anon key actualiza (pnción)" on public.euskalmet_rios;

-- turbidez_historico
drop policy if exists "solo la anon key inserta (protegido por secreto en la función)" on public.turbidez_historico;
drop policy if exists "solo la anon key actualiza su propia fila del día (upsert)" on public.turbidez_historico;
drop policy if exists "solo la anon key inserta" on public.turbidez_historico;
drop policy if exists "solo la anon key actualiza su fila del dia" on public.turbidez_historico;

-- coeficiente_marea_actual
drop policy if exists "la anon key actualiza (protegido por secreto en la función)" on public.coeficiente_marea_actual;
drop policy if exists "la anon key actualiza (protegido por secreto en la función), u" on public.coeficiente_marea_actual;

-- presion_historico
drop policy if exists "solo la anon key inserta (protegido por secreto en la función)" on public.presion_historico;

-- Guarda: si producción tiene alguna otra policy de escritura en estas tablas
-- (nombre desconocido, creada a mano), la migración falla entera en vez de
-- dar el arreglo por hecho.
do $$
declare
  restantes text;
begin
  select string_agg(format('%s: "%s" (%s)', tablename, policyname, cmd), '; ')
    into restantes
  from pg_policies
  where schemaname = 'public'
    and tablename in ('camara_estado', 'euskalmet_rios', 'turbidez_historico',
                      'coeficiente_marea_actual', 'presion_historico')
    and cmd <> 'SELECT';
  if restantes is not null then
    raise exception 'Quedan policies de escritura sin quitar: %', restantes;
  end if;
end
$$;

-- anon-ok: el robot solo propone (verificado=false), nunca verifica
comment on policy "la anon key solo propone, nunca verifica" on public.sinonimos_especie is 'anon-ok: el robot solo propone (verificado=false), nunca verifica';
