-- ============================================================================
-- CUOTAS EN LO QUE ESCRIBE UN ANÓNIMO (auditoría de seguridad, sep 2026)
--
-- Lo que entra por el formulario público y por el diálogo de soporte no tenía
-- ningún freno de VOLUMEN, solo de tamaño. Y detrás de cada candidatura hay
-- dinero: un correo al dueño y un análisis de Meridian con cuatro o cinco
-- llamadas a OpenAI, para todos los planes. Un script que envíe mil
-- candidaturas a un enlace público le paga mil análisis a la empresa, sin
-- cuenta y sin que nadie lo vea hasta la factura.
--
-- La cuota vive AQUÍ, en la RPC, y no en el cliente: el honeypot y el tiempo
-- mínimo del formulario (PublicForm) valen contra un bot torpe; contra un
-- script que llame al RPC a pelo solo vale lo que compruebe la base. Y es por
-- PUESTO y por hora, no por IP (Postgres no la ve) ni por empresa (un puesto
-- de peón en Milanuncios puede traer treinta candidaturas en una tarde, y
-- una ETT con seis puestos, muchas más).
--
-- Los números: 60 candidaturas por puesto y hora es el doble de lo que ha
-- traído nunca un puesto real en una hora; 5 consultas de soporte por correo
-- y hora es lo que escribe una persona con un problema, no un script.
-- ============================================================================

-- Para que el recuento por puesto y hora sea un salto de índice y no un
-- barrido: candidates ya tenía campaign_id, pero la cuenta filtra además por
-- fecha, y con cientos de candidaturas por puesto eso se nota en el camino
-- caliente del formulario.
create index if not exists candidates_campaign_created_idx
  on public.candidates (campaign_id, created_at desc);

