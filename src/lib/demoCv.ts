// ============================================================================
// LOS DOS CVs FICTICIOS DE LA DEMO: la fuente única de su contenido.
//
// De estas constantes salen LAS DOS COSAS a la vez: el PDF que se ve en la
// ficha (lo genera scripts/gen-demo-cvs.mjs y se commitea en public/demo) y
// las CITAS que usan los análisis artesanales del seed. Un solo origen es lo
// que garantiza por construcción que cada cita existe literal en el documento
// y el subrayado del visor funciona; lo vigila demoCv.test.ts con el MISMO
// código de localización que usa el visor.
//
// Reglas de contenido (las de toda la demo): personas inventadas, emails de
// dominios RFC 2606, empresas inventadas, cero marcas de terceros y sin caras.
// Si tocas un texto del que sale una cita, toca la cita con él (el guardián
// lo caza igualmente).
// ============================================================================

export interface DemoCv {
  /** Ruta del asset en public/: es lo que llevan los candidatos en cvPath. */
  fichero: string
  /** Nombre visible del fichero (lo que iría en answers del campo file). */
  nombreFichero: string
  nombre: string
  titular: string
  contacto: string
  perfil: string
  experiencia: { titulo: string; detalle: string }[]
  carnets: string[]
  formacion: string[]
  idiomas: string
}

export const CV_ANDREI: DemoCv = {
  fichero: '/demo/cv-andrei-vasile.pdf',
  nombreFichero: 'cv-andrei-vasile.pdf',
  nombre: 'Andrei Vasile',
  titular: 'Carretillero',
  contacto: 'Getafe (Madrid) · 612 431 208 · andrei.vasile@example.com',
  perfil:
    'Carretillero con carnet en vigor y experiencia en almacenes de alimentación y ' +
    'distribución. Acostumbrado al turno de noche y al ritmo de campaña.',
  experiencia: [
    {
      titulo: 'Carretillero · Logística Arganzuela S.L. · feb 2023 - jun 2024',
      detalle:
        'Carga y descarga con carretilla frontal y retráctil en almacén de alimentación, ' +
        'turno de noche. Ubicación de palés en altura y control de stock con PDA.',
    },
    {
      titulo: 'Mozo de almacén · Distribuciones Vega Norte · mar 2021 - dic 2022',
      detalle:
        'Preparación de pedidos con transpaleta eléctrica y flejado de palés. ' +
        'Recepción de camiones y etiquetado.',
    },
  ],
  carnets: [
    'Carnet de carretillero elevador, renovado en 2025 y en vigor hasta 2030',
    'Carnet de conducir B',
  ],
  formacion: ['ESO completa', 'Curso de manipulación de cargas (20 horas)'],
  idiomas: 'Rumano nativo · castellano avanzado',
}

/** Citas literales del CV de Andrei que usa su análisis artesanal del seed.
 *  Copiadas del texto de arriba, no reescritas. */
export const CITAS_ANDREI = {
  carnet: 'renovado en 2025 y en vigor hasta 2030',
  tipos: 'carretilla frontal y retráctil',
  /** Lo que el CV ACREDITA de experiencia en el oficio: su etapa de
   *  carretillero, año y medio. Es la mitad "importante" del baremo v2. */
  acreditada: 'Carretillero · Logística Arganzuela S.L. · feb 2023 - jun 2024',
  continuidad: 'mar 2021 - dic 2022',
  /** La mitad CV del contraste: su historial arranca en 2021, así que los
   *  "5 años" que responde no salen de las etapas del documento. */
  contrasteCv: 'Mozo de almacén · Distribuciones Vega Norte · mar 2021',
} as const

export const CV_JOAQUIN: DemoCv = {
  fichero: '/demo/cv-joaquin-soler.pdf',
  nombreFichero: 'cv-joaquin-soler.pdf',
  nombre: 'Joaquín Soler Pastor',
  titular: 'Oficial de primera (albañilería)',
  contacto: 'Valencia · 655 902 314 · joaquin.soler@example.org',
  perfil:
    'Oficial de primera con tajo propio en obra nueva y rehabilitación. Fábrica, ' +
    'enfoscados y remates finos, acostumbrado a trabajar con peón de apoyo.',
  experiencia: [
    {
      titulo: 'Oficial de 1ª · Construcciones Turia Levante · sep 2019 - actualidad',
      detalle:
        'Fábrica de ladrillo, enfoscados y revestimientos en promociones de vivienda. ' +
        'Replanteo y lectura de planos con el jefe de obra.',
    },
    {
      titulo: 'Oficial de 2ª · Reformas Alboraya · jun 2016 - jul 2019',
      detalle: 'Rehabilitación de fachadas, solados y alicatados en viviendas particulares.',
    },
  ],
  carnets: [
    'Formación PRL de albañilería de 60 horas, con tarjeta TPC en vigor',
    'Carnet de conducir B con vehículo propio',
  ],
  formacion: ['Graduado escolar', 'Curso de trabajos en altura (8 horas)'],
  idiomas: 'Castellano y valenciano nativos',
}

/** Citas literales del CV de Joaquín que usa su análisis artesanal del seed. */
export const CITAS_JOAQUIN = {
  prl: 'Formación PRL de albañilería de 60 horas',
  /** La experiencia ACREDITADA: su etapa larga de oficial, siete años y
   *  siguiendo. La línea entera, para que la marca cubra el hecho completo. */
  acreditada: 'Oficial de 1ª · Construcciones Turia Levante · sep 2019 - actualidad',
  carnet: 'Carnet de conducir B con vehículo propio',
  continuidad: 'jun 2016 - jul 2019',
} as const

export const DEMO_CVS: DemoCv[] = [CV_ANDREI, CV_JOAQUIN]

/** Todo el texto de un CV en una cadena: el pajar contra el que el guardián
 *  localiza las citas (y el mismo contenido, palabra por palabra, que el
 *  generador imprime al PDF). */
export function textoDemoCv(cv: DemoCv): string {
  return [
    cv.nombre,
    cv.titular,
    cv.contacto,
    cv.perfil,
    ...cv.experiencia.flatMap((e) => [e.titulo, e.detalle]),
    ...cv.carnets,
    ...cv.formacion,
    cv.idiomas,
  ].join('\n')
}
