# Revamp de la aplicación con shadcn/ui

Fecha: 24 de julio de 2026
Estado: diseño aprobado

## 1. Objetivo

Rediseñar visualmente la aplicación privada de Apúntate Fácil con shadcn/ui y
Base UI. El resultado debe percibirse como una versión nueva, más pulida,
premium y coherente del producto, no como la interfaz actual reconstruida con
otros componentes.

El revamp conserva la identidad y las reglas de producto que ya funcionan, pero
replantea la composición de las pantallas, la jerarquía, la densidad, la
navegación y las interacciones. La pregunta rectora es:

> Si hoy diseñáramos la aplicación desde cero con shadcn, conservando la marca y
> todo lo aprendido del producto, ¿cómo la haríamos?

La dirección aprobada es **nuevo espacio de trabajo**: una renovación visible y
ambiciosa, pero tranquila y fácil de entender para responsables de contratación
que no necesariamente trabajan todo el día con software de oficina.

## 2. Alcance

El revamp afecta únicamente a la aplicación privada bajo `/app`.

Incluye:

- Shell, sidebar, cabeceras y navegación responsive.
- Base de candidatos, filtros, selección y detalle lateral.
- Constructor del formulario y preview en vivo.
- Equipo, sedes, marcas, plan, soporte y configuración.
- Flujos internos como la creación de un puesto.
- Estados compartidos de carga, vacío, error, confirmación y disabled.
- Primitives de interfaz y composiciones de producto.

No incluye:

- Landing de marketing.
- Formulario público.
- Cambios en precios, copy comercial o estrategia de planes.
- Funciones nuevas fuera de los flujos existentes.
- Cambios de React Router, Supabase, store, permisos o modelo de datos.
- Modo oscuro.

La paleta de comandos se limitará inicialmente a navegación y acciones ya
existentes. No introducirá una búsqueda global nueva.

## 3. Decisiones inmutables

El revamp mantiene:

- Geist como familia tipográfica.
- Ultramarine `#374CCE` para acción, navegación activa, foco y selección.
- Neutros grafito como base de superficies y texto.
- Colores semánticos actuales de los cinco estados de candidato.
- Rojo únicamente para errores reales y acciones destructivas.
- Radios contenidos de 8 y 10 px; 16 px solo en grandes superficies externas.
- Movimiento sobrio de 120, 180 y 240 ms, sin springs ni rebotes.
- Accesibilidad WCAG AA como suelo.
- Tuteo, sentence case y glosario congelado.
- Un único `FieldRenderer` para preview y formulario público.
- Detalle de candidato en panel lateral, manteniendo visible el contexto.
- Validación y persistencia de datos según las reglas actuales.

La innovación procederá de la arquitectura visual, las composiciones, el ritmo,
la divulgación progresiva y los estados interactivos, no de introducir colores
decorativos o efectos ajenos a la marca.

## 4. Arquitectura del sistema de interfaz

El sistema tendrá tres capas.

### 4.1 Base UI

Base UI proporcionará el comportamiento accesible de primitives complejos:
diálogos, menús, selects, popovers, tooltips, drawers y controles compuestos.

### 4.2 shadcn/ui

Los componentes de shadcn se añadirán como código fuente propiedad del
repositorio. Vivirán en la capa `src/components/ui` y serán la implementación
central de botones, campos, overlays, navegación, feedback y superficies.

Se usarán composiciones y variantes centrales. Las pantallas no deben
personalizar colores, tipografía o estados visuales mediante cadenas de clases
ad hoc. Las diferencias recurrentes se resolverán en tokens o variantes del
componente.

### 4.3 Componentes de producto

Las composiciones con significado de negocio vivirán por encima de los
primitives. Ejemplos:

- `CandidateWorkspace`
- `CandidateToolbar`
- `CandidateTable`
- `CandidateDetail`
- `PuestoSwitcher`
- `FormBuilderWorkspace`

Estos componentes recibirán datos y callbacks tipados. Los primitives no
conocerán candidatos, puestos, planes, permisos o Supabase.

El flujo será:

```text
Supabase/store
  → lógica actual de pantalla
  → composición de producto
  → primitives shadcn
```

## 5. Tema y aislamiento

shadcn se inicializará con Base UI, React 19, Vite y Tailwind CSS v4. No se
aplicará un preset que sobrescriba el sistema actual.

Los tokens semánticos de shadcn se mapearán a la identidad de Apúntate Fácil:

- `background` / `foreground`
- `card` / `card-foreground`
- `primary` / `primary-foreground`
- `secondary` / `secondary-foreground`
- `muted` / `muted-foreground`
- `accent` / `accent-foreground`
- `border`
- `input`
- `ring`
- `destructive` / `destructive-foreground`
- `sidebar-*`
- tokens específicos de los estados de candidato

Los valores visuales de la aplicación se aplicarán dentro de un límite de tema
exclusivo de `/app`. La landing y el formulario público no deben heredar cambios
del revamp.

