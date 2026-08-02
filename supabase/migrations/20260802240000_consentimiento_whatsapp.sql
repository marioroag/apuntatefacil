-- ============================================================================
-- Apúntate Fácil · el candidato acepta que le escribamos por WhatsApp
--
-- Hasta ahora la casilla del formulario público decía "acepto la política de
-- privacidad y que la empresa trate mis datos para este proceso de selección".
-- En ninguna parte decía que le fuéramos a escribir por WhatsApp, y la
-- aceptación NO se guardaba: ni fecha, ni qué texto se aceptó. Escribirle a
-- alguien que dejó su teléfono para apuntarse a una oferta, sin habérselo dicho
-- antes y sin poder demostrar que se le dijo, es lo que impedía usar el
-- asistente con candidatos reales.
--
-- Esta migración pone las dos mitades:
--   1. Se guarda CUÁNDO aceptó y QUÉ VERSIÓN del texto (src/lib/consent.ts es
--      un registro de solo añadir, así que el id se puede resolver siempre).
--   2. `start_interview_invitation` se niega sin consentimiento. Es el único
--      sitio donde nace una conversación de WhatsApp, y los recordatorios al
--      candidato exigen que exista una, así que gatear aquí gatea todo el canal.
--
-- Las candidaturas ANTERIORES se quedan sin consentimiento a propósito: nunca
-- se les dijo nada, así que no se les puede escribir. Rellenarlas con un `now()`
-- sería fabricar una prueba de algo que no ocurrió.
-- ============================================================================

alter table public.candidates
  add column consent_at      timestamptz,
  add column consent_version text;

comment on column public.candidates.consent_at is
  'Cuándo aceptó el candidato. Null = no consta, no se le puede escribir por WhatsApp.';
comment on column public.candidates.consent_version is
  'Id de versión del texto aceptado. Se resuelve en src/lib/consent.ts (registro de solo añadir).';

-- Cota de tamaño, como el resto de texto que llega de fuera.
alter table public.candidates
  add constraint candidates_consent_version_len check (char_length(consent_version) <= 40);

