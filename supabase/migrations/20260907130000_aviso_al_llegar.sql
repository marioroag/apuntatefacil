-- ============================================================================
-- Apúntate Fácil: el aviso de candidatura nueva sale del SERVIDOR
-- ----------------------------------------------------------------------------
-- El correo que le dice a la empresa que acaba de apuntarse alguien lo
-- disparaba EL NAVEGADOR DEL CANDIDATO: el formulario público, justo después
-- de enviar, llamaba a `notify-new-candidate` con `.catch(() => {})` y sin
-- esperar respuesta.
--
-- LO QUE NO SALE DEL NAVEGADOR NO PASA. Una pestaña que se cierra al enviar,
-- una red mala, un móvil que suspende la página o un bloqueador dejan a la
-- empresa SIN ESE AVISO: no había cola, ni reintento, ni barrido. Y el fallo
-- es silencioso y del lado del candidato, que es justo quien no puede
-- arreglarlo ni sabe que ha ocurrido. Aquí duele además doble, porque el aviso
-- es lo que hace que alguien entre a mirar: perdido, la candidatura se queda
-- esperando en un panel que nadie abre.
--
-- Es el mismo argumento que ya sacó del navegador la escritura en Google
-- Calendar y, la semana pasada, el triaje de Meridian
-- (`20260907120000_analisis_al_llegar.sql`). Este es el mismo camino para el
-- que era el ÚLTIMO inquilino de aquella línea, así que el formulario público
-- se queda sin ninguna llamada de las que tienen que pasar sí o sí.
--
-- EL DISPARO VA EN UN TRIGGER Y NO EN LA RPC, por lo mismo que los otros dos:
-- hay más de un camino que crea una candidatura (el formulario público hoy, y
-- lo que venga: los candidatos de portal, una importación), y con la llamada
-- escrita en cada uno basta que un camino nuevo se olvide para que un puesto
-- entero deje de avisar sin que nadie se entere. El trigger mira la FILA.
--
-- LA ADUANA SIGUE SIENDO `notify-new-candidate`, y esto no la toca: el
-- interruptor del puesto (`campaigns.notify_new`), el de la persona
-- (`email_prefs`, vía `conPreferencia`), el reclamo atómico de `notified_at`
-- que evita el correo duplicado y el copy del candidato bloqueado se
-- comprueban donde se comprobaban. Aquí solo cambia QUIÉN llama, y que ahora
-- hay quien lo reintente.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Un tipo de trabajo más
-- ----------------------------------------------------------------------------
-- OJO: la lista de un `check` es el vocabulario ENTERO de la tabla, no un
-- añadido. Esta sale de la ÚLTIMA migración que la tocó
-- (`20260907120000_analisis_al_llegar.sql`) más el tipo nuevo al final.
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
  'analizar_candidato',
  -- El aviso por correo de una candidatura que acaba de entrar. Uno por
  -- candidato y a la vez (lo garantiza el dedupe_key): el ejecutor vuelve a
  -- leer la fila cuando le toca, así que lo que importa es el estado FINAL.
  'avisar_candidatura'
));

-- ----------------------------------------------------------------------------
-- 2) Encolar al entrar
-- ----------------------------------------------------------------------------
-- El candidato viaja en el `payload` y no en una columna, por lo mismo que en
-- el análisis: `enqueue_interview_job` la llaman veinte funciones de otras
-- tantas migraciones y añadirle un parámetro obliga a dropear y recrear la RPC
-- central de la cola. Lo único que compraría es un borrado en cascada que el
-- ejecutor ya resuelve solo: si el candidato ya no está,
-- `notify-new-candidate` responde "candidato no encontrado" y el trabajo se
-- cancela con ese motivo, que además deja escrito lo que pasó.

create or replace function public.candidates_aviso_enqueue()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- SOLO UNA CANDIDATURA QUE ACABA DE LLEGAR. `restoreCandidate` (el deshacer
  -- de un borrado) reinserta la fila con su `created_at` ORIGINAL, y eso no es
  -- una candidatura nueva: es la misma volviendo. Sin esta guarda, deshacer un
  -- borrado le mandaría al empresario un "acaba de apuntarse" de alguien que
  -- se apuntó en junio. (El reclamo de `notified_at` viaja con la fila
  -- restaurada y lo pararía igual, pero eso es la última línea y no la
  -- primera: la guarda dice la intención y no depende de qué columnas
  -- conserve un deshacer futuro.)
  if new.created_at < now() - interval '5 minutes' then return null; end if;

  -- Se encola TAMBIÉN si la fila entra bloqueada (prueba caducada). Es la
  -- paridad exacta con lo que hacía el navegador, que tampoco miraba `locked`,
  -- y ese aviso tiene copy propio en la función: sin datos personales, diciendo
  -- cuántas candidaturas esperan. Es justo el que no se puede perder, porque es
  -- el único que cuenta que hay gente detrás de un tope.
  perform public.enqueue_interview_job(
    p_kind       => 'avisar_candidatura',
    p_payload    => jsonb_build_object('candidate_id', new.id),
    p_dedupe_key => 'aviso:' || new.id::text,
    p_company    => new.company_id);

  -- EL LATIDO VA EN SU PROPIO BLOQUE, y no es cosmético: en plpgsql un bloque
  -- con `exception` es una SUBTRANSACCIÓN, así que un fallo aquí deshace todo
  -- lo que hubiera hecho el bloque, EL ENCOLADO INCLUIDO. Lo que no se puede
  -- perder es el trabajo; el latido solo ahorra esperar al cron siguiente.
  --
  -- Y SE LATE AUNQUE EL TRIGGER DEL ANÁLISIS YA HAYA LATIDO en este mismo
  -- insert: son dos peticiones asíncronas por candidatura, y a cambio este
  -- trigger se sostiene solo. Dependiendo del latido del vecino, el día que
  -- Meridian se apague el aviso empezaría a llegar más tarde sin que nadie lo
  -- relacione con eso. Dos ticks solapados no duplican trabajo:
  -- `claim_interview_jobs` les reparte conjuntos disjuntos.
  begin
    perform public.interview_tick_kick();
  exception when others then
    raise warning 'candidates_aviso_enqueue (latido): %', sqlerrm;
  end;

  return null;
exception when others then
  -- LA CANDIDATURA ENTRA SIEMPRE. El aviso es accesorio: que la cola falle no
  -- puede dejar a alguien sin poder apuntarse a un puesto. Mismo criterio que
  -- el broadcast y el encolado del análisis, que son sus vecinos en este mismo
  -- insert.
  raise warning 'candidates_aviso_enqueue: %', sqlerrm;
  return null;
end
$$;

-- AFTER INSERT, como el broadcast y el encolado del análisis:
-- `trg_enforce_candidate_limit` es BEFORE, así que la fila ya es definitiva y
-- `locked` ya está decidido (el copy del aviso depende de él).
drop trigger if exists trg_candidates_aviso_enqueue on public.candidates;
create trigger trg_candidates_aviso_enqueue
  after insert on public.candidates
  for each row execute function public.candidates_aviso_enqueue();
