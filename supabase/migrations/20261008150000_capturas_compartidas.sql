-- Costa Viva — "Comparte tu captura" (anónimo, por captura, revocable)
--
-- Aprobado por Mikel el 2026-10-08 ("añade todo lo legal"). SIN APLICAR: se
-- aplica con aplicar-migraciones.yml desde main cuando Mikel lo apruebe, y en
-- el MISMO cambio se actualiza supabase/baseline-seguridad.json (vigía de
-- esquema) con las dos tablas y las tres policies de abajo.
--
-- Qué hace:
--   * Cada captura del diario tiene una casilla "Compartir de forma anónima"
--     (apagada por defecto). Marcarla inserta una fila en
--     capturas_compartidas (la marca, del propio usuario, solo la ve él).
--   * Un trigger copia a capturas_comunidad una versión ANÓNIMA: especie,
--     talla, peso redondeado, técnica, fecha, hora (sin minutos), zona
--     difuminada a una celda de ~5 km (nunca el punto) y las condiciones de
--     la salida. capturas_comunidad NO tiene user_id, ni captura_id, ni
--     salida_id, ni notas, ni cebo/señuelo de texto libre, ni fotos.
--   * Desmarcar (borrar la fila de capturas_compartidas), borrar la captura
--     o borrar la cuenta borra también la copia anónima (trigger + cascade).
--   * capturas_comunidad tiene RLS sin policies: nadie la lee directamente
--     (ni con la anon key ni con sesión). Solo se expone por funciones de
--     AGREGADOS con k-anonimato: un grupo solo sale si lo forman capturas de
--     al menos 5 USUARIOS DISTINTOS (no 5 capturas: 5 capturas de una misma
--     persona siguen siendo una persona). De momento solo las puede llamar
--     el backend (service_role); la app no las usa aún. Espejo en JS: agregarK() de
--     scripts/observaciones/lib.mjs, probado en test/observaciones.test.js.
--
-- Por qué una tabla de marcas y no una columna en capturas: capturas no tiene
-- policy de UPDATE en producción (supabase/baseline-seguridad.json), así que
-- "revocar" una captura ya guardada exigiría abrir el UPDATE de toda la fila.
-- Insertar/borrar una marca propia es más estrecho.
--
-- El enlace entre la copia anónima y su autor existe SOLO en
-- capturas_compartidas (comunidad_id), que cada usuario ve únicamente para
-- sí. Hace falta para poder retirar la copia y para contar usuarios
-- distintos en el k-anonimato. Lo dice el texto de privacidad.html.
--
-- Independiente de perfiles.consiente_uso_datos_capturas (el consentimiento
-- global del alta, que sigue alimentando solo los contadores
-- estadisticas_*_anonimas): aquí el consentimiento es explícito y por
-- captura.

-- Celda de ~5 km. Misma fórmula que celdaDifuminada() en
-- scripts/observaciones/lib.mjs (lo comprueba el test): filas de km/111,32
-- grados de latitud; columnas cuyo ancho en grados se ensancha con la latitud
-- del CENTRO de la fila, para que la celda mida lo mismo en km en Canarias
-- que en Hondarribia. Devuelve el centro, nunca el punto.
create or replace function public.celda_difuminada(p_lat double precision, p_lon double precision, p_km double precision default 5)
returns table (celda text, celda_lat numeric, celda_lon numeric)
language sql
immutable
set search_path = public, extensions
as $$
  with f as (
    select floor(p_lat / (p_km / 111.32)) as fila, p_km / 111.32 as paso_lat
  ), c as (
    select fila, (fila + 0.5) * paso_lat as lat_c from f
  ), l as (
    select fila, lat_c, p_km / (111.32 * cos(radians(lat_c))) as paso_lon from c
  )
  select fila::bigint || '_' || floor(p_lon / paso_lon)::bigint,
         round(lat_c::numeric, 4),
         round(((floor(p_lon / paso_lon) + 0.5) * paso_lon)::numeric, 4)
  from l
  where p_lat is not null and p_lon is not null;
$$;

