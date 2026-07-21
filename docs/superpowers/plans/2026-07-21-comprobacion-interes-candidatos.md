# Plan de implementación: comprobación de interés por email

Fecha: 21 de julio de 2026

Especificación: `docs/superpowers/specs/2026-07-21-comprobacion-interes-candidatos-design.md`

## Resultado esperado

Una empresa podrá seleccionar candidatos, revisar quién es elegible, enviar una plantilla fija por Resend, recoger una respuesta confirmada en una ruta pública y filtrar el panel por la señal de interés. El flujo conservará historial, respetará los plazos aprobados y no modificará los estados del proceso de selección.

## Restricciones de implementación

- Mantener el alcance limitado al email.
- No desplegar migraciones a producción sin aprobación explícita de Mario.
- Mantener el rol `anon` sin acceso directo a las tablas.
- Autorizar envíos con el JWT y el alcance real de RLS, incluidas las sedes de encargados.
- No registrar respuestas en peticiones GET.
- No añadir tracking de aperturas o clics.
- Simular el flujo en `/demo`, sin invocar Resend.
- Verificar en navegador escritorio y móvil antes de cerrar.

## Tarea 1: dominio y tipos de interés

Archivos:

- Crear `src/lib/interest.ts`.
- Crear `src/lib/interest.test.ts`.
- Modificar `src/lib/types.ts`.

Pasos:

1. Añadir los tipos `CandidateInterestResponse`, `CandidateInterestState` y `CandidateInterestSummary`.
2. Mantener la señal como propiedad opcional de `Candidate` para que datos demo o cargas antiguas sigan siendo válidos.
3. Implementar funciones puras para:
   - Extraer el primer campo de tipo `email` con valor, siguiendo el orden del formulario.
   - Normalizar con `trim()` y minúsculas, sin reglas específicas de Gmail u otros proveedores.
   - Derivar `sent`, `no_response`, `interested`, `not_interested` o `unavailable` a partir de fechas y respuesta.
   - Calcular si corresponde primer envío, recordatorio, nueva comprobación o exclusión.
   - Agrupar candidatos por dirección normalizada sin mezclar candidatos no elegibles.
4. Probar límite de 7 días, reenvío único, nueva comprobación positiva a 30 días, bloqueo tras respuesta negativa, token sustituido y direcciones duplicadas.

Comprobación:

```bash
npm test -- src/lib/interest.test.ts
```

Commit sugerido: `test: definir reglas de comprobación de interés`

## Tarea 2: esquema, RLS y operaciones atómicas

Archivos:

- Crear `supabase/migrations/20260721160000_candidate_interest_checks.sql`.
- Crear `supabase/tests/candidate_interest_checks.sql`.

Pasos:

1. Crear `candidate_interest_batches`, `candidate_interest_checks` y `candidate_interest_check_candidates` con claves foráneas, checks, índices y timestamps descritos en la especificación.
2. Añadir una clave de idempotencia única por empresa para que un reintento del mismo lote devuelva el resultado existente.
3. Guardar solo el hash SHA-256 del token; generar el token con `gen_random_bytes(32)` dentro de una operación de servidor.
4. Aplicar RLS a las tres tablas:
   - Lectura autenticada limitada a candidatos visibles para ese usuario.
   - Sin acceso directo para `anon`.
   - Escritura ordinaria solo a través de operaciones controladas.
5. Crear una operación autenticada y transaccional que prepare un lote:
   - Valide `auth.uid()`.
   - Valide empresa, puesto, sede, candidatura bloqueada y máximo de 200 emails únicos.
   - Extraiga el primer campo de email definido en `campaigns.fields`.
   - Aplique historial y plazos en base de datos, no solo en React.
   - Agrupe duplicados y devuelva el token en claro una sola vez para el envío.
6. Cuando una dirección agrupe candidatos con modos distintos, no permitir que una candidatura nueva eluda la cadencia de otra:
   - Priorizar un recordatorio ya vencido para esa dirección.
   - Vincular solo las candidaturas elegibles para ese ciclo.
   - Omitir el resto como duplicados con historial incompatible.
