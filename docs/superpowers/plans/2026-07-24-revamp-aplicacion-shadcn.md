# Plan de implementación: revamp de la aplicación con shadcn/ui

Fecha: 24 de julio de 2026

Especificación: `docs/superpowers/specs/2026-07-24-revamp-aplicacion-shadcn-design.md`

## Resultado esperado

La aplicación privada de Apúntate Fácil tendrá un nuevo espacio de trabajo
construido con shadcn/ui sobre Base UI. Mantendrá Geist, ultramarine, grafitos,
estados de candidato, reglas de producto y lógica existente, pero renovará
shell, jerarquía, composición, controles, estados y flujos.

El resultado no será una reproducción de las pantallas actuales con primitives
nuevos. Cada superficie se recompondrá siguiendo el diseño aprobado.

## Restricciones de implementación

- Limitar el revamp a `/app` y a `/demo`, que comparte intencionadamente el mismo
  `AppLayout` y las mismas pantallas.
- Mantener landing, login, formulario público, respuesta pública y documentos
  legales visualmente intactos.
- Mantener solo modo claro.
- No cambiar React Router, Supabase, store, permisos, precios ni reglas de
  negocio.
- No introducir búsqueda global ni funciones nuevas.
- No sustituir `CandidateTable` por una tabla genérica o TanStack Table.
- No sustituir `FieldRenderer`, `ApplicationForm` ni la lógica dnd-kit.
- No ejecutar `shadcn apply` ni usar `--overwrite`.
- Ejecutar CLI siempre desde `/Users/mario/criba` y revisar `--dry-run` y `--diff`.
- No eliminar `src/lib/buttons.ts` mientras tenga consumidores fuera de `/app`.
- Verificar cambios visibles en navegador antes de cerrar cada fase.
- No desplegar ni publicar sin una petición separada del usuario.

## Riesgos que deben resolverse antes del primer componente

### Colisión del token `--accent`

En shadcn, `accent` suele ser una superficie neutral de hover o selección. En
este proyecto, `--accent` ya es el color configurable de marca o campaña y
alimenta el formulario público y su preview.

La solución será:

- Mantener el `--accent` global actual fuera de la aplicación.
- Definir los tokens semánticos shadcn bajo una clase `app-ui`.
- Usar `--primary` para el ultramarine de acciones.
- Usar `--ring` para foco ultramarine.
- Usar `--accent` dentro de `app-ui` como superficie neutral de interacción.
- Aplicar y retirar `app-ui` en `document.documentElement` desde un límite de
  tema, para que los portales a `body` hereden los tokens.
- Envolver también `/dev/playground` con el mismo límite.
- Comprobar tras cada fase que el formulario público sigue usando el acento del
  cliente y que su preview sigue siendo idéntica.

### Colisión de nombres en macOS

El repositorio contiene `src/components/ui/Button.tsx` y
`src/components/ui/Checkbox.tsx`; shadcn genera normalmente `button.tsx` y
`checkbox.tsx`. En un volumen macOS sin distinción de mayúsculas estos nombres
colisionan.

Los componentes anteriores se moverán primero a un namespace legacy con
`git mv`, sin cambios de comportamiento. Nunca se resolverá la colisión
sobrescribiendo archivos.

### Portales y overlays anidados

Base UI puede renderizar overlays en `body`. Además, `TeamRequestPanel` abre
detalles sobre otro panel. Cada migración de Dialog, Sheet, Drawer, Popover o
menú debe verificar:

- Escape actúa solo sobre la capa superior.
- Focus trap y retorno de foco.
- Scroll lock.
- Inertness del panel inferior.
- Tokens `app-ui` dentro del portal.

## Gate técnico común

Después de cada tarea:

```bash
cd /Users/mario/criba && npm test
cd /Users/mario/criba && npm run lint
cd /Users/mario/criba && npx tsc --noEmit
cd /Users/mario/criba && npm run build
```

Si una fase parte de un fallo ya existente, registrarlo antes de editar y no
introducir fallos nuevos.

## Tarea 1: capturar la línea base y despejar colisiones

Archivos:

