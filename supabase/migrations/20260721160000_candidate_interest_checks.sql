-- ==========================================================================
-- Comprobación manual del interés de candidatos por email.
-- Historial separado del estado de selección, RLS por puesto/sede y respuesta
-- anónima únicamente mediante token opaco. El token en claro nunca se guarda.
-- ==========================================================================

create table public.candidate_interest_batches (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  campaign_id     uuid not null references public.campaigns(id) on delete cascade,
  initiated_by    uuid references auth.users(id) on delete set null,
  idempotency_key uuid not null,
  created_at      timestamptz not null default now(),
  unique (company_id, idempotency_key)
);
create index candidate_interest_batches_campaign_created_idx
  on public.candidate_interest_batches(campaign_id, created_at desc);

create table public.candidate_interest_checks (
  id                           uuid primary key default gen_random_uuid(),
  batch_id                     uuid not null references public.candidate_interest_batches(id) on delete cascade,
  reminder_batch_id            uuid references public.candidate_interest_batches(id) on delete set null,
  company_id                   uuid not null references public.companies(id) on delete cascade,
  campaign_id                  uuid not null references public.campaigns(id) on delete cascade,
  recipient_email              text not null check (char_length(recipient_email) between 3 and 320),
  delivery_status              text not null default 'pending' check (delivery_status in ('pending','sent','failed')),
  response                     text check (response in ('interested','not_interested')),
  token_hash                   text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  provider_message_id          text,
  delivery_error               text check (delivery_error is null or char_length(delivery_error) <= 500),
  sent_at                      timestamptz,
  responded_at                 timestamptz,
  reminder_sent_at             timestamptz,
  reminder_provider_message_id text,
  reminder_delivery_error      text check (reminder_delivery_error is null or char_length(reminder_delivery_error) <= 500),
  expires_at                   timestamptz not null,
  superseded_at                timestamptz,
  created_at                   timestamptz not null default now(),
  check (expires_at > created_at),
  check (response is null or responded_at is not null)
);
create index candidate_interest_checks_campaign_created_idx
  on public.candidate_interest_checks(campaign_id, created_at desc);
create index candidate_interest_checks_company_email_idx
  on public.candidate_interest_checks(company_id, campaign_id, lower(recipient_email), created_at desc);

