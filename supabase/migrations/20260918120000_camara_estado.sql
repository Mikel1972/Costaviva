-- Costa Viva — estado de "sin señal" por webcam (2026-09-18)
--
-- Pedido explícito del usuario: un punto rojo automático cuando se detecta
-- que una webcam no está devolviendo imagen real, sin distinguir de noche
-- (frame legítimamente oscuro) de una cámara caída de verdad — decisión
-- explícita suya, no un descuido: "si nuestra revisión no percibe nada de
-- nada en la imagen es como si la cámara no funcionara". Por eso esto NO
-- intenta ninguna heurística de hora/luz — solo mide si el frame tiene
-- variación real de brillo (ver scripts/camaras/comprobar-camaras.mjs), y
-- un frame de noche real casi siempre sí tiene algo de esa variación
-- (luces, ruido de sensor, horizonte) frente a un frame de error/tapado,
-- que suele salir plano de verdad.
--
-- A diferencia de turbidez_historico (una fila nueva por spot y día, para
-- construir un histórico), aquí solo interesa el ESTADO ACTUAL de cada
-- cámara — una fila por spot, sobrescrita en cada pasada del robot
-- (scripts/camaras/comprobar-camaras.mjs vía .github/workflows/
-- camaras-salud.yml, cada 30 min). Mismo patrón de RLS que
-- turbidez_historico/presion_historico: lectura pública, sin datos
-- personales de nadie; solo escribe el endpoint protegido con el mismo
-- CRON_SECRET compartido (functions/registrar-estado-camaras.js) usando
-- la anon key.
create table if not exists public.camara_estado (
  spot_slug text primary key,
  sin_senal boolean not null,
  motivo text not null,
  comprobado_en timestamptz not null default now(),
  -- Última vez que SÍ hubo señal real — para poder mostrar "sin señal
  -- desde hace X" en vez de solo un punto rojo sin contexto. Null si nunca
  -- se ha visto una imagen válida desde que existe esta tabla.
  ultima_senal_en timestamptz
);

alter table public.camara_estado enable row level security;

create policy "lectura pública del estado de las cámaras"
  on public.camara_estado for select
  using (true);

create policy "solo la anon key inserta (protegido por secreto en la función)"
  on public.camara_estado for insert
  to anon
  with check (true);

create policy "solo la anon key actualiza (protegido por secreto en la función)"
  on public.camara_estado for update
  to anon
  using (true)
  with check (true);
