-- ============================================================================
-- Apúntate Fácil: la candidatura se analiza sola, y se ve mientras se analiza
-- ----------------------------------------------------------------------------
-- Hasta hoy el triaje de Meridian lo disparaba EL NAVEGADOR DEL CANDIDATO: el
-- formulario público, justo después de enviar, llamaba a `analyze-candidate`
-- sin esperar la respuesta. Eso deja tres agujeros, y esta migración cierra los
-- tres (el tercero, en el cliente).
--
--   1. LO QUE NO SALE DEL NAVEGADOR NO PASA. Una pestaña que se cierra al
--      enviar, una red mala, un móvil que suspende la página o un bloqueador
--      dejan esa candidatura sin analizar PARA SIEMPRE: no hay cola, ni
--      reintento, ni barrido. Y el fallo es silencioso y del lado del
--      candidato, que es justo quien no puede arreglarlo. Es el mismo
--      argumento que ya sacó del navegador la escritura en Google Calendar:
--      lo que tiene que pasar sí o sí sale del SERVIDOR y va a la COLA.
--
--   2. EL PANEL ABIERTO NO SE ENTERA. El único ping en vivo de un candidato es
--      `new_candidate`, y su trigger es AFTER INSERT. Cuando la función
--      escribe `candidates.ai` medio minuto después, no se emite nada: la fila
--      sigue diciendo "sin analizar" y la columna Encaje con una raya hasta que
--      alguien recargue. El trabajo estaba hecho y la pantalla mentía.
--
--   3. Y MIENTRAS TANTO NO SE DICE NADA. El análisis son cuatro llamadas
--      encadenadas a OpenAI (baremo, evaluador, juez, redactor) más la visión
--      del CV: tarda, y esa espera se pintaba igual que "esta persona no se ha
--      analizado nunca". El reclamo (`ai_claimed_at`) ya distingue los dos
--      casos desde ago 2026; solo faltaba dejarlo llegar al cliente y contarlo.
--
-- EL DISPARO VA EN UN TRIGGER Y NO EN LA RPC, por lo mismo que el calendario:
-- hay más de un camino que crea una candidatura (el formulario público hoy, y
-- lo que venga: los candidatos de portal, una importación), y con la llamada
-- escrita en cada uno basta que un camino nuevo se olvide para que un puesto
-- entero deje de analizarse sin que nadie se entere. El trigger mira la FILA.
--
-- LA ADUANA SIGUE SIENDO `analyze-candidate`, y esto no la toca: el plan, el
-- interruptor de Ajustes (`meridian_auto`), la idempotencia, la clave de OpenAI
-- y el reclamo atómico se comprueban donde se comprobaban. Aquí solo cambia
-- QUIÉN llama, y que ahora hay quien lo reintente.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Un tipo de trabajo más
-- ----------------------------------------------------------------------------
-- OJO: la lista de un `check` es el vocabulario ENTERO de la tabla, no un
-- añadido. Esta sale de la ÚLTIMA migración que la tocó
-- (`20260831190000_calendario_sincronizar.sql`) más el tipo nuevo al final.
-- Lo vigila `src/lib/tiposDeTrabajo.test.ts`.
alter table public.interview_jobs drop constraint if exists interview_jobs_kind_check;
alter table public.interview_jobs add constraint interview_jobs_kind_check check (kind in (
  'recordatorio_24h', 'recordatorio_2h', 'marcar_realizada', 'avisar_intervencion',
  'recordatorio_vispera', 'acuse_asistencia',
  'acuse_interes',
  'enviar_invitacion', 'enviar_horarios', 'enviar_horas', 'reofertar_horarios',
  'enviar_confirmacion', 'enviar_despedida', 'enviar_texto',
  'clasificar_texto',
  'conversar',
  'responder_duda',
  'mensaje_no_leible',
  'sincronizar_calendario',
  -- El triaje de una candidatura que acaba de entrar. Uno por candidato y a la
  -- vez (lo garantiza el dedupe_key): el ejecutor vuelve a leer la fila cuando
  -- le toca, así que lo que importa es el estado FINAL, no cada paso.
  'analizar_candidato'
));

-- ----------------------------------------------------------------------------
-- 2) El candidato viaja en el `payload`, no en una columna
-- ----------------------------------------------------------------------------
-- La tentación era la columna con `on delete cascade`, como `interview_id`. Se
-- descartó: `enqueue_interview_job` la llaman veinte funciones de otras tantas
-- migraciones, y añadirle un parámetro obliga a DROPEAR y recrear la RPC
-- central de la cola (una sobrecarga dejaría ambiguas las llamadas de ocho
-- argumentos posicionales que ya hay). Todo eso para ganar un borrado en
-- cascada que el ejecutor ya resuelve solo: si el candidato ya no está,
-- `analyze-candidate` responde "candidato no encontrado" y el trabajo se
-- cancela con ese motivo, que además deja escrito lo que pasó.

-- ----------------------------------------------------------------------------
-- 3) Encolar al entrar
-- ----------------------------------------------------------------------------

