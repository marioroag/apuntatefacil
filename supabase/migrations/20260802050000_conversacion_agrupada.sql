-- ============================================================================
-- Apúntate Fácil: esperar a que termine de hablar
-- ----------------------------------------------------------------------------
-- En un chat la gente no escribe párrafos, escribe a ráfagas: "hola", "vi el
-- anuncio", "¿sigue disponible?". Con un trabajo por mensaje, eso eran tres
-- llamadas al modelo que NO se ven entre sí y tres respuestas descoordinadas,
-- cada una contestando a un trozo. Lo pidió Mario y tiene razón: es de las
-- cosas que más delatan que al otro lado hay una máquina.
--
-- A partir de aquí, un mensaje suyo NO dispara una respuesta: abre una espera
-- de un minuto. Todo lo que llegue mientras tanto entra en la misma respuesta.
--
--   * La espera se REINICIA con cada mensaje (si sigue escribiendo, seguimos
--     esperando), pero con un tope de 3 minutos desde el primero: quien escribe
--     sin parar merece una respuesta igual, no un silencio indefinido.
--   * El trabajo ya no lleva el texto dentro. Lo lee al ejecutarse, y lee TODO
--     lo que no hayamos contestado todavía. Así da igual cuántos mensajes
--     hayan entrado ni en qué orden se despachen.
--
-- Y se quita el atajo literal del "sí" escrito. Era gratis y funcionaba, pero
-- era un SEGUNDO camino que contestaba al instante mientras el otro esperaba un
-- minuto: justo la descoordinación que veníamos a arreglar. Los botones sí
-- siguen siendo instantáneos, porque un botón no es una frase a medias.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Lo que hay que contestar, y lo que ya se contestó
-- ----------------------------------------------------------------------------
-- El corte es el último mensaje NUESTRO que salió. Todo lo que el candidato
-- haya escrito después está sin contestar, y eso es exactamente lo que hay que
-- responder de una vez. No hace falta marcar mensajes ni llevar punteros: la
-- propia conversación dice por dónde íbamos.
--
-- Sustituye a `conversation_transcript`, que solo sabía descontar un mensaje.
create or replace function public.conversation_dialogo(
  p_conversation uuid,
  p_limit        int default 12
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_corte timestamptz; v_hilo jsonb; v_pend jsonb;
begin
  select max(created_at) into v_corte
    from public.candidate_messages
   where conversation_id = p_conversation
     and direction = 'saliente'
     and author in ('agente', 'persona')
     and delivery_status <> 'fallido';

  -- Sin contestar. Se marca de qué tipo es cada uno: un audio cuenta como
  -- mensaje suyo (hay que reaccionar), pero no como algo que se pueda leer.
  select coalesce(jsonb_agg(jsonb_build_object('texto', t.texto, 'tipo', t.tipo, 'clase', t.clase)
                            order by t.created_at, t.id), '[]'::jsonb)
    into v_pend
    from (select created_at, id, left(body, 800) as texto,
                 coalesce(payload ->> 'tipo', 'texto') as tipo,
                 payload ->> 'clase' as clase
            from public.candidate_messages
           where conversation_id = p_conversation
             and direction = 'entrante'
             and author = 'candidato'
             and btrim(coalesce(body, '')) <> ''
             and (v_corte is null or created_at > v_corte)
           order by created_at desc, id desc
           limit 10) t;

  -- Y lo anterior, para que sepa de qué se venía hablando.
  select coalesce(jsonb_agg(jsonb_build_object('quien', t.quien, 'texto', t.texto)
                            order by t.created_at, t.id), '[]'::jsonb)
    into v_hilo
    from (select created_at, id,
                 case author when 'candidato' then 'candidato'
                             when 'persona'   then 'persona'
                             else 'agente' end as quien,
                 left(body, 400) as texto
            from public.candidate_messages
           where conversation_id = p_conversation
             and author <> 'sistema'          -- notas internas: él no las ha visto
             and delivery_status <> 'fallido' -- si no llegó, no se dijo
             and btrim(coalesce(body, '')) <> ''
             -- Sin corte todavía (nunca le hemos escrito) NO hay hilo previo:
             -- todo lo que hay está sin contestar y ya va en `pendientes`.
             -- Con `v_corte is null or ...` salía duplicado en los dos sitios.
             and v_corte is not null and created_at <= v_corte
           order by created_at desc, id desc
           limit greatest(1, least(p_limit, 40))) t;

  return jsonb_build_object('hilo', v_hilo, 'pendientes', v_pend);
end
$$;
revoke all on function public.conversation_dialogo(uuid, int) from public, anon, authenticated;
grant execute on function public.conversation_dialogo(uuid, int) to service_role;

drop function if exists public.conversation_transcript(uuid, int, text);

-- ----------------------------------------------------------------------------
-- 2) La espera
-- ----------------------------------------------------------------------------
create or replace function public.programar_conversacion(
  p_conversation uuid,
  p_epoch        bigint,
  p_company      uuid,
  p_interview    uuid
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare v_key text; v_id bigint;
begin
  -- Una sola espera viva por conversación. El epoch va dentro para que, si una
  -- persona toma el control y lo devuelve, la espera vieja no se reutilice.
  v_key := 'conversa:' || p_conversation::text || ':' || coalesce(p_epoch, 0)::text;

  insert into public.interview_jobs as j
    (kind, payload, run_at, dedupe_key, company_id, interview_id, conversation_id, agent_epoch)
  values
    ('conversar', '{}'::jsonb, now() + interval '1 minute', v_key,
     p_company, p_interview, p_conversation, p_epoch)
  on conflict (dedupe_key) where dedupe_key is not null and status in ('pendiente', 'en_curso')
  do update
     set run_at = least(now() + interval '1 minute',
                        j.created_at + interval '3 minutes'),
         updated_at = now()
   where j.status = 'pendiente'
  returning id into v_id;

  if v_id is not null then return v_id; end if;

  -- Aquí solo se llega si el trabajo con el que choca se está EJECUTANDO justo
  -- ahora, o sea que ya no va a leer este mensaje. Se encola otro aparte:
  -- perder lo que ha escrito un candidato porque llegó en el segundo malo no es
  -- una opción aceptable.
  insert into public.interview_jobs
    (kind, payload, run_at, dedupe_key, company_id, interview_id, conversation_id, agent_epoch)
  values
    ('conversar', '{}'::jsonb, now() + interval '1 minute',
     v_key || ':' || clock_timestamp()::text,
     p_company, p_interview, p_conversation, p_epoch)
  returning id into v_id;
  return v_id;
end
$$;
revoke all on function public.programar_conversacion(uuid, bigint, uuid, uuid) from public, anon, authenticated;
grant execute on function public.programar_conversacion(uuid, bigint, uuid, uuid) to service_role;

-- ----------------------------------------------------------------------------
-- 3) La entrada, con un solo camino para todo lo que escriba
-- ----------------------------------------------------------------------------
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
  v_cuerpo text;
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

  -- Un audio o una foto se guardan con un cuerpo LEGIBLE, no con el nombre del
  -- tipo. Si no, el hilo que luego lee el agente diría que el candidato escribió
  -- "audio", que es mentira y encima confunde al modelo.
  v_cuerpo := case
    when p_tipo <> 'no_soportado' then left(coalesce(p_texto, ''), 4000)
    when p_texto = 'audio'    then '(te ha mandado un audio)'
    when p_texto = 'image'    then '(te ha mandado una foto)'
    when p_texto = 'document' then '(te ha mandado un archivo)'
    else '(te ha mandado algo que no sabemos leer)'
  end;

  begin
    insert into public.candidate_messages
      (conversation_id, company_id, candidate_id, direction, author, body, provider_message_id,
       delivery_status, payload)
    values
      (v_conv.id, v_conv.company_id, v_conv.candidate_id, 'entrante', 'candidato',
       v_cuerpo, p_provider_id, 'recibido',
       jsonb_build_object(
         'tipo', p_tipo,
         'opcion_id', p_opcion_id,
         -- Qué era lo que no sabemos leer (audio, image, document). Solo tiene
         -- sentido ahí: en un mensaje de texto guardaría el cuerpo dos veces.
         'clase', case when p_tipo = 'no_soportado' then p_texto end));
  exception when unique_violation then
    return jsonb_build_object('status', 'duplicado');
  end;

  update public.candidate_conversations
     set last_inbound_at = now(), window_expires_at = now() + interval '24 hours'
   where id = v_conv.id;

  -- La baja, antes que cualquier interpretación y SIN esperar un minuto. Es un
  -- derecho, no una intención que haya que leer en contexto.
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

  -- Los BOTONES no esperan. Pulsar no es hablar a medias: es una respuesta
  -- completa y cerrada, y hacerle esperar un minuto a quien acaba de elegir un
  -- horario sería absurdo.
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

    -- "Tengo una duda": una sola invitación a preguntar por conversación, aunque
    -- lo pulse tres veces.
    if p_opcion_id like 'c:' || v_conv.id::text || ':pregunta%' then
      perform public.enqueue_interview_job('responder_duda', '{}'::jsonb, now(),
        'duda:' || v_conv.id::text || ':' || v_conv.agent_epoch::text,
        v_conv.company_id, v_conv.interview_id, v_conv.id, v_conv.agent_epoch);
      return jsonb_build_object('status', 'duda', 'conversation_id', v_conv.id);
    end if;
  end if;

  -- Todo lo demás (texto, audios, fotos y botones caducados) abre o alarga la
  -- espera. Un solo camino, una sola respuesta.
  perform public.programar_conversacion(
    v_conv.id, v_conv.agent_epoch, v_conv.company_id, v_conv.interview_id);
  return jsonb_build_object('status', 'esperando', 'conversation_id', v_conv.id);
