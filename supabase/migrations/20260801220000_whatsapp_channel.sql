-- ============================================================================
-- Apúntate Fácil: el canal de WhatsApp
-- ----------------------------------------------------------------------------
-- Aquí vive lo que tiene que ser TRANSACCIONAL del canal: que un mensaje
-- entrante no se procese dos veces, que dos candidatos no se lleven el mismo
-- hueco, y que una baja sea una baja de verdad. El envío en sí (hablar con
-- Meta) vive en la edge function, porque es lo único que no puede ser atómico.
--
-- Regla de reparto, por si mañana hay dudas: si de que algo pase dos veces sale
-- un mensaje de más, un hueco doble o un candidato perdido, se decide AQUÍ, con
-- un lock o un índice único. Si solo sale una llamada HTTP repetida, puede
-- decidirse fuera.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Bajas
-- ----------------------------------------------------------------------------
-- Global y por número, no por empresa. Quien pide que no le escribamos no está
-- pidiendo que no le escriba una empresa concreta: nos lo está pidiendo a
-- nosotros, que somos los que aparecemos en su móvil. Esto no es una
-- funcionalidad, es cumplimiento.

create table public.whatsapp_opt_outs (
  wa_id      text primary key check (wa_id ~ '^[0-9]{8,15}$'),
  motivo     text not null default 'peticion' check (motivo in ('peticion', 'bloqueo', 'manual')),
  created_at timestamptz not null default now()
);
alter table public.whatsapp_opt_outs enable row level security;
revoke all on public.whatsapp_opt_outs from anon, authenticated, public;
grant select, insert on public.whatsapp_opt_outs to service_role;

-- Palabras de baja. Coincidencia LITERAL sobre el mensaje entero normalizado, y
-- comprobada antes que ninguna otra cosa: nunca detrás de un clasificador, que
-- puede fallar, y nunca por subcadena, que convertiría "no me para de sonar" en
-- una baja.
create or replace function public.es_peticion_de_baja(p_texto text)
returns boolean
language sql
immutable
as $$
  select lower(btrim(coalesce(p_texto, ''))) = any (array[
    'baja', 'stop', 'parar', 'para', 'darme de baja', 'date de baja',
    'no escribir', 'no me escribas', 'no me escribáis', 'no me escribais',
    'dejadme en paz', 'unsubscribe', 'cancelar suscripcion', 'cancelar suscripción'
  ])
$$;

-- ----------------------------------------------------------------------------
-- 1 bis) Del teléfono que tecleó una persona al identificador de WhatsApp
-- ----------------------------------------------------------------------------
-- Va en SQL y no en la edge function porque es aquí donde se ESCRIBE el wa_id,
-- y una guarda que se puede saltar llamando a otra ruta no es una guarda.
--
-- Y no es cosmética. El teléfono llega tal cual lo escribió alguien con prisa:
-- con espacios, con guiones, con el prefijo de tres formas distintas, o con el
-- número de su primo detrás. Equivocarse aquí no es un error de la app, es
-- escribirle por WhatsApp a una persona que no tiene nada que ver.
--
-- Por eso, ante la duda, DEVUELVE NULL. Un candidato al que hay que llamar a
-- mano es un incordio; un mensaje a un desconocido es otra cosa.

create or replace function public.wa_id_de(p_bruto text)
returns text
language plpgsql
immutable
as $$
declare
  v_trozos text[];
  v_norm   text[] := '{}';
  v_uno    text;
  v_d      text;
  v_intl   boolean;
