-- Primera venta en lonja: solo para uso interno (Mikel, 2026-10-22: "los datos
-- de la pesca solo nos interesan a nosotros para sugerir tipo de pesca"). No se
-- enseñan en la app: se cierra la lectura pública. La lee y escribe solo
-- service_role (robots de scripts/lonjas/ y, más adelante, el de especie
-- probable de las zonas de flota).
drop policy if exists "lectura pública de las ventas en lonja" on public.lonja_ventas;
revoke all on public.lonja_ventas from anon, authenticated;

comment on table public.lonja_ventas is 'Primera venta diaria por lonja y especie (kg, €, €/kg). USO INTERNO (no se muestra en la app). Galicia: Fonte: Xunta de Galicia – pescadegalicia.gal. Lee y escribe solo service_role (scripts/lonjas/galicia.mjs). Coordenadas en scripts/lonjas/lonjas-galicia.json. 2026-10-22.';
