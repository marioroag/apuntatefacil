-- ============================================================================
-- Apúntate Fácil: tablón de peticiones de equipo
-- ----------------------------------------------------------------------------
-- El equipo de una empresa se coordina dentro de la app: cualquier miembro
-- publica una petición ("Necesito 3 electricistas en Tenerife Norte"), los
-- compañeros responden en hilo y proponen candidatos existentes, y la petición
-- se marca como completada (autor u owner).
--
-- Diseño:
--   * team_requests            cabecera (patrón support_tickets)
--   * team_request_comments    hilo (patrón support_messages)
--   * team_request_candidates  puente petición<->candidato, SIN PII: solo ids.
--     El nombre del candidato se resuelve en el cliente contra el store (ya
--     acotado por RLS); si el encargado no puede ver ese candidato, la UI
--     muestra un chip degradado sin datos.
--   * El autor se fija SIEMPRE desde auth.uid() en triggers (nunca del payload)
--     y su email se denormaliza (el cliente no puede hacer join con auth.users
--     y así el hilo sobrevive a bajas del equipo).
--   * Aviso en vivo: mismo patrón Broadcast from Database que new_candidate,
--     al topic privado 'company:<id>' ya cubierto por la policy de
--     realtime.messages de 20260708120000_live_candidates_broadcast.sql.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Tablas
-- ----------------------------------------------------------------------------

create table public.team_requests (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references public.companies(id) on delete cascade,
  author_user_id   uuid references auth.users(id) on delete set null,
  author_email     text not null default '',
  title            text not null check (char_length(btrim(title)) between 3 and 120),
  body             text not null default '' check (char_length(body) <= 2000),
  site_id          uuid references public.sites(id) on delete set null,
  status           text not null default 'abierta' check (status in ('abierta','completada')),
  completed_at     timestamptz,
  completed_by     uuid references auth.users(id) on delete set null,
  notified_at      timestamptz,             -- claim idempotente del email de aviso
  last_activity_at timestamptz not null default now(),
  last_activity_by uuid,                    -- para no contarte tu propia actividad
  created_at       timestamptz not null default now()
);
create index team_requests_company_activity_idx
  on public.team_requests(company_id, last_activity_at desc);

create table public.team_request_comments (
  id             uuid primary key default gen_random_uuid(),
  request_id     uuid not null references public.team_requests(id) on delete cascade,
  company_id     uuid not null,             -- lo fija el trigger desde la petición
  author_user_id uuid references auth.users(id) on delete set null,
  author_email   text not null default '',
  -- '' permitido: una respuesta puede ser solo candidatos adjuntos
  body           text not null default '' check (char_length(body) <= 2000),
  notified_at    timestamptz,
  created_at     timestamptz not null default now()
);
create index team_request_comments_request_idx
  on public.team_request_comments(request_id, created_at);