begin
  if p_bruto is null or btrim(p_bruto) = '' then return null; end if;

  -- Dos números distintos en la misma casilla es ambiguo, y adivinar es
  -- justo lo que no se puede hacer. Se detectan ANTES de limpiar: limpiar los
  -- pegaría en uno solo, y de ahí saldría un número que no existe.
  v_trozos := array(
    select (regexp_matches(p_bruto, '(\+?\d[\d \-().]{6,}\d)', 'g'))[1]
  );
  if array_length(v_trozos, 1) is null then v_trozos := array[p_bruto]; end if;

  foreach v_uno in array v_trozos loop
    v_intl := v_uno ~ '^\s*\+';
    v_d := regexp_replace(v_uno, '\D', '', 'g');
    if v_d like '00%' then
      v_d := substr(v_d, 3);
      v_intl := true;
    end if;

    v_norm := v_norm || case
      -- Nueve dígitos empezando por 6, 7, 8 o 9: español sin prefijo. Sin
      -- ambigüedad posible, porque en España ningún número empieza por 3.
      when length(v_d) = 9 and v_d ~ '^[6789]' then '34' || v_d
      -- Once empezando por 34 y con forma española detrás: ya lo trae puesto.
      when length(v_d) = 11 and v_d like '34%' and substr(v_d, 3) ~ '^[6789]' then v_d
      -- Dice ser español pero no lo parece. De España sí sabemos cómo son los
      -- números: un +34 con ocho dígitos es una errata, y mandarlo es
      -- escribirle a otro.
      when v_d like '34%' then null
      -- Con '+' o con '00': internacional de un país que no conocemos. Se
      -- acepta con una longitud plausible y que Meta diga si existe. Mejor eso
      -- que rechazar a un portugués o a un rumano, que en este sector son
      -- muchos.
      when v_intl and length(v_d) between 8 and 15 then v_d
      else null
    end;
  end loop;

  -- Uno solo y reconocible, o varios que dicen lo mismo.
  select array_agg(distinct x) into v_trozos from unnest(v_norm) x where x is not null;
  if array_length(v_trozos, 1) is distinct from 1 then return null; end if;
  return v_trozos[1];
end
$$;

comment on function public.wa_id_de(text) is
  'Teléfono tecleado -> wa_id. Null si hay cualquier duda: mandar a quien no toca es peor que no mandar.';

-- ----------------------------------------------------------------------------
-- 2) El número desde el que escribimos
-- ----------------------------------------------------------------------------
-- La fila la crea el despliegue, no una migración: el phone_number_id sale de
-- la consola de Meta y no puede quedar escrito en el repositorio.

create or replace function public.upsert_whatsapp_sender(
  p_phone_number_id text,
  p_waba_id         text default '',
  p_display_phone   text default '',
  p_company         uuid default null   -- null = número compartido de Apúntate Fácil
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  insert into public.whatsapp_senders (company_id, phone_number_id, waba_id, display_phone, active)
  values (p_company, p_phone_number_id, p_waba_id, p_display_phone, true)
  on conflict (phone_number_id) do update
     set waba_id = excluded.waba_id,
         display_phone = excluded.display_phone,
         active = true
  returning id into v_id;
  return v_id;
end
$$;
revoke all on function public.upsert_whatsapp_sender(text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.upsert_whatsapp_sender(text, text, text, uuid) to service_role;

-- ----------------------------------------------------------------------------
-- 3) Todo lo que la función necesita para mandar un mensaje
-- ----------------------------------------------------------------------------

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
           -- La ventana la calcula la BASE, no el cliente: dos relojes distintos
           -- deciden distinto, y aquí decidir mal significa mandar texto libre
           -- fuera de plazo y que Meta lo rechace.
           'ventana_abierta', coalesce(c.window_expires_at > now(), false),
           'nudges_sent',     c.nudges_sent,
           'candidato',       coalesce(nullif(btrim(ca.answers ->> 'nombre'), ''), 'Hola'),
           'puesto',          cp.title,
           'empresa',         co.name,
           'interview_status', i.status,
           'offered_slots',   coalesce(i.offered_slots, '[]'::jsonb),
           'offer_round',     coalesce(i.offer_round, 0),
           'starts_at',       i.starts_at,
           'timezone',        coalesce(i.timezone, 'Europe/Madrid'),
           'mode',            i.mode,
           'location',        i.location_text,
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
   where c.id = p_conversation;
  return v;
end
$$;
revoke all on function public.conversation_context(uuid) from public, anon, authenticated;
grant execute on function public.conversation_context(uuid) to service_role;

-- ----------------------------------------------------------------------------
-- 4) Registrar lo que sale
-- ----------------------------------------------------------------------------

