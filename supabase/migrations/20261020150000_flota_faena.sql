-- Costaviva — Flota pesquera faenando, fase 1 (2026-10-20, Mikel: "por el
-- AIS sabemos dónde está la flota y dónde está faenando... zonas calientes
-- por tipo de barco").
--
-- SIN APLICAR: se aplica con aplicar-migraciones.yml desde main cuando
-- Mikel lo apruebe.
--
-- Qué guarda, en llano: el robot scripts/flota/flota-ais.mjs escucha el AIS
-- (aisstream.io) un rato cada hora, se queda solo con los PESQUEROS (tipo
-- AIS 30) que van despacio como cuando faenan (0,5-5 nudos), y apunta "este
-- barco faenó este día en esta celda de ~5 km". Nada más:
--   - ni nombre, ni MMSI, ni ruta, ni hora, ni posición exacta;
--   - el barco va como un resumen cifrado (HMAC) que no se puede deshacer,
--     solo sirve para contar barcos DISTINTOS por celda;
--   - se borra a los 60 días.
-- Fase 1: solo lo ve Mikel (resúmenes). Nada se publica en la app hasta que
-- él lo decida, y entonces solo celdas con al menos 5 barcos distintos.
--
-- Estándares (comun estandares/supabase.md): RLS sin policies (solo el robot
-- con service_role), revocado a anon y authenticated (D5/D6).

create table if not exists public.flota_faena (
  dia date not null,
  celda_lat numeric(6,2) not null,
  celda_lon numeric(6,2) not null,
  clase text not null check (clase in ('<24', '24-40', '>40', '?')),
  barco text not null,
  primary key (dia, celda_lat, celda_lon, barco)
);
alter table public.flota_faena enable row level security;
revoke all on public.flota_faena from anon, authenticated;
comment on table public.flota_faena is 'Pesqueros faenando por día y celda de 0,05° (AIS, fase 1). barco = HMAC del MMSI, no reversible. Sin policies: solo service_role. Se borra a los 60 días. 2026-10-20.';

-- Clase de eslora de cada barco (los mensajes estáticos llegan cada 6 min y
-- no siempre en la misma escucha que las posiciones).
create table if not exists public.flota_barcos (
  barco text primary key,
  clase text not null check (clase in ('<24', '24-40', '>40', '?')),
  visto date not null default current_date
);
alter table public.flota_barcos enable row level security;
revoke all on public.flota_barcos from anon, authenticated;
comment on table public.flota_barcos is 'Clase de eslora por barco pesquero (HMAC del MMSI). Sin policies: solo service_role. 2026-10-20.';
