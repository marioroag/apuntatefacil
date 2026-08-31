-- ============================================================================
-- Apúntate Fácil: la entrevista aparece en el calendario del anfitrión
-- ----------------------------------------------------------------------------
-- SE DISPARA CON UN TRIGGER Y NO DESDE LAS RPC, y esa es la decisión de esta
-- migración. Hay CUATRO caminos que mueven una cita (crearla a mano, el agente
-- de WhatsApp al confirmar, reprogramar y cancelar) más los que traiga el
-- futuro, y con la llamada escrita en cada uno bastaría con que un camino nuevo
-- se olvidara de ponerla para que el calendario de alguien se quedara mintiendo
-- sin que nadie se enterase. El trigger mira la FILA, así que le da igual quién
-- la haya tocado. Es la misma forma que ya usan el rango bloqueado, el guardián
-- de transiciones y el historial de esta misma tabla.
--
-- EL TRABAJO VA A LA COLA QUE YA EXISTE (`interview_jobs`), no a una llamada
-- desde el navegador: hablar con Google puede fallar, y una cita que no llega
-- al calendario porque a alguien se le cerró el portátil es exactamente el
-- fallo que no se ve hasta que no aparece nadie a la entrevista. La cola trae
-- reintentos, deduplicación y latido.
-- ============================================================================

alter table public.interview_jobs drop constraint interview_jobs_kind_check;
alter table public.interview_jobs add constraint interview_jobs_kind_check check (kind in (
  'recordatorio_24h',
  'recordatorio_2h',
  'marcar_realizada',
  'enviar_invitacion',
  'reofertar_horarios',
  'avisar_intervencion',
  -- Poner, mover o quitar el evento en el calendario del anfitrión. Uno por
  -- entrevista y a la vez (el dedupe_key lo garantiza): lo que importa es el
  -- estado FINAL de la fila, no cada paso por el que pasó.
  'sincronizar_calendario'
));

-- ----------------------------------------------------------------------------
-- 1) Qué le toca al calendario según cómo esté la entrevista
-- ----------------------------------------------------------------------------
-- Tres respuestas y no dos, y la tercera es la que se olvida:
--
--   * PONER  -> confirmada o reprogramando CON hora. "Reprogramando" conserva
--     el hueco viejo mientras se negocia el nuevo (lo dice su propio comentario
--     en la tabla), así que su evento sigue valiendo: quitarlo dejaría al
--     anfitrión con la hora libre en pantalla y ocupada de verdad.
--   * NADA   -> realizada. Ya pasó, y un evento pasado es el registro de que
--     pasó. Borrarlo sería reescribirle el histórico a alguien.
--   * QUITAR -> cancelada, rechazada, sin respuesta o fallida. Ahí el sentido
--     de cancelar es justamente recuperar ese hueco.

create or replace function public.calendar_accion_de(p_status text, p_starts timestamptz)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when p_status in ('confirmada', 'reprogramando') and p_starts is not null then 'poner'
    when p_status = 'realizada' then 'nada'
    else 'quitar'
  end
$$;

-- ----------------------------------------------------------------------------
-- 2) Marcar la fila (BEFORE) y encolar (AFTER)
-- ----------------------------------------------------------------------------
-- Son dos triggers y no uno porque el trabajo lleva una clave foránea a la
-- entrevista: en el BEFORE de un INSERT, la fila todavía no existe y encolar
-- ahí violaría la referencia. El BEFORE decide y escribe en NEW (sin un UPDATE
-- extra, que se llamaría a sí mismo); el AFTER encola.

