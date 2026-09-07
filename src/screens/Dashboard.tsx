import { memo, useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlignLeft,
  ArrowUpRight,
  Briefcase,
  Bell,
  BellOff,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Clock,
  Copy,
  Download,
  Eye,
  FileArchive,
  FileSpreadsheet,
  FileText,
  Hash,
  Inbox,
  List,
  ListFilter,
  Lock,
  Mail,
  MailCheck,
  MoreHorizontal,
  Paperclip,
  PenLine,
  Phone,
  Plus,
  Search,
  SearchX,
  Settings2,
  Timer,
  Share2,
  Sparkles,
  Star,
  MessagesSquare,
  Tag,
  Trash2,
  User,
  X,
} from 'lucide-react'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/auth'
import { useToast } from '../components/ui/Toast'
import { Checkbox } from '../components/ui/Checkbox'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { ColHead, TABLE, ROW, TEXTO_FILA, AVATAR_FILA, CELL, CELL_FLUSH, HEAD_CELL_FLUSH, HEAD_CELL_FLUSH_FIJA, FIJA, TRANSICION_FILA, useFilasALaVista, HuecoFilas } from '../components/ui/DataTable'
import { createPortal } from 'react-dom'
import { colocarFlotante, colocarLateral } from '../lib/flotante'
import { useColumnasAjustables } from '../lib/columnas'
import { useVistaTabla, type ColumnaVista, type VistaTabla } from '../lib/vistaTabla'
import { AjustesVista, type OpcionOrden } from '../components/AjustesVista'
import { KanbanPuesto } from '../components/KanbanPuesto'
import { useModoPanel } from '../lib/modoPanel'
import { useDesvanecido } from '../lib/desvanecido'
import { DUR, EASE } from '../lib/motion'
import { StatusSelect, StatusPickerSheet, MenuEstado } from '../components/ui/StatusPill'
import { BottomSheet } from '../components/ui/BottomSheet'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { SedesDialog } from '../components/SedesDialog'
import { CandidateModal } from './CandidateModal'
import { exportCandidatesToExcel, exportCandidatesToCsv, exportCandidateDocs } from '../lib/export'

/** Los tres formatos de exportación (ver la página Exportar del `···`). */
type FormatoExport = 'xlsx' | 'csv' | 'zip'
import { RegistrarAccion } from '../lib/acciones'
import { answerStr, CAMPOS_YA_PINTADOS, fechaCorta, fullDateTime, miles, formatPhone, candidateName } from '../lib/format'
import { clickDeFila, invasionDeSeleccion } from '../lib/fila'
import type { Invasion } from '../lib/fila'
// El anillo de ajuste se queda en el avatar (Mario, jul 2026) y desde ago 2026 lo
// acompaña la columna "Encaje", que dice en palabras lo que el anillo dice en arco:
// mismo par punto+texto que exige la doctrina para el estado. Con ella vuelve su
// ORDEN; lo que sigue retirado es el buscador en lenguaje natural.
import { MeridianAvatar, FitLabel } from '../components/Meridian'
import { CeldaDocumento } from '../components/ChipDocumento'
import { PreviewDocumento } from '../components/PreviewDocumento'
import { candidateFit, estaAnalizando, hasMeridian } from '../lib/meridian'
import { FAVORITO_STAR, STATUS_META, STATUS_ORDER } from '../lib/types'
import { TIPOS_ORDENABLES } from '../lib/types'
import type { Campaign, Candidate, CandidateInterestState, CandidateStatus, FormField, NumberFilter, SavedView, Site, SortKey, Tag as TagType } from '../lib/types'
import { PRECIO_PROCESO, PRUEBA_DIAS, TAGS_ENABLED } from '../lib/pricing'
import { TagCell, BulkTagMenu, ManageTagsModal, campoEtiquetaId } from '../components/Tags'
import { publicFormUrl, publicFormUrlDisplay } from '../lib/brand'
import { OnboardingTestCard } from '../components/OnboardingGuide'
import { ShareReply } from '../components/ShareReply'
import { useOnboarding } from '../lib/onboarding'
import { useAppBase } from '../lib/useAppBase'
import { useEsMovil } from '../lib/media'
import { ChipDimension, MenuAnadirFiltro, type DimensionFiltro } from '../components/FiltroChip'
import { MaskedPhone } from '../components/MaskedPhone'
import { PullToRefresh, type RefreshResult } from '../components/PullToRefresh'
import { BTN_ICONO_FRANJA, BTN_PRIMARY, BTN_PRIMARY_FRANJA, BTN_PRIMARY_SM, BTN_SECONDARY, BTN_SUPERFICIE, ICONO_CONTROL } from '../lib/buttons'
import { copyText } from '../lib/clipboard'
import { supabase } from '../lib/supabase'
import { searchScore } from '../lib/search'
import { InterestCheckDialog } from '../components/InterestCheckDialog'
import { InterestOutcomeIcon } from '../components/InterestSignal'
import { candidateInterestState, INTEREST_STATE_LABEL } from '../lib/interest'
import { IconoVacio } from '../components/ui/IconoVacio'

/** El campo del formulario detrás de una clave `campo:<id>`, si lo es. */
function campoDeClave(campaign: Campaign | undefined, key: string): FormField | undefined {
  if (!campaign || !key.startsWith('campo:')) return undefined
  return campaign.fields.find((f) => `campo:${f.id}` === key)
}

/** ¿La columna es una pregunta de Sí/No? Decide hacia dónde ordena el primer click. */
function esBooleano(campaign: Campaign | undefined, key: string): boolean {
  return campoDeClave(campaign, key)?.type === 'boolean'
}

/**
 * La respuesta de un campo ORDENABLE, como número, o `null` si no contestó.
 *
 * `null` no es cero, y la diferencia importa: quien no ha contestado se va
 * siempre al final de la lista (ver el comparador), en vez de amontonarse con
 * los que dijeron "No" o pusieron un 0.
 */
