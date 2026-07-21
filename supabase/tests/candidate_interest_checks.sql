-- Tests de comprobación de interés: RLS, resumen y token público.
-- Ejecutar con `supabase test db` después de `supabase db reset`.

begin;
select plan(16);

insert into auth.users (id, email, aud, role) values
  ('aa000000-0000-0000-0000-000000000001', 'owner-a@interest.test', 'authenticated', 'authenticated'),
  ('aa000000-0000-0000-0000-000000000002', 'manager-a@interest.test', 'authenticated', 'authenticated'),
  ('bb000000-0000-0000-0000-000000000001', 'owner-b@interest.test', 'authenticated', 'authenticated');

insert into public.companies (id, name, plan) values
  ('a1000000-0000-0000-0000-000000000000', 'Empresa A', 'multi'),
  ('b1000000-0000-0000-0000-000000000000', 'Empresa B', 'multi');

insert into public.memberships (company_id, user_id, role) values
  ('a1000000-0000-0000-0000-000000000000', 'aa000000-0000-0000-0000-000000000001', 'owner'),
  ('a1000000-0000-0000-0000-000000000000', 'aa000000-0000-0000-0000-000000000002', 'encargado'),
  ('b1000000-0000-0000-0000-000000000000', 'bb000000-0000-0000-0000-000000000001', 'owner');

insert into public.sites (id, company_id, name, city) values
  ('a2000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000000', 'Sede visible', 'Madrid'),
  ('a2000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000000', 'Sede oculta', 'Sevilla');

insert into public.manager_sites (company_id, user_id, site_id) values
  ('a1000000-0000-0000-0000-000000000000', 'aa000000-0000-0000-0000-000000000002', 'a2000000-0000-0000-0000-000000000001');

insert into public.campaigns (id, company_id, slug, title, site_id, fields) values
  ('a3000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000000', 'interest-a-visible', 'Puesto visible', 'a2000000-0000-0000-0000-000000000001', '[{"id":"email","type":"email","label":"Email","required":true}]'),
  ('a3000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000000', 'interest-a-hidden', 'Puesto oculto', 'a2000000-0000-0000-0000-000000000002', '[{"id":"email","type":"email","label":"Email","required":true}]'),
  ('b3000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000000', 'interest-b', 'Puesto B', null, '[{"id":"email","type":"email","label":"Email","required":true}]');

insert into public.candidates (id, campaign_id, company_id, answers) values
  ('a4000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000000', '{"nombre":"Ana","email":"ana@example.com"}'),
  ('a4000000-0000-0000-0000-000000000002', 'a3000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000000', '{"nombre":"Berta","email":"berta@example.com"}'),
  ('b4000000-0000-0000-0000-000000000001', 'b3000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000000', '{"nombre":"Bea","email":"bea@example.com"}');

insert into public.candidate_interest_batches
  (id, company_id, campaign_id, initiated_by, idempotency_key) values
  ('a5000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000000', 'a3000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000001', 'a6000000-0000-0000-0000-000000000001'),
  ('a5000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000000', 'a3000000-0000-0000-0000-000000000002', 'aa000000-0000-0000-0000-000000000001', 'a6000000-0000-0000-0000-000000000002'),
  ('b5000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000000', 'b3000000-0000-0000-0000-000000000001', 'bb000000-0000-0000-0000-000000000001', 'b6000000-0000-0000-0000-000000000001');

insert into public.candidate_interest_checks
  (id, batch_id, company_id, campaign_id, recipient_email, delivery_status, token_hash, sent_at, expires_at) values
  ('a7000000-0000-0000-0000-000000000001', 'a5000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000000', 'a3000000-0000-0000-0000-000000000001', 'ana@example.com', 'sent', encode(extensions.digest('token-visible-abcdefghijklmnopqrstuvwxyz123456', 'sha256'), 'hex'), now(), now() + interval '60 days'),
  ('a7000000-0000-0000-0000-000000000002', 'a5000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000000', 'a3000000-0000-0000-0000-000000000002', 'berta@example.com', 'sent', encode(extensions.digest('token-hidden-abcdefghijklmnopqrstuvwxyz1234567', 'sha256'), 'hex'), now(), now() + interval '60 days'),
  ('b7000000-0000-0000-0000-000000000001', 'b5000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000000', 'b3000000-0000-0000-0000-000000000001', 'bea@example.com', 'sent', encode(extensions.digest('token-other-abcdefghijklmnopqrstuvwxyz12345678', 'sha256'), 'hex'), now(), now() + interval '60 days');

