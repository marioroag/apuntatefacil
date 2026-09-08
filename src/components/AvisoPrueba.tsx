import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useStore } from '../lib/store'
import { useAppBase } from '../lib/useAppBase'
import { useOnboarding } from '../lib/onboarding'
import { diasDePruebaRestantes, finDePrueba, pendienteDePago, procesoAbierto, pruebaAgotada } from '../lib/pricing'
import { UMBRAL_AGOTADA, guardarAvisoPrueba, leerAvisosPrueba, tocaAvisar, umbralPrueba } from '../lib/avisoPrueba'
import { ConfirmDialog } from './ui/ConfirmDialog'

const fechaCorta = (iso: string) =>
  new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })

/**
 * EL AVISO DE QUE LA PRUEBA SE ACABA, con la puerta a Facturación.
 *
 * Lo monta el shell, que es lo único que nunca se desmonta, así que aparece
 * entres por donde entres. Cuándo sale y por qué no es un nag está en
 * `lib/avisoPrueba.ts`; aquí solo se decide QUÉ dice y a QUIÉN.
 *
 * SOLO AL PROPIETARIO, y no es una omisión: Facturación es suya (la pantalla
 * redirige a cualquier otro rol) y un miembro no puede pagar. Enseñarle una
 * cuenta atrás que no puede parar es angustia sin palanca, que es justo lo que
 * esta casa llama puerta pintada en la pared.
 */
export function AvisoPrueba() {
  const { company, role } = useAuth()
  const { campaigns, lockedInfo, loading } = useStore()
  const base = useAppBase()
  const navigate = useNavigate()
  const onboarding = useOnboarding()
  const [vistos, setVistos] = useState(leerAvisosPrueba)

  const dias = diasDePruebaRestantes(company?.trial_ends_at)
  const agotada = pruebaAgotada(company?.trial_ends_at)
  const umbral = umbralPrueba(dias, agotada)
  const abierto =
    !!company
    && base === '/app' // en la demo no se cobra nada y no hay reloj que contar
    && role === 'owner'
    && company.plan === 'trial'
    && !loading // con los datos a medias, "N candidaturas esperando" diría 0 y luego cambiaría
    && !onboarding.active // dos capas apiladas se pelean por el Escape
    && tocaAvisar(umbral, vistos[company.id])

  // Se marca al CERRARLO, no al enseñarlo: hasta que no lo ha cerrado no consta
  // que lo haya tenido delante, y una recarga a media lectura tiene que poder
  // volver a enseñarlo. Cierra igual el botón, "Ahora no", Escape y el clic
  // fuera: las cuatro salidas son la misma decisión.
  const cerrar = () => {
    if (!company || umbral === null) return
    setVistos(guardarAvisoPrueba(company.id, umbral))
  }

  const terminada = umbral === UMBRAL_AGOTADA
  const bloqueadas = Object.values(lockedInfo).reduce((n, i) => n + i.count, 0)
  // La misma cuenta que hace Facturación antes de salir a pagar: si el pago
  // cubriera más de un proceso, la prueba no lo pospone y prometerlo sería
  // mentir en el sitio donde alguien decide si se fía.
  const aCubrir = campaigns.filter(procesoAbierto).length + campaigns.filter(pendienteDePago).length
  const primerCobro = finDePrueba(company?.plan, company?.trial_ends_at, aCubrir)

  return (
    <ConfirmDialog
      open={abierto}
      onClose={cerrar}
      onConfirm={() => { cerrar(); navigate(`${base}/plan`) }}
      title={terminada
        ? 'Tu prueba ha terminado'
        : dias === 0
          ? 'Tu prueba termina hoy'
          : dias === 1 ? 'Te queda un día de prueba' : `Te quedan ${dias} días de prueba`}
      confirmLabel={terminada ? 'Activar el pago' : 'Ir a Facturación'}
      cancelLabel="Ahora no"
    >
      {terminada ? (
        <>
          <p>
            Tu puesto sigue publicado y las candidaturas siguen entrando, pero desde ahora quedan
            guardadas en espera hasta que actives el pago. No se pierde ninguna.
          </p>
          {bloqueadas > 0 && (
            <p className="mt-2 text-slate-900">
              {bloqueadas === 1
                ? 'Ya hay 1 candidatura esperando.'
                : `Ya hay ${bloqueadas} candidaturas esperando.`}
            </p>
          )}
        </>
      ) : (
        <>
          <p>
            Tu puesto sigue abierto y recibiendo candidaturas{' '}
            {dias === 0
              ? 'hasta el final del día'
              : <>hasta el {company?.trial_ends_at ? fechaCorta(company.trial_ends_at) : 'final de la prueba'}</>}
            . A partir de ahí no se pierde ninguna: las nuevas quedan guardadas en espera y las ves
            todas en cuanto actives el pago.
          </p>
          {/* La frase que convierte el aviso en algo útil: quita el motivo para
              esperar al último día. Solo si de verdad va a pasar. */}
          {primerCobro && (
            <p className="mt-2 text-slate-900">
              <strong className="font-semibold">Activarlo ahora no te quita los días que quedan:</strong>{' '}
              dejas tu método de pago y el primer cobro es el {fechaCorta(primerCobro.toISOString())}.
            </p>
          )}
        </>
      )}
    </ConfirmDialog>
  )
}
