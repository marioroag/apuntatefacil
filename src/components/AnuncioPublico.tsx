import type { CSSProperties } from 'react'
import { Briefcase, Building2, Coins, FileText, MapPin } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  contratoTexto, experienciaTexto, modalidadLabel, salarioTexto, type Anuncio,
} from '../lib/anuncio'
import { readableOn } from '../lib/colors'
import { useHayDosColumnas } from '../lib/media'
import { publicFormPath } from '../lib/brand'
import type { Campaign } from '../lib/types'

/**
 * EL ANUNCIO, VISTO POR QUIEN BUSCA TRABAJO (diseño de Mario en Figma, ago 2026).
 *
 * Hasta hoy el enlace abría el formulario a secas: se le pedían sus datos a
 * alguien que todavía no sabía dónde es, cuánto paga ni qué se pide. Esto es lo
 * que se lee ANTES, y el formulario se abre al pulsar "Aplicar".
 *
 * DOS COLUMNAS, Y EL REPARTO ES EL DEL DISEÑO: a la izquierda lo que hay que
 * LEER (requisitos y descripción), a la derecha lo que se MIRA de un vistazo
 * antes de decidir (dónde, cómo, cuánto, qué contrato) con la acción encima.
 * Los hechos van arriba del todo en la columna estrecha porque son los que
 * descartan: quien no puede desplazarse hasta ahí no necesita leer el resto.
 *
 * QUÉ TRAE EL DISEÑO QUE NO SE PINTA, y por qué:
 *  · El SELLO DE VERIFICADO junto al nombre de la empresa. No verificamos
 *    ninguna empresa, así que sería una insignia de confianza inventada, que es
 *    justo lo que la doctrina de copy prohíbe.
 *  · "Sobre <empresa>". No existe ese dato en el producto. Se pondrá cuando
 *    haya un campo que lo guarde, no reciclando el mensaje de bienvenida del
 *    formulario, que es otra cosa y en otro sitio.
 *  · Las dos pastillas de nivel ("Freelancer", "Expert") del ejemplo: no
 *    tenemos ese concepto, y lo que sí tenemos (contrato y jornada) ya vive en
 *    la columna de la derecha.
 *  · La UBICACIÓN como enlace a un mapa. Es un enlace que saca de la página
 *    justo antes de aplicar, y no lleva a nada nuestro.
 *
 * Y una que sí se copia con matiz: las pastillas de conocimientos van en GRIS y
 * no en azul con lupa. En el ejemplo son enlaces de búsqueda de un portal;
 * aquí no llevan a ninguna parte, y pintarlas de color de enlace prometería un
 * clic que no existe. Es el mismo gris con el que se escriben en el editor.
 */
