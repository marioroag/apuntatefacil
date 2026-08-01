-- ============================================================================
-- Apúntate Fácil: que el agente CONVERSE, y que no salga ni un correo
-- ----------------------------------------------------------------------------
-- Dos decisiones de Mario, del mismo día:
--
--   1. El candidato tiene que sentir que habla con alguien. Hasta ahora, todo
--      lo que no fuera pulsar un botón recibía la misma frase enlatada, y varias
--      cosas (una duda, un audio) directamente paraban la conversación y
--      llamaban a una persona. Se acabó: contesta la IA, y contesta siempre.
--
--   2. Ni un solo correo al empresario durante este proceso. Lo que pasa en la
--      conversación se ve en la conversación.
--
-- Lo que esta migración cambia en la base:
--   * `conversation_transcript`: el hilo, para que el agente lea la
--     conversación entera y no un mensaje suelto (es lo que evita que repita).
--   * El botón "tengo una duda" y los audios dejan de escalar: ahora contestan.
--   * `escalar_conversacion` deja de encolar el correo de aviso.
--   * Los recordatorios dejan de ser un email al anfitrión y pasan a ser un
--     WhatsApp al candidato, que es quien de verdad se puede olvidar.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) El hilo, para que el agente lo lea
-- ----------------------------------------------------------------------------
-- Lo que se le da al modelo NO es la tabla en crudo:
--   * Los mensajes de autor 'sistema' se quedan fuera. Son notas internas para
--     el empresario ("esto lo tienes que mirar tú"); el candidato no las ha
--     visto nunca y colarlas aquí sería inventarle una conversación.
--   * Lo que falló al enviarse también se queda fuera, por lo mismo: si no le
--     llegó, para él no se dijo.
create or replace function public.conversation_transcript(
  p_conversation uuid,
  p_limit        int  default 12,
  p_excluir      text default null   -- provider_message_id que ya se pasa aparte
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  -- Se cogen los ÚLTIMOS por fecha descendente y se devuelven ascendentes, que
  -- es el orden en que se lee una conversación. El `id` desempata: sin él, dos
  -- mensajes con la misma marca de tiempo salen en un orden cualquiera, y un
  -- hilo desordenado le hace creer al modelo que contestó antes de que le
  -- preguntaran.
  --
  -- Solo `quien` y `texto`: ni marcas de tiempo ni ids. Lo que no necesita para
  -- responder, no se le manda.
  select coalesce(
           jsonb_agg(jsonb_build_object('quien', t.quien, 'texto', t.texto)
                     order by t.created_at, t.id),
           '[]'::jsonb)
    from (
      select m.created_at, m.id,
             case m.author when 'candidato' then 'candidato'
                           when 'persona'   then 'persona'
                           else 'agente' end as quien,
             left(m.body, 400) as texto
        from public.candidate_messages m
       where m.conversation_id = p_conversation
         and m.author <> 'sistema'
         and m.delivery_status <> 'fallido'
         and btrim(coalesce(m.body, '')) <> ''
         and (p_excluir is null or m.provider_message_id is distinct from p_excluir)
       order by m.created_at desc, m.id desc
       limit greatest(1, least(p_limit, 40))
    ) t;
$$;
revoke all on function public.conversation_transcript(uuid, int, text) from public, anon, authenticated;
grant execute on function public.conversation_transcript(uuid, int, text) to service_role;

-- ----------------------------------------------------------------------------
-- 2) Escalar sin correo
-- ----------------------------------------------------------------------------
-- Idéntica a la de 20260801200000 menos la última línea: ya no se encola
-- 'avisar_intervencion'. La conversación queda marcada, sale en la pestaña con
-- su motivo y el candidato deja de recibir mensajes automáticos. Eso es el
-- aviso. Un correo por cada duda de cada candidato convierte el producto en una
-- fuente de ruido, que es justo lo que Mario no quiere.
create or replace function public.escalar_conversacion(p_conversation uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_conv public.candidate_conversations;
begin
  select * into v_conv from public.candidate_conversations where id = p_conversation for update;
  if not found or v_conv.agent_state = 'cerrada' then return; end if;

  update public.candidate_conversations
     set handover = 'persona',
         agent_state = 'necesita_intervencion',
         attention_reason = left(p_motivo, 200),
         agent_epoch = agent_epoch + 1
   where id = p_conversation;

  insert into public.candidate_messages
    (conversation_id, company_id, candidate_id, direction, author, body)
  values
    (p_conversation, v_conv.company_id, v_conv.candidate_id, 'saliente', 'sistema',
     left(p_motivo, 4000));
end
$$;

-- Los que estuvieran en cola no se mandan.
update public.interview_jobs
   set status = 'cancelado', locked_until = null,
       last_error = 'Los avisos por correo se retiraron', updated_at = now()
 where kind = 'avisar_intervencion' and status = 'pendiente';

-- ----------------------------------------------------------------------------
-- 3) Los trabajos nuevos
-- ----------------------------------------------------------------------------
alter table public.interview_jobs drop constraint interview_jobs_kind_check;
alter table public.interview_jobs add constraint interview_jobs_kind_check check (kind in (
  -- 'recordatorio_24h' y 'recordatorio_2h' siguen existiendo pero cambian de
  -- destinatario: ahora son un WhatsApp al candidato, no un correo al
  -- anfitrión. 'avisar_intervencion' se queda solo por las filas históricas.
  'recordatorio_24h', 'recordatorio_2h', 'marcar_realizada', 'avisar_intervencion',
  'enviar_invitacion', 'enviar_horarios', 'reofertar_horarios',
  'enviar_confirmacion', 'enviar_despedida', 'enviar_texto',
  'clasificar_texto',    -- el nombre viejo, por los que quedaran en vuelo
  'conversar',           -- lee el hilo, contesta y decide
  'responder_duda',      -- ha pulsado "tengo una duda" y hay que abrirle la puerta
  'mensaje_no_leible'    -- audio, foto o documento: se le pide por escrito
));