7. Crear una operación autenticada para finalizar cada entrega como `sent` o `failed`, guardando el ID de Resend y un error saneado.
8. Crear una consulta autenticada que devuelva el último resumen por candidato sin exponer el historial completo ni saltarse RLS.
9. Crear dos RPC públicas `security definer` de privilegio mínimo:
   - Contexto no sensible del token para la página pública.
   - Confirmación POST de `interested` o `not_interested`.
10. Validar caducidad de 60 días, sustitución por un ciclo nuevo y corrección de respuesta.
11. Añadir limpieza: campaña elimina lotes y comprobaciones; candidato elimina su vínculo; una comprobación sin vínculos se elimina.
12. Probar empresa A/B, encargado por sede, rol anónimo, candidatos bloqueados, idempotencia, duplicados, recordatorio y tokens.

Comprobación local:

```bash
supabase db reset
supabase test db
```

No ejecutar `supabase db push` en esta tarea.

Commit sugerido: `feat: añadir persistencia segura de comprobaciones`

## Tarea 3: envío autenticado con Resend

Archivos:

- Crear `supabase/functions/send-interest-check/index.ts`.
- Modificar `supabase/functions/_shared/email.ts` solo si hace falta una variante reutilizable para dos botones.
- Modificar `supabase/config.toml`.
- Modificar `.env.example` y `DEPLOY.md` si aparece un secret nuevo. La implementación prevista reutiliza `RESEND_API_KEY`, `NOTIFY_FROM` y `APP_URL`.

Pasos:

1. Configurar `send-interest-check` con `verify_jwt = true`.
2. Crear un cliente Supabase con el JWT entrante para preparar el lote bajo el usuario real.
3. Aceptar `campaign_id`, `candidate_ids` e `idempotency_key`; no aceptar emails escritos por el cliente.
4. Recibir del RPC las direcciones elegibles, tipo de mensaje y tokens efímeros.
5. Renderizar dos plantillas fijas:
   - Primer envío o nueva comprobación.
   - Recordatorio único.
6. Resolver la identidad visible como marca vinculada o, en su defecto, empresa.
7. Generar enlaces a `/respuesta/:token?opcion=interested|not_interested`.
8. Desactivar tracking de aperturas y clics si la configuración de Resend lo permite a nivel de envío o dominio.
9. Enviar cada dirección una vez, registrar respuestas parciales y no marcar `sent` si Resend rechaza la petición.
10. Limitar la concurrencia para no abrir cientos de conexiones simultáneas.
11. Devolver un resultado estructurado con enviados, omitidos por motivo y fallidos reintentables.
12. Evitar incluir tokens, emails completos o cuerpo del mensaje en logs.

Comprobación:

```bash
supabase functions serve send-interest-check
```

Probar un lote pequeño con Mailpit o una respuesta simulada de Resend antes de usar direcciones reales.

Commit sugerido: `feat: enviar comprobaciones de interés por email`

## Tarea 4: carga y actualización del estado en el store

Archivos:

- Modificar `src/lib/store.tsx`.
- Modificar `src/lib/types.ts` si la forma final del RPC requiere un mapper adicional.

Pasos:

1. Añadir el tipo de fila del resumen de interés y su conversión a `CandidateInterestSummary`.
2. Cargar los resúmenes junto a candidatos y etiquetas, siempre filtrando por la empresa activa.
3. Integrar el resumen opcional en cada `Candidate` sin cambiar la tabla `candidates`.
4. Extender `reloadCandidatesFor` para refrescar también las señales del puesto.
5. Exponer una acción `sendInterestCheck(candidateIds, idempotencyKey)` que:
   - Simule el resultado en demo.
   - Invoque la Edge Function en real.
   - Refresque solo el puesto afectado después del lote.
