-- Buscador de candidatos TOLERANTE, nativo de Postgres.
-- Encuentra al candidato independientemente de cómo se escribió el dato o la búsqueda:
-- ignora mayúsculas, acentos y la ñ; coincidencia parcial/prefijo; tolera erratas
-- (trigramas); teléfono por dígitos (ignora espacios/guiones); ordena por relevancia.
-- Alcance: nombre (+ apellidos) y teléfono, que es lo que dice el placeholder.

create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- unaccent() de 1 argumento es STABLE (depende del search_path del diccionario). Para
-- usarlo en columna generada e índice necesitamos una envoltura IMMUTABLE: la forma de
-- 2 argumentos (diccionario explícito) sí es inmutable.
create or replace function public.f_unaccent(text)
returns text
language sql
immutable
parallel safe
strict
as $$
  select extensions.unaccent('extensions.unaccent'::regdictionary, $1)
$$;

-- Texto de búsqueda por candidato: nombre + apellidos + teléfono, normalizados
-- (minúsculas, sin acentos/ñ) y además los dígitos sueltos del teléfono. Columna
-- generada STORED -> solo admite funciones IMMUTABLE (todas lo son aquí).
alter table public.candidates
  add column if not exists search_text text
  generated always as (
    lower(public.f_unaccent(
      coalesce(answers->>'nombre', '') || ' ' ||
      coalesce(answers->>'apellidos', '') || ' ' ||
      coalesce(answers->>'telefono', '')
    ))
    || ' ' ||
    regexp_replace(coalesce(answers->>'telefono', ''), '\D', '', 'g')
  ) stored;

-- Índice trigram (GIN) para que el LIKE '%...%' y la similitud sean rápidos con miles
-- de candidatos por empresa.
create index if not exists candidates_search_trgm
  on public.candidates using gin (search_text extensions.gin_trgm_ops);

-- RPC tolerante. SECURITY INVOKER (por defecto): la RLS `candidates_scoped` aplica, así
-- que respeta empresa + sede del encargado SIN bypass. Devuelve los candidatos del puesto
-- que coinciden, ordenados por relevancia (mejor coincidencia primero).
create or replace function public.search_candidates(
  p_campaign_id uuid,
  p_query text,
  p_limit int default 200
)
returns setof public.candidates
language sql
stable
set search_path = public, extensions
set pg_trgm.word_similarity_threshold = 0.3
as $$
  with q as (
    select
      lower(public.f_unaccent(coalesce(trim(p_query), ''))) as nq,
      regexp_replace(coalesce(p_query, ''), '\D', '', 'g') as dq
  )
  select c.*
  from public.candidates c, q
  where c.campaign_id = p_campaign_id
    and q.nq <> ''
    and (
      c.search_text like '%' || q.nq || '%'                            -- parcial/prefijo (nombre)
      or (length(q.dq) >= 3 and c.search_text like '%' || q.dq || '%') -- teléfono por dígitos
      or q.nq <% c.search_text                                         -- erratas (word similarity)
    )
  order by
    word_similarity(q.nq, c.search_text) desc,
    c.created_at desc
  limit greatest(coalesce(p_limit, 200), 1)
$$;

grant execute on function public.search_candidates(uuid, text, int) to authenticated;
