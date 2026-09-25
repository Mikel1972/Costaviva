-- Quitar el grandfathering a los usuarios REALES que ya tienen la prueba
-- vencida, para que reciban el aviso de fin de periodo (pedido explicito del
-- usuario, 2026-09-25: "hay un usuario que debiera recibirlo").
--
-- Contexto: la migracion 20260925180000 creo fin_prueba_avisado en TRUE para
-- todos los existentes, a proposito, para que la primera pasada del cron no
-- mandara un correo de golpe a todo el mundo. Ahora se revierte, pero SOLO
-- para quien de verdad toca.
--
-- QUIEN SE QUEDA FUERA, y por que:
--   - El admin (etxebe2005@gmail.com): tiene acceso permanente, el aviso no
--     aplica.
--   - Los alias de prueba (etxebe2005+...@gmail.com): son las cuentas de
--     smoke-test.yml y auth-test.yml. Peticion explicita del usuario: "de los
--     actuales, no hace falta enviar a los emails de prueba". Ademas llegan
--     todos al mismo buzon, asi que solo serian ruido.
--   - Quien tenga suscripcion viva: no ha terminado nada.
--   - Quien no haya confirmado su email: nunca llego a entrar.
-- Las tres ultimas condiciones las vuelve a comprobar
-- usuarios_fin_prueba_pendiente_aviso() antes de enviar, asi que esto es
-- defensa en profundidad, no la unica barrera.
do $$
declare
  v_afectados integer;
begin
  update public.perfiles p
  set fin_prueba_avisado = false
  where p.fin_prueba_avisado = true
    and p.creado_en + interval '7 days' < now()
    and exists (
      select 1 from auth.users u
      where u.id = p.id
        and u.email_confirmed_at is not null
        and u.email <> 'etxebe2005@gmail.com'
        and u.email not like 'etxebe2005+%'
    )
    and not exists (
      select 1 from public.suscripciones s
      where s.user_id = p.id and s.estado in ('trialing', 'active')
    );
  get diagnostics v_afectados = row_count;
  -- Sale en la salida de `supabase db push`, para saber a cuanta gente se le
  -- va a escribir ANTES de que el cron lo haga. Si el numero sorprende, hay
  -- 30 minutos para revertirlo.
  raise notice 'Usuarios que recibiran el aviso de fin de prueba: %', v_afectados;
end $$;
