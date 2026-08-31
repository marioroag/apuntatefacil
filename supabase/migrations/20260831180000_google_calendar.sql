-- ============================================================================
-- Apúntate Fácil: conexión con Google Calendar
-- ----------------------------------------------------------------------------
-- Dos direcciones, y las dos las anticipaba el esquema desde el primer día:
--
--   * LEER: el calendario externo solo RESTA. La disponibilidad sigue siendo
--     NUESTRA (`interview_hosts` + `interview_availability`), así que todo el
--     producto funciona sin que nadie conecte nada, que era la condición de
--     partida escrita en `20260801160000_interview_availability.sql`.
--   * ESCRIBIR: la entrevista aparece en el calendario del anfitrión.
--     `interviews` ya nació con `calendar_provider`, `calendar_event_id`,
--     `calendar_sync_state` y `calendar_synced_at`, y cancelar ya deja la fila
--     en 'borrando' y reprogramar en 'pendiente'. Lo que faltaba no era el
--     andamio: era quién tiene permiso y quién ejecuta.
--
-- LA CONEXIÓN ES DE LA PERSONA, NO DE LA EMPRESA, y por eso la clave es
-- (empresa, persona), la misma que `interview_hosts`: en una ETT el reclutador
-- invita pero entrevista el encargado de la sede, y cada uno tiene su
-- calendario. Que lleve la empresa dentro de la clave es además lo que hace que
-- al salir del equipo se caiga la conexión con él.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) La tabla, sin un solo secreto dentro
-- ----------------------------------------------------------------------------
-- EL REFRESH TOKEN NO VIVE AQUÍ. Es una llave permanente al calendario de una
-- persona, así que va al VAULT (el mismo que ya guarda el secreto del latido) y
-- la fila solo se queda con su identificador. La diferencia no es teórica: un
-- volcado de esta tabla, o cualquiera que llegue a leerla, no se lleva nada con
-- lo que entrar en el calendario de nadie.
--
-- Y NO SE GUARDA EL ACCESS TOKEN. Dura una hora, así que cachearlo solo compra
-- una llamada HTTP por operación (y las nuestras son una por trabajo de la cola
-- o una por consulta de huecos) a cambio de tener una credencial viva en una
-- columna y toda la lógica de caducidad que eso arrastra. Se pide cada vez.

create table public.calendar_connections (
  company_id        uuid not null references public.companies(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,
  provider          text not null default 'google' check (provider in ('google')),
  -- El identificador estable de la cuenta de Google. El correo se puede
  -- cambiar; esto no. Sirve para saber que quien reconecta es la misma persona.
  google_sub        text not null,
  -- Solo para ENSEÑARLO en Ajustes: "conectado con marta@laempresa.es". Sin
  -- esto, la pantalla no puede decir con qué cuenta está hablando, que es lo
  -- primero que se mira cuando algo no cuadra.
  account_email     text not null default '',
  calendar_id       text not null default 'primary',
  -- Vault. Ni el token ni nada que se le parezca.
  refresh_secret_id uuid not null,
  scopes            text[] not null default '{}',
  connected_at      timestamptz not null default now(),
  -- Lo último que falló al hablar con Google, para que Ajustes pueda decirlo.
  -- Un permiso retirado desde la cuenta de Google no nos avisa: nos enteramos
  -- al fallar, y si no se escribe en algún sitio, la persona solo ve que sus
  -- entrevistas dejaron de aparecer sin saber por qué.
  last_error        text check (last_error is null or char_length(last_error) <= 300),
  last_error_at     timestamptz,
  primary key (company_id, user_id)
);

-- ----------------------------------------------------------------------------
-- 2) RLS: aquí no entra `authenticated`, ni para leer
-- ----------------------------------------------------------------------------
-- No hay policy para `authenticated` A PROPÓSITO. Aunque la tabla no guarde el
-- token, deja ver con qué cuenta de Google trabaja cada compañero, y eso no
-- hace falta para nada. Lo que la interfaz necesita saber (¿estoy conectado?,
-- ¿con qué cuenta?, ¿falló algo?) sale de un RPC que devuelve eso y nada más.
-- Es la misma forma que `interview_host_config`: la pantalla no lee la tabla,
-- pide la respuesta.

alter table public.calendar_connections enable row level security;

revoke all on public.calendar_connections from anon, authenticated, public;
-- service_role NO hereda permisos de tabla en este backend: hay que dárselos.
grant select, insert, update, delete on public.calendar_connections to service_role;

