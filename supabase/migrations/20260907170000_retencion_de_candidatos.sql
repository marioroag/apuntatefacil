-- ============================================================================
-- RETENCIÓN Y BORRADO DE DATOS DE CANDIDATOS (sep 2026)
--
-- Tres cosas que no existían y que la protección de datos exige:
--
--   1. ELIMINAR UN CANDIDATO ELIMINA TAMBIÉN SUS FICHEROS. `deleteCandidate`
--      borraba la fila (y las hijas en cascada) pero el CV y los documentos se
--      quedaban en el bucket para siempre. Un trigger BEFORE DELETE recoge las
--      rutas y encola un trabajo que las borra QUINCE MINUTOS después: es la
--      ventana del "Deshacer" de la interfaz, y el trabajo comprueba antes de
--      borrar que la ruta no esté otra vez en uso (una candidatura deshecha
--      vuelve con su mismo cv_path).
--
--   2. BORRADO AUTOMÁTICO DE CANDIDATURAS ANTIGUAS, si la empresa lo activa.
--      `companies.retencion_meses`: NULL es "no borrar nada solo" (el valor de
--      partida, porque la empresa es la responsable del tratamiento y el
--      producto no puede decidir por ella; y porque una ETT guarda candidatos
--      de procesos cerrados para recontactar); un número son los meses desde
--      que el PROCESO SE CIERRA. Nunca se toca a un contratado, ni a nadie de
--      un proceso abierto o pausado. Un cron diario encola un trabajo que lo
--      hace por lotes, con los ficheros primero y las filas después.
--
--   3. BARRIDO DE FICHEROS HUÉRFANOS: subidas del formulario que nunca
--      acabaron en una candidatura (el candidato cerró la pestaña, el envío
--      falló) o de un borrado anterior a esta migración. Con más de un día y
--      sin ninguna fila que los referencie, se van.
--
-- Todo lo que toca el bucket lo hace el worker (interview-tick) con el cliente
-- de service_role: desde SQL se pueden borrar filas de storage.objects, pero
-- los bytes se quedan en el almacén. Aquí viven las decisiones (qué se borra
-- y cuándo); allí, el borrado en sí.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Dos tipos de trabajo más. La lista es el vocabulario ENTERO (copiada de
--    la última migración que la tocó, 20260907130000_aviso_al_llegar.sql); lo vigila
--    src/lib/tiposDeTrabajo.test.ts.
-- ----------------------------------------------------------------------------
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
  -- Borrar del bucket las rutas de una candidatura eliminada, pasada la
  -- ventana de deshacer. El payload lleva las rutas.
  'purgar_ficheros',
  -- La purga diaria de candidaturas antiguas y de ficheros huérfanos.
  'purgar_candidatos'
));

-- ----------------------------------------------------------------------------
-- 2) La política de retención de cada empresa
-- ----------------------------------------------------------------------------
alter table public.companies
  add column if not exists retencion_meses int
    check (retencion_meses is null or retencion_meses between 1 and 60);
grant update (retencion_meses) on public.companies to authenticated;
grant select on public.companies to service_role;

create or replace function public.my_companies()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id,
    'name', c.name,
    'accent', c.accent,
    'plan', c.plan,
    'subscription_status', c.subscription_status,
    'billing_interval', c.billing_interval,
    'cancel_at_period_end', c.cancel_at_period_end,
    'onboarding_done_at', c.onboarding_done_at,
    'downgrade_reconcile_at', c.downgrade_reconcile_at,
    'meridian_auto', c.meridian_auto,
    'trial_ends_at', c.trial_ends_at,
    'paid_processes', c.paid_processes,
    'descripcion', c.descripcion,
    'retencion_meses', c.retencion_meses,
    'role', m.role
  ) order by c.created_at asc), '[]'::jsonb)
  from public.memberships m
  join public.companies c on c.id = m.company_id
  where m.user_id = auth.uid();
$$;
revoke all on function public.my_companies() from public, anon;
grant execute on function public.my_companies() to authenticated;