export function AnuncioPublico({
  campaign, anuncio, companyName, logoUrl, bannerUrl, location, otros, onAplicar,
}: {
  campaign: Campaign
  anuncio: Anuncio
  companyName: string
  logoUrl: string | null
  bannerUrl: string | null
  location: string
  otros: { slug: string; title: string; location: string; brandLabel: string }[]
  onAplicar: () => void
}) {
  const accent = campaign.branding.accent
  const style = { '--accent': accent, '--accent-contrast': readableOn(accent) } as CSSProperties
  // Se MONTA lo de un ancho o lo del otro, nunca los dos: pintar las dos
  // versiones y esconder una con `hidden lg:block` deja los hechos y las otras
  // vacantes DUPLICADOS en el DOM (se vio: cuatro enlaces para dos ofertas), y
  // el tabulador y el lector los recorren dos veces.
  const hayRail = useHayDosColumnas()

  // Cada hecho con su glifo, y solo si hay algo que decir. Una fila con un
  // icono y un hueco es peor que no tener la fila.
  const hechos = [
    { Icon: MapPin, texto: location.trim() },
    { Icon: Building2, texto: modalidadLabel(anuncio) },
    { Icon: Coins, texto: salarioTexto(anuncio) },
    { Icon: Briefcase, texto: experienciaTexto(anuncio) },
    { Icon: FileText, texto: contratoTexto(anuncio) },
  ].filter((h) => h.texto)

  return (
    <div style={style} className="min-h-svh bg-white">
      {/* El banner va A SANGRE, como en el diseño: aquí la página es ancha y su
          trabajo es abrir. En el formulario, que vive en una columna de 480px,
          el mismo banner va redondeado dentro de la caja. */}
      {bannerUrl && <img src={bannerUrl} alt="" className="h-28 w-full object-cover sm:h-[119px]" />}

      <div className="mx-auto grid w-full max-w-trabajo gap-8 px-5 pb-8 pt-8 sm:px-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-[50px] lg:px-12 lg:py-10">
        {/* ---------------- Lo que hay que leer ---------------- */}
        <main className="min-w-0">
          <header className="flex items-center gap-4 sm:gap-5">
            {logoUrl ? (
              <img src={logoUrl} alt="" className="size-10 shrink-0 rounded-xl object-cover ring-1 ring-slate-200" />
            ) : (
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-base font-bold text-on-accent">
                {companyName.slice(0, 1)}
              </span>
            )}
            <div className="min-w-0">
              <h1 className="break-words text-[22px] font-bold leading-tight tracking-tight text-slate-900 sm:text-[26px]">
                {campaign.title}
              </h1>
              <p className="mt-0.5 break-words text-[15px] font-medium text-slate-600">{companyName}</p>
            </div>
          </header>

          {/* Sin columna lateral, los hechos viven entre el título y lo que hay
              que leer: son los que descartan, así que van antes que los
              párrafos y no detrás de ellos. */}
          {!hayRail && (
            <div className="mt-6">
              <Hechos hechos={hechos} />
            </div>
          )}

          <hr className="mt-7 border-slate-200" />

          {(anuncio.estudios || anuncio.idiomas.length > 0 || anuncio.conocimientos.length > 0) && (
            <section className="mt-7">
              <h2 className="text-base font-bold text-slate-900">Requisitos</h2>
              <div className="mt-3 space-y-5">
                {anuncio.estudios && <Requisito titulo="Estudios mínimos">{anuncio.estudios}</Requisito>}
                {anuncio.idiomas.length > 0 && (
                  <Requisito titulo={anuncio.idiomas.length === 1 ? 'Idioma requerido' : 'Idiomas requeridos'}>
                    {anuncio.idiomas.map((i) => `${i.idioma} - ${i.nivel}`).join(' · ')}
                  </Requisito>
                )}
                {anuncio.conocimientos.length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Conocimientos necesarios</h3>
                    <ul className="mt-2.5 flex flex-wrap gap-2">
                      {anuncio.conocimientos.map((c) => (
                        <li key={c} className="rounded-md bg-slate-100 px-2.5 py-1 text-[13px] text-slate-700">
                          {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </section>
          )}

          {anuncio.descripcion.trim() && (
            <section className="mt-7">
              <h2 className="text-base font-bold text-slate-900">Descripción</h2>
              <Descripcion texto={anuncio.descripcion} />
            </section>
          )}
        </main>

        {/* ---------------- Lo que se mira antes de decidir ---------------- */}
        {hayRail ? (
          <aside className="flex flex-col gap-6 border-l border-slate-200 pl-10">
            <button type="button" onClick={onAplicar} className={BOTON_APLICAR}>
              Aplicar
            </button>
            <Hechos hechos={hechos} />
            {otros.length > 0 && (
              <>
                <hr className="border-slate-200" />
                <OtrosPuestos otros={otros} />
              </>
            )}
          </aside>
        ) : (
          // Sin raíl, las otras vacantes CIERRAN la página: se miran cuando esta
          // no encaja, o sea después de haberla leído.
          otros.length > 0 && (
            <section>
              <hr className="mb-6 border-slate-200" />
              <OtrosPuestos otros={otros} />
            </section>
          )
        )}
      </div>

      {/* LA ACCIÓN VIVE PEGADA AL PULGAR donde no hay raíl, y por eso NO se
          pinta también en el flujo: la página es larga y hay UNA sola cosa que
          hacer, así que el botón tiene que estar siempre y no en un punto
          concreto del scroll. Dos "Aplicar" serían dos puertas para una. */}
      {!hayRail && (
        <div className="sticky bottom-0 z-10 border-t border-slate-200 bg-white/95 px-5 py-3 backdrop-blur-sm">
          <button type="button" onClick={onAplicar} className={BOTON_APLICAR}>
            Aplicar
          </button>
        </div>
      )}
    </div>
  )
}

// El CTA habla el mismo idioma que el botón de enviar del formulario que abre:
// ancho completo, el acento del puesto con su guarda de contraste y el radio de
// un campo, porque debajo de una columna a ancho completo un radio de botón se
// ve descosido. Es la misma decisión que ya tomó `BTN_*_BLOCK`.
const BOTON_APLICAR =
  'flex h-12 w-full items-center justify-center rounded-xl bg-accent text-[15px] font-semibold text-on-accent transition-[filter] duration-[var(--duration-control)] ease-[var(--ease-out)] hover:brightness-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color-mix(in_srgb,var(--accent)_22%,transparent)] active:translate-y-px motion-reduce:transition-none'

function Requisito({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-bold text-slate-900">{titulo}</h3>
      <p className="mt-1 break-words text-sm text-slate-600">{children}</p>
    </div>
  )
}

function Hechos({ hechos }: { hechos: { Icon: typeof MapPin; texto: string }[] }) {
  if (!hechos.length) return null
  return (
    <ul className="space-y-4">
      {hechos.map(({ Icon, texto }) => (
        <li key={texto} className="flex items-start gap-2.5">
          {/* El icono se centra con la primera LÍNEA del texto, no con el bloque
              entero: una ubicación de dos renglones dejaría el glifo flotando a
              media altura, lejos de la palabra que acompaña. */}
          <Icon className="mt-0.5 size-4 shrink-0 text-slate-500" aria-hidden />
          <span className="min-w-0 break-words text-sm text-slate-700">{texto}</span>
        </li>
      ))}
    </ul>
  )
}

/**
 * LA DESCRIPCIÓN SE PINTA COMO SE ESCRIBIÓ. Varias líneas son varias ideas y se
 * leen como lista con su punto, que es lo que hace el diseño; una sola es un
 * párrafo y se queda como párrafo, porque un bullet solitario se lee como una
 * lista a la que le falta el resto.
 */
function Descripcion({ texto }: { texto: string }) {
  const lineas = texto.split('\n').map((l) => l.trim()).filter(Boolean)
  if (lineas.length <= 1)
    return <p className="mt-3 break-words text-[15px] leading-relaxed text-slate-600">{texto.trim()}</p>
  return (
    <ul className="mt-4 space-y-2.5">
      {lineas.map((l, i) => (
        <li key={i} className="flex gap-3">
          <span className="text-lg font-bold leading-[1.35] text-slate-400" aria-hidden>&bull;</span>
          <span className="min-w-0 break-words text-[15px] leading-relaxed text-slate-600">{l}</span>
        </li>
      ))}
    </ul>
  )
}

function OtrosPuestos({ otros }: { otros: { slug: string; title: string; location: string; brandLabel: string }[] }) {
  return (
    <section>
      <h2 className="text-[17px] font-bold text-slate-900">Otras vacantes</h2>
      <ul className="mt-4 space-y-3">
        {otros.map((o) => (
          <li key={o.slug}>
            {/* Enlace de verdad y no un div pulsable: se abre en otra pestaña con
                el botón central, se copia con el menú del ratón y el lector lo
                anuncia como lo que es. */}
            <Link
              to={publicFormPath(o.slug, o.brandLabel)}
              className="block rounded-xl bg-slate-100 p-3 transition-colors duration-[var(--duration-control)] ease-[var(--ease-out)] hover:bg-slate-200/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            >
              <span className="block break-words text-sm font-bold text-slate-900">{o.title}</span>
              {o.location.trim() && (
                <span className="mt-1 block break-words text-xs text-slate-500">{o.location}</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
