-- ==========================================================================
-- Meridian, cimientos para la implementación real.
--
-- 1) BUG SILENCIOSO EN PRODUCCIÓN. `analyze-candidate` escribe candidates.ai
--    con service_role, pero los únicos permisos de service_role sobre
--    candidates son `select` (20260624130000) y `update (notified_at)`
--    (20260706120000). Ese UPDATE devuelve 42501 y el código ignora el error:
--    la función responde {ok:true, analyzed:true} sin haber guardado nada.
--    Es el mismo patrón del BUG A de facturación (20260706160000). En este
--    backend service_role NO hereda permisos de tabla: hay que concederlos
--    columna a columna.
--
-- 2) RECLAMO ATÓMICO del análisis. `analyze-candidate` es verify_jwt=false
--    (lo llama el formulario público, que es anónimo) y hoy comprueba "¿ya
--    tiene análisis?" con un read-then-write: dos invocaciones simultáneas
--    llaman las dos a OpenAI. Con una columna de reclamo aparte el UPDATE
--    condicional es un compare-and-swap real, igual que notified_at en
--    notify-new-candidate. Va en su propia columna y no dentro de `ai` para
--    no meter estados intermedios en el JSON que lee la interfaz.
--
-- 3) batch_id en las vistas de interés. Meridian agrupa lo que está en marcha
--    por ENVÍO (lote), no por candidato, así que el resumen por candidato
--    tiene que decir a qué lote pertenece. Cambia el tipo de retorno, y eso
--    obliga a drop + create (create or replace no puede cambiarlo).
-- ==========================================================================

alter table public.candidates
  add column if not exists ai_claimed_at timestamptz;

grant update (ai, ai_claimed_at) on public.candidates to service_role;

drop function if exists public.candidate_interest_overview(uuid);
create function public.candidate_interest_overview(p_campaign uuid)
returns table (
  candidate_id uuid,
  check_id uuid,
  batch_id uuid,
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
         l.candidate_id, ch.id, ch.batch_id, ch.response, ch.sent_at, ch.responded_at,
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

drop function if exists public.candidate_interest_overview_for_company(uuid);
create function public.candidate_interest_overview_for_company(p_company uuid)
returns table (
  candidate_id uuid,
  check_id uuid,
  batch_id uuid,
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
         l.candidate_id, ch.id, ch.batch_id, ch.response, ch.sent_at, ch.responded_at,
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