-- ----------------------------------------------------------------------------
-- 3) Eliminar un candidato encola el borrado de sus ficheros
-- ----------------------------------------------------------------------------
-- BEFORE y no AFTER: las filas de candidate_documents se borran en cascada con
-- la del candidato, y hay que leerlas antes de que se vayan. La purga en lote
-- (más abajo) borra los ficheros ELLA MISMA antes de las filas y pone la
-- bandera para que este trigger no encole por segunda vez.
create or replace function public.candidates_purgar_ficheros_enqueue()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_rutas text[];
begin
  if current_setting('apuntatefacil.purga_en_curso', true) = 'on' then return old; end if;
  select array_remove(array_agg(r), null) into v_rutas
    from (
      select old.cv_path as r
      union all
      select d.path from public.candidate_documents d where d.candidate_id = old.id
    ) x
   where r is not null and r <> '' and r not like '/%';   -- los de la demo son públicos, no del bucket
  if v_rutas is null or array_length(v_rutas, 1) = 0 then return old; end if;
  perform public.enqueue_interview_job(
    p_kind       => 'purgar_ficheros',
    p_payload    => jsonb_build_object('rutas', to_jsonb(v_rutas), 'candidate_id', old.id),
    p_run_at     => now() + interval '15 minutes',
    p_dedupe_key => 'ficheros:' || old.id::text,
    p_company    => old.company_id);
  return old;
exception when others then
  -- Que no se pueda encolar el borrado del fichero no puede impedir borrar a
  -- la persona: el barrido de huérfanos lo recoge después.
  raise warning 'candidates_purgar_ficheros_enqueue: %', sqlerrm;
  return old;
end
$$;
drop trigger if exists trg_candidates_purgar_ficheros on public.candidates;
create trigger trg_candidates_purgar_ficheros
  before delete on public.candidates
  for each row execute function public.candidates_purgar_ficheros_enqueue();

-- Qué rutas de una lista siguen referenciadas por alguien (una candidatura
-- deshecha vuelve con su cv_path): el worker no borra esas.
create or replace function public.rutas_en_uso(p_rutas text[])
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(distinct r), '{}'::text[])
    from unnest(p_rutas) r
   where exists (select 1 from public.candidates c where c.cv_path = r)
      or exists (select 1 from public.candidate_documents d where d.path = r);
$$;
revoke all on function public.rutas_en_uso(text[]) from public, anon, authenticated;
grant execute on function public.rutas_en_uso(text[]) to service_role;

-- ----------------------------------------------------------------------------
-- 4) La purga de candidaturas antiguas
-- ----------------------------------------------------------------------------
-- Quién toca: empresa con retención puesta, proceso CERRADO hace más de esos
-- meses (closed_at; los cerrados antes de que existiera la columna no tienen
-- fecha y no se tocan: sin fecha no hay plazo), y nunca un contratado.
create or replace function public.purga_candidatos_pendientes(p_limit int default 100)
returns table (id uuid, company_id uuid, rutas text[])
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.company_id,
         array_remove(array_agg(x.r), null) as rutas
    from public.candidates c
    join public.companies co on co.id = c.company_id
    join public.campaigns ca on ca.id = c.campaign_id
    left join lateral (
      select c.cv_path as r
      union all
      select d.path from public.candidate_documents d where d.candidate_id = c.id
    ) x on x.r is not null and x.r <> '' and x.r not like '/%'
   where co.retencion_meses is not null
     and ca.status = 'cerrada'
     and ca.closed_at is not null
     and ca.closed_at < now() - (co.retencion_meses || ' months')::interval
     and c.status <> 'contratado'
   group by c.id, c.company_id
   order by c.created_at
   limit greatest(1, least(p_limit, 500));
$$;
revoke all on function public.purga_candidatos_pendientes(int) from public, anon, authenticated;
grant execute on function public.purga_candidatos_pendientes(int) to service_role;

