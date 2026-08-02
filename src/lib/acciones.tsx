import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Accion } from './destinos'

/**
 * Las acciones del buscador. Un sitio es una URL y lo puede declarar un registro
 * (`destinos.ts`); una acción no: la ejecuta quien la tiene a mano. "Nuevo puesto"
 * abre un asistente cuyo estado vive en el shell, y "Exportar a Excel" necesita los
 * filtros que hay puestos AHORA en el panel.
 *
 * Por eso esto es un registro vivo: cada pantalla apunta lo que sabe hacer mientras
 * está montada, y lo retira al irse. Dos clases, sin ceremonia:
 *
 *   * **Globales**: las registra el shell (`AppLayout`). Existen siempre.
 *   * **Contextuales**: las registra la pantalla abierta y se van con ella. Su
 *     etiqueta debe decir sobre qué actúan ("Exportar a Excel · Mozo de almacén"),
 *     porque el buscador se ve desde cualquier sitio.
 *
 * Añadir una acción = una llamada a `useAccion`. El buscador no se toca.
 */

interface Registro {
  acciones: Accion[]
  registrar: (accion: Accion) => () => void
}

const AccionesContext = createContext<Registro | null>(null)

export function AccionesProvider({ children }: { children: ReactNode }) {
  const [acciones, setAcciones] = useState<Accion[]>([])

  const registrar = useCallback((accion: Accion) => {
    setAcciones((prev) => [...prev.filter((a) => a.id !== accion.id), accion])
    return () => setAcciones((prev) => prev.filter((a) => a.id !== accion.id))
  }, [])

  const value = useMemo<Registro>(() => ({ acciones, registrar }), [acciones, registrar])
  return <AccionesContext.Provider value={value}>{children}</AccionesContext.Provider>
}

/** Las acciones disponibles ahora mismo. Vacío fuera del provider (la landing, el
 *  formulario público): el buscador solo vive dentro de la app. */
export function useAcciones(): Accion[] {
  return useContext(AccionesContext)?.acciones ?? []
}

/**
 * Declara una acción mientras este componente esté montado. Pásale `null` para no
 * registrar nada (una acción que ahora mismo no aplica, por rol o por plan).
 *
 * `hacer` va por REFERENCIA a propósito: es una función nueva en cada render, y si
 * entrara en las dependencias del efecto esto se registraría y desregistraría sin
 * parar, rehaciendo la lista y con ella el `useMemo` del buscador en bucle. El mismo
 * cuidado que ya se tuvo con `loadMentions` en `avisos.ts`. Lo que sí dispara un
 * re-registro es lo que se VE (etiqueta, pista, claves): eso tiene que ir al día.
 */
/**
 * Declara una acción desde el JSX, sin pintar nada. Es la forma cómoda de usar
 * `useAccion` en una pantalla que tiene retornos tempranos (el panel, sin ir más
 * lejos, se va antes de tiempo si el puesto no existe) o cuya función a ejecutar
 * se define a mitad del componente. `activa=false` la retira: una acción que no
 * haría nada (exportar sin candidatos) no se ofrece.
 */
export function RegistrarAccion({
  activa = true,
  hacer,
  ...accion
}: Omit<Accion, 'hacer'> & { activa?: boolean; hacer: () => void }) {
  useAccion(activa ? { ...accion, hacer } : null)
  return null
}

export function useAccion(accion: Accion | null): void {
  const ctx = useContext(AccionesContext)
  const hacerRef = useRef(accion?.hacer)
  // Se sincroniza en un efecto, y ANTES que el de registro: así lo que se ejecuta
  // es siempre lo último que pasó esta pantalla, sin escribir en la ref pintando.
  useEffect(() => {
    hacerRef.current = accion?.hacer
  })

  const id = accion?.id ?? null
  const label = accion?.label ?? ''
  const hint = accion?.hint ?? ''
  const claves = (accion?.claves ?? []).join('|')
  const icon = accion?.icon

  const registrar = ctx?.registrar
  useEffect(() => {
    if (!registrar || !id || !icon) return
    return registrar({
      id,
      label,
      hint: hint || undefined,
      icon,
      claves: claves ? claves.split('|') : undefined,
      hacer: () => hacerRef.current?.(),
    })
  }, [registrar, id, label, hint, claves, icon])
}
