-- Costaviva — cámaras de SOCIB retiradas (2026-10-11, PR #173).
-- Cala Millor y Son Bou se quitaron de la app (imágenes paradas desde
-- 2024-2025 y sin alternativa cerca). Su fila de estado seguía en rojo y el
-- aviso diario de robot-camaras-caidas.yml la contaba para siempre.
-- Solo borra esas dos filas de estado; ninguna cámara activa ni dato de usuario.
delete from public.camara_estado where spot_slug in ('calamillor', 'sonbou');
