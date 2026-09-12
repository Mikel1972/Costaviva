-- Costa Viva — grupos privados (Fase 5 del plan de mejoras)
--
-- Cuadrillas de amigos que quieren compartir entre ellos ubicaciones,
-- capturas y/o calendario, sin que el creador del grupo tenga más poder
-- que el resto (cualquiera puede salirse y borrar su propio contenido).
--
-- DECISIÓN DE SEGURIDAD CLAVE: salidas_pesca y capturas tienen hoy una
-- política RLS ya verificada con pruebas cruzadas reales
-- (auth.uid() = user_id, ver test/endpoints-auth.test.js) — NO SE TOCA
-- esa política para nada de esto. La visibilidad de grupo se expone
-- solo a través de las funciones obtener_*_grupo() de más abajo
-- (security definer, cada una comprueba pertenencia al grupo +
-- preferencia de compartir del dueño de la fila), nunca cambiando el
-- RLS base de esas dos tablas.

-- ---------------------------------------------------------------------
-- Apodo público (para la atribución "quién subió esto" dentro de un
-- grupo — antes de esto no había ningún nombre público, solo el email
-- privado). Solo el propio usuario puede poner/cambiar su apodo — se
-- revoca el UPDATE de tabla completa y se concede solo en la columna
-- "nombre", para que nadie pueda auto-aprobarse (perfiles.aprobado)
-- coleando un campo de más en el PATCH.
-- ---------------------------------------------------------------------
alter table public.perfiles add column if not exists nombre text;

revoke update on public.perfiles from authenticated;
grant update (nombre) on public.perfiles to authenticated;

create policy "cada usuario actualiza su propio apodo"
  on public.perfiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ---------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------
create table if not exists public.grupos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  creado_por uuid not null references auth.users (id) on delete cascade,
  creado_en timestamptz not null default now()
);