create or replace function public.candidates_analisis_enqueue()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- SOLO UNA CANDIDATURA QUE ACABA DE LLEGAR. `restoreCandidate` (el deshacer
  -- de un borrado) reinserta la fila con su `created_at` ORIGINAL, y eso no es
  -- una candidatura nueva: es la misma volviendo. Sin esta guarda, deshacer un
  -- borrado pagaría un análisis de OpenAI que nadie ha pedido.
  if new.created_at < now() - interval '5 minutes' then return null; end if;

  -- Se encola TAMBIÉN si la fila entra bloqueada (prueba caducada). Es la
  -- paridad exacta con lo que hacía el navegador, que tampoco miraba `locked`,
  -- y es lo que hace que al pagar los candidatos aparezcan ya leídos en vez de
  -- uno a uno a mano. Quien no lo quiera tiene el interruptor de Ajustes.
  perform public.enqueue_interview_job(
    p_kind       => 'analizar_candidato',
    p_payload    => jsonb_build_object('candidate_id', new.id),
    p_dedupe_key => 'analisis:' || new.id::text,
    p_company    => new.company_id);

  -- EL LATIDO VA EN SU PROPIO BLOQUE, y no es cosmético: en plpgsql un bloque
  -- con `exception` es una SUBTRANSACCIÓN, así que un fallo aquí deshace todo
  -- lo que hubiera hecho el bloque, EL ENCOLADO INCLUIDO. Medido en local
  -- rompiendo el latido a propósito: la candidatura entraba (bien) y su trabajo
  -- desaparecía sin dejar rastro (mal), o sea que esa persona no se analizaría
  -- nunca. Lo que no se puede perder es el trabajo; el latido solo ahorra
  -- esperar al cron del minuto siguiente.
  begin
    perform public.interview_tick_kick();
  exception when others then
    raise warning 'candidates_analisis_enqueue (latido): %', sqlerrm;
  end;

  return null;
exception when others then
  -- LA CANDIDATURA ENTRA SIEMPRE. El triaje es accesorio: que la cola falle no
  -- puede dejar a alguien sin poder apuntarse a un puesto. Mismo criterio que
  -- el broadcast de al lado.
  raise warning 'candidates_analisis_enqueue: %', sqlerrm;
  return null;
end
$$;

-- AFTER INSERT, como el broadcast: `trg_enforce_candidate_limit` es BEFORE, así
-- que la fila ya es definitiva.
drop trigger if exists trg_candidates_analisis_enqueue on public.candidates;
create trigger trg_candidates_analisis_enqueue
  after insert on public.candidates
  for each row execute function public.candidates_analisis_enqueue();

-- ----------------------------------------------------------------------------
-- 4) Y decirlo en vivo: el ping del análisis
-- ----------------------------------------------------------------------------
-- Mismo canal y mismo patrón que `new_candidate` (Broadcast from Database, sin
-- PII, al topic privado de la empresa). Dos pings por análisis y los dos hacen
-- falta: el del RECLAMO enciende el "Analizando…" de la fila, y el del
-- GUARDADO lo sustituye por el encaje. Sin el primero, la espera se vería
-- igual que "nunca se ha analizado"; sin el segundo, el trabajo estaría hecho
-- y la pantalla seguiría diciendo que no.
create or replace function public.broadcast_candidate_ai()
returns trigger
language plpgsql
security definer          -- lo escribe service_role, que no tiene privilegios
set search_path = public  -- sobre el schema realtime
as $$
begin
  perform realtime.send(
    jsonb_build_object('campaign_id', new.campaign_id),
    'candidate_ai',
    'company:' || new.company_id::text,
    true  -- private: exige policy de select en realtime.messages
  );
  return null;
exception when others then
  -- Un ping perdido no puede tumbar el guardado del análisis: lo peor que
  -- pasa es que la pantalla se entere en la siguiente recarga, que es
  -- exactamente lo que había antes de esta migración.
  return null;
end
$$;

-- `update of` solo dispara si la columna aparece en el SET, y las dos las toca
-- únicamente `analyze-candidate`: un cambio de estado o una nota no las
-- mencionan, así que no emiten nada.
drop trigger if exists trg_broadcast_candidate_ai on public.candidates;
create trigger trg_broadcast_candidate_ai
  after update of ai, ai_claimed_at on public.candidates
  for each row execute function public.broadcast_candidate_ai();

-- ----------------------------------------------------------------------------
-- 5) Devolver a la cola lo que no dio tiempo a hacer
-- ----------------------------------------------------------------------------
-- Un análisis tarda decenas de segundos, así que un tick no puede ejecutar los
-- veinticinco trabajos que puede reclamar: se comería su propio tiempo de vida
-- y moriría a mitad. El tick hace unos cuantos y devuelve el resto AQUÍ.
--
-- Y devolverlos NO GASTA UN INTENTO: `claim_interview_jobs` ya subió `attempts`
-- al repartirlos, y un trabajo que ni se ha intentado no puede acercarse al
-- tope de reintentos por haber llegado en una ráfaga. Sin este descuento, una
-- tarde de veinticinco candidaturas marcaría media docena como fallidas sin
-- haberlas mirado.
--
-- La alternativa era no hacer nada y dejar que el segador los rescatara: eso
-- son dos minutos de retraso por vuelta Y el intento gastado. Esto es lo mismo
-- pero honesto y al instante.
create or replace function public.release_interview_jobs(p_ids bigint[])
returns int
language plpgsql
security definer
set search_path = public
as $$
declare v_n int;
begin
  update public.interview_jobs
     set status = 'pendiente',
         locked_until = null,
         attempts = greatest(0, attempts - 1),
         updated_at = now()
   where id = any (p_ids) and status = 'en_curso';
  get diagnostics v_n = row_count;
  return v_n;
end
$$;
revoke all on function public.release_interview_jobs(bigint[]) from public, anon, authenticated;
grant execute on function public.release_interview_jobs(bigint[]) to service_role;
