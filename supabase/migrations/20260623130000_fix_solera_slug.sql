-- One-off: el puesto de Solera Canarias se creó con el esquema viejo (slug = título +
-- aleatorio) y quedó "peon-de-albanil-htttf" aunque NO es el de peones. Lo cambiamos a
-- "albanileria" dejando el viejo como ALIAS, así el enlace ya compartido sigue funcionando.
-- En entornos sin ese puesto (local) no afecta a ninguna fila (no-op). Idempotente.
do $$
declare v_id uuid;
begin
  select id into v_id from public.campaigns where slug = 'peon-de-albanil-htttf';
  if v_id is null then
    return; -- el puesto no está en este entorno (p. ej. local): nada que hacer
  end if;
  if exists (select 1 from public.campaigns where slug = 'albanileria')
     or exists (select 1 from public.campaign_slug_aliases where alias = 'albanileria') then
    raise exception 'El slug "albanileria" ya está en uso; elige otro';
  end if;
  insert into public.campaign_slug_aliases (alias, campaign_id)
    values ('peon-de-albanil-htttf', v_id) on conflict (alias) do nothing;
  update public.campaigns set slug = 'albanileria' where id = v_id;
end $$;
