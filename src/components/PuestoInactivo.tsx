import { Link } from 'react-router-dom'
import { Logo } from './Logo'
import { OtroPuestoCard } from './AnuncioPublico'
import { BTN_PRIMARY_LG } from '../lib/buttons'
import { BRAND } from '../lib/brand'
import type { OtroPuesto } from '../lib/demoPublico'

/**
 * LO QUE VE QUIEN ABRE UN ENLACE DE PUESTO QUE YA NO ACEPTA CANDIDATURAS
 * (cerrado o pausado), o uno que no existe. Diseño de sep 2026 (Mario:
 * "mejora cómo se ve, y si sabemos la empresa y tiene otros puestos activos,
 * ofrécelos"). Era la tarjeta de 420px del formulario flotando en gris, con
 * un icono de enlace roto: un callejón.
 *
 * Ahora es una PÁGINA, con la escala de la 404 y de la portada: marca arriba,
 * titular grande, un párrafo que dice quién lo ha cerrado y qué hacer. Y la
 * parte que importa: si la empresa tiene otros puestos abiertos, se ofrecen
 * debajo con las mismas tarjetas que el anuncio, porque quien ha llegado
 * hasta aquí quería trabajar en esa empresa, no en ese puesto en concreto. El
 * servidor ya los devolvía junto a cualquier puesto, también a uno cerrado.
 *
 * Sin empresa (el enlace no existe) no hay nada que ofrecer: la portada.
 */
export function PuestoInactivo({ motivo, titulo, companyName, otros }: {
  motivo: 'cerrado' | 'pausado' | 'noExiste'
  titulo?: string
  companyName?: string
  otros: OtroPuesto[]
}) {
  const empresa = companyName?.trim() || 'La empresa'
  const puesto = titulo?.trim()
  const h1 = motivo === 'noExiste'
    ? 'Este enlace no existe'
    : motivo === 'pausado'
      ? 'Este puesto no admite candidaturas ahora mismo'
      : 'Este puesto ya está cerrado'
  const texto = motivo === 'noExiste'
    ? 'Puede estar mal escrito o haberse borrado. Pídele a quien te lo mandó que te lo vuelva a compartir.'
    : motivo === 'pausado'
      ? `${empresa} ha pausado la selección${puesto ? ` de «${puesto}»` : ''}. Puede volver a abrirla; si crees que es un error, pídeselo a quien te compartió el enlace.`
      : `${empresa} ha cerrado la selección${puesto ? ` de «${puesto}»` : ''}. Si crees que es un error, pídeselo a quien te compartió el enlace.`

  return (
    <div className="flex min-h-svh flex-col bg-white">
      <header className="px-6 py-5 sm:px-10">
        <Link to="/" className="inline-flex items-center gap-2" aria-label={`${BRAND}, ir a la portada`}>
          <Logo className="size-8" />
          <span className="text-lockup brand-wordmark text-slate-900" aria-hidden translate="no">apuntatefacil</span>
        </Link>
      </header>
      <main className="flex flex-1 items-center">
        <div className="mx-auto w-full max-w-lectura px-6 pb-24 pt-6 sm:px-10">
          {companyName?.trim() && <p className="text-sm font-medium text-slate-500">{companyName}</p>}
          <h1 className="mt-3 text-balance text-[32px] font-bold leading-[1.1] tracking-[-0.012em] text-slate-900 sm:text-[40px]">{h1}</h1>
          <p className="mt-5 max-w-[52ch] text-lg leading-relaxed text-slate-600">{texto}</p>

          {otros.length > 0 ? (
            <section className="mt-12">
              <h2 className="text-[22px] font-bold tracking-tight text-slate-900">
                {otros.length === 1 ? 'Otro puesto abierto en' : 'Otros puestos abiertos en'} {empresa}
              </h2>
              <ul className="mt-5 space-y-3">
                {otros.map((o) => (
                  <li key={o.slug}>
                    <OtroPuestoCard otro={o} />
                  </li>
                ))}
              </ul>
            </section>
          ) : motivo === 'noExiste' ? (
            <div className="mt-10">
              <Link to="/" className={BTN_PRIMARY_LG}>Ir a la portada</Link>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  )
}