create or replace function public.submit_application(
  p_slug            text,
  p_answers         jsonb,
  p_source          text default 'enlace',
  p_cv_path         text default null,
  p_consent_version text default null,
  p_docs            jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  cmp      public.campaigns;
  cand_id  uuid;
  v_ver    text := nullif(btrim(coalesce(p_consent_version, '')), '');
  doc      jsonb;
  v_path   text;
  v_nom    text;
  v_ultima int;
begin
  if length(coalesce(p_answers, '{}'::jsonb)::text) > 200000 then
    raise exception 'Respuestas demasiado largas';
  end if;
  if char_length(coalesce(v_ver, '')) > 40 then
    raise exception 'Versión de consentimiento no válida';
  end if;
  if jsonb_array_length(coalesce(p_docs, '[]'::jsonb)) > 10 then
    raise exception 'Demasiados documentos';
  end if;
  select * into cmp from public.campaigns where slug = p_slug;
  if not found then
    raise exception 'Puesto no encontrado';
  end if;
  if cmp.status <> 'activa' then
    raise exception 'Este puesto ya no acepta candidaturas';
  end if;

  -- CUOTA POR PUESTO Y HORA. El mensaje lleva un código que el formulario
  -- reconoce (RATE_LIMIT) para decir "espera un momento" en vez de "no
  -- pudimos enviar", que invitaría a reintentar en bucle.
  select count(*) into v_ultima
    from public.candidates
   where campaign_id = cmp.id and created_at > now() - interval '1 hour';
  if v_ultima >= 60 then
    raise exception 'RATE_LIMIT: demasiadas candidaturas seguidas en este puesto';
  end if;

  insert into public.candidates(
      campaign_id, company_id, answers, source, cv_path, status,
      consent_at, consent_version)
    values (
      cmp.id, cmp.company_id, coalesce(p_answers, '{}'::jsonb),
      coalesce(p_source, 'enlace'), p_cv_path, 'nuevo',
      case when v_ver is null then null else now() end, v_ver)
    returning id into cand_id;

  for doc in select * from jsonb_array_elements(coalesce(p_docs, '[]'::jsonb))
  loop
    v_path := nullif(btrim(coalesce(doc->>'path', '')), '');
    v_nom  := nullif(btrim(coalesce(doc->>'nombre', '')), '');
    continue when v_path is null or v_nom is null;
    if v_path !~ '^[a-z0-9][a-z0-9-]*/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]+$' then
      raise exception 'Ruta de documento no válida';
    end if;
    insert into public.candidate_documents(
        candidate_id, company_id, path, nombre, bytes, origen, campo_id)
      values (
        cand_id, cmp.company_id, v_path, left(v_nom, 200),
        nullif(doc->>'bytes', '')::bigint, 'candidato', left(doc->>'campo_id', 80));
  end loop;

  return cand_id;
end
$$;
revoke all on function public.submit_application(text, jsonb, text, text, text, jsonb) from public;
grant execute on function public.submit_application(text, jsonb, text, text, text, jsonb)
  to anon, authenticated;

-- ----------------------------------------------------------------------------
-- SOPORTE: cuota por correo y hora, y aviso idempotente.
--
-- `notify-support` es anónima (la llama la landing sin sesión) y mandaba un
-- correo al buzón de soporte en CADA llamada con un ticket_id conocido, sin
-- ninguna marca. Misma columna guardia que `candidates.notified_at`: la
-- función reclama antes de enviar, y el segundo intento no encuentra fila.
-- ----------------------------------------------------------------------------
alter table public.support_tickets add column if not exists notified_at timestamptz;
grant update (notified_at) on public.support_tickets to service_role;

create or replace function public.submit_support_request(
  p_email text,
  p_message text,
  p_name text default null,
  p_source text default 'app',
  p_page text default null,
  p_company_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_company uuid;
  v_plan text;
  v_ticket uuid;
  v_email text := nullif(trim(p_email), '');
  v_message text := nullif(trim(p_message), '');
  v_source text := coalesce(nullif(trim(p_source), ''), 'app');
  v_ultimas int;
begin
  if v_message is null then
    raise exception 'El mensaje no puede estar vacío';
  end if;
  if char_length(v_message) > 10000 then
    raise exception 'El mensaje es demasiado largo (máximo 10000 caracteres)';
  end if;
  if v_email is null or position('@' in v_email) = 0 or char_length(v_email) > 254 then
    raise exception 'Hace falta un email válido';
  end if;
  if v_source not in ('app', 'landing') then
    v_source := 'app';
  end if;

  -- CUOTA POR CORREO Y HORA. Quien tiene un problema escribe una vez, quizá
  -- dos; cinco en una hora desde el mismo correo es un script.
  select count(*) into v_ultimas
    from public.support_tickets
   where lower(email) = lower(v_email) and created_at > now() - interval '1 hour';
  if v_ultimas >= 5 then
    raise exception 'RATE_LIMIT: demasiadas consultas seguidas';
  end if;

  if v_user is not null and p_company_id is not null
     and p_company_id in (select public.current_user_company_ids()) then
    v_company := p_company_id;
    select plan into v_plan from public.companies where id = v_company;
  end if;

  insert into public.support_tickets(company_id, user_id, email, name, message, source, plan, page)
    values (v_company, v_user, v_email, nullif(trim(p_name), ''), v_message,
            v_source, v_plan, nullif(trim(p_page), ''))
    returning id into v_ticket;
  return v_ticket;
end;
$$;
revoke all on function public.submit_support_request(text, text, text, text, text, uuid) from public;
grant execute on function public.submit_support_request(text, text, text, text, text, uuid) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- LA RESPUESTA DE INTERÉS SE DA UNA VEZ. El token viaja en la ruta de la URL
-- (y de ahí a historiales y analíticas), y hasta hoy seguía sirviendo para
-- CAMBIAR la respuesta hasta caducar. Un token filtrado ya no puede darle la
-- vuelta a un "me interesa": la primera respuesta se queda, y volver a
-- confirmar devuelve la que hay, sin error, para que la pantalla siga
-- enseñando lo que la persona dijo.
-- ----------------------------------------------------------------------------
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
  if v_check.response is not null then
    return jsonb_build_object('status', 'ok', 'response', v_check.response);
  end if;

  update public.candidate_interest_checks
     set response = p_response,
         responded_at = now()
   where id = v_check.id;
  return jsonb_build_object('status', 'ok', 'response', p_response);
end;
$$;
revoke all on function public.confirm_candidate_interest_response(text, text) from public;
grant execute on function public.confirm_candidate_interest_response(text, text) to anon, authenticated;
