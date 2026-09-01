-- ============================================================================
-- LAS FILAS DE `candidate_documents` SE ACOTAN POR PUESTO, COMO SU CANDIDATO
-- (sep 2026; hallazgo al arreglar la lectura del bucket, migración anterior).
--
-- `candidates` se acota por CAMPAÑA (`candidates_scoped`: `campaign_id in
-- current_user_campaign_ids() and not locked`) y `candidate_documents` nació
-- acotada por EMPRESA (`company_id in current_user_company_ids()`). No son el
-- mismo gate: el de empresa cuenta CUALQUIER membresía, encargados incluidos, y
-- un encargado solo ve los puestos de SUS sedes.
--
-- Medido contra el stack local con un encargado sin sedes asignadas:
--
--     GET /rest/v1/candidates            -> []            (cero candidatos)
--     GET /rest/v1/candidate_documents   -> 4 filas       (ruta y nombre de fichero)
--
-- O sea, los nombres de los ficheros, quién los subió y cuándo, de candidatos
-- que esa persona no puede ni listar. Es fuga de METADATOS y no de contenido (el
-- bucket sigue diciendo que no, y eso está comprobado), pero un nombre de
-- fichero dice bastante ("contrato-firmado.pdf", "nomina.pdf"), y por el mismo
-- agujero entran los candidatos BLOQUEADOS, que `candidates_scoped` esconde a
-- propósito.
--
-- La `company_id` denormalizada se queda: sigue siendo lo que ata la fila a su
-- empresa y lo que valida `submit_application`. Lo que cambia es el gate de
-- lectura y escritura, que pasa a derivarse de SU CANDIDATO, que es la fila de
-- la que este documento cuelga. Misma regla que ya gobierna el bucket.
--
-- Para el dueño y para un miembro normal no cambia nada: sus campañas son todas
-- las de su empresa. Cambia solo para el encargado, que es de quien va esto.
-- ============================================================================

drop policy "candidate_documents_select" on public.candidate_documents;
drop policy "candidate_documents_insert" on public.candidate_documents;
drop policy "candidate_documents_delete" on public.candidate_documents;

-- Un solo predicado para las tres, porque son la misma pregunta: ¿es este
-- documento de un candidato que puedes ver? Escrito tres veces, el día que se
-- afine uno se quedan mintiendo los otros dos.
create policy "candidate_documents_select" on public.candidate_documents
  for select to authenticated
  using (exists (
    select 1 from public.candidates c
     where c.id = candidate_documents.candidate_id
       and c.campaign_id in (select public.current_user_campaign_ids())
       and not c.locked
  ));

create policy "candidate_documents_insert" on public.candidate_documents
  for insert to authenticated
  with check (
    company_id in (select public.current_user_company_ids())
    and exists (
      select 1 from public.candidates c
       where c.id = candidate_documents.candidate_id
         and c.campaign_id in (select public.current_user_campaign_ids())
         and not c.locked
    )
  );

create policy "candidate_documents_delete" on public.candidate_documents
  for delete to authenticated
  using (exists (
    select 1 from public.candidates c
     where c.id = candidate_documents.candidate_id
       and c.campaign_id in (select public.current_user_campaign_ids())
       and not c.locked
  ));
