-- Meridian: triaje de candidaturas con IA.
-- Guarda el análisis derivado (resumen, puntos a favor/confirmar, ajuste al puesto)
-- en una columna JSONB propia, sin tocar `answers` (del candidato) ni `notes` (del
-- merchant), que ya están ocupadas y con sus propios topes. La forma del objeto la
-- define el tipo CandidateAI en src/lib/types.ts:
--   { summary, highlights[], concerns[], fit, model, analyzedAt, error? }
-- La escribe la edge function `analyze-candidate` con service_role; el merchant la
-- lee con el `select *` que ya usa el store (RLS de la fila la cubre, sin política
-- nueva). Tope defensivo de tamaño, en línea con los de answers/notes de
-- 20260706120000, para que una respuesta anómala del modelo no infle la fila.

alter table public.candidates
  add column if not exists ai jsonb;

alter table public.candidates
  drop constraint if exists candidates_ai_size;
alter table public.candidates
  add constraint candidates_ai_size
  check (ai is null or length(ai::text) <= 20000);
