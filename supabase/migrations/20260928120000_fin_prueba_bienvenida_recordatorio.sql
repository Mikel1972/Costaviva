-- Fin de la prueba: o se suscribe o su cuenta queda desactivada (pedido
-- explicito del usuario, 2026-09-28): "hay un periodo de prueba de 7 dias sin
-- cobrar. A ese vencimiento, o se da de alta o se le cancela".
--
-- Calendario, contado desde el ALTA (perfiles.creado_en, la misma referencia
-- que usa mi_estado_suscripcion() para la prueba):
--   alta    email de bienvenida: la prueba acaba el dia 7 y que pasa despues
--   dia 5   recordatorio: "tu prueba acaba el dia 7"
--   dia 7   fin de prueba sin suscripcion -> cuenta desactivada + email
--
-- QUE ES "DESACTIVADA", y que NO: el acceso a la app ya lo corta el paywall
-- (mi_estado_suscripcion() da con_acceso=false pasada la prueba sin
-- suscripcion). Desactivar NO bloquea el login ni borra nada, a proposito:
--   - Puede volver a entrar para suscribirse y recupera todo lo suyo al
--     momento. Con el login bloqueado no podria ni pagar.
--   - Sus datos se conservan (decision del usuario: "no borremos los datos de
--     la cuenta ni los datos generados"). Sus capturas y salidas siguen
--     alimentando estadisticas_anonimas_capturas como hasta ahora, con el
--     consentimiento que dio en el alta (consiente_uso_datos_capturas).
-- desactivado_en deja constancia de cuando se cerro su prueba y de que se
-- le aviso.
--
-- La fecha de desactivacion que se le PROMETE en el recordatorio se guarda
-- (desactivar_previsto_en) y es la que manda: nunca se desactiva antes de lo
-- que dijo el email. Es el dia 7, salvo que el recordatorio saliera tarde
-- (fallo de Resend, o usuarios de antes de este cambio con la prueba ya
-- vencida): entonces se le dan al menos 2 dias desde el recordatorio.
--
-- Mismo patron que 20260925180000: la lista de a quien le toca cada paso la
-- decide Postgres, nunca el endpoint (functions/avisar-fin-prueba.js). Todas
-- las funciones son security definer con grant SOLO a service_role.
--
-- QUIEN NUNCA ENTRA EN ESTE CICLO (fin_prueba_fuera_de_ciclo):
--   - El admin.
--   - Los alias de prueba etxebe2005+...@gmail.com: son las cuentas de
--     smoke-test.yml y auth-test.yml.
--   - Quien haya tenido alguna vez una suscripcion de verdad (cualquier fila
--     en suscripciones salvo incomplete/incomplete_expired, checkouts que
--     nunca cobraron). Decision del usuario: el ex-suscriptor que cancela
--     solo pierde el acceso (lo hace ya el paywall); no tiene sentido
--     escribirle sobre una prueba que termino hace meses.
-- Y quien nunca confirmo su email: no se le puede avisar.
--
-- Sustituye al aviso de fin de prueba de 20260925180000 (que avisaba DESPUES
-- de vencer): ahora se avisa antes y el email del dia 7 es el de fin de
-- prueba. La columna fin_prueba_avisado se queda, sin uso, por historico.

alter table public.perfiles
  add column if not exists bienvenida_email_en timestamptz,
  add column if not exists fin_prueba_recordatorio_en timestamptz,
  add column if not exists desactivar_previsto_en timestamptz,
  add column if not exists desactivado_en timestamptz;

comment on column public.perfiles.bienvenida_email_en is
  'Cuándo se le mandó el email de bienvenida con las fechas de la prueba. Los perfiles anteriores al 2026-09-28 lo tienen relleno sin haberlo recibido.';
comment on column public.perfiles.fin_prueba_recordatorio_en is
  'Cuándo se le mandó el recordatorio de que su prueba termina (día 5).';
comment on column public.perfiles.desactivar_previsto_en is
  'Fecha de desactivación prometida en el recordatorio. Nunca se desactiva antes.';
comment on column public.perfiles.desactivado_en is
  'Cuándo terminó su prueba sin suscripción y se le avisó. No bloquea el login ni borra nada: el acceso lo corta el paywall y se recupera al suscribirse.';

-- Los perfiles que ya existen no reciben el email de bienvenida: ya llevan
-- tiempo en la app. Mismo criterio que bienvenida_pendiente (20260917110508).
update public.perfiles set bienvenida_email_en = now() where bienvenida_email_en is null;

-- El aviso de despues del vencimiento deja de existir.
drop function if exists public.usuarios_fin_prueba_pendiente_aviso();
drop function if exists public.marcar_fin_prueba_avisado(uuid);

-- Excepciones del ciclo, en un solo sitio para que todas las listas apliquen
-- exactamente las mismas.
create or replace function public.fin_prueba_fuera_de_ciclo(p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    exists (
      select 1 from auth.users u
      where u.id = p_user_id
        and (u.email = 'etxebe2005@gmail.com' or u.email like 'etxebe2005+%')
    )
    or exists (
      select 1 from public.suscripciones s
      where s.user_id = p_user_id
        and coalesce(s.estado, '') not in ('', 'incomplete', 'incomplete_expired')
    );
$$;
revoke all on function public.fin_prueba_fuera_de_ciclo(uuid) from public, authenticated, anon;
grant execute on function public.fin_prueba_fuera_de_ciclo(uuid) to service_role;

-- Bienvenida. Solo mientras quede margen (antes del dia 5): si alguien
-- confirma el email tarde, el recordatorio ya le cuenta lo mismo.
create or replace function public.usuarios_bienvenida_pendiente_email()
returns table (user_id uuid, email text, prueba_termina_en timestamptz)
language sql
security definer
set search_path = public
as $$
  select p.id, u.email::text, p.creado_en + interval '7 days'
  from public.perfiles p
  join auth.users u on u.id = p.id
  where p.bienvenida_email_en is null
    and u.email_confirmed_at is not null
    and p.creado_en + interval '5 days' > now()
    and not public.fin_prueba_fuera_de_ciclo(p.id);
$$;
revoke all on function public.usuarios_bienvenida_pendiente_email() from public, authenticated, anon;
grant execute on function public.usuarios_bienvenida_pendiente_email() to service_role;

create or replace function public.marcar_bienvenida_email(p_user_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.perfiles set bienvenida_email_en = now()
  where id = p_user_id and bienvenida_email_en is null;
$$;
revoke all on function public.marcar_bienvenida_email(uuid) from public, authenticated, anon;
grant execute on function public.marcar_bienvenida_email(uuid) to service_role;

-- Recordatorio (dia 5). La fecha que devuelve es la que se escribe en el
-- email y la que marcar_fin_prueba_recordatorio() guarda: la misma formula
-- en los dos sitios.
create or replace function public.usuarios_fin_prueba_pendiente_recordatorio()
returns table (user_id uuid, email text, desactivar_en timestamptz)
language sql
security definer
set search_path = public
as $$
  select p.id, u.email::text,
         greatest(p.creado_en + interval '7 days', now() + interval '2 days')
  from public.perfiles p
  join auth.users u on u.id = p.id
  where p.fin_prueba_recordatorio_en is null
    and p.desactivado_en is null
    and p.creado_en + interval '5 days' < now()
    and u.email_confirmed_at is not null
    and not public.fin_prueba_fuera_de_ciclo(p.id)
    and not exists (
      select 1 from public.suscripciones s
      where s.user_id = p.id and s.estado in ('trialing', 'active')
    );
$$;
revoke all on function public.usuarios_fin_prueba_pendiente_recordatorio() from public, authenticated, anon;
grant execute on function public.usuarios_fin_prueba_pendiente_recordatorio() to service_role;

-- Se marca SOLO despues de que Resend confirme el envio: si el correo falla,
-- no hay fecha prometida y no se desactiva.
create or replace function public.marcar_fin_prueba_recordatorio(p_user_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.perfiles
  set fin_prueba_recordatorio_en = now(),
      desactivar_previsto_en = greatest(creado_en + interval '7 days', now() + interval '2 days')
  where id = p_user_id and fin_prueba_recordatorio_en is null;
$$;
revoke all on function public.marcar_fin_prueba_recordatorio(uuid) from public, authenticated, anon;
grant execute on function public.marcar_fin_prueba_recordatorio(uuid) to service_role;

-- Desactivacion (dia 7, o la fecha prometida si fue mas tarde).
create or replace function public.usuarios_fin_prueba_pendiente_desactivar()
returns table (user_id uuid, email text)
language sql
security definer
set search_path = public
as $$
  select p.id, u.email::text
  from public.perfiles p
  join auth.users u on u.id = p.id
  where p.desactivar_previsto_en is not null
    and p.desactivar_previsto_en < now()
    and p.desactivado_en is null
    and not public.fin_prueba_fuera_de_ciclo(p.id)
    and not exists (
      select 1 from public.suscripciones s
      where s.user_id = p.id and s.estado in ('trialing', 'active')
    );
$$;
revoke all on function public.usuarios_fin_prueba_pendiente_desactivar() from public, authenticated, anon;
grant execute on function public.usuarios_fin_prueba_pendiente_desactivar() to service_role;

-- Marca la desactivacion. Se llama SOLO despues de que Resend confirme el
-- email de fin de prueba (si falla, se reintenta en la pasada siguiente).
-- Vuelve a comprobar las condiciones: si se suscribio entre la lista y
-- ahora, no se marca.
create or replace function public.desactivar_usuario_fin_prueba(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.usuarios_fin_prueba_pendiente_desactivar() c
    where c.user_id = p_user_id
  ) then
    return false;
  end if;
  update public.perfiles set desactivado_en = now() where id = p_user_id;
  return true;
end;
$$;
revoke all on function public.desactivar_usuario_fin_prueba(uuid) from public, authenticated, anon;
grant execute on function public.desactivar_usuario_fin_prueba(uuid) to service_role;

-- Cuantas personas de ANTES de este cambio (prueba ya vencida, sin
-- suscripcion) entran en el ciclo: recibiran el recordatorio en la primera
-- pasada y el email de fin de prueba 2 dias despues. Sale en el log de
-- "Aplicar migraciones" para saberlo antes de que el cron escriba a nadie.
-- Si pasa de 10, la guarda de volumen del endpoint frena el recordatorio y
-- avisa al admin.
do $$
declare
  v_afectados integer;
begin
  select count(*) into v_afectados
  from public.usuarios_fin_prueba_pendiente_recordatorio();
  raise notice 'Usuarios que recibiran ya el recordatorio de fin de prueba: %', v_afectados;
end $$;