end
$$;
revoke all on function public.process_whatsapp_inbound(text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.process_whatsapp_inbound(text, text, text, text, text, text) to service_role;

-- El atajo literal del sí y del no deja de usarse: era el segundo camino que
-- contestaba al instante mientras el otro esperaba. La baja, que también es
-- literal, se queda: esa no admite espera ni interpretación.
drop function if exists public.es_afirmacion(text);
drop function if exists public.es_negacion(text);

-- ----------------------------------------------------------------------------
-- 4) El latido, más a menudo
-- ----------------------------------------------------------------------------
-- Con el cron cada minuto, una espera de un minuto podía tardar dos en
-- contestarse: se cumple el plazo justo después de pasar el latido y hay que
-- aguardar al siguiente. Cada 20 segundos el peor caso baja a ~80 s, que es lo
-- que se le prometió al usuario. El latido es una consulta y no hace nada si no
-- hay trabajo vencido.
do $$
begin
  perform cron.unschedule('interview-tick');
exception when others then
  raise warning 'no habia latido que retirar: %', sqlerrm;
end $$;

do $$
begin
  perform cron.schedule('interview-tick', '20 seconds', 'select public.interview_tick_kick()');
exception when others then
  raise warning 'no se pudo reprogramar el latido (%). Se queda como estaba.', sqlerrm;
end $$;
