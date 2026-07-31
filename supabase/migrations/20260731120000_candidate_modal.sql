-- ============================================================================
-- Apúntate Fácil: detalle del candidato en pop-up
-- ----------------------------------------------------------------------------
-- Tres cosas que el detalle nuevo necesita y no existían:
--
--   1) candidates.favorito       Interruptor que sustituye a la valoración de
--                                1-5 estrellas. Guardar en favoritos es una
--                                SELECCIÓN ("a este lo quiero"), no una nota.
--   2) candidate_comments        El chat del equipo dentro del candidato, que
--                                sustituye a candidates.notes: mismo sitio, pero
--                                con autor, fecha y menciones.
--   3) candidate_events          El historial: qué le ha pasado a esta
--                                candidatura y quién lo hizo.
--
-- Molde: 20260714120000_team_board.sql. Mismos triggers de autor desde
-- auth.uid(), mismo Broadcast from Database al topic privado 'company:<id>' y
-- mismos grants explícitos (en este backend NADIE hereda, tampoco service_role).
--
-- Diferencia importante con el tablón: el tablón es de empresa y lo ve todo el
-- equipo, incluido el encargado. Esto NO: un encargado solo ve los candidatos de
-- su sede, así que las policies pasan por un `exists` sobre public.candidates
-- que corre como invoker, para que candidates_scoped aplique sola. Sin eso, un
-- encargado leería las conversaciones de sedes ajenas.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Favorito
-- ----------------------------------------------------------------------------

alter table public.candidates add column favorito boolean not null default false;

-- Quien puso 4 o 5 estrellas estaba marcando a los buenos: esa intención se
-- respeta. La columna rating se queda sin usar (red de seguridad reversible) y
-- se borra en una migración posterior, cuando el favorito lleve semanas fuera.
update public.candidates set favorito = true where rating >= 4;

create index candidates_favorito_idx on public.candidates(campaign_id) where favorito;

-- ----------------------------------------------------------------------------
-- 2) Tablas
-- ----------------------------------------------------------------------------

create table public.candidate_comments (
  id             uuid primary key default gen_random_uuid(),
  candidate_id   uuid not null references public.candidates(id) on delete cascade,
  company_id     uuid not null,             -- lo fija el trigger desde el candidato
  author_user_id uuid references auth.users(id) on delete set null,
  author_email   text not null default '',  -- denormalizado: el hilo sobrevive a bajas
  body           text not null default '' check (char_length(body) <= 2000),
  -- A quién se avisa. El cliente propone; el trigger DESCARTA a quien no sea del
  -- equipo (un cliente manipulado no puede hacer que avisemos a un tercero).
  mentions       uuid[] not null default '{}',
  -- true = nota interna de la época anterior, migrada al hilo. Se pinta como
  -- "Nota anterior", sin autor: no sabemos quién la escribió.
  is_note        boolean not null default false,
  notified_at    timestamptz,               -- claim idempotente del aviso de mención
  created_at     timestamptz not null default now()
);
create index candidate_comments_candidate_idx
  on public.candidate_comments(candidate_id, created_at);

create table public.candidate_events (
  id             uuid primary key default gen_random_uuid(),
  candidate_id   uuid not null references public.candidates(id) on delete cascade,
  company_id     uuid not null,
  actor_user_id  uuid references auth.users(id) on delete set null,
  actor_email    text not null default '',  -- '' = lo hizo el sistema, no una persona
  kind           text not null check (kind in (
                   'recibida', 'analisis', 'estado', 'favorito',
                   'interes_enviada', 'interes_respuesta')),
  details        jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);
create index candidate_events_candidate_idx
  on public.candidate_events(candidate_id, created_at desc);

-- Los comentarios NO entran en el historial a propósito: el chat está en la
-- pestaña de al lado y duplicarlo solo lo llenaría de ruido.

-- ----------------------------------------------------------------------------
-- 3) Triggers de escritura
-- ----------------------------------------------------------------------------

-- Autor desde auth.uid() (nunca del payload), company_id desde el candidato y
-- menciones filtradas a miembros reales de esa empresa.
create or replace function public.candidate_comment_fill_author()
returns trigger
language plpgsql
security definer          -- lee auth.users y candidates sin depender del invocador
set search_path = public, auth
as $$
begin
  new.author_user_id := auth.uid();
  new.author_email := coalesce((select u.email from auth.users u where u.id = auth.uid()), '');
  select c.company_id into new.company_id from public.candidates c where c.id = new.candidate_id;
  if new.company_id is null then
    raise exception 'candidato inexistente';
  end if;

  -- Una nota migrada solo la crea esta migración; por la API siempre es false.
  new.is_note := false;

  if array_length(new.mentions, 1) is null then
    new.mentions := '{}';
  else
    new.mentions := coalesce((
      select array_agg(distinct m.user_id)
      from public.memberships m
      where m.company_id = new.company_id
        and m.user_id = any (new.mentions)
        and m.user_id <> auth.uid()   -- avisarte a ti mismo no es un aviso
    ), '{}');
  end if;

  return new;
end
$$;

