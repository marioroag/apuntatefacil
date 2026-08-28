import type { CSSProperties } from 'react'
import { Briefcase, Building2, ChevronRight, Coins, FileText, GraduationCap, MapPin } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  contratoTexto, estudiosTexto, experienciaTexto, modalidadLabel, salarioTexto, type Anuncio,
} from '../lib/anuncio'
import { accentOnWhite, readableOn } from '../lib/colors'
import { resumenApuntarse, senalesApuntarse, type ResumenApuntarse } from '../lib/apuntarse'
import { useHayDosColumnas } from '../lib/media'
import { publicFormPath } from '../lib/brand'
import { HojaPublica } from './HojaPublica'
import type { OtroPuesto } from '../lib/demoPublico'
import type { Campaign } from '../lib/types'

/**
 * EL ANUNCIO, VISTO POR QUIEN BUSCA TRABAJO (diseño de Mario en Figma, ago 2026).
 *
 * Hasta hoy el enlace abría el formulario a secas: se le pedían sus datos a
 * alguien que todavía no sabía dónde es, cuánto paga ni qué se pide. Esto es lo
 * que se lee ANTES, y el formulario se abre al pulsar "Apúntate ahora".
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
 *    justo antes de apuntarse, y no lleva a nada nuestro.
 *
 * Y una que sí se copia con matiz: las pastillas de conocimientos van en GRIS y
 * no en azul con lupa. En el ejemplo son enlaces de búsqueda de un portal;
 * aquí no llevan a ninguna parte, y pintarlas de color de enlace prometería un
 * clic que no existe. Es el mismo gris con el que se escriben en el editor.
 */
