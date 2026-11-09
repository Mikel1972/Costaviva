-- Costa Viva — "Lo he pesado" (2026-11-09, Mikel: la foto de su sargo acertó
-- la talla, 30 cm, pero no el peso: calculó 450 g y pesó 560).
--
-- Igual que talla_medida (migración 20261109090000): true si el pescador
-- pesó la captura. Solo esas cuentan para que el aprendizaje semanal compare
-- el peso que calculó la foto (peso_estimado_g) con el real, por especie, y
-- la función corrija su sesgo (assets/js/talla-foto.js).
--
-- Una columna nueva, nula por defecto. Las policies de capturas (cada
-- usuario, lo suyo) ya la cubren; no se tocan.

alter table public.capturas
  add column if not exists peso_medido boolean;

comment on column public.capturas.peso_medido is 'true: el pescador pesó la captura. Solo estas cuentan para medir el acierto del peso que calcula la foto. 2026-11-09.';
