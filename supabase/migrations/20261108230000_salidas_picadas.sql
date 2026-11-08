-- Costa Viva — picadas de cada salida (2026-11-08, pedido de Mikel)
--
-- "Llevo 3 horas y he tenido dos picadas": la ventana de actividad decía
-- activo y el diario solo guarda lo que se saca. Un número (no "pocas o
-- muchas", decisión de Mikel) con las picadas de la salida, se saquen o no.
-- Lo rellena el formulario de la salida o el botón "+1 picada" de diario.html;
-- el aprendizaje semanal (scripts/aprendizaje/casos.mjs) lo compara con la
-- ventana de actividad.
--
-- Solo una columna nueva, nula por defecto: las salidas antiguas quedan sin
-- dato. Las policies de salidas_pesca (cada usuario, lo suyo) ya cubren
-- leerla y cambiarla; no se tocan.

alter table public.salidas_pesca
  add column if not exists picadas smallint
  check (picadas is null or (picadas >= 0 and picadas <= 999));

comment on column public.salidas_pesca.picadas is 'Picadas en la salida, se sacara el pez o no (número; null = no apuntado). 2026-11-08.';
