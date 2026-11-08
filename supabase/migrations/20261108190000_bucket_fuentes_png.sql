-- Costa Viva — el bucket "fuentes-gratuitas" acepta también PNG (2026-11-08)
--
-- MOTIVO: el relieve EMODnet de la vista 3D (relieve-emodnet.yml) sube sus
-- teselas a fuentes-gratuitas/relieve-emodnet/{z}/{x}/{y}.png y Storage las
-- rechazaba: "mime type image/png is not supported" (el bucket solo admitía
-- JSON). Sin ellas la 3D usa el relieve de AWS, más tosco en el mar.
--
-- Solo añade image/png a la lista; lo demás del bucket (público de lectura,
-- sin policies, 30 MB) no cambia. No crea tablas ni funciones.

update storage.buckets
   set allowed_mime_types = array['application/json', 'image/png']
 where id = 'fuentes-gratuitas';