6. Mantener escrituras optimistas fuera de la señal de interés; el servidor será la fuente de verdad tras un envío.
7. Versionar la clave local de la demo o migrar los candidatos guardados para admitir la propiedad nueva.

Comprobación:

```bash
npx tsc --noEmit
npm test
```

Commit sugerido: `feat: cargar señales de interés en candidatos`

## Tarea 5: email obligatorio y avisos del constructor

Archivos:

- Modificar `src/lib/defaults.ts`.
- Modificar `src/lib/templates.ts`.
- Modificar `src/screens/Builder.tsx`.
- Modificar o reutilizar `src/components/ui/ConfirmDialog.tsx` sin cambiar su API si no es necesario.

Pasos:

1. Cambiar el campo `email` del formulario base a `required: true`.
2. Añadir un campo `email` obligatorio a `SYS` para que todas las plantillas sectoriales lo incorporen en una posición coherente, después del teléfono.
3. Interceptar únicamente dos acciones sobre campos de tipo `email`:
   - Desmarcar **Obligatorio**.
   - Eliminar el campo.
4. Mostrar el copy aprobado y ejecutar el cambio solo tras confirmación.
5. **Mantener obligatorio** y **Mantener campo** cancelan sin escribir ni cerrar el editor de forma inesperada.
6. No mostrar el aviso al hacer el campo más estricto ni al eliminar otros tipos de campo.
7. Conservar el undo actual después de una eliminación confirmada.
8. Verificar que la validación pública sigue ocurriendo al blur y al enviar, nunca al teclear.

Comprobación:

```bash
npm test
npx tsc --noEmit
```

Commit sugerido: `feat: pedir email por defecto en nuevos puestos`

## Tarea 6: ruta pública de confirmación

Archivos:

- Crear `src/screens/InterestResponse.tsx`.
- Modificar `src/main.tsx`.
- Reutilizar `src/components/Logo.tsx`, `src/lib/brandAsset.ts` y tokens de `src/index.css` cuando corresponda.

Pasos:

1. Registrar `/respuesta/:token` antes de las rutas públicas genéricas `/:brandSlug/:slug` para evitar colisiones.
2. Leer `opcion` de la URL, aceptar solo `interested` y `not_interested`, y solicitar el contexto público sin escribir.
3. Mostrar empresa o marca, puesto, opción elegida y **Confirmar respuesta**.
4. Enviar la mutación solo con un clic explícito o activación de teclado.
5. Implementar estados de carga, confirmado, token inválido, caducado, sustituido y error reintentable.
6. Permitir corregir la respuesta abriendo el otro botón mientras el token esté activo.
7. No mostrar datos personales ni enlaces a la candidatura.
8. Diseñar mobile-first, con targets de 44 px, foco visible y `prefers-reduced-motion`.

Comprobación manual:

- Abrir ambos enlaces sin confirmar y comprobar en SQL que no cambia la respuesta.
- Confirmar cada opción y comprobar el resultado en el panel.
- Simular token caducado y sustituido.

Commit sugerido: `feat: confirmar interés desde enlace público`

## Tarea 7: acción masiva, señales y filtros del panel

Archivos:

- Crear `src/components/InterestCheckDialog.tsx`.
- Crear `src/components/InterestSignal.tsx`.
- Modificar `src/screens/Dashboard.tsx`.
- Modificar `src/screens/CandidatePanel.tsx`.

Pasos:

1. Añadir **Comprobar interés** a la barra de selección de escritorio y a la barra inferior móvil.
2. Construir la previsualización local con los mismos helpers del dominio; el servidor repite la validación al confirmar.
3. Mostrar elegibles y omitidos agrupados por motivo, incluidos emails ausentes, duplicados, bloqueados y plazos.
4. Si el puesto no incluye ningún campo de email, sustituir el envío por una explicación y **Añadir email al formulario**, que navega al constructor.
5. Enviar con una idempotency key estable durante el intento y bloquear el botón mientras está en curso.
6. Mostrar resultado parcial y permitir reintentar solo fallidos.
7. Añadir la señal aprobada a tabla, tarjetas móviles y detalle del candidato.
8. Mantener el estado de selección existente completamente separado.
9. Añadir filtros: sigue interesado, ya no le interesa, comprobación enviada, sin respuesta y nunca comprobado.
10. Usar verde semántico para la respuesta positiva; usar grafito para negativa, pendiente y sin respuesta; nunca ultramarine como estado ni rojo para negativa.
11. Incluir fecha relativa y fecha completa accesible mediante `title` o texto secundario.
12. Después de un envío, limpiar la selección solo cuando el resultado haya sido recibido y conservarla si la petición falla por completo.