-- ----------------------------------------------------------------------------
-- 3) Lo que la interfaz puede preguntar
-- ----------------------------------------------------------------------------
-- Solo por uno mismo. Con qué cuenta ha conectado otro no es asunto de nadie, y
-- para saber si el anfitrión que eliges tiene calendario está la función de
-- abajo, que devuelve una lista de ids y ni una palabra más.

create or replace function public.calendar_connection_status(p_company uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v public.calendar_connections;
begin
  if not exists (
    select 1 from public.memberships m
     where m.user_id = auth.uid() and m.company_id = p_company
  ) then raise exception 'No autorizado' using errcode = '42501'; end if;

  select * into v from public.calendar_connections
   where company_id = p_company and user_id = auth.uid();

  if not found then return jsonb_build_object('conectado', false); end if;

  return jsonb_build_object(
    'conectado', true,
    'proveedor', v.provider,
    'cuenta', v.account_email,
    'desde', v.connected_at,
    'error', v.last_error,
    'errorEn', v.last_error_at);
end
$$;
revoke all on function public.calendar_connection_status(uuid) from public, anon;
grant execute on function public.calendar_connection_status(uuid) to authenticated;

-- Quién del equipo tiene calendario conectado. Ids y nada más: lo usa el
-- diálogo de agendar para saber si puede preguntar por los huecos ocupados del
-- anfitrión que has elegido. Sin esto tendría que preguntar siempre y tragarse
-- un "no hay conexión" en cada apertura.
create or replace function public.calendar_connected_hosts(p_company uuid)
returns table (user_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select c.user_id
    from public.calendar_connections c
   where c.company_id = p_company
     and exists (select 1 from public.memberships m
                  where m.user_id = auth.uid() and m.company_id = p_company)
$$;
revoke all on function public.calendar_connected_hosts(uuid) from public, anon;
grant execute on function public.calendar_connected_hosts(uuid) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 4) Lo que solo puede hacer el servidor
-- ----------------------------------------------------------------------------
-- Guardar, leer y borrar el secreto. Las tres van por RPC y no por la tabla,
-- porque el vault no se puede tocar desde PostgREST: vive en su propio esquema,
-- que no está expuesto. Así el único camino al token es una función con nombre,
-- con su grant, y auditable.

create or replace function public.calendar_connection_save(
  p_company uuid,
  p_user    uuid,
  p_sub     text,
  p_email   text,
  p_refresh text,
  p_scopes  text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id   uuid;
  v_name text := format('google_calendar_%s_%s', p_company, p_user);
begin
  if not exists (
    select 1 from public.memberships m where m.user_id = p_user and m.company_id = p_company
  ) then raise exception 'No es del equipo' using errcode = '42501'; end if;
  if p_refresh is null or btrim(p_refresh) = '' then
    raise exception 'Sin refresh token';
  end if;

  select refresh_secret_id into v_id from public.calendar_connections
   where company_id = p_company and user_id = p_user;

  if v_id is null then
    -- El nombre es único en el vault. Reconectar después de una desconexión
    -- limpia no choca (se borró), pero una fila huérfana sí, así que se limpia
    -- lo que hubiera con ese nombre antes de crear.
    delete from vault.secrets where name = v_name;
    v_id := vault.create_secret(p_refresh, v_name, 'Refresh token de Google Calendar');
  else
    perform vault.update_secret(v_id, p_refresh);
  end if;

  insert into public.calendar_connections
    (company_id, user_id, google_sub, account_email, refresh_secret_id, scopes,
     connected_at, last_error, last_error_at)
  values
    (p_company, p_user, p_sub, coalesce(p_email, ''), v_id, coalesce(p_scopes, '{}'),
     now(), null, null)
  on conflict (company_id, user_id) do update set
    google_sub        = excluded.google_sub,
    account_email     = excluded.account_email,
    refresh_secret_id = excluded.refresh_secret_id,
    scopes            = excluded.scopes,
    connected_at      = now(),
    -- Reconectar limpia el error: es exactamente lo que se acaba de arreglar.
    last_error        = null,
    last_error_at     = null;
end
$$;
revoke all on function public.calendar_connection_save(uuid, uuid, text, text, text, text[])
  from public, anon, authenticated;
grant execute on function public.calendar_connection_save(uuid, uuid, text, text, text, text[])
  to service_role;

-- El único camino al token, y solo para el servidor.
create or replace function public.calendar_connection_secret(p_company uuid, p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v public.calendar_connections; v_token text;
begin
  select * into v from public.calendar_connections
   where company_id = p_company and user_id = p_user;
  if not found then return null; end if;

  select decrypted_secret into v_token from vault.decrypted_secrets where id = v.refresh_secret_id;
  if v_token is null then return null; end if;

  return jsonb_build_object(
    'refreshToken', v_token,
    'calendarId', v.calendar_id,
    'cuenta', v.account_email,
    'scopes', to_jsonb(v.scopes));
end
$$;
revoke all on function public.calendar_connection_secret(uuid, uuid) from public, anon, authenticated;
grant execute on function public.calendar_connection_secret(uuid, uuid) to service_role;

create or replace function public.calendar_connection_delete(p_company uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  select refresh_secret_id into v_id from public.calendar_connections
   where company_id = p_company and user_id = p_user;
  delete from public.calendar_connections
   where company_id = p_company and user_id = p_user;
  if v_id is not null then delete from vault.secrets where id = v_id; end if;
end
$$;
revoke all on function public.calendar_connection_delete(uuid, uuid) from public, anon, authenticated;
grant execute on function public.calendar_connection_delete(uuid, uuid) to service_role;

-- Anotar que Google dijo que no. Lo escribe quien falla, y lo lee Ajustes.
create or replace function public.calendar_connection_error(p_company uuid, p_user uuid, p_error text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.calendar_connections
     set last_error = left(coalesce(p_error, ''), 300), last_error_at = now()
   where company_id = p_company and user_id = p_user
$$;
revoke all on function public.calendar_connection_error(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.calendar_connection_error(uuid, uuid, text) to service_role;

-- ----------------------------------------------------------------------------
-- 5) El `state` del consentimiento: de un solo uso y con caducidad
-- ----------------------------------------------------------------------------
-- Google nos devuelve al callback con un `state` que le dimos, y ese callback
-- NO puede exigir sesión (viene de Google, no del navegador con nuestro JWT).
-- O sea que el `state` es lo único que dice de quién es esta conexión: si se
-- pudiera reutilizar o falsificar, se podría colgar el calendario de una
-- persona de la empresa de otra.
--
-- Se resuelve con una fila y no con una firma. Firmar (HMAC) demuestra que el
-- valor lo emitimos nosotros, pero NO impide usarlo dos veces ni permite
-- caducarlo antes de tiempo, y encima cuesta un secreto más que mantener. Una
-- fila que se reclama de forma atómica hace las tres cosas.

create table public.calendar_oauth_states (
  nonce       text primary key check (char_length(nonce) between 20 and 100),
  company_id  uuid not null references public.companies(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '15 minutes',
  used_at     timestamptz
);
alter table public.calendar_oauth_states enable row level security;
revoke all on public.calendar_oauth_states from anon, authenticated, public;
grant select, insert, update, delete on public.calendar_oauth_states to service_role;

create or replace function public.calendar_oauth_state_new(
  p_company uuid, p_user uuid, p_nonce text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.memberships m where m.user_id = p_user and m.company_id = p_company
  ) then raise exception 'No es del equipo' using errcode = '42501'; end if;

  -- La barrida va aquí y no en un cron: son cuatro filas y este es el único
  -- sitio por el que la tabla crece.
  delete from public.calendar_oauth_states where expires_at < now() - interval '1 day';

  insert into public.calendar_oauth_states (nonce, company_id, user_id)
  values (p_nonce, p_company, p_user);
end
$$;
revoke all on function public.calendar_oauth_state_new(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.calendar_oauth_state_new(uuid, uuid, text) to service_role;

-- Reclamar es un UPDATE con el filtro dentro, no un SELECT y luego un UPDATE:
-- entre los dos cabe una segunda llamada con el mismo `state`.
create or replace function public.calendar_oauth_state_claim(p_nonce text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v public.calendar_oauth_states;
begin
  update public.calendar_oauth_states
     set used_at = now()
   where nonce = p_nonce and used_at is null and expires_at > now()
  returning * into v;
  if not found then return null; end if;
  return jsonb_build_object('companyId', v.company_id, 'userId', v.user_id);
end
$$;
revoke all on function public.calendar_oauth_state_claim(text) from public, anon, authenticated;
grant execute on function public.calendar_oauth_state_claim(text) to service_role;
