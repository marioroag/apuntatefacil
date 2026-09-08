-- ============================================================================
-- UN PROCESO CERRADO ES DE SOLO LECTURA Y EXPORTACIÓN (Mario, 8-sep-2026).
--
-- "Tus candidatos siguen siendo tuyos" sigue en pie: la lista se ve y se
-- exporta cuando se quiera. Lo que NO se puede hacer con un proceso cerrado es
-- seguir TRABAJANDO con sus candidatos sin pagarlo: cambiarles el estado,
-- etiquetarlos, anotar en su ficha, marcarlos favoritos o citarlos a
-- entrevista. Cerrar y seguir usando la herramienta gratis era aprovecharse
-- del producto justo cuando más valor daba (ya con los candidatos dentro).
--
-- Se aplica AQUÍ, en triggers, y no solo en la interfaz: lo que la interfaz
-- esconde se puede pedir por detrás con la sesión del usuario. `service_role`
-- queda exento: el trabajo del servidor (purgas, análisis, calendario) no es
-- una persona usando el producto. Un borrado de candidato sigue permitido (es
-- higiene de datos y un derecho), y sus etiquetas y notas caen en cascada sin
-- pasar por la guarda porque el candidato ya no existe cuando llegan.
-- ============================================================================

create or replace function public.proceso_cerrado_de_candidato(p_candidate uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.candidates c
    join public.campaigns ca on ca.id = c.campaign_id
    where c.id = p_candidate and ca.status = 'cerrada'
  );
$$;

create or replace function public.candidates_guard_cerrado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' then return new; end if;
  if exists (select 1 from public.campaigns where id = new.campaign_id and status = 'cerrada') then
    raise exception 'PROCESO_CERRADO'
      using errcode = 'P0001',
            hint = 'Este proceso está cerrado. Reábrelo para trabajar con sus candidatos.';
  end if;
  return new;
end
$$;

drop trigger if exists trg_candidates_guard_cerrado on public.candidates;
create trigger trg_candidates_guard_cerrado
  before update of status, favorito, notes, rating on public.candidates
  for each row execute function public.candidates_guard_cerrado();

create or replace function public.candidate_hijos_guard_cerrado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidate uuid;
begin
  if auth.role() = 'service_role' then return coalesce(new, old); end if;
  v_candidate := coalesce(new.candidate_id, old.candidate_id);
  if public.proceso_cerrado_de_candidato(v_candidate) then
    raise exception 'PROCESO_CERRADO'
      using errcode = 'P0001',
            hint = 'Este proceso está cerrado. Reábrelo para trabajar con sus candidatos.';
  end if;
  return coalesce(new, old);
end
$$;

drop trigger if exists trg_candidate_tags_guard_cerrado on public.candidate_tags;
create trigger trg_candidate_tags_guard_cerrado
  before insert or delete on public.candidate_tags
  for each row execute function public.candidate_hijos_guard_cerrado();

drop trigger if exists trg_candidate_comments_guard_cerrado on public.candidate_comments;
create trigger trg_candidate_comments_guard_cerrado
  before insert or update or delete on public.candidate_comments
  for each row execute function public.candidate_hijos_guard_cerrado();

drop trigger if exists trg_interviews_guard_cerrado on public.interviews;
create trigger trg_interviews_guard_cerrado
  before insert on public.interviews
  for each row execute function public.candidate_hijos_guard_cerrado();