Comprobación manual:

- Selección mixta en escritorio y móvil.
- Lote de más de 200 direcciones.
- Candidatos sin email, duplicados y con historial.
- Navegación por teclado y lector de estado.
- Panel lateral abierto durante un refresco de señales.

Commit sugerido: `feat: comprobar interés desde el panel`

## Tarea 8: demo, datos y documentación legal

Archivos:

- Modificar `src/lib/seed.ts`.
- Modificar `src/lib/store.tsx` para la simulación demo si no quedó completa en la tarea 4.
- Modificar `src/lib/legal.ts`.
- Modificar `DEPLOY.md`.

Pasos:

1. Añadir ejemplos demo de todos los estados: interesado, no interesado, enviado y sin respuesta.
2. Simular envío y recordatorio en `localStorage`, con un aviso explícito de que no se enviará ningún correo.
3. Confirmar que ninguna ruta demo invoca la Edge Function.
4. Actualizar la política de privacidad para incluir:
   - Email del candidato como dato solicitado por defecto, aunque configurable.
   - Envío de comprobaciones operativas por cuenta de la empresa responsable.
   - Respuesta y fechas como datos de gestión de la candidatura.
   - Uso de Resend para estos correos.
5. Actualizar términos y anexo de encargo donde enumeran funciones, naturaleza del tratamiento y emails transaccionales.
6. Actualizar `DEPLOY.md` con despliegue de la función, secretos reutilizados y prueba de dominio remitente.

Comprobación:

- Revisar todo el bloque legal, no solo frases aisladas, para evitar contradicciones.
- Buscar afirmaciones antiguas que limiten Resend a avisos de nueva candidatura.

Commit sugerido: `docs: documentar comprobaciones de interés`

## Tarea 9: verificación integral antes de cerrar

Archivos:

- Modificar los archivos anteriores solo para corregir hallazgos.
- Añadir capturas de verificación fuera del commit si son artefactos temporales.

Pasos:

1. Ejecutar migraciones desde cero y todos los tests SQL.
2. Ejecutar unit tests, TypeScript, lint y build.
3. Servir Edge Functions y probar el correo completo en Mailpit.
4. Verificar en navegador:
   - Constructor, email obligatorio y ambos avisos.
   - Selección masiva, modal, envío, fallo parcial y reintento.
   - Tabla, filtros, detalle y actualización tras respuesta.
   - Página pública para sí, no, corrección, caducado y sustituido.
   - Escritorio y móvil.
   - Demo sin envío real.
5. Verificar accesibilidad: foco, teclado, contraste, texto más color y targets táctiles.
6. Revisar que no existan logs con tokens, emails completos o respuestas personales.
7. Revisar el diff final para evitar cambios fuera de alcance.

Comandos finales:

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
```

No ejecutar `supabase db push` ni desplegar funciones a producción sin aprobación explícita.

Commit sugerido: `test: verificar comprobación de interés por email`

## Orden de entrega

1. Dominio puro y tests.
2. Migración, RLS y pruebas SQL.
3. Envío autenticado.
4. Store y carga de señales.
5. Email obligatorio y avisos.
6. Respuesta pública.
7. Panel y filtros.
8. Demo y textos legales.
9. Verificación integral.

Este orden mantiene cada capa comprobable antes de conectar la siguiente y evita construir la interfaz sobre contratos de backend todavía inestables.
