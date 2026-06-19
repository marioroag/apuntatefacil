// Estilo de botón "con relieve" tipo Shopify, en ÍNDIGO (decisión de Mario):
// secundario claro con borde + sombra suave; primario índigo con degradado sutil,
// brillo superior interno y sombra. Excepción consciente a la doctrina plana,
// usado en el panel y en el menú lateral.
// Alto compacto (36px) en escritorio; en punteros táctiles (móvil/tablet) sube a
// 44px (`pointer-coarse:min-h-11`) para que el objetivo de toque cumpla el mínimo,
// sin tocar la densidad de escritorio. Mismo criterio que el 16px de inputs en táctil.
export const BTN_SECONDARY =
  'inline-flex h-9 pointer-coarse:min-h-11 items-center justify-center gap-1.5 rounded-[10px] bg-white px-3 text-sm font-medium text-slate-800 ring-1 ring-slate-300/70 shadow-[0_1px_2px_rgba(16,24,40,0.07)] transition hover:bg-slate-50 active:translate-y-px active:shadow-none'

export const BTN_PRIMARY =
  'inline-flex h-9 pointer-coarse:min-h-11 items-center justify-center gap-1.5 rounded-[10px] bg-indigo-600 bg-gradient-to-b from-indigo-500 to-indigo-600 px-4 text-sm font-semibold text-white ring-1 ring-inset ring-indigo-700/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_1px_2px_rgba(30,27,75,0.35)] transition hover:to-indigo-700 active:translate-y-px active:shadow-[inset_0_1px_3px_rgba(30,27,75,0.4)]'

// Variante compacta (h-8) del primario, para botones inline dentro de pills/grupos
// estrechos (p. ej. "Copiar enlace" junto a una URL), donde el h-9 queda grande.
export const BTN_PRIMARY_SM =
  'inline-flex h-8 items-center justify-center gap-1.5 rounded-[10px] bg-indigo-600 bg-gradient-to-b from-indigo-500 to-indigo-600 px-3 text-[13px] font-semibold text-white ring-1 ring-inset ring-indigo-700/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_1px_2px_rgba(30,27,75,0.35)] transition hover:to-indigo-700 active:translate-y-px active:shadow-[inset_0_1px_3px_rgba(30,27,75,0.4)]'
