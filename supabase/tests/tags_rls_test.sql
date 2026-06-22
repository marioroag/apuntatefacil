-- ============================================================================
-- Tests RLS de Etiquetas (pgTAP) · Apúntate Fácil
-- Comprueba el aislamiento de tags / candidate_tags entre roles y empresas.
--
-- Cómo correr (necesita el stack local arrancado, ver CLAUDE.md):
--   supabase start
--   supabase test db
-- (corre todos los ficheros de supabase/tests/*.sql con pgTAP.)
--
-- Modelo de los datos de prueba:
--   Empresa A: owner (acceso pleno), encargado (solo sede 1), candidatos en
--              sede 1 (cand1) y sede 2 (cand2). Empresa B: otro owner.
-- Criterios cubiertos:
--   - owner/member crean vocabulario; encargado NO.
--   - encargado aplica/quita etiquetas solo en candidatos de SUS sedes.
--   - encargado no lee candidate_tags de fuera de sus sedes.
--   - una empresa no ve nada de otra.
--   - unicidad case-insensitive del vocabulario por empresa.
-- ============================================================================

begin;
select plan(9);

-- ---- Semilla (como superusuario: la RLS no aplica al owner de las tablas) ----
-- Usuarios de auth (FK de memberships -> auth.users).
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'owner-a@test.dev'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'encargado-a@test.dev'),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'owner-b@test.dev');

-- plan 'multi': sin tope de procesos (la semilla crea 2 puestos en la empresa A).
insert into public.companies (id, name, plan) values
  ('a0000000-0000-0000-0000-000000000000', 'Empresa A', 'multi'),
  ('b0000000-0000-0000-0000-000000000000', 'Empresa B', 'multi');

insert into public.memberships (company_id, user_id, role) values
  ('a0000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000001', 'owner'),
  ('a0000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000002', 'encargado'),
  ('b0000000-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-000000000001', 'owner');

insert into public.sites (id, company_id, name, city) values
  ('51000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000000', 'Sede 1', 'Valencia'),
  ('52000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000000', 'Sede 2', 'Madrid');

-- El encargado solo gestiona la sede 1.
insert into public.manager_sites (company_id, user_id, site_id) values
  ('a0000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000002', '51000000-0000-0000-0000-000000000000');

insert into public.campaigns (id, company_id, slug, title, site_id) values
  ('c1000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000000', 'slug-camp1', 'Puesto sede 1', '51000000-0000-0000-0000-000000000000'),
  ('c2000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000000', 'slug-camp2', 'Puesto sede 2', '52000000-0000-0000-0000-000000000000');

insert into public.candidates (id, campaign_id, company_id, answers) values
  ('ca100000-0000-0000-0000-000000000000', 'c1000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000000', '{}'),
  ('ca200000-0000-0000-0000-000000000000', 'c2000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000000', '{}');

-- Vocabulario de la empresa A.
insert into public.tags (id, company_id, name) values
  ('fa100000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000000', 'apto'),
  ('fa200000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000000', 'recontactar');

-- El candidato de la sede 2 ya tiene una etiqueta (para probar que el encargado
-- NO la ve aunque exista).
insert into public.candidate_tags (candidate_id, tag_id) values
  ('ca200000-0000-0000-0000-000000000000', 'fa100000-0000-0000-0000-000000000000');

-- ---- Helper: cambiar de usuario autenticado ---------------------------------
-- (cada test corre con el rol/claims fijados justo antes)

-- ====================== Empresa A · OWNER (acceso pleno) =====================
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001"}';

select lives_ok(
  $$ insert into public.tags (company_id, name) values ('a0000000-0000-0000-0000-000000000000', 'documentacion ok') $$,
  'owner puede crear vocabulario (tags insert)'
);

select throws_ok(
  $$ insert into public.tags (company_id, name) values ('a0000000-0000-0000-0000-000000000000', 'apto') $$,
  '23505',
  null,
  'el vocabulario es unico por empresa (apto ya existe)'
);

select throws_ok(
  $$ insert into public.tags (company_id, name) values ('a0000000-0000-0000-0000-000000000000', '  APTO  ') $$,
  '23505',
  null,
  'unicidad case-insensitive y normalizando espacios (  APTO   = apto)'
);

-- ====================== Empresa A · ENCARGADO (sede 1) =======================
set local "request.jwt.claims" = '{"sub":"aaaaaaaa-0000-0000-0000-000000000002"}';

select throws_ok(
  $$ insert into public.tags (company_id, name) values ('a0000000-0000-0000-0000-000000000000', 'no permitido') $$,
  '42501',
  null,
  'el encargado NO puede crear vocabulario (tags insert denegado)'
);

select lives_ok(
  $$ insert into public.candidate_tags (candidate_id, tag_id)
     values ('ca100000-0000-0000-0000-000000000000', 'fa200000-0000-0000-0000-000000000000') $$,
  'el encargado puede aplicar etiquetas a candidatos de SU sede'
);

select throws_ok(
  $$ insert into public.candidate_tags (candidate_id, tag_id)
     values ('ca200000-0000-0000-0000-000000000000', 'fa200000-0000-0000-0000-000000000000') $$,
  '42501',
  null,
  'el encargado NO puede etiquetar candidatos fuera de su sede'
);

select is(
  (select count(*)::int from public.candidate_tags),
  1,
  'el encargado solo VE candidate_tags de su sede (cand1), no de la sede 2'
);

-- ====================== Empresa B · OWNER (otra empresa) =====================
set local "request.jwt.claims" = '{"sub":"bbbbbbbb-0000-0000-0000-000000000001"}';

select is(
  (select count(*)::int from public.tags),
  0,
  'una empresa no ve el vocabulario de otra'
);

select is(
  (select count(*)::int from public.candidate_tags),
  0,
  'una empresa no ve las candidate_tags de otra'
);

select * from finish();
rollback;
