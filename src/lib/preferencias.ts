import { useSyncExternalStore } from 'react'

/* ---------------------------------------------------------------------------
   TUS PREFERENCIAS DE PRESENTACIÓN (Mario, sep 2026)
   ---------------------------------------------------------------------------
   Qué columnas ves, en qué orden, con qué anchos y si miras el puesto en tabla o
   en tablero. Vivía suelto en tres claves de `localStorage`, o sea en UNA
   máquina; ahora casi todo viaja con tu cuenta (`profiles.ui_prefs`) y el
   navegador se queda de CACHÉ.

   **CASI TODO: LOS ANCHOS NO VIAJAN, Y ESA ES LA FRONTERA.** No es una excepción
   caprichosa, es la pregunta que separa las dos clases de preferencia: ¿esto
   depende de la PANTALLA que tienes delante o de CÓMO TRABAJAS? Un ancho depende
   de la pantalla (los anchos que te caben en un monitor de 27 pulgadas no son los
   que te caben en un portátil, y heredarlos del otro sitio es peor que no
   guardarlos); el orden de las columnas, cuáles te importan y si tríasen tablero
   dependen de ti, y son las mismas en las dos máquinas. Por eso `DE_LA_CUENTA`
   se declara aquí arriba y no se decide en cada consumidor: es UNA decisión, y
   escrita en tres sitios se separaría al primer añadido.

   La caché no es un lujo: sin ella, cada recarga pintaría la tabla de fábrica y
   la recolocaría al llegar la respuesta del servidor, o sea un salto en la
   pantalla más densa del producto justo al abrirla. Con ella, un dispositivo que
   ya conoces pinta lo tuyo en el primer fotograma y el servidor solo confirma.

   CUATRO REGLAS, y las cuatro salen de casos que se pagan si no están:

   1. **MANDA EL SERVIDOR, salvo que aquí haya algo sin subir.** La caché es lo
      último que este navegador supo de tu cuenta, no una segunda verdad. Pero un
      cambio hecho con la red caída no se puede tirar a la basura en la siguiente
      recarga: por eso la caché guarda su propio `pendiente`, sobrevive al cierre
      del navegador y, si está puesto, lo que sube es lo de aquí.

   2. **LA CACHÉ LLEVA DE QUIÉN ES.** La clave vieja no llevaba usuario, así que
      dos personas que comparten navegador compartían la configuración y al
      cambiar de cuenta te llevabas la del anterior. Si la identidad no es la
      misma, la caché se tira y se espera al servidor.

   3. **LO QUE HAYA EN LAS CLAVES VIEJAS SE ADOPTA UNA VEZ, y solo si en la
      cuenta no hay nada.** Nadie que ya tenga su tabla ajustada puede perderla
      al desplegar esto; y al revés, un segundo ordenador con claves viejas no
      puede pisar lo que ya guardaste desde el primero. Las claves se borran
      cuando la adopción se ha confirmado arriba, no antes.

   4. **SE ESCRIBE EL CAJÓN ENTERO, con retardo y recortado.** Entero porque es
      pequeño y así una subida que llega tarde no deja media preferencia; con
      retardo porque arrastrar un filo confirma un ancho por cada soltada; y
      recortado porque un jsonb que escribe el cliente sin tope es un sitio donde
      meter lo que sea (lo mismo que hace `campaigns.baremo`).

   Lo que NO se ha subido, y es una decisión: el LATERAL CONTRAÍDO. Ese sí
   depende de la pantalla que tienes delante (es lo que dice su propio módulo), y
   además no es la mesa de trabajo, es el chrome que la rodea.
--------------------------------------------------------------------------- */

/**
 * QUÉ VIAJA CON LA CUENTA. Lo que no esté aquí se guarda igual, pero solo en este
 * navegador: ver la frontera de arriba. Hoy los anchos (`columnas`) son lo único
 * que se queda; antes de meter una sección nueva, la pregunta es de qué depende.
 */
const DE_LA_CUENTA = new Set(['vistaTabla', 'panelModo'])

/** La caché de este navegador. Una sola clave: dentro dice de quién es. */
const ESPEJO = 'apuntatefacil.prefs.v1'

