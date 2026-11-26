-- País de residencia declarado antes de pagar (2026-11-25, aprobado por
-- Mikel). CLAUDE.md, "País de residencia obligatorio antes de pagar".
--
-- Decide la zona de precio (en vez del país de la conexión) y es una de las
-- tres pruebas de residencia para el IVA (con el país de la tarjeta y el de
-- la conexión/uso). Lo escribe solo el service_role (stripe-webhook.js) con
-- metadata.pais_residencia del checkout. Solo una columna con su check: sin
-- tablas nuevas ni cambios de RLS/policies.
alter table public.suscripciones
  add column if not exists pais_residencia text;

alter table public.suscripciones
  drop constraint if exists suscripciones_pais_residencia_check;

alter table public.suscripciones
  add constraint suscripciones_pais_residencia_check
    check (pais_residencia is null or pais_residencia ~ '^[A-Z]{2}$');
