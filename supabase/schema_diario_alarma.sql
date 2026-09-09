-- Costa Viva — Diario de capturas (agenda por dias) + Alarma SOS
--
-- Como usar: pega esto entero en el SQL Editor del proyecto de Supabase
-- "fishnow" y dale a "Run". Es autocontenido y no toca las tablas ya
-- existentes (perfiles), salvo anadirle una columna nueva.
--
-- Modelo de datos:
--   salidas_pesca: un dia (+ spot) de pesca de un usuario. Guarda el
--     contexto ambiental (marea/viento/oleaje/luna/presion) en el momento
--     de crearla.
--   capturas: cero o mas por salida — cada pez declarado.
--   captura_fotos: cero o mas por captura — permite varias fotos por pez.
--   contactos_emergencia / alertas_sos: para el boton SOS.
--
-- El color del dia en el calendario del diario se calcula en el cliente
-- mirando si la salida de ese dia tiene capturas o no — no hace falta
-- guardar ningun "color" en la base de datos.

alter table public.perfiles
  add column if not exists consiente_uso_datos_capturas boolean not null default false;

-- El consentimiento se recoge en el propio formulario de alta (login.html),
-- no despues — pero justo al hacer signUp() todavia no hay sesion activa si
-- "Confirm email" esta activado (como aqui), asi que una politica RLS de
-- UPDATE normal no serviria a tiempo. Se manda el valor como metadato del
-- propio signUp (options.data) y el trigger de alta lo copia a la columna
-- en el mismo momento en que crea la fila — sin necesitar sesion ni una
-- politica de UPDATE nueva sobre perfiles (que seguiria sin existir, para
-- que nadie pueda auto-aprobarse).
create or replace function public.gestionar_alta_perfil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfiles (id, email, aprobado, consiente_uso_datos_capturas)
  values (
    new.id,
    new.email,
    false,
    coalesce((new.raw_user_meta_data ->> 'consiente_uso_datos_capturas')::boolean, false)
  );
  return new;
end;
$$;

create table if not exists public.salidas_pesca (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  fecha date not null,
  spot_slug text,
  spot_nombre text,
  lat double precision,
  lon double precision,
  notas text,
  marea_altura numeric,
  marea_tendencia text,
  presion_valor numeric,
  presion_tendencia text,
  luna_fase text,
  luna_iluminacion numeric,
  viento_kmh numeric,
  viento_dir text,
  oleaje_altura_min numeric,
  oleaje_altura_max numeric,
  temp_agua numeric,
  nubosidad numeric,
  precipitacion numeric,
  creado_en timestamptz not null default now()
);

alter table public.salidas_pesca enable row level security;

create policy "cada usuario ve solo sus salidas"
  on public.salidas_pesca for select
  using (auth.uid() = user_id);

create policy "cada usuario inserta solo sus salidas"
  on public.salidas_pesca for insert
  with check (auth.uid() = user_id);

create policy "cada usuario actualiza solo sus salidas"
  on public.salidas_pesca for update
  using (auth.uid() = user_id);

create policy "cada usuario borra solo sus salidas"
  on public.salidas_pesca for delete
  using (auth.uid() = user_id);

create table if not exists public.capturas (
  id uuid primary key default gen_random_uuid(),
  salida_id uuid not null references public.salidas_pesca (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  especie text not null,
  talla_cm numeric,
  peso_g numeric,
  cebo text,
  aparejo text,
  notas text,
  creado_en timestamptz not null default now()
);

alter table public.capturas enable row level security;

create policy "cada usuario ve solo sus capturas"
  on public.capturas for select
  using (auth.uid() = user_id);

create policy "cada usuario inserta solo sus capturas"
  on public.capturas for insert
  with check (auth.uid() = user_id);

create policy "cada usuario borra solo sus capturas"
  on public.capturas for delete
  using (auth.uid() = user_id);

create table if not exists public.captura_fotos (
  id uuid primary key default gen_random_uuid(),
  captura_id uuid not null references public.capturas (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  foto_path text not null,
  orden int not null default 0,
  creado_en timestamptz not null default now()
);

alter table public.captura_fotos enable row level security;

create policy "cada usuario ve solo sus fotos"
  on public.captura_fotos for select
  using (auth.uid() = user_id);

create policy "cada usuario inserta solo sus fotos"
  on public.captura_fotos for insert
  with check (auth.uid() = user_id);

create policy "cada usuario borra solo sus fotos"
  on public.captura_fotos for delete
  using (auth.uid() = user_id);

create table if not exists public.contactos_emergencia (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  nombre text not null,
  email text not null,
  creado_en timestamptz not null default now()
);

alter table public.contactos_emergencia enable row level security;

create policy "cada usuario ve solo sus contactos"
  on public.contactos_emergencia for select
  using (auth.uid() = user_id);

create policy "cada usuario inserta solo sus contactos"
  on public.contactos_emergencia for insert
  with check (auth.uid() = user_id);

create policy "cada usuario borra solo sus contactos"
  on public.contactos_emergencia for delete
  using (auth.uid() = user_id);

create table if not exists public.alertas_sos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  lat double precision,
  lon double precision,
  tipo text not null default 'manual',
  creado_en timestamptz not null default now()
);

alter table public.alertas_sos enable row level security;

create policy "cada usuario ve solo sus alertas"
  on public.alertas_sos for select
  using (auth.uid() = user_id);

create policy "cada usuario inserta solo sus alertas"
  on public.alertas_sos for insert
  with check (auth.uid() = user_id);

-- Politicas del bucket "capturas-fotos" (crearlo antes a mano en el
-- dashboard: Storage > New bucket > privado, MIME image/*). Cada foto se
-- sube a la ruta "<user_id>/<archivo>.jpg" — estas politicas hacen que cada
-- usuario solo pueda subir/leer/borrar dentro de su propia carpeta.
create policy "cada usuario sube solo a su carpeta de capturas"
  on storage.objects for insert
  with check (bucket_id = 'capturas-fotos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "cada usuario lee solo su carpeta de capturas"
  on storage.objects for select
  using (bucket_id = 'capturas-fotos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "cada usuario borra solo su carpeta de capturas"
  on storage.objects for delete
  using (bucket_id = 'capturas-fotos' and (storage.foldername(name))[1] = auth.uid()::text);
