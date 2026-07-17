-- Amplía el aviso en vivo del tablón: retirar un candidato o borrar una
-- petición también emite team_board_ping, para que el resto del equipo lo vea
-- sin recargar.

create or replace function public.team_board_broadcast_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb := to_jsonb(old);
  v_request uuid;
  v_company uuid;
  v_kind text;
begin
  if tg_table_name = 'team_request_candidates' then
    v_request := old.request_id;
    v_company := old.company_id;
    v_kind := 'retiro';
  else
    -- team_requests
    v_request := old.id;
    v_company := old.company_id;
    v_kind := 'borrada';
  end if;
  if v_company is null then
    return old;
  end if;
  perform realtime.send(
    jsonb_build_object(
      'request_id', v_request,
      'kind', v_kind,
      'by', coalesce(
        (v_row ->> 'proposed_by')::uuid,
        (v_row ->> 'last_activity_by')::uuid,
        (v_row ->> 'author_user_id')::uuid
      )
    ),
    'team_board_ping',
    'company:' || v_company::text,
    true
  );
  return old;
exception when others then
  return old;
end
$$;

create trigger trg_team_proposals_broadcast_delete
  after delete on public.team_request_candidates
  for each row execute function public.team_board_broadcast_delete();

create trigger trg_team_requests_broadcast_delete
  after delete on public.team_requests
  for each row execute function public.team_board_broadcast_delete();