-- ----------------------------------------------------------------------------
-- 4) Los recordatorios, al candidato y por WhatsApp
-- ----------------------------------------------------------------------------
-- Antes eran un correo al anfitrión. Ahora van al candidato, que es quien de
-- verdad se puede olvidar de una entrevista a la que se apuntó hace una semana,
-- y por el canal donde ya está hablando con nosotros. El empresario la tiene en
-- su agenda de la app.
--
-- Solo el de 2 h. Dos recordatorios por WhatsApp para una misma cita se leen
-- como insistencia, y el de la víspera es el que menos falta hace cuando el de
-- un rato antes ya existe.
create or replace function public.interviews_sync_jobs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kinds constant text[] := array['recordatorio_24h', 'recordatorio_2h', 'marcar_realizada'];
  v_conv  uuid;
begin
  perform public.cancel_interview_jobs(new.id, v_kinds);

  if new.status <> 'confirmada' or new.starts_at is null then return new; end if;

  select id into v_conv from public.candidate_conversations
   where interview_id = new.id and agent_state <> 'cerrada' and not opted_out;

  -- Sin conversación viva no hay a dónde mandarlo, y no se inventa otro canal.
  if v_conv is not null and new.starts_at - interval '2 hours' > now() + interval '5 minutes' then
    perform public.enqueue_interview_job(
      'recordatorio_2h', '{}'::jsonb, new.starts_at - interval '2 hours',
      'rec2:' || new.id::text, new.company_id, new.id, v_conv, null);
  end if;

  perform public.enqueue_interview_job(
    'marcar_realizada', '{}'::jsonb, new.ends_at + interval '30 minutes',
    'fin:' || new.id::text, new.company_id, new.id, null, null);

  return new;
end
$$;

-- Los recordatorios por correo que quedaran encolados no llegan a salir.
update public.interview_jobs
   set status = 'cancelado', locked_until = null,
       last_error = 'Los recordatorios pasaron a WhatsApp', updated_at = now()
 where kind in ('recordatorio_24h', 'recordatorio_2h')
   and status = 'pendiente' and conversation_id is null;

