-- Zona de precio por el país de la tarjeta y por el uso (2026-11-25, Mikel:
-- «móntalo ya» y «si vemos una actividad relacionada con NZ, le avisaremos
-- aunque sea después»). CLAUDE.md, "Zona de precio por el país de la tarjeta".
--
-- Solo columnas nuevas en public.suscripciones, con sus checks. Sin tablas
-- nuevas ni cambios de RLS/policies: el usuario sigue leyendo solo su fila y
-- solo escribe el service_role (stripe-webhook.js y dispositivos.js).

-- 1. País emisor de la tarjeta del último pago con tarjeta y su zona de precio.
alter table public.suscripciones
  add column if not exists pais_tarjeta text,
  add column if not exists zona_tarjeta text;

-- 2. Países (solo el código de 2 letras, nunca la IP) desde los que abre la
--    app quien paga con tarjeta, por día y solo de los últimos 14 días:
--    {"2026-11-25": ["NZ"], ...}.
alter table public.suscripciones
  add column if not exists paises_uso jsonb;

-- 3. Corrección de zona (una vez por suscripción de Stripe):
--    zona_corregir_a        zona a la que pasa (o que habría que revisar);
--    zona_correccion        'cambiada' (precio nuevo desde la próxima factura)
--                           | 'no_renovar_moneda' (otra moneda: Stripe no deja
--                           cambiarla; no se renueva al acabar lo pagado y se
--                           avisa para volver a suscribirse al precio de su
--                           país) | 'revisar_moneda' (otra moneda sin poder
--                           avisar; a mano) | 'revisar_programado' (tenía
--                           un cambio de plan programado; a mano);
--    zona_correccion_origen 'tarjeta' | 'uso';
--    zona_correccion_sub    la suscripción de Stripe corregida;
--    zona_aviso_enviado_en  cuándo salió el email de aviso.
alter table public.suscripciones
  add column if not exists zona_corregir_a text,
  add column if not exists zona_correccion text,
  add column if not exists zona_correccion_origen text,
  add column if not exists zona_correccion_sub text,
  add column if not exists zona_aviso_enviado_en timestamptz;

alter table public.suscripciones
  drop constraint if exists suscripciones_pais_tarjeta_check,
  drop constraint if exists suscripciones_zona_tarjeta_check,
  drop constraint if exists suscripciones_paises_uso_check,
  drop constraint if exists suscripciones_zona_corregir_a_check,
  drop constraint if exists suscripciones_zona_correccion_check,
  drop constraint if exists suscripciones_zona_correccion_origen_check;

alter table public.suscripciones
  add constraint suscripciones_pais_tarjeta_check
    check (pais_tarjeta is null or pais_tarjeta ~ '^[A-Z]{2}$'),
  add constraint suscripciones_zona_tarjeta_check
    check (zona_tarjeta is null or zona_tarjeta ~ '^[a-z_]{2,20}$'),
  add constraint suscripciones_paises_uso_check
    check (paises_uso is null or (jsonb_typeof(paises_uso) = 'object' and pg_column_size(paises_uso) < 4096)),
  add constraint suscripciones_zona_corregir_a_check
    check (zona_corregir_a is null or zona_corregir_a ~ '^[a-z_]{2,20}$'),
  add constraint suscripciones_zona_correccion_check
    check (zona_correccion is null or zona_correccion in ('cambiada', 'no_renovar_moneda', 'revisar_moneda', 'revisar_programado')),
  add constraint suscripciones_zona_correccion_origen_check
    check (zona_correccion_origen is null or zona_correccion_origen in ('tarjeta', 'uso'));
