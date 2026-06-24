// Botón "instrumento de precisión": secundario blanco con hairline + sombra
// mínima; primario ULTRAMARINE sólido con un filo de luz superior (inset 1px) y
// un anillo interno oscuro a 1px (tacto "mecanizado", no caramelo). Radio 8px.
// Alto compacto (36px) en escritorio; en punteros táctiles (móvil/tablet) sube a
// 44px (`pointer-coarse:min-h-11`) para que el objetivo de toque cumpla el mínimo,
// sin tocar la densidad de escritorio. Mismo criterio que el 16px de inputs en táctil.
// Transición acotada a color/sombra/transform (nunca layout); foco lo cubre :focus-visible.
export const BTN_SECONDARY =
  'inline-flex h-9 pointer-coarse:min-h-11 items-center justify-center gap-1.5 rounded-lg bg-white px-3 text-sm font-medium text-slate-800 ring-1 ring-slate-300/80 shadow-[0_1px_2px_rgba(18,22,34,0.06)] transition-[background-color,box-shadow,transform] duration-150 ease-[var(--ease-out)] hover:bg-slate-50 hover:ring-slate-300 active:translate-y-px active:shadow-none'

export const BTN_PRIMARY =
  'inline-flex h-9 pointer-coarse:min-h-11 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white ring-1 ring-inset ring-indigo-800/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_1px_2px_rgba(18,22,34,0.24)] transition-[background-color,box-shadow,transform] duration-150 ease-[var(--ease-out)] hover:bg-indigo-700 active:translate-y-px active:shadow-[inset_0_1px_2px_rgba(15,20,60,0.35)]'

// Botón destructivo del sistema (acción clara con borde + icono, nunca solo color):
// mismo patrón que BTN_SECONDARY pero en rojo de peligro. Una sola fuente de verdad
// para alto/radio/sombra; no recrear con valores sueltos en cada pantalla.
export const BTN_DANGER =
  'inline-flex h-9 pointer-coarse:min-h-11 items-center justify-center gap-1.5 rounded-lg bg-white px-3 text-sm font-medium text-red-600 ring-1 ring-red-200 shadow-[0_1px_2px_rgba(18,22,34,0.06)] transition-[background-color,box-shadow,transform] duration-150 ease-[var(--ease-out)] hover:bg-red-50 active:translate-y-px active:shadow-none'

// Variantes grandes (h-12) para los CTA de la landing: mismo lenguaje "instrumento"
// (relieve nítido) que el resto, solo que más grandes. Añade `group` en el sitio
// de uso si el icono lleva el desplazamiento al hover.
export const BTN_PRIMARY_LG =
  'inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-6 text-base font-semibold text-white ring-1 ring-inset ring-indigo-800/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_1px_2px_rgba(18,22,34,0.24)] transition-[background-color,box-shadow,transform] duration-150 ease-[var(--ease-out)] hover:bg-indigo-700 active:translate-y-px'

export const BTN_SECONDARY_LG =
  'inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-white px-5 text-base font-semibold text-slate-800 ring-1 ring-slate-300/80 shadow-[0_1px_2px_rgba(18,22,34,0.06)] transition-[background-color,box-shadow,transform] duration-150 ease-[var(--ease-out)] hover:bg-slate-50 hover:ring-slate-300 active:translate-y-px'

// CTA claro sobre bloque oscuro (CTA final del landing).
export const BTN_INVERTED_LG =
  'inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-white px-6 text-base font-semibold text-slate-900 shadow-[0_1px_2px_rgba(18,22,34,0.24)] transition-[background-color,transform] duration-150 ease-[var(--ease-out)] hover:bg-slate-100 active:translate-y-px'

// Variante compacta (h-8) del primario, para botones inline dentro de pills/grupos
// estrechos (p. ej. "Copiar enlace" junto a una URL), donde el h-9 queda grande.
export const BTN_PRIMARY_SM =
  'inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-[13px] font-semibold text-white ring-1 ring-inset ring-indigo-800/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_1px_2px_rgba(18,22,34,0.24)] transition-[background-color,box-shadow,transform] duration-150 ease-[var(--ease-out)] hover:bg-indigo-700 active:translate-y-px active:shadow-[inset_0_1px_2px_rgba(15,20,60,0.35)]'
