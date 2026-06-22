-- Test de search_candidates: casos "Hernández" + RLS/sede intacta.
-- Cómo correrlo (Supabase local levantado):
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
--     -v ON_ERROR_STOP=1 -f supabase/tests/search_candidates.sql
-- Todo va en una transacción que hace ROLLBACK: no ensucia la BD.

begin;

-- IDs fijos para poder impersonar usuarios luego.
-- Empresa A (con 2 sedes) y Empresa B. Encargado de A acotado a la sede S1.
\set owner_a   '00000000-0000-0000-0000-0000000000a1'
\set enc_a_s1  '00000000-0000-0000-0000-0000000000a2'
\set comp_a    '00000000-0000-0000-0000-0000000000c1'
\set comp_b    '00000000-0000-0000-0000-0000000000c2'
\set site_s1   '00000000-0000-0000-0000-0000000000d1'
\set site_s2   '00000000-0000-0000-0000-0000000000d2'
\set camp_a1   '00000000-0000-0000-0000-0000000000e1'
\set camp_a2   '00000000-0000-0000-0000-0000000000e2'
\set camp_b1   '00000000-0000-0000-0000-0000000000e3'

-- Usuarios (auth.users). Solo necesitamos que exista el id (FK de memberships).
insert into auth.users (id, email, aud, role)
values (:'owner_a', 'owner_a@test.local', 'authenticated', 'authenticated'),
       (:'enc_a_s1', 'enc_a_s1@test.local', 'authenticated', 'authenticated');

-- Empresas (plan multi: sin límites, permite sedes).
insert into public.companies (id, name, plan)
values (:'comp_a', 'Empresa A', 'multi'),
       (:'comp_b', 'Empresa B', 'multi');

insert into public.memberships (company_id, user_id, role)
values (:'comp_a', :'owner_a', 'owner'),
       (:'comp_a', :'enc_a_s1', 'encargado');

insert into public.sites (id, company_id, name, city)
values (:'site_s1', :'comp_a', 'Sede 1', 'Valencia'),
       (:'site_s2', :'comp_a', 'Sede 2', 'Madrid');

insert into public.manager_sites (company_id, user_id, site_id)
values (:'comp_a', :'enc_a_s1', :'site_s1');  -- el encargado SOLO ve la sede 1

insert into public.campaigns (id, company_id, slug, title, sector, location, status, site_id)
values (:'camp_a1', :'comp_a', 'test-a1', 'Puesto A1', '', '', 'activa', :'site_s1'),
       (:'camp_a2', :'comp_a', 'test-a2', 'Puesto A2', '', '', 'activa', :'site_s2'),
       (:'camp_b1', :'comp_b', 'test-b1', 'Puesto B1', '', '', 'activa', null);

-- Candidatos. company_id lo fija el trigger desde el puesto; lo mandamos igual.
insert into public.candidates (campaign_id, company_id, answers) values
  (:'camp_a1', :'comp_a', '{"nombre":"Juan","apellidos":"Hernández","telefono":"644 585 123"}'),
  (:'camp_a1', :'comp_a', '{"nombre":"Ana","apellidos":"Muñoz","telefono":"600 111 222"}'),
  (:'camp_a1', :'comp_a', '{"nombre":"Pedro","apellidos":"García","telefono":"611 000 000"}'),
  (:'camp_a2', :'comp_a', '{"nombre":"Luis","apellidos":"Hernández","telefono":"655 222 333"}'),
  (:'camp_b1', :'comp_b', '{"nombre":"Marta","apellidos":"Hernández","telefono":"677 888 999"}');

-- ============================ TEST 1: matching (como owner de A, sobre A1) ============================
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';

do $$
declare top_apellido text;
begin
  -- ignora mayúsculas/acentos/ñ
  assert (select count(*) from public.search_candidates('00000000-0000-0000-0000-0000000000e1','hernandez',200)
          where answers->>'apellidos' = 'Hernández') >= 1, 'hernandez no encontró Hernández';
  assert (select count(*) from public.search_candidates('00000000-0000-0000-0000-0000000000e1','HERNANDEZ',200)
          where answers->>'apellidos' = 'Hernández') >= 1, 'HERNANDEZ no encontró Hernández';
  -- parcial / prefijo
  assert (select count(*) from public.search_candidates('00000000-0000-0000-0000-0000000000e1','Hernán',200)
          where answers->>'apellidos' = 'Hernández') >= 1, 'Hernán no encontró Hernández';
  -- erratas (trigramas)
  assert (select count(*) from public.search_candidates('00000000-0000-0000-0000-0000000000e1','Hernadez',200)
          where answers->>'apellidos' = 'Hernández') >= 1, 'Hernadez (errata) no encontró Hernández';
  -- ñ: Munoz encuentra Muñoz
  assert (select count(*) from public.search_candidates('00000000-0000-0000-0000-0000000000e1','Munoz',200)
          where answers->>'apellidos' = 'Muñoz') >= 1, 'Munoz no encontró Muñoz';
  -- teléfono ignorando espacios
  assert (select count(*) from public.search_candidates('00000000-0000-0000-0000-0000000000e1','644 585',200)
          where answers->>'nombre' = 'Juan') >= 1, '644 585 no encontró por teléfono';
  -- relevancia: el mejor resultado de "hernandez" es un Hernández
  select answers->>'apellidos' into top_apellido
    from public.search_candidates('00000000-0000-0000-0000-0000000000e1','hernandez',200) limit 1;
  assert top_apellido = 'Hernández', 'el primer resultado por relevancia no es Hernández';
  -- sin coincidencias
  assert (select count(*) from public.search_candidates('00000000-0000-0000-0000-0000000000e1','zzzznomatch',200)) = 0,
         'una query imposible devolvió resultados';
  raise notice 'TEST 1 (matching) OK';
end $$;
reset role;

-- ============================ TEST 2: RLS + acotación por sede ============================
-- El encargado de A está SOLO en la sede S1 (puesto A1). NO debe ver A2 (sede S2) ni B.
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';

do $$
begin
  assert (select count(*) from public.search_candidates('00000000-0000-0000-0000-0000000000e1','hernandez',200)) >= 1,
         'encargado debería ver candidatos de su sede (A1)';
  assert (select count(*) from public.search_candidates('00000000-0000-0000-0000-0000000000e2','hernandez',200)) = 0,
         'FUGA: encargado vio candidatos de otra sede (A2)';
  assert (select count(*) from public.search_candidates('00000000-0000-0000-0000-0000000000e3','hernandez',200)) = 0,
         'FUGA: encargado vio candidatos de otra empresa (B)';
  raise notice 'TEST 2 (RLS/sede) OK';
end $$;
reset role;

-- El owner de A tampoco ve la empresa B.
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
do $$
begin
  assert (select count(*) from public.search_candidates('00000000-0000-0000-0000-0000000000e3','hernandez',200)) = 0,
         'FUGA: owner de A vio candidatos de la empresa B';
  raise notice 'TEST 3 (aislamiento empresa) OK';
end $$;
reset role;

rollback;
