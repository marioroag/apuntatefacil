-- ============================================================================
-- LA PRUEBA SE MIDE SOLO EN DÍAS (Mario, ago 2026).
--
-- Hasta hoy la prueba del primer proceso tenía DOS frenos: 15 días o 25
-- candidaturas visibles, lo que llegara antes. El tope de candidaturas se
-- retira: la prueba dura 15 días y punto.
--
-- El motivo es de producto, y es el mismo que hacía difícil de explicar el
-- modelo: el cupo castiga justo al puesto que MEJOR está funcionando. Un
-- anuncio de peón en Milanuncios se come 25 candidaturas en una tarde, así
-- que quien más valor estaba viendo era a quien antes se le apagaba la demo,
-- y encima el día 2 de una prueba de 15. Con un solo freno, lo que se prueba
-- es el producto durante dos semanas, que es lo que se quiere demostrar.
--
-- LO QUE NO CAMBIA, y conviene decirlo porque es la otra mitad del modelo: la
-- prueba sigue cubriendo UN SOLO proceso abierto (plan_process_limit('trial')
-- = 1, ya vigente). Abrir un segundo no se bloquea con un muro: el cliente
-- manda a Checkout con `activateCampaignId` y el webhook lo abre al cobrar.
-- Ahí no se toca nada.
--
-- Y tampoco cambia el mecanismo de caducidad: al pasar los 15 días se SIGUE
-- recopilando y lo nuevo entra bloqueado, que se desbloquea entero al añadir
-- el método de pago. Nunca se rechaza una candidatura ni se cierra un puesto.
-- ============================================================================

-- 1) El cupo desaparece del vocabulario. Se deja la función devolviendo
--    "ilimitado" en vez de borrarla: hoy solo la llama enforce_candidate_limit
--    (comprobado contra el esquema, no contra las migraciones), pero una
--    función que desaparece rompe a cualquier caller que quede vivo en una
--    base que vaya por detrás, mientras que una que devuelve "sin tope" lo
--    único que hace es no bloquear a nadie, que es el lado seguro del error.
create or replace function public.plan_candidate_limit(p_plan text)
returns integer
language sql
immutable
as $$
  select 2147483647   -- sin tope para nadie, prueba incluida
$$;

-- 2) El bloqueo pasa a depender SOLO del reloj.
--
--    De paso se van el COUNT(*) y el `pg_advisory_xact_lock` por empresa, que
--    estaban ahí para que el cupo fuese exacto con envíos simultáneos. Sin
--    cupo no hay nada que contar, y esto vive en el camino caliente del
--    formulario público: cada candidatura dejaba de contar todas las de su
--    empresa y de serializarse contra las demás de la misma empresa.
create or replace function public.enforce_candidate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan text;
  v_trial_ends timestamptz;
begin
  select co.plan, co.trial_ends_at into v_plan, v_trial_ends
    from public.campaigns c
    join public.companies co on co.id = c.company_id
    where c.id = new.campaign_id;
  if v_plan is distinct from 'trial' then
    return new; -- solo la prueba bloquea; los planes de pago nunca
  end if;
  -- `trial_ends_at` nulo = el reloj no ha arrancado (aún no se abrió el primer
  -- puesto): no hay prueba que agotar, así que nada se bloquea.
  new.locked := (v_trial_ends is not null and now() > v_trial_ends);
  return new;
end
$$;

-- 3) Los que ya estaban bloqueados POR CUPO se liberan.
--
--    No se puede saber por qué se bloqueó una fila, pero sí CUÁNDO llegó: si
--    entró mientras su prueba seguía viva, solo pudo bloquearla el cupo, que
--    es lo que acabamos de retirar. Las que llegaron después de caducar la
--    prueba se quedan bloqueadas, que es lo correcto y lo que sigue diciendo
--    la regla nueva.
--
--    Solo toca empresas en 'trial': quien ya paga no tiene filas bloqueadas
--    (al pasar a 'proceso' se desbloquea todo) y no hay motivo para escribir
--    en sus datos.
update public.candidates c
   set locked = false
  from public.companies co
 where co.id = c.company_id
   and c.locked
   and co.plan = 'trial'
   and (co.trial_ends_at is null or c.created_at <= co.trial_ends_at);
