import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff, Loader2, Mail } from 'lucide-react'
import { consumirSesionCaducada, useAuth } from '../lib/auth'
import { setRememberMe } from '../lib/supabase'
import { AccesoLayout, AccesoTitulo, ETIQUETA_ACCESO, campoAcceso } from '../components/AccesoLayout'
import { Checkbox } from '../components/ui/Checkbox'
import { InfoTooltip } from '../components/ui/Tooltip'
import { MedidorContrasena } from '../components/MedidorContrasena'
import { PWD_AYUDA, passwordValid } from '../lib/password'
import { BTN_ACCESO, BTN_ACCESO_SOCIAL } from '../lib/buttons'
import { IconoVacio } from '../components/ui/IconoVacio'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Solo permite rutas INTERNAS como destino tras login (evita open redirect).
function safeNext(next: string | null): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return '/app'
  try {
    const u = new URL(next, window.location.origin)
    if (u.origin !== window.location.origin) return '/app'
    return u.pathname + u.search
  } catch {
    return '/app'
  }
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden width="18" height="18">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.46 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z" />
    </svg>
  )
}

type Mode = 'signin' | 'signup'
type View = 'form' | 'confirm-sent' | 'reset-request' | 'reset-sent'

/** Las vistas que solo dan un recado (email enviado): mismo titular, con su glifo. */
function Recado({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="text-center">
      <IconoVacio Icon={Mail} />
      <h1 className="mt-5 text-balance text-[26px] font-bold leading-[1.15] tracking-[-0.012em] text-slate-900">
        {titulo}
      </h1>
      {children}
    </div>
  )
}

