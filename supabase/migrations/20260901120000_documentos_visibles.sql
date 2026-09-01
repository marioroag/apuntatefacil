-- ============================================================================
-- LOS DOCUMENTOS DE MÁS TAMBIÉN SE PUEDEN LEER (sep 2026).
--
-- `20260831120000_documentos_candidato.sql` abrió `candidate_documents` para que
-- una candidatura pudiera tener más de un fichero, y los guarda en el MISMO
-- bucket privado `cvs`. Lo que no se tocó fue la política de LECTURA de ese
-- bucket, que desde `20260615080000_managers_hardening.sql` deriva la visibilidad
-- de la fila del candidato y solo conoce una ruta, `candidates.cv_path`:
--
--     exists (select 1 from candidates c where c.cv_path = name and ...)
--
-- Como `submit_application` mete el PRIMER fichero en `cv_path` y el RESTO en
-- `candidate_documents`, esos "resto" no son el `cv_path` de nadie: no casan con
-- ninguna fila, la policy los esconde y storage los da por inexistentes. Medido
-- contra el stack local, con dos ficheros de una misma candidatura:
--
--     firmar el cv           -> 200
--     firmar el segundo doc  -> 400 {"statusCode":"404","message":"Object not found"}
--
-- Y no es solo el segundo fichero del formulario: el bloque de Documentos de la
-- ficha deja al equipo SUBIR uno (un contrato, la documentación), y esos entran
-- por el mismo sitio, así que **quien lo acababa de subir no podía volver a
-- abrirlo**. El visor caía y "Descargar" devolvía 400 igual.
--
-- La regla que ya estaba escrita en aquella migración se cumple entera aquí, y
-- por eso este arreglo NO es "que el equipo vea su bucket": **la visibilidad se
-- deriva de la FILA, no del prefijo del nombre**. Se añade un segundo `exists`
-- sobre `candidate_documents` acotado por el MISMO gate, y acotado a través de
-- SU candidato (`campaign_id in current_user_campaign_ids()`), no por la
-- `company_id` que la tabla lleva denormalizada: un ENCARGADO solo ve los
-- puestos de sus sedes, así que con el gate por empresa le llegarían los
-- documentos de candidatos que no puede ni listar. La columna denormalizada
-- vale para la RLS de su propia tabla; para el bucket, no.
-- ============================================================================

drop policy "cvs_select_visible" on storage.objects;
create policy "cvs_select_visible" on storage.objects
  for select to authenticated
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

-- La policy busca POR RUTA y se evalúa una vez por objeto; el índice que había
-- es `(candidate_id, created_at)`, que es el del acceso normal de la ficha y no
-- sirve para esto. Sin él, abrir un documento es un recorrido de la tabla entera.
create index if not exists candidate_documents_path_idx
  on public.candidate_documents (path);