La aplicación será solo clara. No se crearán variantes `dark:` ni controles de
modo de color.

## 6. Laboratorio visual

Antes de migrar una ruta real se creará un laboratorio interno, apoyado en la
ruta `Playground`, que mostrará:

- Botones y acciones.
- Campos y grupos de formulario.
- Cards, items, badges y separadores.
- Sidebar, command palette y navegación.
- Dialog, AlertDialog, Sheet, Drawer, Popover y menús.
- Tablas, filas, selección y ordenación.
- Empty, Skeleton, Alert, Spinner y toast.

Cada componente se validará en reposo, hover, foco, active, selected, disabled,
loading, error, contenido largo y viewport estrecho.

El criterio de aceptación no será que shadcn funcione, sino que el conjunto se
vea inequívocamente como la nueva Apúntate Fácil y fije el listón visual para
las rutas posteriores.

## 7. Shell y navegación

La aplicación será un espacio de trabajo continuo con dos zonas persistentes en
escritorio:

1. Sidebar de producto.
2. Área de trabajo con cabecera contextual y contenido de ruta.

### 7.1 Sidebar

La sidebar incluirá:

- Logo.
- Selector de empresa.
- Navegación principal.
- Puestos activos.
- Acceso a cuenta y ayuda.

Será sobria, compacta y estructural. No flotará ni usará decoración
innecesaria. La ruta activa usará fondo ultramarine lavado, texto oscuro e icono
ultramarine. Contadores y estados mantendrán su semántica propia.

### 7.2 Cabecera contextual

La cabecera reunirá:

- Empresa, puesto y sección actuales.
- Acción principal de la pantalla.
- Acciones secundarias agrupadas cuando corresponda.
- Acceso a `Command` para navegación y acciones existentes.

Eliminará títulos repetidos y barras de acciones dispersas.

### 7.3 Área de contenido

Las pantallas operativas usarán el ancho completo. Las pantallas de
configuración limitarán su contenido a una columna de 720 a 960 px.

Habrá menos tarjetas anidadas. El fondo grafito claro separará el shell y la
superficie principal será blanca. Los bordes definirán estructura; las sombras
se reservarán para overlays reales.

### 7.4 Móvil

La sidebar se convertirá en `Sheet`. Una barra superior compacta mostrará
contexto, navegación y acción principal. Las acciones no dependerán de hover y
cada pantalla tendrá una composición móvil deliberada.

## 8. Espacio de candidatos

La base de candidatos funcionará como un único espacio operativo con cuatro
niveles.

### 8.1 Contexto del puesto

Mostrará título, estado, enlace público y acción principal sin competir con las
herramientas de la tabla.

### 8.2 Resumen por estado

Los cinco estados aparecerán en una franja compacta con recuentos y proporción.
No serán cinco tarjetas grandes. Funcionarán como filtros mediante
`ToggleGroup`, siempre con punto de color y texto.

### 8.3 Barra de trabajo

Contendrá:

- Búsqueda mediante `InputGroup`.
- Filtros en `Popover` de escritorio y `Drawer` móvil.
- Gestión de columnas cuando corresponda.
- Exportación.
- Badges desmontables para filtros activos.

Al seleccionar filas, esta misma barra se transformará en una barra contextual
con recuento, cambio de estado, interés, exportación y cancelación. No aparecerá
una segunda barra flotante.

### 8.4 Tabla

La tabla seguirá siendo un componente de producto semántico. Mantendrá:

- Ordenación.
- Columnas configurables.
- Campos dinámicos del formulario.
- Selección múltiple.
- Comportamiento responsive.
- Cabecera sticky.
- Navegación por teclado.

shadcn proporcionará los controles y estados visuales, pero no impondrá un
modelo de datos genérico.

### 8.5 Detalle

En escritorio el candidato se abrirá en un `Sheet` lateral de aproximadamente
480 px. La lista filtrada permanecerá visible.

El panel organizará identidad y acciones, estado, respuestas, notas y
metadatos mediante jerarquía tipográfica, secciones y separadores. No utilizará
tarjetas anidadas.

En móvil será un panel navegable con cierre y retorno de foco correctos.

## 9. Constructor del formulario

En escritorio el constructor utilizará dos paneles:

1. Edición y estructura.
2. Preview en vivo.

`Resizable` permitirá ajustar la proporción, con tamaños iniciales útiles. La
preview tendrá un ancho máximo de 480 px y permanecerá visible durante la
edición.

El panel de edición incluirá:

- Cabecera con título, guardado y acciones.
- Lista ordenable de campos.
- Selector de nuevos campos basado en `Command`.
- Configuración con `Field`, `Input`, `Textarea`, `Select`, `Switch` y
  `ToggleGroup`.
- Acciones secundarias y destructivas agrupadas.

