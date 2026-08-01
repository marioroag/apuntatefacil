-- ============================================================================
-- Apúntate Fácil: que reprogramar funcione (y que nunca se responda con nada)
-- ----------------------------------------------------------------------------
-- Salió probándolo Mario con su número, y es de las peores que puede tener este
-- producto: cuatro mensajes suyos seguidos SIN NINGUNA respuesta.
--
--   15:26:35  nosotros  "Tu entrevista queda el jueves, 6 de agosto a las 09:00"
--   15:26:41  él        "Al final necesito que sea el viernes"     -> silencio
--   15:27:00  él        "Puedes hacerlo posible?"                  -> silencio
--   15:28:33  él        "?"                                        -> silencio
--   15:43:29  él        "Hola?"                                    -> silencio
--
-- La causa: `reprogramando` existe en el esquema desde el primer día, con su
-- transición permitida y su hueco reservado en la constraint de solapes, pero
-- NINGUNA de las dos funciones que hacen falta lo aceptaba. `set_offered_slots`
-- y `book_interview_slot` solo miraban 'invitada' y 'proponiendo'. O sea que
-- mover una entrevista ya cerrada no ha funcionado nunca: la primera devolvía
-- 'no_procede', el agente lo tomaba por "esto ya no toca" y se callaba.
--
-- Se arregla el camino entero, no el síntoma. Y en el código, además, se quita
-- la posibilidad de que un mensaje del candidato acabe en silencio.
-- ============================================================================

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
  if v.status not in ('invitada', 'proponiendo', 'reprogramando') then
    return jsonb_build_object('status', 'no_procede', 'estado', v.status);
  end if;

  update public.interviews
     set offered_slots = p_slots,
         -- La ronda sube con cada oferta. Es lo que invalida la anterior: si el
         -- candidato pulsa un horario de la ronda vieja (le llegó tarde, o
         -- subió a mirar), se sabe y no se reserva a ciegas.
         offer_round = least(10, v.offer_round + 1),
         -- Reprogramando NO pasa a proponiendo. Mientras se renegocia, el hueco
         -- viejo sigue reservado por `interviews_sin_solape`, que ya cuenta ese
         -- estado a propósito. Soltarlo aquí llevaría al peor resultado posible:
         -- quedarse sin el nuevo Y sin el que ya tenía.
         status = case when v.status = 'reprogramando' then 'reprogramando' else 'proponiendo' end
   where id = p_interview;
  return jsonb_build_object('status', 'ok', 'ronda', least(10, v.offer_round + 1));
end
$$;

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
  if v_conv.agent_epoch <> p_epoch then return jsonb_build_object('status', 'obsoleto'); end if;

  select * into v_int from public.interviews where id = v_conv.interview_id for update;
  if not found then return jsonb_build_object('status', 'sin_entrevista'); end if;
  if v_int.status = 'confirmada' then
    -- Doble pulsación del candidato. No es un error: ya tiene su hora.
    return jsonb_build_object('status', 'ya_confirmada', 'starts_at', v_int.starts_at);
  end if;
  -- 'reprogramando' entra aquí: es exactamente el caso de quien ya tenía hora y
  -- está eligiendo otra.
  if v_int.status not in ('invitada', 'proponiendo', 'reprogramando') then
    return jsonb_build_object('status', 'no_procede', 'estado', v_int.status);
  end if;

  v_slot := v_int.offered_slots -> p_slot;
  if v_slot is null then return jsonb_build_object('status', 'hueco_desconocido'); end if;

  v_ini := (v_slot ->> 'starts_at')::timestamptz;
  v_fin := (v_slot ->> 'ends_at')::timestamptz;
  if v_ini <= now() then
    return jsonb_build_object('status', 'caducado');
  end if;

  begin
    -- Al confirmar desde 'reprogramando', esta misma fila suelta su rango viejo
    -- y coge el nuevo en la misma sentencia, así que no choca consigo misma.
    update public.interviews
       set status = 'confirmada', starts_at = v_ini, ends_at = v_fin,
           confirmed_at = now(), origin = 'whatsapp',
           calendar_sync_state = case when calendar_provider is null then 'ninguno' else 'pendiente' end
     where id = v_int.id;
  exception when exclusion_violation then
    update public.interviews set offer_round = least(10, v_int.offer_round + 1) where id = v_int.id;
    perform public.enqueue_interview_job('reofertar_horarios', '{}'::jsonb, now(),
      'reoferta:' || v_conv.id::text || ':' || (v_int.offer_round + 1)::text,
      v_conv.company_id, v_int.id, v_conv.id, v_conv.agent_epoch);
    return jsonb_build_object('status', 'ocupado');
  end;

  update public.candidate_conversations
     set agent_state = 'entrevista_confirmada' where id = p_conversation;

  perform public.enqueue_interview_job('enviar_confirmacion', '{}'::jsonb, now(),
    'confirma:' || v_int.id::text || ':' || v_int.offer_round::text,
    v_conv.company_id, v_int.id, v_conv.id, v_conv.agent_epoch);

  return jsonb_build_object('status', 'ok', 'starts_at', v_ini, 'interview_id', v_int.id);
end
$$;
