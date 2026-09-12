-- Costa Viva — histórico real de presión atmosférica (Fase 4 del plan de mejoras)
--
-- Hoy la tendencia de presión se calcula al vuelo comparando dentro del
-- mismo forecast de Open-Meteo (la hora actual contra la de "3h antes"
-- del MISMO modelo, no lo que de verdad pasó). Esta tabla guarda una
-- lectura real de presión por spot cada hora (vía
-- functions/registrar-presion.js + cron .github/workflows/presion-historico.yml)
-- para poder calcular la tendencia contra historia real.
--
-- No son datos personales de nadie — lectura pública para cualquiera
-- (ni siquiera hace falta sesión). Sin política de insert/update/delete
-- para anon/authenticated: solo escribe el endpoint protegido con
-- secreto compartido (ver registrar-presion.js) usando la anon key.
-- Nota de seguridad ya documentada en CLAUDE.md: como la anon key es
-- pública por diseño, alguien con la key podría en teoría insertar filas
-- directamente saltándose el endpoint — riesgo aceptado (solo números de
-- presión, no datos personales), igual que otros riesgos ya aceptados
-- conscientemente en este repo.
create table if not exists public.presion_historico (
  id bigint generated always as identity primary key,
  spot_slug text not null,
  medido_en timestamptz not null default now(),
  valor_hpa numeric not null
);

create index if not exists presion_historico_spot_fecha
  on public.presion_historico (spot_slug, medido_en desc);

alter table public.presion_historico enable row level security;

create policy "lectura pública de la presión histórica"
  on public.presion_historico for select
  using (true);
