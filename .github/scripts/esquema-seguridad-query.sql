-- Foto de los "hechos de seguridad" del esquema de producción, más el
-- registro de migraciones aplicadas. Una sola fila con un único JSON, para
-- que `psql -tAc` la devuelva tal cual, sin cabeceras ni formato de tabla.
--
-- Adaptado de Pólizas.ai (.github/scripts/schema-seguridad-query.sql), que
-- solo mira RLS y políticas. Aquí se añade `migraciones` porque el incidente
-- propio de este repo fue distinto: el 2026-09-20 se descubrió que ~13
-- migraciones aplicadas entre el 17 y el 19 de septiembre se habían pegado a
-- mano en el SQL Editor, así que la tabla de seguimiento de la CLI nunca se
-- enteró y `supabase migration list` las daba por no aplicadas. Se arregló a
-- posteriori con `migration repair`, pero nada avisó cuando ocurrió.
select json_build_object(
  'tablas', coalesce((
    select json_agg(row_to_json(t) order by t.tablename) from (
      select
        c.relname as tablename,
        c.relrowsecurity as rls_enabled,
        coalesce((
          select json_agg(
            json_build_object(
              'name', p.polname,
              'cmd', p.polcmd::text,
              'roles', p.polroles::regrole[]::text[]
            ) order by p.polname
          )
          from pg_policy p where p.polrelid = c.oid
        ), '[]'::json) as policies
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
    ) t
  ), '[]'::json),
  -- Versiones que la CLI de Supabase cree aplicadas. Se compara contra los
  -- ficheros de supabase/migrations/ para cazar los dos sentidos del
  -- desfase: una migración aplicada a mano sin registrar, y un fichero de
  -- migración que nunca llegó a producción.
  'migraciones', coalesce((
    select json_agg(m.version order by m.version)
    from supabase_migrations.schema_migrations m
  ), '[]'::json)
) ;
