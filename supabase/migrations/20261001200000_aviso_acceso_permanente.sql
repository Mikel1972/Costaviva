-- Email de aviso a las cuentas con acceso permanente (2026-10-01, pedido del
-- usuario: "como tienes enchufe, esta app es gratis para ti!!").
--
-- Lo envía /avisar-fin-prueba (functions/avisar-fin-prueba.js) como un paso
-- más, igual que la bienvenida: una vez por email, marcado solo después de
-- que Resend confirme el envío. Va por email y no por user_id porque la
-- persona puede no tener cuenta todavía.

alter table public.accesos_permanentes
  add column if not exists avisado_en timestamptz;

create or replace function public.accesos_permanentes_pendiente_aviso()
returns table (email text)
language sql
security definer
set search_path = public
stable
as $$
  select a.email from public.accesos_permanentes a
  where a.avisado_en is null
  order by a.creado_en;
$$;
revoke all on function public.accesos_permanentes_pendiente_aviso() from public, anon, authenticated;
grant execute on function public.accesos_permanentes_pendiente_aviso() to service_role;

create or replace function public.marcar_acceso_permanente_avisado(p_email text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.accesos_permanentes
  set avisado_en = now()
  where email = lower(p_email) and avisado_en is null;
$$;
revoke all on function public.marcar_acceso_permanente_avisado(text) from public, anon, authenticated;
grant execute on function public.marcar_acceso_permanente_avisado(text) to service_role;
