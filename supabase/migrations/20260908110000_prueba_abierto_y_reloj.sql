-- ============================================================================
-- LA PRUEBA CUENTA LO ABIERTO, EL RELOJ NO ARRANCA CON UN PUESTO A LA ESPERA,
-- Y LAS CUENTAS ANTIGUAS EMPIEZAN A CONTAR (revisión del circuito de pago,
-- sep 2026, antes de empezar a vender).
--
-- 1) En la prueba, "abierto" es lo mismo que en el pago: lo que no está
--    cerrado. El tope de la prueba contaba solo los puestos 'activa', así que
--    se podía tener uno en línea y varios pausados; al activar el pago se
--    cobraban TODOS los no cerrados (pausados incluidos) y Facturación llegaba
--    a decir "3 de 1". La regla del producto es una: pausar no libera hueco.
--    Los tiers antiguos (esencial/pro/multi) conservan su contrato de siempre.
--
-- 2) El reloj de los 15 días arranca al abrir el primer puesto, no al
--    insertarlo: un puesto creado A LA ESPERA DEL PAGO (el asistente lo crea
--    cerrado y Checkout lo abre) no es un proceso que se esté probando. Sin
--    esto, una cuenta antigua que probara a crear un segundo puesto y cancelara
--    el pago veía arrancar su reloj sin que nadie se lo dijera.
--
-- 3) Las cuentas creadas antes de que existiera el reloj (agosto de 2026)
--    tenían una prueba sin fin: su puesto llevaba meses recogiendo candidatos
--    gratis. Mario decidió (8-sep-2026) arrancarles el reloj con aviso: 15 días
--    desde este despliegue, y un correo a las que tienen actividad. Solo a las
--    que ya tienen algún puesto; a las que no, se les arranca al abrir el
--    primero, como a cualquier cuenta nueva.
--
-- 4) `closed_at` distingue un puesto CERRADO de uno que nunca llegó a abrirse
--    (creado a la espera del pago): el trigger lo estampa solo al pasar a
--    cerrado, así que el pendiente lo tiene a NULL. Los cerrados anteriores al
--    trigger también lo tenían a NULL y se leerían como pendientes: se rellena
--    con su fecha de creación, que es lo más cercano a la verdad que queda.
-- ============================================================================

create or replace function public.enforce_process_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan text;
  v_paid integer;
  v_limit integer;
  v_count integer;
begin
  if new.status = 'cerrada' then
    return new; -- cerrar nunca se bloquea
  end if;
  select plan, paid_processes into v_plan, v_paid
    from public.companies where id = new.company_id;

  if v_plan in ('proceso', 'trial') then
    -- Solo consume hueco lo que se ABRE: un insert abierto o salir de 'cerrada'.
    if tg_op = 'UPDATE' and old.status <> 'cerrada' then
      return new; -- activa <-> pausada: sigue abierto, mismo hueco
    end if;
    -- La prueba cubre UN proceso abierto; el pago, los que se pagan.
    if v_plan = 'trial' then
      v_paid := 1;
    end if;
    select count(*) into v_count
      from public.campaigns
      where company_id = new.company_id and status <> 'cerrada' and id <> new.id;
    if v_count >= v_paid then
      raise exception 'PLAN_LIMIT_REACHED'
        using errcode = 'P0001',
              hint = case when v_plan = 'trial'
                then 'La prueba incluye un proceso abierto. Añade tu método de pago para abrir otro.'
                else 'Abrir otro proceso son 49 €/mes. Añádelo desde el panel.' end;
    end if;
    return new;
  end if;

  -- Tiers legacy: semántica original (solo 'activa' consume cupo).
  if new.status <> 'activa' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'activa' then
    return new;
  end if;
  v_limit := public.plan_process_limit(v_plan);
  select count(*) into v_count
    from public.campaigns
    where company_id = new.company_id and status = 'activa' and id <> new.id;
  if v_count >= v_limit then
    raise exception 'PLAN_LIMIT_REACHED'
      using errcode = 'P0001',
            hint = 'Pausa o cierra un puesto activo, o añade tu método de pago.';
  end if;
  return new;
end
$$;

create or replace function public.start_trial_clock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Un puesto que nace cerrado (a la espera del pago) no abre ninguna prueba.
  if new.status = 'cerrada' then
    return new;
  end if;
  update public.companies
     set trial_ends_at = now() + interval '15 days'
   where id = new.company_id and plan = 'trial' and trial_ends_at is null;
  return new;
end
$$;

-- El reloj también arranca al REABRIR (salir de 'cerrada') si nunca arrancó:
-- es la primera vez que ese proceso está abierto de verdad.
drop trigger if exists trg_start_trial_clock on public.campaigns;
create trigger trg_start_trial_clock
  after insert or update of status on public.campaigns
  for each row execute function public.start_trial_clock();

-- 4) Los cerrados de antes del trigger no son "pendientes de pago".
update public.campaigns
   set closed_at = created_at
 where status = 'cerrada' and closed_at is null;

-- 3) Las cuentas antiguas en prueba empiezan a contar hoy.
update public.companies co
   set trial_ends_at = now() + interval '15 days'
 where co.plan = 'trial'
   and co.trial_ends_at is null
   and exists (select 1 from public.campaigns c where c.company_id = co.id and c.status <> 'cerrada');