create table if not exists public.capturas_comunidad (
  id uuid primary key default gen_random_uuid(),
  especie text not null,
  talla_cm numeric,
  peso_g numeric,
  tecnica text,
  tipo_salida text,
  fecha date not null,
  mes int not null check (mes between 1 and 12),
  hora smallint check (hora between 0 and 23),
  celda text,
  celda_lat numeric,
  celda_lon numeric,
  -- Solo spots del catálogo (públicos). Las ubicaciones personales
  -- (spots_usuario) nunca: quedan solo como celda difuminada.
  spot_slug text,
  marea_altura numeric,
  marea_tendencia text,
  marea_coeficiente integer,
  presion_valor numeric,
  presion_tendencia text,
  luna_fase text,
  viento_kmh numeric,
  viento_dir text,
  oleaje_altura_min numeric,
  oleaje_altura_max numeric,
  temp_agua numeric,
  nubosidad numeric,
  precipitacion numeric,
  -- Solo el día: una marca de tiempo exacta permitiría cruzarla con la
  -- actividad de la app.
  compartida_dia date not null default current_date
);
alter table public.capturas_comunidad enable row level security;
-- Sin policies a propósito (solo backend, comun D6): se lee solo por las
-- funciones de agregados de abajo.
revoke all on public.capturas_comunidad from anon, authenticated;

create table if not exists public.capturas_compartidas (
  captura_id uuid primary key references public.capturas (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  comunidad_id uuid,
  compartida_en timestamptz not null default now()
);
alter table public.capturas_compartidas enable row level security;
create index if not exists capturas_compartidas_comunidad_idx on public.capturas_compartidas (comunidad_id);

drop policy if exists "cada usuario ve solo sus capturas compartidas" on public.capturas_compartidas;
create policy "cada usuario ve solo sus capturas compartidas"
  on public.capturas_compartidas for select to authenticated
  using (auth.uid() = user_id);

-- Solo puede compartir capturas suyas.
drop policy if exists "cada usuario comparte solo sus capturas" on public.capturas_compartidas;
create policy "cada usuario comparte solo sus capturas"
  on public.capturas_compartidas for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.capturas c where c.id = captura_id and c.user_id = auth.uid())
  );

drop policy if exists "cada usuario retira solo sus capturas compartidas" on public.capturas_compartidas;
create policy "cada usuario retira solo sus capturas compartidas"
  on public.capturas_compartidas for delete to authenticated
  using (auth.uid() = user_id);
-- Sin UPDATE: para cambiar algo, se retira y se vuelve a compartir.

