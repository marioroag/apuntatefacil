-- ============================================================================
-- EL AVISO DE FIN DE PRUEBA, POR CORREO (Mario, 8-sep-2026: "invitándolos a
-- volver").
--
-- Hasta hoy nadie avisaba: el cliente descubría que la prueba había terminado
-- porque las candidaturas nuevas aparecían en espera. Es justo el momento en
-- que decide pagar o irse, y merece dos correos: uno TRES DÍAS ANTES ("te
-- quedan 3 días") y otro AL TERMINAR ("tu prueba ha terminado, las
-- candidaturas siguen llegando y quedan guardadas; actívalo y las ves todas").
--
-- Va por la cola de siempre (interview_jobs + interview-tick), como el aviso
-- de candidatura: un trabajo diario (pg_cron, 07:00 UTC = 09:00 en Madrid en
-- verano) mira qué pruebas terminan en tres días y cuáles acaban de terminar,
-- y encola un `avisar_prueba` por cada una. La función notify-trial es la
-- aduana: comprueba que la empresa SIGUE en prueba (quien ya paga no recibe
-- nada), reclama el aviso de forma atómica (un correo por tipo y empresa) y
-- suelta el reclamo si Resend no responde, igual que notify-new-candidate.
-- ============================================================================

alter table public.companies
  add column if not exists trial_aviso_previo_at timestamptz,
  add column if not exists trial_aviso_fin_at timestamptz;

-- Los escribe SOLO la función de confianza (el reclamo del aviso).
grant update (trial_aviso_previo_at, trial_aviso_fin_at) on public.companies to service_role;

-- El tipo nuevo, al final de la lista ENTERA (ver tiposDeTrabajo.test.ts).
alter table public.interview_jobs drop constraint if exists interview_jobs_kind_check;
alter table public.interview_jobs add constraint interview_jobs_kind_check check (kind in (
  'recordatorio_24h',
  'recordatorio_2h',
  'marcar_realizada',
  'avisar_intervencion',
  'recordatorio_vispera',
  'acuse_asistencia',
  'acuse_interes',
  'enviar_invitacion',
  'enviar_horarios',
  'enviar_horas',
  'reofertar_horarios',
  'enviar_confirmacion',
  'enviar_despedida',
  'enviar_texto',
  'clasificar_texto',
  'conversar',
  'responder_duda',
  'mensaje_no_leible',
  'sincronizar_calendario',
  'analizar_candidato',
  'avisar_candidatura',
  'purgar_ficheros',
  'purgar_candidatos',
  'copiar_ficheros',
  -- El correo de fin de prueba: payload {company_id, tipo: 'previo' | 'fin'}.
  'avisar_prueba'
));

-- Qué pruebas hay que avisar HOY. Se encola con clave de deduplicación por
-- empresa y tipo: el cron corre cada día y lo que ya está en cola o ya se
-- avisó (marca en la empresa) no se repite. El de FIN solo mira pruebas
-- terminadas en los últimos 14 días: una prueba que caducó hace meses sin que
-- nadie la mirara no se resucita con un correo de golpe.
create or replace function public.encolar_avisos_prueba()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer := 0;
  r record;
begin
  for r in
    select co.id
      from public.companies co
     where co.plan = 'trial'
       and co.trial_campaign_id is not null
       and co.trial_ends_at > now()
       and co.trial_ends_at <= now() + interval '3 days'
       and co.trial_aviso_previo_at is null
  loop
    perform public.enqueue_interview_job(
      'avisar_prueba',
      jsonb_build_object('company_id', r.id, 'tipo', 'previo'),
      now(),
      'prueba-previo:' || r.id,
      r.id
    );
    n := n + 1;
  end loop;

  for r in
    select co.id
      from public.companies co
     where co.plan = 'trial'
       and co.trial_campaign_id is not null
       and co.trial_ends_at <= now()
       and co.trial_ends_at > now() - interval '14 days'
       and co.trial_aviso_fin_at is null
  loop
    perform public.enqueue_interview_job(
      'avisar_prueba',
      jsonb_build_object('company_id', r.id, 'tipo', 'fin'),
      now(),
      'prueba-fin:' || r.id,
      r.id
    );
    n := n + 1;
  end loop;

  if n > 0 then
    begin
      perform public.interview_tick_kick();
    exception when others then
      raise warning 'encolar_avisos_prueba (latido): %', sqlerrm;
    end;
  end if;
  return n;
end
$$;

revoke all on function public.encolar_avisos_prueba() from public;
grant execute on function public.encolar_avisos_prueba() to service_role;

do $$
begin
  perform cron.unschedule('aviso-prueba') where exists (select 1 from cron.job where jobname = 'aviso-prueba');
  perform cron.schedule('aviso-prueba', '0 7 * * *', $cron$select public.encolar_avisos_prueba()$cron$);
exception when others then
  raise warning 'pg_cron no disponible, el aviso de fin de prueba queda sin programar: %', sqlerrm;
end $$;