create table public.team_request_candidates (
  request_id   uuid not null references public.team_requests(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  comment_id   uuid references public.team_request_comments(id) on delete set null,
  company_id   uuid not null,               -- lo fija el trigger desde la petición
  proposed_by  uuid,
  created_at   timestamptz not null default now(),
  primary key (request_id, candidate_id)    -- un candidato, una vez por petición
);
create index team_request_candidates_candidate_idx
  on public.team_request_candidates(candidate_id);

-- ----------------------------------------------------------------------------
-- Triggers: autor desde auth.uid() + company_id desde el padre
-- ----------------------------------------------------------------------------

-- security definer para leer auth.users (email) y team_requests (company_id del
-- padre) sin depender de los privilegios del invocador. Acotado: solo rellena
-- columnas de la fila nueva.
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

create trigger trg_team_requests_fill_author
  before insert on public.team_requests
  for each row execute function public.team_board_fill_author();
create trigger trg_team_comments_fill_author
  before insert on public.team_request_comments
  for each row execute function public.team_board_fill_author();
create trigger trg_team_proposals_fill_author
  before insert on public.team_request_candidates
  for each row execute function public.team_board_fill_author();

-- Actividad: responder o proponer un candidato "sube" la petición y alimenta el
-- badge de no leído. security definer imprescindible: quien responde no pasa la
-- policy de UPDATE de team_requests (solo autor/owner).
create or replace function public.team_board_bump_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Vía jsonb: los comentarios llevan author_user_id y el puente proposed_by;
  -- referenciar directo el campo que falta rompería en runtime (plpgsql).
  v_actor uuid := coalesce(
    (to_jsonb(new) ->> 'author_user_id')::uuid,
    (to_jsonb(new) ->> 'proposed_by')::uuid
  );
begin
  update public.team_requests
     set last_activity_at = now(),
         last_activity_by = v_actor
   where id = new.request_id;
  return new;
end
$$;

create trigger trg_team_comments_bump
  after insert on public.team_request_comments
  for each row execute function public.team_board_bump_activity();
create trigger trg_team_proposals_bump
  after insert on public.team_request_candidates
  for each row execute function public.team_board_bump_activity();

-- Completar/reabrir también cuenta como actividad (BEFORE: sin update anidado).
create or replace function public.team_board_touch_on_status()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    new.last_activity_at := now();
    new.last_activity_by := auth.uid();
    if new.status = 'completada' then
      new.completed_at := now();
      new.completed_by := auth.uid();
    else
      new.completed_at := null;
      new.completed_by := null;
    end if;
  end if;
  return new;
end
$$;

create trigger trg_team_requests_touch_status
  before update of status on public.team_requests
  for each row execute function public.team_board_touch_on_status();

-- ----------------------------------------------------------------------------
-- Trigger: aviso en vivo (Broadcast from Database, sin PII en el payload)
-- ----------------------------------------------------------------------------

create or replace function public.team_board_broadcast()
returns trigger
language plpgsql
security definer          -- authenticated no tiene privilegios sobre realtime
set search_path = public
as $$
declare
  v_row jsonb := to_jsonb(new); -- los campos difieren por tabla: nunca new.<campo> directo
  v_request uuid;
  v_kind text;
begin
  if tg_table_name = 'team_request_comments' then
    v_request := new.request_id;
    v_kind := 'respuesta';
  elsif tg_op = 'UPDATE' then
    v_request := new.id;
    v_kind := 'estado';
  else
    v_request := new.id;
    v_kind := 'nueva';
  end if;
  perform realtime.send(
    jsonb_build_object(
      'request_id', v_request,
      'kind', v_kind,
      'by', coalesce((v_row ->> 'last_activity_by')::uuid, (v_row ->> 'author_user_id')::uuid)
    ),
    'team_board_ping',
    'company:' || new.company_id::text,
    true  -- private: la policy de realtime.messages ya cubre el topic
  );
  return new;
exception when others then
  -- Un fallo del broadcast jamás tumba la escritura
  return new;
end
$$;

create trigger trg_team_requests_broadcast
  after insert on public.team_requests
  for each row execute function public.team_board_broadcast();
create trigger trg_team_requests_broadcast_status
  after update of status on public.team_requests
  for each row execute function public.team_board_broadcast();
create trigger trg_team_comments_broadcast
  after insert on public.team_request_comments
  for each row execute function public.team_board_broadcast();

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------

alter table public.team_requests enable row level security;

-- El tablón es de empresa: lo ve TODO el equipo, incluido el encargado.
create policy "team_requests_select" on public.team_requests
  for select using (company_id in (select public.current_user_company_ids()));

-- Publicar: cualquier miembro, en su empresa. El trigger fija el autor, pero el
-- check ata la fila al uid por si el trigger cambiara algún día.
create policy "team_requests_insert" on public.team_requests
  for insert with check (
    company_id in (select public.current_user_company_ids())
    and (author_user_id is null or author_user_id = auth.uid())
  );

-- Completar/reabrir/editar: el autor o el owner de la empresa.
create policy "team_requests_update" on public.team_requests
  for update using (
    author_user_id = auth.uid()
    or company_id in (
      select m.company_id from public.memberships m
      where m.user_id = auth.uid() and m.role = 'owner'
    )
  ) with check (company_id in (select public.current_user_company_ids()));

create policy "team_requests_delete" on public.team_requests
  for delete using (
    author_user_id = auth.uid()
    or company_id in (
      select m.company_id from public.memberships m
      where m.user_id = auth.uid() and m.role = 'owner'
    )
  );

alter table public.team_request_comments enable row level security;

create policy "team_comments_select" on public.team_request_comments
  for select using (company_id in (select public.current_user_company_ids()));

-- El company_id lo fija el trigger desde la petición; el check exige que esa
-- petición sea de una empresa del usuario.
create policy "team_comments_insert" on public.team_request_comments
  for insert with check (
    request_id in (
      select r.id from public.team_requests r
      where r.company_id in (select public.current_user_company_ids())
    )
  );

alter table public.team_request_candidates enable row level security;

-- La FILA del puente la ve todo el equipo (contar propuestas); el DATO del
-- candidato lo sigue protegiendo candidates_scoped.
create policy "team_proposals_select" on public.team_request_candidates
  for select using (company_id in (select public.current_user_company_ids()));

-- CLAVE: proponer exige poder VER el candidato. La subquery corre como invoker,
-- así que la RLS de candidates (acotación por sede del encargado, locked del
-- plan trial) aplica sola. Y el candidato debe ser de la misma empresa que la
-- petición (nada de cruzar candidatos entre empresas del mismo usuario).
create policy "team_proposals_insert" on public.team_request_candidates
  for insert with check (
    exists (
      select 1
      from public.candidates c
      join public.team_requests r on r.id = request_id
      where c.id = candidate_id
        and c.company_id = r.company_id
        and r.company_id in (select public.current_user_company_ids())
    )
  );

-- Retirar una propuesta: quien la hizo, el autor de la petición o el owner.
create policy "team_proposals_delete" on public.team_request_candidates
  for delete using (
    proposed_by = auth.uid()
    or request_id in (select r.id from public.team_requests r where r.author_user_id = auth.uid())
    or company_id in (
      select m.company_id from public.memberships m
      where m.user_id = auth.uid() and m.role = 'owner'
    )
  );

-- ----------------------------------------------------------------------------
-- Grants (explícitos: en este backend nadie hereda, tampoco service_role)
-- ----------------------------------------------------------------------------

grant select, insert, update, delete on public.team_requests to authenticated;
grant select, insert on public.team_request_comments to authenticated;
grant select, insert, delete on public.team_request_candidates to authenticated;

-- La edge function notify-team-board lee filas y reclama notified_at con el
-- cliente admin (service_role NO hereda privilegios de tabla).
grant select, update on public.team_requests to service_role;
grant select, update on public.team_request_comments to service_role;
grant select on public.team_request_candidates to service_role;
-- ...y autoriza al llamante comprobando su membership con el cliente admin.
grant select on public.memberships to service_role;

-- ----------------------------------------------------------------------------
-- RPC para la edge function: emails del equipo (solo service_role)
-- ----------------------------------------------------------------------------

create or replace function public.team_board_emails(p_company uuid)
returns table(user_id uuid, email text)
language sql
stable
security definer
set search_path = public, auth
as $$
  select m.user_id, u.email
  from public.memberships m
  join auth.users u on u.id = m.user_id
  where m.company_id = p_company and u.email is not null
$$;
revoke all on function public.team_board_emails(uuid) from public, anon, authenticated;
grant execute on function public.team_board_emails(uuid) to service_role;
