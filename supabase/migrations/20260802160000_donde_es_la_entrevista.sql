-- ============================================================================
-- Apúntate Fácil: dónde tiene que ir el candidato
-- ----------------------------------------------------------------------------
-- Lo que pasaba, tal cual lo vio Mario probándolo con su número: la cita se
-- cerraba y el mensaje decía "Presencial". Nada más. "Presencial" contesta a
-- CÓMO es la entrevista mientras finge contestar a DÓNDE, que es lo único que
-- el candidato necesita saber para presentarse.
--
-- Y no era un fallo de redacción. Era que la dirección no existía en ningún
-- sitio: `interview_hosts.default_location` está en la base desde el primer día
-- y NINGUNA pantalla la escribía nunca. Una columna muerta.
--
-- Aquí se monta lo que faltaba:
--
--   1. El sitio pasa a tener DOS mitades: la dirección que se lee y el punto
--      que se toca. El punto lo da el cliente pegando su enlace de Google Maps
--      (de ahí salen las coordenadas), así que no entra ningún geocodificador
--      de terceros: ni clave, ni coste, ni un subencargado nuevo que declarar.
--   2. La entrevista COPIA el sitio del anfitrión al crearse, no lo referencia.
--      Si la empresa se muda de nave el mes que viene, una cita ya confirmada
--      no puede cambiar de dirección a espaldas de nadie.
--   3. Las coordenadas viajan SOLO con la dirección a la que pertenecen. Si
--      quien invita escribe otra dirección distinta a la suya de siempre, se
--      manda esa dirección sin punto: mejor sin pin que con un pin que apunta
--      a otro lado.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) El sitio del anfitrión
-- ----------------------------------------------------------------------------
-- `default_place_url` no lo usa nadie para mandar mensajes: se guarda para que
-- el campo de Ajustes enseñe al volver lo mismo que se pegó. Sin él habría que
-- pintar las coordenadas crudas en un campo que dice "enlace de Google Maps",
-- y quien lo abriera creería que se lo hemos roto.
alter table public.interview_hosts
  add column if not exists default_place_lat double precision,
  add column if not exists default_place_lng double precision,
  add column if not exists default_place_url text not null default '';

do $$ begin
  alter table public.interview_hosts
    add constraint interview_hosts_place_url_corta
    check (char_length(default_place_url) <= 2000);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.interview_hosts
    add constraint interview_hosts_place_completo
    check (
      (default_place_lat is null) = (default_place_lng is null)
      and (default_place_lat is null or default_place_lat between -90 and 90)
      and (default_place_lng is null or default_place_lng between -180 and 180)
    );
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- 2) El sitio de cada entrevista
-- ----------------------------------------------------------------------------
alter table public.interviews
  add column if not exists place_lat double precision,
  add column if not exists place_lng double precision;

do $$ begin
  alter table public.interviews
    add constraint interviews_place_completo
    check (
      (place_lat is null) = (place_lng is null)
      and (place_lat is null or place_lat between -90 and 90)
      and (place_lng is null or place_lng between -180 and 180)
    );
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- 3) De dónde saca su sitio una entrevista que nace
-- ----------------------------------------------------------------------------
-- Se resuelve en la base y no en la interfaz a propósito: hay tres caminos que
-- crean entrevistas (invitar por WhatsApp, agendar a mano y lo que venga) y la
-- regla tiene que ser una sola. Si vive en un componente de React, el segundo
-- camino que alguien escriba se olvidará de ella.
--
-- Devuelve (texto, lat, lng) ya resueltos:
--   * sin dirección pedida  -> la del anfitrión, con su punto.
--   * la misma dirección    -> la suya, con su punto (quien invita la vio
--                              prerrellenada y la dejó tal cual).
--   * otra dirección        -> esa, SIN punto. No lo tenemos.
create or replace function public.resolver_lugar_entrevista(
  p_company  uuid,
  p_host     uuid,
  p_mode     text,
  p_location text
)
returns table (location_text text, place_lat double precision, place_lng double precision)
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_host public.interview_hosts; v_pedida text;
begin
  -- Una videollamada no tiene dirección física. Devolver la de la oficina aquí
  -- haría que el mensaje dijera las dos cosas.
  if p_mode is distinct from 'presencial' then
    return query select ''::text, null::double precision, null::double precision;
    return;
  end if;

  select * into v_host from public.interview_hosts
   where company_id = p_company and user_id = p_host;

  v_pedida := btrim(coalesce(p_location, ''));

  if v_pedida = '' then
    return query select
      btrim(coalesce(v_host.default_location, '')),
      v_host.default_place_lat,
      v_host.default_place_lng;
    return;
  end if;

  if v_host is not null and lower(v_pedida) = lower(btrim(coalesce(v_host.default_location, ''))) then
    return query select v_pedida, v_host.default_place_lat, v_host.default_place_lng;
    return;
  end if;

  return query select v_pedida, null::double precision, null::double precision;
