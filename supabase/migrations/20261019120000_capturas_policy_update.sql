-- Editar una captura del diario no guardaba nada (2026-10-19, reportado por
-- el usuario: la IA identificó una breca como "Pargo", la corrigió al editar,
-- pulsó Guardar y seguía saliendo "Pargo").
--
-- Causa: public.capturas tenía RLS con policies para ver, insertar y borrar,
-- pero NINGUNA para UPDATE (comprobado en pg_policy de producción y en
-- supabase/baseline-seguridad.json; salidas_pesca sí la tiene). Sin policy,
-- el update de guardarCaptura() en diario.html no cambia ninguna fila y
-- PostgREST no devuelve error, así que la app daba la edición por buena.
-- Afectaba a cualquier usuario y a cualquier campo de una captura.
--
-- Mismo criterio que las otras tres policies de capturas y que la de
-- update de salidas_pesca: cada usuario, solo lo suyo. El trigger ya
-- existente trg_editar_captura_compartida (20261008150000) rehace la copia
-- anónima de la comunidad si la captura estaba compartida: se escribió para
-- esto ("si algún día se edita una captura compartida").

drop policy if exists "cada usuario actualiza solo sus capturas" on public.capturas;
create policy "cada usuario actualiza solo sus capturas"
  on public.capturas for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Corrección puntual pedida por el usuario: su captura del 2026-10-19 es una
-- breca ("Breca" en assets/datos/especies.json, Pagellus erythrinus), no un
-- pargo. Acotada a esa fila y solo si sigue diciendo "Pargo".
update public.capturas
   set especie = 'Breca'
 where id = 'fde3740d-5307-4b39-a880-10553fc60990'
   and especie = 'Pargo';