export function Login() {
  const { signInWithGoogle, signUpWithPassword, signInWithPassword, sendPasswordReset, resendConfirmation, session, loading } = useAuth()
  const navigate = useNavigate()
  // Se lee UNA vez al montar, porque leerlo lo borra: si se llamara en el render
  // se consumiría en el primer pintado y el aviso no llegaría a verse.
  const [sesionCaducada] = useState(consumirSesionCaducada)
  const [params] = useSearchParams()
  // Destino tras entrar: por defecto /app; respeta ?next= solo si es una ruta
  // INTERNA (evita open redirect: rechaza //, /\ y orígenes externos).
  const dest = safeNext(params.get('next'))

  const [mode, setMode] = useState<Mode>('signin')
  // EL ALTA VA EN DOS PASOS (Mario, ago 2026): email primero, contraseña después.
  // No es solo estética: el alta pide estrictamente más que la entrada (la ayuda de
  // la contraseña, el medidor y la casilla de términos), y todo junto no cabía en la
  // ventana, así que la columna izquierda se desplazaba justo en la pantalla por la
  // que se entra al producto. Partido en dos, cada paso pide UNA cosa y ninguno se
  // sale. La ENTRADA sigue en un paso: ahí no sobra nada que partir.
  const [paso, setPaso] = useState<1 | 2>(1)
  const refPassword = useRef<HTMLInputElement>(null)
  const [view, setView] = useState<View>('form')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [unconfirmed, setUnconfirmed] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [remember, setRemember] = useState(true)
  const [accepted, setAccepted] = useState(false) // términos + privacidad (obligatorio solo en el alta)

  const switchMode = (m: Mode) => {
    setMode(m)
    setPaso(1)
    setError(null)
    setUnconfirmed(false)
  }
  const backToForm = () => {
    setView('form')
    setPaso(1)
    setError(null)
    setNote(null)
    setUnconfirmed(false)
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!EMAIL_RE.test(email)) {
      setError('Escribe un email válido, por ejemplo nombre@dominio.com')
      return
    }
    // Primer paso del alta: solo se comprueba el email y se pasa al siguiente. No
    // toca la red a propósito: preguntarle al servidor si ese email ya existe
    // convertiría esta pantalla en un comprobador de cuentas ajenas.
    if (altaPaso1) {
      setError(null)
      setPaso(2)
      return
    }
    if (mode === 'signup' && !passwordValid(password)) {
      setError('La contraseña aún no cumple los requisitos de abajo.')
      return
    }
    if (mode === 'signin' && password.length === 0) {
      setError('Escribe tu contraseña.')
      return
    }
    if (mode === 'signup' && !accepted) {
      setError('Marca la casilla para aceptar los términos y la política de privacidad.')
      return
    }
    setError(null)
    setUnconfirmed(false)
    setRememberMe(remember)
    setBusy(true)
    if (mode === 'signup') {
      const res = await signUpWithPassword(email, password)
      setBusy(false)
      if (res.error) setError(res.error)
      else if (res.needsConfirmation) setView('confirm-sent')
      else navigate(dest)
    } else {
      const res = await signInWithPassword(email, password)
      setBusy(false)
      if (res.error) {
        setError(res.error)
        if (res.error.includes('confirmar tu email')) setUnconfirmed(true)
      } else {
        navigate(dest)
      }
    }
  }

  const onResend = async () => {
    setBusy(true)
    const res = await resendConfirmation(email)
    setBusy(false)
    setNote(res.error ? res.error : 'Te hemos reenviado el email.')
  }

  const onReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!EMAIL_RE.test(email)) {
      setError('Escribe un email válido, por ejemplo nombre@dominio.com')
      return
    }
    setError(null)
    setBusy(true)
    const res = await sendPasswordReset(email)
    setBusy(false)
    if (res.error) setError(res.error)
    else setView('reset-sent')
  }

  // Los tres momentos del formulario. Se derivan de `mode` + `paso` y no son un
  // estado aparte: dos listas para la misma verdad se desincronizan siempre.
  const altaPaso1 = mode === 'signup' && paso === 1
  const altaPaso2 = mode === 'signup' && paso === 2
  // El email se pide en la entrada y en el primer paso del alta; la contraseña, en la
  // entrada y en el segundo. Google y su divisor solo donde se está ELIGIENDO cómo
  // entrar, que es la primera pantalla de cada camino.
  const pideEmail = mode === 'signin' || altaPaso1
  const pidePassword = mode === 'signin' || altaPaso2

  // AL LLEGAR AL PASO 2, EL FOCO VA A LA CONTRASEÑA. En un asistente, el paso
  // siguiente es la continuación del gesto anterior: si vienes de pulsar Intro en el
  // email, tener que ir a buscar el campo con el ratón parte en dos una acción que
  // era una sola. Y de paso es lo correcto para quien navega con teclado o lector: el
  // foco no puede quedarse en un botón que ya no está en pantalla.
  //
  // VA EN UN EFECTO Y NO EN EL MANEJADOR, que es un tropiezo ya conocido de este
  // proyecto (el buscador del panel): un `focus()` programado dentro del click puede
  // ejecutarse antes de que React comite, y entonces el `ref` todavía es null y el
  // campo se abre apagado. Después del commit, el input ya está montado.
  useEffect(() => {
    if (altaPaso2) refPassword.current?.focus()
  }, [altaPaso2])

  // Si ya hay sesión, no enseñamos el login: directo al panel (o al ?next= seguro).
  //
  // Ojo con esta línea, porque fue la mitad de un bucle (26-ago-2026): con una
  // sesión CADUCADA guardada, el usuario venía a entrar, esto lo daba por dentro
  // y lo mandaba al panel, y el panel, al no poder cargar su empresa, lo mandaba
  // al onboarding. No había forma de volver a entrar. La otra mitad, y donde
  // está el arreglo, es que ahora una sesión que la base rechaza se cierra de
  // verdad (`esSesionMuerta` en auth.tsx), así que aquí ya no hay `session`.
  if (!loading && session) return <Navigate to={dest} replace />

  return (
    <AccesoLayout>
      {/* Por qué estás aquí otra vez. Sin esta línea, cerrar la sesión por un token
          muerto se vive como "me ha echado sin motivo", que es de las cosas que más
          desconfianza generan en una app con tus datos dentro. Se lee UNA vez: el
          recado se consume al leerlo. */}
      {sesionCaducada && (
        <p role="status" className="mb-7 rounded-xl bg-slate-100 px-4 py-3 text-[13px] leading-relaxed text-slate-700">
          Tu sesión había caducado, así que la hemos cerrado. Vuelve a entrar y sigues donde lo dejaste: no se ha perdido nada.
        </p>
      )}

      {view === 'confirm-sent' ? (
        <Recado titulo="Te hemos enviado un email para confirmar tu cuenta">
          <p className="mt-3 text-pretty text-sm leading-relaxed text-slate-500">
            Lo enviamos a <strong className="font-semibold text-slate-800">{email}</strong>. Ábrelo y pulsa el enlace para activar tu cuenta y entrar.
          </p>
          {note && <p className="mt-3 text-[13px] font-medium text-slate-600">{note}</p>}
          <div className="mt-6 flex flex-col items-center gap-2.5">
            <button onClick={onResend} disabled={busy} className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 disabled:opacity-60">
              Reenviar email
            </button>
            <button onClick={backToForm} className="text-sm font-medium text-slate-500 hover:text-slate-800">
              Usar otro email
            </button>
          </div>
        </Recado>
      ) : view === 'reset-sent' ? (
        <Recado titulo="Revisa tu email">
          <p className="mt-3 text-pretty text-sm leading-relaxed text-slate-500">
            Si existe una cuenta con <strong className="font-semibold text-slate-800">{email}</strong>, te hemos enviado un enlace para crear una contraseña nueva.
          </p>
          <button onClick={backToForm} className="mt-6 text-sm font-semibold text-indigo-600 hover:text-indigo-700">
            Volver a entrar
          </button>
        </Recado>
      ) : view === 'reset-request' ? (
        <>
          <AccesoTitulo titulo="Restablecer contraseña" sub="Te enviamos un enlace para crear una contraseña nueva." />
          <form onSubmit={onReset} className="mt-10">
            <label htmlFor="reset-email" className={ETIQUETA_ACCESO}>Email</label>
            <input
              id="reset-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(null) }}
              placeholder="nombre@tuempresa.com"
              aria-invalid={!!error}
              className={campoAcceso(!!error)}
            />
            {error && <p className="mt-2 text-[13px] font-medium text-red-600">{error}</p>}
            <button type="submit" disabled={busy} className={`mt-4 ${BTN_ACCESO}`}>
              {busy ? <><Loader2 className="size-4 animate-spin" aria-hidden /> Enviando...</> : 'Enviar enlace'}
            </button>
          </form>
          <p className="mt-8 text-center text-sm font-medium text-slate-500">
            <button type="button" onClick={backToForm} className="font-semibold text-slate-900 underline-offset-2 hover:underline">
              Volver a entrar
            </button>
          </p>
        </>
      ) : (
        <>
          <AccesoTitulo
            titulo={mode === 'signin' ? '¡Bienvenido de nuevo!' : altaPaso1 ? 'Crea tu cuenta' : 'Elige una contraseña'}
            sub={
              mode === 'signin' ? (
                'Tus puestos y tus candidatos, donde los dejaste.'
              ) : altaPaso1 ? (
                'Prueba gratis, sin compromiso.'
              ) : (
                // En el segundo paso, el subtítulo deja de vender y pasa a decir para
                // QUIÉN es esta contraseña. El email escrito es lo que evita crear la
                // cuenta con una errata que ya no se ve en pantalla, y "Cambiar" es la
                // vuelta atrás: sin ella, el paso dos sería una puerta de una sola
                // dirección.
                <>
                  Para <strong className="font-semibold text-slate-800">{email}</strong>.{' '}
                  <button
                    type="button"
                    onClick={() => { setPaso(1); setError(null) }}
                    className="font-medium text-indigo-600 underline-offset-2 hover:underline"
                  >
                    Cambiar
                  </button>
                </>
              )
            }
          />

          {/* El Figma pone dos identidades aquí, Google y Apple, y Apple NO EXISTE en
              este producto (el acceso es Google + email con contraseña). Un botón que
              no puede hacer nada es peor que ningún botón, así que queda uno y ocupa
              la fila entera. Si algún día se da de alta Apple, vuelven los dos y esto
              es una rejilla de dos columnas. */}
          {!altaPaso2 && (
            <>
              <button
                onClick={() => { setRememberMe(remember); signInWithGoogle() }}
                className={`mt-10 ${BTN_ACCESO_SOCIAL}`}
              >
                <GoogleIcon /> Continuar con Google
              </button>

              <div className="my-8 flex items-center gap-4">
                <span className="h-px flex-1 bg-slate-200" aria-hidden />
                <span className="text-[13px] font-semibold text-slate-500">O</span>
                <span className="h-px flex-1 bg-slate-200" aria-hidden />
              </div>
            </>
          )}

          <form onSubmit={onSubmit} className={altaPaso2 ? 'mt-10' : undefined}>
            {pideEmail && (
              <>
                <label htmlFor="email" className={ETIQUETA_ACCESO}>Email</label>
                <input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(null) }}
                  placeholder="nombre@tuempresa.com"
                  aria-invalid={!!error}
                  className={campoAcceso(!!error)}
                />
              </>
            )}

            {pidePassword && (
              <>
                {/* En el alta, el rótulo lleva su ayuda: la frase del medidor pasa a
                    hablar de lo que FALTA en cuanto escribes una letra, así que el
                    listado entero deja de estar a la vista y tiene que poder pedirse.
                    Es la primitiva del sistema (`InfoTooltip`), no un globo a mano. */}
                <div className={`${ETIQUETA_ACCESO} flex items-center gap-1.5 ${mode === 'signin' ? 'mt-5' : ''}`}>
                  <label htmlFor="password">Contraseña</label>
                  {altaPaso2 && <InfoTooltip text={PWD_AYUDA} />}
                </div>
                <div className="relative">
                  <input
                    id="password"
                    ref={refPassword}
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(null) }}
                    placeholder={mode === 'signup' ? 'Crea una contraseña' : 'Tu contraseña'}
                    aria-invalid={!!error}
                    aria-describedby={altaPaso2 ? 'password-medidor' : undefined}
                    className={`${campoAcceso(!!error)} pr-12`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    className="absolute right-1.5 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-lg text-slate-500 hover:text-slate-700"
                  >
                    {showPassword ? <EyeOff className="size-[18px]" aria-hidden /> : <Eye className="size-[18px]" aria-hidden />}
                  </button>
                </div>

                {altaPaso2 && <MedidorContrasena valor={password} id="password-medidor" />}

                <div className="mt-4 flex items-center justify-between gap-3">
                  <label className="flex cursor-pointer select-none items-center gap-2 text-[13px] text-slate-600">
                    <Checkbox
                      checked={remember}
                      onChange={(e) => { setRemember(e.target.checked); setRememberMe(e.target.checked) }}
                    />
                    Recordarme
                  </label>
                  {mode === 'signin' && (
                    <button
                      type="button"
                      onClick={() => { setView('reset-request'); setError(null) }}
                      className="text-[13px] font-medium text-indigo-600 hover:text-indigo-700"
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  )}
                </div>
              </>
            )}

            {altaPaso2 && (
              <label className="mt-3 flex cursor-pointer items-start gap-2.5 text-[13px] leading-relaxed text-slate-600">
                <Checkbox checked={accepted} onChange={(e) => { setAccepted(e.target.checked); setError(null) }} className="mt-px" />
                <span>
                  Acepto los{' '}
                  <Link to="/terminos" target="_blank" rel="noopener noreferrer" className="font-medium text-indigo-600 hover:text-indigo-700">términos</Link>
                  {' '}y la{' '}
                  <Link to="/privacidad" target="_blank" rel="noopener noreferrer" className="font-medium text-indigo-600 hover:text-indigo-700">política de privacidad</Link>.
                </span>
              </label>
            )}

            {error && <p className="mt-4 text-[13px] font-medium text-red-600">{error}</p>}
            {unconfirmed && (
              <button type="button" onClick={onResend} disabled={busy} className="mt-2 text-[13px] font-semibold text-indigo-600 hover:text-indigo-700 disabled:opacity-60">
                Reenviar email de confirmación
              </button>
            )}
            {/* El acuse ("te lo hemos reenviado") es un estado, no algo que se pulse:
                el ultramarine es solo para acción, foco y selección. */}
            {note && <p className="mt-2 text-[12px] font-medium text-slate-600">{note}</p>}

            <button
              type="submit"
              disabled={busy || (altaPaso2 && !passwordValid(password))}
              className={`mt-5 ${BTN_ACCESO}`}
            >
              {busy ? (
                <><Loader2 className="size-4 animate-spin" aria-hidden /> {mode === 'signin' ? 'Entrando...' : 'Creando cuenta...'}</>
              ) : mode === 'signin' ? (
                'Iniciar sesión con correo'
              ) : altaPaso1 ? (
                'Continuar'
              ) : (
                'Crear cuenta'
              )}
            </button>

          </form>

          {/* El conmutador del diseño: una línea, no un `radiogroup`. Sustituye a las
              dos mitades que había arriba, y con ellas se va la duda de qué mitad está
              puesta: aquí lo que hay es una pantalla con su título y una salida a la
              otra. El verbo va en tinta porque es lo que se pulsa; la pregunta, en
              gris de apoyo. */}
          <p className="mt-8 text-center text-sm font-medium text-slate-500">
            {mode === 'signin' ? '¿No tienes una cuenta? ' : '¿Ya tienes una cuenta? '}
            <button
              type="button"
              onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}
              className="font-semibold text-slate-900 underline-offset-2 hover:underline"
            >
              {mode === 'signin' ? 'Regístrate' : 'Inicia sesión'}
            </button>
          </p>
        </>
      )}
    </AccesoLayout>
  )
}
