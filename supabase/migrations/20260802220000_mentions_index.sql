-- ============================================================================
-- Apúntate Fácil: índice para "mis menciones"
-- ----------------------------------------------------------------------------
-- El timbre de avisos de la barra pregunta lo mismo en cada carga: "¿en qué
-- mensajes se me ha mencionado?". Eso es un `mentions @> '{<uid>}'` sobre un
-- uuid[], y sin índice obliga a recorrer entera candidate_comments.
--
-- GIN es el tipo de índice de los arrays: indexa cada elemento, así que la
-- pregunta se resuelve por el uuid buscado y no por la fila. El índice es
-- PARCIAL (solo filas con menciones) porque la inmensa mayoría de los mensajes
-- no mencionan a nadie y no aportan nada aquí.
--
-- No hace falta tocar la RLS: la policy candidate_comments_select ya acota a la
-- empresa y a los candidatos visibles, y este índice solo cambia el cómo, no el
-- qué. Tampoco hacen falta grants nuevos: la tabla ya los tiene.
-- ============================================================================

create index if not exists candidate_comments_mentions_idx
  on public.candidate_comments using gin (mentions)
  where mentions <> '{}';
