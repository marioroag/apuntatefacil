-- ============================================================================
-- Apúntate Fácil: que la conversación no se pare
-- ----------------------------------------------------------------------------
-- Faltaba una pieza para que el proceso sea automático de verdad: poder cancelar
-- una entrevista a petición del candidato SIN que la conversación tenga que
-- pasar por una persona.
--
-- Cancelar es una decisión suya, no una que haya que autorizar. Retenerla hasta
-- que el empresario la confirme deja al candidato esperando una respuesta a algo
-- que ya ha decidido. La empresa se entera igual: queda en el historial del
-- candidato y la entrevista desaparece de su agenda.
-- ============================================================================

create or replace function public.conversation_cancelar(p_conversation uuid, p_epoch bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_conv public.candidate_conversations; v_int public.interviews;
begin
  select * into v_conv from public.candidate_conversations where id = p_conversation for update;
  if not found then return jsonb_build_object('status', 'no_existe'); end if;
  -- Vallado: si una persona tomó el control mientras esto viajaba, no se
  -- cancela nada en su nombre.
  if v_conv.agent_epoch <> p_epoch then return jsonb_build_object('status', 'obsoleto'); end if;

  select * into v_int from public.interviews where id = v_conv.interview_id for update;
  if not found then return jsonb_build_object('status', 'sin_entrevista'); end if;

  if v_int.status in ('confirmada', 'reprogramando') then
    update public.interviews
       set status = 'cancelada', cancelled_by = 'candidato',
           cancel_reason = 'El candidato la canceló por WhatsApp'
     where id = v_int.id;
  elsif v_int.status in ('invitada', 'proponiendo') then
    -- Todavía no había hora: no es una cancelación, es que no le interesa.
    update public.interviews set status = 'rechazada' where id = v_int.id;
  end if;

  -- Los recordatorios y el cierre de esa cita dejan de tener sentido. El
  -- trigger de la entrevista ya los retira, pero se dice aquí para que se lea.
  update public.candidate_conversations set agent_state = 'cerrada' where id = p_conversation;
  return jsonb_build_object('status', 'ok');
end
$$;
revoke all on function public.conversation_cancelar(uuid, bigint) from public, anon, authenticated;
grant execute on function public.conversation_cancelar(uuid, bigint) to service_role;
