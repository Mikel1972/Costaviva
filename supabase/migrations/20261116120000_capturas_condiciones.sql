-- Costa Viva — condiciones de cada captura (2026-11-16, Mikel: "y todos
-- aquellos datos que creas que puedan afectar, y a las especies pescadas")
--
-- Igual que picadas_pesca.condiciones: todo lo que había a la hora de la
-- captura (presión y su cambio en 3 h y 24 h, viento y rachas, ola, periodo,
-- dirección y mar de fondo, agua y su cambio en 3 días, aire, nubes, lluvia
-- de las 24 y 72 h anteriores, luna, sol, periodo solunar, punto del ciclo
-- de marea...). Lo rellena diario.html al guardar la captura y, para las
-- antiguas con hora, al abrir el diario. El aprendizaje semanal lo cruza por
-- especie.
--
-- Solo una columna nueva, nula por defecto. Las policies de capturas (cada
-- usuario, lo suyo) ya cubren leerla y cambiarla; no se tocan.

alter table public.capturas
  add column if not exists condiciones jsonb
  check (condiciones is null or jsonb_typeof(condiciones) = 'object');

comment on column public.capturas.condiciones is 'Condiciones a la hora de la captura (mismas claves que picadas_pesca.condiciones). 2026-11-16.';