- Mover `src/components/ui/Button.tsx` a
  `src/components/legacy-ui/Button.tsx`.
- Mover `src/components/ui/Checkbox.tsx` a
  `src/components/legacy-ui/Checkbox.tsx`.
- Modificar los imports consumidores, incluidos:
  - `src/screens/Soporte.tsx`
  - `src/screens/Builder.tsx`
  - `src/screens/Marcas.tsx`
  - `src/screens/Dashboard.tsx`
  - `src/screens/Login.tsx`

Pasos:

1. Ejecutar el gate técnico antes de editar y registrar el resultado.
2. Arrancar la aplicación y capturar como referencia:
   - `/`
   - `/login`
   - `/demo/resumen`
   - `/demo/puestos/cmp_peon`
   - `/demo/puestos/cmp_peon/formulario`
   - Un formulario público válido o su fixture local.
3. Capturar escritorio `1440×900` y móvil `390×844`.
4. Mover únicamente Button y Checkbox legacy para evitar colisiones de casing.
5. Actualizar imports sin alterar JSX, clases ni comportamiento.
6. Confirmar que no se han creado todavía componentes shadcn.
7. Repetir el gate técnico y un smoke visual de login, dashboard y builder.

Comprobación adicional:

```bash
find src/components \( -iname 'button.tsx' -o -iname 'checkbox.tsx' \)
```

Debe existir una única ruta por nombre sin colisiones.

Commit sugerido: `refactor: preparar namespace ui para shadcn`

## Tarea 2: inicializar shadcn y el límite de tema

Archivos:

- Crear `components.json`.
- Modificar `package.json`.
- Modificar `package-lock.json`.
- Modificar `tsconfig.json`.
- Modificar `tsconfig.app.json`.
- Modificar `vite.config.ts`.
- Crear `src/lib/utils.ts`.
- Modificar `src/index.css`.
- Crear `src/components/app/AppThemeBoundary.tsx`.
- Modificar `src/screens/AppLayout.tsx`.
- Modificar `src/screens/Playground.tsx`.

Pasos:

1. Inspeccionar el proyecto:

   ```bash
   cd /Users/mario/criba
   npx shadcn@latest info --json
   npx shadcn@latest init --help
   ```

2. Inicializar para Vite y Base UI, con variables CSS y sin reinstalar
   componentes:

   ```bash
   npx shadcn@latest init -t vite -b base --css-variables --no-reinstall
   ```

3. Revisar inmediatamente el diff. No aceptar que el CLI sustituya:
   - La fuente Geist.
   - Las rampas grafito y ultramarine.
   - El `--accent` global del formulario público.
   - Los estilos base actuales de body, foco, selección o inputs.
4. Añadir el alias `@/*` → `./src/*` a TypeScript y Vite sin convertir los
   imports existentes de forma masiva.
5. Mantener `src/index.css` como único fichero global de tokens.
6. Registrar los tokens semánticos shadcn en Tailwind v4 mediante
   `@theme inline`, pero definir sus valores bajo `.app-ui`.
7. Mapear:
   - `primary` a ultramarine.
   - `primary-foreground` a blanco.
   - `ring` a ultramarine.
   - `background`, `card`, `muted`, `border` e `input` a grafitos.
   - `accent` a superficie neutral, no a ultramarine.
   - `destructive` a rojo real.
   - `sidebar-*` a la nueva jerarquía del shell.
   - Estados de candidato a tokens propios independientes.
8. Implementar `AppThemeBoundary`:
   - Renderizar un wrapper `.app-ui`.
   - Añadir `.app-ui` a `document.documentElement` con una operación idempotente
     antes de que el usuario pueda abrir un overlay.
   - Retirar la clase al desmontar.
   - Funcionar correctamente bajo React StrictMode.
9. Envolver `AppLayout`, por lo que `/app` y `/demo` compartirán el tema.
10. Envolver explícitamente el contenido de `/dev/playground`.
11. Navegar desde `/app` o `/demo` a una ruta pública y confirmar que la clase se
    retira.

Comprobación:

```bash
npx shadcn@latest info --json
rg -n -- '--accent|--primary|--ring|app-ui' src/index.css src/components/app/AppThemeBoundary.tsx
```

