import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from '../components/Logo'
import { BRAND } from '../lib/brand'
import { PRIVACY_DOC, TERMS_DOC, type LegalDoc } from '../lib/legal'

// La fecha y la versión son de los DOS documentos: se suben juntas aunque el
// cambio toque a uno solo, porque lo que se publica es el par y una versión que
// solo vale para la mitad no se puede citar.
const LAST_UPDATED = '8 de septiembre de 2026'
const VERSION = '1.5'

function LegalLayout({ doc, other }: { doc: LegalDoc; other: { to: string; label: string } }) {
  useEffect(() => {
    window.scrollTo(0, 0)
    const prev = document.title
    document.title = `${doc.title} – ${BRAND}`
    return () => {
      document.title = prev
    }
  }, [doc.title])

  return (
    <div className="min-h-svh bg-white text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2" aria-label={BRAND}>
            <Logo className="size-7" />
            <span className="text-[16px] brand-wordmark text-slate-900" aria-hidden>apuntatefacil</span>
          </Link>
          <nav className="flex items-center gap-1 text-sm" aria-label="Páginas legales">
            <Link to={other.to} className="rounded-lg px-3 py-2 font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900">
              {other.label}
            </Link>
            <Link to="/" className="rounded-lg px-3 py-2 font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900">
              Inicio
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-[40px] sm:leading-[1.1]">{doc.title}</h1>
        <p className="mt-3 text-sm text-slate-500">Última actualización: {LAST_UPDATED} · Versión {VERSION}</p>
        <p className="mt-6 text-lg leading-relaxed text-slate-600">{doc.intro}</p>

        {doc.sections.map((section) => (
          <section key={section.heading} className="mt-10">
            <h2 className="text-xl font-bold tracking-tight text-slate-900">{section.heading}</h2>
            {section.blocks.map((block, i) =>
              block.type === 'p' ? (
                <p key={i} className="mt-4 text-[15px] leading-relaxed text-slate-600">{block.text}</p>
              ) : (
                <ul key={i} className="mt-4 space-y-2.5">
                  {block.items.map((item, j) => (
                    <li key={j} className="flex gap-3 text-[15px] leading-relaxed text-slate-600">
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-slate-300" aria-hidden />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ),
            )}
          </section>
        ))}

        <div className="mt-14 border-t border-slate-200 pt-6 text-sm text-slate-500">
          ¿Tienes una duda? Lee también{' '}
          <Link to={other.to} className="font-medium text-indigo-700 hover:text-indigo-800">
            {other.label.toLowerCase()}
          </Link>{' '}
          o vuelve al{' '}
          <Link to="/" className="font-medium text-indigo-700 hover:text-indigo-800">
            inicio
          </Link>
          .
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <Logo className="size-6" />
            <span className="text-sm brand-wordmark text-slate-900" aria-hidden>apuntatefacil</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[13px] text-slate-500">
            <Link to="/privacidad" className="hover:text-slate-800">Privacidad</Link>
            <Link to="/terminos" className="hover:text-slate-800">Términos</Link>
            <Link to="/" className="hover:text-slate-800">Inicio</Link>
          </div>
        </div>
        <p className="pb-8 text-center text-[12px] text-slate-500">© 2026 {BRAND}. Hecho en España.</p>
      </footer>
    </div>
  )
}

export function Privacidad() {
  return <LegalLayout doc={PRIVACY_DOC} other={{ to: '/terminos', label: 'Términos' }} />
}

export function Terminos() {
  return <LegalLayout doc={TERMS_DOC} other={{ to: '/privacidad', label: 'Privacidad' }} />
}