create table if not exists public.miembros_grupo (
  grupo_id uuid not null references public.grupos (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  compartir_ubicaciones boolean not null default false,
  compartir_capturas boolean not null default false,
  compartir_calendario boolean not null default false,
  unido_en timestamptz not null default now(),
  primary key (grupo_id, user_id)
);

-- "Técnicas" (pedido en el mensaje original del usuario, junto con
-- spot/capturas/calendario) se pliega dentro de compartir_capturas para
-- esta primera versión — separar su visibilidad de la del resto de la
-- captura (especie/talla/peso/fotos) exigiría una vista de
-- solo-columnas-permitidas, bastante más compleja de mantener segura.
-- Recorte deliberado, documentado también en CLAUDE.md.

create table if not exists public.invitaciones_grupo (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references public.grupos (id) on delete cascade,
  creado_por uuid not null references auth.users (id) on delete cascade,
  codigo text not null unique,
  creado_en timestamptz not null default now(),
  expira_en timestamptz not null default (now() + interval '7 days')
);

-- ---------------------------------------------------------------------
-- Helper para evitar el problema conocido de políticas RLS que se
-- referencian a sí mismas de forma recursiva (patrón estándar de
-- Supabase): security definer, corre como el dueño de la tabla y por
-- tanto no vuelve a pasar por RLS al consultar miembros_grupo.
-- ---------------------------------------------------------------------
create or replace function public.es_miembro_de(p_grupo_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists(
    select 1 from public.miembros_grupo
    where grupo_id = p_grupo_id and user_id = p_user_id
  );
$$;
grant execute on function public.es_miembro_de(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.grupos enable row level security;

create policy "ver grupos de los que soy miembro"
  on public.grupos for select
  using (es_miembro_de(id));

create policy "cualquiera crea su propio grupo"
  on public.grupos for insert
  with check (auth.uid() = creado_por);

alter table public.miembros_grupo enable row level security;

create policy "ver mi membresia o la de mi grupo"
  on public.miembros_grupo for select
  using (user_id = auth.uid() or es_miembro_de(grupo_id));

create policy "salir de un grupo (borrar mi propia fila)"
  on public.miembros_grupo for delete
  using (user_id = auth.uid());

create policy "actualizar mis propias preferencias de compartir"
  on public.miembros_grupo for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Sin política de insert directa: solo se entra a un grupo vía
-- crear_grupo()/unirse_a_grupo() (security definer, más abajo) — nunca
-- un insert suelto del cliente.

alter table public.invitaciones_grupo enable row level security;

-- Cualquier miembro del grupo puede generar una invitación.
create policy "un miembro del grupo genera invitaciones"
  on public.invitaciones_grupo for insert
  with check (es_miembro_de(grupo_id) and auth.uid() = creado_por);

-- Solo quien la creó puede leerla de vuelta (para mostrar/copiar el
-- código) — sin política de select más amplia, el código no es
-- enumerable leyendo la tabla; se consume por su valor exacto vía
-- unirse_a_grupo().
create policy "ver las invitaciones que yo he creado"
  on public.invitaciones_grupo for select
  using (auth.uid() = creado_por);

-- ---------------------------------------------------------------------
-- Funciones
-- ---------------------------------------------------------------------
create or replace function public.crear_grupo(p_nombre text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.grupos (nombre, creado_por) values (p_nombre, auth.uid()) returning id into v_id;
  insert into public.miembros_grupo (grupo_id, user_id, compartir_ubicaciones, compartir_capturas, compartir_calendario)
    values (v_id, auth.uid(), true, true, true);
  return v_id;
end;
$$;
grant execute on function public.crear_grupo(text) to authenticated;

create or replace function public.unirse_a_grupo(p_codigo text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_grupo_id uuid;
begin
  select grupo_id into v_grupo_id
    from public.invitaciones_grupo
    where codigo = p_codigo and expira_en > now();
  if v_grupo_id is null then
    raise exception 'Código de invitación no válido o caducado';
  end if;
  insert into public.miembros_grupo (grupo_id, user_id)
    values (v_grupo_id, auth.uid())
    on conflict (grupo_id, user_id) do nothing;
  return v_grupo_id;
end;
$$;
grant execute on function public.unirse_a_grupo(text) to authenticated;

-- Las tres siguientes devuelven jsonb (no setof <tabla>) para poder
-- añadir autor_nombre sin tener que enumerar a mano todas las columnas
-- de salidas_pesca/capturas/spots_usuario. Cada una comprueba
-- pertenencia al grupo vía es_miembro_de() — si quien llama no es
-- miembro, no devuelve ninguna fila (nunca un error que confirme si el
-- grupo existe).
create or replace function public.obtener_calendario_grupo(p_grupo_id uuid)
returns setof jsonb
language sql
security definer
set search_path = public
stable
as $$
  select to_jsonb(s.*) || jsonb_build_object('autor_nombre', coalesce(p.nombre, 'Miembro del grupo'))
  from public.salidas_pesca s
  join public.miembros_grupo mg on mg.user_id = s.user_id and mg.grupo_id = p_grupo_id and mg.compartir_calendario
  left join public.perfiles p on p.id = s.user_id
  where es_miembro_de(p_grupo_id);
$$;
grant execute on function public.obtener_calendario_grupo(uuid) to authenticated;

create or replace function public.obtener_capturas_grupo(p_grupo_id uuid)
returns setof jsonb
language sql
security definer
set search_path = public
stable
as $$
  select to_jsonb(c.*) || jsonb_build_object('autor_nombre', coalesce(p.nombre, 'Miembro del grupo'))
  from public.capturas c
  join public.miembros_grupo mg on mg.user_id = c.user_id and mg.grupo_id = p_grupo_id and mg.compartir_capturas
  left join public.perfiles p on p.id = c.user_id
  where es_miembro_de(p_grupo_id);
$$;
grant execute on function public.obtener_capturas_grupo(uuid) to authenticated;

create or replace function public.obtener_ubicaciones_grupo(p_grupo_id uuid)
returns setof jsonb
language sql
security definer
set search_path = public
stable
as $$
  select to_jsonb(sp.*) || jsonb_build_object('autor_nombre', coalesce(p.nombre, 'Miembro del grupo'))
  from public.spots_usuario sp
  join public.miembros_grupo mg on mg.user_id = sp.user_id and mg.grupo_id = p_grupo_id and mg.compartir_ubicaciones
  left join public.perfiles p on p.id = sp.user_id
  where es_miembro_de(p_grupo_id);
$$;
grant execute on function public.obtener_ubicaciones_grupo(uuid) to authenticated;
