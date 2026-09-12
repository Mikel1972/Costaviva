-- Costa Viva — hora de inicio y de fin de la salida (Fase 3 del plan de mejoras)
--
-- salidas_pesca.hora (un único campo, añadido en
-- 20260912152028_franja_horaria_tipo_salida.sql) pasa a ser hora de
-- inicio + hora de fin de la salida completa. Las horas de cada captura
-- (capturas.hora, ya existente) deben caer dentro de ese rango — la
-- validación de eso se hace en el cliente (diario.html), no aquí, para
-- poder dar un mensaje claro sin depender de un trigger.

alter table public.salidas_pesca rename column hora to hora_inicio;
alter table public.salidas_pesca add column hora_fin time;
