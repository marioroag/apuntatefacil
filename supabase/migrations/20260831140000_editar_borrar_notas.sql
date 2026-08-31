-- ============================================================================
-- EDITAR Y BORRAR LO QUE TÚ HAS ESCRITO (Mario, ago 2026).
--
-- Los dos hilos del producto (las notas de una ficha y el tablón de Equipo)
-- nacieron SIN update ni delete, y con un motivo escrito: "lo dicho queda
-- dicho", que es lo que hace fiable un hilo compartido. La vuelta atrás la pide
-- el uso real: una nota es una frase que se escribe deprisa mientras hablas por
-- teléfono, y hasta hoy una errata se quedaba puesta para siempre delante de
-- todo el equipo.
--
-- LO QUE AQUELLA DECISIÓN PROTEGÍA SE CONSERVA, y por eso esto no es un update
-- a secas:
--
--   1. **Solo el autor.** Nadie puede reescribir ni borrar lo que dijo otro, ni
--      siquiera el dueño de la empresa. Un hilo donde tu jefe puede editar tu
--      frase no es un registro, es un borrador compartido.
--   2. **Editar se NOTA.** `edited_at` se pone solo (trigger) y la ficha escribe
--      "editado" al lado de la hora. Sin esa marca, un hilo que se usa "para
--      tener constancia" deja de valer como constancia.
--   3. **SOLO CAMBIA EL CUERPO.** El grant es POR COLUMNAS, así que el autor, la
--      fecha, el candidato y sobre todo `mentions` quedan fuera del alcance del
--      cliente. Eso último es lo importante: a quién se avisó ya está decidido y
--      el correo ya salió, así que una edición no puede repartir avisos nuevos
--      ni retirar los que se mandaron. Un `@` escrito DURANTE una edición no
--      avisa a nadie, y por eso el hilo lo pinta como texto normal (la chapa se
--      reserva a lo que de verdad avisó: ver `ChatBody`).
--
-- Borrar es un borrado de verdad y no una lápida ("mensaje eliminado"): son dos
-- frases sobre una persona, no un chat público, y una lista de lápidas en una
-- columna de 336px es peor que el hueco. El aviso de la mención se va con él,
-- que es lo correcto: se deriva del comentario.
-- ============================================================================

-- SOLO LAS NOTAS DE LA FICHA, y el tablón se queda fuera A PROPÓSITO. Comparten
-- la misma primitiva de hilo, así que la tentación es abrir los dos a la vez;
-- pero una respuesta del tablón puede llevar CANDIDATOS PROPUESTOS colgando
-- (`team_request_candidates`, en cascada), así que borrarla no es borrar un
-- mensaje: es retirar propuestas que otro puede estar mirando, y para eso ya hay
-- un verbo propio (`retractProposal`). Es otra decisión y se toma aparte.
alter table public.candidate_comments add column if not exists edited_at timestamptz;

-- ---------------------------------------------------------------------------
-- La marca la pone el SERVIDOR, no el cliente.
--
-- Va en un trigger y no en el `update` del store por lo mismo que la fecha de
-- consentimiento del formulario público: es la prueba de que algo cambió, y una
-- prueba que escribe quien tiene interés en ella no prueba nada. De paso, quien
-- edite desde cualquier otro sitio (psql, un script) tampoco puede saltársela.
-- ---------------------------------------------------------------------------
create or replace function public.marcar_edicion()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  -- Solo si de verdad cambia el texto: el claim de `notified_at` que hace la
  -- edge function con el cliente admin es también un update de esta fila, y no
  -- puede dejar el mensaje marcado como editado por una persona.
  if new.body is distinct from old.body then
    new.edited_at := now();
  end if;
  return new;
end
$$;

create trigger trg_candidate_comments_edicion
  before update on public.candidate_comments
  for each row execute function public.marcar_edicion();

-- ---------------------------------------------------------------------------
-- RLS: solo el autor, y solo dentro de su empresa.
--
-- `author_user_id = auth.uid()` es la condición de verdad; el filtro por empresa
-- va además, por lo mismo que en las policies de select: una fila que se moviera
-- de empresa no puede arrastrar permisos.
-- ---------------------------------------------------------------------------
create policy "candidate_comments_update_propio" on public.candidate_comments
  for update to authenticated
  using (
    author_user_id = auth.uid()
    and company_id in (select public.current_user_company_ids())
  )
  with check (author_user_id = auth.uid());

create policy "candidate_comments_delete_propio" on public.candidate_comments
  for delete to authenticated
  using (
    author_user_id = auth.uid()
    and company_id in (select public.current_user_company_ids())
  );

-- El UPDATE va ACOTADO POR COLUMNAS, como el de `companies` desde el
-- endurecimiento de facturación: la policy dice QUIÉN puede tocar la fila y el
-- grant dice QUÉ. Sin esto, un cliente manipulado podría reescribir `mentions`
-- (y repartir avisos) o `author_user_id` con la policy pasando en verde.
--
-- `edited_at` NO se concede: lo pone el trigger.
grant update (body) on public.candidate_comments to authenticated;
grant delete        on public.candidate_comments to authenticated;