create trigger trg_candidate_comments_fill_author
  before insert on public.candidate_comments
  for each row execute function public.candidate_comment_fill_author();

-- Registro del historial. security definer: candidate_events no tiene policy de
-- insert (solo escriben los triggers) y quien dispara el evento puede ser
-- cualquiera, incluido el anon que envía el formulario público.
create or replace function public.candidate_event_log(
  p_candidate uuid,
  p_company   uuid,
  p_kind      text,
  p_details   jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.candidate_events (candidate_id, company_id, actor_user_id, actor_email, kind, details)
  values (
    p_candidate,
    p_company,
    auth.uid(),
    coalesce((select u.email from auth.users u where u.id = auth.uid()), ''),
    p_kind,
    coalesce(p_details, '{}'::jsonb)
  );
end
$$;
revoke all on function public.candidate_event_log(uuid, uuid, text, jsonb) from public, anon, authenticated;

create or replace function public.candidate_events_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Deshacer un borrado reinserta la MISMA fila: no queremos una segunda
  -- "candidatura recibida" por cada deshacer.
  if exists (
    select 1 from public.candidate_events
    where candidate_id = new.id and kind = 'recibida'
  ) then
    return new;
  end if;
  perform public.candidate_event_log(
    new.id, new.company_id, 'recibida', jsonb_build_object('source', new.source)
  );
  return new;
exception when others then
  return new;   -- el historial nunca puede impedir que entre una candidatura
end
$$;

create trigger trg_candidates_event_insert
  after insert on public.candidates
  for each row execute function public.candidate_events_on_insert();

create or replace function public.candidate_events_on_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    perform public.candidate_event_log(
      new.id, new.company_id, 'estado',
      jsonb_build_object('de', old.status, 'a', new.status)
    );
  end if;

  if new.favorito is distinct from old.favorito then
    perform public.candidate_event_log(
      new.id, new.company_id, 'favorito', jsonb_build_object('favorito', new.favorito)
    );
  end if;

  -- Solo el análisis que sale bien: un error de Meridian no es un hito, y se
  -- reintenta. El fit va en details para poder decir "y calculó su ajuste".
  if new.ai is distinct from old.ai
     and new.ai is not null
     and (new.ai ->> 'error') is null then
    perform public.candidate_event_log(
      new.id, new.company_id, 'analisis',
      jsonb_build_object('fit', new.ai -> 'fit', 'cvUsed', new.ai -> 'cvUsed')
    );
  end if;

  return new;
exception when others then
  return new;
end
$$;

create trigger trg_candidates_event_update
  after update of status, favorito, ai on public.candidates
  for each row execute function public.candidate_events_on_update();

-- Interés: la comprobación se envía a una lista de candidatos (tabla puente) y
-- la respuesta llega después, al check. Dos triggers, uno por momento.
create or replace function public.candidate_events_interest_sent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid;
begin
  select k.company_id into v_company
  from public.candidate_interest_checks k where k.id = new.check_id;
  if v_company is null then
    return new;
  end if;
  perform public.candidate_event_log(new.candidate_id, v_company, 'interes_enviada');
  return new;
exception when others then
  return new;
end
$$;

create trigger trg_interest_link_event
  after insert on public.candidate_interest_check_candidates
  for each row execute function public.candidate_events_interest_sent();

create or replace function public.candidate_events_interest_answered()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.response is null or new.response is not distinct from old.response then
    return new;
  end if;
  insert into public.candidate_events (candidate_id, company_id, actor_email, kind, details)
  select l.candidate_id, new.company_id, '', 'interes_respuesta',
         jsonb_build_object('response', new.response)
  from public.candidate_interest_check_candidates l
  where l.check_id = new.id;
  return new;
exception when others then
  return new;
end
$$;

create trigger trg_interest_answer_event
  after update of response on public.candidate_interest_checks
  for each row execute function public.candidate_events_interest_answered();

-- ----------------------------------------------------------------------------
-- 4) Aviso en vivo (Broadcast from Database, sin PII en el payload)
-- ----------------------------------------------------------------------------

create or replace function public.candidate_chat_broadcast()
returns trigger
language plpgsql
security definer          -- authenticated no tiene privilegios sobre realtime
set search_path = public
as $$
begin
  perform realtime.send(
    jsonb_build_object(
      'candidate_id', new.candidate_id,
      'by', new.author_user_id     -- para no repintar lo que acabas de escribir tú
    ),
    'candidate_chat_ping',
    'company:' || new.company_id::text,
    true  -- private: la policy de realtime.messages ya cubre el topic
  );
  return new;
exception when others then
  -- Un fallo del broadcast jamás tumba el mensaje
  return new;
end
$$;

create trigger trg_candidate_comments_broadcast
  after insert on public.candidate_comments
  for each row execute function public.candidate_chat_broadcast();

-- ----------------------------------------------------------------------------
-- 5) RLS
-- ----------------------------------------------------------------------------

alter table public.candidate_comments enable row level security;

