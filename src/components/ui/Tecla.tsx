/**
 * UNA TECLA DIBUJADA. La misma en el pie del buscador y en el atajo del menú.
 *
 * No es una chapa ni un `code`: es una tecla, y por eso lleva filo y fondo claro
 * sobre la superficie, que es como se lee un teclado de verdad. Va siempre en la
 * familia de la app (`font-sans`): el `<kbd>` del navegador cae a monospace por
 * defecto y ahí dentro un símbolo suelto se ve de otra tipografía.
 *
 * Alto fijo de 20px y ancho mínimo igual, para que "⌘" y "K" salgan del mismo
 * tamaño: con ancho libre, una tecla de un glifo estrecho se ve más pequeña que
 * su vecina y el par deja de parecer un teclado.
 */
export function Tecla({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd className={`inline-grid h-5 min-w-5 grid-flow-col place-items-center rounded border border-slate-300 bg-white px-1.5 font-sans text-[11px] font-medium leading-none text-slate-600 ${className}`}>
      {children}
    </kbd>
  )
}

/**
 * Una COMBINACIÓN: UNA sola tecla con el "+" dentro, no varias en fila.
 *
 * Es la diferencia entre "pulsa esto" y "pulsa esto, luego esto": ⌘ y K se
 * pulsan a la vez, así que se dibujan como un solo objeto. En dos cápsulas
 * separadas el atajo se lee como dos pasos, y además ocupa casi el doble en una
 * fila de menú donde el ancho es de la etiqueta.
 *
 * El "+" va en tinta más clara: es la gramática del atajo, no una tecla.
 */
export function Combinacion({ teclas, className = '' }: { teclas: string[]; className?: string }) {
  return (
    <Tecla className={className}>
      {teclas.map((t, i) => (
        <span key={t}>
          {i > 0 && <span className="text-slate-400">+</span>}
          {t}
        </span>
      ))}
    </Tecla>
  )
}
