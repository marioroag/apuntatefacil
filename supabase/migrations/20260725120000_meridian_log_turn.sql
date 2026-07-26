-- ==========================================================================
-- Guardar en el hilo lo que ocurre en el CLIENTE.
--
-- No todo lo que pasa en el panel pasa por el modelo: las tareas rápidas, las
-- comparativas, marcar estados o abrir el detalle de un envío se resuelven en
-- local. Antes eso no se guardaba, así que al recargar el hilo contaba media
-- historia: quedaban las respuestas del modelo y desaparecía justo lo que el
-- usuario recordaba haber pedido con un clic.
--
-- La escritura va por RPC y no por grant de INSERT para que el cliente no pueda
-- escribir en hilos ajenos ni inventarse thread_id: la función localiza (o crea)
-- el hilo de QUIEN LLAMA en la empresa indicada.
-- ==========================================================================

create or replace function public.meridian_log_turn(
  p_company uuid,
  p_role    text,
  p_body    text,
  p_payload jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_thread uuid;
  v_turn   uuid;
begin
  if p_company is null or p_company not in (select public.current_user_company_ids()) then
    raise exception 'No autorizado';
  end if;
  if p_role not in ('user', 'meridian') then
    raise exception 'Rol no válido';
  end if;

  -- Upsert y no "mira si existe y si no créalo": una acción escribe su turno de
  -- usuario y el de Meridian casi a la vez, y con select+insert las dos veían el
  -- hilo vacío, las dos insertaban y una moría contra el índice único. El turno
  -- que perdía la carrera se descartaba en silencio.
  insert into public.meridian_threads (company_id, user_id, last_message_at)
  values (p_company, auth.uid(), now())
  on conflict (company_id, user_id) do update set last_message_at = now()
  returning id into v_thread;

  insert into public.meridian_turns (thread_id, role, body, payload)
  values (v_thread, p_role, left(coalesce(p_body, ''), 4000), p_payload)
  returning id into v_turn;

  return v_turn;
end;
$$;

revoke all on function public.meridian_log_turn(uuid, text, text, jsonb) from public, anon;
grant execute on function public.meridian_log_turn(uuid, text, text, jsonb) to authenticated;
