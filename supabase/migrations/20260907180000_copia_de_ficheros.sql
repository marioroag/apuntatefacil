-- ============================================================================
-- COPIA DIARIA DE LOS FICHEROS (sep 2026)
--
-- Las copias de seguridad de Supabase son de la BASE DE DATOS. Los ficheros
-- (CV y documentos de candidatos, logos y fotos de marca, fotos del equipo)
-- viven en el almacén de objetos, que resiste averías pero no tiene
-- versionado: un borrado por error no tiene vuelta atrás. Esto le da una.
--
-- Un bucket privado `copias`, sin ninguna política para anon ni authenticated
-- (solo llega el servidor con service_role), y un trabajo diario en la cola:
--   1. copia a `copias/<bucket>/<ruta>` todo lo que no tenga copia o haya
--      cambiado desde la última (por `updated_at`);
--   2. lo que ya no exista en el origen lo MUEVE a `copias/papelera/...`,
--      que es la vuelta atrás: treinta días para darse cuenta;
--   3. lo que lleve más de treinta días en la papelera se borra de verdad.
-- Es también lo que hace cumplir el plazo que declara la política de
-- privacidad para lo suprimido en las copias.
--
-- La base decide qué copiar y qué tirar (estas funciones); los bytes los mueve
-- el worker (interview-tick), que es el único que puede hablar con el bucket.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit)
  values ('copias', 'copias', false, 10485760)
  on conflict (id) do nothing;

-- Un tipo de trabajo más. Lista ENTERA copiada de la última migración que la
-- tocó (20260907170000_retencion_de_candidatos.sql); lo vigila src/lib/tiposDeTrabajo.test.ts.
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
  -- La copia diaria de los ficheros de los buckets al bucket `copias`.
  'copiar_ficheros'
));

/** Los buckets que se copian. La papelera y el propio `copias` no. */
create or replace function public.copia_buckets_origen()
returns text[]
language sql
immutable
as $$ select array['cvs', 'brand-assets', 'avatars']::text[] $$;

-- Qué falta por copiar: sin copia, o con el origen más nuevo que la copia.
create or replace function public.copia_pendientes(p_limit int default 200)
returns table (bucket_id text, name text, bytes bigint)
language sql
stable
security definer
set search_path = public
as $$
  select o.bucket_id, o.name, coalesce((o.metadata->>'size')::bigint, 0)
    from storage.objects o
    left join storage.objects c
      on c.bucket_id = 'copias' and c.name = o.bucket_id || '/' || o.name
   where o.bucket_id = any(public.copia_buckets_origen())
     and o.name not like '%/'                  -- las "carpetas" vacías no son ficheros
     and (c.id is null or c.updated_at < o.updated_at)
   order by o.updated_at
   limit greatest(1, least(p_limit, 1000));
$$;
revoke all on function public.copia_pendientes(int) from public, anon, authenticated;
grant execute on function public.copia_pendientes(int) to service_role;

-- Copias cuyo original ya no existe: van a la papelera.
create or replace function public.copias_sin_origen(p_limit int default 500)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(c.name), '{}'::text[])
    from (
      select c.name
        from storage.objects c
       where c.bucket_id = 'copias'
         and c.name not like 'papelera/%'
         and split_part(c.name, '/', 1) = any(public.copia_buckets_origen())
         and not exists (
           select 1 from storage.objects o
            where o.bucket_id = split_part(c.name, '/', 1)
              and o.name = substr(c.name, length(split_part(c.name, '/', 1)) + 2)
         )
       order by c.updated_at
       limit greatest(1, least(p_limit, 1000))
    ) c;
$$;
revoke all on function public.copias_sin_origen(int) from public, anon, authenticated;
grant execute on function public.copias_sin_origen(int) to service_role;

-- Lo que lleva más de treinta días en la papelera.
create or replace function public.copias_caducadas(p_limit int default 500)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(c.name), '{}'::text[])
    from (
      select c.name
        from storage.objects c
       where c.bucket_id = 'copias'
         and c.name like 'papelera/%'
         and c.updated_at < now() - interval '30 days'
       order by c.updated_at
       limit greatest(1, least(p_limit, 1000))
    ) c;
$$;
revoke all on function public.copias_caducadas(int) from public, anon, authenticated;
grant execute on function public.copias_caducadas(int) to service_role;

-- Cada madrugada, antes de la copia de la base (que Supabase hace hacia las
-- 04:00 UTC), para que la base y la copia de ficheros vayan a la par.
do $$
begin
  perform cron.unschedule('copia-ficheros');
exception when others then null;
end $$;
do $$
begin
  perform cron.schedule('copia-ficheros', '30 3 * * *',
    $cron$select public.enqueue_interview_job('copiar_ficheros', '{}'::jsonb, now(), 'copia:' || to_char(now(), 'YYYY-MM-DD'))$cron$);
exception when others then
  raise warning 'pg_cron no disponible, la copia diaria queda sin programar: %', sqlerrm;
end $$;