Verificación visual obligatoria:

- Landing y login idénticos a la línea base.
- Formulario público conserva el acento del cliente.
- `/demo` y Playground reciben los tokens nuevos.

Commit sugerido: `feat: configurar shadcn y tema aislado de la app`

## Tarea 3: añadir y adaptar los primitives centrales

Archivos:

- Crear componentes shadcn lowercase en `src/components/ui/`.
- Modificar `src/index.css` solo si un primitive requiere un token compartido.
- Crear o modificar variantes centrales dentro de los primitives generados.
- Mantener temporalmente:
  - `src/components/ui/Toast.tsx`
  - `src/components/ui/ConfirmDialog.tsx`
  - `src/components/ui/SlideOver.tsx`
  - `src/components/ui/BottomSheet.tsx`
  - `src/components/ui/StatusPill.tsx`

Primer lote:

- `button`
- `field`
- `input`
- `input-group`
- `textarea`
- `checkbox`
- `select`
- `switch`
- `toggle-group`
- `card`
- `item`
- `badge`
- `separator`
- `skeleton`
- `spinner`
- `alert`
- `empty`

Segundo lote:

- `dialog`
- `alert-dialog`
- `sheet`
- `drawer`
- `popover`
- `dropdown-menu`
- `tooltip`
- `command`
- `sidebar`
- `tabs`
- `resizable`
- `table`
- `sonner`

Pasos:

1. Consultar la documentación actual antes de cada lote:

   ```bash
   npx shadcn@latest docs button field input textarea checkbox select card
   npx shadcn@latest docs dialog alert-dialog sheet drawer popover sidebar command
   ```

2. Previsualizar cada lote:

   ```bash
   npx shadcn@latest add button field input input-group textarea checkbox select switch toggle-group card item badge separator skeleton spinner alert empty --dry-run
   npx shadcn@latest add dialog alert-dialog sheet drawer popover dropdown-menu tooltip command sidebar tabs resizable table sonner --dry-run
   ```

3. Resolver cualquier fichero existente con `--diff`; no usar `--overwrite`.
4. Añadir los componentes en lotes pequeños y leer todos los archivos generados.
5. Mantener Base UI como única base. Usar `render`, no `asChild`, en triggers.
6. Adaptar una sola vez los primitives:
   - Button con relieve instrumento, press `translate-y-px` y variantes primary,
     secondary, outline, ghost y destructive.
   - Campos con radio 10 px, foco visible y estados `data-invalid`.
   - Overlays con `shadow-pop`, sin z-index manual desde consumidores.
   - Movimiento 120/180/240 ms y `prefers-reduced-motion`.
   - Eliminar variantes oscuras innecesarias.
   - Mantener iconos Lucide y su contrato `data-icon`.
7. No crear variantes de candidato dentro de `Badge`; son dominio y se
   implementarán en su capa propia.
8. Montar `Toaster` de Sonner dentro del límite de aplicación. El provider
   legacy puede coexistir hasta que terminen las migraciones.
9. No añadir TanStack Table: `table` será solo la base semántica/visual.

Comprobación:

```bash
npx shadcn@latest info --json
rg -n 'dark:|z-\\[' src/components/ui
```

Revisar cualquier coincidencia y conservarla solo si existe una razón
documentada.

Commit sugerido: `feat: añadir primitives shadcn de la aplicación`

## Tarea 4: construir y aprobar el laboratorio visual

Archivos:

- Modificar `src/screens/Playground.tsx`.
- Crear `src/components/playground/AppUiLab.tsx`.
- Crear componentes auxiliares del laboratorio únicamente cuando eviten
  duplicación, sin convertirlos en primitives de producción.

Pasos:

1. Mantener la ruta exclusivamente bajo `import.meta.env.DEV`.
2. Crear secciones para:
   - Tipografía y jerarquía.
   - Superficies y elevación.
   - Botones y acciones.
   - Formularios y validación.
   - Badges y estados.
   - Menús, Dialog, Sheet, Drawer y Popover.
   - Sidebar y command palette en un marco contenido.
   - Tabla, selección y ordenación.
   - Empty, Skeleton, Alert, Spinner y toast.