-- Construye la copia anónima de una captura. Devuelve su id.
create or replace function public.copiar_captura_a_comunidad(p_captura_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id uuid;
begin
  insert into public.capturas_comunidad (
    especie, talla_cm, peso_g, tecnica, tipo_salida, fecha, mes, hora,
    celda, celda_lat, celda_lon, spot_slug,
    marea_altura, marea_tendencia, marea_coeficiente, presion_valor, presion_tendencia,
    luna_fase, viento_kmh, viento_dir, oleaje_altura_min, oleaje_altura_max,
    temp_agua, nubosidad, precipitacion
  )
  select
    c.especie,
    round(c.talla_cm),
    round(c.peso_g / 50) * 50,
    c.tecnica,
    s.tipo_salida,
    s.fecha,
    extract(month from s.fecha)::int,
    extract(hour from c.hora)::smallint,
    d.celda, d.celda_lat, d.celda_lon,
    s.spot_slug,
    -- Marea de la SALIDA. capturas.marea_altura/marea_tendencia (marea en el
    -- momento de la captura) las escribe diario.html pero no están en ninguna
    -- migración (trampa 10): comprobar con `consultar` antes de usarlas aquí.
    s.marea_altura, s.marea_tendencia,
    s.marea_coeficiente, s.presion_valor, s.presion_tendencia,
    s.luna_fase, s.viento_kmh, s.viento_dir, s.oleaje_altura_min, s.oleaje_altura_max,
    s.temp_agua, s.nubosidad, s.precipitacion
  from public.capturas c
  join public.salidas_pesca s on s.id = c.salida_id
  left join lateral public.celda_difuminada(s.lat, s.lon) d on true
  where c.id = p_captura_id
    and c.especie is not null and trim(c.especie) <> ''
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.al_compartir_captura()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  new.comunidad_id := public.copiar_captura_a_comunidad(new.captura_id);
  new.compartida_en := now();
  return new;
end;
$$;

create or replace function public.al_retirar_captura_compartida()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if old.comunidad_id is not null then
    delete from public.capturas_comunidad where id = old.comunidad_id;
  end if;
  return old;
end;
$$;

-- Si algún día se edita una captura compartida (hoy capturas no tiene policy
-- de UPDATE), la copia anónima se rehace con los datos nuevos.
create or replace function public.al_editar_captura_compartida()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_viejo uuid;
begin
  select comunidad_id into v_viejo from public.capturas_compartidas where captura_id = new.id;
  if not found then
    return new;
  end if;
  if v_viejo is not null then
    delete from public.capturas_comunidad where id = v_viejo;
  end if;
  update public.capturas_compartidas
     set comunidad_id = public.copiar_captura_a_comunidad(new.id)
   where captura_id = new.id;
  return new;
end;
$$;

drop trigger if exists trg_compartir_captura on public.capturas_compartidas;
create trigger trg_compartir_captura
  before insert on public.capturas_compartidas
  for each row execute function public.al_compartir_captura();

drop trigger if exists trg_retirar_captura_compartida on public.capturas_compartidas;
create trigger trg_retirar_captura_compartida
  after delete on public.capturas_compartidas
  for each row execute function public.al_retirar_captura_compartida();

drop trigger if exists trg_editar_captura_compartida on public.capturas;
create trigger trg_editar_captura_compartida
  after update on public.capturas
  for each row execute function public.al_editar_captura_compartida();

-- ---------------------------------------------------------------------------
-- Agregados con k-anonimato (k = 5 usuarios distintos)
-- ---------------------------------------------------------------------------

-- Por especie, zona (celda de ~5 km) y mes. Para el mapa de "qué sale por
-- aquí" y para el índice. Nunca la hora exacta: franja.
create or replace function public.comunidad_capturas_por_zona(p_especie text default null)
returns table (especie text, celda text, celda_lat numeric, celda_lon numeric, mes int, franja text, capturas int, talla_media_cm numeric)
language sql
security definer
set search_path = public, extensions
stable
as $$
  select cc.especie, cc.celda, cc.celda_lat, cc.celda_lon, cc.mes,
         case when cc.hora is null then null
              when cc.hora < 6 then 'madrugada' when cc.hora < 12 then 'manana'
              when cc.hora < 18 then 'tarde' else 'noche' end as franja,
         count(*)::int,
         round(avg(cc.talla_cm), 0)
  from public.capturas_comunidad cc
  join public.capturas_compartidas x on x.comunidad_id = cc.id
  where cc.celda is not null
    and (p_especie is null or cc.especie = p_especie)
  group by 1, 2, 3, 4, 5, 6
  having count(distinct x.user_id) >= 5;
$$;

-- Por especie, mes y condiciones (marea, presión, oleaje en tramos), sin
-- zona. Para validar las reglas del índice de pesca.
create or replace function public.comunidad_capturas_por_condiciones(p_especie text default null)
returns table (especie text, mes int, marea_tendencia text, presion_tendencia text, oleaje_tramo text, capturas int)
language sql
security definer
set search_path = public, extensions
stable
as $$
  select cc.especie, cc.mes, cc.marea_tendencia, cc.presion_tendencia,
         case when cc.oleaje_altura_max is null then null
              when cc.oleaje_altura_max < 1 then '<1 m'
              when cc.oleaje_altura_max < 2 then '1-2 m'
              else '>=2 m' end,
         count(*)::int
  from public.capturas_comunidad cc
  join public.capturas_compartidas x on x.comunidad_id = cc.id
  where (p_especie is null or cc.especie = p_especie)
  group by 1, 2, 3, 4, 5
  having count(distinct x.user_id) >= 5;
$$;

-- Permisos (comun, supabase.md D10).
revoke execute on function public.celda_difuminada(double precision, double precision, double precision) from public, anon, authenticated;
revoke execute on function public.copiar_captura_a_comunidad(uuid) from public, anon, authenticated;
revoke execute on function public.al_compartir_captura() from public, anon, authenticated;
revoke execute on function public.al_retirar_captura_compartida() from public, anon, authenticated;
revoke execute on function public.al_editar_captura_compartida() from public, anon, authenticated;
-- Las dos de agregados tampoco se conceden a authenticated mientras la app no
-- las llame (D10: a authenticated solo si lo necesita). Se concede
-- EXECUTE to authenticated en la migración que las use desde el cliente.
-- Mientras tanto solo el backend (service_role) puede llamarlas.
revoke execute on function public.comunidad_capturas_por_zona(text) from public, anon, authenticated;
revoke execute on function public.comunidad_capturas_por_condiciones(text) from public, anon, authenticated;
grant execute on function public.comunidad_capturas_por_zona(text) to service_role;
grant execute on function public.comunidad_capturas_por_condiciones(text) to service_role;