Cada campo será una fila estructurada. Mostrará tipo, etiqueta, obligatoriedad y
controles de orden. Drag and drop seguirá disponible y conservará la alternativa
completa de subir y bajar mediante teclado.

La preview seguirá usando el `FieldRenderer` real. No existirá una versión
decorativa diferente del formulario público.

En móvil habrá tabs `Campos` y `Vista previa`. El estado de edición se conservará
al alternar.

Los estados de guardado serán guardando, guardado y error. Un fallo no cerrará
el campo seleccionado ni descartará cambios locales.

## 10. Pantallas secundarias

Equipo, sedes, marcas, plan, soporte y configuración compartirán:

- Cabecera breve con título, explicación y acción principal.
- Columna central de 720 a 960 px para formularios.
- Secciones separadas por ritmo y `Separator`.
- `Card` solo para unidades conceptuales completas.

Las listas usarán filas basadas en `Item`: identidad, metadatos y menú
contextual. En móvil se reorganizarán sin esconder acciones esenciales.

Los formularios usarán `FieldGroup`, `Field`, `FieldLabel`, descripción y error.
La validación respetará las reglas existentes.

La creación de puesto se presentará como `Dialog` amplio en escritorio y
`Drawer` en móvil. Tendrá progreso sobrio, una decisión principal por paso y
resumen antes de crear. Los datos sobrevivirán al retroceso y a fallos de
guardado.

La pantalla de plan mantendrá precios, cálculos y copy. Solo cambiará su
jerarquía y composición.

## 11. Vocabulario de estados

- Sin contenido: `Empty`.
- Carga estructural: `Skeleton`.
- Acción en curso: botón disabled con `Spinner`.
- Error recuperable: `Alert` con acción clara.
- Confirmación breve: Sonner.
- Acción destructiva: `AlertDialog`.
- Tarea enfocada: `Dialog`.
- Detalle o edición lateral: `Sheet`.
- Panel móvil: `Drawer`.
- Contenido contextual pequeño: `Popover`.

Dialog, Sheet y Drawer tendrán siempre título accesible. Los overlays gestionarán
su propio stacking y devolverán el foco al disparador.

## 12. Estrategia de migración

La migración será vertical y reversible.

### Fase 1. Fundamentos

- Inicializar shadcn con Base UI.
- Configurar `components.json`.
- Definir tokens semánticos dentro del límite de `/app`.
- Crear el laboratorio visual.

### Fase 2. Shell

- Sidebar y navegación.
- Cabecera contextual.
- Comportamiento móvil.
- Command palette limitada al alcance existente.

### Fase 3. Candidatos

- Contexto y resumen.
- Toolbar y filtros.
- Tabla y selección.
- Detalle lateral.

### Fase 4. Constructor

- Panel de edición.
- Selector y configuración de campos.
- Preview.
- Estados de guardado.

### Fase 5. Pantallas secundarias

- Equipo, sedes, marcas, plan y soporte.
- Creación de puesto y diálogos.
- Estados compartidos.

### Fase 6. Consolidación

- Eliminar componentes antiguos sin consumidores.
- Retirar tokens obsoletos.
- Unificar variantes.
- Confirmar que no conviven dos lenguajes visuales dentro de `/app`.

No se usará `--overwrite` sobre componentes existentes. Antes de añadir o
actualizar un componente se revisarán el dry run y el diff del CLI de shadcn.

## 13. Verificación

Cada fase deberá superar:

- `npm run build`.
- `npx tsc --noEmit`.
- Pruebas existentes.
- Pruebas de interacciones críticas.
- Navegación completa por teclado.
- Foco al abrir y cerrar overlays.
- Escritorio y móvil.
- Contenido largo.
- Empty, loading, error y disabled.
- Contraste WCAG AA.
- Inspección visual en navegador.

Antes de migrar una superficie se registrarán capturas y comportamiento de
referencia para conservar capacidades, no estética.

### 13.1 Candidatos

Se verificarán filtros, ordenación, selección múltiple, cambio de estado,
interés, exportación y retorno desde el panel lateral.

### 13.2 Constructor

Se verificarán drag, alternativa de teclado, guardado fallido, persistencia del
estado de edición y paridad entre preview y formulario público.

### 13.3 Shell

Se verificarán rutas activas, selector de empresa, puestos, navegación móvil,
foco, scroll y acciones contextuales.

## 14. Criterios de finalización

El revamp estará completo cuando:

- La aplicación se perciba como una versión nueva y premium.
- La identidad siga siendo inequívocamente Apúntate Fácil.
- No se hayan perdido capacidades ni reglas de negocio.
- Todas las rutas privadas utilicen un lenguaje visual coherente.
- Los componentes complejos funcionen con teclado y móvil.
- Landing y formulario público permanezcan visualmente intactos.
- No queden componentes antiguos sin consumidores.
- Build, TypeScript, pruebas y verificación visual estén verdes.
