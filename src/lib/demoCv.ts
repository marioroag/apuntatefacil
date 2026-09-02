// ============================================================================
// LOS CVs FICTICIOS DE LA DEMO: la fuente única de su contenido.
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
    'Oficial de primera en obra nueva y rehabilitación. Fábrica, enfoscados y ' +
    'remates finos, acostumbrado a trabajar con peón de apoyo.',
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


// ---------------------------------------------------------------------------
// LOS CVs DEL PUESTO DE PEÓN (Mario, sep 2026: "dale CV a los candidatos de
// peón de obra, más o menos realista para enseñarlo a los clientes").
//
// CINCO Y NO CIENTO CUARENTA, y el número es la parte pensada: en un anuncio de
// peón casi nadie adjunta CV (el campo es opcional, como en el de oficial), así
// que ponérselo a todos sería enseñar una demo que no se parece a lo que el
// cliente va a ver el primer día. Cinco bastan para que abra dos o tres y vea el
// visor, el subrayado y el contraste, y son cinco perfiles DISTINTOS a propósito:
// uno fuerte, uno que se contradice con lo que respondió, uno sin carnet (el
// criterio clave del puesto), uno que viene de otro oficio y uno a medias. Si
// Meridian solo dijera cosas buenas, el cliente dejaría de creerle.
// ---------------------------------------------------------------------------

export const CV_IVAN: DemoCv = {
  fichero: '/demo/cv-ivan-pardo.pdf',
  nombreFichero: 'cv-ivan-pardo.pdf',
  nombre: 'Iván Pardo Requena',
  titular: 'Peón de albañil',
  contacto: 'Torrent (Valencia) · 622 145 903 · ivan.pardo@example.com',
  perfil:
    'Peón de obra con seis años ayudando a oficial en obra nueva y reforma. ' +
    'Encofrado, mezcla y acopio de material, acostumbrado a cuadrillas pequeñas.',
  experiencia: [
    {
      titulo: 'Peón de albañil · Construcciones Mislata Norte · abr 2022 - actualidad',
      detalle:
        'Ayuda a oficial en promociones de vivienda: encofrado de pilares, amasado, ' +
        'acopio y limpieza de tajo. Manejo de radial y martillo eléctrico.',
    },
    {
      titulo: 'Peón · Reformas Camp de Túria · sep 2019 - mar 2022',
      detalle: 'Derribos y retirada de escombro en reformas de vivienda, con apoyo en solados.',
    },
  ],
  carnets: [
    'Formación PRL de construcción de 20 horas, con tarjeta TPC en vigor',
    'Carnet de conducir B, con coche propio',
  ],
  formacion: ['ESO completa', 'Curso de manejo de plataformas elevadoras (8 horas)'],
  idiomas: 'Castellano y valenciano nativos',
}

/** Citas literales del CV de Iván. Copiadas del texto de arriba, no reescritas. */
export const CITAS_IVAN = {
  prl: 'Formación PRL de construcción de 20 horas',
  acreditada: 'Peón de albañil · Construcciones Mislata Norte · abr 2022 - actualidad',
  carnet: 'Carnet de conducir B, con coche propio',
  continuidad: 'sep 2019 - mar 2022',
} as const

export const CV_SERGIO: DemoCv = {
  fichero: '/demo/cv-sergio-beltran.pdf',
  nombreFichero: 'cv-sergio-beltran.pdf',
  nombre: 'Sergio Beltrán Ortiz',
  titular: 'Peón de obra',
  contacto: 'Paterna (Valencia) · 671 038 552 · sergio.beltran@example.org',
  perfil:
    'Peón de obra con experiencia en reforma de interiores. Acostumbrado a trabajar ' +
    'con oficial de albañilería y a la carga y descarga de material.',
  experiencia: [
    {
      titulo: 'Peón · Obras y Reformas Bétera · ene 2025 - actualidad',
      detalle: 'Reforma de vivienda: derribo, retirada de escombro y ayuda en tabiquería.',
    },
    {
      titulo: 'Mozo de almacén · Suministros Horta Sud · feb 2023 - dic 2024',
      detalle: 'Carga y descarga de material de construcción y preparación de pedidos para obra.',
    },
  ],
  carnets: ['Carnet de conducir B', 'Sin formación PRL de construcción'],
  formacion: ['ESO completa'],
  idiomas: 'Castellano nativo',
}

/** Citas de Sergio. La del contraste es la que enseña de qué va el producto:
 *  responde cinco años y sus etapas arrancan en 2023. */
export const CITAS_SERGIO = {
  acreditada: 'Peón · Obras y Reformas Bétera · ene 2025 - actualidad',
  contrasteCv: 'Mozo de almacén · Suministros Horta Sud · feb 2023 - dic 2024',
  carnet: 'Carnet de conducir B',
  continuidad: 'feb 2023 - dic 2024',
} as const

