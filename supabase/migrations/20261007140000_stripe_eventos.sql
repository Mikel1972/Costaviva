-- Costa Viva — idempotencia del webhook de Stripe (public.stripe_eventos)
--
-- MOTIVO (Mikel1972/comun, estandares/stripe.md S3; 2026-10-07): Stripe
-- puede entregar el mismo evento más de una vez (reintentos, reenvíos
-- manuales desde el Dashboard). functions/stripe-webhook.js guarda aquí el
-- event.id antes de procesarlo; si ya estaba, responde 200 sin repetir nada.
-- Si el procesado falla, la Function borra la fila para que el reintento de
-- Stripe sí se procese.
--
-- Sin policies a propósito: solo service_role (el webhook) lee y escribe.
-- anon/authenticated sin ningún permiso.
--
-- ORDEN DE DESPLIEGUE: indiferente. Si la tabla aún no existe, el webhook
-- lo registra en el log y procesa el evento igual (los upserts por user_id
-- ya son idempotentes), así que desplegar el código antes no rompe nada.
--
-- AL APLICAR: actualizar supabase/baseline-seguridad.json con la tabla nueva
-- (RLS activado, sin policies) en el mismo paso, para que el vigía de esquema
-- no se ponga en rojo.

create table if not exists public.stripe_eventos (
  id text primary key,            -- event.id de Stripe (evt_...)
  tipo text not null,
  recibido_en timestamptz not null default now()
);
create index if not exists stripe_eventos_recibido_en_idx on public.stripe_eventos (recibido_en);
alter table public.stripe_eventos enable row level security;
-- Sin policies a propósito: solo service_role (el webhook) lee y escribe.
revoke all on public.stripe_eventos from anon, authenticated;
comment on table public.stripe_eventos is 'event.id de Stripe ya procesados por functions/stripe-webhook.js (Mikel1972/comun, estandares/stripe.md S3). Solo service_role.';
