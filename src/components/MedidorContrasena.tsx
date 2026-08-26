import { Check } from 'lucide-react'
import { PWD_AYUDA, PWD_RULES, passwordValid } from '../lib/password'

// -----------------------------------------------------------------------------
// EL MEDIDOR DE CONTRASEÑA (Mario, ago 2026). Sustituye a la lista de requisitos.
//
// Lo que había eran CUATRO filas con su círculo vacío, siempre desplegadas, debajo
// del campo. Cada una decía una regla y las cuatro juntas ocupaban más alto que el
// propio campo, así que en el formulario de alta el bloque más grande de la
// pantalla era la letra pequeña de un solo input. Y encima no cambiaba de tarea:
// las cuatro seguían ahí, idénticas, después de cumplirlas.
//
// Ahora son cuatro segmentos y UNA frase. Los segmentos dicen cuánto llevas de un
// vistazo y sin leer; la frase dice exactamente qué falta, que es lo único
// accionable. Cuando ya no falta nada, la frase deja de pedir y confirma.
//
// LAS BARRAS MIDEN CUMPLIMIENTO, NO "SEGURIDAD", y esa distinción es la que hace
// que esto no sea un dark pattern. Un medidor de fuerza que dice "Segura" está
// dando una nota sobre algo que no puede saber (el servidor además rechaza
// contraseñas filtradas, cosa que aquí no se puede comprobar). Aquí cada segmento
// es una de NUESTRAS cuatro reglas: cuatro de cuatro no significa "esta contraseña
// es buena", significa "esta contraseña ya se puede usar", que es verdad y es lo
// que el botón necesita saber. Por eso el texto nunca dice "Débil" ni "Segura":
// dice qué falta.
//
// --- EL SEMÁFORO, Y LO QUE CUESTA -------------------------------------------
// La primera versión no tenía progresión de color: los segmentos se llenaban en
// gris y las cuatro viraban a verde al validar, con el argumento de que solo hay
// UN umbral de verdad (vale / no vale) y de que el rojo está reservado a lo que
// puede salir mal. Mario pidió la progresión (ago 2026) y se implementa.
//
// Qué se paga: el rojo pasa a tener un uso más, que es exactamente el reparto que
// esta doctrina deshizo con el punto de novedad. La diferencia, y por lo que aquí
// se sostiene, es que este rojo NO es decorativo ni informativo: coincide píxel a
// píxel con el botón deshabilitado. Mientras la barra está en rojo, "Crear cuenta"
// no se puede pulsar. O sea que sigue diciendo lo que el rojo dice en el resto de
// la app: esto todavía no se puede usar.
//
// Y el color NO es el portador: la frase de debajo dice qué falta y el botón dice
// si se puede seguir. Quitando el color entero, esto sigue funcionando; el color
// solo lo hace legible de un vistazo, que es para lo que Mario lo pidió.
// -----------------------------------------------------------------------------

/**
 * La rampa, por número de reglas cumplidas. Cuatro peldaños y no tres: con cuatro
 * segmentos, dos que compartan color se leen como uno solo y el avance se pierde
 * justo en la mitad, que es donde más falta hace ver que estás avanzando.
 */
const RAMPA = ['bg-red-500', 'bg-orange-500', 'bg-amber-400', 'bg-green-500']

/**
 * @param valor  La contraseña tal cual se está escribiendo.
 * @param id     El id del párrafo, para colgarlo del campo con `aria-describedby`.
 */
export function MedidorContrasena({ valor, id }: { valor: string; id: string }) {
  const faltan = PWD_RULES.filter((r) => !r.test(valor))
  const cumplidas = PWD_RULES.length - faltan.length
  const lista = valor.length > 0 && passwordValid(valor)

  // Sin escribir nada no se pide nada: se dice el objetivo. En cuanto hay letras,
  // la frase pasa a hablar de LO QUE TE FALTA, que es donde está el trabajo.
  const texto = !valor ? PWD_AYUDA : lista ? 'Contraseña lista.' : `Te falta: ${faltan.map((r) => r.pide).join(', ')}.`
  const tono = RAMPA[Math.max(0, cumplidas - 1)]

  return (
    <div className="mt-2.5">
      {/* Las barras son un eco de la frase, no información aparte: van ocultas al
          lector, que recibe el texto entero. Todos los segmentos llenos comparten
          el tono del nivel actual, que es lo que hace que el avance se lea como un
          movimiento y no como cuatro estados sueltos. */}
      <div className="flex gap-1.5" aria-hidden>
        {PWD_RULES.map((r, i) => (
          <span
            key={r.label}
            className={`h-1 flex-1 rounded-full transition-colors duration-[var(--duration-control)] ease-[var(--ease-out)] ${
              i >= cumplidas ? 'bg-slate-200' : tono
            }`}
          />
        ))}
      </div>
      {/* `polite` y no `assertive`: el texto solo cambia cuando una regla cambia de
          lado, o sea cuatro o cinco veces en toda la escritura, nunca por tecla.
          Y el texto se queda en gris de apoyo mientras falte algo: es una
          instrucción, no una alarma, y la alarma ya la da la barra. */}
      <p
        id={id}
        aria-live="polite"
        className={`mt-2 flex items-start gap-1.5 text-[12px] leading-relaxed ${lista ? 'text-green-700' : 'text-slate-500'}`}
      >
        {lista && <Check className="mt-0.5 size-3.5 shrink-0" aria-hidden />}
        {texto}
      </p>
    </div>
  )
}
