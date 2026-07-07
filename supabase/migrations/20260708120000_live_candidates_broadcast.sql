-- ============================================================================
-- Apúntate Fácil: live reload de candidatos (Broadcast from Database)
-- ----------------------------------------------------------------------------
-- Al entrar una candidatura, un trigger emite un ping Realtime al topic privado
-- de la empresa ('company:<company_id>'). El payload NO lleva PII: solo
-- campaign_id, locked y created_at. El cliente decide con eso qué recargar
-- (candidatos visibles o el preview de bloqueados del plan trial).
--
-- Por qué broadcast y no postgres_changes: la RLS candidates_scoped oculta los
-- candidatos locked=true, así que un trial con el cupo lleno no recibiría
-- ningún evento; el ping del trigger llega siempre.
-- ============================================================================

create or replace function public.broadcast_new_candidate()
returns trigger
language plpgsql
security definer          -- authenticated inserta directo (alta manual) y no
set search_path = public  -- tiene privilegios sobre el schema realtime
as $$
begin
  perform realtime.send(
    jsonb_build_object(
      'campaign_id', new.campaign_id,
      'locked', new.locked,
      'created_at', new.created_at
    ),
    'new_candidate',
    'company:' || new.company_id::text,
    true  -- private: exige policy de select en realtime.messages
  );
  return new;
exception when others then
  -- Un fallo del broadcast jamás tumba el alta de la candidatura
  return new;
end
$$;

-- AFTER INSERT: trg_enforce_candidate_limit es BEFORE, así new.locked ya es
-- definitivo cuando emitimos el ping.
drop trigger if exists trg_broadcast_new_candidate on public.candidates;
create trigger trg_broadcast_new_candidate
  after insert on public.candidates
  for each row execute function public.broadcast_new_candidate();

-- Escucha del canal privado: solo miembros de la empresa del topic.
create policy "company_members_receive_broadcast"
  on realtime.messages
  for select
  to authenticated
  using (
    extension = 'broadcast'
    and realtime.topic() in (
      select 'company:' || cid::text from public.current_user_company_ids() cid
    )
  );
