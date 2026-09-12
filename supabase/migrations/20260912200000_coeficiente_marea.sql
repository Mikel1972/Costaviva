-- Costa Viva — coeficiente de marea (mareas vivas/muertas)
--
-- Pedido explícito del usuario: mostrar el coeficiente de marea (no solo
-- la altura) en cada spot del mapa y guardarlo también en cada salida
-- del diario. Aproximación astronómica por fase lunar (mareas vivas
-- cerca de luna nueva/llena, muertas cerca de los cuartos), escala
-- 20-120 como las tablas de mareas habituales — no es un dato oficial de
-- un servicio hidrográfico (eso requeriría análisis armónico real por
-- puerto), documentado así en functions/prevision.js
-- (coeficienteMarea()) y en CLAUDE.md.

alter table public.salidas_pesca add column if not exists marea_coeficiente integer;
