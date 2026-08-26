// -----------------------------------------------------------------------------
// LOS TESTIMONIOS DE LA PANTALLA DE ACCESO (diseño de Mario, ago 2026).
//
// Viven aquí y no dentro de `AccesoLayout` para que añadir uno sea una entrada en
// este array y nunca UI nueva, igual que las dimensiones de un filtro o las vistas
// de Candidatos. El carrusel no conoce ningún testimonio: pinta lo que declare esta
// lista, y con menos de dos no enseña flechas (un carrusel de uno es el título
// repetido, que es el mismo argumento que retiró el `tablist` de una sola pestaña).
//
// ---------------------------------------------------------------------------
// AVISO, Y ES EL IMPORTANTE: ESTO SON PERSONAS REALES O NO SE PUBLICA.
//
// La doctrina de copy del proyecto prohíbe la prueba social inventada, y no es una
// preferencia de estilo: es el posicionamiento entero ("¿funcionaría igual si el
// usuario supiera cómo está hecho?"). Una cita firmada por alguien que no existe,
// en la pantalla por la que se entra a un producto que cobra, es exactamente lo
// que esa regla vino a impedir.
//
// Antes de poner `confirmado: true` en una entrada hacen falta TRES cosas, y la
// tercera es la que se olvida:
//   1. Que la persona y su empresa sean reales.
//   2. Que haya dado permiso para publicar su nombre (es un dato personal).
//   3. QUE LA CITA SEAN SUS PALABRAS. Una persona real firmando una frase que no
//      dijo es peor que una persona inventada: la inventada no puede desmentirte,
//      y una cifra concreta atribuida a un cliente ("un 40%") es una afirmación
//      que alguien puede pedirte que sostengas.
// Si falta una de las tres, la entrada se queda apagada. Con la lista vacía, la
// lámina cae sola en la promesa del producto en su propia voz, que siempre es
// verdad y no necesita firma.
// ---------------------------------------------------------------------------

export type Testimonio = {
  /** La cita, sin comillas: las pone la tipografía. */
  cita: string
  /** Quién lo dice. Nombre real de una persona real que ha dado permiso. */
  nombre: string
  /**
   * Su empresa, y su cargo si lo tenemos. Nunca un cargo inventado para rellenar
   * la línea: con la empresa sola se entiende igual y no se le pone a nadie un
   * puesto que no es el suyo.
   */
  cargo: string
  /**
   * `false` mientras no esté confirmado que es real y consentido. El carrusel
   * SOLO pinta los confirmados, así que dejarse uno a medias no lo publica: hay
   * que venir aquí a poner `true` a propósito. Es la misma idea que el
   * `fail-closed` de las preferencias de correo.
   */
  confirmado: boolean
}

export const TESTIMONIOS: Testimonio[] = [
  {
    // Persona y empresa: reales, confirmadas por Mario (ago 2026).
    //
    // OJO CON LA FRASE: viene del Figma, no de una conversación con Sergio. Si no
    // son sus palabras, se cambia SOLO esta línea. Y es la línea que más cuidado
    // pide de las tres, porque un porcentaje concreto firmado por un cliente real
    // es una afirmación que alguien puede pedirte que sostengas.
    cita: 'Redujimos el tiempo de contratación un 40% desde que usamos la plataforma.',
    nombre: 'Sergio Rodríguez',
    cargo: 'CEO, Solera Canarias',
    confirmado: true,
  },
]

/** Los que se pueden publicar. El carrusel no usa `TESTIMONIOS` directamente. */
export const testimoniosPublicables = (): Testimonio[] => TESTIMONIOS.filter((t) => t.confirmado)
