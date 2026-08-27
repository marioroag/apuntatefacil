import { useEffect, useRef, useState } from 'react'
import { Plus, X } from 'lucide-react'
import {
  CONTRATOS, ESTUDIOS, EXPERIENCIAS, JORNADAS, MODALIDADES, NIVELES_IDIOMA, PERIODOS,
  anuncioVacio, faltaEnAnuncio,
  type Anuncio, type CampoAnuncio, type Modalidad, type PeriodoSalario,
} from '../lib/anuncio'
import { botonIcono } from '../lib/buttons'

/**
 * EL EDITOR DEL ANUNCIO, UNO SOLO PARA LAS DOS SUPERFICIES.
 *
 * Lo montan el paso 2 del asistente de creación (con estado local, se guarda al
 * crear el puesto) y el constructor (autoguardado, para corregirlo después). Es
 * la misma regla que hace que `FieldRenderer` pinte a la vez la vista previa y
 * el formulario público: si tocas uno, tocas los dos. Escrito dos veces, el día
 * que se añada "jornada" habría que acordarse de añadirla en el segundo sitio.
 *
 * ES CONTROLADO Y EMITE UN PARCHE DE `Campaign`, no un objeto propio. Sus dos
 * claves (`location` y `anuncio`) son campos del puesto tal cual, así que el
 * constructor lo enchufa con `onChange={(p) => updateCampaign(id, p)}` y el
 * asistente con un `setState`. La ubicación va aparte del anuncio a propósito:
 * `campaigns.location` existe desde el primer día y la lee el baremo de
 * Meridian; duplicarla dentro del jsonb serían dos ubicaciones que se separan a
 * la primera edición.
 *
 * SIN RÓTULOS DE SECCIÓN. La página pública sí agrupa ("Requisitos",
 * "Descripción"), porque ahí se LEE de un vistazo; aquí se RELLENA, y ocho
 * campos con su etiqueta no necesitan que además alguien los meta en tres cajas
 * con nombre. Una versalita por cada dos campos es taxonomía, no jerarquía.
 */

// La pintura de un campo, declarada una vez y SIN el color del borde: el estado
// de error lo cambia, y `border-red-400` pegado detrás de `border-slate-300` es
// la misma utilidad de Tailwind, así que ganaría la que se emita después en el
// CSS y no la que se escriba al final del `className`. Es el tropiezo que ya
// obligó a fabricar los botones de icono con `botonIcono()`: cuando una pieza
// tiene que anular el valor de otra, la respuesta es la variante que no lo pone.
const CAMPO_BASE =
  'rounded-xl border bg-white px-3 text-sm text-slate-800 outline-none transition-colors duration-[var(--duration-control)] ease-[var(--ease-out)] pointer-coarse:text-base'

// 16px de letra en táctil y no 14: por debajo de eso iOS hace zoom al enfocar,
// que no es estética, es comportamiento. Misma razón que en el formulario
// público y en los campos de la ficha.
// EL ALTO Y EL ANCHO VIAJAN AQUÍ DENTRO, no pegados desde fuera. `h-10` y
// `h-auto` son la misma utilidad de Tailwind, y `w-full`, `w-40` y `flex-1`
// también entre sí: pegando la segunda detrás de la primera manda el orden en
// que Tailwind emite el CSS, no el orden en que se escribe. Se vio en pantalla:
// con `w-full` en la base, el `w-40` del nivel de idioma se lo comía y el campo
// del idioma se quedaba en 30px. Es el tropiezo del `px-0` de los botones de
// icono por los otros dos ejes, y la salida es la misma: quien necesita otra
// medida pide la variante, no la anula.
const campo = ({ error = false, alto = 'h-10', ancho = 'w-full' } = {} as {
  error?: boolean; alto?: string; ancho?: string
}) =>
  `${CAMPO_BASE} ${alto} ${ancho} ${
    error
      ? 'border-red-400 focus:border-red-500 focus:ring-4 focus:ring-red-500/15'
      : 'border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15'
  }`

const ETIQUETA = 'mb-1 block text-[12px] font-medium text-slate-500'

/** El aviso de un campo sin rellenar. Rojo con TEXTO, nunca el color solo. */
function Falta({ campo, children }: { campo: CampoAnuncio; children: React.ReactNode }) {
  return <p id={`falta-${campo}`} className="mt-1 text-[12px] text-red-600">{children}</p>
}

export type ValorAnuncio = { location: string; anuncio: Anuncio }

/**
 * EL ESTADO DEL PASO, en una pieza, porque hay DOS sitios donde se escribe un
 * anuncio antes de que el puesto exista: el asistente "Crear puesto" y el paso
 * 2 de la guía de primer uso. Lo que comparten no es la pintura (uno es un
 * modal y el otro una pantalla entera), es el comportamiento: qué se está
 * escribiendo, qué falta, cuándo se avisa y a dónde va el foco. Escrito dos
 * veces, el día que cambie una regla de validación cambiaría en uno solo.
 */
