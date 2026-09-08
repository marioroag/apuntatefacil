import { PRECIO_PROCESO } from '../lib/pricing'

// El precio del pago por proceso, con el número protagonista y el símbolo €
// pequeño y arriba (cuanto más discreta la moneda, menos "dolor de pago").
//
// LA UNIDAD DE COBRO NO VA AQUÍ: BAJA AL PRIMER BENEFICIO (sep 2026, a partir
// de una idea del padre de Mario: "por 49 al mes tienes tu propio centro de
// contratación"). Estaba pegada al número ("49 € al mes, por proceso
// abierto"), así que lo PRIMERO que se leía del precio era contabilidad y no
// lo que te llevas. El número se queda solo y quien dice de qué es pasa a ser
// la primera línea de la lista de la misma tarjeta ("1 proceso de selección
// abierto. Cada proceso más, otros N € al mes").
//
// LO QUE ESO OBLIGA, y por eso está escrito en los dos sitios: quien monte
// este componente TIENE que decir la unidad a la vista, antes de contratar.
// Un "49 € al mes" a secas es falso para quien abra un segundo proceso, y
// dejar que se entere ya dentro es una omisión engañosa (art. 7 de la Ley de
// Competencia Desleal) además del dark pattern que esta casa no hace. Hoy el
// único consumidor es la sección de precios de la landing, que la pone la
// primera de sus beneficios.
//
// EL HUECO QUE DEJA LA UNIDAD SE LO QUEDA "SIN PERMANENCIA" (Mario, sep 2026),
// que es la otra mitad de la promesa del modelo y la que de verdad quita el
// miedo a empezar. Va aquí el rótulo y NO en la frase que lo explica: repetido
// en las dos líneas seguidas sería lo mismo dicho dos veces, así que quien
// monte esto explica el cómo ("cierras un proceso con un clic...") sin volver
// a nombrarlo.
//
// Los impuestos se dicen al lado, siempre (la LSSI obliga a decir si el precio
// los incluye), pero desde sep 2026 como "impuestos no incluidos" y no "+ IVA":
// somos una empresa canaria y no cobramos IVA a nadie (IGIC a Canarias, nada
// con inversión del sujeto pasivo a la Península), así que prometer IVA era
// prometer una línea que no aparece en la factura. Un único componente para
// todas las superficies.
export function PrecioProceso({ compact = false }: { compact?: boolean }) {
  return (
    <div>
      <div className={`flex flex-wrap items-baseline ${compact ? 'gap-x-1.5' : 'gap-x-2'}`}>
        <span className={`flex items-start font-bold tracking-tight text-slate-900 ${compact ? 'text-3xl' : 'text-5xl'}`}>
          <span className="num">{PRECIO_PROCESO}</span>
          <span className={`font-semibold text-slate-600 ${compact ? 'ml-0.5 mt-0.5 text-base' : 'ml-1 mt-1.5 text-xl'}`}>€</span>
        </span>
        <span className={`text-slate-500 ${compact ? 'text-sm' : 'text-lg'}`}>al mes, sin permanencia</span>
      </div>
      <p className={`text-slate-500 ${compact ? 'mt-0.5 text-[12px]' : 'mt-1 text-sm'}`}>Impuestos no incluidos.</p>
    </div>
  )
}
