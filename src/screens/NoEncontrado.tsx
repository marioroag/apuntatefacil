import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { Logo } from '../components/Logo'
import { IconoVacio } from '../components/ui/IconoVacio'
import { BTN_PRIMARY, BTN_SECONDARY } from '../lib/buttons'
import { BRAND } from '../lib/brand'
import { useAuth } from '../lib/auth'

/**
 * LA PÁGINA QUE NO EXISTE (Mario, sep 2026: "ya va siendo hora de tener una
 * página 404"). Hasta hoy una ruta desconocida REDIRIGÍA A LA PORTADA sin
 * decir nada: quien llegaba con un enlace mal copiado aterrizaba en la landing
 * creyendo que era lo que le habían mandado.
 *
 * Dos superficies, una pieza. Fuera del panel es una tarjeta sobre el gris de
 * la app, con la marca (que aquí sí se pinta: es lo único que dice dónde
 * estás) y la salida que toque: la portada, o el panel si hay sesión. Dentro
 * del panel (`enPanel`) va sin marca ni tarjeta, porque el lateral ya dice
 * dónde estás, y la salida es la vista general.
 *
 * Los enlaces de PUESTO no llegan aquí: `/<marca>/<slug>` los atiende
 * PublicForm, que sabe distinguir "este enlace ya no está activo" de "esta
 * página no existe". Aquí caen los que no tienen forma de enlace de nada.
 */
export function NoEncontrado({ enPanel = false }: { enPanel?: boolean }) {
  const { session } = useAuth()

  useEffect(() => {
    const anterior = document.title
    document.title = `Página no encontrada · ${BRAND}`
    return () => { document.title = anterior }
  }, [])

  const cuerpo = (
    <>
      <IconoVacio Icon={Compass} />
      <p className="mt-4 text-[12px] font-medium uppercase tracking-[var(--tracking-overline)] text-slate-500">Error 404</p>
      <h1 className="mt-1 text-xl font-semibold text-slate-900">Esta página no existe</h1>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
        {enPanel
          ? 'El enlace puede estar mal escrito o esa pantalla ya no está.'
          : 'El enlace puede estar mal escrito o la página ya no está. Si te lo ha mandado una empresa para apuntarte a un puesto, pídele que te lo vuelva a compartir.'}
      </p>
      <div className={`mt-6 flex flex-wrap gap-2 ${enPanel ? '' : 'justify-center'}`}>
        {enPanel ? (
          <Link to="/app/resumen" className={BTN_PRIMARY}>Ir a la vista general</Link>
        ) : (
          <>
            <Link to="/" className={BTN_PRIMARY}>Ir a la portada</Link>
            {session && <Link to="/app" className={BTN_SECONDARY}>Ir a mi panel</Link>}
          </>
        )}
      </div>
    </>
  )

  if (enPanel) {
    return (
      <div className="mx-auto max-w-lectura px-4 py-16 sm:px-6 lg:px-8">
        <div className="max-w-md">{cuerpo}</div>
      </div>
    )
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-slate-50 px-4 py-8">
      <Link to="/" className="mb-6 flex items-center gap-2 text-[15px] font-semibold text-slate-900" aria-label={`${BRAND}, ir a la portada`}>
        <Logo className="size-7" />
        apuntatefacil
      </Link>
      <div className="w-full max-w-[420px] rounded-2xl filo bg-white p-7 text-center shadow-card">{cuerpo}</div>
    </div>
  )
}