function valorOrdenable(c: Candidate, f: FormField | undefined): number | null {
  if (!f) return null
  const v = c.answers[f.id]
  if (v === undefined || v === null || v === '') return null
  if (f.type === 'boolean') return v ? 1 : 0
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function filterableFields(campaign: Campaign): FormField[] {
  return campaign.fields.filter((f) => ['select', 'multiselect', 'boolean'].includes(f.type))
}

// Preguntas numéricas, filtrables por rango (Desde / Hasta).
function numberFields(campaign: Campaign): FormField[] {
  return campaign.fields.filter((f) => f.type === 'number')
}

const SIN_FECHAS: string[] = []

export function Dashboard() {
  const { campaignId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const { getCampaign, candidatesFor, restoreCandidate, savedViews, createSavedView, deleteSavedView, sites, updateCampaign, brands, reloadCandidatesFor, markSeen, duplicateCampaign, tags, deleteCampaign, cerrarProceso, reabrirProceso, previewReabrir, lockedInfo, loadCommentsForMany, loadDocumentsFor, setStatusMany, setStatus, setFavorito, commentCounts } = useStore()
  const { company, role } = useAuth()
  const toast = useToast()
  const base = useAppBase()
  const navigate = useNavigate()
  const onboarding = useOnboarding()
  const campaign = getCampaign(campaignId!)
  // El encargado gestiona candidatos, pero NO edita el puesto (form/sede/marca):
  // esas escrituras van contra campaigns, que la RLS le bloquea.
  const isEncargado = role === 'encargado'
  const canManage = !isEncargado
  // El encargado aplica/quita etiquetas existentes pero no crea ni gestiona el
  // vocabulario (igual que en la RLS). owner/member sí.
  const canManageTags = !isEncargado

  const [loading, setLoading] = useState(true)
  // Tabla o tablero. Solo en escritorio: en móvil cinco columnas de 232px son
  // cinco pantallas, y la tabla ya resuelve el ancho desplazándose.
  const [modo, setModo] = useModoPanel()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<Set<CandidateStatus>>(new Set())
  const [valueFilters, setValueFilters] = useState<{ fieldId: string; label: string; value: string }[]>([])
  const [numberFilters, setNumberFilters] = useState<NumberFilter[]>([])
  const [favoritosOnly, setFavoritosOnly] = useState(false)
  const [tagFilter, setTagFilter] = useState<Set<string>>(new Set()) // ids de etiqueta; OR dentro del grupo
  const [interestFilter, setInterestFilter] = useState<Set<CandidateInterestState>>(new Set())
  const [manageTagsOpen, setManageTagsOpen] = useState(false)
  // Arranca con el orden de fábrica del modo con el que se entra (la preferencia
  // de tabla/tablero está guardada, así que se sabe ya en el primer render).
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>(() =>
    modo === 'tablero' ? ORDEN_INICIAL_TABLERO : ORDEN_INICIAL,
  )
  // El candidato abierto vive en la URL (?candidato=<id>), no en estado local:
  // así el aviso de una mención puede enlazar directamente a su ficha, y volver
  // atrás cierra el detalle en vez de salir del puesto.
  const openId = searchParams.get('candidato')
  // `setSearchParams` NO es estable entre renders: react-router lo recrea con
  // cada location, así que un `useCallback` que lo lleve en las dependencias
  // tampoco lo es, y `onOpen` cambiaba de identidad justo al abrir una ficha
  // (que es cuando cambia la URL). Era la única prop que seguía despertando a la
  // tabla memoizada: 563ms de las 142 filas por cada click en una persona. Va
  // por ref para que `setOpenId` tenga identidad fija de verdad.
  const setSearchParamsRef = useRef(setSearchParams)
  useEffect(() => {
    setSearchParamsRef.current = setSearchParams
  })
  const setOpenId = useCallback((id: string | null) =>
    setSearchParamsRef.current(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (id) next.set('candidato', id)
        else next.delete('candidato')
        return next
      },
      // replace: recorrer 40 candidatos con las flechas no debe dejar 40 entradas
      // en el historial del navegador.
      { replace: true },
    ), [])
  // Activos / Rechazados: NO es un filtro más, es en cuál de las dos mitades de la
  // lista estás. "Descartado" es el único estado del que se sale por decisión y no
  // por avance, así que separa la lista en dos y por eso vive en un conmutador y no
  // en el menú de filtros (donde sigue estando el resto de estados).
  //
  // EN MÓVIL NO SE PINTA (Mario, ago 2026): la franja de herramientas solo tiene
  // sitio para el buscador y Filtros, y una caja de 240px con dos cifras dentro no
  // cabe sin robarle la fila a lo que se usa todos los días. Y como no se pinta,
  // TAMPOCO FILTRA: un recorte invisible que no se puede deshacer no es un filtro,
  // es una lista mutilada. Allí la lista llega entera y descartado se recorta desde
  // Estado, igual que los otros cuatro.
  const esMovil = useEsMovil()
  const [vista, setVista] = useState<'activos' | 'rechazados'>('activos')
  // El tablero solo existe en escritorio; la preferencia guardada no se pierde
  // al pasar por un móvil, simplemente ahí no aplica.
  const tablero = modo === 'tablero' && !esMovil

  /**
   * EL CONMUTADOR SIGUE AL FILTRO DE ESTADO (Mario, ago 2026).
   *
   * El conmutador y la casilla "Descartado" hablan del MISMO hecho desde dos sitios,
   * y por eso podían contradecirse: marcabas Descartado estando en Activos y la
   * tabla se quedaba vacía a la fuerza, porque estabas pidiendo a la vez los dos
   * montones que el conmutador separa. La pantalla no estaba rota, pero te hacía
   * resolver a ti una contradicción que ella ya podía ver.
   *
   * Solo se mueve cuando el lado en el que estás no puede tener NADA, que es lo que
   * lo hace predecible: si el filtro deja los dos montones con algo que enseñar, no
   * se toca y mandas tú.
   *   · solo "descartado"  -> Rechazados (en Activos no habría ni uno)
   *   · ningún "descartado" -> Activos    (en Rechazados no habría ni uno)
   *   · mezcla             -> quieto      (los dos lados tienen algo)
   *
   * Y se dispara al TOCAR el filtro, no desde un efecto que vigile el estado: un
   * efecto correctivo te devolvería al otro lado en cuanto movieras el conmutador a
   * mano, o sea que te quitaría el control en vez de ahorrarte un paso.
   *
   * Sin guarda de móvil a propósito: allí el conmutador ni se pinta ni filtra, así
   * que moverlo no se ve; pero deja los dos de acuerdo, y si la ventana se ensancha
   * aterrizas en el lado que corresponde en vez de en una lista vacía.
   */
  /**
   * "DESCARTADO" NO SE COMBINA CON LOS OTROS CUATRO (Mario, ago 2026), y al
   * marcarlo los demás se apagan.
   *
   * Es la misma verdad que el conmutador dicha en el otro control: Activos y
   * Rechazados son dos montones DISJUNTOS, así que pedir "descartado y contratado"
   * es pedir una lista que no existe en ninguno de los dos lados. Antes se podía
   * pedir, y lo que salía era una tabla vacía sin explicación. Apagarlos dice la
   * regla ANTES de que la pises, en vez de enseñarte el resultado de haberla
   * pisado.
   *
   * EN MÓVIL NO SE BLOQUEA NADA, y no es un olvido: allí el conmutador ni se pinta
   * ni filtra, la lista llega entera y "descartado" es un estado como los otros
   * cuatro, así que mezclarlos SÍ significa algo. La exclusividad existe porque
   * existe el conmutador; donde no hay conmutador, no hay exclusividad.
   *
   * Y NUNCA se bloquea algo que ya está marcado: un checkbox marcado y
   * deshabilitado no se puede quitar. Es lo que deja salir de una combinación vieja
   * guardada en una vista o hecha desde el móvil.
   */
  const estadoBloqueado = useMemo(() => {
    if (esMovil || statusFilter.size === 0) return null
    if (statusFilter.has('descartado')) {
      return {
        bloqueadas: new Set(STATUS_ORDER.filter((v) => v !== 'descartado' && !statusFilter.has(v))),
        motivo: 'Estás viendo Rechazados. Quita "Descartado" para filtrar por los demás estados.',
      }
    }
    return {
      bloqueadas: new Set(['descartado']),
      motivo: 'Estás viendo Activos. Quita los otros estados para poder ver los descartados.',
    }
  }, [esMovil, statusFilter])

  const ajustarVista = useCallback((sel: Set<CandidateStatus>) => {
    if (sel.size === 0) return
    if (sel.size === 1 && sel.has('descartado')) setVista('rechazados')
    else if (!sel.has('descartado')) setVista('activos')
  }, [])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  // La barra de selección flota sobre el filo de abajo, y ahí ya vivían los
  // avisos. Mientras está puesta declara su alto en la raíz para que el `Toast`
  // se aparte: exportar la selección SIEMPRE saca un aviso, así que el choque no
  // era hipotético, era el caso normal. Se mide en vez de escribirse a mano
  // porque la barra envuelve en una ventana estrecha y entonces mide el doble.
  //
  // Va en un CALLBACK REF y no en un efecto, y esa es la parte que hay que
  // respetar: la barra sale con una animación de salida, así que sigue en el DOM
  // después de que la selección esté vacía. Un efecto que mirase `selected.size`
  // se ejecutaría con el nodo todavía puesto y luego NO se volvería a ejecutar al
  // desmontarse de verdad, así que la variable se quedaba clavada y los avisos
  // seguían apartándose de una barra que ya no está. El callback ref se llama con
  // `null` justo cuando el nodo se va, que es el único momento fiable.
  const observadorBarra = useRef<ResizeObserver | null>(null)
  const barraSelRef = useCallback((el: HTMLDivElement | null) => {
    const raiz = document.documentElement
    observadorBarra.current?.disconnect()
    if (!el) {
      raiz.style.removeProperty('--alto-barra-flotante')
      return
    }
    const medir = () => raiz.style.setProperty('--alto-barra-flotante', `${Math.round(el.getBoundingClientRect().height)}px`)
    medir()
    observadorBarra.current = new ResizeObserver(medir)
    observadorBarra.current.observe(el)
  }, [])
  const [interestDialogOpen, setInterestDialogOpen] = useState(false)
  const [lockedDialogOpen, setLockedDialogOpen] = useState(false) // aviso al pulsar una candidatura bloqueada
  // Aquí vivía una cabecera adaptativa: medía el título con un ResizeObserver y,
  // si no cabía, reducía "Compartir" a solo icono. Dejó de servir para nada
  // cuando los dos botones pasaron a ser cuadrados de icono en móvil: la etiqueta
  // ya se oculta siempre por debajo de `sm`. Se quitó el estado, las dos
  // mediciones y el observer, que seguían corriendo en cada render del panel.
  const [saveViewOpen, setSaveViewOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [duplicating, setDuplicating] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const [closing, setClosing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  // Reapertura de un proceso cerrado (pago por proceso): antes de reabrir se
  // enseña qué va a costar (gratis dentro del ciclo pagado, o la prorrata).
  const [confirmReopen, setConfirmReopen] = useState<null | { free: boolean; amountDue: number | null; checkout: boolean }>(null)
  const [reopening, setReopening] = useState(false)

  // Lo que le pasamos a `CandidateTable` se declara con identidad ESTABLE: esa tabla
  // está memoizada y una función nueva en cada render le rompe la comparación, o sea
  // 142 filas repintadas por cada tecla del buscador. Viven aquí arriba, y no junto a
  // los demás manejadores, porque son hooks: por debajo está el `return` temprano del
  // puesto no encontrado y ahí ya no se pueden llamar.
  const toggleSort = useCallback((key: SortKey) =>
    // Al elegir una columna nueva empieza ascendente, salvo dos casos, y los dos
    // por el mismo motivo: el primer click tiene que dar lo que se estaba
    // pidiendo. En Encaje eso es "enséñame primero a quien encaja"; en una
    // pregunta de Sí/No, los que dijeron que SÍ (que es a quien buscas cuando
    // pulsas "¿Tienes carnet?"). Los números se quedan en ascendente, que es la
    // convención neutra: en unos más es mejor y en otros peor, y adivinarlo por
    // el nombre de la pregunta sería inventarse una intención.
    setSort((s) => (s.key === key
      ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: key === 'encaje' || esBooleano(campaign, key) ? 'desc' : 'asc' })), [campaign])

  
  const openLockedDialog = useCallback(() => setLockedDialogOpen(true), [])

  // Duplicar el puesto: crea una copia (campos, apariencia y datos), sin candidatos,
  // y abre su editor. El error, si lo hay, lo avisa el store.
  const handleDuplicate = async () => {
    if (duplicating || !campaign) return
    setDuplicating(true)
    const copy = await duplicateCampaign(campaign.id)
    setDuplicating(false)
    if (copy) {
      toast.success('Puesto duplicado.')
      navigate(`${base}/puestos/${copy.id}/formulario`)
    }
  }

  // Pausar NO es cerrar: el enlace deja de aceptar candidaturas pero el proceso
  // sigue abierto (y, en el pago por proceso, cobrándose). Por eso va directo,
  // sin tocar la facturación.
  const togglePause = async () => {
    if (!campaign) return
    const next = campaign.status === 'activa' ? 'pausada' : 'activa'
    const ok = await updateCampaign(campaign.id, { status: next })
    if (ok) toast.success(next === 'pausada' ? 'Puesto pausado. Deja de aceptar candidaturas; sigue abierto.' : 'Puesto reactivado.')
  }
  // Reabrir un puesto cerrado: en el pago por proceso primero se enseña qué va
  // a costar (previewReabrir) y se confirma; en prueba y tiers antiguos abre
  // directo (el tope del plan lo aplica el servidor).
  const reopen = async () => {
    if (!campaign) return
    if (company?.plan === 'proceso') {
      setConfirmReopen(await previewReabrir(campaign.id))
      return
    }
    const ok = await reabrirProceso(campaign.id)
    if (ok) toast.success('Puesto reabierto.')
  }
  const doReopen = async () => {
    if (!campaign) return
    setReopening(true)
    const ok = await reabrirProceso(campaign.id)
    setReopening(false)
    setConfirmReopen(null)
    if (ok) toast.success('Puesto reabierto.')
  }
  // Cerrar: un clic, sin fricción. Deja de aceptar candidaturas y de cobrarse;
  // el puesto y sus candidatos se conservan enteros y exportables.
  const doClose = async () => {
    if (!campaign) return
    setClosing(true)
    const ok = await cerrarProceso(campaign.id)
    setClosing(false)
    setConfirmClose(false)
    if (ok) {
      toast.success(
        company?.plan === 'proceso'
          ? 'Puesto cerrado. Deja de cobrarse; tus candidatos siguen aquí.'
          : 'Puesto cerrado. Tus candidatos siguen aquí.',
      )
    }
  }
  // Eliminar: borrado real del puesto y sus candidaturas. Tras borrar, salimos al
  // primer puesto disponible (la ruta índice redirige).
  const doDelete = async () => {
    if (!campaign) return
    setDeleting(true)
    const ok = await deleteCampaign(campaign.id)
    setDeleting(false)
    setConfirmDelete(false)
    if (ok) {
      toast.success('Puesto eliminado.')
      navigate(base)
    }
  }

  // Skeleton breve al cambiar de puesto (muestra el estado de carga real).
  useEffect(() => {
    setLoading(true)
    setSearch('')
    // Filtro inicial por estado vía ?estado=nuevo (p. ej. al venir de la Vista
    // general pulsando un puesto con candidatos nuevos). El estado queda editable
    // como cualquier otro filtro; el chip "Estado: Nuevo" deja quitarlo.
    const estado = searchParams.get('estado')
    const initialEstado = estado && (STATUS_ORDER as readonly string[]).includes(estado)
      ? (estado as CandidateStatus)
      : null
    setStatusFilter(initialEstado ? new Set([initialEstado]) : new Set())
    setValueFilters([])
    setNumberFilters([])
    setFavoritosOnly(false)
    setTagFilter(new Set())
    setSelected(new Set())
    // Trae los candidatos nuevos de este puesto: la carga global solo ocurre al
    // entrar en el panel, así que sin esto no se verían los llegados después.
    // Y marca el puesto como visto: el badge del menú cuenta los llegados después.
    if (campaignId) {
      reloadCandidatesFor(campaignId)
      markSeen(campaignId)
    }
    const t = setTimeout(() => setLoading(false), 600)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId])

  // Pista única en móvil: como el refresco va por gesto (no hay botón), lo
  // enseñamos una sola vez para que sea descubrible. La marca se escribe DENTRO
  // del timeout (al mostrarse de verdad), no antes: así el doble montaje de
  // StrictMode no la cancela sin llegar a enseñarla.
  useEffect(() => {
    try {
      if (!window.matchMedia('(max-width: 767px)').matches) return
      if (localStorage.getItem('af.hint.pull')) return
    } catch {
      return
    }
    const t = window.setTimeout(() => {
      try {
        localStorage.setItem('af.hint.pull', '1')
      } catch {
        // sin localStorage: igualmente mostramos la pista esta vez
      }
      toast.show('Desliza hacia abajo para actualizar')
    }, 1200)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Recarga los candidatos del puesto y DEVUELVE el resultado (no avisa por su cuenta):
  // en móvil lo muestra la propia barra de "tirar para refrescar"; en escritorio el
  // botón lo enseña con un toast. El guardado evita recargas solapadas.
  const refresh = async (): Promise<RefreshResult> => {
    if (!campaignId || refreshing) return { ok: true, message: '' }
    setRefreshing(true)
    const n = await reloadCandidatesFor(campaignId)
    setRefreshing(false)
    if (n < 0) return { ok: false, message: 'No pudimos actualizar' }
    return { ok: true, message: n === 0 ? 'Estás al día' : `${n} ${n === 1 ? 'candidato nuevo' : 'candidatos nuevos'}` }
  }

  const all = useMemo(() => (campaign ? candidatesFor(campaign.id) : []), [campaign, candidatesFor])
  // Vive aquí arriba y no junto a `activeFilterCount` porque es un HOOK: por
  // debajo está el `return` temprano del puesto no encontrado. Lo cazó
  // `hooks.test.ts` al devolver el conmutador.
  const nRechazados = useMemo(() => all.filter((c) => c.status === 'descartado').length, [all])

  // AJUSTES DE LA VISTA (el engranaje de la fila de herramientas). Vive aquí
  // arriba porque son HOOKS y por debajo está el `return` temprano del puesto no
  // encontrado, que es la trampa que `hooks.test.ts` ya ha cazado tres veces.
  //
  // Las columnas DISPONIBLES no son las declaradas: Encaje solo existe si el plan
  // trae Meridian y Etiquetas solo si la empresa tiene vocabulario. Se filtran
  // aquí, así que el panel no puede ofrecer una columna que la tabla no pintaría.
  const columnasDisponibles = useMemo<ColumnaVista<ColKey>[]>(() => {
    const conMeridian = hasMeridian(company?.plan)
    const conEtiquetas = TAGS_ENABLED && tags.length > 0
    const base = COLUMNAS.filter((c) => (c.key === 'encaje' ? conMeridian : c.key === 'etiquetas' ? conEtiquetas : true))
    // Las del producto primero y las de este puesto después: son las únicas que
    // cambian de un puesto a otro, así que puestas en medio moverían de sitio a
    // las que sí están siempre.
    return [...base, ...COLUMNAS_DE(campaign)]
  }, [company?.plan, tags.length, campaign])
  const vistaTabla = useVistaTabla('puesto', columnasDisponibles)
  // LOS CAMPOS DE LA TARJETA DEL TABLERO: las mismas columnas menos las dos que
  // allí no son un campo (el candidato ES la tarjeta y el estado ES la columna).
  // Mismo registro y mismo panel; cajón de guardado propio, porque qué te
  // importa en una tabla ancha y en una tarjeta de 232px no tiene por qué
  // coincidir.
  const camposTarjeta = useMemo<ColumnaVista<string>[]>(() => {
    // Las columnas de la tabla menos las dos que en una tarjeta no son un campo
    // (el candidato ES la tarjeta y el estado ES la columna), más una que la
    // tabla no tiene: CUÁNTO LLEVA EN SU ETAPA (Mario, ago 2026). En un tablero
    // la pregunta de cada tarjeta es "¿está atascada?", y eso lo dice el tiempo
    // en la fase, no la fecha de llegada.
    const otros = columnasDisponibles.filter((c) => c.key !== 'candidato' && c.key !== 'estado')
    const todos: ColumnaVista<string>[] = [{ key: 'etapa', label: 'En esta etapa', icon: Timer }, ...otros]
    // DE FÁBRICA SE VEN TRES, Y EN ESTE ORDEN (Mario, ago 2026): cuánto lleva
    // parado, si encaja y cómo lo tenéis clasificado. Es lo que se mira para
    // decidir a quién mover, y son tres líneas: una tarjeta con seis datos deja
    // de leerse de un vistazo, que es lo único que un tablero hace mejor que la
    // tabla. El resto (teléfono, fecha, las respuestas) nace APAGADO y está a un
    // clic en el engranaje: existen para que los pidas, no para que lleguen.
    const DE_FABRICA = ['etapa', 'encaje', 'etiquetas']
    return [
      ...DE_FABRICA.flatMap((k) => todos.filter((c) => c.key === k)),
      ...todos.filter((c) => !DE_FABRICA.includes(c.key)).map((c) => ({ ...c, apagada: true })),
    ]
  }, [columnasDisponibles])
  const vistaTablero = useVistaTabla('tablero', camposTarjeta)
  // El estado que comparten TODOS los marcados, o null si hay mezcla: es lo que
  // decide si el menú de estado de la barra marca alguno. Con mezcla no se marca
  // ninguno, porque señalar uno diría que los demás también lo tienen.
  //
  // Vive aquí arriba porque es un HOOK y por debajo está el `return` temprano del
  // puesto no encontrado. Se escribió abajo, junto a `exitSelect`, que es donde
  // pedía el cuerpo, y lo cazó `hooks.test.ts` a la primera.
  const estadoComun = useMemo(() => {
    const marcados = all.filter((c) => selected.has(c.id))
    if (!marcados.length) return null
    const primero = marcados[0].status
    return marcados.every((c) => c.status === primero) ? primero : null
  }, [all, selected])
  // El orden por defecto no es un dato suelto: es lo que decide si "Restablecer"
  // se puede pulsar y si, buscando, manda la relevancia (ver `sorted`).
  const ordenDeFabrica = tablero ? ORDEN_INICIAL_TABLERO : ORDEN_INICIAL
  const ordenPorDefecto = sort.key === ordenDeFabrica.key && sort.dir === ordenDeFabrica.dir
  const ordenar = useCallback((key: string, dir: 'asc' | 'desc') => setSort({ key: key as SortKey, dir }), [])
  const restablecerOrden = useCallback(() => setSort(ordenDeFabrica), [ordenDeFabrica])
  // Marcar/desmarcar UNA tarjeta del tablero. Es la misma selección que la
  // tabla y la misma barra flotante: el tablero solo cambia el asa (la cara).
  // A qué se abre la ficha cuando se llega desde el tablero ("Añadir nota"): el
  // control donde tiene que caer el cursor. Se limpia al cerrar, o la próxima
  // ficha se abriría también en la nota.
  const [focoFicha, setFocoFicha] = useState<'nota' | 'etiqueta' | null>(null)
  const abrirEnNota = useCallback((id: string) => { setFocoFicha('nota'); setOpenId(id) }, [setOpenId])
  const abrirEnEtiqueta = useCallback((id: string) => { setFocoFicha('etiqueta'); setOpenId(id) }, [setOpenId])
  // EL CHIP "CV" DE LA COLUMNA ABRE LA FICHA EN EL DOCUMENTO (Mario, sep 2026:
  // "los documentos deben ser clickeables desde la columna").
  //
  // Y abre la FICHA, no el documento a pelo, que es lo que mantiene en pie la
  // regla vieja ("el CV no es un control"): verlo pide una URL firmada y esa
  // lógica no puede vivir en dos sitios. Lo que se gana es el clic que faltaba:
  // antes había que abrir la ficha y buscar el bloque; ahora se aterriza en él.
  const navegarFicha = useCallback((id: string) => { setFocoFicha(null); setOpenId(id) }, [setOpenId])
  // EL CHIP "CV" DE LA COLUMNA ABRE EL VISOR, Y SOLO EL VISOR (Mario, sep 2026:
  // "los documentos deben ser clickeables desde la columna", "que solo abra el
  // preview no la ficha"). Se ha pulsado un documento, así que lo que tiene que
  // aparecer es ese documento: abrir la persona entera detrás sería contestar otra
  // pregunta y dejar la ficha abierta al cerrarlo.
  //
  // No rompe la regla vieja ("el CV no es un control de la fila"): lo que aquella
  // protegía es que el camino de un documento no se escriba dos veces, y ese
  // camino vive desde hoy en `useDocumento`, que usan las dos superficies.
  const [docAbierto, setDocAbierto] = useState<string | null>(null)
  const abrirDocumento = useCallback((id: string) => setDocAbierto(id), [])
  const toggleSeleccion = useCallback((id: string) => {
    setSelected((prev) => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }, [])
  // IDs de candidatos que "acaban de llegar" (en vivo por realtime, por refresco
  // manual o por tirar para refrescar) mientras el usuario ya tenía el puesto
  // abierto: la fila hace una entrada breve en la tabla (nunca en la carga
  // inicial del puesto, eso sería un intro de página, prohibido por la doctrina).
  // Se ajusta DURANTE el render (patrón oficial de React para derivar estado a
  // partir de un cambio en las props), no en un efecto: un efecto llegaría un
  // render tarde, cuando la fila ya habría montado en su estado final y
  // `initial` ya no tendría ningún efecto (framer-motion solo lo consulta en
  // el montaje).
  const [trackedCampaignId, setTrackedCampaignId] = useState<string | null>(null)
  const [seenIds, setSeenIds] = useState<Set<string> | null>(null)
  const [justArrived, setJustArrived] = useState<Set<string>>(new Set())
  if (campaign && trackedCampaignId !== campaign.id) {
    // Puesto distinto (o primera vez): lo que ya hay ahí es "de siempre", no anima.
    setTrackedCampaignId(campaign.id)
    setSeenIds(new Set(all.map((c) => c.id)))
    if (justArrived.size > 0) setJustArrived(new Set())
  } else if (seenIds) {
    const arrivedIds = all.filter((c) => !seenIds.has(c.id)).map((c) => c.id)
    if (arrivedIds.length > 0) {
      setSeenIds(new Set(all.map((c) => c.id)))
      setJustArrived((prev) => new Set([...prev, ...arrivedIds]))
    }
  }
  // Dejan de estar "recién llegados" pasado un momento: si la fila desaparece
  // de un filtro y reaparece luego, no debe repetir la entrada.
  useEffect(() => {
    if (justArrived.size === 0) return
    const ids = [...justArrived]
    const t = window.setTimeout(() => {
      setJustArrived((prev) => {
        const next = new Set(prev)
        ids.forEach((id) => next.delete(id))
        return next
      })
    }, 900)
    return () => window.clearTimeout(t)
  }, [justArrived])

  // Una sola búsqueda a tres ritmos, porque tres cosas distintas cuestan distinto:
  //   `search` es lo que enseña el campo. Urgente: la letra tiene que aparecer en
  //     el mismo frame en que se pulsa la tecla, pase lo que pase debajo.
  //   `q` es lo que filtra la lista. Va en una TRANSICIÓN (`useDeferredValue`), así
  //     que React repinta las filas en trocitos y sin bloquear el teclado: mientras
  //     sigues escribiendo, la tabla se queda un momento con el resultado anterior
  //     en vez de comerse el hilo, y si tecleas otra vez abandona y vuelve a empezar.
  //     Con 142 candidatos, repintar la tabla son ~200ms; a eso no se le puede pedir
  //     el turno del dedo.
  //   `dq` es lo que se le pide al servidor. Debounce, para no lanzar un RPC por tecla.
  // No son el mismo mecanismo dos veces: el debounce ahorra RED (esperar a que pares
  // de escribir), la transición ahorra PINTURA (no bloquear mientras escribes). Uno
  // solo no basta: sin la transición, el repintado bloquea igual cuando llega `dq`.
  const q = useDeferredValue(search.trim())
  const [dq, setDq] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDq(search.trim()), 250)
    return () => clearTimeout(t)
  }, [search])

  // Real: RPC nativo de Postgres (tolerante + rankeado). Demo / fallback: búsqueda JS.
  // rpcIds = IDs rankeados del servidor; null = sin búsqueda, RPC pendiente o fallido.
  const [rpcIds, setRpcIds] = useState<string[] | null>(null)
  useEffect(() => {
    if (base === '/demo' || !campaign || !dq) {
      setRpcIds(null)
      return
    }
    let alive = true
    supabase.rpc('search_candidates', { p_campaign_id: campaign.id, p_query: dq }).then(({ data, error }) => {
      if (!alive) return
      setRpcIds(error || !data ? null : (data as { id: string }[]).map((r) => r.id))
    })
    return () => {
      alive = false
    }
  }, [dq, campaign?.id, base])

  const filtered = useMemo(() => {
    if (!campaign) return []
    // Búsqueda tolerante: base = IDs rankeados (RPC en real; JS en demo o como fallback
    // instantáneo mientras llega/si falla el RPC). Sin query, todos los candidatos.
    let relevance: Map<string, number> | null = null
    let base0 = all
    if (q) {
      const ids =
        base !== '/demo' && rpcIds !== null
          ? rpcIds
          : all
              .map((c) => [c, searchScore(c, q)] as const)
              .filter(([, s]) => s > 0)
              .sort((a, b) => b[1] - a[1])
              .map(([c]) => c.id)
      relevance = new Map(ids.map((id, i) => [id, i]))
      base0 = all.filter((c) => relevance!.has(c.id))
    }

    let list = base0.filter((c) => {
      // La mitad de la lista en la que estás, antes que cualquier filtro. Solo
      // donde el conmutador se ve: ver el comentario de `vista`. En TABLERO no
      // corta ni el conmutador ni el filtro de estado: las columnas SON los
      // estados, y un recorte por estado encima de columnas por estado es la
      // misma pregunta contestada dos veces.
      if (!tablero) {
        if (!esMovil && (c.status === 'descartado') !== (vista === 'rechazados')) return false
        if (statusFilter.size && !statusFilter.has(c.status)) return false
      }
      if (interestFilter.size && !interestFilter.has(candidateInterestState(campaign, c))) return false
      if (favoritosOnly && !c.favorito) return false
      // Etiquetas: OR dentro del grupo (basta tener UNA de las seleccionadas), AND
      // con el resto de grupos (consistente con el comportamiento actual).
      if (tagFilter.size && !c.tagIds.some((id) => tagFilter.has(id))) return false
      // valueFilters agrupados por campo: OR dentro del campo, AND entre campos
      const byField = new Map<string, string[]>()
      for (const vf of valueFilters) {
        byField.set(vf.fieldId, [...(byField.get(vf.fieldId) ?? []), vf.value])
      }
      for (const [fid, vals] of byField) {
        const cv = c.answers[fid]
        const match = vals.some((val) => {
          if (typeof cv === 'boolean') return (cv ? 'Sí' : 'No') === val
          if (Array.isArray(cv)) return cv.includes(val)
          return cv === val
        })
        if (!match) return false
      }
      // Filtros numéricos por rango: sin valor numérico -> no pasa.
      for (const nf of numberFilters) {
        const raw = c.answers[nf.fieldId]
        const n = typeof raw === 'string' || typeof raw === 'number' ? Number(raw) : NaN
        if (Number.isNaN(n)) return false
        if (nf.min != null && n < nf.min) return false
        if (nf.max != null && n > nf.max) return false
      }
      return true
    })

    // Orden: por relevancia cuando hay búsqueda y el orden está en su valor por defecto
    // (fecha desc); si el usuario elige una columna, manda su orden.
    if (relevance && sort.key === 'fecha' && sort.dir === 'desc') {
      list = [...list].sort((a, b) => relevance!.get(a.id)! - relevance!.get(b.id)!)
    } else {
      list = [...list].sort((a, b) => {
        let cmp = 0
        if (sort.key === 'nombre') cmp = candidateName(a).localeCompare(candidateName(b))
        else if (sort.key === 'estado') cmp = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)
        // DÍAS en la etapa, no fecha de entrada en ella: más días es una fecha
        // más ANTIGUA, así que la comparación va del revés. Escrito como días
        // para que `asc`/`desc` signifiquen lo que dice el panel ("de menos a
        // más días") y no lo contrario.
        else if (sort.key === 'etapa') cmp = b.statusChangedAt.localeCompare(a.statusChangedAt)
        else if (sort.key === 'encaje') {
          const fa = candidateFit(a.ai)
          const fb = candidateFit(b.ai)
          // Sin analizar va SIEMPRE al final, se ordene como se ordene: "no lo sé"
          // no es "el peor encaje", y colarlo arriba al invertir sería mentir.
          if (fa == null || fb == null) return fa == null ? (fb == null ? 0 : 1) : -1
          cmp = fa - fb
        }
        else if (sort.key.startsWith('campo:')) {
          // Una respuesta de Sí/No o de número (ver `TIPOS_ORDENABLES`). Las dos
          // se comparan como número, que es lo que las hace ordenables: un Sí es
          // un 1 y un No un 0.
          const f = campoDeClave(campaign, sort.key)
          const va = valorOrdenable(a, f)
          const vb = valorOrdenable(b, f)
          // MISMA REGLA QUE EL ENCAJE: quien no ha contestado va SIEMPRE al final,
          // se ordene como se ordene. "No lo dijo" no es "un cero", y colarlo
          // arriba al invertir el orden sería inventarle una respuesta.
          if (va == null || vb == null) return va == null ? (vb == null ? 0 : 1) : -1
          cmp = va - vb
        }
        else cmp = a.submittedAt.localeCompare(b.submittedAt)
        return sort.dir === 'asc' ? cmp : -cmp
      })
    }
    return list
  }, [all, campaign, q, rpcIds, base, esMovil, tablero, vista, statusFilter, interestFilter, valueFilters, numberFilters, favoritosOnly, tagFilter, sort])

  // Dominio real (mín/máx) de cada pregunta numérica, para acotar sus sliders.
  const numberDomains = useMemo(() => {
    const m: Record<string, [number, number]> = {}
    if (!campaign) return m
    for (const f of numberFields(campaign)) {
      const vals = all.map((c) => Number(c.answers[f.id])).filter((n) => !Number.isNaN(n))
      if (vals.length) {
        const lo = Math.min(...vals)
        const hi = Math.max(...vals)
        if (hi > lo) m[f.id] = [lo, hi]
      }
    }
    return m
  }, [all, campaign])

  // Candidatos BLOQUEADOS (cupo del plan gratuito superado): se siguen recibiendo,
  // pero el comerciante no los ve hasta subir de plan. Mostramos un aviso + filas
  // difuminadas para que sepa cuántos esperan. Solo en trial (los de pago no
  // bloquean). Las filas difuminadas, solo en la vista sin filtrar.
  const lockedFor = campaign && company?.plan === 'trial' ? lockedInfo[campaign.id] : undefined
  const lockedCount = lockedFor?.count ?? 0
  // Sin bloqueadas, SIN_FECHAS (constante del módulo) en vez de un `[]` recién
  // hecho: es una prop de la tabla memoizada y un array nuevo por render la
  // repintaría entera.
  const lockedDates = lockedFor?.dates ?? SIN_FECHAS
  const isFiltered =
    !!q || statusFilter.size > 0 || interestFilter.size > 0 || favoritosOnly || tagFilter.size > 0 || valueFilters.length > 0 || numberFilters.length > 0
  // Los bloqueados (difuminados) salen ARRIBA, como las candidaturas nuevas (son
  // las más recientes), solo en la vista por defecto (más nuevos primero y sin
  // filtros): con otro orden no tendría sentido cronológico, así que ahí no se
  // pintan (el aviso de upsell sí sigue saliendo, va por el recuento aparte).
  const showLockedRows = !isFiltered && sort.key === 'fecha' && sort.dir === 'desc'

  // Estos tres hooks viven POR ENCIMA del `return` temprano de "puesto no
  // encontrado", igual que los `useCallback` de la tabla y por el mismo motivo: un
  // componente montado tiene que llamar siempre los mismos hooks y en el mismo
  // orden. Lo cazó `hooks.test.ts` cuando los puse debajo.
  // Qué dimensiones se pueden filtrar en ESTE puesto. Es un registro, no una
  // pantalla: la barra no conoce ningún filtro, pinta lo que haya aquí. Añadir una
  // dimensión (un campo nuevo, un criterio nuevo) es una entrada más, nunca UI.
  // Las preguntas del puesto entran igual que Estado o Etiquetas, y por eso ya no
  // hace falta un panel aparte para "la cola larga".
  const dimensiones = useMemo<DimensionFiltro[]>(() => {
    if (!campaign) return []
    const d: DimensionFiltro[] = [
      {
        id: 'estado',
        label: 'Estado',
        icon: CircleDot,
        n: statusFilter.size,
        limpiar: () => setStatusFilter(new Set()),
        seleccionadas: statusFilter as Set<string>,
        // El nuevo conjunto se calcula FUERA del updater: dentro sería un efecto
        // colateral en una función que React puede llamar dos veces.
        onToggle: (v) => {
          const s2 = v as CandidateStatus
          const n = new Set(statusFilter)
          n.has(s2) ? n.delete(s2) : n.add(s2)
          setStatusFilter(n)
          ajustarVista(n)
        },
        bloqueadas: estadoBloqueado?.bloqueadas,
        motivoBloqueo: estadoBloqueado?.motivo,
        opciones: STATUS_ORDER.map((v) => ({
          valor: v,
          label: STATUS_META[v].label,
          leading: <span className={`size-2 shrink-0 rounded-full ${STATUS_META[v].dot}`} aria-hidden />,
        })),
      },
      {
        id: 'favoritos',
        label: 'Favoritos',
        icon: Star,
        n: favoritosOnly ? 1 : 0,
        limpiar: () => setFavoritosOnly(false),
        seleccionadas: new Set(favoritosOnly ? ['si'] : []),
        onToggle: () => setFavoritosOnly((v) => !v),
        opciones: [{
          valor: 'si',
          label: 'Solo favoritos',
          leading: <Star className={`size-4 shrink-0 ${FAVORITO_STAR}`} aria-hidden />,
        }],
      },
      {
        id: 'interes',
        label: 'Interés',
        icon: MailCheck,
        n: interestFilter.size,
        limpiar: () => setInterestFilter(new Set()),
        seleccionadas: interestFilter as Set<string>,
        onToggle: (v) => setInterestFilter((p) => {
          const n = new Set(p); const s2 = v as CandidateInterestState
          n.has(s2) ? n.delete(s2) : n.add(s2); return n
        }),
        opciones: (['interested', 'not_interested', 'sent', 'no_response', 'never', 'unavailable'] as CandidateInterestState[])
          .map((v) => ({ valor: v, label: INTEREST_STATE_LABEL[v] })),
      },
    ]
    if (TAGS_ENABLED && tags.length > 0) {
      d.push({
        id: 'etiquetas',
        label: 'Etiquetas',
        icon: Tag,
        n: tagFilter.size,
        limpiar: () => setTagFilter(new Set()),
        seleccionadas: tagFilter,
        onToggle: (v) => setTagFilter((p) => { const n = new Set(p); n.has(v) ? n.delete(v) : n.add(v); return n }),
        opciones: tags.map((t) => ({ valor: t.id, label: t.name })),
      })
    }
    // Las preguntas de ESTE puesto: cada una es una dimensión más, igual que
    // Estado. Es lo que permitió retirar el panel aparte de "la cola larga".
    for (const f of filterableFields(campaign)) {
      const opciones = f.type === 'boolean' ? ['Sí', 'No'] : f.options ?? []
      d.push({
        id: `campo-${f.id}`,
        label: f.label,
        icon: ListFilter,
        grupo: 'preguntas',
        n: valueFilters.filter((v) => v.fieldId === f.id).length,
        limpiar: () => setValueFilters((p) => p.filter((v) => v.fieldId !== f.id)),
        seleccionadas: new Set(valueFilters.filter((v) => v.fieldId === f.id).map((v) => v.value)),
        onToggle: (opt) => setValueFilters((p) => p.some((v) => v.fieldId === f.id && v.value === opt)
          ? p.filter((v) => !(v.fieldId === f.id && v.value === opt))
          : [...p, { fieldId: f.id, label: f.label, value: opt }]),
        opciones: opciones.map((opt) => ({ valor: opt, label: opt })),
      })
    }
    for (const f of numberFields(campaign)) {
      const dom = numberDomains[f.id]
      if (!dom) continue // sin rango útil (sin datos o todos iguales): no hay slider
      const [lo, hi] = dom
      const nf = numberFilters.find((x) => x.fieldId === f.id)
      const from = nf?.min ?? lo
      const to = nf?.max ?? hi
      d.push({
        id: `num-${f.id}`,
        label: f.label,
        icon: ListFilter,
        grupo: 'preguntas',
        n: nf ? 1 : 0,
        limpiar: () => setNumberFilters((p) => p.filter((x) => x.fieldId !== f.id)),
        // No es una lista, es un rango: usa la escotilla del panel a medida.
        panel: (
          <div className="px-2 py-2">
            <div className="mb-2 flex items-baseline justify-between">
              <span className="text-[12px] text-slate-500">Rango</span>
              <span className="num text-[12px] font-medium text-slate-700">{from} – {to}</span>
            </div>
            <RangeSlider
              min={lo}
              max={hi}
              from={from}
              to={to}
              onChange={(nFrom, nTo) => setNumberFilters((p) => {
                const resto = p.filter((x) => x.fieldId !== f.id)
                // Rango completo = sin filtro: no se guarda una restricción que no
                // restringe (dejaría el chip contando 1 sin quitar a nadie).
                if (nFrom <= lo && nTo >= hi) return resto
                return [...resto, { fieldId: f.id, label: f.label, min: nFrom, max: nTo }]
              })}
            />
          </div>
        ),
      })
    }
    // En TABLERO el estado no es un filtro: es la maquetación (las columnas).
    // Ofrecerlo sería la misma pregunta dos veces, y como ahí tampoco se aplica
    // (ver `filtered`), sería además un chip que no filtra, que está prohibido.
    return tablero ? d.filter((dim) => dim.id !== 'estado') : d
  }, [campaign, tablero, statusFilter, favoritosOnly, interestFilter, tags, tagFilter, valueFilters, numberFilters, numberDomains, ajustarVista, estadoBloqueado])

  // UN CHIP EXISTE SI FILTRA. No hay un estado paralelo de "categorías añadidas":
  // lo hubo, y dejaba el chip vivo después de desmarcar su último valor, o sea una
  // cápsula que dice "Estado" sin filtrar por ningún estado. Derivarlo de `n > 0`
  // hace además que una vista guardada enseñe sus filtros sola, sin que nadie
  // tenga que acordarse de sincronizar la otra lista.
  const dimensionesVisibles = useMemo(() => dimensiones.filter((d) => d.n > 0), [dimensiones])

  // EL DESVANECIDO DE LA TIRA DE CHIPS (Mario, sep 2026). La fila de filtros es
  // UNA SOLA LÍNEA que se desplaza (envolviendo cambiaría de alto al filtrar y
  // recolocaría la tabla justo cuando miras el resultado), y una zona que
  // scrollea dentro de otra que también scrollea no tiene forma de anunciarse:
  // la barra del navegador o se esconde o mide un píxel, y en táctil no existe.
  // Sin nada, un sexto filtro sencillamente no existe para quien mira.
  //
  // Es el mecanismo de la casa (`lib/desvanecido.ts`), el mismo que la tira de
  // pastillas de la ficha y la lista de horas del selector: recorta con una
  // máscara SOLO el lado por el que de verdad continúa, así que llegar al final
  // lo apaga, que es justo lo que dice "hasta aquí".
  //
  // La señal de remedida son los chips que hay Y su cuenta: un chip cambia de
  // ancho al pasar de "(1)" a "(12)", y un `ResizeObserver` sobre el contenedor
  // no se entera de que sus hijos son otros.
  const chipsRef = useRef<HTMLDivElement>(null)
  const mascaraChips = useDesvanecido(chipsRef, 'x', {
    senal: dimensionesVisibles.map((d) => `${d.id}:${d.n}`).join(),
  })

  if (!campaign) {
    return (
      <div className="grid h-full place-items-center px-6 py-16">
        <div className="w-full max-w-md text-center">
          <IconoVacio Icon={Briefcase} />
          <h1 className="mt-4 text-xl font-semibold text-slate-900">Puesto no encontrado</h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Puede que se haya cerrado o que el enlace ya no sea válido.
          </p>
          <Link to={base} className={`${BTN_PRIMARY} mt-6`}>
            Ir a mis puestos
          </Link>
        </div>
      </div>
    )
  }

  const activeFilterCount = (tablero ? 0 : statusFilter.size) + interestFilter.size + valueFilters.length + numberFilters.length + (favoritosOnly ? 1 : 0) + tagFilter.size
  // Los dos inquilinos de la línea de contexto. Se nombran porque de ellos depende
  // que esa fila separe o no separe: vacía no debe ocupar nada.
  // Buscar también estrecha la lista: si solo se mirasen los filtros, escribir un
  // nombre dejaba la pantalla sin decir cuántos han quedado, ni en voz alta.
  const hayContexto = loading || activeFilterCount > 0 || q.length > 0
  // Aquí vivía `cols` (highlightFields): las dos respuestas del formulario que la
  // tabla pintaba como columnas. Fuera desde ago 2026 (Mario): cambiaban de puesto en
  // puesto, se comían el ancho de lo que sí es común a todos (encaje, etiquetas,
  // teléfono) y llegaban con la cabecera cortada. Las respuestas siguen enteras donde
  // valen: la ficha, los filtros y el Excel.
  const showFit = hasMeridian(company?.plan)
  const openCandidate = openId ? all.find((c) => c.id === openId) ?? null : null
  const selectedCandidates = all.filter((candidate) => selected.has(candidate.id))
  // Primer tramo del enlace: marca del puesto si la tiene, si no el nombre de la empresa.
  const brandLabel = (campaign.brandId ? brands.find((b) => b.id === campaign.brandId)?.name : null) ?? company?.name
  const publicUrl = publicFormUrlDisplay(campaign.slug, brandLabel)
  const maskPhone = base === '/demo'

  // Vistas guardadas: las globales valen en todos los puestos; las de puesto, solo aquí.
  const myViews = savedViews.filter((v) => v.campaignId === null || v.campaignId === campaign.id)
  const hasValueFilters = valueFilters.length > 0
  const canSaveView = activeFilterCount > 0 || search.trim().length > 0

  const applyView = (v: SavedView) => {
    setSearch(v.payload.search ?? '')
    // Una vista guardada trae sus estados, así que necesita el mismo ajuste: sin él,
    // recuperar una vista de descartados la abriría vacía.
    const estados = new Set(v.payload.statuses ?? [])
    setStatusFilter(estados)
    ajustarVista(estados)
    setInterestFilter(new Set(v.payload.interestStates ?? []))
    setValueFilters(v.payload.valueFilters ?? [])
    setNumberFilters(v.payload.numberFilters ?? [])
    setFavoritosOnly(v.payload.favoritosOnly ?? false)
    setTagFilter(new Set(v.payload.tagFilter ?? []))
    setSort(v.payload.sort ?? { key: 'fecha', dir: 'desc' })
  }

  const saveView = async (name: string, scope: 'global' | 'campaign') => {
    const ok = await createSavedView({
      name,
      campaignId: scope === 'global' ? null : campaign.id,
      payload: { search, statuses: [...statusFilter], interestStates: [...interestFilter], valueFilters, numberFilters, favoritosOnly, tagFilter: [...tagFilter], sort },
    })
    setSaveViewOpen(false)
    if (ok) toast.success('Vista guardada')
  }

  const clearFilters = () => {
    setStatusFilter(new Set())
    setInterestFilter(new Set())
    setValueFilters([])
    setNumberFilters([])
    setFavoritosOnly(false)
    setTagFilter(new Set())
    setSearch('')
  }

  /**
   * Exporta lo que hay filtrado, en el formato que se elija.
   *
   * Los tres salen del MISMO sitio y comparten las guardas: la de las bloqueadas
   * y la de los comentarios. Con una función por formato, la próxima regla que se
   * añada aquí se olvidaría en dos de las tres.
   */
  const doExport = async (formato: FormatoExport = 'xlsx') => {
    if (formato === 'zip') {
      try {
        const r = await exportCandidateDocs(campaign, filtered, loadDocumentsFor)
        if (!r.incluidos) return toast.show('Ninguna de estas candidaturas trae documentos.')
        // Lo que no se pudo bajar SE DICE. Un zip con 138 de 140 es útil; uno que
        // finge estar completo, no.
        toast.success(r.fallidos
          ? `${miles(r.incluidos)} documentos en ${r.filename}. ${miles(r.fallidos)} no se pudieron descargar.`
          : `${miles(r.incluidos)} documentos listos, ${r.filename}`)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'No se pudieron exportar los documentos.')
      }
      return
    }
    // Las candidaturas bloqueadas (plan gratuito, sobre el tope) también salen en
    // el Excel, como filas señuelo sin datos personales: exportar no puede ser un
    // atajo para leer lo bloqueado. Solo en la vista completa (sin filtro): con un
    // filtro no sabemos si encajarían, así que no se mezclan (igual que en el panel).
    let lockedDates: string[] = []
    if (lockedCount > 0 && !isFiltered) {
      const { data } = await supabase.rpc('locked_candidates_export', { p_campaign: campaign.id })
      if (Array.isArray(data)) lockedDates = data as string[]
    }
    const comentarios = await loadCommentsForMany(filtered.map((c) => c.id))
    const name = formato === 'csv'
      ? exportCandidatesToCsv(campaign, filtered, tags, lockedDates, comentarios)
      : await exportCandidatesToExcel(campaign, filtered, tags, lockedDates, comentarios)
    toast.success(`Listo, ${name}`)
  }

  // Deshacer la selección. Ya no hay un "modo" del que salir: con la casilla en su
  // columna a todos los anchos, seleccionar es marcar y deseleccionar es vaciar.
  const exitSelect = () => setSelected(new Set())
  // Aquí vivía `toggleSelectAll`, el "Todos / Ninguno" de la barra de móvil. Se
  // fue con ella: la casilla de la cabecera hace exactamente eso y está a todos
  // los anchos desde ago 2026, así que era un segundo control para lo mismo, y de
  // los que se quedan porque nadie vuelve a mirarlos.
  // Exporta solo la selección. La usan las DOS barras: era la misma función escrita
  // dos veces, y la copia de escritorio ya se había separado (exportaba sin vaciar).
  //
  // Y NO vacía la selección al terminar, que es lo que hacía esta: era un resto del
  // "modo selección" del móvil, del que se salía al actuar, y ese modo se retiró en
  // ago 2026. Exportar no es acabar con esa gente; puedes querer etiquetarlos justo
  // después, y para soltarlos está la equis. De regalo quita un salto: vaciando, la
  // barra desaparecía en mitad del aviso que ella misma acababa de sacar, y el aviso
  // se caía 66px al suelo.
  const exportSelected = async () => {
    const subset = all.filter((c) => selected.has(c.id))
    if (subset.length === 0) return
    const name = await exportCandidatesToExcel(campaign, subset, tags, [], await loadCommentsForMany(subset.map((c) => c.id)))
    toast.success(`Excel listo con ${subset.length} ${subset.length === 1 ? 'candidato' : 'candidatos'}, ${name}`)
  }

  const copyLink = async () => {
    if (base === '/demo') {
      // Demo: el puesto no existe en la BD real, así que el enlace no recibiría
      // candidaturas. Lo decimos claro en vez de copiar un enlace muerto.
      toast.show('En la demo el enlace es de muestra. Crea tu cuenta para tener un enlace que reciba candidaturas de verdad.')
      return
    }
    const ok = await copyText(publicFormUrl(campaign.slug, brandLabel))
    if (ok) toast.success('Enlace copiado')
    else toast.show('Copia el enlace manualmente: ' + publicUrl)
  }

  return (
    <PullToRefresh onRefresh={refresh}>
    {/* `max-sm:pt-4`: en móvil el título arranca a 28px del filo y no a 36. Encima
          hay ya una barra con la marca, así que ese hueco no está separando el
          título de nada: solo empuja la primera candidatura fuera de la pantalla.
          En escritorio se queda como estaba, donde el aire de arriba es lo único
          que separa el título del borde.
          Lo llevan las NUEVE pantallas del shell (Mario, ago 2026): el reparto de
          aire es de la app, no de una pantalla, y con solo el panel corregido se
          notaba el escalón al navegar. */}
      <div className="mx-auto max-w-trabajo px-4 py-6 max-sm:pt-4 sm:px-6 lg:px-8">
      {/* Acción del buscador mientras este puesto esté abierto: exporta lo que ves,
          con los filtros puestos. Lleva el nombre del puesto porque el buscador se
          usa desde cualquier sitio y "Exportar a Excel" a secas no diría de qué. */}
      <RegistrarAccion
        activa={filtered.length > 0}
        id="exportar-excel"
        label={`Exportar a Excel · ${campaign.title}`}
        hint={
          isFiltered
            ? `Las ${filtered.length} candidaturas que tienes filtradas ahora.`
            : `Las ${filtered.length} candidaturas de este puesto.`
        }
        icon={Download}
        claves={['excel', 'xlsx', 'exportar', 'descargar', 'hoja de calculo']}
        hacer={() => void doExport()}
      />
      {/* CABECERA DEL PUESTO · maquetación de Figma (Mario, ago 2026).
          Cuatro franjas: identidad + acciones, contexto, pestañas y herramientas.
          El título va a 20px y NO a los 24 de `PageHeader`: aquí la fila de arriba
          lleva ya cinco cosas y el peso hace la jerarquía. Por eso esta pantalla no
          usa `PageHeader`; es la única con pestañas y conmutador propios. */}
      <header className="mb-0">
        {/* EL HUECO SE MIDE HASTA LA TINTA, NO HASTA LA CAJA DE LÍNEA (Mario, ago
            2026, segunda pasada sobre esta misma franja). Con `pb-3` la cuenta salía
            redonda (12 de aquí + los 16 del `py-4` de la fila = los mismos 28 que hay
            por debajo), y aun así se leía con más aire arriba. El motivo es que los
            dos huecos NO están limitados por la misma clase de borde: abajo hay una
            CAJA (el filo de la tarjeta o el de la columna), que empieza justo donde
            dice su rectángulo; arriba hay TEXTO, y la caja de línea de un 14/20 se
            acaba unos píxeles por debajo de donde se acaba la letra (medido con las
            métricas reales de la fuente: la tinta muere en 88 y la caja en 90). Así
            que 28 de caja a caja son 30 de blanco arriba contra 28 abajo.
            Con `pb-2` el blanco queda en 26 contra 28: nunca más arriba que abajo,
            que es el lado seguro del error. REGLA GENERAL: cuando un hueco lo cierra
            un texto por un lado y una caja por el otro, se descuenta la interlínea
            que sobra por debajo de la última línea. */}
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 pb-2 pt-3">
          <div className="min-w-0">
            {/* 12px y no 8 entre el nombre y su estado: la cápsula encogió a 24px y
                pegada al título se leía como parte de la palabra. Cuanto más
                pequeño el accesorio, más aire necesita para leerse como una cosa
                aparte. */}
            <div className="flex min-w-0 items-center gap-3">
              {/* 28px (Mario, sep 2026). Sube CON sus acciones: con los botones en
                  40 y el título en 24, el nombre de la pantalla pesaba menos que
                  los controles que tiene al lado, que es exactamente la jerarquía
                  invertida que esta cabecera ya corrigió una vez contra las cifras
                  de las tarjetas. Y sube en `PageHeader` a la vez, porque son la
                  misma cabecera: si se moviera solo aquí, el título cambiaría de
                  tamaño al ir del panel a Candidatos. */}
              <h1 className="min-w-0 truncate text-[28px] font-bold leading-tight tracking-[-0.012em] text-slate-900">{campaign.title}</h1>
              <EstadoPuesto
                status={campaign.status}
                canManage={canManage}
                cobraPorProceso={company?.plan === 'proceso'}
                onPauseResume={() => void togglePause()}
                onClosePuesto={() => setConfirmClose(true)}
                onReopen={() => void reopen()}
              />
            </div>
            {/* Contexto: dónde es y de qué tamaño es. El total del puesto vive aquí,
                no en una línea propia debajo de los filtros, y no cambia al filtrar:
                es el tamaño del puesto, no el del resultado. */}
            <p className="mt-1 text-sm font-medium text-slate-500">
              {[[campaign.sector, campaign.location].map((t) => t?.trim()).filter(Boolean).join(', ')]
                .filter(Boolean)
                .concat(`${miles(all.length)} ${all.length === 1 ? 'candidatura' : 'candidaturas'}`)
                .join(' · ')}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2.5">
            {/* AQUÍ NO SE DICE CUÁNDO NI QUIÉN (Mario, sep 2026). Vivían aquí un
                "Actualizado hace X" (la última candidatura) y, pegada a él, TU
                cara. Juntos se leían como una sola frase, "actualizado hace tres
                horas por Marta", y esa frase es falsa: la cara era la de quien
                mira, no la de quien tocó nada, y lo que se fechaba no era una
                edición del puesto sino que hubiera entrado alguien. Eso último ya
                lo cuenta la lista, que es lo que hay justo debajo, con su fecha
                por fila. La cabecera se queda en lo que el puesto ES y en lo que
                se puede hacer con él. */}
            <ShareMenu
              campaignId={campaign.id}
              title={campaign.title}
              url={publicFormUrl(campaign.slug, brandLabel)}
              urlDisplay={publicUrl}
              template={campaign.shareReply}
              canEdit={canManage}
              demo={base === '/demo'}
            />
            {/* "Editar" era un botón aquí Y el primer ítem del menú (Mario, ago
                2026): la doctrina decía que el menú es el inventario y los botones
                los atajos, y por eso repetirse estaba bien. Se retira el atajo y se
                queda el inventario. La cabecera baja a dos controles, que es lo que
                de verdad se usa a diario: compartir el enlace y todo lo demás. */}
            {/* El inventario completo de lo que puede hacerse con este puesto. */}
            <PuestoMenu
              campaign={campaign}
              sites={sites}
              canManage={canManage}
              editHref={`${base}/puestos/${campaign.id}/formulario`}
              publicUrl={publicFormUrl(campaign.slug, brandLabel)}
              exportCount={filtered.length}
              exportTotal={all.length}
              onExport={doExport}
              conDocumentos={filtered.filter((c) => c.cvPath).length}
              onSetSite={(siteId) => updateCampaign(campaign.id, { siteId })}
              onToggleNotify={() => updateCampaign(campaign.id, { notifyNew: campaign.notifyNew === false })}
              onDuplicate={handleDuplicate}
              duplicating={duplicating}
              onDelete={() => setConfirmDelete(true)}
            />
          </div>
        </div>

        {/* Aquí vivieron unas pestañas Solicitudes / Tienda / Publicaciones, del
            diseño de Figma, y debajo un filo que cerraba la banda de identidad. Las
            dos cosas se retiraron (Mario, ago 2026): detrás de dos de las tres
            pestañas no hay producto, y el filo dejó de hacer falta porque quien
            separa la identidad de las herramientas es el HUECO. Una raya solo vale
            si separa algo que el hueco no separa. */}
      </header>

      <div>
        {/* FILTROS POR CATEGORÍAS (referencia de Mario, ago 2026). "Filtros" no
            abre un panel con todo dentro: AÑADE una dimensión, y cada dimensión
            añadida es un chip que dice cuántos valores tiene puestos. El espacio
            que ahorra el buscador plegado se lo lleva esta fila, que es donde de
            verdad se trabaja. Refrescar salió de aquí: no actúa sobre la vista sino
            sobre los datos, o sea que es un verbo, y los verbos viven en el `···`. */}
        {/* DOS COLUMNAS, no una fila que envuelve. Con un solo `flex-wrap`, en
            cuanto los chips llenaban la línea el grupo de la derecha (buscar, la
            mitad de la lista, Vistas) caía debajo y se montaba con ellos. Ahora los
            chips crecen hacia abajo DENTRO de su columna y la derecha no se mueve
            nunca: son dos ejes distintos y no pueden pisarse.
            `items-start` para que la derecha se quede arriba cuando los chips
            ocupan varias líneas, y no centrada respecto a un bloque que crece.
            Por debajo de `sm` se apilan A PROPÓSITO (no cabe la derecha al lado),
            que es distinto de apilarse por accidente. */}
        <div className="flex flex-wrap items-start gap-2 py-4 sm:flex-nowrap">
          {/* 1 · BUSCAR, EL PRIMERO DE LA FILA A TODOS LOS ANCHOS (diseño de
              Mario, sep 2026). Estaba el tercero, contra el filo derecho; ahora
              abre la franja, que es el orden en que se trabaja: primero buscas a
              alguien y lo que quede lo recortas con los filtros. Se sigue plegando
              en escritorio, pero hacia la DERECHA: la lupa es lo que se queda
              quieto (ver `BuscadorPuesto`). En móvil se lleva todo el ancho que
              sobra hasta Filtros; en escritorio mide lo suyo y el sobrante se lo
              quedan los chips. */}
          <div className="order-1 flex min-w-0 flex-1 sm:flex-none">
            <BuscadorPuesto value={search} onChange={setSearch} />
          </div>

          {/* 2 · FILTROS, detrás del buscador y pegado a sus chips: el control y su
              lectura son la misma cosa. En móvil es solo el icono. */}
          <div className="order-2 shrink-0">
            <MenuAnadirFiltro
              dimensiones={dimensiones}
              hayFiltros={activeFilterCount > 0}
              vistas={myViews}
              onAplicarVista={applyView}
              onBorrarVista={deleteSavedView}
              onGuardarVista={() => setSaveViewOpen(true)}
              puedeGuardar={canSaveView}
              onLimpiarTodo={clearFilters}
            />
          </div>

          {/* 4 · EN QUÉ MITAD DE LA LISTA ESTÁS. Solo en escritorio: en móvil no
              cabe en la fila y, si no se ve, tampoco filtra (ver `vista`). */}
          {/* AJUSTES DE LA VISTA, el último de la fila: primero se decide QUÉ
              lista miras (filtros, buscador, mitad) y al final cómo se te
              presenta. Y desde sep 2026 CÓMO SE TE PRESENTA ES TODO SUYO: tabla o
              tablero era un conmutador suelto a su derecha y se ha mudado dentro,
              al principio del panel (Mario). Dos controles contiguos gobernando la
              presentación eran dos puertas para lo mismo, y el de fuera se llevaba
              80px de la fila para una decisión que se toma de tarde en tarde.
              Solo en escritorio, como el asa de ajustar anchos: en móvil los
              anchos están medidos al píxel y el orden de las columnas es otro a
              propósito, así que ahí no hay nada que elegir. */}
          {!esMovil && (
            <div className="order-4 flex shrink-0 items-center gap-2">
              {/* En TABLERO no se pintan ni el conmutador de mitades ni el
                  engranaje: el primero recorta por estado, que allí es la
                  maquetación, y el segundo gobierna columnas y orden de la
                  TABLA. No se apagan, no aplican; la regla de la casa es que un
                  control que no puede hacer nada no se enseña. */}
              {!tablero && (
                <SwitchVista
                  vista={vista}
                  onChange={setVista}
                  nActivos={all.length - nRechazados}
                  nRechazados={nRechazados}
                />
              )}
              {/* El MISMO engranaje en los dos modos; lo que gobierna cambia con
                  el modo (Mario, ago 2026). En tablero, la lista son los CAMPOS
                  DE LA TARJETA y el orden pierde "Estado", que allí es la
                  maquetación; el orden que queda es el de las tarjetas DENTRO de
                  su columna. */}
              <AjustesVista
                modo={modo}
                onModo={(m) => {
                  // EL ORDEN SIGUE AL MODO, PERO SOLO SI NO LO HABÍAS TOCADO: una
                  // intención declarada gana a una inferida (la misma regla que
                  // hace que el conmutador de mitades solo se mueva cuando el lado
                  // en el que estás no puede tener nada). Si estabas en el orden de
                  // fábrica, pasas al de fábrica del otro modo; si habías elegido
                  // uno, se respeta.
                  const antes = m === 'tablero' ? ORDEN_INICIAL : ORDEN_INICIAL_TABLERO
                  if (sort.key === antes.key && sort.dir === antes.dir) {
                    setSort(m === 'tablero' ? ORDEN_INICIAL_TABLERO : ORDEN_INICIAL)
                  }
                  setModo(m)
                }}
                ordenes={tablero ? ordenesDe(campaign, showFit).filter((o) => o.key !== 'estado') : ordenesDe(campaign, showFit)}
                sort={sort}
                onOrdenar={ordenar}
                ordenPorDefecto={ordenPorDefecto}
                onRestablecerOrden={restablecerOrden}
                vista={(tablero ? vistaTablero : vistaTabla) as VistaTabla<string>}
                rotuloLista={tablero ? 'Qué se ve en la tarjeta' : undefined}
                buscando={q.length > 0}
              />
            </div>
          )}

          {/* 3 · LOS CHIPS DE LO QUE ESTÁ FILTRANDO, pegados a su botón: el control
              y su lectura son la misma cosa. Vacío sigue montado en escritorio
              porque es el que CRECE y separa el buscador de lo que vive contra el
              filo derecho; en móvil, donde no empuja nada, se esconde para no
              dejar una fila vacía con su hueco.

              UNA SOLA LÍNEA QUE SE DESPLAZA, no una pila (Mario, ago 2026). Al
              envolver, cada chip nuevo empujaba hacia abajo la tabla entera y la
              franja de herramientas cambiaba de alto según cuántos filtros
              tuvieras puestos: la pantalla se recolocaba sola al filtrar, que es
              justo cuando estás mirando el resultado. Es el mismo tratamiento que
              ya tiene la columna de Etiquetas, y por el mismo motivo. Sin barra a
              la vista, y `overscroll-x-contain` para que llegar al final no
              arrastre la página.

              Ojo: `overflow-x` obliga al navegador a recortar TAMBIÉN en vertical,
              así que el desplegable de un chip ya no puede ser `absolute` dentro.
              Va en un portal con posición fija (ver `ChipDimension`). */}
          <div
            ref={chipsRef}
            style={mascaraChips ? { maskImage: mascaraChips, WebkitMaskImage: mascaraChips } : undefined}
            className={`order-3 flex min-w-0 flex-nowrap items-center gap-2 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-1 sm:basis-auto ${
              dimensionesVisibles.length > 0 ? 'basis-full' : 'hidden sm:flex'
            }`}
          >
            {dimensionesVisibles.map((d) => (
              <ChipDimension key={d.id} dim={d} />
            ))}
          </div>
        </div>

        {/* El recuento NO SE VE, ni siquiera filtrando (Mario, ago 2026): con la
            franja de chips puesta, cada filtro dice ya su nombre y cuánto lleva, y
            el tamaño del puesto está en el título. Una tercera cifra en gris entre
            las herramientas y la tabla era la misma información contada peor.

            Pero **no se borra: cambia de canal**, que es lo que esta doctrina hace
            siempre con los contadores. Sigue siendo `role="status"` y sigue SIEMPRE
            montado (una región viva que se monta y se desmonta deja de anunciar):
            en `sr-only` es lo único que le dice a quien no ve la lista cuántos han
            quedado al mover un filtro. Y `sr-only` lo saca del flujo, así que la
            fila vacía no ocupa nada y solo separa cuando de verdad la habita el
            botón de móvil. */}
        {/* Aquí había además un "Seleccionar" que encendía el modo selección del
            móvil. Se fue con él: la casilla de cada fila está ahora a todos los
            anchos, así que era un botón para poder empezar a hacer algo que ya se
            puede hacer. Queda solo el recuento en voz alta. */}
        <p className="sr-only" role="status">
          {loading ? (
            'Cargando candidatos'
          ) : hayContexto ? (
            `${miles(filtered.length)} ${filtered.length === 1 ? 'candidato' : 'candidatos'}`
          ) : null}
        </p>

        {/* Aviso de candidaturas bloqueadas (prueba agotada por cupo o por días):
            se siguen recibiendo, pero solo se ven hasta el tope. Invita a añadir
            el método de pago, sin urgencia falsa. */}
        {lockedCount > 0 && !loading && (
          <div className="mt-3 flex flex-col gap-3 rounded-xl filo bg-white px-4 py-3.5 shadow-card sm:flex-row sm:items-center">
            <Lock className="size-5 shrink-0 text-slate-700" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">
                {lockedCount === 1 ? 'Tienes 1 candidatura esperando' : `Tienes ${lockedCount} candidaturas esperando`}
              </p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-slate-500">
                {/* Sin cupo de candidaturas, caducar es el ÚNICO motivo por el que
                    algo puede entrar bloqueado, así que ya no hay dos mensajes. */}
                {`Tu prueba de ${PRUEBA_DIAS} días terminó, pero las seguimos recibiendo. Añade tu método de pago y las ves todas al momento.`}
              </p>
            </div>
            <button onClick={() => navigate(`${base}/plan`)} className={`${BTN_PRIMARY} shrink-0 max-sm:w-full max-sm:justify-center`}>
              Añadir método de pago
            </button>
          </div>
        )}

        {/* Tabla / estados */}
        {/* En escritorio va `overflow-clip`, ni `visible` ni `hidden`, y las tres
            palabras importan (ago 2026). Con `visible`, la banda de la cabecera (una
            caja CUADRADA que arranca 1px dentro de la tarjeta) se metía en el arco de
            las esquinas y pintaba su `bg-slate-50/60` ENCIMA del filo: el borde de la
            esquina se veía de otro color, y no era cosa del antialias. Medido con
            `elementsFromPoint` sobre el arco a 45 grados: lo que hay ahí arriba del
            todo es el fondo del `<th>`, no el borde de la tarjeta. Con `hidden` se
            arregla el color y se rompe la cabecera pegajosa, porque convierte la
            tarjeta en contenedor de scroll y el sticky pasa a pegarse a ELLA en vez de
            al scroll de verdad; por eso estaba en `visible`. `clip` recorta con el
            mismo radio y NO crea contenedor de scroll, así que arregla lo uno sin
            romper lo otro. Y nada de dentro necesita salirse: el menú de estado va en
            un portal con posición fija (por eso mismo) y el CTA de las bloqueadas vive
            dentro del envoltorio. Corolario: una tarjeta con radio no puede dejar que
            su contenido llegue al filo sin recortar; el borde es de 1px y cualquier
            fondo hijo se lo come justo en la curva. */}
        {/* `overflow-clip` a todos los anchos: recorta con el mismo radio (o el fondo
            cuadrado de la cabecera se comería el filo en las esquinas) y, a
            diferencia de `hidden`, NO crea contenedor de scroll, que es lo que le
            robaría el `sticky` a la cabecera de la tabla. Era `hidden` en móvil
            porque allí no había tabla dentro; ahora la hay. */}
        {tablero && !loading && filtered.length > 0 ? (
          // El tablero NO va dentro de la tarjeta blanca de la tabla: sus
          // tarjetas son las superficies, y una tarjeta de tarjetas es una caja
          // dentro de otra caja. Vive directamente sobre el fondo de trabajo.
          <KanbanPuesto
            rows={filtered}
            campos={vistaTablero.lista.filter((c) => vistaTablero.visible(c.key))}
            campaign={campaign}
            tags={tags}
            comentarios={commentCounts}
            maskPhone={maskPhone}
            setFavorito={setFavorito}
            seleccion={selected}
            onSeleccion={toggleSeleccion}
            onOpen={setOpenId}
            onOpenEnNota={abrirEnNota}
            onOpenEnEtiqueta={abrirEnEtiqueta}
            onVerDocumento={abrirDocumento}
            setStatus={setStatus}
          />
        ) : (
        <div className="mt-3 overflow-clip rounded-xl filo bg-white">
          {loading ? (
            <SkeletonRows showFit={showFit} />
          ) : filtered.length === 0 ? (
            all.length === 0 ? (
              // Durante la guía de primer uso, el paso 4 ("pruébalo tú mismo") vive
              // aquí: en el hueco exacto donde aparecerá la candidatura de prueba.
              onboarding.active && onboarding.phase === 'probar' && onboarding.campaign?.id === campaign.id ? (
                <OnboardingTestCard campaign={campaign} shareUrl={publicFormUrl(campaign.slug, brandLabel)} onCopy={copyLink} />
              ) : (
                <EmptyFirstUse publicUrl={publicUrl} onCopy={copyLink} />
              )
            ) : (
              // El texto cita `q`, no lo que hay tecleado: describe la lista que se
              // está enseñando, que es la de la última búsqueda ya aplicada.
              <EmptyNoResults search={q} hasFilters={statusFilter.size + valueFilters.length + numberFilters.length > 0} onClear={clearFilters} />
            )
          ) : (
            <CandidateTable
              campaign={campaign}
              showFit={showFit}
              canManageTags={canManageTags}
              columnas={vistaTabla.visibles}
              rows={filtered}
              justArrived={justArrived}
              lockedDates={showLockedRows ? lockedDates : SIN_FECHAS}
              onLockedClick={openLockedDialog}
              tags={tags}
              sort={sort}
              onSort={toggleSort}
              selected={selected}
              setSelected={setSelected}
              onOpen={setOpenId}
              onOpenDocumento={abrirDocumento}
              maskPhone={maskPhone}
            />
          )}
        </div>
        )}

        {/* Hueco para que la barra inferior fija no tape la última fila (móvil) */}
        {selected.size > 0 && <div className="h-20 sm:hidden" aria-hidden />}
      </div>

      <ConfirmDialog
        open={lockedDialogOpen}
        onClose={() => setLockedDialogOpen(false)}
        onConfirm={() => { setLockedDialogOpen(false); navigate(`${base}/plan`) }}
        title="Activa el pago para verla"
        confirmLabel="Añadir método de pago"
        cancelLabel="Ahora no"
      >
        <p className="text-sm leading-relaxed text-slate-600">
          Esta candidatura entró con tu{' '}
          <strong className="font-semibold text-slate-900">prueba ya agotada</strong>. La guardamos por ti: al añadir tu método de pago la ves al momento, con todas las que sigan llegando.
        </p>
      </ConfirmDialog>

      <CandidateModal
        campaign={campaign}
        candidate={openCandidate}
        maskPhone={maskPhone}
        focoInicial={
          !openId || !focoFicha ? undefined : focoFicha === 'nota' ? `chat-${openId}` : campoEtiquetaId(openId)
        }
        onClose={() => { setFocoFicha(null); setOpenId(null) }}
        onOpenManageTags={canManageTags ? () => setManageTagsOpen(true) : undefined}
        onDeleted={(c) =>
          toast.success('Candidato eliminado', { action: { label: 'Deshacer', onClick: () => restoreCandidate(c) } })
        }
        // Las flechas recorren lo que se está viendo, no toda la base: si has
        // filtrado por "entrevista", "siguiente" es el siguiente de esa lista.
        siblings={filtered}
        // Al pasar al siguiente se OLVIDA a qué se vino: el chip de un CV abre el
        // visor de ESA persona, y dejando el foco puesto la ficha del siguiente se
        // abriría con su documento encima sin que nadie lo haya pedido.
        onNavigate={navegarFicha}
      />

      {/* EL DOCUMENTO A PANTALLA COMPLETA, sin ficha detrás. Cuelga de la pantalla
          y no de la tabla porque la tabla está memoizada: un estado suyo aquí
          arriba no la despierta, y así el visor no re-renderiza 142 filas. */}
      {docAbierto && (() => {
        const c = all.find((x) => x.id === docAbierto)
        return c?.cvPath ? (
          <PreviewDocumento campaign={campaign} candidate={c} onClose={() => setDocAbierto(null)} />
        ) : null
      })()}

      <InterestCheckDialog
        open={interestDialogOpen}
        campaign={campaign}
        candidates={selectedCandidates}
        base={base}
        demo={base === '/demo'}
        onClose={() => setInterestDialogOpen(false)}
        onSent={() => toast.success(base === '/demo' ? 'Simulación completada.' : 'Comprobación enviada.')}
      />

      {TAGS_ENABLED && canManageTags && (
        <ManageTagsModal open={manageTagsOpen} onClose={() => setManageTagsOpen(false)} />
      )}

      <SaveViewDialog
        open={saveViewOpen}
        onClose={() => setSaveViewOpen(false)}
        onSave={saveView}
        hasValueFilters={hasValueFilters}
        valueFilterLabels={[...new Set(valueFilters.map((v) => v.label))]}
        campaignTitle={campaign.title}
      />


      <ConfirmDialog
        open={confirmClose}
        onClose={() => setConfirmClose(false)}
        title="Cerrar puesto"
        confirmLabel="Cerrar puesto"
        loading={closing}
        onConfirm={doClose}
      >
        {company?.plan === 'proceso'
          ? 'El formulario dejará de aceptar candidaturas y este proceso deja de cobrarse (el mes ya empezado no se devuelve). Conservas todos los candidatos, puedes exportarlos y reabrirlo cuando quieras.'
          : 'El formulario dejará de aceptar candidaturas. Conservas todos los candidatos, puedes exportarlos y reabrirlo cuando quieras.'}
        {/* Qué pasa con los datos de esa gente a partir de aquí. Los candidatos
            aceptaron que se traten "para este proceso"; guardarlos después es
            una decisión de la empresa, y hay que decírselo donde la toma. */}
        <span className="mt-2 block text-slate-500">
          {company?.retencion_meses != null
            ? `Sus candidaturas se borrarán solas a los ${company.retencion_meses} meses, salvo las contratadas.`
            : <>Sus candidaturas se conservan hasta que las elimines. Los candidatos aceptaron que se traten para este proceso: si no vas a volver a contactarlos, bórralas, o activa el borrado automático en <Link to="/app/ajustes/datos?ajuste=retencion_meses" className="font-medium text-indigo-600 underline underline-offset-2 hover:text-indigo-700">Ajustes</Link>.</>}
        </span>
      </ConfirmDialog>

      {/* Reabrir (pago por proceso): se enseña el importe ANTES de cobrar. */}
      <ConfirmDialog
        open={confirmReopen !== null}
        onClose={() => setConfirmReopen(null)}
        title="Reabrir puesto"
        confirmLabel={confirmReopen?.checkout ? 'Ir al pago seguro' : 'Reabrir puesto'}
        loading={reopening}
        onConfirm={doReopen}
      >
        {confirmReopen?.free ? (
          <p>
            El ciclo de este proceso ya está pagado
            {campaign.paidUntil ? ` hasta el ${new Date(campaign.paidUntil).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}` : ''}:
            reabrirlo ahora no te cobra nada. Después sigue a {PRECIO_PROCESO} € al mes (IVA aparte) mientras esté abierto.
          </p>
        ) : confirmReopen?.checkout ? (
          <p>
            Reabrir este proceso son {PRECIO_PROCESO} € al mes (IVA aparte). Te llevamos al pago seguro de Stripe
            (tarjeta o domiciliación) y el puesto se reabre al completarlo.
          </p>
        ) : (
          <p>
            {typeof confirmReopen?.amountDue === 'number' ? (
              <>Se te cobrará ahora <strong className="font-semibold text-slate-900">{(confirmReopen.amountDue / 100).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</strong>, la parte proporcional hasta tu próxima factura. Después, {PRECIO_PROCESO} € al mes (IVA aparte) mientras esté abierto.</>
            ) : (
              <>Reabrir este proceso son {PRECIO_PROCESO} € al mes (IVA aparte), que se añaden a tu factura.</>
            )}
          </p>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Eliminar puesto"
        confirmLabel="Eliminar"
        confirmVariant="danger"
        loading={deleting}
        onConfirm={doDelete}
      >
        Se eliminará «{campaign.title}»{all.length > 0 ? ` y sus ${all.length} ${all.length === 1 ? 'candidatura' : 'candidaturas'}` : ''}. Esta acción no se puede deshacer.
      </ConfirmDialog>

      {/* LA BARRA DE SELECCIÓN FLOTA ABAJO (Mario, ago 2026; referencia suya de una
          barra flotante). Estaba EN EL FLUJO, entre la cabecera y la tabla, así que
          marcar la primera casilla empujaba la lista entera 60px hacia abajo: la
          fila que acababas de marcar se movía justo al marcarla, y al desmarcar la
          última volvía a saltar. Y al bajar por una lista de 142 se quedaba arriba,
          fuera de la pantalla, o sea que las acciones de la selección solo existían
          mientras no la estuvieras usando.

          Flotando no mueve nada y está siempre donde el ratón acaba de soltar la
          casilla. Lo que se paga: tapa la última fila de la tabla, que se resuelve
          desplazando; es lo mismo que hace su gemela de móvil desde siempre.

          NO es la pastilla blanca de la referencia con las esquinas redondas del
          todo: es una capa flotante, y nuestro vocabulario para eso ya está escrito
          (blanco, `filo`, `shadow-pop` y radio 10, igual que un aviso o un
          desplegable). Del ejemplo se coge la IDEA (flotar abajo, compacta, con los
          grupos separados por una divisoria), no el radio, que aquí lo manda el rol.

          Y al salir del fondo de acento, sus botones dejan de estar dibujados a mano
          (`bg-white/15 px-3 py-1`) y pasan a ser los del sistema: uno de acción y el
          resto de línea. */}
      <AnimatePresence>
        {selected.size > 0 && !loading && (
          <motion.div
            key="barra-seleccion"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: DUR.enter, ease: EASE.out }}
            ref={barraSelRef}
            // `pointer-events-none` en la banda y `auto` en la barra: si no, una
            // tira invisible de lado a lado se comería los clicks de la tabla que
            // hay debajo. Y `lg:left-64` porque a partir de ahí está el lateral:
            // centrada contra la ventana, quedaría descentrada contra la lista.
            className="pointer-events-none fixed inset-x-0 bottom-0 z-40 hidden justify-center px-4 pb-4 sm:flex lg:left-64"
          >
            {/* UN SOLO OBJETO SEGMENTADO (Mario, ago 2026, con una referencia de
                la competencia: "usemos este organizador"). Eran botones sueltos
                con hueco entre ellos dentro de una caja negra, o sea cinco cosas
                flotando; ahora es UNA pieza partida en tramos por filos de 1px, y
                cada tramo ocupa el alto entero. Lo que cambia no es el adorno: un
                grupo de botones separados invita a leerlos uno a uno, y una barra
                segmentada se lee de un vistazo como "esto es lo que puedes hacer
                con lo que has marcado".

                EL RECUENTO ABRE Y LA EQUIS VA PEGADA A ÉL, no al otro extremo: la
                equis no es una acción sobre los candidatos, es deshacer la
                SELECCIÓN, así que su sitio es junto a lo que dice cuántos hay. Al
                final de la fila se leía como una cuarta acción más.

                DEL COLOR DE LA MARCA, y solo en escritorio (Mario, ago 2026).
                Blanca era otra tarjeta blanca sobre una tabla blanca: se apoyaba
                entera en la sombra y competía con las filas de debajo. Pasó por
                tinta y acabó en ultramarine, que es lo que dice lo que esta barra
                ES: **hay algo seleccionado**, y seleccionar es uno de los cuatro
                usos del acento, junto con la acción, el foco y la navegación. La
                fila marcada ya se tiñe de lo mismo, así que la barra y lo que
                gobierna hablan el mismo idioma.

                Lo que hay que respetar a cambio: **dentro de una superficie de
                acento, ningún control puede usar el acento para decir "principal"**
                (aquí ya no lo hace ninguno, y por otro motivo: no hay una
                principal entre las tres).

                Por eso también se va el `filo`: un hairline claro alrededor de una
                caja saturada es un contorno, no un canto; esa regla es para
                superficie clara sobre fondo claro, y aquí el borde ES el salto de
                color.

                `overflow-clip` porque los tramos son cajas cuadradas que llegan al
                filo: en la curva de la esquina se comerían el radio, igual que la
                cabecera de la tabla. */}
            <div className="pointer-events-auto flex h-11 items-stretch overflow-clip rounded-xl bg-indigo-600 shadow-pop">
              {/* LA CIFRA, SIN CHAPA (Mario, ago 2026). Llegó a llevar un disco de
                  acento, copiado del conmutador Activos/Rechazados. Allí la chapa
                  se gana el sitio porque hay DOS cifras que comparar; aquí hay una
                  sola y no compite con nada, así que el círculo solo añadía un
                  objeto más a una barra que se acababa de hacer para quitarlos.
                  `num` porque la cifra cambia en su sitio al marcar y desmarcar. */}
              <span className="num flex items-center whitespace-nowrap px-3.5 text-[13px] font-medium text-white">
                {selected.size} {selected.size === 1 ? 'seleccionado' : 'seleccionados'}
              </span>
              <Filo />
              <button type="button" onClick={exitSelect} aria-label="Quitar selección" title="Quitar selección" className={`${SEGMENTO} px-3`}>
                <X className="size-4" aria-hidden />
              </button>
              <Filo />
              {/* NINGUNA DE ACENTO: las tres son hermanas, tres cosas que le puedes
                  hacer a una selección, y cuál quieres depende de por qué has
                  marcado. "Comprobar" lo llevaba por herencia de la barra índigo, y
                  encima es la única que SALE de la empresa (le escribe a gente, y a
                  todas a la vez): el acento apuntaba el ojo justo a lo irreversible.

                  Etiquetas primero, que es lo que más se hace desde aquí. */}
              {TAGS_ENABLED && (
                <>
                  {/* `flotante`, y es OBLIGATORIO desde que la barra es una pieza
                      segmentada: su `overflow-clip` (el que impide que los tramos
                      cuadrados se coman la esquina redonda) recorta también lo que
                      cuelgue de dentro, así que el desplegable no se veía. Contra
                      la ventana no hay nada que lo recorte, y de paso `colocarFlotante`
                      decide solo que tiene que abrirse hacia arriba, porque pegado
                      al filo de abajo no cabe de otra forma. */}
                  <BulkTagMenu selectedIds={[...selected]} canManage={canManageTags} flotante triggerClass={SEGMENTO} />
                  <Filo />
                </>
              )}
              {/* ESTADO EN LA BARRA (Mario, ago 2026). Es la segunda cosa que se
                  hace con un puñado de gente marcada, después de etiquetarla, y
                  hasta ahora había que ir fila por fila con el selector de cada
                  una. La lista es LA MISMA que la de una fila (`MenuEstado`), no
                  una copia: mismo vocabulario, mismos cinco nombres pelados.

                  `valor` es el estado solo si TODOS comparten uno; con la
                  selección mezclada va `null` y no se marca ninguno, porque
                  señalar uno diría que los demás también lo tienen. */}
              <MenuEstado
                valor={estadoComun}
                onChange={(st) => setStatusMany([...selected], st)}
                triggerClass={SEGMENTO}
              >
                <CircleDot className="size-4" aria-hidden />
                Estado
              </MenuEstado>
              <Filo />
              {/* EL RESTO, DENTRO DEL `···` (Mario, ago 2026, con la referencia de
                  la competencia delante). La barra visible se queda con lo que se
                  hace a diario (etiquetar y mover de estado) y lo demás baja un
                  nivel: "Comprobar" le escribe a gente y "Exportar" saca los datos,
                  o sea que ni son diarias ni son inocentes. Lo que se gana es
                  ancho, y una barra corta se lee de un vistazo. */}
              <MenuMas
                onInteres={() => setInterestDialogOpen(true)}
                onExportar={exportSelected}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* LA MISMA BARRA, ADAPTADA AL MÓVIL (Mario, ago 2026). Antes era otra
          cosa: una hoja blanca de lado a lado, pegada al filo, con una rejilla de
          botones y un "Todos" que ya no hacía falta (la casilla de la cabecera
          está a todos los anchos desde ago 2026). Ahora es la MISMA pieza que en
          escritorio (ultramarine, segmentada, flotando con su margen) partida en
          dos renglones, porque las cinco cosas no caben en 375px.

          Arriba, de quién habla: el recuento y la equis, que es deshacer la
          SELECCIÓN y por eso va pegada a él. Abajo, qué puedes hacer: los mismos
          tres tramos que arriba, con el mismo reparto (lo diario a la vista,
          Comprobar y Exportar dentro del `···`). Repartidos a partes iguales,
          porque a esta anchura el ancho de cada uno lo decide el dedo, no el
          largo de su palabra. */}
      {selected.size > 0 && !loading && (
        <div
          className="fixed inset-x-3 bottom-0 z-40 sm:hidden"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
        >
          <div className="overflow-clip rounded-xl bg-indigo-600 shadow-pop">
            <div className="flex h-11 items-stretch">
              <span className="num flex items-center whitespace-nowrap px-3.5 text-[13px] font-medium text-white">
                {selected.size} {selected.size === 1 ? 'seleccionado' : 'seleccionados'}
              </span>
              <button
                type="button"
                onClick={exitSelect}
                aria-label="Quitar selección"
                className={`${SEGMENTO} ml-auto border-l border-white/22 px-4`}
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
            {/* El filo separa los dos renglones igual que separa dos tramos: es la
                misma pieza, y la línea es lo que dice dónde acaba una idea. */}
            <div className="flex h-11 items-stretch border-t border-white/22">
              {TAGS_ENABLED && (
                <BulkTagMenu
                  selectedIds={[...selected]}
                  canManage={canManageTags}
                  flotante
                  triggerClass={`${SEGMENTO_ANCHO} border-r border-white/22`}
                />
              )}
              <MenuEstado
                valor={estadoComun}
                onChange={(st) => setStatusMany([...selected], st)}
                triggerClass={`${SEGMENTO_ANCHO} border-r border-white/22`}
              >
                <CircleDot className="size-4" aria-hidden />
                Estado
              </MenuEstado>
              <MenuMas onInteres={() => setInterestDialogOpen(true)} onExportar={exportSelected} className={SEGMENTO} />
            </div>
          </div>
        </div>
      )}
    </div>
    </PullToRefresh>
  )
}

// --- Resumen de estados (tarjetas-filtro) ----------------------------------
// --- Tabla -----------------------------------------------------------------
/**
 * Señales de la fila: si está en favoritos y si hay conversación. Sin esto, el
 * filtro "Solo favoritos" ordenaba por algo que no se veía en ninguna parte, y
 * había que abrir candidato a candidato para saber dónde había hablado alguien.
 */
/**
 * Las señales de una fila: favorito y mensajes del equipo.
 *
 * `soloTexto` es lo que se pinta EN MÓVIL (Mario, ago 2026): allí la columna del
 * candidato mide 164px y estos dos glifos se llevaban 40 de los 110 que le quedan
 * al nombre, o sea que una estrella dejaba a "Florin Santos" en "Florin Sa...".
 * En una pantalla de 375 el nombre es lo único que no se puede truncar sin perder
 * de quién es la fila, así que las señales se van; están enteras en la ficha, que
 * es a un toque.
 *
 * **No desaparecen: cambian de canal**, como los contadores del lateral. En ese
 * modo se devuelve un fragmento con las lecturas `sr-only` y NINGÚN envoltorio: un
 * `sr-only` está fuera del flujo, así que suelto no ocupa nada, mientras que
 * envuelto en un `<span>` el hueco de 6px de su fila seguiría ahí, pintando aire
 * detrás del nombre.
 */
function RowSignals({ favorito, comments, soloTexto = false }: { favorito: boolean; comments: number; soloTexto?: boolean }) {
  if (!favorito && !comments) return null
  if (soloTexto) {
    return (
      <>
        {favorito && <span className="sr-only">En favoritos.</span>}
        {comments > 0 && (
          <span className="sr-only">
            {comments} {comments === 1 ? 'mensaje del equipo' : 'mensajes del equipo'}
          </span>
        )}
      </>
    )
  }
  return (
    <span className="flex shrink-0 items-center gap-1.5">
      {favorito && (
        <>
          <Star className={`size-3.5 ${FAVORITO_STAR}`} aria-hidden />
          <span className="sr-only">En favoritos.</span>
        </>
      )}
      {comments > 0 && (
        <span className="flex items-center gap-0.5 text-slate-500">
          <MessagesSquare className="size-3.5 text-slate-400" aria-hidden />
          <span className="num">{comments}</span>
          <span className="sr-only">{comments === 1 ? 'mensaje del equipo' : 'mensajes del equipo'}</span>
        </span>
      )}
    </span>
  )
}

/**
 * Celda "Encaje": lo que Meridian ve en esta candidatura, EN PALABRAS. La nota cruda
 * (0-100) no se pinta nunca en la lista: poner un número al lado de una persona la
 * convierte en un ranking. El matiz lo da el anillo del avatar, en la celda de al
 * lado. Sin analizar no se rellena con nada: una raya, como el teléfono que falta.
 */
function FitCell({ candidate }: { candidate: Candidate }) {
  const fit = candidateFit(candidate.ai)
  if (fit == null) {
    // MIENTRAS SE ANALIZA SE DICE, en vez de la misma raya que "no se ha
    // analizado nunca" (sep 2026): el triaje tarda decenas de segundos y hasta
    // ahora esa espera se leía como que nadie iba a mirar esa candidatura.
    // Cuando termina, el ping del análisis recarga el puesto y aparece su encaje.
    //
    // CON EL BARRIDO DE LA CASA (`shimmer-text`, Mario sep 2026), el mismo que
    // el hilo usa cuando Meridian piensa: en una columna de datos quietos, el
    // movimiento es lo que separa "esperando" de "no hay". Y por eso el texto no
    // lleva puntos suspensivos: el barrido ya dice lo que decía la elipsis.
    // `prefers-reduced-motion` lo deja plano en el gris de la pieza, que es el
    // caso en el que la palabra tiene que bastar sola.
    if (estaAnalizando(candidate)) {
      return <span className="shimmer-text block truncate">Analizando</span>
    }
    return (
      <span className="block truncate text-slate-600">
        <span aria-hidden>–</span>
        <span className="sr-only">Sin analizar</span>
      </span>
    )
  }
  return (
    <span className="block truncate" title={`Ajuste ${Math.round(fit)} sobre 100`}>
      <FitLabel fit={fit} enFila />
    </span>
  )
}

/** Las columnas que puede llevar una fila. El ORDEN se declara aparte, porque
    cambia con el ancho de la ventana (ver `orden` en la tabla). */
/**
 * Las columnas del PRODUCTO más una por cada respuesta del formulario, con el
 * prefijo `campo:`. Las segundas nacen apagadas: ver `COLUMNAS_DE`.
 */
type ColKey = 'candidato' | 'estado' | 'encaje' | 'documentos' | 'etiquetas' | 'telefono' | 'recibida' | `campo:${string}`

/**
 * EL ORDEN SE DICE EN LAS PALABRAS DE SU COLUMNA.
 *
 * Un "de más antiguo a más nuevo" genérico obliga a traducirlo a lo que estás
 * mirando; escrito en las palabras del campo se lee sin traducir, y escrito EN
 * PARALELO (mismas palabras, del revés) la diferencia entre las dos opciones se
 * ve sin leerlas enteras. Es lo mismo que hace el menú de estado del puesto.
 *
 * TODOS SIGUEN LA MISMA CONSTRUCCIÓN, "De X a Y", y cada par es el espejo exacto
 * del otro (Mario, ago 2026: el lenguaje era demasiado informal). Se probó con
 * frases sueltas por columna ("Primero los que sí", "Del final al principio") y
 * se retiró: además de sonar de andar por casa, rompían el paralelismo, que es
 * justo lo que deja comparar las dos opciones sin leerlas enteras.
 *
 * Los textos tienen que decir lo que el código hace de verdad, así que salen de
 * mirarlo: `nombre` compara con `localeCompare`, `estado` recorre `STATUS_ORDER`
 * (que ES el orden del proceso), `encaje` compara la nota y `fecha` la marca de
 * tiempo. Si cambia una comparación, cambia su frase.
 */
const ORDENES_BASE: OpcionOrden[] = [
  { key: 'nombre', label: 'Candidato', asc: 'De la A a la Z', desc: 'De la Z a la A' },
  { key: 'encaje', label: 'Encaje', asc: 'De menor a mayor encaje', desc: 'De mayor a menor encaje' },
  // No se nombran los estados de los extremos a propósito: "descartado" es el
  // último del array pero en Activos no hay ni uno, así que "de nuevo a
  // descartado" sería mentira justo en la mitad de la lista donde más se usa.
  { key: 'estado', label: 'Estado', asc: 'Del inicio al final del proceso', desc: 'Del final al inicio del proceso' },
  { key: 'fecha', label: 'Recibida', asc: 'De la más antigua a la más reciente', desc: 'De la más reciente a la más antigua' },
  // Se ofrece en los DOS modos aunque la tabla no pinte esa columna: ordenar por
  // algo que no se ve es legítimo (ya lo hacen las preguntas del formulario con
  // su columna apagada), y si solo existiera en el tablero, volver a la tabla
  // dejaría el panel enseñando un orden que no está en su propia lista.
  { key: 'etapa', label: 'En esta etapa', asc: 'De menos a más días', desc: 'De más a menos días' },
]

/** El orden de fábrica de la tabla, y el que "Restablecer" devuelve. */
/**
 * EL ORDEN DE FÁBRICA DEPENDE DEL MODO, porque el reloj que importa depende del
 * modo (Mario, ago 2026).
 *
 * En una TABLA lo que ordena es cuándo llegó la candidatura. En un TABLERO cada
 * columna es una FASE, así que el reloj que cuenta es cuándo entró en ella: de
 * más reciente a más antiguo, o sea **lo último que se ha movido, arriba**.
 *
 * Es la misma dirección que la tabla ("de la más reciente a la más antigua"), no
 * la contraria: una lista de trabajo se lee empezando por lo último que ha
 * pasado. Lo escribo porque yo había argumentado lo opuesto (poner arriba al que
 * lleva más esperando, para atacar lo atascado) y Mario lo corrigió: para eso
 * está el sentido inverso, a un clic en el engranaje, no el valor de fábrica.
 */
const ORDEN_INICIAL: { key: SortKey; dir: 'asc' | 'desc' } = { key: 'fecha', dir: 'desc' }
const ORDEN_INICIAL_TABLERO: { key: SortKey; dir: 'asc' | 'desc' } = { key: 'etapa', dir: 'asc' }

/**
 * LAS PREGUNTAS DE SÍ/NO Y DE NÚMERO TAMBIÉN ORDENAN (Mario, ago 2026).
 *
 * Solo esas dos: un texto libre o una selección no tienen un orden que signifique
 * nada, y ofrecerlo sería un botón que devuelve un resultado arbitrario. Las dos
 * que sí se comparan como número, que es justo lo que las hace ordenables.
 *
 * SE OFRECEN AUNQUE LA COLUMNA ESTÉ APAGADA, y eso no es un descuido: ordenar por
 * algo que no se pinta es legítimo ("ponme primero a los que tienen carnet aunque
 * no quiera la columna"), y sobre todo, si se cayera de la lista al apagarla te
 * quedarías con un orden puesto y sin forma de cambiarlo. Que es exactamente el
 * agujero que este bloque vino a tapar.
 */
function ordenesDe(campaign: Campaign | undefined, showFit: boolean): OpcionOrden[] {
  const base = ORDENES_BASE.filter((o) => o.key !== 'encaje' || showFit)
  const preguntas = (campaign?.fields ?? [])
    .filter((f) => TIPOS_ORDENABLES.includes(f.type))
    .map<OpcionOrden>((f) => ({
      key: `campo:${f.id}`,
      label: f.label,
      ...(f.type === 'boolean'
        ? { asc: 'De No a Sí', desc: 'De Sí a No' }
        : { asc: 'De menor a mayor', desc: 'De mayor a menor' }),
    }))
  return [...base, ...preguntas]
}

/**
 * Las columnas, en el orden en que el producto las declara. `candidato` es FIJA:
 * es de quién es la fila y además es la que se queda quieta al desplazar, así
 * que tiene que ser la primera o el `sticky` no cuadra.
 *
 * EL ORDEN ES EL DE MARIO (sep 2026, con la tabla dibujada delante): quién es ·
 * en qué punto está · si encaja · qué ha mandado · cómo lo tenéis clasificado ·
 * cómo se le llama · cuándo llegó. Es el orden en que se MIRA una fila: primero
 * lo que decide si sigue el proceso y al final lo que hace falta cuando ya has
 * decidido. Estado sube al segundo puesto en los dos anchos, así que el orden de
 * móvil deja de ser una excepción y pasa a ser el mismo con menos columnas.
 *
 * DOCUMENTOS ES UNA COLUMNA DEL PRODUCTO, ENCENDIDA, aunque el formulario no pida
 * ningún fichero (Mario, sep 2026). Antes salía de la pregunta de tipo `file`, o
 * sea que existía solo si alguien la había puesto en su formulario; pero un CV
 * puede llegar por otras vías (los candidatos que entran de un portal traen el
 * suyo), así que la pregunta "¿ha mandado algo?" es del CANDIDATO y no de este
 * formulario. Sin documento la celda dice una raya, que es información: esa
 * persona no ha mandado nada.
 */
const COLUMNAS: ColumnaVista<ColKey>[] = [
  { key: 'candidato', label: 'Candidato', fija: true, icon: User },
  { key: 'estado', label: 'Estado', icon: CircleDot },
  { key: 'encaje', label: 'Encaje', icon: Sparkles },
  { key: 'documentos', label: 'Documentos', icon: Paperclip },
  { key: 'etiquetas', label: 'Etiquetas', icon: Tag },
  { key: 'telefono', label: 'Teléfono', icon: Phone },
  { key: 'recibida', label: 'Recibida', icon: Clock },
]

/**
 * LAS RESPUESTAS DEL FORMULARIO TAMBIÉN SON COLUMNAS (Mario, ago 2026), y eso
 * DA LA VUELTA a una regla escrita: "fuera las columnas de respuestas del
 * formulario", que se decidió cuando llegaban solas.
 *
 * El argumento de entonces era bueno para lo que había: dos preguntas elegidas a
 * dedo se colaban en todas las tablas, cambiaban de puesto en puesto y se comían
 * el ancho de lo que sí es común. Con el panel puesto, ninguna de las tres cosas
 * pasa: **no llegan, se piden**. Y lo que se gana es lo que faltaba, poder mirar
 * de un vistazo quién tiene el carnet C sin abrir ciento cuarenta fichas.
 *
 * Nacen APAGADAS, y no es una precaución: un formulario con quince preguntas
 * encendidas de golpe no cabe en ninguna pantalla.
 *
 * Fuera las que la fila ya pinta (nombre, apellidos y teléfono): serían la misma
 * columna dos veces. El correo NO estaba y ahora se puede pedir, que era una de
 * las peticiones viejas.
 *
 * La lista vive en `format.ts`, junto a `candidateName`, porque la ficha del
 * candidato tuvo que hacer el mismo descarte en ago 2026: dos copias de la
 * misma verdad se separan al primer formulario nuevo.
 */

function COLUMNAS_DE(campaign: Campaign | undefined): ColumnaVista<ColKey>[] {
  if (!campaign) return []
  return campaign.fields
    // Fuera las de FICHERO: desde sep 2026 "Documentos" es una columna del
    // producto y sale de si el candidato ha mandado algo, no de si este
    // formulario lo pedía. Dejándolas, un puesto que pide CV tendría la misma
    // columna dos veces y con el mismo nombre.
    .filter((f) => f.type !== 'file' && !CAMPOS_YA_PINTADOS.includes(f.id))
    .map((f) => ({
      key: `campo:${f.id}` as ColKey,
      label: f.label,
      apagada: true,
      icon: ICONO_CAMPO[f.type],
    }))
}

/**
 * EN MÓVIL EL ORDEN ES OTRO Y NO LO ELIGE NADIE: Estado sube al segundo puesto
 * porque con la tabla desplazándose a lo ancho, lo que va primero es lo único
 * que se ve sin empujar. Lo que SÍ se respeta allí es lo que has apagado: si has
 * dicho que no te importa el teléfono, tampoco te importa en el móvil.
 */
const ORDEN_MOVIL: ColKey[] = ['candidato', 'estado', 'encaje', 'documentos', 'etiquetas', 'telefono', 'recibida']

/**
 * Lo que mide cada columna en móvil, donde los anchos están medidos al píxel
 * (ver el comentario de `anchoMovil`). `etiquetas` va a 0 porque allí no se
 * pinta (`hidden xl:table-cell`).
 */
const ANCHO_MOVIL: Partial<Record<ColKey, number>> = {
  candidato: 164, estado: 144, encaje: 136, documentos: 120, etiquetas: 0, telefono: 136, recibida: 136,
}
/**
 * El icono de una columna de respuesta lo dice su TIPO, igual que en las de
 * siempre: en una rejilla la cabecera es el nombre de un campo, y el icono lo
 * identifica antes de que se lea la palabra.
 */
const ICONO_CAMPO: Record<FormField['type'], LucideIcon> = {
  text: AlignLeft,
  textarea: AlignLeft,
  phone: Phone,
  email: Mail,
  select: List,
  multiselect: List,
  boolean: CheckCircle2,
  number: Hash,
  date: CalendarDays,
  file: Paperclip,
}

/**
 * LO QUE MIDE UNA RESPUESTA LO DICE SU TIPO (Mario, ago 2026).
 *
 * Empezó siendo un solo trío de medidas para todas las preguntas, y eso
 * contradice la regla que gobierna a las columnas de siempre: **el mínimo de una
 * columna lo dice su CONTENIDO**. Una pregunta de Sí/No y otra de "años de
 * experiencia" caben en un tercio de lo que necesita un texto libre, y forzarlas
 * a 120px les regala espacio que sale de la columna del nombre.
 *
 * · `min` es donde el DATO deja de leerse, no donde deja de leerse la cabecera:
 *   el título se recorta desde mucho antes ("Años d…"), y eso ya está aceptado en
 *   las de siempre. Un número de cuatro cifras o un "Sí" se leen en muy poco.
 * · `max` es donde la columna deja de enseñar algo nuevo. Un booleano nunca
 *   crece; un texto libre sí, y por eso es el único con techo generoso.
 * · `clase` va como literal y no compuesta al vuelo: una clase de Tailwind
 *   construida con una variable no llega nunca al CSS compilado (la misma lección
 *   que dejó al `<select>` sin flecha).
 */
type Medidas = { clase: string; base: number; min: number; max: number }
const MEDIDAS_TEXTO: Medidas = { clase: 'w-[160px]', base: 160, min: 120, max: 420 }
const MEDIDAS_CAMPO: Partial<Record<FormField['type'], Medidas>> = {
  boolean: { clase: 'w-[110px]', base: 110, min: 72, max: 160 },
  number: { clase: 'w-[110px]', base: 110, min: 80, max: 180 },
  date: { clase: 'w-[130px]', base: 130, min: 110, max: 200 },
  file: { clase: 'w-[110px]', base: 110, min: 90, max: 160 },
}
const medidasDe = (t: FormField['type'] | undefined) => (t && MEDIDAS_CAMPO[t]) || MEDIDAS_TEXTO

/**
 * Lo que ocupa cada columna en escritorio, para calcular el SUELO de la tabla.
 *
 * Era un `min-w-[852px]` escrito a mano, que es la suma de las seis de siempre.
 * Con columnas que se encienden y se apagan ese número deja de ser verdad al
 * primer interruptor: en `table-fixed`, la única que no declara ancho (el nombre)
 * absorbe el sobrante, y si el sobrante es negativo se estruja hasta desaparecer.
 * Se vio en pantalla: con dos preguntas encendidas, los nombres se quedaron en
 * una letra. `candidato` entra con su MÍNIMO, que es exactamente lo que se le
 * quiere garantizar antes de que la tabla empiece a desplazarse.
 */
/**
 * LOS ANCHOS DE FÁBRICA (Mario, sep 2026, con la tabla dibujada delante).
 *
 * OJO: cada número está DOS veces, aquí y en el `w-[Npx]` de su `ColHead`, y no
 * hay forma de tenerlo una sola (una clase de Tailwind compuesta al vuelo no
 * llega al CSS compilado, que es la lección del `<select>` sin flecha). Si se
 * mueve uno se mueve el otro, y lo vigila `tabla.test.ts`.
 */
const ANCHO_ESCRITORIO: Partial<Record<ColKey, number>> = {
  candidato: 230, estado: 168, encaje: 136, documentos: 128, etiquetas: 176, telefono: 168, recibida: 136,
}
const anchoEscritorioDe = (k: ColKey, tipo?: FormField['type']) => ANCHO_ESCRITORIO[k] ?? medidasDe(tipo).base
const anchoMovilDe = (k: ColKey, tipo?: FormField['type']) => ANCHO_MOVIL[k] ?? medidasDe(tipo).base

/**
 * Las clases del tinte que INVADE, por lado (ver `.fila-invade` en index.css).
 *
 * Compuestas aquí y no al vuelo (`fila-invade-${dir}`): son clases con nombre y
 * este proyecto ya se ha comido una vez que una clase compuesta a mano no llegue
 * nunca al CSS compilado (el chevron del `<select>`). Escritas enteras, un
 * buscador las encuentra desde la hoja de estilos.
 */
const CLASE_INVASION: Record<Invasion, string> = {
  arriba: 'fila-invade fila-invade-arriba',
  abajo: 'fila-invade fila-invade-abajo',
  ambos: 'fila-invade fila-invade-ambos',
}
/** Identidad estable para el arranque: así el primer render no crea un mapa por fila. */
const SIN_INVASION: Map<string, Invasion> = new Map()

// Memoizada: es lo más caro de la pantalla (142 filas son ~200ms de pintura) y el
// panel se repinta por cosas que no la tocan, la primera de ellas cada tecla del
// buscador. Con las props estables (ver los `useCallback` del panel), un render que
// no cambia ni las filas ni la selección no le cuesta nada. Cuando las filas SÍ
// cambian, el memo no puede ahorrar nada: eso lo resuelve la transición de `q`.
const CandidateTable = memo(function CandidateTable({
  campaign,
  showFit,
  canManageTags,
  columnas,
  rows,
  justArrived,
  tags,
  sort,
  onSort,
  selected,
  setSelected,
  onOpen,
  onOpenDocumento,
  maskPhone,
  lockedDates,
  onLockedClick,
}: {
  campaign: Campaign
  /** Solo hay columna Encaje si el plan tiene Meridian: sin él nunca habría nada que poner. */
  showFit: boolean
  /** Quién puede crear vocabulario nuevo desde la lista de etiquetas de una fila. */
  canManageTags: boolean
  /**
   * Las columnas a pintar, ya ordenadas y sin las que el usuario ha apagado (ver
   * `vistaTabla.ts`). Llega por prop y con identidad ESTABLE porque esta tabla
   * está memoizada: un array escrito en línea apagaría el memo en silencio.
   */
  columnas: ColKey[]
  rows: Candidate[]
  justArrived: Set<string>
  lockedDates: string[]
  onLockedClick: () => void
  tags: TagType[]
  sort: { key: SortKey; dir: 'asc' | 'desc' }
  onSort: (k: SortKey) => void
  selected: Set<string>
  setSelected: (s: Set<string>) => void
  onOpen: (id: string) => void
  /** Abre la ficha CON EL DOCUMENTO delante. Va por prop y con identidad estable
   *  (un `useCallback` en la pantalla) porque esta tabla está memoizada: una
   *  función escrita en línea en el JSX apaga el memo en silencio. */
  onOpenDocumento: (id: string) => void
  maskPhone: boolean
}) {
  const { setStatus, commentCounts } = useStore()
  // La columna Etiquetas solo existe cuando la empresa tiene vocabulario: sin una sola
  // etiqueta creada sería una columna de rayas que no explica nada. Aparece sola al
  // crear la primera, igual que su filtro.
  const showTags = TAGS_ENABLED && tags.length > 0

  // EL ORDEN DE LAS COLUMNAS ES LA PRIORIDAD, Y EN MÓVIL SE NOTA (ago 2026).
  // Con la tabla desplazándose a lo ancho, lo que va primero es lo único que se
  // ve sin empujar, así que ESTADO sube a la segunda columna: después de saber
  // quién es una persona, lo que se mira es en qué punto está. En escritorio
  // caben las seis a la vez y manda el orden de siempre, con la lectura de
  // Meridian pegada al nombre. Se declara como una lista y se pinta mapeando,
  // en vez de escribir las celdas dos veces: dos copias del mismo `<tr>` se
  // separan al primer retoque.
  const esMovil = useEsMovil()
  // En móvil manda `ORDEN_MOVIL` y no lo que el usuario haya colocado, pero SÍ se
  // respeta lo que haya apagado: si has dicho que no te importa el teléfono,
  // tampoco te importa en el móvil.
  const orden = useMemo(
    () => (esMovil
      // Las del producto en su orden de móvil, y detrás las de este puesto, que
      // no tienen sitio declarado allí.
      ? [...ORDEN_MOVIL.filter((k) => columnas.includes(k)), ...columnas.filter((k) => k.startsWith('campo:'))]
      : columnas),
    [esMovil, columnas],
  )
  /** El campo del formulario detrás de una columna `campo:<id>`, si lo es. */
  const campoDe = useCallback(
    (k: ColKey) => (k.startsWith('campo:') ? campaign.fields.find((f) => `campo:${f.id}` === k) : undefined),
    [campaign.fields],
  )
  // El ancho de cada columna es del usuario: se tira del filo de la cabecera. El
  // hook vive DENTRO de esta tabla, que está memoizada, para que ajustar un ancho
  // no cruce la frontera del `memo` ni obligue a la pantalla a repintarse entera.
  // En móvil está apagado: allí los anchos están medidos al píxel para que quepan
  // nombre y estado sin empujar, y un asa de 9px no es un objetivo de toque.
  const anchoDeFabrica = useCallback((k: string) => anchoEscritorioDe(k as ColKey, campoDe(k as ColKey)?.type), [campoDe])
  const { col, minTabla } = useColumnasAjustables('puesto', orden, !esMovil, anchoDeFabrica)
  // Solo se pintan las filas que caben en pantalla, más su colchón (ver
  // `useFilasALaVista` en `DataTable`): colocar 127 filas cuesta 1,4ms cada vez
  // que la página se recalcula, y 593 en Candidatos cuestan 9. Las bloqueadas no
  // entran aquí: son pocas y viven en su propio `<tbody>`, encima de estas.
  const cuerpoRef = useRef<HTMLTableSectionElement>(null)
  const { desde, hasta, huecoArriba, huecoAbajo } = useFilasALaVista(rows.length, cuerpoRef)
  // LA SELECCIÓN INVADE DESDE LA FILA DE AL LADO (Mario, sep 2026). La decisión
  // está en `invasionDeSeleccion` y la pintura en `.fila-invade` (index.css);
  // aquí solo vive lo que ninguno de los dos puede saber: CUÁL era la selección
  // antes de este clic.
  //
  // Se ajusta el estado DURANTE el render y no desde un efecto, que es lo que
  // esta doctrina ya fijó para resincronizar con algo que llega de fuera: un
  // efecto pinta primero la fila con el tinte ya puesto y la animación arranca
  // un fotograma tarde, o sea con el color entero a la vista. Es el mismo motivo
  // por el que un reset no se anima en la gráfica de Vista general.
  const [selAntes, setSelAntes] = useState(selected)
  const [invasion, setInvasion] = useState<Map<string, Invasion>>(SIN_INVASION)
  if (selAntes !== selected) {
    setSelAntes(selected)
    const nueva = invasionDeSeleccion(rows.map((r) => r.id), selAntes, selected)
    setInvasion((m) => {
      // Se MEZCLA en vez de sustituir: marcando dos vecinas seguidas y deprisa,
      // sustituir le quitaría la clase a la primera a media animación y su fondo
      // pegaría un salto del 60% al 100%. Y de paso se limpia lo que ya no está
      // marcado, que es lo que impide que el mapa crezca sin fin.
      const sobran = [...m.keys()].some((id) => !selected.has(id))
      if (nueva.size === 0 && !sobran) return m
      const n = new Map(m)
      for (const id of n.keys()) if (!selected.has(id)) n.delete(id)
      for (const [id, dir] of nueva) n.set(id, dir)
      return n
    })
  }
  // Al acabar la animación la fila vuelve al tinte de siempre. No es limpieza por
  // limpieza: la tabla pinta solo las filas que se ven, así que una fila marcada
  // que se sale de pantalla y vuelve se MONTA otra vez, y con la clase puesta
  // volvería a invadir cada vez que pasas por ella.
  //
  // Lo que se paga, y es pequeño: si la fila se desmonta a MEDIA animación
  // (marcar y desplazarse deprisa en el mismo gesto) el evento no llega nunca, y
  // esa fila invadirá una vez más al volver a pantalla. Con reduced-motion no hay
  // ni animación ni evento, así que la clase se queda pintando el mismo tinte
  // hasta que se desmarque, que es exactamente lo que se ve.
  const olvidarInvasion = useCallback((id: string) => {
    setInvasion((m) => {
      if (!m.has(id)) return m
      const n = new Map(m)
      n.delete(id)
      return n
    })
  }, [])

  // La casilla de selección no está en `orden`: es el asa de la fila, no un campo.
  const columnasTabla = orden.length + 1
  // EL MÍNIMO DE CADA COLUMNA LO DICE SU CONTENIDO (Mario, ago 2026). No hay un
  // número que valga para las seis: una fecha necesita la mitad que una pastilla
  // de estado. Son los anchos que Mario ajustó a ojo, y coinciden con lo medido
  // con Geist de verdad (el relleno de celda son 24, 12 por lado):
  //   · candidato 230 (Mario, ago 2026, ajustado mirándolo en el navegador). La
  //     cuenta da 206 (24 + 26 de cara + 10 de hueco + el nombre y el primer
  //     apellido del p90), pero a ese ancho el apellido roza el filo y las señales
  //     que acompañan al nombre (estrella, cuenta de mensajes) lo empujan. Los 22
  //     de más son el aire que hace que se lea como un nombre y no como un nombre
  //     que casi no cabe. Es la excepción declarada a "el mínimo sale de la
  //     cuenta": aquí la cuenta da el suelo y el ojo da el número.
  //   · encaje 85 = 24 + "Excelente" (61), que es la más ancha de las CUATRO
  //     palabras desde sep 2026 ("Puede encajar" pedía 88, y por eso el mínimo era
  //     113). Su cabecera pide más, porque lleva la marca "IA" al lado, pero el
  //     mínimo lo dice el DATO: el título se recorta desde antes, como en el resto.
  //   · etiquetas 156 = 24 + la etiqueta más ancha del vocabulario demo, que con la
  //     letra de la fila (13px/500, sep 2026) mide 132 y no los 115 de cuando el
  //     chip iba a 11px. VUELTO A MEDIR, y en cada vuelta del peso, no escalado a
  //     ojo: el mínimo de una columna es una propiedad de LO QUE PINTA, así que lo
  //     mueven tanto el cuerpo de la letra como su grosor.
  //   · telefono 111 = 24 + los nueve dígitos agrupados (87; con la letra de la fila
  //     miden 82, así que el número se queda como estaba y sobra aire).
  //   · documentos 92 = 24 + el chip "CV" y su aire. El mínimo lo dice el DATO y no
  //     la cabecera, que se recorta desde antes ("Docume…") igual que en las demás.
  //     Su techo es 180: el chip no crece, así que pasado ahí solo le quita sitio
  //     al nombre.
  //   · estado 152 = 24 + la pastilla más ancha MEDIDA, "Contactado" (128). Es el
  //     mismo 128 del que ya salieron los 144 de la columna en móvil.
  //   · recibida 128 = 24 + la FECHA MÁS ANCHA, que no es "Hoy" ni "Ayer" sino la
  //     absoluta ("28 May, 2026", 101). Su cabecera con icono y glifo de orden
  //     pide 116, o sea menos: aquí manda el dato, no el rótulo. Es el mínimo que
  //     más veces se ha corregido (116 -> 120 -> 128) y siempre por lo mismo:
  //     mirar lo que había en pantalla en vez de TODO lo que la columna puede
  //     pintar. Los 101 salen de probar los DOCE meses, no el de hoy: "May" es
  //     más ancho que "Ago", y en mayo la columna se habría quedado corta.
  const MINIMOS: Record<ColKey, number> = {
    candidato: 230, estado: 152, encaje: 85, documentos: 92, etiquetas: 156, telefono: 111, recibida: 136,
  }
  // Y SU TECHO, con la misma regla del revés: **hasta dónde la columna deja de
  // enseñar algo nuevo**. Tres de las seis tienen contenido de tamaño fijo, así
  // que pasado su ancho no aparece nada y solo le quitan sitio al nombre, que es
  // lo único de la fila que crece sin límite:
  //   · estado 240, y la pastilla más ancha mide 128: el resto es aire.
  //   · telefono 180 para nueve dígitos que siempre ocupan lo mismo.
  //   · recibida 200 para una fecha que como mucho es "19 ago 2026" (95).
  //   · encaje 160 para cuatro palabras fijas, la mayor "Excelente" (61).
  // Las otras dos sí crecen con los datos y llevan techo generoso, no ajustado:
  //   · candidato 360 (el nombre entero más largo de la demo pide 241 con cara y
  //     señales, pero los apellidos compuestos de otra empresa piden más).
  //   · etiquetas 480 (la tira más ancha de la demo son 3 etiquetas y 317).
  const MAXIMOS: Record<ColKey, number> = {
    candidato: 360, estado: 240, encaje: 160, documentos: 180, etiquetas: 480, telefono: 180, recibida: 200,
  }
  // Ancho mínimo de la tabla en móvil: la suma EXACTA de lo que se pinta. No vale
  // el 852 de escritorio, porque `table-fixed` reparte el sobrante entre las
  // columnas sin ancho propio y Candidato se volvería a comer lo que acabamos de
  // quitarle.
  //
  // Los 144 de Estado no son un número redondo: son la pastilla más ancha MEDIDA
  // ("Contactado", 128) más los 16 de relleno que deja la celda en móvil. Con los
  // 168 de escritorio no cabía el nombre; con 136 la pastilla se salía de su
  // columna y se metía en la de al lado.
  //
  // Candidato se lleva todo lo demás (164), y el tope no es el ancho de su columna
  // sino DÓNDE ACABA LA PASTILLA: 40 + 164 + 8 de relleno + 128 = 340, o sea justo
  // dentro de los 341 de contenido de una pantalla de 375. La columna de Estado
  // termina unos píxeles más allá del pliegue, pero lo que se lee cabe entero, que
  // es de lo que iba subirla a la segunda posición.
  // 40 de la casilla más lo que mida cada columna pintada. Antes era una suma
  // escrita a mano con un `showFit` colgando al final; con las columnas
  // apagables esa suma dejaría de cuadrar en cuanto quitas una, y `table-fixed`
  // reparte el sobrante entre las que no declaran ancho, o sea que Candidato se
  // volvería a comer lo que se le acaba de quitar.
  const anchoMovil = orden.reduce((t, k) => t + anchoMovilDe(k, campoDe(k)?.type), 40)
  const anchoEscritorio = orden.reduce((t, k) => t + anchoEscritorioDe(k, campoDe(k)?.type), 40)

  // Candidato cuyo estado se está cambiando desde la hoja (solo móvil).
  const [statusFor, setStatusFor] = useState<Candidate | null>(null)
  // Orden de aparición entre las filas recién llegadas: si entran varias a la
  // vez, se escalonan (como en el mockup del hero) en vez de aparecer todas de
  // golpe. Tope a 4 para no alargar la espera si llega una tanda grande.
  const arrivalOrder = useMemo(() => {
    const order = new Map<string, number>()
    let i = 0
    for (const r of rows) if (justArrived.has(r.id)) order.set(r.id, i++)
    return order
  }, [rows, justArrived])

  // CTA de las filas bloqueadas (escritorio): un ÚNICO botón centrado sobre el
  // bloque entero. No se puede anclar con position sobre un <tbody>/<tr>/<td>
  // (Safari no crea contenedor de posicionamiento sobre elementos de tabla: el
  // overlay se escaparía al viewport). Así que medimos el bloque de filas con JS
  // y colocamos el overlay dentro del <div> que envuelve la tabla, que sí es un
  // contenedor fiable en todos los navegadores.
  const tableWrapRef = useRef<HTMLDivElement>(null)
  const tableRef = useRef<HTMLTableElement>(null)
  const tableHeadRef = useRef<HTMLTableSectionElement>(null)
  const lockedBodyRef = useRef<HTMLTableSectionElement>(null)
  const [lockedBox, setLockedBox] = useState<{ top: number; height: number } | null>(null)
  const [headerCanStick, setHeaderCanStick] = useState(false)
  const [headerStuck, setHeaderStuck] = useState(false)

  // Si la tabla cabe, liberamos su overflow horizontal para que el sticky se
  // ancle al scroll principal. Cuando no cabe, conservamos el scroll horizontal
  // local y evitamos introducir un segundo desplazamiento vertical.
  useLayoutEffect(() => {
    const wrap = tableWrapRef.current
    const table = tableRef.current
    if (!wrap || !table) return
    const measure = () => {
      const fits = table.scrollWidth <= wrap.clientWidth + 1
      setHeaderCanStick((current) => current === fits ? current : fits)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(wrap)
    ro.observe(table)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [showFit, showTags])

  useEffect(() => {
    const wrap = tableWrapRef.current
    const head = tableHeadRef.current
    const scroller = wrap?.closest('main')
    if (!headerCanStick || !wrap || !head || !scroller) {
      setHeaderStuck(false)
      return
    }
    const measure = () => {
      const sr = scroller.getBoundingClientRect()
      const wr = wrap.getBoundingClientRect()
      const hr = head.getBoundingClientRect()
      const stuck = wr.top <= sr.top && wr.bottom > sr.top + hr.height
      setHeaderStuck((current) => current === stuck ? current : stuck)
    }
    measure()
    scroller.addEventListener('scroll', measure, { passive: true })
    window.addEventListener('resize', measure)
    return () => {
      scroller.removeEventListener('scroll', measure)
      window.removeEventListener('resize', measure)
    }
  }, [headerCanStick])

  useLayoutEffect(() => {
    if (lockedDates.length === 0) {
      setLockedBox(null)
      return
    }
    const measure = () => {
      const wrap = tableWrapRef.current
      const body = lockedBodyRef.current
      if (!wrap || !body) return
      const wr = wrap.getBoundingClientRect()
      const br = body.getBoundingClientRect()
      setLockedBox({ top: br.top - wr.top + wrap.scrollTop, height: br.height })
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (tableWrapRef.current) ro.observe(tableWrapRef.current)
    if (lockedBodyRef.current) ro.observe(lockedBodyRef.current)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [lockedDates.length, showFit, showTags])

  const allSel = rows.length > 0 && rows.every((r) => selected.has(r.id))
  const someSel = rows.some((r) => selected.has(r.id))

  const toggleAll = () => {
    setSelected(allSel ? new Set() : new Set(rows.map((r) => r.id)))
  }
  const toggleOne = (id: string) => {
    const n = new Set(selected)
    n.has(id) ? n.delete(id) : n.add(id)
    setSelected(n)
  }

  // Fondo de la banda de cabecera. Al despegarse lo cede al velo blanco del
  // <thead>: si la celda conservara su tinte, el contenido que pasa por debajo
  // se leería a través de dos capas y la banda dejaría de ser una superficie.
  const headTone = `transition-colors duration-[var(--duration-enter)] ease-[var(--ease-out)] motion-reduce:transition-none ${
    headerStuck ? 'bg-transparent' : 'bg-tabla-banda'
  }`
  const sortFor = (k: SortKey) => ({ active: sort.key === k, dir: sort.dir, onToggle: () => onSort(k) })

  // LAS DOS COLUMNAS FIJAS, Y EN MÓVIL NINGUNA (Mario, ago 2026).
  //
  // Allí la casilla y el nombre se llevan 204 de los 341 de contenido de una
  // pantalla de 375, y en los 137 que quedan no cabe entera NI UNA de las columnas
  // que vienen detrás: se exploraría el resto de la ficha por una rendija. En
  // escritorio el sobrante siempre da para varias columnas, que es lo que hace que
  // fijar sea ganar. Es el mismo corte que ya apaga el asa de ajustar el ancho.
  const fijaCasilla = esMovil ? '' : `${FIJA} left-0`
  // 40px: el ancho de la casilla, que es lo único que tiene delante.
  const fijaNombre = esMovil ? '' : `${FIJA} left-10`

  return (
    <>
      {/* UNA SOLA VISTA A TODOS LOS ANCHOS: LA REJILLA, QUE EN MÓVIL SE DESPLAZA
          A LO ANCHO (Mario, ago 2026; sustituye a la lista de tarjetas de dos
          líneas).

          La regla anterior era la contraria y su argumento era bueno para lo que
          había: metida a la fuerza en 375px, la tabla dejaba el nombre en 120px
          porque la columna de estado se llevaba 150. Pero eso era consecuencia de
          COMPRIMIRLA, no de que fuera una tabla; con desplazamiento horizontal las
          columnas conservan su ancho de siempre y no se comprime ninguna.

          Lo que se gana es que la fila sea la MISMA en todas partes: las mismas
          columnas (encaje y etiquetas no existían en la tarjeta), el mismo orden y
          la misma casilla de selección. Y esa casilla es lo que deja retirar el
          "modo selección" del móvil (pulsación larga, botón "Seleccionar" y el
          cambio de la cara por un círculo), que existía solo porque en la tarjeta
          no había dónde marcar.

          Lo que se paga, y hay que decirlo: en 375px se ven la persona y parte de
          su encaje, y hay que empujar a la izquierda para llegar al estado. */}
      {/* La cabecera solo puede pegarse cuando la tabla CABE: en cuanto hay
          desplazamiento horizontal el envoltorio pasa a ser contenedor de scroll y
          un `sticky` de dentro se pegaría a él y no a la página. En móvil nunca
          cabe, así que allí la cabecera se va con la lista, que es lo correcto:
          moverse a lo ancho con una banda clavada arriba desalinea las columnas de
          su propio nombre. */}
      <div ref={tableWrapRef} className={`relative ${headerCanStick ? 'overflow-visible' : 'overflow-x-auto'}`}>
      {/* El `minWidth` en línea manda sobre la clase: congelada, el suelo de la
          tabla es la suma de sus columnas (ver `useColumnasAjustables`). */}
      {/* El `minWidth` en línea manda: congelada mandan las columnas (ver
          `useColumnasAjustables`), y si no, la suma de lo que se está pintando. */}
      <table ref={tableRef} className={TABLE} style={{ minWidth: esMovil ? anchoMovil : (minTabla ?? anchoEscritorio) }}>
        <caption className="sr-only">Candidatos de {campaign.title}</caption>
        {/* La banda (fondo, velo y sombra) vive en el <thead>; los filos, en cada
            celda. En `border-separate` los bordes de <thead>/<tr> no se pintan, y
            es justo lo que permite que la cabecera pegajosa conserve los suyos. */}
        <thead
          ref={tableHeadRef}
          className={`${headerCanStick ? 'sticky top-0 z-20' : ''} transition-[background-color,box-shadow,backdrop-filter] duration-[var(--duration-enter)] ease-[var(--ease-out)] motion-reduce:transition-none ${
            headerStuck
              ? 'bg-white/82 shadow-sticky backdrop-blur-md backdrop-saturate-125'
              : 'bg-transparent shadow-none backdrop-blur-0 backdrop-saturate-100'
          }`}
        >
          <tr>
            <th scope="col" className={`${esMovil ? HEAD_CELL_FLUSH : `${HEAD_CELL_FLUSH_FIJA} left-0`} w-10 px-0 text-center leading-none ${headTone}`}>
              <Checkbox
                className="translate-y-[1.5px]"
                checked={allSel}
                indeterminate={someSel && !allSel}
                onChange={toggleAll}
                aria-label="Seleccionar todos"
              />
            </th>
            {/* Candidato y Etiquetas van SIN ancho fijo: en `table-fixed` son las
                que se reparten el hueco sobrante, así que al ensanchar la ventana
                crece el nombre (que es lo que se corta) y no una columna cualquiera.
                El resto mide lo que mide su contenido, ni un pixel más. */}
            {orden.map((k) => {
              switch (k) {
                case 'candidato':
                  // El único ancho que cambia con el ancho de la ventana: en
                  // escritorio no lo declara nadie (absorbe el sobrante, que es
                  // lo que hace crecer el nombre al ensanchar) y en móvil se fija
                  // a 160, porque allí el sobrante no existe y lo que hace falta
                  // es dejarle sitio al estado.
                  return <ColHead key={k} className={esMovil ? 'w-[164px]' : ''} fija={fijaNombre || undefined} toneClass={headTone} sort={sortFor('nombre')} {...col(k, 'Candidato', MINIMOS.candidato, MAXIMOS.candidato)}>Candidato</ColHead>
                case 'encaje':
                  return showFit ? <ColHead key={k} ia className="w-[136px]" toneClass={headTone} sort={sortFor('encaje')} {...col(k, 'Encaje', MINIMOS.encaje, MAXIMOS.encaje)}>Encaje</ColHead> : null
                case 'documentos':
                  return <ColHead key={k} className="w-[128px]" toneClass={headTone} {...col(k, 'Documentos', MINIMOS.documentos, MAXIMOS.documentos)}>Documentos</ColHead>
                case 'etiquetas':
                  // Ya no se esconde sola por debajo de `xl`: eso lo decide el
                  // panel, y con las dos cosas a la vez el interruptor decía
                  // "encendida" mientras la columna no se veía. Y pasa a declarar
                  // ancho, para que la única que absorbe el sobrante sea el nombre.
                  return showTags ? <ColHead key={k} className="w-[176px]" toneClass={headTone} {...col(k, 'Etiquetas', MINIMOS.etiquetas, MAXIMOS.etiquetas)}>Etiquetas</ColHead> : null
                case 'telefono':
                  return <ColHead key={k} className="w-[168px]" toneClass={headTone} {...col(k, 'Teléfono', MINIMOS.telefono, MAXIMOS.telefono)}>Teléfono</ColHead>
                case 'estado':
                  return <ColHead key={k} className={esMovil ? 'w-[144px]' : 'w-[168px]'} toneClass={headTone} sort={sortFor('estado')} {...col(k, 'Estado', MINIMOS.estado, MAXIMOS.estado)}>Estado</ColHead>
                case 'recibida':
                  // `pr-5` en la cabecera Y en la celda: la fecha va pegada al
                  // filo de la tarjeta, que es el borde de la pantalla de trabajo,
                  // y con los 12px de siempre se leía apretada contra él. Los dos
                  // a la vez o el título y su columna dejan de estar alineados.
                  return <ColHead key={k} className="w-[136px] pr-5" align="right" toneClass={headTone} sort={sortFor('fecha')} {...col(k, 'Recibida', MINIMOS.recibida, MAXIMOS.recibida)}>Recibida</ColHead>
                default: {
                  // Una respuesta del formulario. Ordena si se puede comparar, o
                  // sea Sí/No y número (ver `TIPOS_ORDENABLES`): un texto libre o
                  // una selección no tienen un orden que signifique nada, y el
                  // glifo prometería un resultado arbitrario.
                  const f = campoDe(k)
                  if (!f) return null
                  const etiqueta = f.type === 'file' ? 'Documentos' : f.label
                  const m = medidasDe(f.type)
                  return (
                    <ColHead
                      key={k}
                      className={m.clase}
                      toneClass={headTone}
                      sort={TIPOS_ORDENABLES.includes(f.type) ? sortFor(k) : undefined}
                      {...col(k, etiqueta, m.min, m.max)}
                    >
                      {etiqueta}
                    </ColHead>
                  )
                }
              }
            })}
          </tr>
        </thead>
        {/* Bloqueados (escritorio): ARRIBA, como las candidaturas nuevas (son las
            más recientes). Cada fila usa las MISMAS celdas y anchos que una real (el
            table-fixed las alinea igual bajo cada cabecera) con contenido señuelo
            difuminado (mismo texto que el Excel: "Candidatura bloqueada" / "Bloqueada").
            El CTA NO va aquí: es un overlay medido (ver lockedBox) posicionado sobre
            el <div> envoltorio, no sobre la tabla, para funcionar también en Safari. */}
        {lockedDates.length > 0 && (
          <tbody ref={lockedBodyRef}>
            {lockedDates.map((date, i) => (
              // Sin `group/row`: estas filas nunca son la última de la tabla (debajo
              // vienen las reales), así que conservan su filo inferior siempre.
              <tr key={`locked-${i}`} className={`h-12 ${TEXTO_FILA} bg-tabla-bloqueada`}>
                <td className={`${CELL_FLUSH} ${fijaCasilla} ${fijaCasilla && 'bg-tabla-bloqueada'} px-0 text-center leading-none`}>
                  <div aria-hidden className="mx-auto size-4 rounded-[5px] border border-slate-300 bg-white blur-[4px] select-none" />
                </td>
                {/* Las mismas celdas y en el MISMO orden que una fila real: las
                    recorre la misma lista, así que no pueden descuadrarse. */}
                {orden.map((k) => {
                  switch (k) {
                    case 'candidato':
                      return (
                        <td key={k} className={`${CELL} ${fijaNombre} ${fijaNombre && 'bg-tabla-bloqueada'}`}>
                          <span aria-hidden className="block truncate text-slate-700 blur-[4px] select-none">Candidatura bloqueada</span>
                        </td>
                      )
                    case 'encaje':
                      return showFit ? (
                        <td key={k} className={CELL}>
                          <span aria-hidden className="block truncate text-slate-600 blur-[4px] select-none">Bueno</span>
                        </td>
                      ) : null
                    case 'documentos':
                      return (
                        <td key={k} className={CELL}>
                          <span aria-hidden className="inline-block rounded-sm bg-slate-200 px-1.5 py-0.5 text-slate-600 blur-[4px] select-none">CV</span>
                        </td>
                      )
                    case 'etiquetas':
                      return showTags ? (
                        <td key={k} className={CELL}>
                          <span aria-hidden className="inline-block rounded-full bg-slate-200 px-2 py-0.5 text-slate-600 blur-[4px] select-none">Etiqueta</span>
                        </td>
                      ) : null
                    case 'telefono':
                      return (
                        <td key={k} className={CELL}>
                          <span aria-hidden className="num block truncate text-slate-600 blur-[4px] select-none">612 345 678</span>
                        </td>
                      )
                    case 'estado':
                      return (
                        <td key={k} className={`${CELL} whitespace-nowrap`}>
                          <span aria-hidden className="inline-flex items-center gap-1.5 rounded-full bg-slate-200 px-2.5 py-1 text-slate-600 ring-1 ring-slate-300 blur-[4px] select-none">
                            <span className="size-1.5 rounded-full bg-slate-400" /> Bloqueada
                          </span>
                        </td>
                      )
                    case 'recibida':
                      return (
                        <td key={k} className={`${CELL} whitespace-nowrap pr-5 text-right`}>
                          <time dateTime={date} aria-hidden className="num text-slate-500 blur-[4px] select-none">{fechaCorta(date)}</time>
                        </td>
                      )
                    default:
                      // Mismo señuelo difuminado que sus vecinas: si no se pintara,
                      // la fila bloqueada tendría menos celdas que una real y
                      // `table-fixed` descuadraría las dos.
                      return (
                        <td key={k} className={CELL}>
                          <span aria-hidden className="block truncate text-slate-600 blur-[4px] select-none">Respuesta</span>
                        </td>
                      )
                  }
                })}
              </tr>
            ))}
          </tbody>
        )}
        <tbody ref={cuerpoRef}>
          <HuecoFilas alto={huecoArriba} columnas={columnasTabla} />
          {rows.slice(desde, hasta).map((c) => {
            const sel = selected.has(c.id)
            const invade = invasion.get(c.id)
            // El fondo de una fila MARCADA es SIEMPRE el tinte de siempre; lo que
            // añade la invasión es el blanco que aún no ha sido invadido, que
            // encoge encima (`CLASE_INVASION` y `.fila-invade` en index.css). Que
            // el color de debajo no cambie en ningún momento es lo que hace que al
            // acabar la animación no se vea el relevo: es el parpadeo que tenía la
            // primera versión, que iba de blanco y tenía que virar al tinte.
            const fondoSel = `bg-tabla-selec ${invade ? CLASE_INVASION[invade] : ''}`
            // El fondo de las dos celdas FIJAS. Es el mismo de la fila y no puede
            // no serlo: la fila lo necesita para pintarse y ellas para tapar lo
            // que se desliza por debajo, así que un tono distinto sería una
            // costura vertical en mitad de cada candidato. Y por eso la invasión
            // la llevan las tres a la vez: puestas en el mismo commit, sus
            // animaciones arrancan en el mismo fotograma y se leen como una sola
            // banda creciendo.
            // Con la transición de la fila: la celda fija pinta su propio fondo,
            // y sin ella salta mientras el resto se funde (ver `TRANSICION_FILA`).
            const fondoFila = esMovil ? '' : `${TRANSICION_FILA} ${sel ? fondoSel : 'bg-white group-hover:bg-slate-50'}`
            const name = candidateName(c) || 'Sin nombre'
            const arrivedAt = arrivalOrder.get(c.id)
            const hasTags = c.tagIds.some((id) => tags.some((tag) => tag.id === id))
            return (
              <tr
                key={c.id}
                style={arrivedAt !== undefined
                  ? { animation: `drop-in 240ms var(--ease-out) ${Math.min(arrivedAt, 4) * 45}ms both` }
                  : undefined}
                onClick={(e) => clickDeFila(e) && onOpen(c.id)}
                // Solo la de la propia fila: la misma animación corre en las dos
                // celdas fijas y su evento burbujea hasta aquí.
                onAnimationEnd={(e) => { if (e.target === e.currentTarget) olvidarInvasion(c.id) }}
                className={`${ROW} group cursor-pointer ${sel ? fondoSel : 'hover:bg-slate-50'}`}
              >
                {/* La ÚNICA celda que no abre la ficha, y a propósito: es la zona de
                    puntería de su checkbox, no un hueco de la fila (ver lib/fila.ts). */}
                <td className={`${CELL_FLUSH} ${fijaCasilla} ${fondoFila} px-0 text-center leading-none`} onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    className="translate-y-[1.5px]"
                    checked={sel}
                    onChange={() => toggleOne(c.id)}
                    aria-label={`Seleccionar ${name}`}
                  />
                </td>
                {orden.map((k) => {
                  switch (k) {
                    case 'candidato':
                      return (
                        <td key={k} className={`${CELL} ${fijaNombre} ${fondoFila}`}>
                          <div className="flex items-center gap-2.5">
                            <MeridianAvatar name={name} fit={c.ai && !c.ai.error ? c.ai.fit : undefined} size={AVATAR_FILA} />
                            <div className="flex min-w-0 flex-1 items-center gap-1.5">
                              {/* Sin subrayado permanente (se probó, ago 2026): la fila
                                  ENTERA abre la ficha, así que subrayar solo el nombre
                                  promete un objetivo más pequeño del que hay, y cien
                                  rayas seguidas compiten con los filos de la rejilla.
                                  El foco de teclado no se queda sin señal: pasa a
                                  anillo, que es lo que la doctrina pide. */}
                              <button
                                type="button"
                                onClick={() => onOpen(c.id)}
                                className="block min-w-0 truncate rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
                                title={name}
                              >
                                {name}
                              </button>
                              {c.source === 'prueba' && <TestChip />}
                              <InterestOutcomeIcon campaign={campaign} candidate={c} />
                              <RowSignals favorito={c.favorito} comments={commentCounts[c.id] ?? 0} soloTexto={esMovil} />
                            </div>
                          </div>
                        </td>
                      )
                    case 'encaje':
                      return showFit ? (
                        <td key={k} className={CELL}>
                          <FitCell candidate={c} />
                        </td>
                      ) : null
                    case 'documentos':
                      return (
                        <td key={k} className={CELL}>
                          <CeldaDocumento cvPath={c.cvPath} nombre={name} onAbrir={() => onOpenDocumento(c.id)} />
                        </td>
                      )
                    case 'etiquetas':
                      return showTags ? (
                        <td key={k} className={CELL}>
                          {/* LA CELDA ES EL DISPARADOR de la misma lista de
                              etiquetas que usa la barra de selección, con esta
                              persona como "selección de uno" (Mario, ago 2026).

                              Devuelve un control a esta celda, de la que la
                              doctrina había ido quitándolos ("+N" fue botón,
                              luego texto, luego nada). Pero el que se quitó
                              escondía INFORMACIÓN detrás de un click; este da
                              una ACCIÓN que antes exigía abrir la ficha, y
                              etiquetar es de las cosas que más se hacen mirando
                              la lista. Sin tag, la raya también abre: es como se
                              pone la primera.

                              `flotante` porque aquí el panel se sale de la
                              tabla, que se desplaza y va recortada. */}
                          <BulkTagMenu
                            selectedIds={[c.id]}
                            canManage={canManageTags}
                            flotante
                            triggerClass="flex w-full min-w-0 items-center rounded-md -mx-1 px-1 py-0.5 text-left hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500/40 max-sm:-mx-2 max-sm:min-h-12 max-sm:w-[calc(100%+1rem)] max-sm:rounded-lg max-sm:px-2"
                          >
                            {hasTags ? <TagCell tagIds={c.tagIds} tags={tags} /> : <span className="text-slate-600">–</span>}
                          </BulkTagMenu>
                        </td>
                      ) : null
                    case 'telefono':
                      return (
                        <td key={k} className={CELL}>
                          <span className="num block truncate">
                            {maskPhone && answerStr(c, 'telefono')
                              ? <MaskedPhone value={formatPhone(answerStr(c, 'telefono'))} />
                              : (formatPhone(answerStr(c, 'telefono')) || '–')}
                          </span>
                        </td>
                      )
                    case 'estado':
                      return (
                        <td key={k} className={`${CELL} whitespace-nowrap`}>
                          <StatusSelect status={c.status} onChange={(s) => setStatus(c.id, s)} celda />
                        </td>
                      )
                    case 'recibida':
                      return (
                        <td key={k} className={`${CELL} whitespace-nowrap pr-5 text-right`}>
                          <time dateTime={c.submittedAt} title={fullDateTime(c.submittedAt)} className="num">{fechaCorta(c.submittedAt)}</time>
                        </td>
                      )
                    default: {
                      const f = campoDe(k)
                      if (!f) return null
                      return (
                        <td key={k} className={CELL}>
                          <RespuestaCelda candidate={c} field={f} />
                        </td>
                      )
                    }
                  }
                })}
              </tr>
            )
          })}
          <HuecoFilas alto={huecoAbajo} columnas={columnasTabla} />
        </tbody>
      </table>
      {/* CTA ÚNICO del bloque bloqueado, centrado sobre TODAS las filas bloqueadas.
          Vive fuera de la tabla (dentro del <div> envoltorio, contenedor fiable en
          todos los navegadores) y su posición/alto se miden desde el <tbody>. */}
      {lockedBox && (
        <div
          className="pointer-events-none absolute inset-x-0 z-10 flex items-center justify-center"
          style={{ top: lockedBox.top, height: lockedBox.height }}
        >
          <button type="button" onClick={onLockedClick} className={`${BTN_PRIMARY_SM} pointer-events-auto shadow-pop`}>
            <Lock className="size-3.5" aria-hidden /> Añadir método de pago
          </button>
        </div>
      )}
      </div>

      <StatusPickerSheet
        open={!!statusFor}
        status={statusFor?.status ?? null}
        onPick={(s) => statusFor && setStatus(statusFor.id, s)}
        onClose={() => setStatusFor(null)}
      />
    </>
  )
})

// --- Subcomponentes de filtro / estados ------------------------------------
// Slider de rango con dos pomos (dos inputs range superpuestos; los pomos no se
// cruzan). La pista coloreada marca el tramo seleccionado.
function RangeSlider({ min, max, from, to, onChange }: {
  min: number; max: number; from: number; to: number; onChange: (from: number, to: number) => void
}) {
  const span = max - min || 1
  const pctFrom = ((from - min) / span) * 100
  const pctTo = ((to - min) / span) * 100
  return (
    <div className="relative h-5">
      <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-slate-200" aria-hidden />
      <div
        className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-indigo-500"
        style={{ left: `${pctFrom}%`, width: `${pctTo - pctFrom}%` }}
        aria-hidden
      />
      <input
        type="range" min={min} max={max} value={from}
        onChange={(e) => onChange(Math.min(Number(e.target.value), to), to)}
        aria-label="Desde"
        className="range-thumb absolute inset-0 h-5 w-full"
      />
      <input
        type="range" min={min} max={max} value={to}
        onChange={(e) => onChange(from, Math.max(Number(e.target.value), from))}
        aria-label="Hasta"
        className="range-thumb absolute inset-0 h-5 w-full"
      />
    </div>
  )
}

/**
 * La celda de una respuesta del formulario.
 *
 * UNA SOLA LÍNEA Y RECORTADA, con el texto entero en el `title`: la fila tiene
 * alto fijo, que es lo que deja bajar la vista por una columna, y una respuesta
 * de párrafo la rompería. Lo que no cabe se lee en la ficha, que es donde la
 * respuesta vive entera.
 *
 * EL CV NO ES UN CONTROL, y eso es a propósito: aquí sería un botón más dentro
 * de una fila, y la doctrina dice que ahí solo entra lo imprescindible. Se dice
 * si LO HAY, y para verlo se abre la ficha, que es lo que hace la fila entera al
 * pulsarla. Además, descargarlo pide una URL firmada, y esa lógica no puede
 * vivir en dos sitios.
 */
function RespuestaCelda({ candidate, field }: { candidate: Candidate; field: FormField }) {
  // Aquí había una rama para las preguntas de FICHERO. Se fue con la columna
  // Documentos, que desde sep 2026 es del producto y no de una pregunta: estas
  // celdas ya no pueden recibir un `file`, y una rama inalcanzable es una copia
  // esperando a separarse de la buena.
  const texto = answerStr(candidate, field.id)
  if (!texto) return <span className="text-slate-500">–</span>
  // UN CORREO ES UN ENLACE (Mario, ago 2026). Es el único dato de la fila que se
  // puede USAR desde aquí, y escribirle a alguien es a lo que se viene. No rompe
  // la regla de "en una fila solo controles imprescindibles" porque esta columna
  // no está de serie: si la ves es porque la has pedido.
  //
  // PERO SE PINTA COMO UN DATO, NO COMO UN ENLACE (Mario, sep 2026: "email se va a
  // ver en negro como el resto, y el underline solo se verá al hacer hover"). Es la
  // consecuencia de que la fila sea de un solo cuerpo, un solo peso y una sola
  // tinta: un azul en mitad de una columna de datos negros no se lee como "esto se
  // puede pulsar", se lee como que ESE dato es distinto de los demás. Lo que se
  // puede pulsar lo dice el subrayado al pasar por encima, que es lo que se busca
  // cuando se busca un enlace, y el cursor. Y lo que no cambia: sigue siendo un `a`
  // de verdad, así que el teclado lo alcanza y su foco se ve.
  //
  // Y no hace falta parar la propagación: `clickDeFila` ya ignora lo que caiga
  // dentro de un control de verdad, y un `<a>` lo es. Pulsas el correo y se abre
  // tu correo; pulsas el resto de la fila y se abre la ficha.
  if (field.type === 'email') {
    return (
      <a
        href={`mailto:${texto}`}
        title={texto}
        className="block truncate rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
      >
        {texto}
      </a>
    )
  }
  // `num` en lo que se compara en columna (números y fechas), como la de Recibida.
  const cifra = field.type === 'number' || field.type === 'date'
  return <span className={`block truncate ${cifra ? 'num' : ''}`} title={texto}>{texto}</span>
}

/* --- Vocabulario del menú del puesto -------------------------------------
   Vive en el módulo y no dentro de `PuestoMenu` porque lo comparten sus filas y
   los paneles laterales que cuelgan de ellas, que son componentes aparte. En
   móvil la fila crece (14px y más alto) porque es un objetivo de toque. */
const FILA = 'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-[14px] outline-none transition-colors duration-[var(--duration-control)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500/40 sm:py-1.5 sm:text-[13px]'
const QUIETA = 'text-slate-800 hover:bg-slate-50'
const GLIFO = 'size-4 shrink-0 text-slate-400'

/**
 * UNA FILA DE MENÚ QUE ABRE SU PANEL AL LADO, AL PASAR POR ENCIMA.
 *
 * Sustituye a la navegación por páginas dentro de la misma caja (Mario, ago 2026,
 * con la referencia delante: "que salieran hacia el lado al hacer hover, en vez
 * de obligar a hacer click"). El argumento de las páginas era bueno y sigue
 * siéndolo EN MÓVIL, donde un panel lateral no tiene dónde ponerse: allí se
 * queda. En escritorio, un submenú de tres filas no merece dos clicks (entrar y
 * volver) y encima te tapa el resto del menú mientras estás dentro.
 *
 * TRES COSAS QUE NO SON OPCIONALES:
 *
 * 1. **Va hacia la IZQUIERDA** (`colocarLateral`), porque este menú vive pegado
 *    al filo derecho de la pantalla: hacia la derecha no cabe casi nunca. Es lo
 *    que hace la referencia, y por lo mismo.
 * 2. **Al salir no se cierra en el acto.** Entre la fila y el panel hay un hueco,
 *    y el ratón lo cruza en diagonal: cerrando al primer `mouseleave` el submenú
 *    es literalmente inalcanzable. Se espera un pelo, y el propio panel cancela
 *    la espera al recibir el ratón.
 * 3. **Con teclado se abre y el foco ENTRA.** El panel va en un portal (el menú
 *    lleva `overflow-clip` y lo recortaría), así que en el DOM está al final del
 *    `body` y el tabulador no llegaría solo. Al abrir con teclado se mueve el
 *    foco a su primera fila y Escape lo devuelve. Abriendo con el ratón NO se
 *    toca el foco, o se lo robaría a lo que estuvieras escribiendo.
 */
function FilaSubmenu({
  id,
  icon: Icon,
  label,
  valor,
  abierto,
  onAbrir,
  onCerrarTarde,
  onCerrarYa,
  children,
}: {
  id: string
  icon: LucideIcon
  label: string
  /** Lo que vale ahora, si la fila informa además de llevar (la sede). */
  valor?: ReactNode
  abierto: boolean
  onAbrir: (id: string, conFoco?: boolean) => void
  onCerrarTarde: () => void
  onCerrarYa: () => void
  children: ReactNode
}) {
  const filaRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  // Al cerrarse hay que olvidar dónde estaba: si no, al reabrir se pinta un
  // fotograma en la posición del anterior antes de recolocarse.
  useEffect(() => { if (!abierto) setPos(null) }, [abierto])

  useLayoutEffect(() => {
    if (!abierto) return
    const colocar = () => {
      const a = filaRef.current?.getBoundingClientRect()
      const p = panelRef.current?.getBoundingClientRect()
      if (!a || !p) return
      // EL ANCLA HORIZONTAL ES EL MENÚ, NO LA FILA. La fila empieza DENTRO del
      // relleno del menú (6px), así que colgando de ella el panel se metía dos
      // píxeles por debajo del menú y se veía pisándolo. Lo que la fila decide es
      // la ALTURA; de dónde sale el panel lo decide la caja que lo contiene.
      const menu = filaRef.current?.closest('[role="menu"]')?.getBoundingClientRect() ?? a
      const caja = { top: a.top, bottom: a.bottom, left: menu.left, right: menu.right }
      setPos(colocarLateral(caja, { width: p.width, height: p.height }, { width: window.innerWidth, height: window.innerHeight }))
    }
    colocar()
    window.addEventListener('resize', colocar)
    return () => window.removeEventListener('resize', colocar)
  }, [abierto])

  const alTeclado = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onAbrir(id, true)
    } else if (e.key === 'ArrowLeft' || e.key === 'Escape') {
      if (!abierto) return
      e.stopPropagation()
      onCerrarYa()
      filaRef.current?.focus()
    }
  }

  return (
    <div onMouseEnter={() => onAbrir(id)} onMouseLeave={onCerrarTarde}>
      <button
        ref={filaRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={abierto}
        onClick={() => (abierto ? onCerrarYa() : onAbrir(id, true))}
        onKeyDown={alTeclado}
        onFocus={() => onAbrir(id)}
        className={`${FILA} ${abierto ? 'bg-slate-50' : QUIETA}`}
      >
        <Icon className={GLIFO} aria-hidden />
        <span className="flex-1">{label}</span>
        {valor}
        <ChevronRight className="size-3.5 shrink-0 text-slate-400" aria-hidden />
      </button>
      {abierto && createPortal(
        <div
          ref={panelRef}
          role="menu"
          aria-label={label}
          onMouseEnter={() => onAbrir(id)}
          onMouseLeave={onCerrarTarde}
          onKeyDown={(e) => {
            if (e.key !== 'Escape') return
            e.stopPropagation()
            onCerrarYa()
            filaRef.current?.focus()
          }}
          style={{ top: pos?.top ?? 0, left: pos?.left ?? 0, visibility: pos ? 'visible' : 'hidden' }}
          className="fixed z-[60] w-64 overflow-clip rounded-xl filo bg-white p-1.5 shadow-pop"
        >
          {children}
        </div>,
        document.body,
      )}
    </div>
  )
}

/**
 * QUIÉN TIENE EL SUBMENÚ ABIERTO LO DECIDE EL MENÚ, NO CADA FILA.
 *
 * Con un `useState` por fila no hay forma de que una sepa de la otra, y con la
 * espera de cierre puesta eso deja **dos submenús pintados a la vez** al pasar de
 * una fila a la siguiente. Es la misma lección que los plegables del lateral: lo
 * que tiene que ser excluyente vive en el padre.
 *
 * La espera solo cubre el caso para el que se puso: **salir hacia FUERA**, que es
 * cruzar en diagonal el hueco entre la fila y su panel. Al entrar en otra fila se
 * cierra en el acto, porque abrir la nueva es cerrar la vieja.
 */
function useSubmenu() {
  const [abierto, setAbierto] = useState<string | null>(null)
  const espera = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(espera.current), [])

  const onAbrir = useCallback((id: string, conFoco = false) => {
    window.clearTimeout(espera.current)
    setAbierto(id)
    if (!conFoco) return
    // Tras el commit: el panel todavía no existe cuando esto se llama.
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(`[role="menu"][aria-label="${id}"] button`)?.focus()
    })
  }, [])
  const onCerrarYa = useCallback(() => {
    window.clearTimeout(espera.current)
    setAbierto(null)
  }, [])
  const onCerrarTarde = useCallback(() => {
    window.clearTimeout(espera.current)
    espera.current = window.setTimeout(() => setAbierto(null), 140)
  }, [])

  return { abierto, onAbrir, onCerrarYa, onCerrarTarde }
}

/**
 * EL `···` DE LA BARRA DE SELECCIÓN/**
 * EL `···` DE LA BARRA DE SELECCIÓN: lo que no se hace a diario.
 *
 * Su panel va en un PORTAL por lo mismo que el de etiquetas: la barra recorta lo
 * que cuelgue de dentro (`overflow-clip`), y aquí encima tiene que abrirse hacia
 * arriba, que es lo único que cabe pegado al filo de abajo.
 */
function MenuMas({ onInteres, onExportar, className = SEGMENTO }: {
  onInteres: () => void
  onExportar: () => void
  className?: string
}) {
  const [open, setOpen] = useState(false)
  // El ancla es el BOTÓN: el envoltorio va en `display: contents` para que el
  // botón sea el tramo de verdad de la barra, y un elemento sin caja devuelve un
  // rect a cero.
  const botonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  useLayoutEffect(() => {
    if (!open) return
    const colocar = () => {
      const ancla = botonRef.current?.getBoundingClientRect()
      const panel = panelRef.current?.getBoundingClientRect()
      if (!ancla || !panel) return
      // Alineado a la DERECHA: es el último tramo, así que colgando por la
      // izquierda se saldría de la barra hacia dentro y taparía a sus vecinos.
      setPos(colocarFlotante(
        ancla,
        { width: panel.width, height: panel.height },
        { width: window.innerWidth, height: window.innerHeight },
        { alinear: 'derecha' },
      ))
    }
    colocar()
    window.addEventListener('resize', colocar)
    return () => window.removeEventListener('resize', colocar)
  }, [open])

  useEffect(() => {
    if (!open) return
    const dentro = (t: Node) =>
      (botonRef.current?.contains(t) ?? false) || (panelRef.current?.contains(t) ?? false)
    const onDoc = (e: MouseEvent) => !dentro(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Un ítem de este menú es un VERBO, así que al pulsarlo el menú se cierra (el
  // reverso del menú de estado, donde eliges y te quedas).
  const FILA_MAS = 'flex w-full items-center gap-3 rounded-lg px-2.5 py-1.5 text-left text-[13px] text-slate-800 outline-none transition-colors duration-[var(--duration-control)] hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500/40'

  return (
    <>
      <button
        ref={botonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Más acciones"
        title="Más acciones"
        className={`${className} px-3`}
      >
        <MoreHorizontal className="size-4" aria-hidden />
      </button>
      {open && createPortal(
        <div
          ref={panelRef}
          style={{ top: pos?.top ?? 0, left: pos?.left ?? 0, visibility: pos ? 'visible' : 'hidden' }}
          className="fixed z-[70] w-56 overflow-clip rounded-xl filo bg-white p-1.5 shadow-pop"
        >
          <button type="button" onClick={() => { setOpen(false); onInteres() }} className={FILA_MAS}>
            <MailCheck className="size-4 shrink-0 text-slate-400" aria-hidden /> Comprobar interés
          </button>
          <button type="button" onClick={() => { setOpen(false); void onExportar() }} className={FILA_MAS}>
            <Download className="size-4 shrink-0 text-slate-400" aria-hidden /> Exportar
          </button>
        </div>,
        document.body,
      )}
    </>
  )
}

/**
 * UN TRAMO de la barra de selección. No es un botón del sistema y por eso no sale
 * de `lib/buttons.ts`: no tiene radio propio ni altura propia, porque es una
 * PARTE de una pieza mayor, igual que las dos mitades del conmutador
 * Activos/Rechazados. Lo que sí comparte con `sobreOscuro` es la pintura, que son
 * tres peldaños de opacidad sobre la tinta.
 */
const SEGMENTO_BASE = [
  'inline-flex items-center gap-1.5 whitespace-nowrap px-3.5 text-[13px] font-medium outline-none',
  'transition-colors duration-[var(--duration-control)] ease-[var(--ease-out)] motion-reduce:transition-none',
  'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/40',
  // La PINTURA sale del sistema y no se escribe otra vez aquí: es la misma
  // variante `sobreOscuro` que se declaró para esta barra.
  BTN_SUPERFICIE.sobreOscuro,
].join(' ')

/** En escritorio cada tramo mide lo que dice: la barra crece con ellos. */
const SEGMENTO = `${SEGMENTO_BASE} shrink-0`

/**
 * En MÓVIL se reparten el ancho a partes iguales, porque la barra ya no puede
 * crecer: a 375px el ancho de cada tramo lo decide el dedo, no el largo de su
 * palabra.
 *
 * Es una constante y no un `flex-1` añadido desde fuera porque `shrink-0` y el
 * reparto son el MISMO eje: se vio en pantalla, con los tres tramos pidiendo el
 * ancho entero (351px cada uno de una barra de 351) y saliéndose de la caja. La
 * salida es la variante que no pone lo que sobra.
 */
const SEGMENTO_ANCHO = `${SEGMENTO_BASE} flex-1 justify-center`

/**
 * El filo que separa dos tramos. De alto completo: es lo que los hace tramos.
 * Al 22% y no al 15% por lo mismo que subieron los peldaños del hover: el mismo
 * velo blanco separa menos sobre el ultramarine que sobre la tinta (1,34:1
 * contra 1,58), y un filo que no se ve deja de partir la barra en tramos.
 */
const Filo = () => <span aria-hidden className="w-px shrink-0 bg-white/22" />

function SkeletonRows({ showFit }: { showFit: boolean }) {
  // Replica la rejilla real de la fila (checkbox · nombre, y a la derecha
  // encaje/etiquetas/teléfono/estado/fecha) para que el paso a datos no salte.
  return (
    <div role="status" aria-label="Cargando candidatos">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex h-12 items-center gap-3 border-b border-slate-100 px-3 py-3 last:border-0">
          <div className="size-4 shrink-0 rounded skeleton" />
          <div className="h-3.5 w-40 rounded skeleton" />
          <div className="ml-auto hidden items-center gap-8 md:flex">
            {showFit && <div className="h-3 w-20 rounded skeleton" />}
            <div className="hidden h-3 w-24 rounded skeleton xl:block" />
            <div className="h-3 w-24 rounded skeleton" />
            <div className="h-6 w-[124px] rounded-full skeleton" />
            <div className="h-3 w-16 rounded skeleton" />
          </div>
        </div>
      ))}
    </div>
  )
}

// Chip neutro para la candidatura de prueba del onboarding (source 'prueba').
// Gris siempre: no es un estado, solo un origen; se borra cuando ya no hace falta.
function TestChip() {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full bg-slate-50 px-1.5 py-0.5 text-slate-500 ring-1 ring-inset ring-slate-200">
      Prueba
    </span>
  )
}

/**
 * BUSCAR EN EL PUESTO. Una lupa que se abre en campo, la PRIMERA de la franja y
 * desenrollando hacia la DERECHA (diseño de Mario, sep 2026).
 *
 * Estuvo al final de la fila y creciendo hacia la izquierda, con la lupa como tapa
 * derecha teñida de acento. Lo que cambia no es solo el sitio: buscar a una
 * persona es de lo que más se hace en esta pantalla, así que abre la franja, que
 * es el orden en que se trabaja (primero buscas y lo que quede lo recortas con los
 * filtros). Y creciendo hacia la derecha el campo se desenrolla hacia el hueco que
 * de verdad sobra, en vez de empujar a los filtros contra el filo.
 *
 * SIGUE PLEGÁNDOSE, y por lo de siempre: plegado deja el sitio a lo que se mira
 * más veces. **No se cierra si has escrito algo**, porque plegarlo con texto
 * dentro borraría un filtro sin decirlo. Escape con el campo vacío lo repliega.
 *
 * LO ÚNICO QUE SE MUEVE ES LO QUE APARECE: la lupa está ANCLADA en el mismo píxel
 * en los dos estados y lo que crece es el campo, que sale de detrás de ella. Es la
 * misma regla que ya gobernaba la versión anterior, solo que con el ancla en el
 * otro extremo. La curva es `--ease-standard` y no `--ease-out`: esto no reacciona
 * al dedo sobre sí mismo, TRANSFORMA una caja de un estado a otro.
 *
 * Y LA LUPA CAMBIA DE PAPEL CON EL ESTADO. Plegada es un CONTROL (pulsarla abre);
 * abierta no pliega nada, así que pasa a ser el ADORNO de dentro del campo, en
 * gris y sin caja, y deja pasar el click al propio campo. Una caja de acento que
 * no hace nada es un botón que miente. Con eso, escritorio y móvil pintan por fin
 * lo MISMO cuando el campo está abierto, y la rama de móvil se queda solo con lo
 * que de verdad la distingue: allí la fila es suya entera, así que no hay nada que
 * ahorrar plegándola y el campo entra abierto.
 *
 * No toca el mecanismo de tres ritmos del buscador (`search` urgente, `q` en
 * transición, `dq` con debounce): eso vive en la pantalla y aquí solo cambia CÓMO
 * se enseña el campo. El `value` sigue siendo el de la pantalla, así que plegar y
 * desplegar no pierde lo escrito.
 */
function BuscadorPuesto({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [abierto, setAbierto] = useState(false)
  const esMovil = useEsMovil()
  const ref = useRef<HTMLInputElement>(null)
  // En móvil no se pliega nunca: la fila es suya entera (ver arriba).
  const visible = esMovil || abierto || value.length > 0

  // El foco va en un efecto y NO en el propio click: `requestAnimationFrame`
  // programado dentro del manejador puede dispararse ANTES de que React comita el
  // render, y entonces el `ref` del campo todavía es null y el foco no llega a
  // ninguna parte. El efecto corre después del commit.
  useEffect(() => {
    if (abierto) ref.current?.focus()
  }, [abierto])

  return (
    <div className="relative flex min-w-0 flex-1 items-center sm:flex-none">
      {/* Lo que se anima es el ENVOLTORIO del campo; la lupa vive fuera de él y no
          se mueve un píxel. En móvil no hay animación que valga: el campo ocupa lo
          que sobra de la fila y ya está. */}
      <div
        style={{ transitionProperty: 'width' }}
        className={`min-w-0 flex-1 overflow-hidden transition-[width] duration-[var(--duration-max)] ease-[var(--ease-standard)] motion-reduce:transition-none sm:flex-none ${
          visible ? 'sm:w-64' : 'sm:w-10 sm:pointer-coarse:w-11'
        }`}
      >
        <input
          ref={ref}
          type="search"
          aria-label="Buscar candidatos"
          aria-hidden={!visible}
          tabIndex={visible ? 0 : -1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && !value) {
              e.stopPropagation()
              setAbierto(false)
            }
          }}
          onBlur={() => !value && setAbierto(false)}
          placeholder="Buscar..."
          // EL FILO ES EL MISMO QUE EL DEL BOTÓN (Mario, sep 2026): `slate-200`,
          // el hairline de la casa, y no el `slate-300` que traía de campo suelto.
          // Aquí el campo y la lupa son LA MISMA PIEZA en dos estados, así que un
          // borde medio tono más oscuro al abrirse se leía como si al desenrollarse
          // cambiara de material.
          //
          // Y va con `filo`, o sea a DOS MANOS, aunque sea un campo: la segunda se
          // retira sola al enfocar (`:not(:focus-visible)`), que es justo lo que le
          // faltaba al caso por el que los campos se quedaron con una mano. Aquí no
          // hay nada que tapar, porque el único cambio de color del borde es el del
          // foco. `outline-none` no se la lleva por delante: `.filo:not(...)` tiene
          // más especificidad, así que no depende del orden de emisión.
          //
          // El relleno izquierdo es el ancho de la lupa: el texto arranca donde
          // acaba ella, no debajo. Y la opacidad entra ANTES de que la caja termine
          // (`--duration-enter` contra `--duration-max`), o se leerían dos
          // movimientos en vez de uno. 16px de letra en táctil: por debajo de eso
          // iOS hace zoom al enfocar.
          className={`h-10 w-full rounded-lg filo bg-white pl-10 pr-10 text-sm text-slate-900 outline-none transition-opacity duration-[var(--duration-enter)] placeholder:text-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-inset focus:ring-indigo-500/40 motion-reduce:transition-none pointer-coarse:h-11 pointer-coarse:pl-11 pointer-coarse:pr-11 pointer-coarse:text-base ${
            visible ? 'opacity-100' : 'opacity-0'
          }`}
        />
      </div>
      {/* LA LUPA, ANCLADA, Y SUS DOS PAPELES.
          Plegada es UN BOTÓN DE LA FRANJA como cualquier otro (Mario, sep 2026):
          fondo blanco y filo, o sea `BTN_ICONO_FRANJA`, el mismo que el engranaje
          de la vista. Sin caja se leía como un adorno suelto en una fila donde
          todo lo demás es un control, y lo que se pulsa tiene que parecer que se
          pulsa.
          Abierta no pliega nada, así que pasa a ser el ADORNO de dentro del campo:
          sin caja, en gris y dejando pasar el click, que es lo que espera
          cualquiera que pulse un icono metido en una caja de texto.
          Los dos juegos de clases se eligen ENTEROS y no se pisan: fondo, anillo y
          talla son las mismas utilidades en los dos, y esas no se resuelven por el
          orden en que se escriben. */}
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-hidden={visible}
        tabIndex={visible ? -1 : 0}
        aria-label="Abrir el buscador de candidatos"
        title="Buscar candidatos"
        className={`absolute left-0 ${
          visible
            ? 'pointer-events-none inline-flex size-10 items-center justify-center pointer-coarse:size-11'
            : BTN_ICONO_FRANJA
        }`}
      >
        {/* LA TINTA DEL GLIFO ES LA MISMA EN LOS DOS ESTADOS (Mario, sep 2026), y
            por lo mismo que el filo: es una pieza que se desenrolla, no dos. Y es
            la de TODOS los glifos de un botón de icono (`ICONO_CONTROL`), porque
            una fila se lee por lo que tiene en común. Queda por encima del
            marcador de posición que tiene al lado, y está bien: el glifo se pulsa
            cuando el campo está plegado y el marcador no se pulsa nunca. */}
        <Search className={ICONO_CONTROL} aria-hidden />
      </button>

      {/* LA CRUZ DE VACIAR, y solo cuando hay algo que vaciar (Mario, sep 2026):
          un botón que no puede hacer nada es peor que ninguno, y con el campo
          vacío sería un glifo más en una fila que ya tiene cuatro.

          Es la misma pieza que la del buscador global (misma caja, mismo hover,
          mismo `aria-label`): vaciar un campo de búsqueda se hace igual en toda la
          app. No hace falta esconder la equis nativa de WebKit porque `index.css`
          ya se la quita a todo `input[type=search]`; si no, serían dos.

          NO PLIEGA EL CAMPO, y eso son dos cosas. Una: `preventDefault` en el
          `mousedown`, para que el campo no pierda el foco (sin eso, el `onBlur`
          con el campo ya vacío lo replegaría en el mismo gesto). Y otra: deja
          `abierto` puesto, porque acabas de vaciar para escribir otra cosa, no
          para cerrar. Para plegarlo están Escape y salirse.

          El objetivo de toque lo estira un `::after` invisible hasta el alto del
          campo, sin engordar un solo píxel lo que se ve: es el mismo recurso que
          la cápsula de estado del puesto, y vale siempre que una diana pequeña
          tiene que seguir siendo pequeña. */}
      {visible && value.length > 0 && (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            onChange('')
            setAbierto(true)
            ref.current?.focus()
          }}
          aria-label="Borrar la búsqueda"
          title="Borrar la búsqueda"
          // SIN FONDO (Mario, sep 2026): vive DENTRO de un campo, así que una
          // placa gris al pasar por encima es una caja dentro de otra caja a 4px
          // de su filo. El hover lo dice la TINTA, que es lo que ya hace la
          // estrella de favorito: el color se oscurece y la caja no aparece.
          className="group absolute right-1 grid size-8 place-items-center rounded-lg after:absolute after:-inset-1 after:content-[''] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500/40 pointer-coarse:right-1.5 pointer-coarse:after:-inset-1.5"
        >
          <X
            className={`${ICONO_CONTROL} transition-colors duration-[var(--duration-control)] group-hover:text-slate-900`}
            aria-hidden
          />
        </button>
      )}
    </div>
  )
}

