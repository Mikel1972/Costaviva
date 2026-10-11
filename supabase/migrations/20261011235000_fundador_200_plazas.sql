-- Precio fundador: 200 plazas en vez de 500 (decisión de Mikel, 2026-10-11).
-- SOLO cambia el total de plazas_fundador_restantes(); el resto de la función
-- es idéntico a 20261011230000. 200 = plazas_fundador de
-- functions/_lib/precios-zonas.json (el test lo compara).
create or replace function public.plazas_fundador_restantes()
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select greatest(0, 200 - count(*))::integer
  from public.suscripciones s
  where s.fundador_desde is not null
    and (
      s.estado in ('trialing', 'active', 'past_due', 'unpaid')
      or s.primer_pago_en is not null
    );
$$;
revoke all on function public.plazas_fundador_restantes() from public, anon;
grant execute on function public.plazas_fundador_restantes() to authenticated, service_role;

do $$
begin
  raise notice 'Plazas de fundador libres: %', public.plazas_fundador_restantes();
end $$;
