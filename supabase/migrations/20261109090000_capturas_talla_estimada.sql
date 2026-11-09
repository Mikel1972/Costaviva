-- Costa Viva — lo que calculó la foto de cada captura (2026-11-09, Mikel)
--
-- La foto de su sargo calculó 30 cm y medía 30 cm ("tu cálculo era exacto";
-- "sí, hazlo; instruir al robot para que vaya aprendiendo"). Hasta hoy el
-- cálculo de functions/identificar-captura.js se escribía en el formulario y,
-- si el pescador lo corregía, se perdía: no se podía medir cuánto acierta.
--
-- Columnas nuevas, nulas por defecto (las capturas antiguas quedan sin dato):
--   talla_estimada_cm, peso_estimado_g, especie_estimada: lo que dijo la foto.
--   talla_medida: true si el pescador marca que la talla la midió él.
-- El aprendizaje semanal (scripts/aprendizaje/talla-foto.mjs) compara la
-- estimada con la medida por especie, y la función corrige su sesgo y da el
-- margen ("suele acertar ±2 cm"). Las policies de capturas (cada usuario, lo
-- suyo) ya cubren leerlas y cambiarlas; no se tocan.

alter table public.capturas
  add column if not exists talla_estimada_cm numeric(5,1)
    check (talla_estimada_cm is null or (talla_estimada_cm > 0 and talla_estimada_cm <= 500)),
  add column if not exists peso_estimado_g integer
    check (peso_estimado_g is null or (peso_estimado_g > 0 and peso_estimado_g <= 500000)),
  add column if not exists especie_estimada text
    check (especie_estimada is null or char_length(especie_estimada) <= 80),
  add column if not exists talla_medida boolean;

comment on column public.capturas.talla_estimada_cm is 'Talla que calculó la foto (identificar-captura), antes de que el pescador la cambie. 2026-11-09.';
comment on column public.capturas.peso_estimado_g is 'Peso que calculó la foto. 2026-11-09.';
comment on column public.capturas.especie_estimada is 'Especie que propuso la foto. 2026-11-09.';
comment on column public.capturas.talla_medida is 'true: el pescador midió la talla (cinta o regla). Solo estas cuentan para medir el acierto de la foto. 2026-11-09.';
