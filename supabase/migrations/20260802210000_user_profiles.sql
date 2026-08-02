-- ============================================================================
-- Apúntate Fácil · perfil de la PERSONA (ago 2026)
--
-- Hasta ahora la app no sabía cómo se llama nadie: miembros, autores del chat de
-- equipo, menciones e invitaciones se identificaban por el email crudo. Con la
-- barra superior el usuario pasa a ser el ancla de la interfaz, así que necesita
-- nombre y cara.
--
-- Alcance deliberado: SOLO identidad (nombre + foto). Ni horario de trabajo ni
-- preferencias de aviso: sin notificaciones esos campos no harían nada y un
-- ajuste que no mueve nada es decorado (honestidad operativa). Entrarán con las
-- notificaciones, ya con sentido.
--
-- El perfil es de la persona, NO de la empresa: si estás en dos equipos, eres el
-- mismo en los dos. Por eso la clave es user_id y no (company_id, user_id).
-- ============================================================================

create table public.profiles (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null default '',
  -- Path dentro del bucket 'avatars' ({user_id}/{uuid}.ext). null = sin foto.
  avatar_path text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Longitud acotada: el nombre se pinta en una barra de 48px y en burbujas de chat.
alter table public.profiles
  add constraint profiles_full_name_len check (char_length(full_name) <= 80);

-- ----------------------------------------------------------------------------
-- Quién puede ver tu nombre: tus compañeros de equipo, nadie más
-- ----------------------------------------------------------------------------
-- Helper security definer, igual que current_user_company_ids(): consultar
-- memberships desde una política de otra tabla es seguro, pero lo encapsulamos
-- para no repetir el subselect y para que el plan lo cachee.
create or replace function public.current_user_peer_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select distinct m.user_id
  from public.memberships m
  where m.company_id in (select company_id from public.memberships where user_id = auth.uid())
$$;

alter table public.profiles enable row level security;

-- Lectura: el tuyo y el de quien comparte empresa contigo. Un nombre y una foto
-- son datos personales; no se exponen a anon ni a terceros.
create policy "profiles_select_peers" on public.profiles
  for select to authenticated
  using (user_id = auth.uid() or user_id in (select public.current_user_peer_ids()));

-- Escritura: solo el tuyo. Nadie renombra a nadie.
create policy "profiles_insert_self" on public.profiles
  for insert to authenticated
  with check (user_id = auth.uid());
create policy "profiles_update_self" on public.profiles
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Sin delete: el perfil muere con la cuenta (on delete cascade). Quitar la foto
-- es un update a null, no un borrado de fila.
grant select, insert, update on public.profiles to authenticated;
grant execute on function public.current_user_peer_ids() to authenticated;

create or replace function public.profiles_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_profiles_touch
  before update on public.profiles
  for each row execute function public.profiles_touch();

-- ----------------------------------------------------------------------------
-- Bucket de avatares
-- ----------------------------------------------------------------------------
-- Público, espejo de 'brand-assets': el path lleva un uuid aleatorio, así que la
-- URL no es adivinable, y evitamos firmar una URL por cada avatar en cada fila
-- de una tabla de candidatos. Los CV siguen en su bucket PRIVADO: ahí el dato es
-- de un tercero que no eligió estar aquí, y no es lo mismo.
insert into storage.buckets (id, name, public)
  values ('avatars', 'avatars', true)
  on conflict (id) do nothing;

create policy "avatars_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'avatars');

-- Escritura acotada por el prefijo del path: solo escribes bajo tu propio id.
create policy "avatars_insert_self" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and split_part(name, '/', 1) = auth.uid()::text);
create policy "avatars_update_self" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and split_part(name, '/', 1) = auth.uid()::text)
  with check (bucket_id = 'avatars' and split_part(name, '/', 1) = auth.uid()::text);
create policy "avatars_delete_self" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and split_part(name, '/', 1) = auth.uid()::text);
