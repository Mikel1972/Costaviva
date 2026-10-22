-- Costaviva — Primera venta en las lonjas de Galicia (2026-10-22, aprobado
-- por Mikel: para etiquetar las zonas calientes de la flota del AIS como
-- "probablemente <especie>").
--
-- SIN APLICAR: se aplica con aplicar-migraciones.yml desde main cuando
-- Mikel lo apruebe (etiqueta sql-aprobado en la PR).
--
-- Qué guarda: kg, euros y precio medio vendidos cada día en cada lonja por
-- especie, tal cual los publica la Xunta en
-- https://www.pescadegalicia.gal/informe-notasventa/agregation. Lo escribe
-- solo el robot scripts/lonjas/galicia.mjs (lonjas-galicia.yml, sin IA) con
-- service_role, cada día con upsert de D-1..D-3.
-- Fonte: Xunta de Galicia – pescadegalicia.gal. Aviso legal: reutilización
-- permitida citando la fuente y sin desnaturalizar los datos.
-- Las coordenadas de cada lonja no van en la base de datos: están en
-- scripts/lonjas/lonjas-galicia.json.
--
-- Estándares (comun estandares/supabase.md): RLS activada (D5); lectura
-- pública con policy explícita (D6) y ninguna policy de escritura (D7):
-- solo service_role. Mismo patrón que oleaje_camara_lecturas.

create table if not exists public.lonja_ventas (
  fecha date not null,
  region text not null default 'galicia',
  lonja text not null,
  especie text not null,
  kg numeric,
  importe numeric,
  precio_medio numeric,
  grupo text,
  primary key (fecha, region, lonja, especie)
);
create index if not exists lonja_ventas_especie_idx on public.lonja_ventas (region, especie, fecha desc);
alter table public.lonja_ventas enable row level security;
revoke all on public.lonja_ventas from anon, authenticated;
grant select on public.lonja_ventas to anon, authenticated;

drop policy if exists "lectura pública de las ventas en lonja" on public.lonja_ventas;
-- anon-ok: solo LECTURA; son datos abiertos de la Xunta (primera venta por
-- lonja y especie), sin ningún dato de usuarios ni de barcos.
create policy "lectura pública de las ventas en lonja"
  on public.lonja_ventas for select to anon, authenticated
  using (true);
-- Sin policies de escritura: solo service_role (el robot).

comment on table public.lonja_ventas is 'Primera venta diaria por lonja y especie (kg, €, €/kg). Galicia: Fonte: Xunta de Galicia – pescadegalicia.gal. Escribe solo service_role (scripts/lonjas/galicia.mjs). Coordenadas de las lonjas en scripts/lonjas/lonjas-galicia.json. 2026-10-22.';
