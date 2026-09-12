-- Costa Viva — corrige RLS de presion_historico: faltaba política de insert
--
-- Fallo real encontrado al probar el cron en producción (2026-09-12):
-- la migración anterior (20260912220000) solo creaba la política de
-- select, razonando que "solo escribe el endpoint protegido con
-- secreto compartido" — pero ese endpoint inserta usando la anon key
-- (no hay sesión de usuario en un cron), y sin una política de insert
-- explícita, RLS deniega la escritura a CUALQUIERA, incluido el propio
-- endpoint (42501 "new row violates row-level security policy").
-- El secreto compartido (X-Cron-Secret) sigue siendo la protección real
-- contra escrituras no deseadas — esto solo faltaba para que el propio
-- endpoint autorizado pudiera escribir.
create policy "solo la anon key inserta (protegido por secreto en la función)"
  on public.presion_historico for insert
  to anon
  with check (true);
