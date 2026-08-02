-- ============================================================================
-- Apúntate Fácil: llamarle por su nombre, no por su ficha
-- ----------------------------------------------------------------------------
-- El formulario recoge el nombre completo, y el agente lo usaba tal cual:
--
--   "Estos son los horarios que tenemos, Mario Rodríguez Aguado."
--   "Hecho, Mario Rodríguez Aguado. Tu entrevista queda el..."
--
-- Nadie escribe así por WhatsApp. Suena a carta del banco, y es justo el tipo de
-- detalle que delata que al otro lado no hay una persona.
--
-- Se corta por el primer espacio. Con nombres compuestos ("José Luis") se pierde
-- la segunda parte, y aun así "José" es mejor saludo que el nombre y los dos
-- apellidos. El nombre completo sigue intacto en la ficha del candidato, que es
-- donde el empresario lo necesita.
-- ============================================================================

create or replace function public.conversation_context(p_conversation uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v jsonb; v_pila text;
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
           -- Con 'Hola' de reserva: sirve para encabezar una frase aunque no
           -- sepamos cómo se llama.
           'candidato',       coalesce(
                                nullif(split_part(btrim(ca.answers ->> 'nombre'), ' ', 1), ''),
                                'Hola'),
           -- Y aquí null es null: es lo que ve la IA, y "Hola" como nombre haría
           -- que le llamara Hola.
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
