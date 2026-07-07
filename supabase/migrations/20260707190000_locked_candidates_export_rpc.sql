-- Export a Excel del panel: las candidaturas BLOQUEADAS del plan gratuito (trial,
-- por encima del tope) deben APARECER en el .xlsx como filas tentadoras (sin ningún
-- dato personal), no omitirse en silencio. Exportar no puede ser un atajo para leer
-- lo bloqueado sin pagar: la RLS ya impide leer la fila real (candidates_scoped +
-- "and not locked"), así que el .xlsx nunca tuvo los datos; esto solo añade las
-- filas señuelo con la FECHA de entrada real (no hay PII en una fecha).
--
-- A diferencia de locked_candidates_preview() (8 fechas, para el panel), aquí
-- devolvemos TODAS las fechas de UN puesto: un export es un registro completo, cada
-- candidatura bloqueada debe salir como su propia fila. Igual de acotado: solo los
-- puestos del usuario (current_user_campaign_ids), sin datos personales.
create or replace function public.locked_candidates_export(p_campaign uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(created_at order by created_at desc), '[]'::jsonb)
  from public.candidates
  where locked
    and campaign_id = p_campaign
    and campaign_id in (select public.current_user_campaign_ids())
$$;

revoke all on function public.locked_candidates_export(uuid) from public, anon;
grant execute on function public.locked_candidates_export(uuid) to authenticated;
