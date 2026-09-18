-- Costa Viva — detección de frame congelado en camara_estado (2026-09-18)
--
-- Hallazgo real, probando la primera versión de esta función en preview:
-- Mundaka y Sopelana no estaban "sin señal" (sus frames tienen contenido
-- real, no están planos/negros) pero SÍ estaban congeladas — la imagen de
-- Mundaka lleva grabada su propia fecha ("2026-09-17 20:50 BFA-DFB,
-- KOSTASystem by AZTI", ~13h vieja en el momento de la prueba) y la de
-- Sopelana era claramente un atardecer de la noche anterior, pese a que la
-- cabecera Last-Modified del proveedor decía "hace 24 minutos" — esa
-- cabecera no es de fiar para saber si el CONTENIDO cambió de verdad.
--
-- Por eso la comprobación de "frame plano" (sin variación de brillo) no
-- basta: hace falta además comparar el frame contra el de la comprobación
-- anterior. Si el hash no cambia durante más de ~3h seguidas (tiempo de
-- sobra para que cualquier cámara de mar en directo muestre algo distinto
-- por las olas/la luz), se marca sin señal con motivo "frame_congelado",
-- aunque el frame en sí no esté vacío.
alter table public.camara_estado
  add column if not exists hash_frame text,
  add column if not exists hash_desde timestamptz;
