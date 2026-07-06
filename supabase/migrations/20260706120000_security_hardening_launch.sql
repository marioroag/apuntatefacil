-- ============================================================================
-- Apúntate Fácil · endurecimiento de seguridad previo al lanzamiento
-- Auditoría completa del stack antes de abrir a clientes de pago. El backend ya
-- era sólido (RLS en todas las tablas, search_path fijado, anon sin acceso directo,
-- triggers de integridad). Esto cierra abuso de endpoints ANÓNIMos de cara a
-- Internet y añade defensa en profundidad. Ver el plan de lanzamiento.
--   3) Límite de tamaño en payloads públicos (anti DoS/relleno de BD).
--   5) Bucket cvs: límite de tamaño en servidor + ruta acotada (anti-flooding).
--   6) notify-new-candidate idempotente (columna guardia notified_at).
--   8) Allowlist de staff de soporte -> tabla gestionable (no hardcode en SQL).
--   9) Log de auditoría de operaciones sensibles (membresías e invitaciones).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 3) LÍMITE DE TAMAÑO en lo que entra por endpoints anónimos.
-- CHECK constraints = red de seguridad independiente de qué función inserta
-- (submit_application, submit_support_request, inbound de email o INSERT directo).
-- ---------------------------------------------------------------------------
alter table public.candidates
  add constraint candidates_answers_size check (length(answers::text) <= 200000);
alter table public.candidates
  add constraint candidates_notes_size check (char_length(notes) <= 20000);
alter table public.support_tickets
  add constraint support_tickets_message_len check (char_length(message) <= 10000);
alter table public.support_messages
  add constraint support_messages_body_len check (char_length(body) <= 10000);

-- Mensaje amable en los RPCs públicos (antes de tocar la BD). Se reescriben desde
-- su definición VIGENTE (submit_application vive en 20260615130000, con auto-pausa
-- y tope de plan; submit_support_request en 20260624120000) SIN perder esa lógica,
-- solo añadiendo la validación de tamaño al principio.

create or replace function public.submit_application(
  p_slug text,
  p_answers jsonb,
  p_source text default 'enlace',
  p_cv_path text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  cmp public.campaigns;
  cand_id uuid;
  v_plan text;
  v_limit integer;
  v_count integer;
begin
  -- Tope de tamaño: un formulario real no llega ni de lejos a 200 KB de respuestas.
  if length(coalesce(p_answers, '{}'::jsonb)::text) > 200000 then
    raise exception 'Respuestas demasiado largas';
  end if;
  select * into cmp from public.campaigns where slug = p_slug;
  if not found then
    raise exception 'Puesto no encontrado';
  end if;
  if cmp.status <> 'activa' then
    raise exception 'Este puesto ya no acepta candidaturas';
  end if;
  insert into public.candidates(campaign_id, company_id, answers, source, cv_path, status)
    values (cmp.id, cmp.company_id, coalesce(p_answers, '{}'::jsonb),
            coalesce(p_source, 'enlace'), p_cv_path, 'nuevo')
    returning id into cand_id;
  -- ¿alcanzado el tope del plan con este candidato? entonces pausamos el puesto.
  select plan into v_plan from public.companies where id = cmp.company_id;
  v_limit := public.plan_candidate_limit(v_plan);
  select count(*) into v_count from public.candidates where company_id = cmp.company_id;
  if v_count >= v_limit then
    update public.campaigns set status = 'pausada' where id = cmp.id and status = 'activa';
  end if;
  return cand_id;
end
$$;
grant execute on function public.submit_application(text, jsonb, text, text) to anon, authenticated;

create or replace function public.submit_support_request(
  p_email text,
  p_message text,
  p_name text default null,
  p_source text default 'app',
  p_page text default null,
  p_company_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_company uuid;
  v_plan text;
  v_ticket uuid;
  v_email text := nullif(trim(p_email), '');
  v_message text := nullif(trim(p_message), '');
  v_source text := coalesce(nullif(trim(p_source), ''), 'app');
begin
  if v_message is null then
    raise exception 'El mensaje no puede estar vacío';
  end if;
  if char_length(v_message) > 10000 then
    raise exception 'El mensaje es demasiado largo (máximo 10000 caracteres)';
  end if;
  if v_email is null or position('@' in v_email) = 0 then
    raise exception 'Hace falta un email válido';
  end if;
  if v_source not in ('app', 'landing') then
    v_source := 'app';
  end if;

  -- Empresa + plan: solo si está autenticado y es miembro de la empresa indicada.
  if v_user is not null and p_company_id is not null
     and p_company_id in (select public.current_user_company_ids()) then
    v_company := p_company_id;
    select plan into v_plan from public.companies where id = v_company;
  end if;

  insert into public.support_tickets(company_id, user_id, email, name, message, source, plan, page)
    values (v_company, v_user, v_email, nullif(trim(p_name), ''), v_message,
            v_source, v_plan, nullif(trim(p_page), ''))
    returning id into v_ticket;
  return v_ticket;
end;
$$;
grant execute on function public.submit_support_request(text, text, text, text, text, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5) BUCKET cvs: forzar límite de tamaño en SERVIDOR (hoy solo se validaba en
-- cliente) y acotar la ruta al patrón "<slug>/<uuid>.<ext>". No es fuga de datos
-- (la lectura ya está scopeada por fila del candidato y el trigger ata el cv_path
-- al slug del puesto), sino evitar que un anónimo inunde el bucket con basura.
-- Nota: NO se restringe allowed_mime_types a propósito: el content-type lo fija el
-- navegador y es inconsistente para .doc/.docx (a veces octet-stream), así que un
-- allowlist rompería subidas legítimas para poca ganancia (la confidencialidad ya
-- la garantiza el aislamiento de lectura). El límite de tamaño sí es server-side y
-- no falsificable, que es lo que frena el flooding.
-- ---------------------------------------------------------------------------
update storage.buckets
   set file_size_limit = 8388608  -- 8 MiB (coincide con el tope del cliente)
 where id = 'cvs';

-- Los slugs son opacos base36 ([0-9a-z], ver newSlug en store.tsx); el uuid es
-- crypto.randomUUID() y la extensión va en minúsculas (PublicForm). El patrón
-- bloquea traversal (../), rutas de un solo tramo y anidamientos raros.
drop policy "cvs_insert_anyone" on storage.objects;
create policy "cvs_insert_anyone" on storage.objects
  for insert to anon, authenticated
  with check (
    bucket_id = 'cvs'
    and name ~ '^[a-z0-9][a-z0-9-]*/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]+$'
  );

-- ---------------------------------------------------------------------------
-- 6) notify-new-candidate IDEMPOTENTE. La función (pública, verify_jwt=false)
-- dispara un email al dueño por candidatura. Con esta columna guardia solo se
-- envía una vez por candidato, cerrando el email-bombing por reenvío del id.
-- ---------------------------------------------------------------------------
alter table public.candidates add column if not exists notified_at timestamptz;
-- service_role solo tenía SELECT (ver 20260624130000); para marcar el aviso como
-- enviado necesita UPDATE, acotado por columna (mínimo privilegio).
grant update (notified_at) on public.candidates to service_role;

-- ---------------------------------------------------------------------------
-- 8) ALLOWLIST DE STAFF -> tabla gestionable. Antes el email estaba hardcodeado
-- en is_support_staff() dentro del SQL (funcionaba como gate, pero no se podía
-- añadir gente sin desplegar y exponía el correo en el repo). Ahora la fuente es
-- una tabla; is_support_staff() la consulta por user_id.
-- ---------------------------------------------------------------------------
create table public.support_staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
-- RLS activo y sin policies: nadie anon/authenticated la lee/escribe. Se gestiona
-- por service_role (Studio / edge functions) o por SQL directo del administrador.
alter table public.support_staff enable row level security;
grant select, insert, delete on public.support_staff to service_role;

