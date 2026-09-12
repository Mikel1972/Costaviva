-- Costa Viva — tipo de ubicación personalizada (costa / embarcación / buceo)
--
-- Corrección tras probar la Fase 2 en real: un punto de costa sí tiene
-- sentido resolverlo por geocodificación inversa a un nombre de
-- localidad real. Un punto de embarcación o de buceo en mar abierto NO
-- es "de costa" — la localidad más cercana que devolvería Nominatim
-- sería engañosa (el punto no está ahí, está varios km mar adentro), así
-- que esos dos tipos se identifican por sus coordenadas, no por un
-- nombre de localidad.

alter table public.spots_usuario
  add column if not exists tipo text not null default 'costa'
  check (tipo in ('costa', 'embarcacion', 'buceo'));
