-- Costaviva — borrar la fila antigua de Águilas en camara_estado (2026-10-08)
--
-- Aprobado por Mikel el 2026-10-08. Desde la PR #117 la cámara de Águilas
-- (SkylineWebcams) se vigila como cámara externa con la clave `ext-<id>` y
-- el robot de salud ya no actualiza la fila 'aguilas'; el informe diario la
-- seguiría contando. Solo borra esa fila: no cambia tablas, RLS ni funciones
-- (supabase/baseline-seguridad.json no cambia).

delete from public.camara_estado where spot_slug = 'aguilas';