create or replace function public.interviews_calendar_mark()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_accion text; v_conectado boolean;
begin
  -- Lo que escribe el propio sincronizador no vuelve a entrar por aquí. Sin
  -- esto, guardar el enlace de Meet que Google acaba de crear cuenta como "ha
  -- cambiado la entrevista" y se encola otra vuelta.
  if coalesce(current_setting('apuntate.calendar_sync', true), '') = '1' then
    return new;
  end if;

  -- Nada que sincronizar si no ha cambiado nada de lo que se pinta en el
  -- evento. `is not distinct from` y no `=`: con un null, `=` da null y el IF
  -- se lo traga, así que pasar de sin hora a con hora no se notaría.
  if tg_op = 'UPDATE'
     and old.status is not distinct from new.status
     and old.starts_at is not distinct from new.starts_at
     and old.ends_at is not distinct from new.ends_at
     and old.host_user_id is not distinct from new.host_user_id
     and old.mode is not distinct from new.mode
     and old.location_text is not distinct from new.location_text
     and old.meeting_url is not distinct from new.meeting_url
     and old.timezone is not distinct from new.timezone
  then
    return new;
  end if;

  v_accion := public.calendar_accion_de(new.status, new.starts_at);
  if v_accion = 'nada' then return new; end if;

  select exists (
    select 1 from public.calendar_connections c
     where c.company_id = new.company_id and c.user_id = new.host_user_id
  ) into v_conectado;

  if v_accion = 'poner' then
    -- Sin calendario conectado no hay nada que sincronizar, y decirlo así
    -- ('ninguno') es distinto de decir que falló.
    if not v_conectado then
      new.calendar_sync_state := 'ninguno';
      return new;
    end if;
    new.calendar_provider := 'google';
    new.calendar_sync_state := 'pendiente';
  else
    -- Quitar solo tiene sentido si llegamos a poner algo. Y se intenta AUNQUE
    -- la conexión ya no exista: en ese caso el trabajo se cerrará sin hacer
    -- nada, que es lo único que se puede hacer sin permiso.
    if new.calendar_event_id is null then
      new.calendar_sync_state := 'ninguno';
      return new;
    end if;
    new.calendar_sync_state := 'borrando';
  end if;

  return new;
end
$$;

create or replace function public.interviews_calendar_enqueue()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.calendar_sync_state not in ('pendiente', 'borrando') then return null; end if;

  -- Una entrevista, un trabajo. Si se mueve tres veces en un minuto, lo que hay
  -- que escribir en el calendario es el estado final, no tres versiones: el
  -- ejecutor vuelve a leer la fila cuando le toca.
  perform public.enqueue_interview_job(
    p_kind       => 'sincronizar_calendario',
    p_payload    => '{}'::jsonb,
    p_dedupe_key => 'calendario:' || new.id::text,
    p_company    => new.company_id,
    p_interview  => new.id);

  -- Sin el latido, poner una cita y verla en el calendario tardaría hasta un
  -- minuto. Aquí sí nace un trabajo "para ahora mismo", que es el caso para el
  -- que `interview_tick_kick` se dejó escrita y sin usar.
  perform public.interview_tick_kick();
  return null;
end
$$;

drop trigger if exists interviews_calendar_mark on public.interviews;
create trigger interviews_calendar_mark
  before insert or update on public.interviews
  for each row execute function public.interviews_calendar_mark();

drop trigger if exists interviews_calendar_enqueue on public.interviews;
create trigger interviews_calendar_enqueue
  after insert or update on public.interviews
  for each row execute function public.interviews_calendar_enqueue();

-- ----------------------------------------------------------------------------
-- 3) Lo que el ejecutor necesita, y lo que puede escribir
-- ----------------------------------------------------------------------------