export function usePasoAnuncio() {
  const [valor, setValor] = useState<ValorAnuncio>({ location: '', anuncio: anuncioVacio() })
  const [faltan, setFaltan] = useState<CampoAnuncio[]>([])
  // Un contador de INTENTOS, y no la propia lista de fallos, es lo que dispara
  // el foco: la lista se recalcula también al escribir (para ir quitando
  // avisos), y con ella en las dependencias el foco saltaría al primer campo
  // rojo a media palabra. Aquí solo se mueve cuando alguien ha pulsado el botón.
  const [intento, setIntento] = useState(0)
  const formulario = useRef<HTMLDivElement>(null)

  // El foco al primer campo pendiente va en un EFECTO y no dentro del
  // manejador: un `querySelector` sobre `[aria-invalid]` lanzado ahí mismo
  // corre antes de que React haya pintado los avisos y no encuentra ninguno.
  useEffect(() => {
    if (!intento) return
    formulario.current?.querySelector<HTMLElement>('[aria-invalid]')?.focus()
  }, [intento])

  // Lo que se escribe solo QUITA avisos, nunca los pone: encender uno mientras
  // alguien teclea es regañarle a media palabra. Es la misma regla que en el
  // formulario público (validar al salir del campo y al enviar, no al escribir).
  const cambiar = (patch: Partial<ValorAnuncio>) => {
    const next = { ...valor, ...patch }
    setValor(next)
    setFaltan((f) => (f.length ? faltaEnAnuncio(next.anuncio, next.location).filter((c) => f.includes(c)) : f))
  }

  /** ¿Se puede seguir? Si no, deja los avisos puestos y lleva el foco al primero. */
  const comprobar = () => {
    const pendientes = faltaEnAnuncio(valor.anuncio, valor.location)
    if (!pendientes.length) return true
    setFaltan(pendientes)
    setIntento((n) => n + 1)
    return false
  }

  const reiniciar = () => {
    setValor({ location: '', anuncio: anuncioVacio() })
    setFaltan([])
  }

  return { valor, cambiar, faltan, formulario, comprobar, reiniciar }
}

