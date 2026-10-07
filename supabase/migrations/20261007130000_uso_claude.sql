-- Costa Viva — registro del gasto de Claude (public.uso_claude)
--
-- MOTIVO (Mikel1972/comun, estandares/claude-api.md C5; 2026-10-07): tabla
-- idéntica en los 4 proyectos. functions/_lib/uso-claude.js escribe una fila
-- por cada llamada a la API de Claude (hoy solo identificar-captura.js) y el
-- informe diario de `comun` la lee por conexión directa.
--
-- Sin policies a propósito: solo service_role (Functions) escribe y solo el
-- informe (conexión directa) lee. anon/authenticated sin ningún permiso.
--
-- ORDEN DE DESPLIEGUE: indiferente. El helper tolera que la tabla no exista
-- (avisa una vez por instancia y deja de intentarlo).
--
-- AL APLICAR: actualizar supabase/baseline-seguridad.json con la tabla nueva
-- (RLS activado, sin policies) en el mismo paso, para que el vigía de esquema
-- no se ponga en rojo. No se hace antes de aplicar por el mismo motivo.

create table if not exists public.uso_claude (
  id bigint generated always as identity primary key,
  creado_en timestamptz not null default now(),
  funcion text not null,
  modelo text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cache_creation_input_tokens integer not null default 0,
  cache_read_input_tokens integer not null default 0,
  max_tokens integer,
  ok boolean not null default true,
  codigo text,
  user_id uuid
);
create index if not exists uso_claude_creado_en_idx on public.uso_claude (creado_en);
alter table public.uso_claude enable row level security;
-- Sin policies a propósito: solo service_role (Functions) escribe y solo el informe (conexión directa) lee.
revoke all on public.uso_claude from anon, authenticated;
comment on table public.uso_claude is 'Gasto de cada llamada a la API de Claude (Mikel1972/comun, estandares/claude-api.md C5). Solo service_role.';