create or replace function public.is_support_staff()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.support_staff where user_id = auth.uid());
$$;
grant execute on function public.is_support_staff() to authenticated;

-- Siembra el equipo actual desde auth.users (en prod la cuenta ya existe, así que
-- queda poblada tras el db push; en local, tras un reset, se re-inserta a mano o
-- se vuelve a sembrar cuando el usuario ya exista). Añadir staff en el futuro:
--   insert into public.support_staff(user_id) select id from auth.users where lower(email)='...';
insert into public.support_staff (user_id)
  select id from auth.users where lower(email) = 'mario.rodriguez.aguado@gmail.com'
  on conflict (user_id) do nothing;

-- ---------------------------------------------------------------------------
-- 9) LOG DE AUDITORÍA de operaciones sensibles: altas/cambios de rol/bajas de
-- membresía e invitaciones. Solo legible por service_role/staff (RLS sin policies).
-- ---------------------------------------------------------------------------
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid,                 -- auth.uid() del que ejecuta; null = sistema (service_role)
  company_id uuid,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_company_created_idx on public.audit_log(company_id, created_at desc);
alter table public.audit_log enable row level security;
grant select on public.audit_log to service_role;

create or replace function public.log_membership_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_log(actor_user_id, company_id, action, details)
  values (
    auth.uid(),
    coalesce(new.company_id, old.company_id),
    lower(tg_op) || ' membership',
    jsonb_build_object(
      'user_id', coalesce(new.user_id, old.user_id),
      'old_role', old.role,
      'new_role', new.role
    )
  );
  return coalesce(new, old);
end;
$$;
create trigger trg_audit_memberships
  after insert or update or delete on public.memberships
  for each row execute function public.log_membership_change();

create or replace function public.log_invitation_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_log(actor_user_id, company_id, action, details)
  values (
    auth.uid(),
    coalesce(new.company_id, old.company_id),
    lower(tg_op) || ' invitation',
    jsonb_build_object(
      'email', coalesce(new.email, old.email),
      'role', coalesce(new.role, old.role),
      'old_status', old.status,
      'new_status', new.status
    )
  );
  return coalesce(new, old);
end;
$$;
create trigger trg_audit_invitations
  after insert or update or delete on public.invitations
  for each row execute function public.log_invitation_change();
