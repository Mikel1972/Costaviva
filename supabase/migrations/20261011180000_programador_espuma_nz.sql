-- Costa Viva — pg_cron lanza espuma-camaras.yml también en la luz de Nueva
-- Zelanda (2026-10-11)
--
-- SIN APLICAR: se aplica con aplicar-migraciones.yml desde main cuando
-- Mikel lo apruebe. Sin ella todo funciona igual: la segunda línea de
-- `schedule:` de espuma-camaras.yml ("7,37 0-4,19-23 * * *") es el respaldo
-- (GitHub la corre "cuando puede").
--
-- Por qué: Mikel decidió (2026-10-11) medir la ola con las cámaras de NZ,
-- como en España. La luz de NZ (Pacific/Auckland) cae más o menos entre las
-- 18 y las 06 UTC; el trabajo 'lanzar-espuma-camaras' de
-- 20261008210000_programador_espuma_camaras.sql solo corre de 05 a 18 UTC.
-- Este trabajo cubre las horas que faltan (00-04 y 19-23 UTC). Entre los
-- dos, cada 30 min todo el día; el workflow mide en cada ejecución solo las
-- cámaras con el sol ≥ 8° en su sitio y corta en ~15 s si no hay ninguna.
--
-- No cambia lanzar_workflow_github(): espuma-camaras.yml ya está en su
-- lista cerrada (20261008210000 y siguientes). Solo un cron.schedule nuevo.

select cron.schedule('lanzar-espuma-camaras-nz', '7,37 0-4,19-23 * * *', $$select public.lanzar_workflow_github('espuma-camaras.yml')$$);
