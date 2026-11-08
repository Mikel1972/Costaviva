-- Costaviva — aviso de las nuevas condiciones a las cuentas antiguas
-- (2026-10-22, decisión de Mikel).
--
-- Las cuentas de antes de la hoja de condiciones que no marcaron la casilla
-- de capturas anónimas siguen con perfiles.consiente_uso_datos_capturas =
-- false. Se les avisa por email (scripts/avisos/condiciones-2026-10.mjs,
-- workflow manual aviso-condiciones.yml) y, pasados 15 días, entran en las
-- estadísticas anónimas por interés legítimo (art. 6.1.f RGPD) salvo que se
-- hayan opuesto en «Tus datos» (suscripcion.html).
--
-- Para eso hacen falta dos fechas en perfiles:
--   aviso_condiciones_en       cuándo salió el email de aviso (lo pone el
--                              script con la service_role, solo tras
--                              confirmarlo Resend).
--   oposicion_estadisticas_en  cuándo se opuso la persona. La pone la RPC
--                              fijar_uso_capturas_estadisticas(false) y la
--                              borra la misma RPC con true. El paso
--                              "incluir" del script nunca toca a quien la
--                              tenga puesta.
--
-- Requiere 20261022233000_estadisticas_interes_legitimo.sql (la RPC). La
-- función se reescribe con las mismas propiedades de seguridad: security
-- definer, search_path fijo, solo la fila de auth.uid(), EXECUTE solo para
-- authenticated (D10 de comun), nunca anon.
--
-- Sin tablas nuevas ni cambios de RLS/policies: baseline-seguridad.json no
-- se toca. El usuario sigue sin UPDATE sobre estas columnas (solo nombre,
-- 20260913010000): las cambia la RPC o la service_role.

alter table public.perfiles
  add column if not exists oposicion_estadisticas_en timestamptz,
  add column if not exists aviso_condiciones_en timestamptz;

comment on column public.perfiles.oposicion_estadisticas_en is
  'Cuándo se opuso a las estadísticas anónimas (fijar_uso_capturas_estadisticas(false)); null si no se opone.';
comment on column public.perfiles.aviso_condiciones_en is
  'Cuándo se le envió el email de aviso de las condiciones de 2026-10 (scripts/avisos/condiciones-2026-10.mjs).';

create or replace function public.fijar_uso_capturas_estadisticas(p_usar boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usar boolean := coalesce(p_usar, false);
begin
  if auth.uid() is null then
    raise exception 'sin sesión';
  end if;
  update public.perfiles
     set consiente_uso_datos_capturas = v_usar,
         oposicion_estadisticas_en = case when v_usar then null else now() end
   where id = auth.uid();
  return v_usar;
end;
$$;

revoke execute on function public.fijar_uso_capturas_estadisticas(boolean) from public, anon;
grant execute on function public.fijar_uso_capturas_estadisticas(boolean) to authenticated;
