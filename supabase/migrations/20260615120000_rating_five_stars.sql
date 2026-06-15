-- ============================================================================
-- Apúntate Fácil · valoración de 0 a 5 estrellas
-- El check original limitaba rating a 0..3. La UI pasa a 5 estrellas, así que
-- ampliamos el rango. Los valores existentes (0..3) siguen siendo válidos.
-- Eliminamos el check viejo por su definición (no por nombre, que Postgres
-- autogenera) para no fallar si el nombre difiere entre entornos.
-- ============================================================================

do $$
declare
  c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'candidates'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%rating%'
  loop
    execute format('alter table public.candidates drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.candidates
  add constraint candidates_rating_check check (rating between 0 and 5);