create table public.candidate_interest_check_candidates (
  check_id     uuid not null references public.candidate_interest_checks(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (check_id, candidate_id)
);
create index candidate_interest_check_candidates_candidate_idx
  on public.candidate_interest_check_candidates(candidate_id, check_id);

-- Integridad multi-tenant. La función de envío usa service_role después de
-- autorizar con el JWT, por eso el esquema vuelve a comprobar cada relación.
create or replace function public.enforce_candidate_interest_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_campaign uuid;
begin
  if tg_table_name = 'candidate_interest_batches' then
    select company_id into v_company from public.campaigns where id = new.campaign_id;
    if v_company is null then raise exception 'Puesto no encontrado'; end if;
    new.company_id := v_company;
    new.initiated_by := coalesce(new.initiated_by, auth.uid());
  elsif tg_table_name = 'candidate_interest_checks' then
    select company_id, campaign_id into v_company, v_campaign
      from public.candidate_interest_batches where id = new.batch_id;
    if v_company is null then raise exception 'Lote no encontrado'; end if;
    new.company_id := v_company;
    new.campaign_id := v_campaign;
    new.recipient_email := lower(btrim(new.recipient_email));
    if new.reminder_batch_id is not null and not exists (
      select 1 from public.candidate_interest_batches b
       where b.id = new.reminder_batch_id
         and b.company_id = v_company
         and b.campaign_id = v_campaign
    ) then
      raise exception 'El lote de recordatorio no corresponde a la comprobación';
    end if;
  elsif tg_table_name = 'candidate_interest_check_candidates' then
    select c.company_id, c.campaign_id into v_company, v_campaign
      from public.candidates c where c.id = new.candidate_id and not c.locked;
    if v_company is null then raise exception 'Candidato no disponible'; end if;
    if not exists (
      select 1 from public.candidate_interest_checks ch
       where ch.id = new.check_id
         and ch.company_id = v_company
         and ch.campaign_id = v_campaign
    ) then
      raise exception 'La comprobación no corresponde al candidato';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_interest_batches_integrity
  before insert or update on public.candidate_interest_batches
  for each row execute function public.enforce_candidate_interest_integrity();
create trigger trg_interest_checks_integrity
  before insert or update on public.candidate_interest_checks
  for each row execute function public.enforce_candidate_interest_integrity();
create trigger trg_interest_links_integrity
  before insert or update on public.candidate_interest_check_candidates
  for each row execute function public.enforce_candidate_interest_integrity();

-- Elimina comprobaciones y lotes que se quedan sin candidaturas relacionadas.
create or replace function public.cleanup_candidate_interest_orphans()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_batch uuid;
begin
  if exists (select 1 from public.candidate_interest_check_candidates where check_id = old.check_id) then
    return old;
  end if;
  select batch_id into v_batch from public.candidate_interest_checks where id = old.check_id;
  delete from public.candidate_interest_checks where id = old.check_id;
  if v_batch is not null
     and not exists (select 1 from public.candidate_interest_checks where batch_id = v_batch or reminder_batch_id = v_batch) then
    delete from public.candidate_interest_batches where id = v_batch;
  end if;
  return old;
end;
$$;
create trigger trg_interest_cleanup_orphans
  after delete on public.candidate_interest_check_candidates
  for each row execute function public.cleanup_candidate_interest_orphans();

-- RLS: solo lectura autenticada y siempre a través de candidatos visibles. Las
-- escrituras de envío son del servidor; anon no recibe privilegios de tabla.
alter table public.candidate_interest_batches enable row level security;
alter table public.candidate_interest_checks enable row level security;
alter table public.candidate_interest_check_candidates enable row level security;

create policy "interest_batches_select_visible" on public.candidate_interest_batches
  for select to authenticated
  using (campaign_id in (select public.current_user_campaign_ids()));

create policy "interest_checks_select_visible" on public.candidate_interest_checks
  for select to authenticated
  using (
    exists (
      select 1
        from public.candidate_interest_check_candidates l
        join public.candidates c on c.id = l.candidate_id
       where l.check_id = candidate_interest_checks.id
         and c.campaign_id in (select public.current_user_campaign_ids())
         and not c.locked
    )
  );

create policy "interest_links_select_visible" on public.candidate_interest_check_candidates
  for select to authenticated
  using (
    exists (
      select 1 from public.candidates c
       where c.id = candidate_id
         and c.campaign_id in (select public.current_user_campaign_ids())
         and not c.locked
    )
  );

revoke all on public.candidate_interest_batches from anon, authenticated;
revoke all on public.candidate_interest_checks from anon, authenticated;
revoke all on public.candidate_interest_check_candidates from anon, authenticated;
grant select on public.candidate_interest_batches to authenticated;
grant select on public.candidate_interest_checks to authenticated;
grant select on public.candidate_interest_check_candidates to authenticated;
grant select, insert, update, delete on public.candidate_interest_batches to service_role;
grant select, insert, update, delete on public.candidate_interest_checks to service_role;
grant select, insert, update, delete on public.candidate_interest_check_candidates to service_role;

-- Última comprobación por candidato. Invoker mantiene la RLS de candidatos y de
-- las tablas nuevas; el store la filtra además por el puesto activo.
create or replace function public.candidate_interest_overview(p_campaign uuid)
returns table (
  candidate_id uuid,
  check_id uuid,
  response text,
  sent_at timestamptz,
  responded_at timestamptz,
  reminder_sent_at timestamptz,
  expires_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select distinct on (l.candidate_id)
         l.candidate_id, ch.id, ch.response, ch.sent_at, ch.responded_at,
         ch.reminder_sent_at, ch.expires_at
    from public.candidate_interest_check_candidates l
    join public.candidate_interest_checks ch on ch.id = l.check_id
    join public.candidates c on c.id = l.candidate_id
   where c.campaign_id = p_campaign
     and ch.delivery_status = 'sent'
     and ch.sent_at is not null
   order by l.candidate_id, ch.created_at desc;
$$;
revoke all on function public.candidate_interest_overview(uuid) from public, anon;
grant execute on function public.candidate_interest_overview(uuid) to authenticated;

create or replace function public.candidate_interest_overview_for_company(p_company uuid)
returns table (
  candidate_id uuid,
  check_id uuid,
  response text,
  sent_at timestamptz,
  responded_at timestamptz,
  reminder_sent_at timestamptz,
  expires_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select distinct on (l.candidate_id)
         l.candidate_id, ch.id, ch.response, ch.sent_at, ch.responded_at,
         ch.reminder_sent_at, ch.expires_at
    from public.candidate_interest_check_candidates l
    join public.candidate_interest_checks ch on ch.id = l.check_id
    join public.candidates c on c.id = l.candidate_id
   where c.company_id = p_company
     and ch.delivery_status = 'sent'
     and ch.sent_at is not null
   order by l.candidate_id, ch.created_at desc;
$$;
revoke all on function public.candidate_interest_overview_for_company(uuid) from public, anon;
grant execute on function public.candidate_interest_overview_for_company(uuid) to authenticated;

-- Contexto público de solo lectura. Nunca cambia la respuesta al abrir el enlace.
create or replace function public.get_candidate_interest_response(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_check public.candidate_interest_checks;
  v_company text;
  v_campaign text;
begin
  if p_token is null or char_length(p_token) < 32 or char_length(p_token) > 256 then
    return jsonb_build_object('status', 'invalid');
  end if;
  select * into v_check
    from public.candidate_interest_checks
   where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
     and delivery_status = 'sent';
  if not found then return jsonb_build_object('status', 'invalid'); end if;
  if v_check.superseded_at is not null then return jsonb_build_object('status', 'superseded'); end if;
  if v_check.expires_at <= now() then return jsonb_build_object('status', 'expired'); end if;

  select coalesce(b.name, co.name), ca.title into v_company, v_campaign
    from public.campaigns ca
    join public.companies co on co.id = ca.company_id
    left join public.brands b on b.id = ca.brand_id
   where ca.id = v_check.campaign_id;

  return jsonb_build_object(
    'status', 'ok',
    'company_name', v_company,
    'campaign_title', v_campaign,
    'response', v_check.response
  );
end;
$$;

create or replace function public.confirm_candidate_interest_response(p_token text, p_response text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_check public.candidate_interest_checks;
begin
  if p_response not in ('interested', 'not_interested') then
    return jsonb_build_object('status', 'invalid_response');
  end if;
  if p_token is null or char_length(p_token) < 32 or char_length(p_token) > 256 then
    return jsonb_build_object('status', 'invalid');
  end if;
  select * into v_check
    from public.candidate_interest_checks
   where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
     and delivery_status = 'sent'
   for update;
  if not found then return jsonb_build_object('status', 'invalid'); end if;
  if v_check.superseded_at is not null then return jsonb_build_object('status', 'superseded'); end if;
  if v_check.expires_at <= now() then return jsonb_build_object('status', 'expired'); end if;

  update public.candidate_interest_checks
     set response = p_response,
         responded_at = now()
   where id = v_check.id;
  return jsonb_build_object('status', 'ok', 'response', p_response);
end;
$$;

revoke all on function public.get_candidate_interest_response(text) from public;
revoke all on function public.confirm_candidate_interest_response(text, text) from public;
grant execute on function public.get_candidate_interest_response(text) to anon, authenticated;
grant execute on function public.confirm_candidate_interest_response(text, text) to anon, authenticated;

-- Ping sin PII para que un panel abierto refresque cuando se envía o responde.
create or replace function public.broadcast_candidate_interest()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform realtime.send(
    jsonb_build_object('campaign_id', new.campaign_id),
    'candidate_interest_ping',
    'company:' || new.company_id::text,
    true
  );
  return new;
exception when others then
  return new;
end;
$$;
create trigger trg_broadcast_candidate_interest
  after update of delivery_status, response, reminder_sent_at, superseded_at
  on public.candidate_interest_checks
  for each row execute function public.broadcast_candidate_interest();