/**
 * Las tres claves de la época en que esto vivía suelto en el navegador. Se leen
 * una vez, para no perder la configuración de quien ya tenía su tabla ajustada,
 * y se borran en cuanto la cuenta las tiene.
 */
const LEGADO = {
  columnas: 'apuntatefacil.columnas.v1',
  vistaTabla: 'apuntatefacil.vista-tabla.v1',
  panelModo: 'apuntatefacil.panel.modo',
} as const

/** El mismo tope que declara la columna en SQL. Aquí se recorta; allí se vigila. */
export const LIMITE_PREFS = 20000

/** Cuánto se espera desde el último cambio antes de escribir en la cuenta. */
const RETARDO = 500

export type Preferencias = Record<string, unknown>

type Espejo = { uid: string | null; datos: Preferencias; pendiente?: boolean }

function esObjeto(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

function leerEspejo(): Espejo | null {
  try {
    const raw = localStorage.getItem(ESPEJO)
    if (!raw) return null
    const e = JSON.parse(raw) as Espejo
    return esObjeto(e) && esObjeto(e.datos) ? e : null
  } catch {
    // Ventana privada, almacenamiento capado o una forma anterior: se sigue sin
    // caché, que es exactamente el estado de un dispositivo nuevo.
    return null
  }
}

function leerLegado(): Preferencias | null {
  const datos: Preferencias = {}
  try {
    const columnas = localStorage.getItem(LEGADO.columnas)
    if (columnas) datos.columnas = JSON.parse(columnas)
    const vista = localStorage.getItem(LEGADO.vistaTabla)
    if (vista) datos.vistaTabla = JSON.parse(vista)
    const modo = localStorage.getItem(LEGADO.panelModo)
    if (modo === 'tabla' || modo === 'tablero') datos.panelModo = modo
  } catch {
    /* lo que no se pueda leer, no se adopta */
  }
  return Object.keys(datos).length ? datos : null
}

function borrarLegado() {
  try {
    for (const k of Object.values(LEGADO)) localStorage.removeItem(k)
  } catch {
    /* si no se puede borrar, la próxima vez ya no habrá nada que adoptar arriba */
  }
}

const tamano = (datos: Preferencias) => JSON.stringify(datos).length

/** Lo que se manda a la cuenta. */
const soloCuenta = (d: Preferencias): Preferencias =>
  Object.fromEntries(Object.entries(d).filter(([k]) => DE_LA_CUENTA.has(k)))
/** Lo que se queda en este navegador y por lo tanto no lo pisa una respuesta. */
const soloLocal = (d: Preferencias): Preferencias =>
  Object.fromEntries(Object.entries(d).filter(([k]) => !DE_LA_CUENTA.has(k)))

/**
 * Deja el cajón por debajo del tope, tirando primero lo que menos duele.
 *
 * Lo único que puede crecer sin fin es la lista de columnas que has tocado
 * (`cambiadas`): las preguntas del formulario son de CADA puesto, así que una
 * ETT con cuarenta procesos abiertos acaba con cuarenta juegos de claves ahí
 * dentro. Se tira por el principio, que es lo más antiguo, y lo que se pierde es
 * que esa columna vuelve a su valor de fábrica, que siempre es correcto (es la
 * misma red que hace que un cajón vacío o corrupto no rompa nada).
 */
export function recortar(datos: Preferencias, limite = LIMITE_PREFS): Preferencias {
  if (tamano(datos) <= limite) return datos
  const copia = JSON.parse(JSON.stringify(datos)) as Preferencias
  // Cada vuelta tira UNA entrada; el tope de vueltas es el cinturón para que un
  // cajón con una forma inesperada no deje esto girando.
  for (let i = 0; i < 5000 && tamano(copia) > limite; i++) {
    if (tirarUna(copia)) continue
    // No queda nada granular que tirar: se van secciones enteras, la más gorda
    // primero. Peor es no poder guardar.
    const seccion = Object.keys(copia).sort((a, b) => tamano({ x: copia[b] }) - tamano({ x: copia[a] }))[0]
    if (!seccion) break
    delete copia[seccion]
  }
  return copia
}

/** Tira la entrada más antigua de la lista más larga. `false` si no hay ninguna. */
function tirarUna(datos: Preferencias): boolean {
  let mejor: { lista: string[] } | { objeto: Record<string, unknown>; clave: string } | null = null
  let largo = 0
  for (const seccion of Object.values(datos)) {
    if (!esObjeto(seccion)) continue
    for (const cajon of Object.values(seccion)) {
      if (!esObjeto(cajon)) continue
      for (const [clave, valor] of Object.entries(cajon)) {
        if (Array.isArray(valor) && valor.length > largo) {
          largo = valor.length
          mejor = { lista: valor as string[] }
        } else if (esObjeto(valor) && Object.keys(valor).length > largo) {
          largo = Object.keys(valor).length
          mejor = { objeto: valor, clave: Object.keys(valor)[0] }
        } else if (largo === 0 && !Array.isArray(valor) && !esObjeto(valor)) {
          // Un valor suelto (un ancho): candidato de última hora.
          mejor = mejor ?? { objeto: cajon, clave }
        }
      }
    }
  }
  if (!mejor) return false
  if ('lista' in mejor) mejor.lista.shift()
  else delete mejor.objeto[mejor.clave]
  return true
}

/* --------------------------------- estado -------------------------------- */

const espejoInicial = leerEspejo()
// El legado solo se mira si este navegador no tiene caché: si la tiene, lo viejo
// ya se adoptó (o es de otra cuenta) y no pinta nada.
const legadoInicial = espejoInicial ? null : leerLegado()

let datos: Preferencias = espejoInicial?.datos ?? legadoInicial ?? {}
let uid: string | null = espejoInicial?.uid ?? null
/** Hay cambios de aquí que la cuenta todavía no tiene. */
let pendiente = espejoInicial?.pendiente ?? false
/** Lo que hay viene de las claves viejas: solo vale si la cuenta está vacía. */
let deLegado = !!legadoInicial
/** Cómo se escribe en la cuenta. Lo enchufa `ProfilesProvider`; sin él, local. */
let subir: ((datos: Preferencias) => Promise<boolean>) | null = null
let temporizador: ReturnType<typeof setTimeout> | null = null

const oyentes = new Set<() => void>()
const emitir = () => oyentes.forEach((f) => f())

/** `false` si no se pudo escribir (ventana privada): lo usa la adopción del
 *  legado, que no puede borrar las claves viejas sin haberlas puesto a salvo. */
function escribirEspejo(): boolean {
  try {
    localStorage.setItem(ESPEJO, JSON.stringify({ uid, datos, pendiente } satisfies Espejo))
    return true
  } catch {
    /* sin caché, el ajuste vale para esta sesión y sube igual */
    return false
  }
}

function programarSubida() {
  if (!subir) return
  if (temporizador) clearTimeout(temporizador)
  temporizador = setTimeout(() => {
    temporizador = null
    const enVuelo = datos
    const eraDeLegado = deLegado
    void subir?.(soloCuenta(enVuelo)).then((ok) => {
      if (!ok) return // se queda pendiente: lo reintenta el próximo cambio o la próxima visita
      // Si mientras subía has vuelto a tocar algo, sigue habiendo pendiente.
      if (datos !== enVuelo) return
      pendiente = false
      escribirEspejo()
      if (eraDeLegado) {
        deLegado = false
        borrarLegado()
      }
    })
  }, RETARDO)
}

/* ---------------------------------- API ---------------------------------- */

/** Lo guardado en una sección, o `undefined` si no hay nada. */
export function leerSeccion<T>(nombre: string): T | undefined {
  return datos[nombre] as T | undefined
}

/**
 * Guarda una sección. Pasa a la caché en el acto y a la cuenta con retardo:
 * arrastrar un filo confirma un ancho por cada soltada, y con una escritura por
 * gesto la mitad de un arrastre largo serían peticiones que ya no interesan.
 */
export function guardarSeccion(nombre: string, valor: unknown) {
  const siguiente = { ...datos }
  if (valor === undefined || valor === null) delete siguiente[nombre]
  else siguiente[nombre] = valor
  datos = recortar(siguiente)
  // Una sección que no viaja NO deja nada pendiente: `pendiente` es lo que le
  // dice a la próxima visita "no adoptes lo de arriba, que aquí hay algo sin
  // subir", y ajustar un ancho no puede bloquear que llegue el orden que dejaste
  // puesto en el otro ordenador.
  if (DE_LA_CUENTA.has(nombre)) {
    pendiente = true
    escribirEspejo()
    emitir()
    programarSubida()
    return
  }
  escribirEspejo()
  emitir()
}

/** Suscripción para `useSyncExternalStore`. */
function suscribir(f: () => void) {
  oyentes.add(f)
  return () => oyentes.delete(f)
}

/**
 * Lee una sección y se entera cuando cambia, venga el cambio de esta pestaña o
 * de la respuesta del servidor. Devuelve la MISMA referencia mientras no cambie
 * (el cajón se reemplaza en shallow), así que se puede pasar por props sin
 * despertar a una tabla memoizada.
 */
export function usePreferencia<T>(nombre: string): T | undefined {
  return useSyncExternalStore(
    suscribir,
    () => datos[nombre] as T | undefined,
    () => undefined,
  )
}

/**
 * Enchufa esto a una cuenta. Lo llama `ProfilesProvider` cuando su fila llega.
 *
 * @param identidad  Quién eres ahora mismo (`null` sin sesión: todo se queda en
 *                   este navegador, que es lo correcto en la demo y en local).
 * @param remoto     Lo que la cuenta tiene guardado.
 * @param escritor   Cómo se escribe en la cuenta. `null` = solo lectura.
 */
export function sincronizar(
  identidad: string | null,
  remoto: Preferencias | null | undefined,
  escritor: ((datos: Preferencias) => Promise<boolean>) | null,
) {
  subir = escritor
  // Otra persona en el mismo navegador: lo de aquí no es suyo (regla 2). Se
  // comprueba solo entre identidades reales, para que quedarse sin sesión un
  // momento no borre la caché de nadie.
  if (identidad && uid && identidad !== uid) {
    datos = {}
    pendiente = false
    deLegado = false
    uid = identidad
    escribirEspejo()
    emitir()
  }
  if (identidad) uid = identidad
  if (!identidad || !escritor) return

  const hayRemoto = !!remoto && Object.keys(soloCuenta(remoto)).length > 0
  if (hayRemoto && !pendiente) {
    // Manda el servidor (regla 1), pero SOLO sobre lo que viaja: los anchos de
    // esta máquina no los pisa una respuesta que no los lleva. Se compara antes
    // de tocar nada para no repintar la tabla por algo que ya se ve igual.
    if (JSON.stringify(soloCuenta(remoto!)) !== JSON.stringify(soloCuenta(datos))) {
      datos = { ...soloLocal(datos), ...soloCuenta(remoto!) }
      escribirEspejo()
      emitir()
    }
    if (deLegado) {
      // Las claves viejas ya no pintan nada: lo que viaja lo manda la cuenta y lo
      // que no, está en la caché. Se borran solo si de verdad se guardaron.
      deLegado = false
      if (escribirEspejo()) borrarLegado()
    }
    return
  }
  // O la cuenta no tiene nada (adopción de las claves viejas, o de lo que se
  // guardó sin red), o hay cambios de aquí sin subir. En los dos casos sube lo
  // que viaja... si es que hay algo que viaje.
  if (Object.keys(soloCuenta(datos)).length > 0) {
    pendiente = true
    escribirEspejo()
    programarSubida()
  } else if (deLegado) {
    // Solo había anchos en las claves viejas: nada que subir, pero ya están a
    // salvo en la caché, así que se pueden retirar.
    deLegado = false
    if (escribirEspejo()) borrarLegado()
  }
}

/** Solo para las pruebas: deja el módulo como recién cargado. */
export function _reiniciar(estado?: Partial<{ datos: Preferencias; uid: string | null; pendiente: boolean; deLegado: boolean }>) {
  datos = estado?.datos ?? {}
  uid = estado?.uid ?? null
  pendiente = estado?.pendiente ?? false
  deLegado = estado?.deLegado ?? false
  subir = null
  if (temporizador) clearTimeout(temporizador)
  temporizador = null
}
