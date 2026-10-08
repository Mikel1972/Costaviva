-- Costaviva — índice de pesca v2 guardado en cada salida (2026-10-08)
--
-- SIN APLICAR. Se aplica con .github/workflows/aplicar-migraciones.yml desde
-- main, cuando Mikel lo apruebe. Hasta entonces diario.html reintenta el
-- guardado sin estas columnas (PGRST204), así que no rompe nada.
--
-- Para qué: calibrar el índice con lo que de verdad se pesca (tercera
-- estrella de fiabilidad, "validado con el diario"). En cada salida se guarda
-- la versión de la fórmula, la puntuación a la hora de la salida, la especie
-- que la daba y el detalle de cada factor y regla experta (log-odds y puntos),
-- más la puntuación de cada especie candidata. Ver
-- assets/js/condiciones-salida.js (resumenIndice) y ventana-actividad.js.
--
-- condiciones_estado: por qué faltan las condiciones de una salida en vez de
-- guardar las de otro día (bug de las entradas retroactivas, Fase 0):
--   ok | parcial | error | sin_dato_hora | sin_dato_fecha_antigua (más de
--   90 días atrás) | sin_prevision_fecha_lejana (más de 15 días adelante).
--   null = salida anterior a esta migración.
--
-- Sin cambios de RLS: salidas_pesca ya es por propietario
-- (auth.uid() = user_id) y las columnas nuevas heredan esas policies. Sin
-- tablas ni funciones nuevas: supabase/baseline-seguridad.json no cambia.

alter table public.salidas_pesca
  add column if not exists indice_version text,
  add column if not exists indice_puntuacion smallint,
  add column if not exists indice_especie text,
  add column if not exists indice_factores jsonb,
  add column if not exists condiciones_estado text;

alter table public.salidas_pesca
  drop constraint if exists salidas_pesca_indice_puntuacion_rango,
  add constraint salidas_pesca_indice_puntuacion_rango
    check (indice_puntuacion is null or indice_puntuacion between 0 and 100);

alter table public.salidas_pesca
  drop constraint if exists salidas_pesca_condiciones_estado_valido,
  add constraint salidas_pesca_condiciones_estado_valido
    check (condiciones_estado is null or condiciones_estado in
      ('ok', 'parcial', 'error', 'sin_dato_hora', 'sin_dato_fecha_antigua', 'sin_prevision_fecha_lejana'));

comment on column public.salidas_pesca.indice_version is 'Versión de la fórmula del índice de pesca (p. ej. v2-logistica-2026-10-08)';
comment on column public.salidas_pesca.indice_puntuacion is 'Índice de pesca 0-100 a la hora de la salida (mejor especie de temporada de la modalidad)';
comment on column public.salidas_pesca.indice_especie is 'Id de especies.json de la especie que daba el índice';
comment on column public.salidas_pesca.indice_factores is 'Detalle del índice: factores y reglas (log-odds y puntos), fiabilidad, ranking de especies';
comment on column public.salidas_pesca.condiciones_estado is 'Por qué faltan (o no) las condiciones de la fecha de la salida';
