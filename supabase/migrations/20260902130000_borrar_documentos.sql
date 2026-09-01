-- ============================================================================
-- BORRAR UN FICHERO DEL BUCKET `cvs` (sep 2026).
--
-- El bucket tiene política de INSERT y de SELECT desde el primer día, y NINGUNA
-- de DELETE. `avatars` y `brand-assets` sí la tienen; `cvs` se quedó sin ella.
-- Medido contra la API local, con un usuario del equipo:
--
--     borrar un documento que tiene su fila  -> 403 Access denied
--     borrar un huérfano de una subida rota  -> 403 Access denied
--     borrar como el anónimo del formulario  -> 403 Access denied
--
-- O sea que las TRES llamadas a `storage.remove('cvs')` que había en el cliente
-- no borraban nada, y las tres iban con un `.catch(() => {})` que se tragaba el
-- 403 mientras el comentario de al lado afirmaba que el fichero se retiraba.
--
-- La regla es la MISMA que la de leer, y por eso esta política es su calco: la
-- visibilidad (y ahora el borrado) se derivan de la FILA del candidato del que
-- cuelga el fichero, nunca del prefijo del nombre ni de la empresa. Si puedes ver
-- el documento, puedes quitarlo.
--
-- LO QUE NO SE HACE, Y ES UNA DECISIÓN MEDIDA: el cliente sigue SIN poder limpiar
-- un huérfano (la subida que salió bien y cuya fila falló). Un huérfano es, por
-- definición, el objeto que no tiene fila de la que derivar nada, así que la única
-- forma de alcanzarlo desde el cliente sería por `owner_id`, que storage rellena
-- con el uid de quien sube.
--
-- Se probó, y el intento enseñó lo que decide: **storage exige poder VER el objeto
-- antes de borrarlo**. Con `owner_id` solo en la política de DELETE, el borrado
-- del huérfano propio seguía dando 400; solo funcionó al meter `owner_id` TAMBIÉN
-- en la de SELECT. O sea que el precio de que el cliente limpie su basura es
-- ensanchar la LECTURA de un bucket lleno de CVs, y hacerlo por una ruta que ya no
-- es "la fila manda". No compensa: cubre un fallo raro (subida buena + fila rota),
-- deja fuera igualmente al candidato anónimo (que no tiene `owner_id`), y aun así
-- haría falta un barrido de servidor para el resto.
--
-- Así que los huérfanos son cosa del SERVIDOR (`service_role` sí puede: probado) y
-- ese barrido NO EXISTE todavía. Lo que sí se hace hoy es dejar de fingir: las tres
-- llamadas que no borraban nada salen del cliente en este mismo cambio.
-- ============================================================================

create policy "cvs_delete_visible" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'cvs'
    and (
      exists (
        select 1 from public.candidates c
         where c.cv_path = storage.objects.name
           and c.campaign_id in (select public.current_user_campaign_ids())
      )
      or exists (
        select 1
          from public.candidate_documents d
          join public.candidates c on c.id = d.candidate_id
         where d.path = storage.objects.name
           and c.campaign_id in (select public.current_user_campaign_ids())
      )
    )
  );