-- ----------------------------------------------------------------------------
-- 1) Recoger el consentimiento
-- ----------------------------------------------------------------------------
-- Va como parámetro NUEVO y no dentro de `answers`: `answers` es lo que el
-- cliente diseñó en su formulario, y mezclar ahí un dato legal lo dejaría
-- expuesto a que alguien borre el campo desde el constructor.
--
-- Cambiar la firma crea una función DISTINTA, no reemplaza la de 4 argumentos,
-- así que la vieja se borra abajo. Conservar las dos habría sido peor que
-- inútil: con cuatro claves las dos encajan (la quinta tiene default) y PostgREST
-- responde 300 "Could not choose the best candidate function", o sea que el
-- formulario público dejaría de enviar.
--
-- Con una sola de 5, el formulario que está vivo ahora mismo (manda 4 claves)
-- sigue funcionando: Postgres resuelve por defecto la quinta. Esa es la que
-- cubre la ventana entre `db push` y el despliegue del frontend.
create or replace function public.submit_application(
  p_slug            text,
  p_answers         jsonb,
  p_source          text default 'enlace',
  p_cv_path         text default null,
  p_consent_version text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  cmp     public.campaigns;
  cand_id uuid;
  v_ver   text := nullif(btrim(coalesce(p_consent_version, '')), '');
begin
  if length(coalesce(p_answers, '{}'::jsonb)::text) > 200000 then
    raise exception 'Respuestas demasiado largas';
  end if;
  if char_length(coalesce(v_ver, '')) > 40 then
    raise exception 'Versión de consentimiento no válida';
  end if;
  select * into cmp from public.campaigns where slug = p_slug;
  if not found then
    raise exception 'Puesto no encontrado';
  end if;
  if cmp.status <> 'activa' then
    raise exception 'Este puesto ya no acepta candidaturas';
  end if;
  -- La fecha la pone el servidor, nunca el cliente: es la prueba.
  insert into public.candidates(
      campaign_id, company_id, answers, source, cv_path, status,
      consent_at, consent_version)
    values (
      cmp.id, cmp.company_id, coalesce(p_answers, '{}'::jsonb),
      coalesce(p_source, 'enlace'), p_cv_path, 'nuevo',
      case when v_ver is null then null else now() end, v_ver)
    returning id into cand_id;
  return cand_id;
end
$$;

grant execute on function public.submit_application(text, jsonb, text, text, text)
  to anon, authenticated;

-- Fuera la de 4, que a partir de aquí solo puede causar ambigüedad.
drop function if exists public.submit_application(text, jsonb, text, text);

-- ----------------------------------------------------------------------------
-- 2) Sin consentimiento no se abre conversación
-- ----------------------------------------------------------------------------
-- Idéntica a la de 20260802160000 con una guarda más, colocada JUNTO a las otras
-- del mismo tipo (plan, puesto inactivo, sin teléfono, baja) y antes de crear
-- nada. Devuelve un estado, no una excepción: no es un error del empresario.
create or replace function public.start_interview_invitation(
  p_candidate   uuid,
  p_host        uuid  default null,
  p_duration    int   default 30,
  p_buffer      int   default 15,
  p_mode        text  default 'presencial',
  p_location    text  default '',
  p_meeting_url text  default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ctx record;
  v_interview public.interviews;
  v_conv public.candidate_conversations;
  v_host uuid := coalesce(p_host, auth.uid());
  v_sender uuid;
  v_wa text;
  v_lugar record;
  v_consent timestamptz;
begin
  select * into v_ctx from public.interview_candidate_context(p_candidate);
  if not found then raise exception 'No autorizado' using errcode = '42501'; end if;
  if not v_ctx.plan_ok then return jsonb_build_object('status', 'plan'); end if;
  if v_ctx.campaign_status <> 'activa' then return jsonb_build_object('status', 'puesto_inactivo'); end if;

  if not exists (
    select 1 from public.memberships m
     where m.user_id = v_host and m.company_id = v_ctx.company_id
  ) then raise exception 'El anfitrión no es del equipo' using errcode = '42501'; end if;

  select public.wa_id_de(c.answers ->> 'telefono'), c.consent_at
    into v_wa, v_consent
    from public.candidates c where c.id = p_candidate;
  if v_wa is null then return jsonb_build_object('status', 'sin_telefono'); end if;

  -- Se apuntó antes de que el formulario avisara de WhatsApp. No se le escribe.
  if v_consent is null then return jsonb_build_object('status', 'sin_consentimiento'); end if;

  if exists (select 1 from public.whatsapp_opt_outs o where o.wa_id = v_wa) then
    return jsonb_build_object('status', 'baja');
  end if;

  select id into v_sender from public.whatsapp_senders
   where active and company_id is not distinct from v_ctx.company_id
   order by company_id nulls last limit 1;
  if v_sender is null then
    select id into v_sender from public.whatsapp_senders where active and company_id is null limit 1;
  end if;

  select * into v_lugar from public.resolver_lugar_entrevista(
    v_ctx.company_id, v_host, p_mode, p_location);

  begin
    insert into public.interviews (
      company_id, campaign_id, candidate_id, host_user_id, created_by,
      status, origin, duration_minutes, buffer_minutes, timezone,
      mode, location_text, meeting_url, place_lat, place_lng)
    values (
      v_ctx.company_id, v_ctx.campaign_id, p_candidate, v_host, auth.uid(),
      'invitada', 'whatsapp', p_duration, p_buffer, v_ctx.tz,
      p_mode, v_lugar.location_text, p_meeting_url, v_lugar.place_lat, v_lugar.place_lng)
    returning * into v_interview;
  exception when unique_violation then
    select * into v_interview from public.interviews
     where candidate_id = p_candidate
       and status in ('invitada', 'proponiendo', 'confirmada', 'reprogramando');
    select * into v_conv from public.candidate_conversations
     where candidate_id = p_candidate and agent_state <> 'cerrada';
    return jsonb_build_object('status', 'ya_existe',
      'interview_id', v_interview.id, 'conversation_id', v_conv.id);
  end;

  insert into public.candidate_conversations (
    company_id, campaign_id, candidate_id, interview_id, sender_id, wa_id, agent_state)
  values (
    v_ctx.company_id, v_ctx.campaign_id, p_candidate, v_interview.id, v_sender, v_wa,
    'preparando')
  returning * into v_conv;

  return jsonb_build_object('status', 'ok',
    'interview_id', v_interview.id, 'conversation_id', v_conv.id);
end
$$;

revoke all on function public.start_interview_invitation(uuid, uuid, int, int, text, text, text)
  from public, anon;
grant execute on function public.start_interview_invitation(uuid, uuid, int, int, text, text, text)
  to authenticated;