/**
 * ACTIVOS / RECHAZADOS. En qué mitad de la lista estás (maquetación de Figma).
 *
 * No es un filtro más y por eso no vive en el menú de Filtros: "descartado" es el
 * único estado del que se sale por una DECISIÓN y no por avanzar, así que parte la
 * lista en dos montones que casi nunca se miran juntos. Los otros cuatro estados
 * siguen filtrándose desde Filtros, dentro del montón en el que estés.
 *
 * El conmutador lleva su cifra porque aquí el número SÍ cambia una decisión: dice
 * si merece la pena ir a mirar el otro montón. Es un `radiogroup` de verdad (dos
 * `<button role="radio">` con flechas), no dos botones sueltos: son dos estados
 * excluyentes de una misma cosa.
 */
function SwitchVista({
  vista,
  onChange,
  nActivos,
  nRechazados,
}: {
  vista: 'activos' | 'rechazados'
  onChange: (v: 'activos' | 'rechazados') => void
  nActivos: number
  nRechazados: number
}) {
  const opciones = [
    { value: 'activos' as const, label: 'Activos', n: nActivos },
    { value: 'rechazados' as const, label: 'Rechazados', n: nRechazados },
  ]
  // EL FOCO SIGUE A LO MARCADO, que es lo que distingue un `radiogroup` de dos
  // botones. Con `tabIndex` rotatorio, cambiar la seleccion y dejar el foco donde
  // estaba deja el anillo sobre una mitad que acaba de pasar a `tabIndex={-1}`: el
  // teclado dice una cosa y la pintura otra. Se guarda un `ref` por mitad y el foco
  // se mueve DESPUES del commit (`requestAnimationFrame`), porque en el momento del
  // manejador el `tabIndex` nuevo todavia no esta puesto.
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const mover = (dir: 1 | -1) => {
    const i = opciones.findIndex((o) => o.value === vista)
    const j = (i + dir + opciones.length) % opciones.length
    onChange(opciones[j].value)
    requestAnimationFrame(() => refs.current[j]?.focus())
  }
  return (
    // Caja RECTANGULAR con filo y divisoria interior, no una pastilla gris con un
    // botón blanco deslizándose dentro (Mario, ago 2026). Lo activo se dice con
    // TINTA de acento y su cifra rellena; lo inactivo, en tinta normal con la cifra
    // apagada. Sin fondo gris de carril: el filo ya cierra la caja, y un carril
    // teñido debajo de dos mitades blancas era una tercera superficie sin trabajo.
    // `overflow-clip` porque los hijos son cajas cuadradas que llegan al filo: en
    // la curva de la esquina se comerían el borde (misma razón que en la tabla).
    <div
      role="radiogroup"
      aria-label="Candidatos que ves"
      className="flex h-10 shrink-0 items-center overflow-clip rounded-lg filo bg-white shadow-control pointer-coarse:h-11"
    >
      {opciones.map((o, i) => {
        const activa = vista === o.value
        return (
          <button
            key={o.value}
            ref={(el) => { refs.current[i] = el }}
            type="button"
            role="radio"
            aria-checked={activa}
            tabIndex={activa ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); mover(1) }
              else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); mover(-1) }
            }}
            className={`flex h-full items-center gap-1.5 pl-3 pr-2 text-[13px] font-medium outline-none transition-colors duration-[var(--duration-control)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500/40 ${
              // La divisoria la pinta la mitad de la derecha: un `divide-x` en el
              // padre no serviría, porque el hijo activo pinta fondo encima.
              i > 0 ? 'border-l border-slate-200' : ''
            } ${activa ? 'bg-indigo-50/60 text-indigo-700' : 'text-slate-800 hover:bg-slate-50'}`}
          >
            {o.label}
            {/* La chapa del lado activo va en el acento porque es donde estás; la del
                otro, apagada. Es el único par de cifras de la pantalla y compara dos
                montones: aquí el número informa, no decora. */}
            <span
              className={`num grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-semibold ${
                activa ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {o.n}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/**
 * EL ESTADO DEL PUESTO, en la línea del título y como CONTROL.
 *
 * Antes solo se pintaba cuando NO estaba activo (una chapa "Pausado"/"Cerrado") y
 * para cambiarlo había que abrir Ajustes del puesto, bajar hasta "Acciones" y
 * pulsar allí: tres pasos para lo que decide si el enlace acepta gente y si el
 * proceso se está cobrando. Ahora se lee siempre y se cambia desde donde se lee.
 *
 * Es la cápsula verde del diseño: punto de color, palabra y chevron. Vive junto al
 * TÍTULO y no entre las acciones, que es lo que la separa de la pastilla de estado
 * de un candidato: aquella está siempre dentro de una fila de la tabla y esta
 * siempre pegada al nombre del puesto, en la franja de arriba. Aun así comparten
 * anatomía y el verde de "activo" es vecino del verde de "contratado" de la
 * columna Estado: si algún día se confunden, la salida es la forma (icono en vez
 * de punto), no otro tono.
 *
 * Pausar y cerrar NO son lo mismo y el menú lo dice donde se decide: pausar
 * detiene el enlace pero el proceso sigue abierto (y cobrándose), cerrar deja de
 * cobrar. Es la advertencia que la doctrina de precios exige en la interfaz.
 */
const ESTADO_PUESTO = {
  // Los fondos van al paso 200, no al 50 con el que nacieron. Medido: sobre la
  // página (#f9fafb) el 100 se queda en 1,05:1, o sea que la cápsula no llega a
  // leerse como una forma; el 200 da 1,16:1, tres veces la separación, y el texto
  // encima sigue en 5,91:1 (AA pide 4,5). Los tres suben a la vez: si solo subiera
  // el verde, "En línea" parecería de otra familia que "Pausado" y "Cerrado".
  // El hover es `brightness` y no el siguiente paso de la rampa (200 -> 300), que
  // era un salto entero y se leía como un cambio de estado en vez de como "puedes
  // pulsar esto". Es además el MISMO mecanismo que ya usan las pastillas de estado
  // de un candidato: un solo lenguaje de hover para todas las cápsulas teñidas.
  activa: { label: 'En línea', punto: 'bg-green-600', chapa: 'bg-green-200 text-green-900' },
  pausada: { label: 'Pausado', punto: 'bg-amber-600', chapa: 'bg-amber-200 text-amber-900' },
  cerrada: { label: 'Cerrado', punto: 'bg-slate-500', chapa: 'bg-slate-200 text-slate-800' },
} as const

const ORDEN_ESTADOS = ['activa', 'pausada', 'cerrada'] as const

function EstadoPuesto({
  status,
  canManage,
  cobraPorProceso,
  onPauseResume,
  onClosePuesto,
  onReopen,
}: {
  status: Campaign['status']
  canManage: boolean
  /** En el pago por proceso, pausar no deja de cobrar: hay que decirlo aquí. */
  cobraPorProceso: boolean
  onPauseResume: () => void
  onClosePuesto: () => void
  onReopen: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      btnRef.current?.focus()
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const e = ESTADO_PUESTO[status]
  // El encargado gestiona candidatos pero no el puesto (lo mismo que aplica la
  // RLS): para él esto es una etiqueta, no un mando. Un botón que no puede hacer
  // nada es peor que ningún botón.
  const cara = (
    <>
      <span className={`size-1.5 shrink-0 rounded-full ${e.punto}`} aria-hidden />
      <span className="sr-only">Estado del puesto: </span>
      {e.label}
    </>
  )
  // 28px A TODOS LOS ANCHOS, y es un número DERIVADO: es un ACCESORIO del título,
  // así que su tamaño sale del suyo. Estuvo en 24 mientras el `h1` estuvo en 24
  // (Mario, ago 2026: "pegada a un h1 de 24, una cápsula de 32 compite con el
  // nombre del puesto en vez de acompañarlo"), y sube con él a 28 en sep 2026:
  // lo que aquella medida protegía era la PROPORCIÓN, no el 24, y con el título
  // más grande la cápsula se había quedado pequeña al lado de lo que acompaña.
  // Sube entera, no solo la caja: letra a 13 y relleno a 12, o una cápsula más
  // alta con la misma letra dentro se lee como una caja con aire de más.
  // Sigue por debajo de los 40 de un botón de la fila de acciones, que es lo que
  // la mantiene siendo un accesorio y no un mando.
  //
  // El objetivo de toque no se pierde, se DESPEGA del dibujo: un `::after`
  // invisible estira el área pulsable hasta 44 sin engordar un solo píxel lo que
  // se ve (8 por arriba y 8 por abajo de los 28, medido). Es el mismo recurso que
  // ya usaba la pastilla de estado de la tarjeta de móvil, y la respuesta correcta
  // siempre que una diana pequeña tiene que seguir siendo pequeña.
  // El relleno horizontal NO va aquí: la cápsula tiene dos caras y solo una
  // acaba en chevron (ver `RELLENO`). `px-3` y `pr-2` son la misma utilidad y no
  // se resuelven por el orden en que se escriben, así que la salida es la de
  // siempre: el esqueleto no pone lo que una de las dos va a tener que anular.
  const forma = 'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full text-[13px] font-medium'
  // EL RELLENO SE MIDE HASTA LA TINTA, NO HASTA LA CAJA (Mario, sep 2026, sobre
  // la pastilla de estado de la tabla: "parece que hay más padding a la derecha").
  // El chevron de lucide dibuja su flecha en el 50% central de su viewBox, así que
  // uno de 14px deja 3,5 de aire dentro de su propia caja: con 12 a los dos lados,
  // la tinta acaba a 15,5 por la derecha y arranca a 12 por la izquierda. Donde
  // hay chevron se le descuentan esos 3,5 (12 - 3,5 ≈ 8); donde no lo hay (la
  // cápsula del encargado, que es una etiqueta y no un mando) el relleno es
  // simétrico, porque no hay nada que descontar.
  const RELLENO = { quieta: 'px-3', conChevron: 'pl-3 pr-2' }
  const diana = 'relative after:absolute after:-inset-x-1 after:-inset-y-2 after:content-[\'\'] sm:after:hidden'

  if (!canManage) {
    return <span className={`${forma} ${RELLENO.quieta} ${e.chapa}`}>{cara}</span>
  }

  // Qué SIGNIFICA cada estado, no qué botón pulsas. Es la diferencia entre este
  // menú y el de antes: escrito en paralelo, los tres se comparan de un vistazo y
  // la consecuencia de facturación viaja pegada a la opción que la causa, en vez
  // de en una nota al pie que se lee después de haber elegido.
  const descripcion = (v: Campaign['status']) => {
    if (v === 'activa') return 'El enlace está publicado y acepta candidaturas.'
    if (v === 'pausada') {
      return cobraPorProceso
        ? 'El enlace deja de aceptar candidaturas. El proceso sigue abierto y se sigue cobrando.'
        : 'El enlace deja de aceptar candidaturas. El proceso sigue abierto.'
    }
    return cobraPorProceso
      ? 'Deja de aceptar candidaturas y de cobrarse. Tus candidatos siguen aquí y puedes exportarlos.'
      : 'Deja de aceptar candidaturas. Tus candidatos siguen aquí y puedes exportarlos.'
  }

  // Desde CERRADO solo se puede volver reabriendo, que es una puerta de
  // facturación y siempre acaba en "en línea". Ofrecer "Pausado" desde ahí sería
  // prometer un salto que el store no hace: se enseña, apagado, con el motivo.
  const bloqueo = (v: Campaign['status']) =>
    status === 'cerrada' && v === 'pausada' ? 'Reábrelo primero' : null

  const elegir = (v: Campaign['status']) => {
    setOpen(false)
    if (v === status) return
    if (v === 'cerrada') return onClosePuesto()
    if (status === 'cerrada') return onReopen()
    // Entre "en línea" y "pausado" el salto es directo: no toca la facturación.
    onPauseResume()
  }

  // Flechas entre opciones, saltándose las apagadas: un menú se recorre con el
  // teclado o no es un menú.
  const mover = (desde: number, dir: 1 | -1) => {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]:not([disabled])') ?? [])
    if (!items.length) return
    const actual = items.findIndex((el) => el === document.activeElement)
    const base = actual < 0 ? desde : actual
    items[(base + dir + items.length) % items.length]?.focus()
  }

  return (
    <div className="relative" ref={ref}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`${forma} ${RELLENO.conChevron} ${diana} ${e.chapa} transition-[filter] duration-[var(--duration-control)] hover:brightness-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40`}
      >
        {cara}
        <ChevronDown className={`size-3.5 shrink-0 opacity-70 transition-transform duration-[var(--duration-control)] ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Estado del puesto"
          className="absolute left-0 z-50 mt-1.5 w-[19.5rem] overflow-clip rounded-xl filo bg-white p-1.5 shadow-pop"
        >
          {ORDEN_ESTADOS.map((v, i) => {
            const actual = v === status
            const motivo = bloqueo(v)
            return (
              <button
                key={v}
                type="button"
                role="menuitemradio"
                aria-checked={actual}
                disabled={!!motivo}
                onClick={() => elegir(v)}
                onKeyDown={(ev) => {
                  if (ev.key === 'ArrowDown') { ev.preventDefault(); mover(i, 1) }
                  else if (ev.key === 'ArrowUp') { ev.preventDefault(); mover(i, -1) }
                }}
                className={`block w-full rounded-lg px-2.5 py-2 text-left outline-none transition-colors duration-[var(--duration-control)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500/40 ${
                  actual
                    // El estado actual va en el acento: seleccionar es uno de los
                    // cuatro usos permitidos del ultramarine (acción, nav, foco y
                    // selección). Aquí es exactamente selección.
                    ? 'bg-indigo-50 text-indigo-700'
                    : motivo
                      ? 'cursor-not-allowed opacity-55'
                      : 'text-slate-800 hover:bg-slate-50'
                }`}
              >
                <span className="flex items-center gap-2 text-sm font-semibold">
                  {ESTADO_PUESTO[v].label}
                  {motivo && <span className="text-[11px] font-medium text-slate-500">({motivo})</span>}
                </span>
                <span className={`mt-0.5 block text-[12px] leading-relaxed ${actual ? 'text-indigo-600' : 'text-slate-500'}`}>
                  {descripcion(v)}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/**
 * EL MENÚ DEL PUESTO (el `···`). Referencia que dio Mario, ago 2026.
 *
 * Antes esto abría un MODAL de pantalla completa que mezclaba dos cosas que no se
 * parecen: verbos de un clic (duplicar, exportar, eliminar) y configuración con
 * selectores (sede, marca, un interruptor de avisos). Un modal es para configurar
 * varias cosas a la vez; para ejecutar UNA acción es un peaje.
 *
 * Las cuatro reglas que se sacaron de la referencia y que gobiernan esta pieza:
 *
 * 1. **Un ítem de menú es un VERBO y al pulsarlo el menú se cierra.** Es el reverso
 *    exacto del menú de estado del título, donde eliges un ESTADO y te quedas en
 *    él. Por eso los avisos ya no son un interruptor metido en una lista: son
 *    "Activar avisos" / "Desactivar avisos", nombrados por su efecto. Un
 *    interruptor dentro de un menú es la mezcla de los dos y por eso se sentía raro.
 * 2. **`›` y `↗` significan cosas distintas y no se intercambian.** `›` es "aquí
 *    dentro hay más que elegir" (Sede); `↗` es "esto te saca de la app" (ver el
 *    formulario público). Tener dos glifos y usarlos con criterio ahorra la
 *    sorpresa de que algo abra una pestaña sin avisar.
 * 3. **El menú es el INVENTARIO completo; los botones de la cabecera son atajos.**
 *    Por eso "Editar formulario" está en los dos sitios y no es un descuido: quien
 *    no encuentre el botón, lo encuentra aquí. (Lo que NO se repite es el estado:
 *    su selector es una pieza rica que vive pegada al título, a dos dedos.)
 * La MARCA no se movió aquí: ya se elegía en el bloque Identidad del constructor
 * ("Marca de este puesto"), que es donde se ve la cara del formulario. La del modal
 * era un duplicado y se borró. La SEDE sí vive aquí, como submenú, porque es
 * literalmente un "elige uno de varios" y ese es el patrón del `›`.
 */
function PuestoMenu({
  campaign,
  sites,
  canManage,
  editHref,
  publicUrl,
  exportCount,
  exportTotal,
  onExport,
  conDocumentos,
  onSetSite,
  onToggleNotify,
  onDuplicate,
  duplicating,
  onDelete,
}: {
  campaign: Campaign
  sites: Site[]
  canManage: boolean
  editHref: string
  publicUrl: string
  exportCount: number
  exportTotal: number
  onExport: (formato: FormatoExport) => void | Promise<void>
  /** Cuántos de los exportables traen CV. Si es 0, el zip no se ofrece. */
  conDocumentos: number
  onSetSite: (siteId: string | null) => void
  onToggleNotify: () => void
  onDuplicate: () => void
  duplicating: boolean
  /** Refrescar vivía en la barra de filtros hasta ago 2026. No actúa sobre la
   *  VISTA (qué ves) sino sobre los DATOS (traer lo que haya nuevo), o sea que es
   *  un verbo, y los verbos del puesto viven aquí. */
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  // El submenú de sede no es otra capa flotante: es la MISMA caja enseñando otra
  // página, con su fila de volver. Una segunda capa colgando de la primera se sale
  // de la pantalla en cuanto el menú está pegado al filo derecho, y en móvil (donde
  // esto es una hoja) no tendría dónde ponerse.
  const [pagina, setPagina] = useState<'raiz' | 'sede' | 'exportar'>('raiz')
  // Cuál de los submenús laterales está abierto. Vive AQUÍ y no en cada fila: es
  // lo que los hace excluyentes (ver `useSubmenu`).
  const submenu = useSubmenu()
  const [sedesOpen, setSedesOpen] = useState(false)
  const [sedesKey, setSedesKey] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  // La hoja de móvil se MONTA solo en móvil, no se esconde con `sm:hidden`.
  // `BottomSheet` registra su Escape en el documento y atrapa el Tab mientras está
  // abierta: montada y oculta en escritorio se tragaba el Escape del submenú (que
  // debe volver atrás, no cerrar) y encima mandaba el foco a elementos en
  // `display:none`, donde `focus()` no hace nada y el tabulador se queda muerto.
  // Mismo patrón que `ShareMenu`, que ya tenía este problema resuelto.
  const isMobile = useEsMovil()

  const cerrar = useCallback(() => {
    setOpen(false)
    // La página vuelve a la raíz al cerrar, no al abrir: si se hiciera al abrir se
    // vería el salto de vuelta durante la animación de cierre.
    setPagina('raiz')
  }, [])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && cerrar()
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // Escape dentro del submenú vuelve a la raíz; en la raíz, cierra. Así no se
      // sale de todo por querer deshacer un paso.
      if (pagina !== 'raiz') {
        e.stopPropagation()
        setPagina('raiz')
        return
      }
      cerrar()
      btnRef.current?.focus()
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, pagina, cerrar])

  // El diálogo se remonta en cada apertura (`key`) para que no arrastre lo que
  // dejaste escrito o la fila que estabas editando la vez anterior.
  const abrirSedes = () => {
    setSedesKey((k) => k + 1)
    setSedesOpen(true)
  }
  // Creada desde aquí, la sede se asigna a este puesto y se cierra todo: entrar
  // por el submenú Sede es querer ponerle una a ESTE puesto, no administrar la
  // lista. Administrarla es lo que hace el resto del diálogo.
  const alCrearSede = (site: Site) => {
    onSetSite(site.id)
    setSedesOpen(false)
    cerrar()
  }

  const avisos = campaign.notifyNew !== false
  const sede = sites.find((x) => x.id === campaign.siteId) ?? null


  const raiz = (flotante: boolean) => (
    <>
      {/* EL FORMULARIO: EDITARLO Y VERLO, JUNTOS Y EN ESE ORDEN (Mario, ago 2026).
          Son las dos caras de la misma cosa, y con una raya y "Duplicar" en medio
          había que buscar la segunda. Primero se toca y después se comprueba, que
          es también el orden en que se hacen.

          El grupo se pinta SIEMPRE aunque sus filas estén acotadas por permiso:
          "Ver el formulario" es de todos (el encargado también tiene que poder
          abrirlo), y al meterlo dentro del `canManage &&` que envolvía al bloque
          se le habría quitado sin que nadie lo pidiera. Cada fila se acota sola. */}
      <div className="space-y-0.5 pb-1.5">
        {canManage && (
          <Link to={editHref} onClick={cerrar} className={`${FILA} ${QUIETA}`}>
            <PenLine className={GLIFO} aria-hidden /> Editar
          </Link>
        )}
        {/* `↗` y `rel="noreferrer"`: sale de la app y abre pestaña. El texto dice
            a dónde va, el glifo dice que se va. */}
        <a
          href={publicUrl}
          target="_blank"
          rel="noreferrer"
          onClick={cerrar}
          className={`${FILA} ${QUIETA}`}
        >
          <Eye className={GLIFO} aria-hidden />
          <span className="flex-1">Ver formulario</span>
          <ArrowUpRight className="size-3.5 shrink-0 text-slate-400" aria-hidden />
          <span className="sr-only">(se abre en otra pestaña)</span>
        </a>
        {canManage && (
          <button
            type="button"
            onClick={() => { cerrar(); onDuplicate() }}
            disabled={duplicating}
            className={`${FILA} ${QUIETA} disabled:opacity-60`}
          >
            <Copy className={GLIFO} aria-hidden /> {duplicating ? 'Duplicando…' : 'Duplicar puesto'}
          </button>
        )}
      </div>

      <div className="space-y-0.5 border-t border-slate-100 py-1.5">
        {/* EXPORTAR ES UNA PUERTA, NO UN VERBO (Mario, ago 2026). Era "Exportar a
            Excel" y ejecutaba; ahora abre su submenú, porque hay TRES formatos y
            cuál quieres depende de a dónde va: XLSX para abrirlo, CSV para meterlo
            en otro programa, ZIP para los documentos.

            SIN RECUENTO EN LA FILA (Mario, ago 2026). Lo llevó, y era la misma
            cifra dos veces: dentro ya está, en el rótulo que dice qué te llevas
            ("La lista filtrada (127)"). Se puso aquí cuando entrar costaba un
            click y volver otro; abriéndose al pasar por encima, el dentro está a
            un gesto que ya estabas haciendo. */}
        {flotante ? (
          <FilaSubmenu
            id="Exportar"
            abierto={submenu.abierto === 'Exportar'}
            onAbrir={submenu.onAbrir}
            onCerrarTarde={submenu.onCerrarTarde}
            onCerrarYa={submenu.onCerrarYa}
            icon={Download}
            label="Exportar"
          >
            {contenidoExportar}
          </FilaSubmenu>
        ) : (
          <button
            type="button"
            onClick={() => setPagina('exportar')}
            aria-haspopup="menu"
            className={`${FILA} ${QUIETA}`}
          >
            <Download className={GLIFO} aria-hidden />
            <span className="flex-1">Exportar</span>
            <ChevronRight className="size-3.5 shrink-0 text-slate-400" aria-hidden />
          </button>
        )}
      </div>

      {canManage && (
        <div className="space-y-0.5 border-t border-slate-100 py-1.5">
          {/* "Elige uno de varios" = `›`. El valor actual se lee EN la fila, sin
              tener que entrar: la fila informa además de llevar. */}
          {flotante ? (
            <FilaSubmenu
              id="Sede"
              abierto={submenu.abierto === 'Sede'}
              onAbrir={submenu.onAbrir}
              onCerrarTarde={submenu.onCerrarTarde}
              onCerrarYa={submenu.onCerrarYa}
              icon={Building2}
              label="Sede"
              valor={<span className="max-w-[9rem] truncate text-[12px] text-slate-500">{sede?.name ?? 'Sin sede'}</span>}
            >
              {contenidoSede}
            </FilaSubmenu>
          ) : (
            <button
              type="button"
              onClick={() => setPagina('sede')}
              aria-haspopup="menu"
              className={`${FILA} ${QUIETA}`}
            >
              <Building2 className={GLIFO} aria-hidden />
              <span className="flex-1">Sede</span>
              <span className="max-w-[9rem] truncate text-[12px] text-slate-500">{sede?.name ?? 'Sin sede'}</span>
              <ChevronRight className="size-3.5 shrink-0 text-slate-400" aria-hidden />
            </button>
          )}
          {/* Nombrado por su EFECTO, no por su asunto: en un menú se ejecuta. */}
          <button
            type="button"
            onClick={() => { cerrar(); onToggleNotify() }}
            className={`${FILA} ${QUIETA}`}
          >
            {avisos ? <BellOff className={GLIFO} aria-hidden /> : <Bell className={GLIFO} aria-hidden />}
            {avisos ? 'Desactivar avisos por email' : 'Activar avisos por email'}
          </button>
        </div>
      )}

      {canManage && (
        <div className="space-y-0.5 border-t border-slate-100 pt-1.5">
          <button
            type="button"
            onClick={() => { cerrar(); onDelete() }}
            className={`${FILA} text-red-700 hover:bg-red-50`}
          >
            <Trash2 className="size-4 shrink-0 text-red-500" aria-hidden /> Eliminar puesto
          </button>
        </div>
      )}

    </>
  )

  /**
   * LA PÁGINA DE EXPORTAR. Dos grupos, y el rótulo dice QUÉ te llevas, no en qué
   * formato: "la lista" y "los documentos" son dos cosas distintas, y el formato
   * es un detalle de cada una.
   *
   * El ZIP **solo aparece si hay algún CV**. Sin documentos, una fila que no
   * puede hacer nada es una puerta pintada en la pared; con ella fuera, quien no
   * pide CV en su formulario no ve nunca el concepto.
   */
  const contenidoExportar = (
    <>
      <div className="space-y-0.5">
        <p className="px-2.5 pb-1 pt-1 text-[12px] text-slate-500">
          La lista {exportCount === exportTotal ? 'completa' : `filtrada (${miles(exportCount)})`}
        </p>
        <button type="button" onClick={() => { void onExport('xlsx'); cerrar() }} className={`${FILA} ${QUIETA}`}>
          <FileSpreadsheet className={GLIFO} aria-hidden />
          <span className="flex-1">Excel (.xlsx)</span>
        </button>
        <button type="button" onClick={() => { void onExport('csv'); cerrar() }} className={`${FILA} ${QUIETA}`}>
          <FileText className={GLIFO} aria-hidden />
          <span className="flex-1">CSV</span>
        </button>
      </div>
      {conDocumentos > 0 && (
        <div className="mt-1 space-y-0.5 border-t border-slate-100 pt-1.5">
          {/* EL RÓTULO DICE DE QUIÉN SON, porque la cifra es de PERSONAS y no de
              ficheros: cuántos documentos hay no se sabe sin ir a buscarlos, y
              esta fila no puede pagar una consulta para pintarse. Decía "Los
              documentos (27)" con 27 = candidatos con CV, que es la clase de
              número que se lee como otra cosa. Lo que sí sale exacto es el
              recuento del final, cuando el zip ya está hecho. */}
          <p className="px-2.5 pb-1 pt-1 text-[12px] text-slate-500">
            Los documentos de {miles(conDocumentos)} {conDocumentos === 1 ? 'candidato' : 'candidatos'}
          </p>
          <button type="button" onClick={() => { void onExport('zip'); cerrar() }} className={`${FILA} ${QUIETA}`}>
            <FileArchive className={GLIFO} aria-hidden />
            <span className="flex-1">CV y adjuntos (.zip)</span>
          </button>
        </div>
      )}
    </>
  )

  const contenidoSede = (
    <>
      <div className="space-y-0.5">
        {[null, ...sites.map((x) => x.id)].map((id) => {
          const s = id ? sites.find((x) => x.id === id) : null
          const elegida = (campaign.siteId ?? null) === id
          return (
            <button
              key={id ?? 'sin-sede'}
              type="button"
              role="menuitemradio"
              aria-checked={elegida}
              onClick={() => { onSetSite(id); cerrar() }}
              className={`${FILA} ${elegida ? 'bg-indigo-50 text-indigo-700' : QUIETA}`}
            >
              <Check className={`size-4 shrink-0 ${elegida ? 'text-indigo-600' : 'text-transparent'}`} aria-hidden />
              <span className="min-w-0 flex-1 truncate">{s ? s.name : 'Sin sede'}</span>
              {/* La ciudad solo si añade algo: casi todas las sedes se llaman como
                  su ciudad, y "Valencia Valencia" es la misma palabra dos veces. */}
              {s?.city && s.city.trim().toLowerCase() !== s.name.trim().toLowerCase() && (
                <span className="shrink-0 text-[12px] text-slate-500">{s.city}</span>
              )}
            </button>
          )
        })}
      </div>
      <div className="mt-1 border-t border-slate-100 pt-1.5">
        {/* Una sola fila, y su nombre depende de si hay algo que gestionar: sin
            sedes lo único que puedes hacer es crear la primera, y con sedes la
            misma puerta lleva además a renombrarlas y borrarlas. */}
        <button type="button" onClick={abrirSedes} className={`${FILA} ${QUIETA}`}>
          {sites.length === 0 ? (
            <>
              <Plus className={GLIFO} aria-hidden /> Crear sede
            </>
          ) : (
            <>
              <Settings2 className={GLIFO} aria-hidden /> Gestionar sedes
            </>
          )}
        </button>
      </div>
    </>
  )

  /**
   * En MÓVIL el submenú sigue siendo otra página de la misma hoja, con su fila de
   * volver: un panel lateral no tiene dónde ponerse en 375px. El CONTENIDO es el
   * mismo que el del flyout de escritorio, así que no puede separarse.
   */
  const pagina2 = (titulo: string, contenido: ReactNode) => (
    <>
      <button type="button" onClick={() => setPagina('raiz')} className={`${FILA} ${QUIETA} font-medium`}>
        <ChevronLeft className={GLIFO} aria-hidden /> {titulo}
      </button>
      <div className="mt-1 border-t border-slate-100 pt-1.5">{contenido}</div>
    </>
  )
  const cuerpoMovil = pagina === 'sede'
    ? pagina2('Sede', contenidoSede)
    : pagina === 'exportar'
      ? pagina2('Exportar', contenidoExportar)
      : raiz(false)

  return (
    <div className="relative" ref={ref}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => (open ? cerrar() : setOpen(true))}
        aria-haspopup="menu"
        aria-expanded={open}
        // `botonIcono` y NO `BTN_SECONDARY + px-0`: `px-0` y el `px-3.5` que ya
        // trae la clase son la MISMA utilidad, así que gana la que Tailwind emita
        // después, no la que se escriba al final. Ganaba el 3.5, la caja de
        // contenido se quedaba en 8px y el svg, como hijo flex, se encogía a la
        // mitad: por eso los tres puntos se veían como unos suspensivos flojos y
        // no como un icono. La pieza existe justo para no repetir este fallo.
        // 40 y no 36 (Mario, sep 2026): el mismo tamaño que el engranaje de la
        // franja de abajo. La cabecera dejó de ser la fila de los controles
        // pequeños, así que su botón mide lo que mide un control de pantalla.
        className={`${BTN_ICONO_FRANJA} ${open ? 'bg-slate-50' : ''}`}
        title="Más acciones"
        aria-label="Más acciones del puesto"
      >
        {/* Tres puntos horizontales, pero RELLENOS. El icono de lucide dibuja tres
            `circle` con `fill="none"`, o sea tres AROS de 0,67px de radio trazados
            a 1,75: a 16px eso no se lee como tres puntos, se lee como unos puntos
            suspensivos desvaídos, que es justo lo que Mario veía. Con
            `fill-current` pasan a ser discos sólidos y el glifo recupera su peso.
            Es un ajuste del RELLENO, no del trazo: la regla del grosor único
            (`--stroke-icon`) sigue intacta. */}
        <MoreHorizontal className={`${ICONO_CONTROL} [&_circle]:fill-current`} aria-hidden />
      </button>

      {/* Escritorio: desplegable anclado al botón y alineado a la derecha, que es
          donde está el botón: abriendo a la izquierda se saldría de la pantalla. */}
      {open && (
        <div
          role="menu"
          aria-label="Acciones del puesto"
          className="absolute right-0 z-50 mt-1.5 hidden w-72 overflow-clip rounded-xl filo bg-white p-1.5 shadow-pop sm:block"
        >
          {raiz(true)}
        </div>
      )}

      {/* Móvil: hoja inferior, la misma lista. */}
      {isMobile && (
        <BottomSheet open={open} onClose={cerrar} title={pagina === 'sede' ? 'Sede' : pagina === 'exportar' ? 'Exportar' : 'Acciones del puesto'} inert={sedesOpen}>
          <div className="px-2 pb-3 pt-1">{cuerpoMovil}</div>
        </BottomSheet>
      )}

      <SedesDialog key={sedesKey} open={sedesOpen} onClose={() => setSedesOpen(false)} alCrear={alCrearSede} />
    </div>
  )
}

function ShareMenu({
  campaignId,
  title,
  url,
  urlDisplay,
  template,
  canEdit,
  demo,
}: {
  campaignId: string
  title: string
  url: string
  urlDisplay: string
  template?: string | null
  canEdit: boolean
  demo: boolean
}) {
  const { updateCampaign } = useStore()
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const isMobile = useEsMovil()

  const close = () => {
    setOpen(false)
    window.requestAnimationFrame(() => buttonRef.current?.focus())
  }

  useLayoutEffect(() => {
    if (!open) {
      setPos(null)
      return
    }
    const place = () => {
      const el = ref.current
      if (!el) return
      const r = el.getBoundingClientRect()
      setPos({ top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right) })
    }
    place()
    window.addEventListener('resize', place)
    // El main scrollea: hay que reposicionar o el panel se queda huérfano.
    const main = document.getElementById('contenido')
    main?.addEventListener('scroll', place, { passive: true })
    return () => {
      window.removeEventListener('resize', place)
      main?.removeEventListener('scroll', place)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    // pointerdown (no click): al pulsar Editar el botón se desmonta en el mismo
    // evento y contains(target) falla con nodos ya desconectados. composedPath
    // conserva el panel aunque React reemplace el botón. El blur del textarea
    // ocurre antes y guarda la plantilla.
    const onDoc = (e: PointerEvent) => {
      const path = e.composedPath()
      if (path.includes(ref.current!) || path.includes(panelRef.current!)) return
      close()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('pointerdown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        // Compartir es la acción de acento del puesto (Figma, ago 2026): lo que
        // pone el puesto en marcha es que el enlace llegue a la gente, no editar
        // el formulario. Editar baja a secundario, a su lado.
        // EN MÓVIL LLEVA SU PALABRA, NO SU DIBUJO (Mario, ago 2026). Estaba al
        // revés: un cuadrado de 44 con el glifo de compartir y el nombre escondido.
        // Un icono hay que aprendérselo y este además no es universal (el de iOS es
        // otro), mientras que "Compartir" se lee sin aprender nada; y la fila tiene
        // sitio de sobra, que era el único motivo para encogerlo. Se van con el
        // dibujo el chevron, que en móvil no anuncia un desplegable sino una hoja.
        // A la altura de un control de pantalla, como el `···` que tiene al lado:
        // una fila se lee por su línea de base común, y un botón de 36 junto a
        // uno de 40 se ve hundido.
        className={BTN_PRIMARY_FRANJA}
        title="Compartir"
        aria-label="Compartir"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Share2 className="size-4 shrink-0 text-indigo-200 max-sm:hidden" aria-hidden />
        <span>Compartir</span>
        <ChevronDown
          className={`size-3.5 shrink-0 text-indigo-200 transition-transform duration-[var(--duration-control)] max-sm:hidden ${
            open ? 'rotate-180' : ''
          }`}
          aria-hidden
        />
      </button>
      {/* Escritorio: fixed para no recortar con overflow del main. */}
      <AnimatePresence>
        {open && pos && !isMobile && (
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="false"
            aria-label="Compartir puesto"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15, ease: [0, 0, 0.2, 1] }}
            style={{ top: pos.top, right: pos.right }}
            className="fixed z-50 hidden w-[min(100vw-1.5rem,25rem)] rounded-xl filo bg-white p-4 shadow-pop sm:block"
          >
            <ShareReply
              title={title}
              url={url}
              urlDisplay={urlDisplay}
              demo={demo}
              variant="popover"
              template={template}
              onSaveReply={
                canEdit
                  ? (reply) => updateCampaign(campaignId, { shareReply: reply })
                  : undefined
              }
              onClose={close}
            />
          </motion.div>
        )}
      </AnimatePresence>
      {/* Móvil: hoja inferior (mismo patrón que Filtros) */}
      {isMobile && (
        <BottomSheet open={open} onClose={close} title="Compartir">
          <ShareReply
            title={title}
            url={url}
            urlDisplay={urlDisplay}
            demo={demo}
            variant="sheet"
            template={template}
            onSaveReply={
              canEdit
                ? (reply) => updateCampaign(campaignId, { shareReply: reply })
                : undefined
            }
          />
        </BottomSheet>
      )}
    </div>
  )
}

function EmptyFirstUse({ publicUrl, onCopy }: { publicUrl: string; onCopy: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <IconoVacio Icon={Inbox} />
      <h3 className="mt-4 text-lg font-semibold text-slate-900">Aún no hay candidatos</h3>
      <p className="mt-1 max-w-sm text-sm text-slate-500">
        Comparte el enlace del formulario para empezar a recibir respuestas. Cada respuesta entra aquí automáticamente.
      </p>
      {/* w-full + max-w para que la fila se ciña al ancho del card y el enlace se
          trunque (en una columna items-center, sin ancho fijo, no truncaría y se
          saldría). El enlace va discreto (más pequeño y tenue): manda la acción. */}
      <div className="mt-4 flex w-full max-w-md items-center gap-2 rounded-xl filo bg-slate-50 py-1.5 pl-3.5 pr-1.5">
        <span className="min-w-0 flex-1 truncate text-[13px] text-slate-500">{publicUrl}</span>
        <button onClick={onCopy} className={`${BTN_PRIMARY_SM} shrink-0`}>
          Copiar enlace
        </button>
      </div>
    </div>
  )
}

function EmptyNoResults({ search, hasFilters, onClear }: { search: string; hasFilters: boolean; onClear: () => void }) {
  const onlySearch = !!search && !hasFilters
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <IconoVacio Icon={SearchX} />
      <h3 className="mt-4 text-lg font-semibold text-slate-900">Ningún candidato coincide</h3>
      <p className="mt-1 text-sm text-slate-500">
        {onlySearch
          ? `Sin resultados para “${search}”. Prueba con menos palabras.`
          : search
            ? `Sin resultados para “${search}” con estos filtros.`
            : 'Ningún candidato encaja con estos filtros.'}
      </p>
      <button onClick={onClear} className={`${BTN_SECONDARY} mt-4`}>
        {onlySearch ? 'Borrar búsqueda' : 'Limpiar filtros'}
      </button>
    </div>
  )
}

function SaveViewDialog({
  open,
  onClose,
  onSave,
  hasValueFilters,
  valueFilterLabels,
  campaignTitle,
}: {
  open: boolean
  onClose: () => void
  onSave: (name: string, scope: 'global' | 'campaign') => void
  hasValueFilters: boolean
  valueFilterLabels: string[]
  campaignTitle: string
}) {
  const [name, setName] = useState('')
  const [scope, setScope] = useState<'global' | 'campaign'>('global')

  useEffect(() => {
    if (open) {
      setName('')
      setScope(hasValueFilters ? 'campaign' : 'global')
    }
  }, [open, hasValueFilters])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null
  const effectiveScope: 'global' | 'campaign' = hasValueFilters ? 'campaign' : scope
  const canSave = name.trim().length > 0
  const submit = () => canSave && onSave(name.trim(), effectiveScope)

  return (
    <div className="fixed inset-0 z-[55] grid place-items-center p-4" role="dialog" aria-modal="true" aria-labelledby="saveview-title">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-xl bg-white p-5 shadow-pop">
        <h2 id="saveview-title" className="text-lg font-semibold text-slate-900">Guardar vista</h2>
        <p className="mt-0.5 text-[13px] text-slate-500">
          Ponle nombre a esta combinación de filtros para reaplicarla de un clic.
        </p>

        <label htmlFor="viewname" className="mt-4 block text-sm font-semibold text-slate-800">Nombre</label>
        <input
          id="viewname"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          autoFocus
          placeholder="ej: sin contactar esta semana"
          className="mt-1.5 h-9 w-full rounded-xl border border-slate-300 px-3 text-sm text-slate-900 outline-none transition-shadow placeholder:text-slate-500 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15"
        />

        <div className="mt-4">
          <p className="text-sm font-semibold text-slate-800">Dónde se aplica</p>
          {hasValueFilters ? (
            <p className="mt-1.5 rounded-xl bg-slate-50 px-3 py-2.5 text-[13px] leading-relaxed text-slate-600">
              Esta vista incluye filtros de {valueFilterLabels.join(', ')}, que dependen de los campos de este formulario.
              Por eso se guarda solo en <strong className="font-semibold text-slate-800">{campaignTitle}</strong>.
            </p>
          ) : (
            <div className="mt-2 space-y-1.5">
              <label className="flex cursor-pointer items-start gap-2.5 rounded-xl filo px-3 py-2.5 hover:bg-slate-50">
                <input type="radio" name="viewscope" checked={scope === 'global'} onChange={() => setScope('global')} className="mt-0.5 size-4 border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                <span>
                  <span className="block text-sm font-medium text-slate-800">En todos mis puestos</span>
                  <span className="block text-[12px] text-slate-500">Búsqueda, estado y orden. Aparece en cualquier puesto.</span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2.5 rounded-xl filo px-3 py-2.5 hover:bg-slate-50">
                <input type="radio" name="viewscope" checked={scope === 'campaign'} onChange={() => setScope('campaign')} className="mt-0.5 size-4 border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                <span>
                  <span className="block text-sm font-medium text-slate-800">Solo en este puesto</span>
                  <span className="block text-[12px] text-slate-500">Aparece solo en {campaignTitle}.</span>
                </span>
              </label>
            </div>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className={BTN_SECONDARY}>
            Cancelar
          </button>
          <button onClick={submit} disabled={!canSave} className={`${BTN_PRIMARY} disabled:opacity-50`}>
            Guardar vista
          </button>
        </div>
      </div>
    </div>
  )
}

