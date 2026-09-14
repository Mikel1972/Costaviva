-- Costa Viva — histórico de turbidez del agua por webcam (2026-09-14)
--
-- Pedido explícito del usuario tras el trabajo de estaciones AEMET y
-- webcams en vídeo de Gipuzkoa: aprovechar las mismas cámaras para una
-- lectura aproximada de "cuánta agua turbia hay" en cada spot.
--
-- No es una medida física real (NTU) — no tenemos ningún dato de
-- referencia para calibrar una escala absoluta, así que sería inventar
-- un número. En vez de eso se guarda un valor crudo (saturación/tono
-- medios del agua en HSV, ver puntuacionTurbidez() en
-- functions/prevision.js y su copia en index.html) y se compara
-- SIEMPRE contra el propio histórico de ESE spot — nunca entre spots
-- distintos, porque el ángulo/distancia/encuadre de cada cámara es
-- distinto y una comparación cruzada no significaría nada (mismo
-- criterio que coeficientePorSpot(), que ya existe en este repo).
--
-- Una lectura al día (siempre a la misma hora, mediodía en Madrid, para
-- que la luz ambiental sea lo más comparable posible día a día) — de
-- noche no hay luz suficiente para que esto signifique nada.
--
-- Igual que presion_historico: lectura pública, sin datos personales de
-- nadie. Solo escribe el endpoint protegido con secreto compartido
-- (functions/registrar-turbidez.js, mismo CRON_SECRET que ya usa
-- registrar-presion.js) usando la anon key — las políticas de select E
-- insert se crean juntas en esta misma migración, aprendiendo del fallo
-- real ya documentado en 20260912230000_fix_insert_presion_historico.sql
-- (crear solo la de select bloqueaba al propio endpoint con 42501).
create table if not exists public.turbidez_historico (
  id bigint generated always as identity primary key,
  spot_slug text not null,
  fecha date not null,
  saturacion_media real not null,
  tono_medio real,
  nubosidad integer,
  creado_en timestamptz not null default now(),
  unique (spot_slug, fecha)
);

create index if not exists turbidez_historico_spot_fecha
  on public.turbidez_historico (spot_slug, fecha desc);

alter table public.turbidez_historico enable row level security;

create policy "lectura pública de la turbidez histórica"
  on public.turbidez_historico for select
  using (true);

create policy "solo la anon key inserta (protegido por secreto en la función)"
  on public.turbidez_historico for insert
  to anon
  with check (true);

create policy "solo la anon key actualiza su propia fila del día (upsert)"
  on public.turbidez_historico for update
  to anon
  using (true)
  with check (true);
