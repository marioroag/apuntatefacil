-- ==========================================================================
-- Meridian conversacional: memoria del hilo.
--
-- El hilo es PERSONAL (Meridian habla en primera persona contigo), uno por
-- persona y empresa. Se guarda en el servidor por tres motivos:
--   1) sobrevive a recargar la página,
--   2) el modelo necesita el historial para resolver "escríbeles a estos",
--   3) el límite de uso diario tiene que ser un contador que el cliente no
--      pueda reiniciar.
--
-- Las escrituras las hace la edge function con service_role (de ahí los grants
-- explícitos: en este backend service_role NO hereda permisos de tabla). El
-- cliente solo LEE su propio hilo, y puede borrarlo con meridian_clear_thread.
--
-- Retención: la edge function borra turnos de más de 90 días en cada llamada.
-- Los bloques guardan IDS de candidatura, no datos personales, así que si se
-- borra una candidatura el bloque deja de encontrarla y el TTL termina de
-- limpiar. En `text` sí puede haber nombres: por eso el TTL y el borrado manual.
-- ==========================================================================

create table public.meridian_threads (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  created_at      timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  unique (company_id, user_id)
);

create table public.meridian_turns (
  id         uuid primary key default gen_random_uuid(),
  thread_id  uuid not null references public.meridian_threads(id) on delete cascade,
  role       text not null check (role in ('user', 'meridian')),
  body       text not null default '' check (char_length(body) <= 4000),
  -- Lo que pintó la interfaz con este turno (bloque, sugerencias, propuesta).
  payload    jsonb check (payload is null or length(payload::text) <= 20000),
  created_at timestamptz not null default now()
);
create index meridian_turns_thread_created_idx
  on public.meridian_turns(thread_id, created_at);

alter table public.meridian_threads enable row level security;
alter table public.meridian_turns enable row level security;

-- Solo lectura, y solo del hilo propio dentro de una empresa a la que pertenezcas.
create policy "meridian_threads_own" on public.meridian_threads
  for select to authenticated
  using (user_id = auth.uid() and company_id in (select public.current_user_company_ids()));

create policy "meridian_turns_own" on public.meridian_turns
  for select to authenticated
  using (
    exists (
      select 1 from public.meridian_threads t
       where t.id = meridian_turns.thread_id
         and t.user_id = auth.uid()
         and t.company_id in (select public.current_user_company_ids())
    )
  );

revoke all on public.meridian_threads from anon, authenticated;
revoke all on public.meridian_turns from anon, authenticated;
grant select on public.meridian_threads to authenticated;
grant select on public.meridian_turns to authenticated;
grant select, insert, update, delete on public.meridian_threads to service_role;
grant select, insert, update, delete on public.meridian_turns to service_role;

-- Borrar la conversación. Es del usuario, así que puede tirarla cuando quiera
-- (y es la vía de ejercer el borrado sin esperar a la retención de 90 días).
create or replace function public.meridian_clear_thread(p_company uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_company is null or p_company not in (select public.current_user_company_ids()) then
    raise exception 'No autorizado';
  end if;
  delete from public.meridian_turns
   where thread_id in (
     select id from public.meridian_threads
      where user_id = auth.uid() and company_id = p_company
   );
end;
$$;
revoke all on function public.meridian_clear_thread(uuid) from public, anon;
grant execute on function public.meridian_clear_thread(uuid) to authenticated;
