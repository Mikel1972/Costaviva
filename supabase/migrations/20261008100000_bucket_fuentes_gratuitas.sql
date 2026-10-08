-- Costa Viva — bucket de Storage "fuentes-gratuitas" (2026-10-08)
--
-- MOTIVO: Costaviva tiene suscripciones y la API gratuita de Open-Meteo es
-- solo para uso no comercial. Se montan en paralelo MET Norway (atmósfera) y
-- Copernicus Marine IBI (mar), gratuitas y válidas para uso comercial (ver
-- CLAUDE.md, "Fuentes gratuitas"). El workflow fuentes-gratuitas.yml deja aquí
-- sus instantáneas (JSON de previsión por spot) y functions/_lib/fuentes.js
-- las lee cuando se activan los interruptores FUENTE_*.
--
-- PÚBLICO DE LECTURA a propósito: son previsiones meteorológicas y de mar
-- por coordenadas, ningún dato de usuarios. Se leen por la URL pública
-- /storage/v1/object/public/fuentes-gratuitas/... (en un bucket público eso
-- no pasa por RLS).
--
-- SIN POLICIES sobre storage.objects a propósito: nadie con anon ni
-- authenticated puede subir, cambiar, borrar ni listar. Solo escribe el
-- workflow con service_role (que se salta la RLS).
--
-- Límites: 30 MB por fichero (mar/spots.json ronda 3 MB) y solo JSON.
--
-- ORDEN DE DESPLIEGUE: indiferente. Sin el bucket, el workflow falla en rojo
-- al subir y la app sigue en Open-Meteo (los interruptores están apagados).
--
-- NO SE HA APLICADO: pendiente del "sí" de Mikel (aplicar-migraciones.yml).
-- Al aplicar no hace falta tocar supabase/baseline-seguridad.json: no crea
-- tablas en public ni funciones.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fuentes-gratuitas', 'fuentes-gratuitas', true, 31457280, array['application/json'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
