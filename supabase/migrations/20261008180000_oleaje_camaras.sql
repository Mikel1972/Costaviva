-- Costa Viva — Oleaje por cámara: lecturas, etiquetas y miniaturas (2026-10-08)
--
-- Pedido de Mikel: "Si hay cámara, utiliza nuestro cálculo" y, para afinar
-- la calibración antes, una página solo para él donde etiquetar fotos de las
-- cámaras (banda de ola) y un botón "ola real que veo" en el panel del spot.
-- SIN APLICAR: se aplica con aplicar-migraciones.yml desde main cuando Mikel
-- lo apruebe, y en el MISMO cambio se usa supabase/baseline-seguridad.json
-- (ya actualizado en esta rama con las dos tablas y sus policies).
--
-- Qué crea:
--   1. oleaje_camara_lecturas: una fila por cámara, encuadre y medida (cada
--      30 min con luz). La escribe SOLO el workflow espuma-camaras.yml con
--      service_role. Se lee en público (/prevision la usa con la clave anon
--      para la altura "según cámara"): son métricas de píxeles de webcams
--      públicas, sin ningún dato de usuarios.
--   2. oleaje_etiquetas: las bandas de ola que pone la gente.
--        - origen 'foto': Mikel (es_admin()) sobre una lectura con miniatura
--          (etiquetar-olas.html).
--        - origen 'spot': cualquier usuario con sesión, desde el panel del
--          spot ("ola real que veo"). Solo con la hora de ahora (no se puede
--          etiquetar el pasado) y como mucho una cada 10 min por spot.
--      Cada uno ve y borra solo las suyas. Nadie las edita (se borra y se
--      vuelve a poner). El workflow las lee con service_role y entran en la
--      calibración con más peso que las lecturas automáticas.
--   3. Bucket "oleaje-camaras" para las miniaturas (320x180, ~10 KB):
--      lectura pública (fotogramas de webcams que ya se ven en público en la
--      app y en las webs de sus dueños); sin policies sobre storage.objects:
--      solo el workflow (service_role) sube y borra. Las miniaturas sin
--      etiquetar de más de 30 días se borran solas (medir-espuma.mjs).
--
-- Estándares (Mikel1972/comun estandares/supabase.md): RLS en las dos tablas
-- (D5); ninguna policy de escritura con `true` ni para anon (D7); la única
-- policy para anon es de LECTURA de las lecturas de cámara (anon-ok, ver
-- abajo); no hay funciones nuevas (D9-D11 no aplican: es_admin() ya existe,
-- es security definer con search_path fijo y se usa en la policy).

create table if not exists public.oleaje_camara_lecturas (
  id bigint generated always as identity primary key,
  fecha timestamptz not null,
  camara text not null,
  spot_slug text not null,
  encuadre text not null,
  estado text not null,
  espuma numeric,
  estimacion_m numeric,          -- altura estimada con este encuadre
  estimacion_camara_m numeric,   -- combinada de todos los encuadres de la cámara en esa medida
  rango_min_m numeric,
  rango_max_m numeric,
  error_rel numeric,             -- error relativo típico de la calibración (0,5 = ±50 %)
  sustituye_modelo boolean not null default false, -- false: cámara ruidosa sin calibrar, la app no la usa
  modelo_camara_m numeric,       -- modelo (con su factor) × coeficiente previo del sitio que ve la cámara
  mar_abierto_m numeric,
  dir_ola numeric,
  boya text,
  boya_hs_m numeric,
  miniatura text,                -- ruta en el bucket oleaje-camaras, o null
  creado_en timestamptz not null default now(),
  unique (camara, encuadre, fecha)
);
create index if not exists oleaje_camara_lecturas_fecha_idx on public.oleaje_camara_lecturas (fecha desc);
alter table public.oleaje_camara_lecturas enable row level security;
revoke all on public.oleaje_camara_lecturas from anon, authenticated;
grant select on public.oleaje_camara_lecturas to anon, authenticated;

drop policy if exists "lectura pública de las lecturas de oleaje por cámara" on public.oleaje_camara_lecturas;
-- anon-ok: solo LECTURA; son métricas de píxeles de webcams públicas y la
-- usa /prevision con la clave anon (mismo caso que camara_estado).
create policy "lectura pública de las lecturas de oleaje por cámara"
  on public.oleaje_camara_lecturas for select to anon, authenticated
  using (true);
-- Sin policies de escritura: solo service_role (el workflow).

create table if not exists public.oleaje_etiquetas (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  origen text not null check (origen in ('foto', 'spot')),
  lectura_id bigint references public.oleaje_camara_lecturas (id) on delete set null,
  spot_slug text not null check (spot_slug ~ '^[a-z0-9]{2,40}$'),
  banda text not null check (banda in ('<0.5', '0.5-1', '1-2', '2-3', '>3')),
  observado_en timestamptz not null default now(),
  creado_en timestamptz not null default now(),
  check (origen <> 'foto' or lectura_id is not null)
);
create index if not exists oleaje_etiquetas_lectura_idx on public.oleaje_etiquetas (lectura_id);
create index if not exists oleaje_etiquetas_user_spot_idx on public.oleaje_etiquetas (user_id, spot_slug, creado_en desc);
-- Una etiqueta por persona y foto (si se equivoca, la borra y la repite).
create unique index if not exists oleaje_etiquetas_una_por_foto on public.oleaje_etiquetas (user_id, lectura_id) where origen = 'foto';
alter table public.oleaje_etiquetas enable row level security;
revoke all on public.oleaje_etiquetas from anon, authenticated;
grant select, insert, delete on public.oleaje_etiquetas to authenticated;

drop policy if exists "cada usuario ve solo sus etiquetas de oleaje" on public.oleaje_etiquetas;
create policy "cada usuario ve solo sus etiquetas de oleaje"
  on public.oleaje_etiquetas for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "etiquetas de oleaje propias, de ahora o de foto si es admin" on public.oleaje_etiquetas;
create policy "etiquetas de oleaje propias, de ahora o de foto si es admin"
  on public.oleaje_etiquetas for insert to authenticated
  with check (
    auth.uid() = user_id
    and (
      -- Fotos: solo administradores (Mikel), sobre una lectura que existe.
      (origen = 'foto' and public.es_admin()
        and exists (select 1 from public.oleaje_camara_lecturas l where l.id = lectura_id))
      or
      -- Desde el spot: lo que se ve AHORA (±10 min), sin foto, y como mucho
      -- una cada 10 minutos por persona y spot.
      (origen = 'spot' and lectura_id is null
        and observado_en between now() - interval '10 minutes' and now() + interval '2 minutes'
        and not exists (
          select 1 from public.oleaje_etiquetas e
          where e.user_id = auth.uid() and e.spot_slug = oleaje_etiquetas.spot_slug
            and e.origen = 'spot' and e.creado_en > now() - interval '10 minutes'))
    )
  );

drop policy if exists "cada usuario borra solo sus etiquetas de oleaje" on public.oleaje_etiquetas;
create policy "cada usuario borra solo sus etiquetas de oleaje"
  on public.oleaje_etiquetas for delete to authenticated
  using (auth.uid() = user_id);
-- Sin UPDATE: se borra y se vuelve a poner.

-- Bucket de miniaturas: lectura pública, solo JPEG, 200 KB máximo.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('oleaje-camaras', 'oleaje-camaras', true, 204800, array['image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
