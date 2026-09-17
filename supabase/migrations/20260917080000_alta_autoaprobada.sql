-- Costaviva — alta automática, sin aprobación manual del admin
--
-- Pedido explícito del usuario (2026-09-17): en Etxeapala (app familiar
-- cerrada) la aprobación manual tiene sentido, pero aquí Costaviva es de
-- alta abierta y ese paso solo añadía fricción sin aportar seguridad real
-- — ninguna tabla de usuario comprueba "aprobado" en su RLS, todas
-- comprueban auth.uid() = user_id; la barrera real de quién entra ya la
-- pone Supabase exigiendo confirmar el email antes de poder iniciar
-- sesión. admin_fijar_acceso()/el botón "Pausar" de admin.html se quedan
-- igual, ahora sirven solo para banear a alguien después del alta, no
-- para la aprobación inicial.

-- 1) Nuevas cuentas quedan aprobadas desde el momento del alta.
alter table public.perfiles alter column aprobado set default true;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfiles (id, email, aprobado)
  values (new.id, new.email, true);
  return new;
end;
$$;

-- 2) Cualquier alta que estuviera esperando aprobación manual antes de
-- este cambio (incluida la de anoche) queda aprobada también — el gate
-- manual desaparece para todo el mundo, no solo para altas futuras.
update public.perfiles set aprobado = true where aprobado = false;

-- 3) Columnas para no avisar dos veces por la misma alta (activada u
-- olvidada) en cada pasada del cron que revisa esto.
alter table public.perfiles
  add column if not exists email_confirmado_avisado boolean not null default true,
  add column if not exists alta_fallida_avisada boolean not null default true;
-- Default true a propósito solo para que las filas YA existentes (altas
-- de antes de este cambio) no disparen avisos retroactivos — el trigger
-- de abajo pone false en cada fila nueva de aquí en adelante.
alter table public.perfiles alter column email_confirmado_avisado set default false;
alter table public.perfiles alter column alta_fallida_avisada set default false;

-- 4) Funciones que consulta el nuevo endpoint de Cloudflare
-- (functions/notificar-altas.js) con la service_role key — igual que
-- admin_listar_usuarios()/admin_fijar_acceso(), pero con grant a
-- service_role en vez de a authenticated: ningún usuario normal debe
-- poder listar emails ajenos ni marcar avisos.

-- Altas confirmadas de verdad (email_confirmed_at ya puesto) que todavía
-- no se han avisado al admin.
create or replace function public.altas_activadas_pendientes_aviso()
returns table (id uuid, email text)
language sql
security definer
set search_path = public
stable
as $$
  select u.id, u.email
  from auth.users u
  join public.perfiles p on p.id = u.id
  where u.email_confirmed_at is not null
    and p.email_confirmado_avisado = false;
$$;
revoke all on function public.altas_activadas_pendientes_aviso() from public, authenticated, anon;
grant execute on function public.altas_activadas_pendientes_aviso() to service_role;

create or replace function public.marcar_alta_activada_avisada(p_user_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.perfiles set email_confirmado_avisado = true where id = p_user_id;
$$;
revoke all on function public.marcar_alta_activada_avisada(uuid) from public, authenticated, anon;
grant execute on function public.marcar_alta_activada_avisada(uuid) to service_role;

-- Altas que llevan más de N horas sin confirmar el email (posible fallo
-- de entrega) y todavía no se han avisado al admin.
create or replace function public.altas_sin_confirmar_pendiente_aviso(p_horas int default 48)
returns table (id uuid, email text, creado_en timestamptz)
language sql
security definer
set search_path = public
stable
as $$
  select u.id, u.email, u.created_at
  from auth.users u
  join public.perfiles p on p.id = u.id
  where u.email_confirmed_at is null
    and u.created_at < now() - (p_horas::text || ' hours')::interval
    and p.alta_fallida_avisada = false;
$$;
revoke all on function public.altas_sin_confirmar_pendiente_aviso(int) from public, authenticated, anon;
grant execute on function public.altas_sin_confirmar_pendiente_aviso(int) to service_role;

create or replace function public.marcar_alta_fallida_avisada(p_user_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.perfiles set alta_fallida_avisada = true where id = p_user_id;
$$;
revoke all on function public.marcar_alta_fallida_avisada(uuid) from public, authenticated, anon;
grant execute on function public.marcar_alta_fallida_avisada(uuid) to service_role;
