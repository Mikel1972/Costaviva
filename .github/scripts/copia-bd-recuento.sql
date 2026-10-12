-- Recuento exacto de filas de cada tabla de public, auth y storage
-- (copia-bd.yml): se pasa en producción y en la copia restaurada y se
-- comparan. Salida: "esquema.tabla<TAB>filas", una línea por tabla.
select format('select %L, count(*) from %I.%I', n.nspname || '.' || c.relname, n.nspname, c.relname)
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind in ('r', 'p')
  and not c.relispartition
  and n.nspname in ('public', 'auth', 'storage')
order by 1
\gexec
