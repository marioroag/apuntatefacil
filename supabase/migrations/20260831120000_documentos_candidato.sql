-- ============================================================================
-- MÁS DE UN DOCUMENTO POR CANDIDATO (Mario, ago 2026).
--
-- Hasta hoy una candidatura solo podía tener UNO: el formulario subía el primer
-- fichero y lo demás se perdía (`Object.values(files)[0]`), y la base guardaba
-- una sola ruta (`candidates.cv_path`). Dos cosas quedaban fuera: un puesto que
-- pide CV **y** carnet, y todo lo que se recopila DESPUÉS (la documentación, el
-- contrato firmado), que hoy vive en el correo de alguien y no en la ficha.
--
-- POR QUÉ UNA TABLA Y NO UN `jsonb` EN `candidates`, que es lo que esta casa
-- suele elegir para lo que crece (`fields`, `branding`, `anuncio`):
--   1. **Dos personas añadiendo a la vez.** Un array en jsonb se actualiza
--      leyendo-modificando-escribiendo, así que dos miembros del equipo subiendo
--      un documento en el mismo minuto se pisan y uno se pierde sin ruido. Una
--      fila por documento no tiene ese problema.
--   2. **Lo que se pide es un REGISTRO**: quién lo añadió y cuándo ("para tener
--      constancia de los avances"). Eso es una fila con autor y fecha, no un
--      campo dentro de otro objeto.
--   3. El borrado de uno suelto es un `delete` y no reescribir el array entero.
--
-- `candidates.cv_path` SE QUEDA COMO ESTÁ, y es deliberado: es lo que lee
-- Meridian y lo que exporta el ZIP. La ficha compone la lista como [el CV] +
-- [estas filas], así que **cada documento tiene una sola fuente** y no hay nada
-- que se pueda desincronizar. Migrar los cv_path a esta tabla habría sido tocar
-- datos de clientes reales para no ganar nada hoy.
-- ============================================================================

create table if not exists public.candidate_documents (
  id           uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  -- Denormalizada a propósito: la RLS de esta tabla se resuelve sin ir a
  -- `candidates`, igual que hacen las demás tablas hijas del esquema.
  company_id   uuid not null references public.companies(id) on delete cascade,
  -- Ruta en el bucket privado `cvs`, con el mismo patrón que ya valida su
  -- política de storage: <slug>/<uuid>.<ext>.
  path         text not null,
  -- Cómo se llama para quien lo mira. El nombre del bucket es un uuid.
  nombre       text not null,
  bytes        bigint,
  -- 'candidato' (lo subió con el formulario) o 'equipo' (lo añadió alguien de
  -- la empresa después). No es cosmético: dice de quién es la palabra.
  origen       text not null check (origen in ('candidato', 'equipo')),
  -- Qué pregunta del formulario lo pidió, cuando viene del formulario.
  campo_id     text,
  -- Quién lo añadió. Solo lo hay en los de 'equipo': el candidato es anónimo.
  subido_por   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);

-- El acceso normal es "los documentos de este candidato", y la ficha los pide
-- por candidato al abrirla.
create index if not exists candidate_documents_candidate_idx
  on public.candidate_documents (candidate_id, created_at);

alter table public.candidate_documents enable row level security;

-- Los ve y los gestiona el equipo de su empresa, como el resto del esquema. El
-- candidato anónimo NO inserta aquí: sus documentos entran por
-- `submit_application`, que es `security definer` y valida lo que llega.
create policy "candidate_documents_select" on public.candidate_documents
  for select to authenticated
  using (company_id in (select public.current_user_company_ids()));

create policy "candidate_documents_insert" on public.candidate_documents
  for insert to authenticated
  with check (company_id in (select public.current_user_company_ids()));

create policy "candidate_documents_delete" on public.candidate_documents
  for delete to authenticated
  using (company_id in (select public.current_user_company_ids()));

grant select, insert, delete on public.candidate_documents to authenticated;
-- Meridian (service_role) tiene que poder leerlos: en este backend service_role
-- NO hereda permisos de tabla, y sin el grant explícito da 42501.
grant select on public.candidate_documents to service_role;

-- ---------------------------------------------------------------------------
-- El formulario público manda ahora TODOS sus ficheros.
--
-- `p_docs` es un array de objetos {path, nombre, bytes, campo_id}. El primero
-- sigue viajando aparte en `p_cv_path` (es el que lee Meridian), así que aquí
-- llegan los DEMÁS. Una función nueva con el parámetro por defecto y fuera la
-- vieja: el formulario que está vivo ahora mismo manda cinco claves con nombre
-- y Postgres resuelve la sexta, así que la ventana entre `db push` y el
-- despliegue del frontend queda cubierta (mismo truco que la de 5).
-- ---------------------------------------------------------------------------
create or replace function public.submit_application(
  p_slug            text,
  p_answers         jsonb,
  p_source          text default 'enlace',
  p_cv_path         text default null,
  p_consent_version text default null,
  p_docs            jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  cmp     public.campaigns;
  cand_id uuid;
  v_ver   text := nullif(btrim(coalesce(p_consent_version, '')), '');
  doc     jsonb;
  v_path  text;
  v_nom   text;
begin
  if length(coalesce(p_answers, '{}'::jsonb)::text) > 200000 then
    raise exception 'Respuestas demasiado largas';
  end if;
  if char_length(coalesce(v_ver, '')) > 40 then
    raise exception 'Versión de consentimiento no válida';
  end if;
  -- Un tope, como el de `answers`: lo que escribe el cliente sin límite es un
  -- sitio donde meter lo que sea. Diez documentos son de sobra para un puesto.
  if jsonb_array_length(coalesce(p_docs, '[]'::jsonb)) > 10 then
    raise exception 'Demasiados documentos';
  end if;
  select * into cmp from public.campaigns where slug = p_slug;
  if not found then
    raise exception 'Puesto no encontrado';
  end if;
  if cmp.status <> 'activa' then
    raise exception 'Este puesto ya no acepta candidaturas';
  end if;
  -- La fecha la pone el servidor, nunca el cliente: es la prueba.
  insert into public.candidates(
      campaign_id, company_id, answers, source, cv_path, status,
      consent_at, consent_version)
    values (
      cmp.id, cmp.company_id, coalesce(p_answers, '{}'::jsonb),
      coalesce(p_source, 'enlace'), p_cv_path, 'nuevo',
      case when v_ver is null then null else now() end, v_ver)
    returning id into cand_id;

  -- Los documentos de más. La RUTA se valida aquí con el mismo patrón que la
  -- política del bucket: esta función es `security definer`, así que lo que no
  -- compruebe ella no lo comprueba nadie.
  for doc in select * from jsonb_array_elements(coalesce(p_docs, '[]'::jsonb))
  loop
    v_path := nullif(btrim(coalesce(doc->>'path', '')), '');
    v_nom  := nullif(btrim(coalesce(doc->>'nombre', '')), '');
    continue when v_path is null or v_nom is null;
    if v_path !~ '^[a-z0-9][a-z0-9-]*/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]+$' then
      raise exception 'Ruta de documento no válida';
    end if;
    insert into public.candidate_documents(
        candidate_id, company_id, path, nombre, bytes, origen, campo_id)
      values (
        cand_id, cmp.company_id, v_path, left(v_nom, 200),
        nullif(doc->>'bytes', '')::bigint, 'candidato', left(doc->>'campo_id', 80));
  end loop;

  return cand_id;
end
$$;

grant execute on function public.submit_application(text, jsonb, text, text, text, jsonb)
  to anon, authenticated;

-- Fuera la de 5, que a partir de aquí solo puede causar ambigüedad.
drop function if exists public.submit_application(text, jsonb, text, text, text);