3. Mostrar reposo, hover, focus, active, selected, disabled, loading y error.
4. Añadir contenido largo, labels en español y números tabulares.
5. Conservar la sección de `FieldRenderer` para vigilar el contrato WYSIWYG.
6. Revisar que el ultramarine aparezca solo en acción, foco y selección.
7. Revisar que `descartado` nunca sea rojo.
8. Verificar el laboratorio a `1440×900`, `1023/1024`, `767/768`, `639/640`,
   `390×844` y `320×568`.
9. Capturar el resultado. Si todavía parece un preset genérico, corregir tokens,
   variantes y composición antes de tocar una ruta real.
10. Volver a capturar landing, login y formulario público para confirmar que no
    se han movido.

Checkpoint:

El sistema base debe alcanzar el listón visual aprobado antes de continuar con
el shell.

Commit sugerido: `feat: definir laboratorio visual shadcn`

## Tarea 5: reconstruir el shell de la aplicación

Archivos:

- Modificar `src/screens/AppLayout.tsx`.
- Crear:
  - `src/components/app-shell/AppSidebar.tsx`
  - `src/components/app-shell/AppMobileNav.tsx`
  - `src/components/app-shell/CompanySwitcher.tsx`
  - `src/components/app-shell/PuestoSwitcher.tsx`
  - `src/components/app-shell/WorkspaceHeader.tsx`
  - `src/components/app-shell/AppCommandPalette.tsx`
- Modificar `src/main.tsx` solo si el montaje del shell lo exige.

Pasos:

1. Mantener `AppLayout` como controlador de datos, permisos, planes y estado.
2. Extraer presentación y navegación a los componentes del shell.
3. Construir la sidebar con el primitive `Sidebar`:
   - Logo.
   - Selector de empresa.
   - Navegación principal.
   - Puestos agrupados por sede.
   - Contadores.
   - Cuenta y ayuda.
4. Mantener exactamente:
   - Gating por owner, member, encargado y staff.
   - Límites de plan.
   - Cambio seguro de empresa.
   - Puesto activo.
   - Wizard, onboarding, ayuda y reconciliación de downgrade.
5. Crear `WorkspaceHeader` con contexto y acciones de ruta.
6. Implementar `AppCommandPalette` únicamente con rutas y acciones ya
   existentes. Atajo `Meta+K`/`Control+K`, cierre con Escape y retorno de foco.
7. Usar la capacidad responsive de Sidebar y `Sheet` para móvil; no mantener dos
   árboles de navegación con lógica distinta.
8. Rehacer `EmptyCompany` con `Empty`, preservando carga de demo y creación de
   puesto.
9. Mantener `<Outlet>` y todas las rutas sin cambios.
10. No migrar todavía el contenido interno de las pantallas.

Verificación:

- `/demo/resumen`
- `/demo/bandeja`
- `/demo/sedes`
- `/demo/marcas`
- `/demo/equipo`
- Una sesión `/app` real

Probar:

- Navegación activa.
- Sidebar abierta, colapsada y móvil.
- Selector de empresa.
- Puestos por sede.
- Cuenta, soporte y logout.
- Command palette por teclado.
- Wizard y overlays globales.
- Scroll lock y retorno de foco.

Commit sugerido: `feat: reconstruir shell de la aplicación`

## Tarea 6: extraer el dominio visual de candidatos

Archivos:

- Modificar `src/screens/Dashboard.tsx`.
- Mover `src/components/ui/StatusPill.tsx` a la capa de candidatos.
- Crear:
  - `src/components/candidates/types.ts`
  - `src/components/candidates/CandidateWorkspace.tsx`
  - `src/components/candidates/CandidateStatusSummary.tsx`
  - `src/components/candidates/CandidateToolbar.tsx`
  - `src/components/candidates/CandidateFilters.tsx`
  - `src/components/candidates/CandidateSelectionToolbar.tsx`
  - `src/components/candidates/CandidateEmptyState.tsx`
  - `src/components/candidates/CandidateStatusBadge.tsx`
  - `src/components/candidates/CandidateStatusControl.tsx`
  - `src/components/candidates/SavedViews.tsx`
  - `src/components/candidates/PuestoSettings.tsx`
