-- Costa Viva — conteo agregado de alertas SOS, para el informe diario
--
-- Por qué existe: `alertas_sos` tiene RLS (cada usuario ve solo las suyas),
-- así que con la anon key un informe diario no puede hacer
-- `select count(*) from alertas_sos` — vería 0 siempre. La alternativa
-- NUNCA es usar la service_role key desde un workflow (eso sí sería un
-- hallazgo real de seguridad). En vez de eso: una función `security
-- definer` que SOLO devuelve un número agregado de las últimas 24h, nunca
-- filas ni user_id ni ubicación — el mismo dato que ya se pensaba mandar
-- en el informe ("cuántas alarmas SOS se han disparado, sin exponer datos
-- personales").
create or replace function public.contar_alertas_sos_24h()
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select count(*)::integer from public.alertas_sos
  where creado_en > now() - interval '24 hours';
$$;

-- Solo el conteo es público (via anon key) — la tabla en sí sigue con su
-- RLS de siempre, esta función es la única puerta y no expone filas.
grant execute on function public.contar_alertas_sos_24h() to anon;
