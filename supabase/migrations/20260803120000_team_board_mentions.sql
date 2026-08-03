-- ============================================================================
-- Apúntate Fácil: menciones @ en el hilo del tablón
-- ----------------------------------------------------------------------------
-- El chat del candidato y el del tablón son la misma conversación (gente del
-- equipo hablando de un caso) y ya comparten primitiva en el cliente. Faltaba
-- la mitad que de verdad hace que sirvan: poder llamar a alguien por su nombre
-- y que le llegue. Sin esto, en el tablón se escribía "@laura" y no pasaba nada
-- (ni chapa, ni timbre, ni correo), que es la peor versión posible: parece que
-- has avisado.
--
-- Tres piezas:
--   1. mentions uuid[] en team_request_comments, espejo de candidate_comments.
--   2. UN solo sitio que decide a quién se puede avisar (`mentions_del_equipo`),
--      que ahora usan los dos triggers. Antes esa regla vivía escrita a mano
--      dentro del trigger del candidato; con dos copias, la siguiente vez que
--      cambie (roles, sedes) solo se cambiaría una.
--   3. mention_emails: el mismo `candidate_mention_emails` de siempre, con el
--      nombre que le corresponde ahora que lo pregunta también el tablón. No
--      resuelve nada de candidatos, resuelve correos de compañeros.
--
-- OJO al desplegar: el rename obliga a subir las edge functions junto con esta
-- migración (`supabase functions deploy notify-candidate-mention
-- notify-team-board`). Entre las dos, un aviso de mención no sale; el mensaje
-- se guarda y llega en vivo igual, que por eso este correo es best-effort.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) A quién se puede avisar: una sola definición
-- ----------------------------------------------------------------------------
-- El cliente PROPONE a quién avisar; esto descarta a quien no sea del equipo (un
-- cliente manipulado no puede hacer que avisemos a un tercero) y al propio autor
-- (avisarte a ti mismo no es un aviso).
create or replace function public.mentions_del_equipo(p_company uuid, p_mentions uuid[])
returns uuid[]
language sql
stable
security definer          -- lee memberships sin depender de la RLS del invocador
set search_path = public, auth
as $$
  select coalesce((
    select array_agg(distinct m.user_id)
    from public.memberships m
    where m.company_id = p_company
      and m.user_id = any (p_mentions)
      and m.user_id <> auth.uid()
  ), '{}'::uuid[])
$$;
revoke all on function public.mentions_del_equipo(uuid, uuid[]) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2) La columna del tablón
-- ----------------------------------------------------------------------------
alter table public.team_request_comments
  add column if not exists mentions uuid[] not null default '{}';

-- Mismo índice que el del candidato y por lo mismo: el timbre pregunta en cada
-- carga "¿dónde se me ha mencionado?", que es un `mentions @> '{<uid>}'`. GIN
-- indexa cada elemento del array; PARCIAL porque casi ningún mensaje menciona.
create index if not exists team_request_comments_mentions_idx
  on public.team_request_comments using gin (mentions)
  where mentions <> '{}';

-- ----------------------------------------------------------------------------
-- 3) Los triggers, los dos contra la misma regla
-- ----------------------------------------------------------------------------
create or replace function public.team_board_fill_author()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if tg_table_name = 'team_requests' then
    new.author_user_id := auth.uid();
    new.author_email := coalesce((select u.email from auth.users u where u.id = auth.uid()), '');
    new.last_activity_at := now();
    new.last_activity_by := auth.uid();
  elsif tg_table_name = 'team_request_comments' then
    new.author_user_id := auth.uid();
    new.author_email := coalesce((select u.email from auth.users u where u.id = auth.uid()), '');
    select r.company_id into new.company_id from public.team_requests r where r.id = new.request_id;
    if new.company_id is null then
      raise exception 'petición inexistente';
    end if;
    new.mentions := public.mentions_del_equipo(new.company_id, coalesce(new.mentions, '{}'::uuid[]));
  elsif tg_table_name = 'team_request_candidates' then
    new.proposed_by := auth.uid();
    select r.company_id into new.company_id from public.team_requests r where r.id = new.request_id;
    if new.company_id is null then
      raise exception 'petición inexistente';
    end if;
  end if;
  return new;
end
$$;

create or replace function public.candidate_comment_fill_author()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  new.author_user_id := auth.uid();
  new.author_email := coalesce((select u.email from auth.users u where u.id = auth.uid()), '');
  select c.company_id into new.company_id from public.candidates c where c.id = new.candidate_id;
  if new.company_id is null then
    raise exception 'candidato inexistente';
  end if;

  -- Una nota migrada solo la crea su migración; por la API siempre es false.
  new.is_note := false;
  new.mentions := public.mentions_del_equipo(new.company_id, coalesce(new.mentions, '{}'::uuid[]));

  return new;
end
$$;

-- ----------------------------------------------------------------------------
-- 4) El nombre de quien resuelve los correos
-- ----------------------------------------------------------------------------
alter function public.candidate_mention_emails(uuid, uuid[]) rename to mention_emails;