insert into public.candidate_interest_check_candidates (check_id, candidate_id) values
  ('a7000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000001'),
  ('a7000000-0000-0000-0000-000000000002', 'a4000000-0000-0000-0000-000000000002'),
  ('b7000000-0000-0000-0000-000000000001', 'b4000000-0000-0000-0000-000000000001');

select is(has_table_privilege('anon', 'public.candidate_interest_checks', 'SELECT'), false, 'anon no lee comprobaciones');
select is(has_table_privilege('anon', 'public.candidate_interest_check_candidates', 'SELECT'), false, 'anon no lee relaciones');

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"aa000000-0000-0000-0000-000000000001"}';
select is((select count(*)::int from public.candidate_interest_checks), 2, 'owner A ve solo sus comprobaciones');
select is((select count(*)::int from public.candidate_interest_overview('a3000000-0000-0000-0000-000000000001')), 1, 'owner obtiene resumen del puesto');
select is((select count(*)::int from public.candidate_interest_overview_for_company('a1000000-0000-0000-0000-000000000000')), 2, 'owner obtiene resúmenes solo de la empresa activa');

set local "request.jwt.claims" = '{"sub":"aa000000-0000-0000-0000-000000000002"}';
select is((select count(*)::int from public.candidate_interest_checks), 1, 'encargado ve solo su sede');
select is((select count(*)::int from public.candidate_interest_overview('a3000000-0000-0000-0000-000000000002')), 0, 'encargado no obtiene resumen de otra sede');

set local "request.jwt.claims" = '{"sub":"bb000000-0000-0000-0000-000000000001"}';
select is((select count(*)::int from public.candidate_interest_checks), 1, 'empresa B no ve comprobaciones de A');

reset role;
select is(
  (public.get_candidate_interest_response('token-visible-abcdefghijklmnopqrstuvwxyz123456')->>'status'),
  'ok',
  'abrir token válido devuelve contexto'
);
select is(
  (select response from public.candidate_interest_checks where id = 'a7000000-0000-0000-0000-000000000001'),
  null::text,
  'abrir el token no registra respuesta'
);
select is(
  (public.confirm_candidate_interest_response('token-visible-abcdefghijklmnopqrstuvwxyz123456', 'interested')->>'status'),
  'ok',
  'confirmar registra respuesta'
);
select is(
  (select response from public.candidate_interest_checks where id = 'a7000000-0000-0000-0000-000000000001'),
  'interested',
  'respuesta positiva persistida'
);
select is(
  (public.confirm_candidate_interest_response('token-visible-abcdefghijklmnopqrstuvwxyz123456', 'not_interested')->>'status'),
  'ok',
  'el candidato puede corregir respuesta'
);
select is(
  (select response from public.candidate_interest_checks where id = 'a7000000-0000-0000-0000-000000000001'),
  'not_interested',
  'se conserva la respuesta más reciente'
);
select is(
  (public.get_candidate_interest_response('token-inexistente-abcdefghijklmnopqrstuvwxyz12345')->>'status'),
  'invalid',
  'token inexistente no filtra contexto'
);

update public.candidate_interest_checks
   set created_at = now() - interval '61 days',
       expires_at = now() - interval '1 second'
 where id = 'a7000000-0000-0000-0000-000000000001';
select is(
  (public.confirm_candidate_interest_response('token-visible-abcdefghijklmnopqrstuvwxyz123456', 'interested')->>'status'),
  'expired',
  'token caducado no escribe'
);

select * from finish();
rollback;
