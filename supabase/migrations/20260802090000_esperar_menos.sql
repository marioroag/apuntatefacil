-- ============================================================================
-- Apúntate Fácil: esperar lo justo
-- ----------------------------------------------------------------------------
-- La espera de un minuto agrupaba bien pero se sentía muerta. Medido con los
-- mensajes reales de Mario:
--
--   "La quiero el sabado"   -> 65 s
--   "No puedes el sábado?"  -> 68 s
--   "Dime" (+2 seguidos)    -> 96 s
--
-- El desglose eran 60 s de espera + hasta 20 s de latido + ~5 s de modelo. Lo
-- que sobra es la espera: quien escribe una ráfaga la escribe SEGUIDA, no
-- espaciada un minuto. Con 20 segundos de silencio se agrupa exactamente igual
-- (la ventana se sigue reiniciando con cada mensaje) y se contesta tres veces
-- más rápido.
--
--   espera 20 s + latido cada 10 s + modelo  ->  ~25 s típico, ~35 s el peor caso
--
-- El tope baja a 2 minutos por coherencia: con ventanas de 20 s, tres minutos
-- de tope era un número heredado que ya no significaba nada.
-- ============================================================================

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
  v_key := 'conversa:' || p_conversation::text || ':' || coalesce(p_epoch, 0)::text;

  insert into public.interview_jobs as j
    (kind, payload, run_at, dedupe_key, company_id, interview_id, conversation_id, agent_epoch)
  values
    ('conversar', '{}'::jsonb, now() + interval '20 seconds', v_key,
     p_company, p_interview, p_conversation, p_epoch)
  on conflict (dedupe_key) where dedupe_key is not null and status in ('pendiente', 'en_curso')
  do update
     set run_at = least(now() + interval '20 seconds',
                        j.created_at + interval '2 minutes'),
         updated_at = now()
   where j.status = 'pendiente'
  returning id into v_id;

  if v_id is not null then return v_id; end if;

  -- El trabajo con el que choca se está ejecutando ahora mismo, así que ya no
  -- va a leer este mensaje. Se encola otro aparte: perder lo que ha escrito un
  -- candidato porque llegó en el segundo malo no es una opción aceptable.
  insert into public.interview_jobs
    (kind, payload, run_at, dedupe_key, company_id, interview_id, conversation_id, agent_epoch)
  values
    ('conversar', '{}'::jsonb, now() + interval '20 seconds',
     v_key || ':' || clock_timestamp()::text,
     p_company, p_interview, p_conversation, p_epoch)
  returning id into v_id;
  return v_id;
end
$$;

-- El latido, a 10 segundos. Es una consulta que no hace nada si no hay trabajo
-- vencido, y es la mitad de lo que el candidato percibe como retraso.
do $$
begin
  perform cron.unschedule('interview-tick');
exception when others then
  raise warning 'no habia latido que retirar: %', sqlerrm;
end $$;

do $$
begin
  perform cron.schedule('interview-tick', '10 seconds', 'select public.interview_tick_kick()');
exception when others then
  raise warning 'no se pudo reprogramar el latido (%). Se queda como estaba.', sqlerrm;
end $$;