create or replace function public.interview_calendar_payload(p_interview uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v record;
begin
  select i.id, i.company_id, i.host_user_id, i.status, i.starts_at, i.ends_at,
         i.timezone, i.mode, i.location_text, i.meeting_url,
         i.calendar_event_id, i.calendar_sync_state, i.campaign_id, i.candidate_id,
         -- Nombre y apellidos, como en la lista: en la rejilla de un calendario
         -- "Alberto" a secas no distingue a nadie. Espejo de `candidateName`.
         coalesce(nullif(btrim(concat_ws(' ', nullif(btrim(c.answers ->> 'nombre'), ''),
                                              nullif(btrim(c.answers ->> 'apellidos'), ''))), ''),
                  'Candidato') as candidato,
         coalesce(ca.title, '') as puesto
    into v
    from public.interviews i
    join public.candidates c on c.id = i.candidate_id
    join public.campaigns  ca on ca.id = i.campaign_id
   where i.id = p_interview;
  if not found then return null; end if;

  return jsonb_build_object(
    'id', v.id, 'companyId', v.company_id, 'hostUserId', v.host_user_id,
    'accion', public.calendar_accion_de(v.status, v.starts_at),
    'inicio', v.starts_at, 'fin', v.ends_at, 'timezone', v.timezone,
    'modo', v.mode, 'lugar', v.location_text, 'meetingUrl', v.meeting_url,
    'eventId', v.calendar_event_id,
    'candidato', v.candidato, 'puesto', v.puesto,
    'campaignId', v.campaign_id, 'candidateId', v.candidate_id);
end
$$;
revoke all on function public.interview_calendar_payload(uuid) from public, anon, authenticated;
grant execute on function public.interview_calendar_payload(uuid) to service_role;

-- El resultado. Las tres escriben con la bandera puesta para no volver a
-- disparar el trigger que las trajo hasta aquí, y LA APAGAN AL SALIR.
--
-- Apagarla no es limpieza: `set_config(..., true)` dura toda la TRANSACCIÓN, no
-- la sentencia. Dejándola puesta, cualquier cambio posterior de esa misma
-- entrevista dentro de la misma transacción se saltaría el trigger y no llegaría
-- nunca al calendario. En producción cada RPC va en su transacción y no se
-- notaría; se cazó probándolo con las dos operaciones seguidas.
create or replace function public.interview_calendar_done(
  p_interview uuid, p_event_id text, p_meet_url text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('apuntate.calendar_sync', '1', true);
  update public.interviews
     set calendar_provider   = 'google',
         calendar_event_id   = p_event_id,
         calendar_sync_state = 'sincronizado',
         calendar_synced_at  = now(),
         -- El enlace de la sala que ha creado Google solo se escribe si no
         -- había ninguno: el que puso una persona manda siempre.
         meeting_url = case when meeting_url is null and p_meet_url is not null
                            then p_meet_url else meeting_url end
   where id = p_interview;
  perform set_config('apuntate.calendar_sync', '0', true);
end
$$;
revoke all on function public.interview_calendar_done(uuid, text, text) from public, anon, authenticated;
grant execute on function public.interview_calendar_done(uuid, text, text) to service_role;

create or replace function public.interview_calendar_cleared(p_interview uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('apuntate.calendar_sync', '1', true);
  update public.interviews
     set calendar_event_id = null, calendar_sync_state = 'ninguno', calendar_synced_at = now()
   where id = p_interview;
  perform set_config('apuntate.calendar_sync', '0', true);
end
$$;
revoke all on function public.interview_calendar_cleared(uuid) from public, anon, authenticated;
grant execute on function public.interview_calendar_cleared(uuid) to service_role;

create or replace function public.interview_calendar_failed(p_interview uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('apuntate.calendar_sync', '1', true);
  update public.interviews
     set calendar_sync_state = 'fallido', calendar_synced_at = now()
   where id = p_interview;
  perform set_config('apuntate.calendar_sync', '0', true);
end
$$;
revoke all on function public.interview_calendar_failed(uuid) from public, anon, authenticated;
grant execute on function public.interview_calendar_failed(uuid) to service_role;

-- El ejecutor corre con service_role y lee las entrevistas por RPC, pero el
-- trigger de marcar consulta `calendar_connections`, y eso lo hace con los
-- permisos de quien crea la cita (una persona autenticada). Por eso la función
-- es `security definer`: si no, marcar una entrevista fallaría con un permiso
-- denegado sobre una tabla que a nadie le hace falta poder leer.
