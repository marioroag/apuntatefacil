-- Test de alias de slug: cambiar el enlace no rompe el viejo + unicidad + autorización.
-- La tabla campaign_slug_aliases solo se toca vía RPC (security definer); el merchant no
-- tiene acceso directo. Por eso las comprobaciones de estado van como postgres.
-- Correr (Supabase local): docker exec -i supabase_db_<proj> psql -U postgres -d postgres \
--   -v ON_ERROR_STOP=1 < supabase/tests/slug_aliases_test.sql   (transacción con ROLLBACK)

begin;

\set owner_a '00000000-0000-0000-0000-0000000000a1'
\set comp_a  '00000000-0000-0000-0000-0000000000c1'
\set camp1   '00000000-0000-0000-0000-0000000000e1'
\set camp2   '00000000-0000-0000-0000-0000000000e2'

insert into auth.users (id, email, aud, role) values (:'owner_a','o@test.local','authenticated','authenticated');
insert into public.companies (id, name, plan) values (:'comp_a','Empresa A','multi');
insert into public.memberships (company_id, user_id, role) values (:'comp_a', :'owner_a', 'owner');
insert into public.campaigns (id, company_id, slug, title, sector, location, status) values
  (:'camp1', :'comp_a', 'old-link', 'Puesto', '', '', 'activa'),
  (:'camp2', :'comp_a', 'taken',    'Otro',   '', '', 'activa');

-- ===== Como OWNER de A: cambiar el slug + probar unicidad (llaman al RPC, no a la tabla) =====
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select public.set_campaign_slug('00000000-0000-0000-0000-0000000000e1', 'new-link');
do $$
begin
  begin
    perform public.set_campaign_slug('00000000-0000-0000-0000-0000000000e1', 'taken');
    assert false, 'permitió un slug ya en uso';
  exception when others then
    assert sqlerrm like '%en uso%', 'error inesperado en unicidad: '||sqlerrm;
  end;
end $$;
reset role;

-- ===== Comprobaciones de estado (como postgres) =====
do $$
declare r jsonb;
begin
  assert (select slug from public.campaigns where id='00000000-0000-0000-0000-0000000000e1') = 'new-link',
         'el slug no se actualizó';
  assert exists(select 1 from public.campaign_slug_aliases
                where alias='old-link' and campaign_id='00000000-0000-0000-0000-0000000000e1'),
         'no se guardó el slug viejo como alias';
  -- el enlace VIEJO sigue resolviendo, y devuelve el slug NUEVO como canónico
  r := public.get_public_campaign('old-link');
  assert r is not null and r->>'slug' = 'new-link', 'el enlace viejo no resuelve al slug canónico';
  -- el enlace NUEVO resuelve
  r := public.get_public_campaign('new-link');
  assert r is not null and r->>'slug' = 'new-link', 'el enlace nuevo no resuelve';
  -- inexistente -> null
  assert public.get_public_campaign('zzz-nope') is null, 'un slug inexistente devolvió algo';
  raise notice 'TEST 1 (cambiar slug + alias resuelve + unicidad) OK';
end $$;

-- ===== AUTORIZACIÓN: un usuario de OTRA empresa no puede =====
insert into auth.users (id, email, aud, role)
  values ('00000000-0000-0000-0000-0000000000b1','b@test.local','authenticated','authenticated');
insert into public.companies (id, name, plan) values ('00000000-0000-0000-0000-0000000000c2','Empresa B','multi');
insert into public.memberships (company_id, user_id, role)
  values ('00000000-0000-0000-0000-0000000000c2','00000000-0000-0000-0000-0000000000b1','owner');

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}';
do $$
begin
  begin
    perform public.set_campaign_slug('00000000-0000-0000-0000-0000000000e1', 'hacker');
    assert false, 'un ajeno pudo cambiar el slug';
  exception when others then
    assert sqlerrm like '%No autorizado%', 'error inesperado en auth: '||sqlerrm;
  end;
  raise notice 'TEST 2 (ajeno no puede) OK';
end $$;
reset role;

rollback;
