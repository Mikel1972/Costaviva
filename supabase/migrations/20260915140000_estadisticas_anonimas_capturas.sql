-- Costa Viva — estadisticas anonimas de capturas y salidas
--
-- Pedido explicito del usuario: estadisticas de uso interno y tambien
-- de especies pescadas, donde, etc. Conecta con la idea ya aparcada en
-- CLAUDE.md ("agente de que se esta pescando ahora"), que ya tenia un
-- checkbox de consentimiento (perfiles.consiente_uso_datos_capturas,
-- puesto en el alta) sin usar todavia para nada. Esto lo usa por fin.
--
-- Diseno anonimo de verdad, no solo restringido por RLS: las tablas de
-- abajo NUNCA guardan user_id ni salida_id ni captura_id, solo contadores
-- agregados por spot/especie/mes (o spot/tipo/mes para salidas). No hay
-- forma de recuperar de estas tablas quien hizo que, aunque alguien
-- tuviera acceso total a la base de datos.
--
-- Solo cuenta actividad de usuarios con consiente_uso_datos_capturas =
-- true, y solo salidas con spot_slug puesto (los ~95 spots fijos del
-- catalogo) -- las ubicaciones personalizadas (spots_usuario) se dejan
-- fuera a proposito: un spot secreto con pocos usuarios podria
-- des-anonimizar a quien pesca ahi, mismo criterio de proteccion que ya
-- se aplico al pensar el agente de "que se esta pescando ahora".

create table if not exists public.estadisticas_capturas_anonimas (
spot_slug text not null,
especie text not null,
mes int not null check (mes between 1 and 12),
total int not null default 0,
primary key (spot_slug, especie, mes)
);
alter table public.estadisticas_capturas_anonimas enable row level security;

create table if not exists public.estadisticas_salidas_anonimas (
spot_slug text not null,
tipo_salida text not null,
mes int not null check (mes between 1 and 12),
total int not null default 0,
primary key (spot_slug, tipo_salida, mes)
);
alter table public.estadisticas_salidas_anonimas enable row level security;

create or replace function public.registrar_estadistica_salida_anonima()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
v_consiente boolean;
begin
if new.spot_slug is null then
return new;
end if;
select consiente_uso_datos_capturas into v_consiente from public.perfiles where id = new.user_id;
if not coalesce(v_consiente, false) then
return new;
end if;
insert into public.estadisticas_salidas_anonimas (spot_slug, tipo_salida, mes, total)
values (new.spot_slug, coalesce(new.tipo_salida, 'costa'), extract(month from new.fecha)::int, 1)
on conflict (spot_slug, tipo_salida, mes) do update set total = estadisticas_salidas_anonimas.total + 1;
return new;
end;
$$;

drop trigger if exists trg_estadistica_salida_anonima on public.salidas_pesca;
create trigger trg_estadistica_salida_anonima
after insert on public.salidas_pesca
for each row execute function public.registrar_estadistica_salida_anonima();

create or replace function public.registrar_estadistica_captura_anonima()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
v_consiente boolean;
v_spot_slug text;
v_mes int;
begin
if new.especie is null or trim(new.especie) = '' then
return new;
end if;
select consiente_uso_datos_capturas into v_consiente from public.perfiles where id = new.user_id;
if not coalesce(v_consiente, false) then
return new;
end if;
select spot_slug, extract(month from fecha)::int into v_spot_slug, v_mes from public.salidas_pesca where id = new.salida_id;
if v_spot_slug is null then
return new;
end if;
insert into public.estadisticas_capturas_anonimas (spot_slug, especie, mes, total)
values (v_spot_slug, new.especie, v_mes, 1)
on conflict (spot_slug, especie, mes) do update set total = estadisticas_capturas_anonimas.total + 1;
return new;
end;
$$;

drop trigger if exists trg_estadistica_captura_anonima on public.capturas;
create trigger trg_estadistica_captura_anonima
after insert on public.capturas
for each row execute function public.registrar_estadistica_captura_anonima();

-- Relleno unico con lo que ya existe hoy en la base de datos, con el
-- mismo criterio de consentimiento y spot fijo -- sin esto, todo lo
-- registrado antes de esta migracion se perderia para las estadisticas.
insert into public.estadisticas_salidas_anonimas (spot_slug, tipo_salida, mes, total)
select s.spot_slug, coalesce(s.tipo_salida, 'costa'), extract(month from s.fecha)::int, count(*)
from public.salidas_pesca s
join public.perfiles p on p.id = s.user_id
where p.consiente_uso_datos_capturas = true and s.spot_slug is not null
group by s.spot_slug, coalesce(s.tipo_salida, 'costa'), extract(month from s.fecha)::int
on conflict (spot_slug, tipo_salida, mes) do update set total = estadisticas_salidas_anonimas.total + excluded.total;

insert into public.estadisticas_capturas_anonimas (spot_slug, especie, mes, total)
select s.spot_slug, c.especie, extract(month from s.fecha)::int, count(*)
from public.capturas c
join public.salidas_pesca s on s.id = c.salida_id
join public.perfiles p on p.id = c.user_id
where p.consiente_uso_datos_capturas = true
and s.spot_slug is not null
and c.especie is not null and trim(c.especie) <> ''
group by s.spot_slug, c.especie, extract(month from s.fecha)::int
on conflict (spot_slug, especie, mes) do update set total = estadisticas_capturas_anonimas.total + excluded.total;

create or replace function public.admin_listar_estadisticas_capturas()
returns setof public.estadisticas_capturas_anonimas
language sql
security definer
set search_path = public
stable
as $$
select * from public.estadisticas_capturas_anonimas where public.es_admin() order by spot_slug, mes;
$$;
grant execute on function public.admin_listar_estadisticas_capturas() to authenticated;

create or replace function public.admin_listar_estadisticas_salidas()
returns setof public.estadisticas_salidas_anonimas
language sql
security definer
set search_path = public
stable
as $$
select * from public.estadisticas_salidas_anonimas where public.es_admin() order by spot_slug, mes;
$$;
grant execute on function public.admin_listar_estadisticas_salidas() to authenticated;
