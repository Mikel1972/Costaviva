-- Costa Viva — caché del coeficiente de marea por spot
--
-- El cálculo de coeficientePorSpot() (rango de marea real normalizado
-- contra un ciclo vivas-muertas de ~24 días, ver CLAUDE.md 2026-09-13)
-- necesita una ventana de datos ancha para los 95 spots a la vez —
-- hacerlo dentro de /prevision (en cada petición de cualquier usuario)
-- resultó poco fiable en real: Cloudflare devolvía a veces
-- "error 1102" (límite de recursos del Worker) de forma intermitente,
-- incluso tras reducir el payload a una sola variable.
--
-- Se mueve el cálculo a una rutina programada (cada hora, junto con
-- registrar-presion.js) que lo calcula UNA vez para todos los spots y
-- lo guarda aquí — /prevision pasa a hacer una lectura ligera de esta
-- tabla en vez de pedir la ventana ancha en cada petición de cada
-- usuario. Lectura pública (no son datos personales); solo escribe el
-- endpoint protegido con el mismo secreto compartido que
-- registrar-presion.js.
create table if not exists public.coeficiente_marea_actual (
  spot_slug text primary key,
  valor integer not null,
  actualizado_en timestamptz not null default now()
);

alter table public.coeficiente_marea_actual enable row level security;

create policy "lectura pública del coeficiente de marea"
  on public.coeficiente_marea_actual for select
  using (true);

create policy "la anon key actualiza (protegido por secreto en la función)"
  on public.coeficiente_marea_actual for insert
  to anon
  with check (true);

create policy "la anon key actualiza (protegido por secreto en la función), update"
  on public.coeficiente_marea_actual for update
  to anon
  using (true)
  with check (true);
