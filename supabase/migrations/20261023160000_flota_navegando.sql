-- Costaviva — Pesqueros EN EL MAR en movimiento (2026-10-23, aprobado por
-- Mikel: "escuchar 40 min y enseñar pesqueros en el mar, aunque no sepamos
-- si faenan").
--
-- SIN APLICAR: se aplica con aplicar-migraciones.yml desde main cuando
-- Mikel lo apruebe (etiqueta sql-aprobado en la PR).
--
-- Qué hace, en llano: la tabla flota_parados (20261023130000) acepta un
-- tercer tipo, 'navegando': pesqueros que se MUEVEN (velocidad mediana
-- >= 0,5 nudos) a más de 2 km de un puerto, por celda de 0,1° (~10 km),
-- clave 'nav:<lat>,<lon>' (esquina sur-oeste). Igual que los otros: barcos
-- DISTINTOS, solo 3 o más (el CHECK de n_barcos no cambia), sin eslora, sin
-- barcos ni posiciones de barcos. Solo se cambian los dos CHECK de clave y
-- tipo; ni policies ni permisos (supabase/baseline-seguridad.json igual).

alter table public.flota_parados drop constraint if exists flota_parados_clave_check;
alter table public.flota_parados drop constraint if exists flota_parados_tipo_check;
alter table public.flota_parados add constraint flota_parados_clave_check
  check (clave ~ '^(puerto:[a-z0-9-]+|(mar|nav):-?[0-9]+\.[0-9]{2},-?[0-9]+\.[0-9]{2})$');
alter table public.flota_parados add constraint flota_parados_tipo_check
  check (tipo in ('puerto', 'mar', 'navegando'));
comment on table public.flota_parados is 'Flota pesquera (AIS) en la última escucha: parada por puerto (< 2 km) o celda de 0,05° en el mar, y en movimiento en el mar por celda de 0,1° (tipo navegando); barcos distintos, solo >= 3. La escribe scripts/flota/flota-ais.mjs. 2026-10-23.';
