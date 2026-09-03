-- ============================================================================
-- Apúntate Fácil · CÓMO TIENES PUESTA LA MESA: tus preferencias de presentación
-- viajan con TU CUENTA, no con el navegador (Mario, sep 2026)
-- ----------------------------------------------------------------------------
-- El orden de las columnas, cuáles ves y qué anchos les has dado vivían en
-- `localStorage`, o sea en UNA máquina: al pasar del portátil al monitor
-- empezabas de cero, y dos personas que comparten navegador compartían la
-- configuración porque la clave no llevaba ni usuario ni empresa.
--
-- El argumento que dejó los anchos en local ("el ancho cómodo depende de la
-- pantalla que tienes delante, no de quién eres") era bueno para los ANCHOS y
-- nunca lo fue para el ORDEN ni para QUÉ COLUMNAS te importan, que no dependen
-- del monitor sino de cómo trabajas. Y aun para los anchos se paga poco: en
-- móvil el ajuste está apagado (así que un teléfono no hereda los de un
-- monitor), lo que no cabe saca el desplazamiento horizontal que la tabla ya
-- tiene, y devolverlo todo a fábrica es un doble clic en cualquier filo.
--
-- Va en `profiles` y no en `companies` por lo mismo que `email_prefs`: es de la
-- PERSONA. En dos equipos eres el mismo y miras la tabla igual.
--
-- JSONB, y por el mismo motivo que `email_prefs`, `fields` y `branding`: esto va
-- a crecer (mañana habrá otra rejilla, u otra preferencia de presentación) y
-- añadir una no puede costar una migración. Nada de aquí dentro se consulta ni
-- se ordena en SQL: es un cajón que el cliente escribe y lee entero.
--
-- Nace '{}' y no NULL: aquí "no hay nada guardado" y "está vacío" significan lo
-- mismo, que es estar en los valores de fábrica, y esos siempre son correctos.
-- (En `campaigns.anuncio` sí se distinguen, porque allí NULL quiere decir "este
-- puesto es anterior al anuncio".)
--
-- Los grants de `profiles` son de tabla y no por columnas, así que no hace falta
-- tocarlos: la policy ya dice lo único que importa aquí, que solo escribes el
-- tuyo. Nadie le reordena la tabla a nadie.
-- ============================================================================

alter table public.profiles
  add column ui_prefs jsonb not null default '{}'::jsonb;

-- Cota de tamaño, como `campaigns_baremo_size`: un jsonb que escribe el cliente
-- sin tope es un sitio donde meter lo que sea. 20.000 caracteres son de sobra
-- para lo que hay (unos cuantos anchos y dos listas de claves de columna) y el
-- cliente recorta antes de escribir, así que este check es el cinturón y no el
-- mecanismo: si salta, es que algo está guardando lo que no debe.
alter table public.profiles
  add constraint profiles_ui_prefs_size check (length(ui_prefs::text) <= 20000);
