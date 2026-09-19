-- Costa Viva — failover de fuentes de webcam (2026-09-19)
--
-- Pedido explícito del usuario: guardar varias cámaras por spot cuando
-- existan (ver functions/webcam/[slug].js, WEBCAMS admite ahora un array
-- de URLs por slug) y, si la principal falla, servir la de reserva sin que
-- se note para quien usa la app -- pero sin esconder del todo que la
-- principal está fallando, para poder avisar de eso en el informe diario.
--
-- 0 = sirvió la fuente principal (o el spot solo tiene una fuente, el caso
-- normal hasta ahora). >0 = el proxy tuvo que recurrir a la fuente de
-- reserva de ese índice porque la anterior falló.
alter table public.camara_estado
  add column if not exists fuente_usada integer not null default 0;