-- ----------------------------------------------------------------------------
-- 5) La entrada: nada de esto para ya la conversación
-- ----------------------------------------------------------------------------
-- Cambia el final de la función. El principio (deduplicado, bloqueo, baja,
-- ventana) es idéntico a 20260801235000: es lo que la hace correcta.
create or replace function public.process_whatsapp_inbound(
  p_phone_number_id text,
  p_wa_id           text,
  p_provider_id     text,
  p_tipo            text,
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
    return jsonb_build_object('status', 'duplicado');
  end;

  update public.candidate_conversations
     set last_inbound_at = now(), window_expires_at = now() + interval '24 hours'
   where id = v_conv.id;

  -- La baja, antes que cualquier interpretación. Esto sigue siendo terminal y
  -- no lo decide ninguna IA: es un derecho, no una intención a interpretar.
  if p_tipo = 'texto' and public.es_peticion_de_baja(p_texto) then
    insert into public.whatsapp_opt_outs (wa_id, motivo) values (p_wa_id, 'peticion')
      on conflict (wa_id) do nothing;
    update public.candidate_conversations
       set opted_out = true, agent_state = 'cerrada'
     where id = v_conv.id;
    update public.interviews set status = 'rechazada'
     where id = v_conv.interview_id
       and status in ('invitada', 'proponiendo');
    return jsonb_build_object('status', 'baja', 'conversation_id', v_conv.id);
  end if;

  if v_conv.handover = 'persona' then
    return jsonb_build_object('status', 'humano', 'conversation_id', v_conv.id);
  end if;

  -- Audio, foto o documento. Antes esto paraba la conversación. Ahora se le
  -- dice la verdad (no lo sabemos leer) y se le pide por escrito, que es lo que
  -- haría cualquiera. Seguir hablando es responsabilidad nuestra, no suya.
  if p_tipo = 'no_soportado' then
    perform public.enqueue_interview_job('mensaje_no_leible',
      jsonb_build_object('clase', coalesce(p_texto, '')), now(),
      'nolegible:' || p_provider_id,
      v_conv.company_id, v_conv.interview_id, v_conv.id, v_conv.agent_epoch);
    return jsonb_build_object('status', 'no_leible', 'conversation_id', v_conv.id);
  end if;

  if p_tipo = 'opcion' then
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

    -- "Tengo una duda". Antes esto llamaba a una persona ANTES incluso de saber
    -- cuál era la duda, que es lo más absurdo del recorrido viejo: el candidato
    -- se quedaba esperando sin haber llegado a preguntar nada. Ahora se le
    -- invita a preguntar y su pregunta ya entra por el camino de conversación.
    if p_opcion_id like 'c:' || v_conv.id::text || ':pregunta%' then
      perform public.enqueue_interview_job('responder_duda', '{}'::jsonb, now(),
        'duda:' || p_provider_id,
        v_conv.company_id, v_conv.interview_id, v_conv.id, v_conv.agent_epoch);
      return jsonb_build_object('status', 'duda', 'conversation_id', v_conv.id);
    end if;

    -- Una opción de otra conversación o de una ronda vieja: el botón de un
    -- mensaje que ya no vale. Tampoco se para por esto, se conversa.
    perform public.enqueue_interview_job('conversar',
      jsonb_build_object('texto', left(coalesce(p_texto, 'Ha pulsado un botón antiguo'), 1000),
                         'provider_id', p_provider_id),
      now(), 'conversa:' || p_provider_id,
      v_conv.company_id, v_conv.interview_id, v_conv.id, v_conv.agent_epoch);
    return jsonb_build_object('status', 'conversando', 'conversation_id', v_conv.id);
  end if;

  -- --------------------------------------------------------------------------
  -- Texto libre
  -- --------------------------------------------------------------------------
  -- Los atajos literales se quedan: son gratis, instantáneos y no pueden
  -- equivocarse. Solo lo que no cae en ninguna lista cuesta una llamada al
  -- modelo.
  if v_conv.agent_state in ('contactando', 'esperando_respuesta') then
    if public.es_afirmacion(p_texto) then
      perform public.enqueue_interview_job('enviar_horarios', '{}'::jsonb, now(),
        'horarios:' || v_conv.id::text || ':' || v_conv.agent_epoch::text,
        v_conv.company_id, v_conv.interview_id, v_conv.id, v_conv.agent_epoch);
      update public.candidate_conversations set agent_state = 'proponiendo_horarios' where id = v_conv.id;
      return jsonb_build_object('status', 'ofrecer_horarios', 'conversation_id', v_conv.id);
    end if;

    if public.es_negacion(p_texto) then
      update public.candidate_conversations set agent_state = 'cerrada' where id = v_conv.id;
      update public.interviews set status = 'rechazada'
       where id = v_conv.interview_id and status in ('invitada', 'proponiendo');
      perform public.enqueue_interview_job('enviar_despedida', '{}'::jsonb, now(),
        'fin:' || v_conv.id::text, v_conv.company_id, v_conv.interview_id, v_conv.id, v_conv.agent_epoch);
      return jsonb_build_object('status', 'rechazada', 'conversation_id', v_conv.id);
    end if;
  end if;

  -- Y todo lo demás, a conversar. Se encola en vez de resolverse aquí porque
  -- hablar con el modelo es una llamada de red y este bloque tiene la
  -- conversación bloqueada: dejarla esperando a un tercero es como se atasca
  -- una cola.
  perform public.enqueue_interview_job('conversar',
    jsonb_build_object('texto', left(coalesce(p_texto, ''), 1000),
                       'provider_id', p_provider_id),
    now(), 'conversa:' || p_provider_id,
    v_conv.company_id, v_conv.interview_id, v_conv.id, v_conv.agent_epoch);
  return jsonb_build_object('status', 'conversando', 'conversation_id', v_conv.id);
end
$$;
revoke all on function public.process_whatsapp_inbound(text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.process_whatsapp_inbound(text, text, text, text, text, text) to service_role;

-- ----------------------------------------------------------------------------
-- 6) Tres datos más en el contexto, para la ficha del agente
-- ----------------------------------------------------------------------------
-- `candidato_nombre` va aparte de `candidato` a propósito: `candidato` lleva un
-- 'Hola' de reserva cuando no sabemos cómo se llama, que sirve para encabezar
-- una frase pero sería un desastre en la ficha (el agente le llamaría "Hola").
-- Aquí null significa null.
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
           'candidato',       coalesce(nullif(btrim(ca.answers ->> 'nombre'), ''), 'Hola'),
           'candidato_nombre', nullif(btrim(ca.answers ->> 'nombre'), ''),
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
