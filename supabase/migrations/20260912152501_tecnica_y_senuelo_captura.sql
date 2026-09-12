-- Costa Viva — técnica de pesca y tipo de señuelo, por captura
--
-- tecnica: Surfcasting/Spinning/Jigging/Curricán/Fondo/Flotador-Corcheo/
-- Popping/Eging/Otra (controlado por el <select> del cliente).
-- senuelo: texto libre (tipo de señuelo/cebo artificial) — solo relevante
-- para técnicas con señuelo; para las de cebo con aparejo (fondo,
-- flotador, surfcasting) se sigue usando la columna "aparejo" ya
-- existente (Plomo/Corcho/Otro).
alter table public.capturas
  add column if not exists tecnica text,
  add column if not exists senuelo text;
