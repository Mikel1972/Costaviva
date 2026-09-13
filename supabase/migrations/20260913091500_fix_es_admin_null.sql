-- Costa Viva — corrige un bug de seguridad real en es_admin()
--
-- Encontrado probando en real, minutos después de aplicar la migración
-- anterior: es_admin() devolvía NULL (no false) cuando no hay sesión o
-- el email no coincide, porque "auth.email() = 'x'" con auth.email()
-- NULL da NULL, no false. Y en PL/pgSQL, "if not es_admin() then raise
-- exception" NUNCA se ejecuta cuando es_admin() es NULL — "not NULL"
-- sigue siendo NULL, y un IF con NULL no entra en la rama, igual que
-- con false pero SIN levantar la excepción. Verificado en vivo: una
-- llamada a admin_fijar_acceso() con SOLO la anon key (sin sesión de
-- usuario) devolvía 204 (éxito) en vez de ser rechazada.
--
-- Corregido con coalesce(..., false) — ahora es_admin() nunca devuelve
-- NULL, así que "not es_admin()" es exactamente true o false, nunca
-- NULL, y el "if not es_admin()" de las otras dos funciones (que no
-- hace falta tocar, ya llaman a esta) vuelve a funcionar como debía.
create or replace function public.es_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(auth.email() = 'etxebe2005@gmail.com', false);
$$;
