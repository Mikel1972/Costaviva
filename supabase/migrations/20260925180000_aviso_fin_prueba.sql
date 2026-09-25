-- Aviso por email cuando se acaba la prueba de 7 dias y no hay suscripcion
-- (pedido explicito del usuario, 2026-09-25: "cuando se pasa el periodo de
-- prueba y no renuevan, hay que mandarles un email diciendo que el periodo
-- se ha terminado").
--
-- Mismo patron que los avisos de alta (migracion 20260917080000): una
-- columna "*_avisado" en perfiles, una funcion que devuelve los pendientes y
-- otra que marca, las dos security definer y con grant SOLO a service_role.
-- La diferencia importante es a quien se escribe: aquellos avisos van al
-- admin, este va al USUARIO. Por eso lleva mas condiciones de seguridad.
--
-- GRANDFATHERING, y es la parte critica: la columna nace en TRUE y solo
-- despues pasa a default false. Sin esto, la primera pasada del cron
-- mandaria un correo de golpe a todos los usuarios cuya prueba ya venciera
-- -- incluida gente que se fue hace semanas. Avisar de algo que caduco hace
-- un mes no es util, es spam. Mismo truco que se uso con
-- email_confirmado_avisado.
alter table public.perfiles
  add column if not exists fin_prueba_avisado boolean not null default true;
alter table public.perfiles alter column fin_prueba_avisado set default false;
-- Quien merece el aviso. Cuatro condiciones, todas necesarias:
--   1. Su prueba de 7 dias (desde perfiles.creado_en, igual que
--      mi_estado_suscripcion) ya termino.
--   2. NO tiene suscripcion viva. Se mira con "not exists" en vez de un
--      left join: un usuario puede tener varias filas en suscripciones
--      (altas y bajas sucesivas) y un join duplicaria el aviso.
--   3. Confirmo su email. Escribir a quien nunca activo la cuenta es
--      molestar a alguien que ni llego a entrar.
--   4. No se le ha avisado ya.
-- El admin queda fuera: tiene acceso permanente y el aviso no aplica.
create or replace function public.usuarios_fin_prueba_pendiente_aviso()
returns table (user_id uuid, email text, prueba_termino_en timestamptz)
language sql
security definer
set search_path = public
as $$
  select p.id, u.email::text, p.creado_en + interval '7 days'
  from public.perfiles p
  join auth.users u on u.id = p.id
  where p.fin_prueba_avisado = false
    and p.creado_en + interval '7 days' < now()
    and u.email_confirmed_at is not null
    and u.email <> 'etxebe2005@gmail.com'
    and not exists (
      select 1 from public.suscripciones s
      where s.user_id = p.id and s.estado in ('trialing', 'active')
    );
$$;
revoke all on function public.usuarios_fin_prueba_pendiente_aviso() from public, authenticated, anon;
grant execute on function public.usuarios_fin_prueba_pendiente_aviso() to service_role;
-- Marcar como avisado. Se llama SIEMPRE despues de que Resend confirme el
-- envio, nunca antes: si se marcara primero y el envio fallara, ese usuario
-- se quedaria sin aviso para siempre y nadie se enteraria.
create or replace function public.marcar_fin_prueba_avisado(p_user_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.perfiles set fin_prueba_avisado = true where id = p_user_id;
$$;
revoke all on function public.marcar_fin_prueba_avisado(uuid) from public, authenticated, anon;
grant execute on function public.marcar_fin_prueba_avisado(uuid) to service_role;
comment on column public.perfiles.fin_prueba_avisado is
  'Si ya se le avisó por email de que su prueba de 7 días terminó. Nace en true para los usuarios existentes (grandfathering) y en false para las altas nuevas.';
