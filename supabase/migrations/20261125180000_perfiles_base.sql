-- Base (zona de pesca) de cada usuario (2026-11-25, Mikel: quitar el código
-- postal del alta y "ubicarlo de acuerdo a la localización de la IP y
-- preguntar si quiere que esa sea su base"). La app propone la ubicación
-- aproximada que da Cloudflare (request.cf, nunca se guarda la IP) y el
-- usuario la acepta, o elige otro punto tocando el mapa. Sirve para abrir el
-- mapa en su zona. Sin tabla nueva ni políticas nuevas: la de UPDATE de
-- perfiles ya limita a la fila propia, y el permiso por columnas solo abre
-- estas cinco (además de "nombre", que ya estaba).
alter table public.perfiles
  add column if not exists base_lat double precision,
  add column if not exists base_lon double precision,
  add column if not exists base_nombre text,
  add column if not exists base_origen text,
  add column if not exists base_fijada_en timestamptz;

alter table public.perfiles drop constraint if exists perfiles_base_coordenadas;
alter table public.perfiles add constraint perfiles_base_coordenadas check (
  (base_lat is null and base_lon is null)
  or (base_lat between -90 and 90 and base_lon between -180 and 180)
);
alter table public.perfiles drop constraint if exists perfiles_base_origen;
alter table public.perfiles add constraint perfiles_base_origen check (base_origen is null or base_origen in ('ip', 'mapa'));
alter table public.perfiles drop constraint if exists perfiles_base_nombre_largo;
alter table public.perfiles add constraint perfiles_base_nombre_largo check (base_nombre is null or char_length(base_nombre) <= 120);

grant update (base_lat, base_lon, base_nombre, base_origen, base_fijada_en) on public.perfiles to authenticated;