export function AnuncioEditor({
  valor,
  onChange,
  faltan = [],
}: {
  valor: ValorAnuncio
  onChange: (patch: Partial<ValorAnuncio>) => void
  /** Lo que quedó pendiente al intentar continuar. Vacío mientras no se pide. */
  faltan?: CampoAnuncio[]
}) {
  const a = valor.anuncio
  const set = (p: Partial<Anuncio>) => onChange({ anuncio: { ...a, ...p } })
  const falta = (c: CampoAnuncio) => faltan.includes(c)
  // Lo que un lector de pantalla necesita para contar la misma historia que el
  // borde rojo: qué campo está mal y cuál de los textos de abajo lo explica.
  // Además es por donde el asistente encuentra el primero para darle el foco.
  const aviso = (c: CampoAnuncio) =>
    falta(c) ? ({ 'aria-invalid': true, 'aria-describedby': `falta-${c}` } as const) : {}

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={ETIQUETA}>Ubicación</span>
          <input
            value={valor.location}
            onChange={(e) => onChange({ location: e.target.value })}
            placeholder="Ciudad o zona"
            className={campo({ error: falta('location') })}
            {...aviso('location')}
          />
          {falta('location') && <Falta campo="location">Dinos dónde se trabaja.</Falta>}
        </label>

        <label className="block">
          <span className={ETIQUETA}>Modalidad</span>
          <select
            value={a.modalidad}
            onChange={(e) => set({ modalidad: e.target.value as Modalidad })}
            className={campo({ error: falta('modalidad') })}
            {...aviso('modalidad')}
          >
            <option value="">Elige una</option>
            {MODALIDADES.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
          {falta('modalidad') && <Falta campo="modalidad">Elige cómo se trabaja.</Falta>}
        </label>
      </div>

      {/* El salario son tres controles de una sola idea, así que lleva un rótulo
          de grupo y sub-rótulos dentro. "Hasta" es opcional: quien da una cifra
          sola la da en "Desde", y el anuncio dirá "Desde 22.000 €". */}
      <div>
        <span className={ETIQUETA}>Salario</span>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <Euros
            aria="Salario desde"
            placeholder="Desde"
            value={a.salarioMin}
            error={falta('salario')}
            aviso={aviso('salario')}
            onChange={(n) => set({ salarioMin: n })}
          />
          <Euros
            aria="Salario hasta"
            placeholder="Hasta"
            value={a.salarioMax}
            onChange={(n) => set({ salarioMax: n })}
          />
          <select
            value={a.salarioPeriodo}
            onChange={(e) => set({ salarioPeriodo: e.target.value as PeriodoSalario })}
            aria-label="Periodo del salario"
            className={campo({ ancho: 'col-span-2 sm:col-span-1 sm:w-36' })}
          >
            {PERIODOS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
        {falta('salario') && <Falta campo="salario">Pon al menos la cifra de partida.</Falta>}
      </div>

      {/* El contrato va con el salario y no con los requisitos: los dos son lo
          que OFRECES, y juntos forman la línea que el anuncio escribe entera
          ("Contrato indefinido, jornada completa"). */}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={ETIQUETA}>Contrato</span>
          <select
            value={a.contrato}
            onChange={(e) => set({ contrato: e.target.value })}
            className={campo({ error: falta('contrato') })}
            {...aviso('contrato')}
          >
            <option value="">Elige uno</option>
            {CONTRATOS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          {falta('contrato') && <Falta campo="contrato">Di con qué contrato se entra.</Falta>}
        </label>

        <label className="block">
          <span className={ETIQUETA}>Jornada</span>
          <select
            value={a.jornada}
            onChange={(e) => set({ jornada: e.target.value })}
            className={campo({ error: falta('jornada') })}
            {...aviso('jornada')}
          >
            <option value="">Elige una</option>
            {JORNADAS.map((j) => (
              <option key={j} value={j}>{j}</option>
            ))}
          </select>
          {falta('jornada') && <Falta campo="jornada">Di si es completa o parcial.</Falta>}
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={ETIQUETA}>Experiencia mínima</span>
          <select
            value={a.experiencia}
            onChange={(e) => set({ experiencia: e.target.value })}
            className={campo({ error: falta('experiencia') })}
            {...aviso('experiencia')}
          >
            <option value="">Elige una</option>
            {EXPERIENCIAS.map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
          {falta('experiencia') && <Falta campo="experiencia">Di cuánta experiencia pides.</Falta>}
        </label>

        <label className="block">
          <span className={ETIQUETA}>Estudios mínimos</span>
          <select
            value={a.estudios}
            onChange={(e) => set({ estudios: e.target.value })}
            className={campo({ error: falta('estudios') })}
            {...aviso('estudios')}
          >
            <option value="">Elige uno</option>
            {ESTUDIOS.map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
          {falta('estudios') && <Falta campo="estudios">Di qué estudios pides.</Falta>}
        </label>
      </div>

      <Idiomas valor={a.idiomas} onChange={(idiomas) => set({ idiomas })} />

      <Conocimientos valor={a.conocimientos} onChange={(conocimientos) => set({ conocimientos })} />

      <label className="block">
        <span className={ETIQUETA}>Descripción</span>
        <textarea
          value={a.descripcion}
          onChange={(e) => set({ descripcion: e.target.value })}
          rows={5}
          maxLength={4000}
          placeholder="Cuenta cómo es el día a día, con quién se trabaja y qué ofrecéis. Una línea por idea se lee mejor que un párrafo largo."
          className={`${campo({ error: falta('descripcion'), alto: 'h-auto' })} resize-y py-2 leading-relaxed`}
          {...aviso('descripcion')}
        />
        {falta('descripcion') && <Falta campo="descripcion">Escribe de qué va el trabajo.</Falta>}
      </label>
    </div>
  )
}

/** Campo de euros: dígitos y el símbolo puesto por la caja, no por quien escribe. */
function Euros({
  value, onChange, placeholder, aria, error = false, aviso,
}: {
  value: number | null
  onChange: (n: number | null) => void
  placeholder: string
  aria: string
  error?: boolean
  aviso?: Record<string, unknown>
}) {
  return (
    <div className="relative">
      <input
        // `text` con teclado numérico y no `type="number"`: la rueda del ratón
        // cambia el valor de un input numérico sin querer, y aquí el número que
        // se toca por accidente es el salario del anuncio.
        inputMode="numeric"
        value={value ?? ''}
        onChange={(e) => {
          const limpio = e.target.value.replace(/\D/g, '').slice(0, 9)
          onChange(limpio ? Number(limpio) : null)
        }}
        placeholder={placeholder}
        aria-label={aria}
        className={`${campo({ error })} num pr-7`}
        {...aviso}
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">€</span>
    </div>
  )
}

function Idiomas({
  valor, onChange,
}: {
  valor: { idioma: string; nivel: string }[]
  onChange: (v: { idioma: string; nivel: string }[]) => void
}) {
  return (
    <div>
      <span className={ETIQUETA}>
        Idiomas requeridos <span className="font-normal">(opcional)</span>
      </span>
      {valor.length > 0 && (
        <div className="mb-1.5 space-y-1.5">
          {valor.map((i, n) => (
            <div key={n} className="flex items-center gap-1.5">
              <input
                value={i.idioma}
                onChange={(e) => onChange(valor.map((x, j) => (j === n ? { ...x, idioma: e.target.value } : x)))}
                placeholder="Español"
                aria-label={`Idioma ${n + 1}`}
                className={campo({ ancho: 'flex-1' })}
              />
              <select
                value={i.nivel}
                onChange={(e) => onChange(valor.map((x, j) => (j === n ? { ...x, nivel: e.target.value } : x)))}
                aria-label={`Nivel de ${i.idioma || `idioma ${n + 1}`}`}
                className={campo({ ancho: 'w-40' })}
              >
                {NIVELES_IDIOMA.map((nv) => (
                  <option key={nv} value={nv}>{nv}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => onChange(valor.filter((_, j) => j !== n))}
                aria-label={`Quitar ${i.idioma || 'idioma'}`}
                className={botonIcono('ghost', 'sm')}
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => onChange([...valor, { idioma: '', nivel: NIVELES_IDIOMA[2] }])}
        className="inline-flex items-center gap-1 text-[13px] font-semibold text-indigo-600 hover:text-indigo-700"
      >
        <Plus className="size-3.5" aria-hidden /> Añadir idioma
      </button>
    </div>
  )
}

/**
 * LAS PASTILLAS DE CONOCIMIENTOS. Se escribe y se pulsa Intro (o coma); el
 * retroceso con la caja vacía se lleva la última, que es el gesto que ya espera
 * quien ha usado un campo de etiquetas.
 *
 * Van en RECTÁNGULO REDONDEADO y en gris, no en cápsula teñida: en esta app una
 * cápsula redonda con color es un ESTADO, y estas pastillas no dicen en qué
 * punto está nadie. Aquí además no hay que reconocerlas de un vistazo en una
 * columna (que es lo que le dio color a las etiquetas de candidato), se leen una
 * vez dentro de su caja.
 */
function Conocimientos({ valor, onChange }: { valor: string[]; onChange: (v: string[]) => void }) {
  const [pendiente, setPendiente] = useState('')
  const input = useRef<HTMLInputElement>(null)

  const anadir = (texto: string) => {
    const limpio = texto.trim().replace(/\s+/g, ' ')
    setPendiente('')
    if (!limpio || valor.length >= 20) return
    // Sin repetidos: dos pastillas iguales en el anuncio se leen como un error.
    if (valor.some((v) => v.toLowerCase() === limpio.toLowerCase())) return
    onChange([...valor, limpio])
  }

  return (
    <div>
      <span className={ETIQUETA} id="conocimientos-label">
        Conocimientos necesarios <span className="font-normal">(opcional)</span>
      </span>
      {/* La caja entera lleva al campo: es lo que se espera al pulsar en un
          hueco que parece un input. No es un `div` pulsable de los que la
          doctrina prohíbe (el control de verdad es el `input`, y con teclado se
          llega tabulando); solo mueve el foco, no ejecuta nada. */}
      <div
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) input.current?.focus()
        }}
        className={`${campo({ alto: 'min-h-10' })} flex cursor-text flex-wrap items-center gap-1.5 py-1.5 focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/15`}
      >
        {valor.map((c) => (
          <span key={c} className="inline-flex items-center gap-1 rounded-md bg-slate-100 py-0.5 pl-2 pr-1 text-[13px] text-slate-700">
            {c}
            <button
              type="button"
              onClick={() => onChange(valor.filter((v) => v !== c))}
              aria-label={`Quitar ${c}`}
              className="rounded text-slate-400 transition-colors duration-[var(--duration-control)] hover:text-slate-700"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </span>
        ))}
        <input
          ref={input}
          value={pendiente}
          aria-labelledby="conocimientos-label"
          onChange={(e) => {
            // La coma también cierra la pastilla: es como se escribe una lista.
            if (e.target.value.includes(',')) anadir(e.target.value.replace(',', ''))
            else setPendiente(e.target.value)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              anadir(pendiente)
            } else if (e.key === 'Backspace' && !pendiente && valor.length) {
              onChange(valor.slice(0, -1))
            }
          }}
          // Al salir del campo se queda lo escrito: perder una palabra por no
          // haber pulsado Intro es la forma más tonta de perder trabajo.
          onBlur={() => anadir(pendiente)}
          placeholder={valor.length ? '' : 'Carretilla, atención al cliente...'}
          className="min-w-24 flex-1 bg-transparent text-sm outline-none pointer-coarse:text-base"
        />
      </div>
    </div>
  )
}