- Modificar imports de `src/screens/Bandeja.tsx` y
  `src/screens/CandidatePanel.tsx` cuando corresponda.

Pasos:

1. Dejar `Dashboard` como controlador del store, URL, filtros, selección y
   mutaciones.
2. Definir props y callbacks tipados para las composiciones extraídas.
3. Evitar que los nuevos componentes presentacionales importen Supabase o el
   store.
4. Mover el control de estado fuera de `ui`: depende de `STATUS_META` y es
   dominio.
5. Conservar la paleta, punto + texto y pulse exclusivo de `contratado`.
6. Crear la franja compacta de cinco estados con `ToggleGroup`.
7. Reconstruir la toolbar:
   - Búsqueda con `InputGroup`.
   - Filtros en `Popover` de escritorio.
   - Filtros en `Drawer` móvil.
   - Badges desmontables solo para filtros activos.
   - Saved views y ajustes en menús secundarios.
8. Hacer que la misma toolbar se transforme al seleccionar filas; eliminar la
   competencia visual de una segunda barra.
9. Conservar semántica actual de búsqueda, filtros numéricos, estados, interés,
   etiquetas, vistas guardadas y query string.
10. Rehacer empty, no-results, loading y trial locked con los primitives nuevos.

Comprobación manual:

- Sin candidatos.
- Sin resultados.
- Filtros individuales y combinados.
- `?estado=nuevo`.
- Saved views.
- Trial bloqueado.
- Selección con candidatos elegibles y no elegibles.
- Escritorio y móvil.

Commit sugerido: `feat: crear workspace y herramientas de candidatos`

## Tarea 7: migrar tabla, lista móvil y detalle de candidato

Archivos:

- Modificar `src/screens/Dashboard.tsx`.
- Modificar `src/screens/CandidatePanel.tsx`.
- Modificar `src/screens/Bandeja.tsx`.
- Crear:
  - `src/components/candidates/CandidateTable.tsx`
  - `src/components/candidates/CandidateListMobile.tsx`
  - `src/components/candidates/CandidateDetail.tsx`
  - `src/components/candidates/CandidateRowActions.tsx`
- Modificar componentes de etiquetas e interés solo donde haga falta para la
  nueva composición.

Pasos:

1. Extraer la tabla existente conservando:
   - `<table>` semántica.
   - `aria-sort`.
   - Columnas dinámicas.
   - Cabecera sticky.
   - Filas bloqueadas/enmascaradas.
   - Selección múltiple.
   - Interés y etiquetas.
2. No incorporar TanStack Table ni cambiar la lógica de ordenación/filtrado.
3. Mantener una composición móvil específica mediante `CandidateListMobile`.
4. Sustituir el checkbox legacy dentro de `/app` por el nuevo Checkbox shadcn,
   preservando estado indeterminado y labels accesibles.
5. Reconstruir acciones de fila con `DropdownMenu`.
6. Convertir el detalle en un `Sheet` lateral de aproximadamente 480 px:
   - Identidad y acciones.
   - Estado.
   - Respuestas.
   - Notas.
   - Rating, etiquetas, interés y metadatos.
   - Separadores en lugar de tarjetas anidadas.
7. Pasar datos y mutaciones mediante props tipadas; no añadir acceso nuevo al
   store dentro del detalle.
8. Reutilizar `CandidateDetail` desde Bandeja.
9. Preservar overlays anidados de `TeamRequestPanel`: panel inferior inerte,
   Escape sobre la capa superior y foco restaurado.
10. Mantener undo y manejo de errores en las mutaciones existentes.

Verificación:

- Buscar, ordenar y filtrar.
- Seleccionar todo, algunos y ninguno.
- Cambiar estado.
- Exportar.
- Comprobar interés.
- Abrir detalle desde tabla y Bandeja.
- Editar notas, valoración y etiquetas.
- Cerrar con botón, Escape y click exterior cuando corresponda.
- Confirmar retorno de foco a la fila.
- Probar 200 % de zoom y viewport `320×568`.