export function AnuncioPublico({
  campaign, anuncio, companyName, companyDescription, logoUrl, bannerUrl, location, otros, onApuntarse,
}: {
  campaign: Campaign
  anuncio: Anuncio
  companyName: string
  /** Lo que la empresa cuenta de sí misma (Ajustes). Vacío = no se pinta. */
  companyDescription: string
  logoUrl: string | null
  bannerUrl: string | null
  location: string
  otros: OtroPuesto[]
  onApuntarse: () => void
}) {
  const accent = campaign.branding.accent
  // Tres variables y no una: el acento tal cual (fondos), el texto que se lee
  // ENCIMA de él, y el acento oscurecido lo justo para leerse SOBRE blanco, que
  // es lo que necesitan los iconos y el filo de la ficha.
  const style = {
    '--accent': accent,
    '--accent-contrast': readableOn(accent),
    '--accent-ink': accentOnWhite(accent),
  } as CSSProperties
  // Se MONTA lo de un ancho o lo del otro, nunca los dos: pintar las dos
  // versiones y esconder una con `hidden lg:block` deja los hechos y las otras
  // vacantes DUPLICADOS en el DOM (se vio: cuatro enlaces para dos ofertas), y
  // el tabulador y el lector los recorren dos veces.
  const hayRail = useHayDosColumnas()
  // Lo que cuesta apuntarse, calculado del formulario de ESTE puesto.
  const apuntarse = resumenApuntarse(campaign.fields)

  // Cada hecho con su glifo, y solo si hay algo que decir: una fila con un icono
  // y un hueco es peor que no tener la fila.
  //
  // LA MISMA LISTA SE LEE DOS VECES Y NO ES UN DESCUIDO. Arriba, en horizontal,
  // van los TRES que descartan de un vistazo (dónde, cuánto, qué contrato): quien
  // no puede desplazarse hasta ahí no necesita leer nada más. En el raíl van
  // TODOS, agrupados por tema, para quien ya ha decidido que le interesa. Es la
  // diferencia entre un resumen y una ficha, y el sitio de cada uno lo dice.
  const donde = [
    { Icon: MapPin, texto: location.trim() },
    { Icon: Building2, texto: modalidadLabel(anuncio) },
  ].filter((h) => h.texto)
  const condiciones = [
    { Icon: Coins, texto: salarioTexto(anuncio) },
    { Icon: FileText, texto: contratoTexto(anuncio) },
    { Icon: Briefcase, texto: experienciaTexto(anuncio) },
    { Icon: GraduationCap, texto: estudiosTexto(anuncio) },
  ].filter((h) => h.texto)
  const resumen = [
    { Icon: MapPin, texto: location.trim() },
    { Icon: Coins, texto: salarioTexto(anuncio) },
    { Icon: FileText, texto: contratoTexto(anuncio) },
  ].filter((h) => h.texto)

  return (
    <div style={style} className="min-h-svh bg-white">
      {/* La foto a sangre y la hoja que sube sobre ella son la MISMA pieza que usa
          el formulario: es la misma página en dos momentos, y el gesto (radio 32,
          solape 28, alto del banner) se declara una sola vez en `HojaPublica`. */}
      <HojaPublica bannerUrl={bannerUrl}>
        <div className="mx-auto grid w-full max-w-trabajo gap-8 px-6 pb-36 pt-7 sm:px-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-14 lg:px-12 lg:pb-12 lg:pt-12">
        {/* ---------------- Lo que hay que leer ---------------- */}
        <main className="min-w-0">
          {hayRail ? (
            <>
              {/* Con raíl, la marca va ARRIBA y en pequeño: el título manda, y
                  quien abre un anuncio viene a por el puesto. */}
              <div className="flex items-center gap-2.5">
                {logoUrl ? (
                  <img src={logoUrl} alt="" className="size-7 shrink-0 rounded-lg object-cover ring-1 ring-slate-200" />
                ) : (
                  <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-accent text-[13px] font-bold text-on-accent">
                    {companyName.slice(0, 1)}
                  </span>
                )}
                <span className="min-w-0 truncate text-[15px] font-medium text-slate-900">{companyName}</span>
              </div>
              <h1 className="mt-3 break-words text-[34px] font-bold leading-tight tracking-tight text-slate-900">
                {campaign.title}
              </h1>
              {/* El resumen que decide, en una línea y sin bajar la vista. */}
              {resumen.length > 0 && (
                <ul className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
                  {resumen.map(({ Icon, texto }) => (
                    <li key={texto} className="flex items-center gap-2 text-[15px] text-slate-800">
                      <Icon className="size-4 shrink-0 text-slate-500" aria-hidden />
                      {texto}
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <>
              {/* SIN RAÍL EL TÍTULO VA PRIMERO Y LA MARCA DEBAJO, con su logo en
                  una caja y su nombre en el color de la empresa (diseño de Mario).
                  En una pantalla estrecha el nombre del puesto es lo único que no
                  puede esperar: con la marca delante, el titular arranca una línea
                  más abajo y en un móvil eso es la mitad de lo que se ve. */}
              <h1 className="break-words text-[26px] font-bold leading-tight tracking-tight text-slate-900">
                {campaign.title}
              </h1>
              <div className="mt-5 flex items-center gap-3.5">
                {logoUrl ? (
                  <img src={logoUrl} alt="" className="size-12 shrink-0 rounded-xl bg-white object-contain p-1.5 filo" />
                ) : (
                  <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-accent text-lg font-bold text-on-accent">
                    {companyName.slice(0, 1)}
                  </span>
                )}
                <span className="min-w-0 break-words text-base font-bold text-[var(--accent-ink)]">{companyName}</span>
              </div>

              {/* Los hechos van SUELTOS entre dos filos, sin caja y con los
                  iconos en gris: en una columna estrecha una tarjeta dentro de la
                  hoja es una caja dentro de otra, y el color ya lo pone el nombre
                  de la empresa justo encima. */}
              <hr className="mt-6 border-slate-200" />
              <div className="py-6">
                <Hechos hechos={[...donde, ...condiciones]} />
                {/* Lo que cuesta apuntarse cierra los hechos: es un dato más de
                    los que se miran antes de decidir, y aquí abajo el botón
                    flota sin barra donde ponerlo. */}
                <p className="mt-5 text-[13px] text-slate-700">{senalesApuntarse(apuntarse).join(' · ')}</p>
              </div>
            </>
          )}

          <hr className={hayRail ? 'mt-8 border-slate-200' : 'border-slate-200'} />

          {(anuncio.idiomas.length > 0 || anuncio.conocimientos.length > 0) && (
            <section className="mt-8 lg:mt-12">
              <h2 className={H2}>Requisitos</h2>
              <div className="mt-5 space-y-6">
                {anuncio.idiomas.length > 0 && (
                  <Requisito titulo={anuncio.idiomas.length === 1 ? 'Idioma requerido' : 'Idiomas requeridos'}>
                    {anuncio.idiomas.map((i) => `${i.idioma} - ${i.nivel}`).join(' · ')}
                  </Requisito>
                )}
                {anuncio.conocimientos.length > 0 && (
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Conocimientos necesarios</h3>
                    <ul className="mt-2.5 flex flex-wrap gap-2">
                      {anuncio.conocimientos.map((c) => (
                        <li key={c} className="rounded-md bg-slate-100 px-2.5 py-1 text-sm text-slate-900">
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
            <section className="mt-8 lg:mt-12">
              <h2 className={H2}>Descripción</h2>
              <Descripcion texto={anuncio.descripcion} />
            </section>
          )}

          {/* SOBRE LA EMPRESA, debajo de la descripción del puesto y no en el
              raíl (Mario, ago 2026): se lee cuando el puesto ya te interesa, que
              es cuando empieza a importar con quién trabajarías. */}
          {companyDescription.trim() && (
            <section className={`mt-8 p-6 sm:p-7 lg:mt-10 ${BLOQUE}`}>
              <div className="flex items-center gap-3.5">
                {logoUrl ? (
                  <img src={logoUrl} alt="" className="size-12 shrink-0 rounded-xl object-cover ring-1 ring-slate-200" />
                ) : (
                  <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-accent text-lg font-bold text-on-accent">
                    {companyName.slice(0, 1)}
                  </span>
                )}
                <h2 className={`min-w-0 break-words ${H2}`}>{companyName}</h2>
              </div>
              <p className="mt-4 whitespace-pre-line break-words text-base leading-relaxed text-slate-900">
                {companyDescription}
              </p>
            </section>
          )}

          {/* Y las otras vacantes cierran: se miran cuando ESTA no encaja. */}
          {otros.length > 0 && (
            <section className={`mt-4 p-6 sm:p-7 ${BLOQUE}`}>
              <h2 className={H2}>Otros puestos abiertos</h2>
              <ul className="mt-5 space-y-3">
                {otros.map((o) => (
                  <li key={o.slug}>
                    <OtroPuestoCard otro={o} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </main>

        {/* ---------------- La ficha del puesto, con la acción ---------------- */}
        {hayRail && (
          <aside>
            {/* Pegajosa: la página es larga y el botón no puede quedarse arriba
                mientras se lee. El desfase deja aire sobre ella al fijarse. */}
            <div className="sticky top-8">
              <FichaPuesto donde={donde} condiciones={condiciones} apuntarse={apuntarse} onApuntarse={onApuntarse} />
            </div>
          </aside>
        )}
        </div>
      </HojaPublica>

      {/* LA ACCIÓN VA PEGADA AL PULGAR donde no hay raíl (diseño de Mario), y por
          eso NO se pinta también en el flujo: la página es larga y hay UNA sola
          cosa que hacer, así que el botón tiene que estar SIEMPRE y no en un
          punto concreto del scroll. Dos "Apúntate ahora" serían dos puertas.
          
          FLOTA SOLO EL BOTÓN, SIN BARRA (Mario, ago 2026): nada de fondo blanco
          ni filo, así que el contenido pasa por debajo y se ve. Eso obliga a dos
          cosas. La primera, que la caja que lo posiciona sea `pointer-events-none`
          y solo el botón recupere el puntero, o una franja invisible de 70px se
          tragaría los clics de todo lo que pase por detrás. La segunda, que la
          señal de "9 preguntas · Sin CV" se vaya de aquí al flujo: sin barra
          caería sobre el texto que se desliza por debajo y sería ilegible.
          
          Lleva `shadow-pop` porque es lo que de verdad es: una capa flotando
          sobre contenido, no una caja apoyada. La columna reserva su alto abajo
          (`pb-36`) para que el final no quede debajo. */}
      {!hayRail && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-10 px-6 pb-5">
          <button type="button" onClick={onApuntarse} className={`${BOTON_APUNTARSE} pointer-events-auto shadow-pop`}>
            Apúntate ahora
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * LA FICHA DEL PUESTO: UNA TARJETA, CON GRUPOS DENTRO.
 *
 * Estuvo partida en dos tarjetas flotantes y se ha vuelto a juntar (Mario, ago
 * 2026, con JOIN delante): lo que hay aquí es UNA cosa, la ficha de este puesto,
 * y sus partes se separan con un filo y un rótulo, no con un hueco entre cajas.
 * Dos tarjetas decían que había dos objetos.
 *
 * ES UN CONTORNO, NO UN OBJETO ELEVADO: filo y NADA de sombra. La sombra la
 * gana lo que flota por encima de otra cosa (un menú, un diálogo); esto está
 * apoyado en la misma página que el texto de al lado.
 *
 * CADA GRUPO LLEVA SU RÓTULO. Una lista de seis hechos con seis iconos
 * distintos se lee como un montón; con "Dónde se trabaja" y "Condiciones"
 * delante, se sabe qué se está mirando antes de leerlo.
 */
function FichaPuesto({
  donde, condiciones, apuntarse, onApuntarse,
}: {
  donde: Hecho[]
  condiciones: Hecho[]
  apuntarse: ResumenApuntarse
  onApuntarse: () => void
}) {
  return (
    <div className={FICHA}>
      <button type="button" onClick={onApuntarse} className={BOTON_APUNTARSE}>
        Apúntate ahora
      </button>
      {/* LO QUE CUESTA APUNTARSE, y es UNA LÍNEA.
          
          Es lo que esta app puede decir y ningún portal puede: ahí "Aplicar" es
          una caja negra (¿son dos campos o media hora con registro y un CV que
          no tengo actualizado?), y ese es justo el momento en que la gente
          abandona. Aquí el formulario es del puesto y lo tenemos delante, así
          que el dato sale de `campaign.fields` y cambia solo si la empresa lo
          cambia: no es una promesa de marketing, es un cálculo.
          
          Va PEGADA AL BOTÓN porque la duda aparece al mirar la acción, no a un
          scroll de distancia.
          
          SE PROBÓ ENSEÑANDO LAS PREGUNTAS UNA A UNA, en un bloque propio, y
          Mario lo retiró por excesivo. El argumento es mejor que "ocupa mucho":
          la promesa es "esto se rellena en un momento", y demostrarla con NUEVE
          renglones numerados la desmiente con su propia forma. El recuento la
          cumple; la lista la contradice. Corolario: **cuando algo afirma que es
          corto, la prueba también tiene que serlo.** */}
      <p className="mt-2.5 text-center text-[13px] text-slate-700">
        {senalesApuntarse(apuntarse).join(' · ')}
      </p>
      {donde.length > 0 && (
        <div className="mt-7">
          <h2 className={ROTULO_FICHA}>Dónde se trabaja</h2>
          <Hechos hechos={donde} />
        </div>
      )}
      {condiciones.length > 0 && (
        <div className={donde.length > 0 ? 'mt-6 border-t border-slate-200 pt-6' : 'mt-7'}>
          <h2 className={ROTULO_FICHA}>Condiciones</h2>
          <Hechos hechos={condiciones} />
        </div>
      )}
    </div>
  )
}

/**
 * UN PUESTO DE LA LISTA, CON LA FOTO DE SU MARCA DE FONDO (Mario, ago 2026).
 * Sin foto se queda blanco, que es lo que ya era.
 *
 * LA FOTO ES DE SU MARCA, no de la empresa: dos puestos de la misma casa pueden
 * ser de marcas distintas, y cada tarjeta tiene que enseñar la cara del sitio al
 * que lleva. Por eso el banner viaja por PUESTO dentro de `others`.
 *
 * EL VELO NO ES DECORACIÓN, ES LO QUE HACE LEGIBLE EL TEXTO. Sobre una foto
 * cualquiera no hay tinta que sirva: ni el negro ni el blanco tienen contraste
 * garantizado contra algo que no controlamos. Con un velo oscuro el blanco pasa
 * SIEMPRE, se vea lo que se vea debajo, y la foto sigue leyéndose lo justo para
 * decir de qué va ese trabajo. Es el mismo criterio que la máscara del
 * desvanecido: no pinta, informa.
 *
 * LA ALTURA ES LA MISMA CON FOTO Y SIN ELLA. Si creciera solo la que tiene, una
 * empresa con dos marcas (una con foto y otra sin ella) tendría una lista a
 * saltos, y el tamaño diría algo que no es: que un puesto importa más.
 */
function OtroPuestoCard({ otro }: { otro: OtroPuesto }) {
  const conFoto = !!otro.bannerUrl
  return (
    <Link
      to={publicFormPath(otro.slug, otro.brandLabel)}
      style={conFoto ? { backgroundImage: `url(${otro.bannerUrl})` } : undefined}
      className={`group relative flex min-h-[84px] items-center gap-3 overflow-clip rounded-xl bg-cover bg-center p-4 transition-colors duration-[var(--duration-control)] ease-[var(--ease-out)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
        conFoto ? '' : 'filo bg-white hover:bg-slate-50'
      }`}
    >
      {/* EL VELO VA FUERTE, Y ES UNA DECISIÓN TOMADA CON LOS DOS EXTREMOS VISTOS.
          
          Se probó suave (48%): la foto se veía mucho mejor y las letras perdían.
          Mario eligió las letras, y es lo correcto para lo que esta tarjeta ES:
          un enlace a otro puesto, no una fotografía. Lo que tiene que funcionar
          es leer el título de un vistazo; la foto está para dar la cara de la
          empresa, y para eso le basta con intuirse.
          
          Lo que se aprendió por el camino y se queda escrito: la razón por la
          que el velo empezó tan alto era MALA (estaba calibrado contra una foto
          blanca entera, el peor caso teórico, cuando lo medido en la franja del
          texto es 0,16-0,20 de luminancia, cinco veces más oscuro). La razón
          buena es otra: dentro de la MISMA foto hay cielo y paredes iluminadas
          (p95 de 0,47 y 0,60) y el texto cae donde cae.
          
          TERCERA EXCEPCIÓN DECLARADA A "sin gradientes", después del barrido del
          skeleton y del desvanecido del scroll, con el mismo argumento que
          aquel: no pinta nada, hace legible. Medido en la zona del texto, el
          peor caso posible deja el título en 8,75:1.
          
          Al pasar por encima el velo se ACLARA: la foto asoma un poco más, que
          es el adelanto de lo que hay al otro lado del enlace. Es el mismo gesto
          que la estrella de favorito. */}
      {conFoto && (
        <span
          aria-hidden
          className="absolute inset-0 transition-opacity duration-[var(--duration-control)] ease-[var(--ease-out)] group-hover:opacity-90"
          style={{
            backgroundImage:
              'linear-gradient(90deg, rgb(19 24 34 / 0.82) 0%, rgb(19 24 34 / 0.78) 62%, rgb(19 24 34 / 0.20) 100%)',
          }}
        />
      )}
      <span className="relative min-w-0 flex-1" style={conFoto ? SOMBRA_SOBRE_FOTO : undefined}>
        <span className={`block break-words text-[15px] font-bold ${conFoto ? 'text-white' : 'text-slate-900'}`}>
          {otro.title}
        </span>
        {otro.location.trim() && (
          <span className={`mt-0.5 block break-words text-sm ${conFoto ? 'text-white' : 'text-slate-700'}`}>
            {otro.location}
          </span>
        )}
      </span>
      {/* Sin chevron sobre la foto: caería en la zona clara del degradado, que
          es justo donde no hay velo, y un glifo que no se ve es peor que
          ninguno. Sin foto se queda, que ahí sí se lee. */}
      {!conFoto && <ChevronRight className="relative size-4 shrink-0 text-slate-400" aria-hidden />}
    </Link>
  )
}

/**
 * LA SOMBRA DEL TEXTO SOBRE UNA FOTO. Dos capas y ninguna se ve como sombra:
 * una pegada, que define el borde de la letra contra lo que tenga debajo, y una
 * ancha y difusa, que oscurece el halo alrededor. Es la única forma de
 * garantizar contraste sobre una imagen que no controlamos sin tapar la imagen.
 *
 * Es un `text-shadow`, que NO está en el vocabulario de la casa, y por eso se
 * declara aquí con su motivo: el vocabulario de sombras es de ELEVACIÓN (cajas
 * apoyadas y capas que flotan) y esto no eleva nada, hace legible. Fuera de
 * texto sobre foto no se usa en ninguna parte.
 */
const SOMBRA_SOBRE_FOTO = {
  textShadow: '0 1px 2px rgb(19 24 34 / 0.75), 0 0 16px rgb(19 24 34 / 0.55)',
}

/**
 * LA SUPERFICIE DE LOS BLOQUES DE LA COLUMNA.
 *
 * POR QUÉ SON CAJAS Y NO SECCIONES PLANAS (Mario, ago 2026): están en la columna
 * izquierda para que la página tenga CUERPO aunque el anuncio venga corto. Una
 * empresa que escriba tres líneas de descripción deja media columna vacía al lado
 * de una ficha que sí está llena; con estos dos bloques, lo que hay abajo se lee
 * como contenido y no como el final prematuro de la página.
 *
 * NO SE TIÑEN DEL COLOR DE LA EMPRESA. Se probó (fondo al 5% del acento, filo al
 * 22%) para separarlas del gris de JOIN, y Mario lo retiró: el color de la
 * empresa ya está donde tiene que estar, en la cabecera, el botón y la ficha, y
 * repetido en cada caja de la columna deja de ser un acento para ser el fondo de
 * la página.
 *
 * LO QUE LAS SEPARA DE JOIN ES EL FILO, no el color: su caja es gris a secas
 * (`#f3f4f6`, sin borde) y aquí el hairline es quien hace la profundidad, que es
 * la regla de la casa desde el principio. Con el radio de 16, que es el de una
 * tarjeta grande de superficie externa.
 */
const BLOQUE = 'rounded-2xl filo bg-slate-50'

/**
 * LA FICHA SÍ SE TIÑE DEL COLOR DE LA EMPRESA (Mario, ago 2026), y las cajas de
 * la columna no. La diferencia no es de sitio, es de PAPEL: aquí es donde está
 * la acción y donde se decide, y el tinte dice de quién es este puesto sin
 * gritarlo; los bloques de la izquierda son relleno de contenido y teñirlos
 * también convertía el acento en el fondo de la página.
 *
 * Sobre `--accent-ink` (el acento ya legible sobre blanco) y no sobre el crudo:
 * con un amarillo, un 6% del color puro es un beige sucio y el del oscurecido
 * sigue siendo cálido y limpio. Al 6% es un tinte, no un color: con un acento
 * oscuro se nota apenas y con uno vivo tampoco grita.
 */
const FICHA =
  'rounded-xl border border-[color-mix(in_srgb,var(--accent-ink)_22%,var(--color-slate-200))] bg-[color-mix(in_srgb,var(--accent-ink)_6%,white)] px-5 py-6'

// Los rótulos de sección van a 22 y no a 18 (Mario, ago 2026: "más grandes y
// más espacio"). Aquí no se ojea una lista de mil ofertas como en un portal: se
// lee UNA, así que sus secciones pueden anunciarse. Entre el h1 de 34 y el
// cuerpo de 16 hay sitio de sobra, y el tracking apretado es el de un titular.
const H2 = 'text-[22px] font-bold tracking-tight text-slate-900'
// Los rótulos de la ficha suben con los de la página (Mario, ago 2026), pero a
// 18 y no a los 22 de una sección: aquí son SUBRÓTULOS dentro de una caja de
// 360px, y al cuerpo de un h2 de página se comerían la tarjeta.
const ROTULO_FICHA = 'mb-4 text-lg font-bold tracking-tight text-slate-900'

// SE LLAMA "APÚNTATE AHORA", NO "Aplicar" (Mario, ago 2026).
//
// "Aplicar" es un calco de *to apply*: la palabra de una oficina, y de un portal
// traducido del inglés. Un peón no dice que aplica a un puesto, dice que se
// APUNTA, y el producto se llama Apúntate Fácil: el verbo de la marca estaba en
// el nombre y no estaba en el único botón que la marca le enseña al candidato.
// Es una palabra, y cambia el idioma de la página entera.
//
// El CTA habla el mismo idioma que el botón de enviar del formulario que abre:
// ancho completo, el acento del puesto con su guarda de contraste y el radio de
// un campo, porque debajo de una columna a ancho completo un radio de botón se
// ve descosido. Es la misma decisión que ya tomó `BTN_*_BLOCK`.
const BOTON_APUNTARSE =
  'flex h-[52px] w-full items-center justify-center rounded-xl bg-accent text-base font-semibold text-on-accent transition-[filter] duration-[var(--duration-control)] ease-[var(--ease-out)] hover:brightness-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color-mix(in_srgb,var(--accent)_22%,transparent)] active:translate-y-px motion-reduce:transition-none'

function Requisito({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-base font-bold text-slate-900">{titulo}</h3>
      <p className="mt-1 break-words text-base text-slate-900">{children}</p>
    </div>
  )
}

type Hecho = { Icon: typeof MapPin; texto: string }

/**
 * LOS ICONOS VAN EN GRIS, TAMBIÉN EN LA FICHA (Mario, ago 2026).
 *
 * Estuvieron teñidos del acento del cliente, con el argumento de que esta es su
 * página y de que es la carta que un marketplace no puede jugar. Mario lo
 * retiró, y tiene razón: un icono aquí **identifica el tipo de dato** (dónde,
 * cuánto, qué contrato), no señala nada que se pueda pulsar ni de quién es la
 * página. Pintado del color de la marca, seis glifos seguidos dejan de ser
 * señales de campo y pasan a ser decoración, y encima repiten una identidad que
 * el nombre, el botón, el filo y el fondo de la ficha ya dicen cuatro veces.
 *
 * El color de la empresa sigue donde de verdad hace falta: la cabecera, el
 * botón, el nombre y el tinte de la ficha.
 */
function Hechos({ hechos }: { hechos: Hecho[] }) {
  if (!hechos.length) return null
  return (
    <ul className="space-y-4.5">
      {hechos.map(({ Icon, texto }) => (
        <li key={texto} className="flex items-start gap-2.5">
          {/* El icono se centra con la primera LÍNEA del texto, no con el bloque
              entero: una ubicación de dos renglones dejaría el glifo flotando a
              media altura, lejos de la palabra que acompaña. */}
          <Icon className="mt-px size-[18px] shrink-0 text-slate-500" aria-hidden />
          <span className="min-w-0 break-words text-base text-slate-900">{texto}</span>
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
    return <p className="mt-5 break-words text-base leading-relaxed text-slate-900">{texto.trim()}</p>
  return (
    <ul className="mt-5 space-y-3">
      {lineas.map((l, i) => (
        <li key={i} className="flex gap-3">
          <span className="text-xl font-bold leading-[1.3] text-slate-400" aria-hidden>&bull;</span>
          <span className="min-w-0 break-words text-base leading-relaxed text-slate-900">{l}</span>
        </li>
      ))}
    </ul>
  )
}