end
$$;
revoke all on function public.resolver_lugar_entrevista(uuid, uuid, text, text) from public, anon;
grant execute on function public.resolver_lugar_entrevista(uuid, uuid, text, text)
  to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 4) Invitar por WhatsApp: hereda el sitio
-- ----------------------------------------------------------------------------
-- Idéntica a la de 20260801160000 salvo el bloque del lugar. Se repite entera
-- porque `create or replace` no admite parches.
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
begin
  select * into v_ctx from public.interview_candidate_context(p_candidate);
  if not found then raise exception 'No autorizado' using errcode = '42501'; end if;
  if not v_ctx.plan_ok then return jsonb_build_object('status', 'plan'); end if;
  if v_ctx.campaign_status <> 'activa' then return jsonb_build_object('status', 'puesto_inactivo'); end if;

  if not exists (
    select 1 from public.memberships m
     where m.user_id = v_host and m.company_id = v_ctx.company_id
  ) then raise exception 'El anfitrión no es del equipo' using errcode = '42501'; end if;

  select public.wa_id_de(c.answers ->> 'telefono') into v_wa
    from public.candidates c where c.id = p_candidate;
  if v_wa is null then return jsonb_build_object('status', 'sin_telefono'); end if;

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

-- ----------------------------------------------------------------------------
-- 5) Agendar a mano: mismo sitio, misma regla
-- ----------------------------------------------------------------------------
create or replace function public.create_manual_interview(
  p_candidate  uuid,
  p_starts_at  timestamptz default null,
  p_host       uuid    default null,
  p_duration   int     default 30,
  p_buffer     int     default 0,
  p_mode       text    default 'presencial',
  p_location   text    default '',
  p_meeting_url text   default null,
  p_starts_local text  default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.interviews;
  v_ctx record;
  v_host uuid := coalesce(p_host, auth.uid());
  v_starts timestamptz;
  v_lugar record;
begin
  select * into v_ctx from public.interview_candidate_context(p_candidate);
  if not found then raise exception 'No autorizado' using errcode = '42501'; end if;
  if not v_ctx.plan_ok then return jsonb_build_object('status', 'plan'); end if;
  if v_ctx.campaign_status <> 'activa' then return jsonb_build_object('status', 'puesto_inactivo'); end if;

  if p_starts_local is not null and btrim(p_starts_local) <> '' then
    begin
      v_starts := (replace(btrim(p_starts_local), 'T', ' '))::timestamp at time zone v_ctx.tz;
    exception when others then
      return jsonb_build_object('status', 'fecha_no_valida');
    end;
  else
    v_starts := p_starts_at;
  end if;
  if v_starts is null then return jsonb_build_object('status', 'fecha_no_valida'); end if;

  if not exists (
    select 1 from public.memberships m
     where m.user_id = v_host and m.company_id = v_ctx.company_id
  ) then raise exception 'El anfitrión no es del equipo' using errcode = '42501'; end if;

  select * into v_lugar from public.resolver_lugar_entrevista(
    v_ctx.company_id, v_host, p_mode, p_location);

  begin
    insert into public.interviews (
      company_id, campaign_id, candidate_id, host_user_id, created_by,
      status, origin, starts_at, ends_at, duration_minutes, buffer_minutes,
      timezone, mode, location_text, meeting_url, place_lat, place_lng, confirmed_at)
    values (
      v_ctx.company_id, v_ctx.campaign_id, p_candidate, v_host, auth.uid(),
      'confirmada', 'manual',
      v_starts, v_starts + make_interval(mins => p_duration), p_duration, p_buffer,
      v_ctx.tz, p_mode, v_lugar.location_text, p_meeting_url,
      v_lugar.place_lat, v_lugar.place_lng, now())
    returning * into v;
  exception
    when exclusion_violation then
      return jsonb_build_object('status', 'ocupado');
    when unique_violation then
      select * into v from public.interviews
       where candidate_id = p_candidate
         and status in ('invitada', 'proponiendo', 'confirmada', 'reprogramando');
      return jsonb_build_object('status', 'ya_existe', 'interview_id', v.id);
  end;

  perform public.interview_sync_candidate_status(p_candidate);
  return jsonb_build_object('status', 'ok', 'interview_id', v.id);
end
$$;
revoke all on function public.create_manual_interview(uuid, timestamptz, uuid, int, int, text, text, text, text)
  from public, anon;
grant execute on function public.create_manual_interview(uuid, timestamptz, uuid, int, int, text, text, text, text)
  to authenticated;

-- ----------------------------------------------------------------------------
-- 6) La configuración del anfitrión devuelve el sitio entero
-- ----------------------------------------------------------------------------
create or replace function public.interview_host_config(p_company uuid, p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_host public.interview_hosts; v_reglas jsonb;
begin
  select * into v_host from public.interview_hosts
   where company_id = p_company and user_id = p_user;
  if not found then return null; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'weekday', weekday, 'startMin', start_min, 'endMin', end_min) order by weekday, start_min), '[]'::jsonb)
    into v_reglas
    from public.interview_availability
   where company_id = p_company and user_id = p_user;

  return jsonb_build_object(
    'timezone', v_host.timezone,
    'durMin', v_host.duration_minutes,
    'bufferMin', v_host.buffer_minutes,
    'minNoticeHoras', v_host.min_notice_hours,
    'horizonteDias', v_host.horizon_days,
    'maxPorDia', v_host.max_per_day,
    'granularidadMin', v_host.granularity_min,
    'defaultMode', v_host.default_mode,
    'defaultLocation', v_host.default_location,
    'defaultLat', v_host.default_place_lat,
    'defaultLng', v_host.default_place_lng,
    'defaultPlaceUrl', v_host.default_place_url,
    'reglas', v_reglas);