Commit sugerido: `feat: renovar tabla y detalle de candidatos`

## Tarea 8: reconstruir el constructor

Archivos:

- Modificar `src/screens/Builder.tsx`.
- Crear:
  - `src/components/form-builder/FormBuilderWorkspace.tsx`
  - `src/components/form-builder/FormFieldList.tsx`
  - `src/components/form-builder/FormFieldRow.tsx`
  - `src/components/form-builder/FormFieldEditor.tsx`
  - `src/components/form-builder/AddFieldCommand.tsx`
  - `src/components/form-builder/FormPreview.tsx`
  - `src/components/form-builder/SaveStatus.tsx`
- Reutilizar sin sustituir:
  - `src/components/FieldRenderer.tsx`
  - `src/components/ApplicationForm.tsx`

Pasos:

1. Mantener `Builder` como controlador de campaña, guardado, undo y dnd-kit.
2. Crear dos paneles de escritorio con `Resizable`:
   - Edición.
   - Preview de máximo 480 px.
3. Crear tabs `Campos` y `Vista previa` en móvil sin desmontar ni perder el
   estado de edición.
4. Rehacer la lista como filas estructuradas, no tarjetas grandes.
5. Mantener drag and drop, sensores actuales y alternativa subir/bajar.
6. Crear `AddFieldCommand` con los mismos tipos y defaults actuales.
7. Construir el editor con `Field`, `Input`, `Textarea`, `Select`, `Switch`,
   `ToggleGroup` y `AlertDialog` cuando corresponda.
8. Mostrar `SaveStatus`: guardando, guardado y error.
9. Un error no debe cerrar el campo seleccionado, revertir cambios locales ni
   borrar opciones.
10. Mantener los avisos especiales de email y el undo de borrado.
11. No modificar el render de inputs públicos para embellecer solo la preview.

Verificación:

- Añadir cada tipo de campo.
- Configurar labels, obligatoriedad y opciones.
- Eliminar, confirmar y deshacer.
- Reordenar con ratón, touch, teclado y botones.
- Resize de paneles.
- Tabs móvil.
- Guardado correcto, fallo y reintento.
- Recarga con persistencia.
- Preview idéntica al formulario público.
- Safari/iOS real para drag y autoscroll.

Commit sugerido: `feat: reconstruir workspace del formulario`

## Tarea 9: migrar Resumen y Bandeja

Archivos:

- Modificar `src/screens/Resumen.tsx`.
- Modificar `src/screens/Bandeja.tsx`.
- Reutilizar componentes del shell y candidatos.

Pasos:

1. Rehacer Resumen como vista operativa, con cabecera contextual, jerarquía
   tipográfica y superficies sin tarjetas anidadas.
2. Conservar cálculos, datos y cualquier gráfica honesta existente.
3. Rehacer Bandeja usando toolbar, controles de estado y `CandidateDetail`
   compartidos.
4. Mantener pull-to-refresh y comportamiento móvil donde exista.
5. Normalizar loading, empty y error.
6. No añadir métricas, predicciones ni acciones nuevas.

Verificación:

- Datos demo y reales.
- Sin campañas, sin candidatos y carga.
- Navegación desde resumen a puesto.
- Apertura y actualización de candidato desde Bandeja.
- Móvil y escritorio.

Commit sugerido: `feat: renovar resumen y bandeja`

## Tarea 10: migrar sedes, marcas y equipo

Archivos:

- Modificar:
  - `src/screens/Sedes.tsx`
  - `src/screens/Marcas.tsx`
  - `src/screens/Equipo.tsx`
  - `src/screens/EquipoMiembros.tsx`
  - `src/screens/EquipoTablon.tsx`
  - `src/screens/TeamRequestPanel.tsx`
  - `src/components/Tags.tsx`

Pasos:

1. Aplicar el layout compartido de configuración, con ancho 720–960 px.
2. Construir listas con `Item`, metadatos y menús contextuales.
3. Migrar formularios a `FieldGroup`, `Field`, labels, descripción y error.
4. Conservar:
   - Agregaciones y mutaciones de sedes.
   - Roles y visibilidad por sede.
   - Uploads y guarda de contraste AA de marcas.
   - Miembros, tablón y solicitudes.
   - Límites de plan.
