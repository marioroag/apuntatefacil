-- CUÁNDO ENTRÓ EL CANDIDATO EN SU ESTADO ACTUAL (`status_changed_at`).
--
-- Lo pide el tablero del puesto (ago 2026): cada tarjeta dice cuánto lleva esa
-- persona en su etapa, y esa pregunta no se puede contestar desde la lista sin
-- este dato. El historial (`candidate_events`) ya lo sabe, pero cargar los
-- eventos de 600 candidatos para pintar una lista es pagar N consultas por un
-- dato de una fila: el dato vive EN la fila y el historial sigue siendo la
-- memoria larga.
--
-- Lo escribe un TRIGGER, no el cliente: es la misma división que el historial
-- (el cliente dice "cambia el estado" y la base apunta lo que eso significa).
-- Por eso no necesita grant de update: los privilegios se comprueban sobre las
-- columnas del UPDATE del cliente, y esta la asigna el trigger en NEW.

alter table public.candidates add column status_changed_at timestamptz;

-- Relleno desde el historial: el último cambio de estado apuntado. Quien no
-- tiene ninguno sigue en su estado de llegada, así que su fecha es la de llegar.
update public.candidates c
   set status_changed_at = coalesce(
     (select max(e.created_at)
        from public.candidate_events e
       where e.candidate_id = c.id and e.kind = 'estado'),
     c.created_at)
 where status_changed_at is null;

alter table public.candidates alter column status_changed_at set default now();
alter table public.candidates alter column status_changed_at set not null;

create or replace function public.candidates_stamp_status_changed()
returns trigger
language plpgsql
as $$
begin
  -- Solo cuando el estado CAMBIA de verdad: editar etiquetas o favorito no
  -- reinicia el reloj de la etapa.
  if new.status is distinct from old.status then
    new.status_changed_at := now();
  end if;
  return new;
end;
$$;

create trigger candidates_stamp_status_changed
  before update of status on public.candidates
  for each row
  execute function public.candidates_stamp_status_changed();
