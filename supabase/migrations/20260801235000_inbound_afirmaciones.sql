-- ============================================================================
-- Apúntate Fácil: entender un "sí" escrito
-- ----------------------------------------------------------------------------
-- Hasta ahora, cualquier texto libre del candidato iba a una persona. Es la
-- postura correcta por defecto (el agente no adivina), pero deja fuera el caso
-- más común de todos: le mandas tres botones y te contesta "si" tecleándolo,
-- porque en WhatsApp la gente escribe.
--
-- La excepción es DELIBERADAMENTE estrecha y sin IA:
--
--   * Coincidencia LITERAL sobre el mensaje entero normalizado, igual que las
--     palabras de baja. Nada de subcadenas: "no me interesa el sitio" no puede
--     leerse como un "no", y "si me dices el sueldo te contesto" no puede
--     leerse como un "sí".
--   * Solo cuando estamos esperando exactamente esa respuesta. Si ya le hemos
--     ofrecido horarios, un texto sigue yendo a una persona: ahí no se trata de
--     entender un sí, sino de adivinar CUÁL hueco, y eso no se adivina.
--
-- Con esto el camino feliz deja de necesitar una persona, que era el objetivo,
-- y sin abrir la puerta a interpretar nada.
-- ============================================================================

create or replace function public.es_afirmacion(p_texto text)
returns boolean
language sql
immutable
as $$
  select btrim(regexp_replace(regexp_replace(lower(coalesce(p_texto, '')), '[.,!¡?¿;:]', ' ', 'g'), '\s+', ' ', 'g')) = any (array[
    'si', 'sí', 'sip', 'claro', 'vale', 'ok', 'okey', 'okay', 'venga',
    'quiero', 'si quiero', 'sí quiero', 'me interesa', 'si me interesa',
    'sí me interesa', 'perfecto', 'de acuerdo', 'adelante', 'por supuesto',
    'ver horarios', 'horarios', 'si por favor', 'sí por favor', 'genial'
  ])
$$;

create or replace function public.es_negacion(p_texto text)
returns boolean
language sql
immutable
as $$
  select btrim(regexp_replace(regexp_replace(lower(coalesce(p_texto, '')), '[.,!¡?¿;:]', ' ', 'g'), '\s+', ' ', 'g')) = any (array[
    'no', 'no gracias', 'no me interesa', 'ya no', 'ya no me interesa',
    'no puedo', 'paso', 'no quiero', 'nop'
  ])
$$;

-- Se sustituye el tramo de texto libre de process_whatsapp_inbound. El resto de
-- la función es idéntico a 20260801220000: el orden (deduplicado, lock, baja,
-- ventana) no cambia, porque es lo que la hace correcta.
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

  -- La baja, antes que cualquier interpretación.
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

  if p_tipo = 'no_soportado' then
    perform public.escalar_conversacion(v_conv.id,
      'Te ha mandado algo que no sabemos leer (un audio, una foto o un archivo). Sigue tú.');
    return jsonb_build_object('status', 'intervencion', 'conversation_id', v_conv.id);
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

    if p_opcion_id like 'c:' || v_conv.id::text || ':pregunta%' then
      perform public.escalar_conversacion(v_conv.id,
        'Tiene una pregunta sobre el puesto. Respóndele tú: nosotros no inventamos condiciones.');
      return jsonb_build_object('status', 'intervencion', 'conversation_id', v_conv.id);
    end if;

    perform public.escalar_conversacion(v_conv.id,
      'Ha contestado a un mensaje que ya no está vigente. Míralo tú.');
    return jsonb_build_object('status', 'intervencion', 'conversation_id', v_conv.id);
  end if;

  -- --------------------------------------------------------------------------
  -- Texto libre
  -- --------------------------------------------------------------------------
  -- Solo mientras esperamos el sí o el no de la invitación. En cualquier otro
  -- estado, un texto sigue yendo a una persona.
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

  -- Lo que no cae en ninguna lista literal pasa al clasificador, que lee la
  -- INTENCIÓN y nada más. Se encola en vez de resolverse aquí porque hablar con
  -- el modelo es una llamada de red, y este bloque tiene la conversación
  -- bloqueada: dejarla esperando a un tercero es como se atasca una cola.
  --
  -- Si no hay clave de IA, o el modelo duda, o contesta cualquier cosa rara, el
  -- trabajo acaba pasándoselo a una persona. Nunca se adivina.
  perform public.enqueue_interview_job('clasificar_texto',
    jsonb_build_object('texto', left(coalesce(p_texto, ''), 1000)), now(),
    'clasifica:' || p_provider_id,
    v_conv.company_id, v_conv.interview_id, v_conv.id, v_conv.agent_epoch);
  return jsonb_build_object('status', 'clasificando', 'conversation_id', v_conv.id);
end
$$;
revoke all on function public.process_whatsapp_inbound(text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.process_whatsapp_inbound(text, text, text, text, text, text) to service_role;

-- El clasificador es un trabajo más de la cola.
alter table public.interview_jobs drop constraint interview_jobs_kind_check;
alter table public.interview_jobs add constraint interview_jobs_kind_check check (kind in (
  'recordatorio_24h', 'recordatorio_2h', 'marcar_realizada', 'avisar_intervencion',
  'enviar_invitacion', 'enviar_horarios', 'reofertar_horarios',
  'enviar_confirmacion', 'enviar_despedida', 'enviar_texto',
  'clasificar_texto'   -- entiende un mensaje que no era ninguna de las opciones
));

-- Cerrar por decisión del candidato, sin pasar por el webhook. Lo usa el
-- clasificador cuando lee un "no" escrito de otra manera.
create or replace function public.conversation_rechazar(p_conversation uuid, p_epoch bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_conv public.candidate_conversations;
begin
  select * into v_conv from public.candidate_conversations where id = p_conversation for update;
  if not found then return jsonb_build_object('status', 'no_existe'); end if;
  if v_conv.agent_epoch <> p_epoch then return jsonb_build_object('status', 'obsoleto'); end if;

  update public.candidate_conversations set agent_state = 'cerrada' where id = p_conversation;
  update public.interviews set status = 'rechazada'
   where id = v_conv.interview_id and status in ('invitada', 'proponiendo');
  perform public.enqueue_interview_job('enviar_despedida', '{}'::jsonb, now(),
    'fin:' || p_conversation::text, v_conv.company_id, v_conv.interview_id,
    p_conversation, v_conv.agent_epoch);
  return jsonb_build_object('status', 'ok');
end
$$;
revoke all on function public.conversation_rechazar(uuid, bigint) from public, anon, authenticated;
grant execute on function public.conversation_rechazar(uuid, bigint) to service_role;
