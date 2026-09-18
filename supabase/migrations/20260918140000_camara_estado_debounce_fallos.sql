-- Costa Viva — exige 2 fallos seguidos antes de marcar sin señal (2026-09-18)
--
-- Bug real reportado por el usuario: castrourdiales salió "sin señal" tras
-- UN solo 502 real pero pasajero del servidor de Cantabria (las 6 cámaras
-- de ese proveedor fallaron juntas en la primera ejecución del workflow) —
-- el usuario comprobó la cámara a mano y la imagen real tenía solo 15 min.
-- Un fallo aislado de red no debe pintar un punto rojo permanente.
--
-- A partir de ahora, un fallo de descarga/decodificación o un frame plano
-- solo cuenta como "sin señal" si se repite en la comprobación
-- INMEDIATAMENTE SIGUIENTE (ver decidirEstado() en scripts/camaras/
-- comprobar-camaras.mjs) — con comprobaciones cada 30 min, un problema
-- tiene que durar más de media hora seguida para llegar a mostrarse. La
-- detección de frame congelado no cambia: ya exigía por diseño que el
-- mismo hash se repitiera durante horas, así que ya era resistente a esto.
alter table public.camara_estado
  add column if not exists fallos_seguidos integer not null default 0;