end
$$;
revoke all on function public.interview_host_config(uuid, uuid) from public, anon;
grant execute on function public.interview_host_config(uuid, uuid) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 7) El contexto del agente ve el punto
-- ----------------------------------------------------------------------------
-- Igual que la de 20260802100000 más `place_lat`/`place_lng`.
create or replace function public.conversation_context(p_conversation uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v jsonb;
begin
  select jsonb_build_object(
           'conversation_id', c.id,
           'company_id',      c.company_id,
           'campaign_id',     c.campaign_id,
           'candidate_id',    c.candidate_id,
           'interview_id',    c.interview_id,
           'wa_id',           c.wa_id,
           'phone_number_id', s.phone_number_id,
           'handover',        c.handover,
           'agent_state',     c.agent_state,
           'agent_epoch',     c.agent_epoch,
           'opted_out',       c.opted_out,
           'ventana_abierta', coalesce(c.window_expires_at > now(), false),
           'nudges_sent',     c.nudges_sent,
           'candidato',       coalesce(
                                nullif(split_part(btrim(ca.answers ->> 'nombre'), ' ', 1), ''),
                                'Hola'),
           'candidato_nombre', nullif(split_part(btrim(ca.answers ->> 'nombre'), ' ', 1), ''),
           'puesto',          cp.title,
           'ubicacion',       coalesce(cp.location, ''),
           'anfitrion',       nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
           'empresa',         co.name,
           'interview_status', i.status,
           'offered_slots',   coalesce(i.offered_slots, '[]'::jsonb),
           'offer_round',     coalesce(i.offer_round, 0),
           'starts_at',       i.starts_at,
           'timezone',        coalesce(i.timezone, 'Europe/Madrid'),
           'mode',            i.mode,
           'location',        i.location_text,
           'place_lat',       i.place_lat,
           'place_lng',       i.place_lng,
           'meeting_url',     i.meeting_url,
           'host_user_id',    i.host_user_id,
           'duration',        coalesce(i.duration_minutes, 30),
           'buffer',          coalesce(i.buffer_minutes, 15),
           'campaign_status', cp.status)
    into v
    from public.candidate_conversations c
    join public.candidates ca on ca.id = c.candidate_id
    join public.campaigns cp  on cp.id = c.campaign_id
    join public.companies co  on co.id = c.company_id
    left join public.whatsapp_senders s on s.id = c.sender_id
    left join public.interviews i on i.id = c.interview_id
    left join auth.users u on u.id = i.host_user_id
   where c.id = p_conversation;
  return v;
end
$$;
revoke all on function public.conversation_context(uuid) from public, anon, authenticated;
grant execute on function public.conversation_context(uuid) to service_role;