-- El `exists` corre como INVOKER: candidates_scoped aplica sola y un encargado
-- solo ve las conversaciones de los candidatos que ya puede ver. El filtro por
-- company_id va además, para que un candidato movido de empresa no arrastre su
-- hilo.
create policy "candidate_comments_select" on public.candidate_comments
  for select using (
    company_id in (select public.current_user_company_ids())
    and exists (
      select 1 from public.candidates c
      where c.id = candidate_id and c.company_id = candidate_comments.company_id
    )
  );

create policy "candidate_comments_insert" on public.candidate_comments
  for insert with check (
    exists (
      select 1 from public.candidates c
      where c.id = candidate_id
        and c.company_id in (select public.current_user_company_ids())
    )
  );

-- Sin update ni delete: igual que en el tablón, lo dicho queda dicho. Es lo que
-- hace fiable un hilo compartido.

alter table public.candidate_events enable row level security;

create policy "candidate_events_select" on public.candidate_events
  for select using (
    company_id in (select public.current_user_company_ids())
    and exists (
      select 1 from public.candidates c
      where c.id = candidate_id and c.company_id = candidate_events.company_id
    )
  );

-- Sin policy de insert: el historial lo escriben los triggers (security definer).

-- ----------------------------------------------------------------------------
-- 6) Grants (explícitos: aquí nadie hereda, tampoco service_role)
-- ----------------------------------------------------------------------------

grant select, insert on public.candidate_comments to authenticated;
grant select on public.candidate_events to authenticated;

-- La edge function notify-candidate-mention lee la fila y reclama notified_at
-- con el cliente admin.
grant select, update on public.candidate_comments to service_role;

-- ----------------------------------------------------------------------------
-- 7) RPC para la edge function: emails de los mencionados (solo service_role)
-- ----------------------------------------------------------------------------

create or replace function public.candidate_mention_emails(p_company uuid, p_users uuid[])
returns table(user_id uuid, email text)
language sql
stable
security definer
set search_path = public, auth
as $$
  select m.user_id, u.email
  from public.memberships m
  join auth.users u on u.id = m.user_id
  where m.company_id = p_company
    and m.user_id = any (p_users)
    and u.email is not null
$$;
revoke all on function public.candidate_mention_emails(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.candidate_mention_emails(uuid, uuid[]) to service_role;

-- ----------------------------------------------------------------------------
-- 8) Backfill: lo que ya sabemos, para que nada nazca vacío
-- ----------------------------------------------------------------------------

-- Las notas internas pasan al hilo como primer mensaje. No sabemos quién las
-- escribió (era un campo de texto compartido), así que van sin autor y con la
-- fecha de entrada del candidato. La columna notes se deja intacta: si esto
-- hubiera que revertirlo, el dato original sigue ahí.
--
-- Los triggers se apagan durante el backfill por DOS razones, ambas verificadas:
--   * fill_author fuerza is_note := false (es lo correcto para la API, donde
--     nadie puede fabricarse una "nota anterior"), y sin apagarlo las notas
--     migradas entraban como mensajes normales sin autor.
--   * broadcast emitiría un realtime.send por cada nota migrada, una tormenta
--     de avisos por una escritura que nadie ha hecho ahora.
alter table public.candidate_comments disable trigger trg_candidate_comments_fill_author;
alter table public.candidate_comments disable trigger trg_candidate_comments_broadcast;

insert into public.candidate_comments (candidate_id, company_id, author_email, body, is_note, created_at)
select c.id, c.company_id, '', btrim(c.notes), true, c.created_at
from public.candidates c
where btrim(coalesce(c.notes, '')) <> '';

alter table public.candidate_comments enable trigger trg_candidate_comments_fill_author;
alter table public.candidate_comments enable trigger trg_candidate_comments_broadcast;

-- Historial reconstruido. Solo lo que consta en la base: el resto empieza a
-- contar desde hoy. Un historial que dice lo que sabe es mejor que uno inventado.
insert into public.candidate_events (candidate_id, company_id, actor_email, kind, details, created_at)
select c.id, c.company_id, '', 'recibida', jsonb_build_object('source', c.source), c.created_at
from public.candidates c;

insert into public.candidate_events (candidate_id, company_id, actor_email, kind, details, created_at)
select c.id, c.company_id, '', 'analisis',
       jsonb_build_object('fit', c.ai -> 'fit', 'cvUsed', c.ai -> 'cvUsed'),
       coalesce((c.ai ->> 'analyzedAt')::timestamptz, c.created_at)
from public.candidates c
where c.ai is not null and (c.ai ->> 'error') is null;

insert into public.candidate_events (candidate_id, company_id, actor_email, kind, details, created_at)
select l.candidate_id, k.company_id, '', 'interes_enviada', '{}'::jsonb, coalesce(k.sent_at, k.created_at)
from public.candidate_interest_check_candidates l
join public.candidate_interest_checks k on k.id = l.check_id
where k.delivery_status = 'sent';

insert into public.candidate_events (candidate_id, company_id, actor_email, kind, details, created_at)
select l.candidate_id, k.company_id, '', 'interes_respuesta',
       jsonb_build_object('response', k.response), k.responded_at
from public.candidate_interest_check_candidates l
join public.candidate_interest_checks k on k.id = l.check_id
where k.response is not null and k.responded_at is not null;