5. Migrar confirmaciones destructivas a `AlertDialog`.
6. Migrar detalles laterales a `Sheet`.
7. Verificar overlays anidados de TeamRequestPanel.
8. No rediseñar globalmente componentes compartidos con superficies públicas
   sin aislar primero su variante de aplicación.

Verificación:

- Owner, member y encargado.
- Crear, editar y eliminar sedes/marcas cuando el plan lo permita.
- Color de marca con texto blanco y texto oscuro según contraste.
- Invitar, cambiar rol y eliminar miembro.
- Solicitud con detalle de candidato superpuesto.
- Trial, Pro y Multi.

Commit sugerido: `feat: renovar organización y equipo`

## Tarea 11: migrar plan, soporte, admin y flujos globales

Archivos:

- Modificar:
  - `src/screens/Plan.tsx`
  - `src/screens/Soporte.tsx`
  - `src/screens/AdminOverview.tsx`
  - `src/components/NewCampaignWizard.tsx`
  - `src/components/OnboardingGuide.tsx`
  - `src/components/FeatureLocked.tsx`
  - `src/components/UpgradeDialog.tsx`
  - `src/components/DowngradeReconcileDialog.tsx`
  - `src/components/SupportDialog.tsx`
  - `src/components/ui/Toast.tsx`
- Reutilizar `src/components/TierPrice.tsx` sin cambiar su variante pública.

Pasos:

1. Rehacer Plan alrededor de la lógica y `TierPrice` actuales.
2. Mantener precios, periodicidad, ahorros, Stripe y copy sin cambios.
3. No modificar `TierPrice` globalmente de forma que cambie la landing; crear una
   composición de página para `/app/plan`.
4. Migrar soporte y admin con layout de configuración y filas `Item`.
5. Reconstruir NewCampaignWizard:
   - `Dialog` amplio en escritorio.
   - `Drawer` en móvil.
   - Progreso sobrio.
   - Una decisión principal por paso.
   - Persistencia al volver o fallar.
6. Migrar onboarding, feature locks, upgrade y downgrade con los primitives
   adecuados.
7. Convertir `useToast` en un adaptador sobre Sonner para preservar temporalmente
   su API y evitar una reescritura simultánea del store.
8. Migrar call sites gradualmente; mantener mensajes y acciones undo.
9. Confirmar que todos los Dialog, Sheet y Drawer tienen título accesible.

Verificación:

- Checkout invocado y errores.
- Cambio mensual/anual.
- Downgrade y reconciliación.
- Wizard completo, retroceso, cierre y fallo.
- Soporte con paneles y toasts.
- Admin solo para staff.
- Onboarding desde empresa vacía.

Commit sugerido: `feat: renovar plan y flujos globales`

## Tarea 12: consolidar el sistema y actualizar la doctrina

Archivos:

- Eliminar componentes legacy sin consumidores.
- Mantener los componentes legacy requeridos fuera de `/app`.
- Modificar:
  - `src/index.css`
  - `DESIGN.md`
  - `CLAUDE.md`
  - `.cursor/rules/design-system.mdc`
  - `.cursor/skills/apuntate-design/SKILL.md`
- Modificar `components.json` solo si el estado final lo exige.

Pasos:

1. Buscar consumidores antiguos:

   ```bash
   rg -n "lib/buttons|legacy-ui|ui/(ConfirmDialog|SlideOver|BottomSheet|Toast|StatusPill)" src
   ```

2. Retirar imports de `lib/buttons.ts` dentro de rutas y componentes exclusivos
   de `/app`.
3. Conservar `lib/buttons.ts` para landing, login o superficies públicas que
   todavía lo necesiten.
4. Eliminar `SlideOver`, `BottomSheet` y `ConfirmDialog` solo cuando no queden
   consumidores.
5. Mantener el adaptador de Toast sobre Sonner si el store o una superficie
   compartida todavía usa su API; no mantener dos renders visuales de toast.