export const CV_MIRIAM: DemoCv = {
  fichero: '/demo/cv-miriam-salas.pdf',
  nombreFichero: 'cv-miriam-salas.pdf',
  nombre: 'Miriam Salas Bonet',
  titular: 'Ayudante de albañilería',
  contacto: 'Valencia · 645 720 118 · miriam.salas@example.net',
  perfil:
    'Ayudante de albañilería con tres años en rehabilitación de fachadas y trabajos ' +
    'de interior. Formación en prevención al día y ganas de seguir en el oficio.',
  experiencia: [
    {
      titulo: 'Ayudante de albañil · Rehabilitaciones Ciutat Vella · may 2023 - actualidad',
      detalle:
        'Rehabilitación de fachadas y patios de luces: montaje de andamio, saneado y ' +
        'apoyo en enfoscados. Trabajo en altura con arnés.',
    },
    {
      titulo: 'Peona · Pinturas y Reformas Quart · jun 2022 - abr 2023',
      detalle: 'Preparación de paramentos, masillado y lijado antes de pintura.',
    },
  ],
  carnets: [
    'Formación PRL de construcción de 20 horas, con tarjeta TPC en vigor',
    'Curso de trabajos en altura (8 horas)',
  ],
  formacion: ['ESO completa', 'Certificado de profesionalidad de operaciones auxiliares de albañilería'],
  idiomas: 'Castellano y valenciano nativos',
}

/** Citas de Miriam. Sin carnet de conducir: lo que le falta no está en el CV,
 *  así que ese criterio lo sostiene su respuesta y no una cita. */
export const CITAS_MIRIAM = {
  prl: 'Formación PRL de construcción de 20 horas',
  acreditada: 'Ayudante de albañil · Rehabilitaciones Ciutat Vella · may 2023 - actualidad',
  continuidad: 'jun 2022 - abr 2023',
} as const

export const CV_JUANCARLOS: DemoCv = {
  fichero: '/demo/cv-juan-carlos-nieto.pdf',
  nombreFichero: 'cv-juan-carlos-nieto.pdf',
  nombre: 'Juan Carlos Nieto Aparicio',
  titular: 'Mozo de almacén',
  contacto: 'Sagunto (Valencia) · 610 884 276 · juancarlos.nieto@example.com',
  perfil:
    'Mozo de almacén con ocho años en distribución. Busco cambiar a obra por cercanía ' +
    'a casa y por continuidad.',
  experiencia: [
    {
      titulo: 'Mozo de almacén · Distribuciones Palancia · nov 2018 - actualidad',
      detalle: 'Recepción de camiones, ubicación de palés y preparación de pedidos con PDA.',
    },
    {
      titulo: 'Repartidor · Transportes Camp de Morvedre · mar 2016 - oct 2018',
      detalle: 'Reparto de material a tiendas de la comarca con furgoneta de empresa.',
    },
  ],
  carnets: ['Carnet de conducir B', 'Carnet de carretillero elevador, caducado en 2024'],
  formacion: ['ESO completa'],
  idiomas: 'Castellano nativo',
}

/** Citas de Juan Carlos: su CV es sólido, pero de OTRO oficio. Es el caso que
 *  enseña que la nota mide encaje con ESTE puesto y no calidad de la persona. */
export const CITAS_JUANCARLOS = {
  otroOficio: 'Mozo de almacén · Distribuciones Palancia · nov 2018 - actualidad',
  carnet: 'Carnet de conducir B',
  continuidad: 'mar 2016 - oct 2018',
} as const

export const CV_ALEJANDRO: DemoCv = {
  fichero: '/demo/cv-alejandro-ferrer.pdf',
  nombreFichero: 'cv-alejandro-ferrer.pdf',
  nombre: 'Alejandro Ferrer Micó',
  titular: 'Peón de construcción',
  contacto: 'Aldaia (Valencia) · 633 291 740 · alejandro.ferrer@example.org',
  perfil:
    'Peón de construcción con dos años de oficio repartidos entre obra nueva y ' +
    'reforma. Manejo de herramienta de mano y trabajo en cuadrilla.',
  experiencia: [
    {
      titulo: 'Peón de obra · Encofrados del Turia · feb 2025 - jul 2025',
      detalle: 'Montaje y desmontaje de encofrado de muro, limpieza de tajo y acopio.',
    },
    {
      titulo: 'Peón · Reformas Aldaia Centro · abr 2023 - nov 2023',
      detalle: 'Ayuda en tabiquería y solados en reforma de locales.',
    },
  ],
  carnets: [
    'Formación PRL de construcción de 20 horas',
    'Carnet de conducir B',
  ],
  formacion: ['ESO completa'],
  idiomas: 'Castellano y valenciano nativos',
}

/** Citas de Alejandro: etapas cortas y con huecos entre ellas, que es justo lo
 *  que mide el criterio de continuidad. */
export const CITAS_ALEJANDRO = {
  prl: 'Formación PRL de construcción de 20 horas',
  acreditada: 'Peón de obra · Encofrados del Turia · feb 2025 - jul 2025',
  carnet: 'Carnet de conducir B',
  continuidad: 'abr 2023 - nov 2023',
} as const

export const DEMO_CVS: DemoCv[] = [CV_ANDREI, CV_JOAQUIN, CV_IVAN, CV_SERGIO, CV_MIRIAM, CV_JUANCARLOS, CV_ALEJANDRO]

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
