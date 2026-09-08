import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from '../components/Logo'
import { BTN_PRIMARY, BTN_PRIMARY_LG, BTN_SECONDARY_LG } from '../lib/buttons'
import { BRAND } from '../lib/brand'
import { useAuth } from '../lib/auth'

/**
 * LA PÁGINA QUE NO EXISTE (Mario, sep 2026: "ya va siendo hora de tener una
 * página 404"). Hasta hoy una ruta desconocida REDIRIGÍA A LA PORTADA sin
 * decir nada: quien llegaba con un enlace mal copiado aterrizaba en la landing
 * creyendo que era lo que le habían mandado.
 *
 * ES UNA PÁGINA, NO UNA TARJETA (Mario, sep 2026: "se ve feísimo"). La primera
 * versión era la tarjeta de 420px del formulario público flotando sobre el
 * gris, y una pantalla entera con una caja pequeña en medio se lee como un
 * aviso, no como un sitio. Ahora es la escala de la portada: fondo blanco, la
 * marca arriba como en la landing, un titular de 40 y un párrafo con aire,
 * sin caja ni icono. El "404" va en pequeño y en gris, como un dato: es lo
 * que buscará quien sepa lo que es, y no hace falta gritarlo.
 *
 * Dos superficies, una pieza. Fuera del panel, la portada o el panel si hay
 * sesión; dentro (`enPanel`, en `/app` y `/demo`), sin marca porque el lateral
 * ya dice dónde estás, y la salida es la vista general. Los enlaces de PUESTO
 * no llegan aquí: los atiende PublicForm, que distingue "ya no está activo".
 */
export function NoEncontrado({ enPanel = false }: { enPanel?: boolean }) {
  const { session } = useAuth()

  useEffect(() => {
    const anterior = document.title
    document.title = `Página no encontrada · ${BRAND}`
    return () => { document.title = anterior }
  }, [])

  if (enPanel) {
    return (
      <div className="mx-auto max-w-lectura px-4 py-20 sm:px-6 lg:px-8">
        <p className="num text-sm font-medium text-slate-500">Error 404</p>
        <h1 className="mt-2 text-[28px] font-bold leading-tight tracking-[-0.012em] text-slate-900">Esta página no existe</h1>
        <p className="mt-3 max-w-[52ch] text-base leading-relaxed text-slate-600">
          El enlace puede estar mal escrito, o esa pantalla ya no está.
        </p>
        <div className="mt-8">
          <Link to="/app/resumen" className={BTN_PRIMARY}>Ir a la vista general</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-svh flex-col bg-white">
      <header className="px-6 py-5 sm:px-10">
        <Link to="/" className="inline-flex items-center gap-2" aria-label={`${BRAND}, ir a la portada`}>
          <Logo className="size-8" />
          <span className="text-lockup brand-wordmark text-slate-900" aria-hidden translate="no">apuntatefacil</span>
        </Link>
      </header>
      <main className="flex flex-1 items-center">
        <div className="mx-auto w-full max-w-lectura px-6 pb-24 sm:px-10">
          <p className="num text-sm font-medium text-slate-500">Error 404</p>
          <h1 className="mt-3 text-balance text-[32px] font-bold leading-[1.1] tracking-[-0.012em] text-slate-900 sm:text-[40px]">
            Esta página no existe
          </h1>
          <p className="mt-5 max-w-[52ch] text-lg leading-relaxed text-slate-600">
            El enlace puede estar mal escrito, o la página ya no está. Si te lo ha mandado una empresa
            para apuntarte a un puesto, pídele que te lo vuelva a compartir.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link to="/" className={BTN_PRIMARY_LG}>Ir a la portada</Link>
            {session && <Link to="/app" className={BTN_SECONDARY_LG}>Ir a mi panel</Link>}
          </div>
        </div>
      </main>
    </div>
  )
}
