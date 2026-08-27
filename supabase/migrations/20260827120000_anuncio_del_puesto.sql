-- ==========================================================================
-- EL ANUNCIO DEL PUESTO (ago 2026).
--
-- Lo que se lee ANTES del formulario: dónde es, cómo se trabaja, cuánto paga,
-- qué se pide y qué se hace. Hasta hoy el enlace abría el formulario a secas y
-- quien llegaba decidía si apuntarse sin saber nada de eso.
--
-- POR QUÉ JSONB Y NO OCHO COLUMNAS. La forma la define `Anuncio` en
-- src/lib/anuncio.ts, y este objeto va a crecer (contrato, jornada, beneficios,
-- lo que el mercado pida). Añadir un campo de un anuncio no puede costar una
-- migración, que es exactamente el argumento por el que `profiles.email_prefs`,
-- `campaigns.fields` y `campaigns.branding` ya son jsonb. Nada de aquí dentro se
-- consulta ni se ordena en SQL: se lee entero y se pinta.
--
-- Nace NULL a propósito, no con un objeto por defecto: `null` significa "este
-- puesto es anterior al anuncio y no lo tiene", que es distinto de "lo tiene y
-- está vacío". El cliente normaliza en `leerAnuncio`, así que la pantalla no ve
-- la diferencia; la ve quien tenga que migrar los viejos.
--
-- Tope defensivo de tamaño, en la línea de `campaigns_baremo_size` y
-- `candidates_ai_size`: un anuncio son unos cuantos párrafos y dos listas
-- cortas. Sin tope, un `jsonb` que escribe el cliente es un sitio donde meter lo
-- que sea.
-- ==========================================================================

alter table public.campaigns
  add column if not exists anuncio jsonb;

alter table public.campaigns
  drop constraint if exists campaigns_anuncio_size;
alter table public.campaigns
  add constraint campaigns_anuncio_size
  check (anuncio is null or length(anuncio::text) <= 20000);

-- El UPDATE de campaigns es POR COLUMNAS desde el pago por proceso
-- (20260824120000): lo que no se nombre aquí, el cliente no lo puede escribir
-- aunque la RLS le deje tocar la fila. El anuncio lo escribe el merchant desde
-- el asistente de creación y desde el constructor, así que va en la lista.
grant update (anuncio) on public.campaigns to authenticated;
