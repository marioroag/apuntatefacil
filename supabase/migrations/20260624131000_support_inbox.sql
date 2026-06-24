-- ============================================================================
-- Apúntate Fácil · bandeja de soporte interna + conversación (inbound de Resend)
-- Convierte las consultas de support_tickets en HILOS: el equipo (staff) ve todas
-- las consultas, lee la conversación y responde desde la app. La respuesta sale por
-- Resend al cliente; cuando el cliente contesta por email, su respuesta vuelve al
-- hilo vía el webhook email.received, enrutada por un token en el reply-to.
--
-- Acceso: NADA es de cara al merchant. Solo el STAFF (allowlist en is_support_staff)
-- lee/responde, vía RPC security definer; las edge functions usan service_role.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Ampliar support_tickets: token de enrutado, estado, orden y "de quién se espera"
-- ---------------------------------------------------------------------------
alter table public.support_tickets
  add column if not exists reply_token uuid not null default gen_random_uuid(),
  add column if not exists status text not null default 'abierto' check (status in ('abierto', 'cerrado')),
  add column if not exists last_message_at timestamptz not null default now(),
  add column if not exists awaiting text not null default 'equipo' check (awaiting in ('equipo', 'cliente'));

-- El inbound sin token reconocible crea un ticket nuevo con source 'email'.
alter table public.support_tickets drop constraint if exists support_tickets_source_check;
alter table public.support_tickets
  add constraint support_tickets_source_check check (source in ('app', 'landing', 'email'));

create unique index if not exists support_tickets_reply_token_idx on public.support_tickets(reply_token);

-- El equipo (service_role, vía las edge functions) crea tickets huérfanos del inbound
-- y actualiza estado/orden. Antes solo tenía SELECT.
grant select, insert, update on public.support_tickets to service_role;

-- ---------------------------------------------------------------------------
-- support_messages: el hilo. La consulta inicial sigue viviendo en
-- support_tickets.message (la "cabecera"); aquí van las respuestas en ambos sentidos.
-- ---------------------------------------------------------------------------
create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  direction text not null check (direction in ('in', 'out')), -- in = del cliente, out = del equipo
  body text not null,
  from_email text,                                            -- en los 'in'
  author_user_id uuid references auth.users(id) on delete set null, -- en los 'out'
  resend_email_id text,                                       -- id de Resend (envío/recepción), para hilar y depurar
  created_at timestamptz not null default now()
);
create index support_messages_ticket_idx on public.support_messages(ticket_id, created_at);

-- RLS activado y SIN policies (igual que support_tickets): nadie anon/authenticated
-- accede directo. El staff entra por los RPC de abajo; las edge functions, por service_role.
alter table public.support_messages enable row level security;
grant select, insert, update on public.support_messages to service_role;

-- ---------------------------------------------------------------------------
-- Gating de staff: allowlist de emails. Ampliar la lista para sumar gente al equipo.
-- ---------------------------------------------------------------------------
create or replace function public.is_support_staff()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    lower((select email from auth.users where id = auth.uid())) = any (array[
      'mario.rodriguez.aguado@gmail.com'
    ]),
    false
  );
$$;
grant execute on function public.is_support_staff() to authenticated;

-- ---------------------------------------------------------------------------
-- RPCs de operador. Todos cortan a quien no es staff (la propia función gatea, por
-- eso se pueden conceder a authenticated sin abrir nada).
-- ---------------------------------------------------------------------------

-- Lista de tickets de TODAS las empresas, con nombre de empresa y un fragmento del
-- último mensaje. Ordenada por actividad reciente. No expone el reply_token.
create or replace function public.support_list_tickets()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.is_support_staff() then
    raise exception 'No autorizado';
  end if;
  return coalesce((
    select jsonb_agg(to_jsonb(t) order by t.last_message_at desc)
    from (
      select st.id, st.company_id, co.name as company_name, st.email, st.name,
             st.source, st.plan, st.status, st.awaiting, st.last_message_at, st.created_at,
             left(coalesce(
               (select sm.body from public.support_messages sm where sm.ticket_id = st.id order by sm.created_at desc limit 1),
               st.message
             ), 140) as preview
      from public.support_tickets st
      left join public.companies co on co.id = st.company_id
    ) t
  ), '[]'::jsonb);
end;
$$;
grant execute on function public.support_list_tickets() to authenticated;

-- Hilo completo de un ticket: cabecera (datos + consulta inicial) + mensajes ordenados.
-- Quita el reply_token del objeto del ticket (no debe salir al cliente del navegador).
create or replace function public.support_get_thread(p_ticket uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v jsonb;
begin
  if not public.is_support_staff() then
    raise exception 'No autorizado';
  end if;
  select jsonb_build_object(
    'ticket', to_jsonb(t) - 'reply_token',
    'messages', coalesce((
      select jsonb_agg(to_jsonb(m) order by m.created_at)
      from public.support_messages m
      where m.ticket_id = t.id
    ), '[]'::jsonb)
  ) into v
  from (
    select st.*, co.name as company_name
    from public.support_tickets st
    left join public.companies co on co.id = st.company_id
    where st.id = p_ticket
  ) t;
  if v is null then
    raise exception 'Ticket no encontrado';
  end if;
  return v;
end;
$$;
grant execute on function public.support_get_thread(uuid) to authenticated;

-- Abrir / cerrar un ticket.
create or replace function public.support_set_status(p_ticket uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_support_staff() then
    raise exception 'No autorizado';
  end if;
  if p_status not in ('abierto', 'cerrado') then
    raise exception 'Estado no válido';
  end if;
  update public.support_tickets set status = p_status where id = p_ticket;
end;
$$;
grant execute on function public.support_set_status(uuid, text) to authenticated;
