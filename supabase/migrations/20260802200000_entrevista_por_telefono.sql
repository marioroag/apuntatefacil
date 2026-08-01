-- ============================================================================
-- Apúntate Fácil · la entrevista por teléfono deja de ser un caso raro
-- ----------------------------------------------------------------------------
-- `interviews.mode` admite 'telefonica' desde 20260801180000, pero la
-- modalidad POR DEFECTO de cada anfitrión no: nació con dos opciones porque la
-- llamada se pensó solo para el día en que la condujéramos nosotros.
--
-- No hace falta esperar a eso. Quien llama es la empresa, como llamaría de
-- siempre, y todo lo demás ya funciona: la agenda es la suya, el agente cuadra
-- la hora por WhatsApp y la confirmación dice "Te llamamos por teléfono". En
-- construcción y en logística la criba se hace por teléfono mucho más a menudo
-- que por videollamada, así que la opción que faltaba era justo la más usada.
--
-- Nada más que tocar: `resolver_lugar_entrevista` ya devuelve el sitio vacío
-- para cualquier modalidad que no sea presencial (una llamada no tiene
-- dirección, igual que una videollamada), y ni `start_interview_invitation` ni
-- `create_manual_interview` filtran modalidades.
-- ============================================================================

alter table public.interview_hosts drop constraint interview_hosts_default_mode_check;
alter table public.interview_hosts add constraint interview_hosts_default_mode_check
  check (default_mode in ('presencial', 'videollamada', 'telefonica'));

comment on column public.interview_hosts.default_mode is
  'Modalidad con la que vienen prerrellenadas sus invitaciones. Cada entrevista puede cambiarla.';