-- Borra las filas (los ficheros ya los ha quitado el worker) y lo deja en el
-- log de auditoría, una línea por empresa. Vuelve a comprobar el criterio: un
-- proceso reabierto entre la lista y el borrado se queda con su gente.
create or replace function public.purga_candidatos_borrar(p_ids uuid[])
returns int
language plpgsql
security definer
set search_path = public
as $$
declare v_total int := 0; v_fila record;
begin
  perform set_config('apuntatefacil.purga_en_curso', 'on', true);
  for v_fila in
    select c.company_id, array_agg(c.id) as ids
      from public.candidates c
      join public.companies co on co.id = c.company_id
      join public.campaigns ca on ca.id = c.campaign_id
     where c.id = any(p_ids)
       and co.retencion_meses is not null
       and ca.status = 'cerrada'
       and ca.closed_at is not null
       and ca.closed_at < now() - (co.retencion_meses || ' months')::interval
       and c.status <> 'contratado'
     group by c.company_id
  loop
    delete from public.candidates where id = any(v_fila.ids);
    v_total := v_total + coalesce(array_length(v_fila.ids, 1), 0);
    insert into public.audit_log(actor_user_id, company_id, action, details)
      values (null, v_fila.company_id, 'purge candidates',
              jsonb_build_object('n', array_length(v_fila.ids, 1), 'motivo', 'retencion'));
  end loop;
  perform set_config('apuntatefacil.purga_en_curso', 'off', true);
  return v_total;
end
$$;
revoke all on function public.purga_candidatos_borrar(uuid[]) from public, anon, authenticated;
grant execute on function public.purga_candidatos_borrar(uuid[]) to service_role;

-- Ficheros del bucket cvs que no referencia ninguna fila, con más de un día.
create or replace function public.documentos_huerfanos(p_limit int default 500)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(o.name), '{}'::text[])
    from (
      select o.name
        from storage.objects o
       where o.bucket_id = 'cvs'
         and o.created_at < now() - interval '1 day'
         and not exists (select 1 from public.candidates c where c.cv_path = o.name)
         and not exists (select 1 from public.candidate_documents d where d.path = o.name)
       order by o.created_at
       limit greatest(1, least(p_limit, 1000))
    ) o;
$$;
revoke all on function public.documentos_huerfanos(int) from public, anon, authenticated;
grant execute on function public.documentos_huerfanos(int) to service_role;

-- ----------------------------------------------------------------------------
-- 5) Todos los días, de madrugada, un trabajo de purga
-- ----------------------------------------------------------------------------
-- El dedupe por día hace que un cron que se dispare dos veces no encole dos.
-- Envuelto como el latido: en una máquina sin pg_cron esto avisa y sigue.
do $$
begin
  perform cron.unschedule('purga-candidatos');
exception when others then null;
end $$;
do $$
begin
  perform cron.schedule('purga-candidatos', '10 4 * * *',
    $cron$select public.enqueue_interview_job('purgar_candidatos', '{}'::jsonb, now(), 'purga:' || to_char(now(), 'YYYY-MM-DD'))$cron$);
exception when others then
  raise warning 'pg_cron no disponible, la purga diaria queda sin programar: %', sqlerrm;
end $$;

-- ----------------------------------------------------------------------------
-- 6) El candidato tiene que saber el plazo (art. 13 RGPD): el formulario lo
--    pinta junto al consentimiento, así que la página pública lo recibe.
-- ----------------------------------------------------------------------------
create or replace function public.get_public_campaign(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', c.id,
    'slug', c.slug,
    'title', c.title,
    'status', c.status,
    'fields', c.fields,
    'branding', c.branding,
    'anuncio', c.anuncio,
    'location', c.location,
    'company_name', coalesce(b.name, co.name),
    'company_description', co.descripcion,
    'retencion_meses', co.retencion_meses,
    'logo_path', b.logo_path,
    'banner_path', b.banner_path,
    'others', coalesce((
      select jsonb_agg(jsonb_build_object(
        'slug', o.slug,
        'title', o.title,
        'location', o.location,
        'brand_label', coalesce(ob.name, co.name),
        'banner_path', ob.banner_path
      ) order by o.created_at desc)
      from (
        select o2.* from public.campaigns o2
        where o2.company_id = c.company_id
          and o2.id <> c.id
          and o2.status = 'activa'
        order by o2.created_at desc
        limit 5
      ) o
      left join public.brands ob on ob.id = o.brand_id
    ), '[]'::jsonb)
  )
  from public.campaigns c
  join public.companies co on co.id = c.company_id
  left join public.brands b on b.id = c.brand_id
  where c.id = coalesce(
    (select id from public.campaigns where slug = p_slug),
    (select campaign_id from public.campaign_slug_aliases where alias = p_slug)
  );
$$;
revoke all on function public.get_public_campaign(text) from public;
grant execute on function public.get_public_campaign(text) to anon, authenticated;
