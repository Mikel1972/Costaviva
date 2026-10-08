-- Costa Viva — WhatsApp en los contactos de emergencia (lista prefijada)
--
-- Pedido de Mikel el 2026-10-08: "En las alarmas, también debiera haber una
-- lista prefijada para los WhatsApp." SIN APLICAR: se aplica con
-- aplicar-migraciones.yml desde main cuando Mikel lo apruebe. En el MISMO
-- cambio se ha actualizado supabase/baseline-seguridad.json (vigía de
-- esquema) con la policy nueva de UPDATE.
--
-- Qué hace:
--   * Añade a contactos_emergencia la columna whatsapp: el teléfono del
--     contacto en formato internacional E.164 (+34612345678). Los contactos
--     que la tienen forman la "lista de WhatsApp": tras pulsar SOS (o tras la
--     cuenta atrás de la detección de caída) alarma.html enseña un botón por
--     contacto que abre WhatsApp con el mensaje y la ubicación ya escritos.
--     Coste cero: enlaces wa.me, sin la API de WhatsApp Business. El envío lo
--     confirma la persona; el email sigue saliendo solo.
--   * El email deja de ser obligatorio: un contacto puede tener email,
--     WhatsApp o los dos, pero al menos uno (CHECK). functions/sos-alerta.js
--     ya pide solo los contactos con email (email=not.is.null).
--   * Policy de UPDATE solo para el dueño, para poder añadir el WhatsApp a
--     un contacto ya guardado sin borrarlo. Select, insert y delete ya eran
--     solo del dueño (baseline-seguridad.json); no se tocan.
--
-- Por qué una columna y no una tabla aparte: es la misma persona; con dos
-- tablas Ana saldría dos veces y habría que mantener dos listas.
--
-- Sin funciones nuevas, así que no hay search_path ni EXECUTE que fijar.
-- Nada para anon: la policy nueva va "to authenticated".

alter table public.contactos_emergencia enable row level security;

alter table public.contactos_emergencia
  add column if not exists whatsapp text;

-- Misma expresión que PATRON_E164 de assets/js/sos-whatsapp.js (lo comprueba
-- test/sos-whatsapp.test.js).
alter table public.contactos_emergencia
  drop constraint if exists contactos_emergencia_whatsapp_e164;
alter table public.contactos_emergencia
  add constraint contactos_emergencia_whatsapp_e164
  check (whatsapp is null or whatsapp ~ '^\+[1-9][0-9]{7,14}$');

alter table public.contactos_emergencia
  alter column email drop not null;

alter table public.contactos_emergencia
  drop constraint if exists contactos_emergencia_email_o_whatsapp;
alter table public.contactos_emergencia
  add constraint contactos_emergencia_email_o_whatsapp
  check (email is not null or whatsapp is not null);

drop policy if exists "cada usuario actualiza solo sus contactos" on public.contactos_emergencia;
create policy "cada usuario actualiza solo sus contactos"
  on public.contactos_emergencia for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