create or replace function public.record_outbound_message(
  p_conversation uuid,
  p_author       text,
  p_body         text,
  p_provider_id  text    default null,
  p_template     text    default null,
  p_payload      jsonb   default '{}'::jsonb,
  p_delivery     text    default 'enviado',
  p_error_code   int     default null,
  p_error_text   text    default null,
  p_author_user  uuid    default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_conv public.candidate_conversations; v_id uuid;
begin
  select * into v_conv from public.candidate_conversations where id = p_conversation;
  if not found then return null; end if;

  insert into public.candidate_messages
    (conversation_id, company_id, candidate_id, direction, author, author_user_id,
     body, payload, template_name, provider_message_id, delivery_status, error_code, error_text)
  values
    (p_conversation, v_conv.company_id, v_conv.candidate_id, 'saliente', p_author, p_author_user,
     left(coalesce(p_body, ''), 4000), coalesce(p_payload, '{}'::jsonb), p_template,
     p_provider_id, p_delivery, p_error_code, left(p_error_text, 500))
  returning id into v_id;

  update public.candidate_conversations set last_outbound_at = now() where id = p_conversation;
  return v_id;
end
$$;
revoke all on function public.record_outbound_message(uuid, text, text, text, text, jsonb, text, int, text, uuid)
  from public, anon, authenticated;
grant execute on function public.record_outbound_message(uuid, text, text, text, text, jsonb, text, int, text, uuid)
  to service_role;

-- Estados de entrega. La clave es el PAR (mensaje, estado): Meta reentrega los
-- mismos estados, y deduplicar solo por mensaje perdería el paso de "entregado"
-- a "leído".
create or replace function public.update_delivery_status(
  p_provider_id text,
  p_estado      text,
  p_codigo      int  default null,
  p_detalle     text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_actual text; v_orden constant text[] := array['pendiente','enviado','entregado','leido'];
begin
  select delivery_status into v_actual
    from public.candidate_messages where provider_message_id = p_provider_id;
  if not found then return false; end if;

  -- 'fallido' manda siempre. En lo demás no se retrocede: los estados llegan
  -- desordenados y "entregado" después de "leído" no significa que se
  -- desleyera.
  if p_estado <> 'fallido'
     and array_position(v_orden, p_estado) <= array_position(v_orden, v_actual) then
    return false;
  end if;

  update public.candidate_messages
     set delivery_status = p_estado,
         error_code = coalesce(p_codigo, error_code),
         error_text = coalesce(left(p_detalle, 500), error_text)
   where provider_message_id = p_provider_id;
  return true;
end
$$;
revoke all on function public.update_delivery_status(text, text, int, text) from public, anon, authenticated;
grant execute on function public.update_delivery_status(text, text, int, text) to service_role;

-- ----------------------------------------------------------------------------
-- 5) Lo que entra
-- ----------------------------------------------------------------------------
-- El corazón del canal. Cuatro cosas en una sola transacción, y en este orden:
--
--   1. La INSERCIÓN del mensaje ES el reclamo de deduplicado. No hay un paso
--      previo de "¿ya lo vi?": eso deja la ventana de quedar deduplicado sin
--      llegar a procesarse nunca, que es un candidato mudo para siempre.
--   2. `for update` sobre la conversación. Meta no garantiza el orden de los
--      entrantes, así que dos mensajes seguidos del mismo candidato se
--      serializan aquí y cada uno relee el estado ya actualizado.
--   3. La baja se comprueba antes que nada.
--   4. La ventana de 24 h se abre con la hora del mensaje, no con la nuestra.

create or replace function public.process_whatsapp_inbound(
  p_phone_number_id text,
  p_wa_id           text,
  p_provider_id     text,
  p_tipo            text,          -- 'texto' | 'opcion' | 'no_soportado'
  p_texto           text default null,
  p_opcion_id       text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender public.whatsapp_senders;
  v_conv   public.candidate_conversations;
  v_slot   int;
begin
  select * into v_sender from public.whatsapp_senders
   where phone_number_id = p_phone_number_id and active;
  if not found then return jsonb_build_object('status', 'sender_desconocido'); end if;

  select * into v_conv from public.candidate_conversations
   where sender_id = v_sender.id and wa_id = p_wa_id and agent_state <> 'cerrada'
   order by created_at desc
   limit 1
   for update;
  -- Alguien que escribe por su cuenta sin conversación abierta. No se contesta
  -- (sería escribir a alguien que no esperaba nada) y no es un error.
  if not found then return jsonb_build_object('status', 'sin_conversacion'); end if;

  begin
    insert into public.candidate_messages
      (conversation_id, company_id, candidate_id, direction, author, body, provider_message_id,
       delivery_status, payload)
    values
      (v_conv.id, v_conv.company_id, v_conv.candidate_id, 'entrante', 'candidato',
       left(coalesce(p_texto, ''), 4000), p_provider_id, 'recibido',
       jsonb_build_object('tipo', p_tipo, 'opcion_id', p_opcion_id));
  exception when unique_violation then
    -- Meta reentrega. Ya estaba procesado, y por el orden de arriba estaba
    -- procesado DE VERDAD, no solo apuntado.
    return jsonb_build_object('status', 'duplicado');
  end;

  -- La ventana la abre el candidato al escribir, y dura 24 h desde su mensaje.
  update public.candidate_conversations
     set last_inbound_at = now(), window_expires_at = now() + interval '24 hours'
   where id = v_conv.id;

  -- (3) La baja, antes que cualquier interpretación.
  if p_tipo = 'texto' and public.es_peticion_de_baja(p_texto) then
    insert into public.whatsapp_opt_outs (wa_id, motivo) values (p_wa_id, 'peticion')
      on conflict (wa_id) do nothing;
    update public.candidate_conversations
       set opted_out = true, agent_state = 'cerrada'
     where id = v_conv.id;
    -- Y sin conversación viva, la entrevista deja de estar en marcha.
    update public.interviews set status = 'rechazada'
     where id = v_conv.interview_id
       and status in ('invitada', 'proponiendo');
    return jsonb_build_object('status', 'baja', 'conversation_id', v_conv.id);
  end if;

  -- Con una persona al mando el agente no contesta: solo se guarda y se avisa.
  if v_conv.handover = 'persona' then
    return jsonb_build_object('status', 'humano', 'conversation_id', v_conv.id);
  end if;

  -- Nada de audios, fotos ni documentos. Fingir que se ha entendido un audio es
  -- peor que decir claramente que lo mire una persona.
  if p_tipo = 'no_soportado' then
    perform public.escalar_conversacion(v_conv.id,
      'Te ha mandado algo que no sabemos leer (un audio, una foto o un archivo). Sigue tú.');
    return jsonb_build_object('status', 'intervencion', 'conversation_id', v_conv.id);
  end if;

  if p_tipo = 'opcion' then
    -- Los identificadores los ponemos nosotros y llevan la conversación dentro,
    -- así que aquí no hay que adivinar a qué contestaba.
    if p_opcion_id like 'c:' || v_conv.id::text || ':s:%' then
      v_slot := nullif(regexp_replace(p_opcion_id, '^.*:s:', ''), '')::int;
      return public.book_interview_slot(v_conv.id, v_slot, v_conv.agent_epoch);
    end if;

    if p_opcion_id like 'c:' || v_conv.id::text || ':ver%' then
      perform public.enqueue_interview_job('enviar_horarios', '{}'::jsonb, now(),
        'horarios:' || v_conv.id::text || ':' || v_conv.agent_epoch::text,
        v_conv.company_id, v_conv.interview_id, v_conv.id, v_conv.agent_epoch);
      update public.candidate_conversations set agent_state = 'proponiendo_horarios' where id = v_conv.id;
      return jsonb_build_object('status', 'ofrecer_horarios', 'conversation_id', v_conv.id);
    end if;

    if p_opcion_id like 'c:' || v_conv.id::text || ':no%' then
      update public.candidate_conversations set agent_state = 'cerrada' where id = v_conv.id;
      update public.interviews set status = 'rechazada'
       where id = v_conv.interview_id and status in ('invitada', 'proponiendo');
      perform public.enqueue_interview_job('enviar_despedida', '{}'::jsonb, now(),
        'fin:' || v_conv.id::text, v_conv.company_id, v_conv.interview_id, v_conv.id, v_conv.agent_epoch);
      return jsonb_build_object('status', 'rechazada', 'conversation_id', v_conv.id);
    end if;

    if p_opcion_id like 'c:' || v_conv.id::text || ':pregunta%' then
      perform public.escalar_conversacion(v_conv.id,
        'Tiene una pregunta sobre el puesto. Respóndele tú: nosotros no inventamos condiciones.');
      return jsonb_build_object('status', 'intervencion', 'conversation_id', v_conv.id);
    end if;

    -- Una opción de otra conversación o de una ronda vieja. Ni se ignora en
    -- silencio ni se adivina.
    perform public.escalar_conversacion(v_conv.id,
      'Ha contestado a un mensaje que ya no está vigente. Míralo tú.');
    return jsonb_build_object('status', 'intervencion', 'conversation_id', v_conv.id);
  end if;

  -- Texto libre. Hasta que exista el clasificador (y también después, cuando no
  -- esté seguro), esto va a una persona. Es la promesa entera del producto: el
  -- agente no se inventa nada porque no genera nada.
  perform public.escalar_conversacion(v_conv.id,
    'Te ha escrito algo que no es una de las opciones. Sigue tú desde aquí.');
  return jsonb_build_object('status', 'intervencion', 'conversation_id', v_conv.id);
end
$$;
revoke all on function public.process_whatsapp_inbound(text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.process_whatsapp_inbound(text, text, text, text, text, text) to service_role;

-- ----------------------------------------------------------------------------
-- 6) Guardar la oferta y reservar el hueco
-- ----------------------------------------------------------------------------

create or replace function public.set_offered_slots(p_interview uuid, p_slots jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v public.interviews;
begin
  select * into v from public.interviews where id = p_interview for update;
  if not found then return jsonb_build_object('status', 'no_existe'); end if;
  if v.status not in ('invitada', 'proponiendo') then
    return jsonb_build_object('status', 'no_procede', 'estado', v.status);
  end if;

  update public.interviews
     set offered_slots = p_slots,
         -- La ronda sube con cada oferta. Es lo que invalida la anterior: si el
         -- candidato pulsa un horario de la ronda vieja (le llegó tarde, o
         -- subió a mirar), se sabe y no se reserva a ciegas.
         offer_round = least(10, v.offer_round + 1),
         status = 'proponiendo'
   where id = p_interview;
  return jsonb_build_object('status', 'ok', 'ronda', least(10, v.offer_round + 1));
end
$$;
revoke all on function public.set_offered_slots(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.set_offered_slots(uuid, jsonb) to service_role;

-- Reserva. Aquí es donde dos candidatos pueden pelearse por el mismo hueco, y
-- lo arbitra Postgres con la constraint de exclusión, no la aplicación: no hay
-- reservas temporales, ni caducidades, ni un trabajo que las limpie.
create or replace function public.book_interview_slot(
  p_conversation uuid,
  p_slot         int,
  p_epoch        bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conv public.candidate_conversations;
  v_int  public.interviews;
  v_slot jsonb;
  v_ini  timestamptz;
  v_fin  timestamptz;
begin
  select * into v_conv from public.candidate_conversations where id = p_conversation for update;
  if not found then return jsonb_build_object('status', 'no_existe'); end if;
  -- Vallado: si el epoch no cuadra, una persona tomó el control mientras esto
  -- viajaba. No se reserva nada en su nombre.
  if v_conv.agent_epoch <> p_epoch then return jsonb_build_object('status', 'obsoleto'); end if;

  select * into v_int from public.interviews where id = v_conv.interview_id for update;
  if not found then return jsonb_build_object('status', 'sin_entrevista'); end if;
  if v_int.status = 'confirmada' then
    -- Doble pulsación del candidato. No es un error: ya tiene su hora.
    return jsonb_build_object('status', 'ya_confirmada', 'starts_at', v_int.starts_at);
  end if;
  if v_int.status not in ('invitada', 'proponiendo') then
    return jsonb_build_object('status', 'no_procede', 'estado', v_int.status);
  end if;

  v_slot := v_int.offered_slots -> p_slot;
  if v_slot is null then return jsonb_build_object('status', 'hueco_desconocido'); end if;

  v_ini := (v_slot ->> 'starts_at')::timestamptz;
  v_fin := (v_slot ->> 'ends_at')::timestamptz;
  -- Un hueco que ya pasó mientras el candidato se lo pensaba.
  if v_ini <= now() then
    return jsonb_build_object('status', 'caducado');
  end if;

  begin
    update public.interviews
       set status = 'confirmada', starts_at = v_ini, ends_at = v_fin,
           confirmed_at = now(), origin = 'whatsapp',
           calendar_sync_state = case when calendar_provider is null then 'ninguno' else 'pendiente' end
     where id = v_int.id;
  exception when exclusion_violation then
    -- Otro candidato llegó antes. Se sube la ronda para invalidar la oferta
    -- vieja y se vuelve a ofrecer al instante: es exactamente para esto que la
    -- re-oferta existe, y por lo que no hacen falta reservas temporales.
    update public.interviews set offer_round = least(10, v_int.offer_round + 1) where id = v_int.id;
    perform public.enqueue_interview_job('reofertar_horarios', '{}'::jsonb, now(),
      'reoferta:' || v_conv.id::text || ':' || (v_int.offer_round + 1)::text,
      v_conv.company_id, v_int.id, v_conv.id, v_conv.agent_epoch);
    return jsonb_build_object('status', 'ocupado');
  end;

  update public.candidate_conversations
     set agent_state = 'entrevista_confirmada' where id = p_conversation;

  perform public.enqueue_interview_job('enviar_confirmacion', '{}'::jsonb, now(),
    'confirma:' || v_int.id::text, v_conv.company_id, v_int.id, v_conv.id, v_conv.agent_epoch);

  return jsonb_build_object('status', 'ok', 'starts_at', v_ini, 'interview_id', v_int.id);
end
$$;
revoke all on function public.book_interview_slot(uuid, int, bigint) from public, anon, authenticated;
grant execute on function public.book_interview_slot(uuid, int, bigint) to service_role;

-- ----------------------------------------------------------------------------
-- 7) Los tipos de trabajo del canal
-- ----------------------------------------------------------------------------

alter table public.interview_jobs drop constraint interview_jobs_kind_check;
alter table public.interview_jobs add constraint interview_jobs_kind_check check (kind in (
  'recordatorio_24h', 'recordatorio_2h', 'marcar_realizada', 'avisar_intervencion',
  'enviar_invitacion',    -- plantilla con botones: el primer contacto
  'enviar_horarios',      -- lista interactiva con los huecos
  'reofertar_horarios',   -- su hueco lo cogió otro
  'enviar_confirmacion',  -- fecha, hora, sitio
  'enviar_despedida',     -- dijo que no: se cierra con educación
  'enviar_texto'          -- lo que escribe una persona desde el panel
));

-- Arrancar la conversación: lo llama la RPC de invitar. Va aquí y no en la
-- migración de conversaciones porque hasta ahora no existía la cola.
create or replace function public.kickoff_invitation(p_conversation uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_conv public.candidate_conversations;
begin
  select * into v_conv from public.candidate_conversations where id = p_conversation for update;
  if not found then return jsonb_build_object('status', 'no_existe'); end if;

  -- Un número dado de baja no recibe nada de nadie, nunca.
  if exists (select 1 from public.whatsapp_opt_outs where wa_id = v_conv.wa_id) then
    update public.candidate_conversations set opted_out = true, agent_state = 'cerrada'
     where id = p_conversation;
    update public.interviews set status = 'fallida' where id = v_conv.interview_id
       and status in ('invitada', 'proponiendo');
    return jsonb_build_object('status', 'baja');
  end if;

  update public.candidate_conversations set agent_state = 'contactando' where id = p_conversation;
  perform public.enqueue_interview_job('enviar_invitacion', '{}'::jsonb, now(),
    'invita:' || p_conversation::text, v_conv.company_id, v_conv.interview_id,
    p_conversation, v_conv.agent_epoch);
  perform public.interview_tick_kick();
  return jsonb_build_object('status', 'ok');
end
$$;
revoke all on function public.kickoff_invitation(uuid) from public, anon, authenticated;
grant execute on function public.kickoff_invitation(uuid) to authenticated, service_role;

-- Que el candidato no se quede colgado si no contesta. Dos avisos y se cierra
-- diciendo por qué, en vez de dejarlo en 'invitada' para siempre.
create or replace function public.interview_nudge(p_conversation uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_conv public.candidate_conversations;
begin
  select * into v_conv from public.candidate_conversations where id = p_conversation for update;
  if not found or v_conv.agent_state = 'cerrada' or v_conv.handover = 'persona' then
    return jsonb_build_object('status', 'no_procede');
  end if;
  if v_conv.nudges_sent >= 2 then
    update public.candidate_conversations set agent_state = 'cerrada' where id = p_conversation;
    update public.interviews set status = 'sin_respuesta'
     where id = v_conv.interview_id and status in ('invitada', 'proponiendo');
    return jsonb_build_object('status', 'agotado');
  end if;
  update public.candidate_conversations set nudges_sent = nudges_sent + 1 where id = p_conversation;
  return jsonb_build_object('status', 'ok', 'aviso', v_conv.nudges_sent + 1);
end
$$;
revoke all on function public.interview_nudge(uuid) from public, anon, authenticated;
grant execute on function public.interview_nudge(uuid) to service_role;

-- El generador de huecos corre en el servidor y da de alta al anfitrión con su
-- horario por defecto la primera vez. En este backend nadie hereda permisos:
-- sin este grant, el agente falla con 42501 y en silencio.
grant execute on function public.ensure_interview_host(uuid, uuid) to service_role;

-- ----------------------------------------------------------------------------
-- 8) La invitación, ahora con el teléfono bien normalizado
-- ----------------------------------------------------------------------------
-- Cambia UNA cosa respecto de la versión de 20260801140000: el wa_id sale de
-- `wa_id_de` en vez de "quita lo que no sea dígito". Aquella versión daba por
-- bueno un 612345678 pelado (que no es un identificador válido) y, peor,
-- convertía "612345678 / 645112233" en un número de 18 dígitos inventado.
-- Ahora, si no hay un teléfono reconocible, no se crea nada y se dice.

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
begin
  select * into v_ctx from public.interview_candidate_context(p_candidate);
  if not found then raise exception 'No autorizado' using errcode = '42501'; end if;
  if not v_ctx.plan_ok then return jsonb_build_object('status', 'plan'); end if;
  if v_ctx.campaign_status <> 'activa' then return jsonb_build_object('status', 'puesto_inactivo'); end if;

  if not exists (
    select 1 from public.memberships m
     where m.user_id = v_host and m.company_id = v_ctx.company_id
  ) then raise exception 'El anfitrión no es del equipo' using errcode = '42501'; end if;

  -- Sin un teléfono reconocible no hay WhatsApp que valga. Se dice antes de
  -- crear nada, para que la ficha pueda ofrecer "apúntalo a mano" en su lugar.
  select public.wa_id_de(c.answers ->> 'telefono') into v_wa
    from public.candidates c where c.id = p_candidate;
  if v_wa is null then return jsonb_build_object('status', 'sin_telefono'); end if;

  -- Un número dado de baja no recibe nada, de nadie, nunca.
  if exists (select 1 from public.whatsapp_opt_outs o where o.wa_id = v_wa) then
    return jsonb_build_object('status', 'baja');
  end if;

  select id into v_sender from public.whatsapp_senders
   where active and company_id is not distinct from v_ctx.company_id
   order by company_id nulls last limit 1;
  if v_sender is null then
    select id into v_sender from public.whatsapp_senders where active and company_id is null limit 1;
  end if;

  begin
    insert into public.interviews (
      company_id, campaign_id, candidate_id, host_user_id, created_by,
      status, origin, duration_minutes, buffer_minutes, timezone,
      mode, location_text, meeting_url)
    values (
      v_ctx.company_id, v_ctx.campaign_id, p_candidate, v_host, auth.uid(),
      'invitada', 'whatsapp', p_duration, p_buffer, v_ctx.tz,
      p_mode, coalesce(p_location, ''), p_meeting_url)
    returning * into v_interview;
  exception when unique_violation then
    select * into v_interview from public.interviews
     where candidate_id = p_candidate
       and status in ('invitada', 'proponiendo', 'confirmada', 'reprogramando');
    select * into v_conv from public.candidate_conversations
     where candidate_id = p_candidate and agent_state <> 'cerrada';
    -- La segunda pulsación devuelve lo que ya hay. Ni error ni duplicado.
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
