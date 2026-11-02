-- Costaviva — Global Fishing Watch: por tipo de arte y lo habitual en esta
-- época (2026-11-02, Mikel: "Sí. Haz todo").
--
-- SIN APLICAR: se aplica con aplicar-migraciones.yml desde main cuando
-- Mikel lo apruebe (etiqueta sql-aprobado en la PR).
--
-- Qué hace, en llano: la tabla gfw_esfuerzo (20261102120000) gana dos
-- columnas:
--   - periodo: 'reciente' (7 días que acaban hace 4, lo de hasta ahora) u
--     'habitual' (el mismo mes de los 3 años anteriores, media por año);
--   - arte: 'todas' o el grupo de arte de GFW (arrastre, cerco, palangre,
--     enmalle, otras).
-- Las filas que ya hay pasan a ser 'reciente' / 'todas'. La clave primaria
-- pasa a (region, periodo, arte, celda). Siguen sin guardarse barcos,
-- banderas ni rutas. Ni policies ni permisos cambian (baseline igual).

alter table public.gfw_esfuerzo add column if not exists periodo text not null default 'reciente';
alter table public.gfw_esfuerzo add column if not exists arte text not null default 'todas';
alter table public.gfw_esfuerzo drop constraint if exists gfw_esfuerzo_periodo_check;
alter table public.gfw_esfuerzo add constraint gfw_esfuerzo_periodo_check check (periodo in ('reciente', 'habitual'));
alter table public.gfw_esfuerzo drop constraint if exists gfw_esfuerzo_arte_check;
alter table public.gfw_esfuerzo add constraint gfw_esfuerzo_arte_check check (arte in ('todas', 'arrastre', 'cerco', 'palangre', 'enmalle', 'otras'));
alter table public.gfw_esfuerzo drop constraint if exists gfw_esfuerzo_pkey;
alter table public.gfw_esfuerzo add primary key (region, periodo, arte, celda_lat, celda_lon);
comment on table public.gfw_esfuerzo is 'Esfuerzo pesquero aparente de Global Fishing Watch (4Wings) por celda de 0,1°, región, periodo (reciente: 7 días que acaban hace 4; habitual: mismo mes de los 3 años anteriores) y grupo de arte. Capa GRATIS (condición de GFW). La escribe scripts/gfw/esfuerzo-gfw.mjs. 2026-11-02.';
