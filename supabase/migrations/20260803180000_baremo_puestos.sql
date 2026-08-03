-- ==========================================================================
-- Baremo por puesto (triada de Meridian, ago 2026).
--
-- El triaje deja de juzgar contra 5 criterios genéricos y pasa a hacerlo
-- contra un BAREMO generado una vez por puesto (título + sector + ubicación +
-- preguntas del formulario) y persistido aquí. La razón de persistirlo no es
-- el coste: es que todos los candidatos de un proceso se midan con la misma
-- vara. Si cada análisis regenerase el suyo, dos candidatos idénticos
-- sacarían notas distintas y ordenar por Encaje sería mentira.
--
-- La forma del objeto la define Baremo en supabase/functions/_shared/triaje.ts
-- (version, hash del puesto, criterios con nivel/fuente/anclas). Lo escribe
-- SOLO la edge function `analyze-candidate` con service_role; el cliente no lo
-- necesita (la ficha lee candidates.ai, que lleva embebido lo que se pinta).
-- En este backend service_role NO hereda permisos: el select de campaigns ya
-- lo tiene a nivel de tabla (20260624130000), el update hay que dárselo
-- columna a columna, como con candidates.ai (20260725100000).
--
-- Tope defensivo de tamaño, en línea con candidates_ai_size: un baremo son
-- como mucho 8 criterios con anclajes cortos.
-- ==========================================================================

alter table public.campaigns
  add column if not exists baremo jsonb;

alter table public.campaigns
  drop constraint if exists campaigns_baremo_size;
alter table public.campaigns
  add constraint campaigns_baremo_size
  check (baremo is null or length(baremo::text) <= 20000);

grant update (baremo) on public.campaigns to service_role;
