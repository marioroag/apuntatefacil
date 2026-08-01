-- ============================================================================
-- Apúntate Fácil: quién entrevista
-- ----------------------------------------------------------------------------
-- Hasta ahora toda entrevista la hacía una persona de la empresa, y de ahí
-- salían dos reglas: el horario disponible es el suyo, y no puede tener dos
-- citas a la vez.
--
-- Se prepara el caso en el que entrevistamos NOSOTROS (llamada automática). Ahí
-- ninguna de las dos reglas aplica: no hay agenda de nadie que respetar y se
-- puede llamar a quince candidatos a la vez.
--
-- El cambio es deliberadamente pequeño, y se hace AHORA y no cuando llegue la
-- voz, porque tocar después una tabla con entrevistas reales dentro (aflojar un
-- not null, ampliar dos checks, revisar la constraint de solape) es un rato
-- desagradable que aquí cuesta una migración de treinta líneas.
--
-- Lo bonito es que la regla de no solaparse se desactiva SOLA: una constraint
-- de exclusión no considera en conflicto dos filas cuyo operando es null, así
-- que las entrevistas sin anfitrión humano nunca chocan entre sí. Verificado
-- contra esta misma base, no supuesto.
-- ============================================================================

-- 'empresa'   -> la hace una persona del cliente. Necesita anfitrión y agenda.
-- 'apuntate'  -> la hacemos nosotros. Sin anfitrión, sin límite de solape.
alter table public.interviews
  add column interviewer text not null default 'empresa'
    check (interviewer in ('empresa', 'apuntate'));

-- El anfitrión pasa a ser opcional, pero solo puede faltar si entrevistamos
-- nosotros: una entrevista de la empresa sin responsable es un agujero, no un
-- caso de uso.
alter table public.interviews alter column host_user_id drop not null;
alter table public.interviews add constraint interviews_anfitrion_si_empresa
  check (interviewer <> 'empresa' or host_user_id is not null);

-- Tercera modalidad. Presencial y videollamada son sitios a los que el
-- candidato va; 'telefonica' es al revés: le llamamos nosotros a él.
alter table public.interviews drop constraint interviews_mode_check;
alter table public.interviews add constraint interviews_mode_check
  check (mode in ('presencial', 'videollamada', 'telefonica'));

comment on column public.interviews.interviewer is
  'Quién conduce la entrevista: la empresa (persona, con agenda) o nosotros (automática).';