6. Confirmar que `StatusPill` ya vive en la capa de candidatos.
7. Eliminar tokens y clases app obsoletos sin tocar tokens públicos.
8. Revisar componentes shadcn con:

   ```bash
   npx shadcn@latest info --json
   npx shadcn@latest add button --dry-run
   npx shadcn@latest add button --diff button.tsx
   ```

9. Actualizar DESIGN.md para documentar:
   - Geist como única familia.
   - Arquitectura Base UI → shadcn → producto.
   - Tokens semánticos.
   - Shell y candidatos.
   - Tema claro.
10. Actualizar CLAUDE, regla y skill local para que futuros cambios usen shadcn
    en `/app` sin alterar superficies públicas.
11. No retirar Framer Motion: sigue teniendo consumidores fuera del revamp.

Criterio:

No debe convivir un segundo lenguaje visual dentro de `/app`. La coexistencia
técnica solo es aceptable para componentes públicos deliberadamente fuera de
alcance.

Commit sugerido: `refactor: consolidar sistema shadcn de la app`

## Tarea 13: verificación integral antes de cerrar

Archivos:

- Modificar archivos anteriores únicamente para corregir hallazgos.
- Mantener capturas temporales fuera del commit salvo petición expresa.

Pasos:

1. Ejecutar:

   ```bash
   cd /Users/mario/criba && pwd
   cd /Users/mario/criba && npm test
   cd /Users/mario/criba && npm run lint
   cd /Users/mario/criba && npx tsc --noEmit
   cd /Users/mario/criba && npm run build
   cd /Users/mario/criba && npm run preview
   ```

2. Confirmar que `/dev/playground` no existe en el build de producción.
3. Verificar viewports:
   - `1440×900`
   - `1280×800`
   - `1023` y `1024` px
   - `767` y `768` px
   - `639` y `640` px
   - `390×844`
   - `320×568`
4. Verificar zoom 200 % y `prefers-reduced-motion`.
5. Recorrer:
   - `/demo/resumen`
   - `/demo/bandeja`
   - `/demo/sedes`
   - `/demo/marcas`
   - `/demo/equipo`
   - `/demo/puestos/cmp_peon`
   - `/demo/puestos/cmp_peon/formulario`
   - `/app` con sesión real y permisos disponibles.
6. Probar candidatos:
   - Búsqueda.
   - Filtros y query string.
   - Orden.
   - Selección y acciones masivas.
   - Estado.
   - Exportación.
   - Interés.
   - Detalle, notas, rating y tags.
   - Empty, loading, error y trial bloqueado.
7. Probar builder:
   - Añadir, configurar, reordenar, eliminar y undo.
   - Ratón, touch y teclado.
   - Resize y tabs móvil.
   - Guardado correcto y fallido.
   - Preview y formulario público.
8. Probar shell y secundarias con owner, member, encargado, staff y planes
   disponibles.
9. Probar overlays:
   - Escape.
   - Click exterior cuando proceda.
   - Focus trap.
   - Retorno de foco.
   - Scroll lock.
   - Capas anidadas.
10. Comparar landing, login y formulario público con la línea base.
11. Verificar el formulario público con acento de cliente claro y oscuro.
12. Probar builder y Sheets en Safari/iOS real; no confiar solo en Chromium para
    dnd-kit o autoscroll.
13. Revisar contraste AA, targets táctiles, punto + texto para estados y uso
    semántico del ultramarine.
14. Revisar el diff final y confirmar que no hay cambios de datos, precios, copy
    comercial o funciones fuera de alcance.

Commit sugerido: `test: verificar revamp shadcn de la aplicación`

## Orden de entrega

1. Línea base y colisiones.
2. shadcn, tema y primitives.
3. Laboratorio visual.
4. Shell.
5. Workspace de candidatos.
6. Tabla y detalle.
7. Constructor.
8. Resumen y Bandeja.
9. Sedes, marcas y equipo.
10. Plan, soporte, admin y flujos.
11. Consolidación y documentación.
12. Verificación integral.

No comenzar una fase visual posterior si el checkpoint de la fase anterior no
cumple el diseño aprobado.
