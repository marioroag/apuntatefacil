import { ChevronLeft, ChevronRight } from 'lucide-react'

// El marco del navegador del hero va EN CÓDIGO y solo la pantalla es una captura.
// Dibujado, el cromo queda nítido a cualquier tamaño y no arrastra el peso de un
// PNG; la captura de dentro sale de la demo (`scripts/captura-hero.sh`), así que
// enseña el producto de verdad y se regenera cuando la pantalla cambia, en vez de
// ser una réplica a mano que se queda vieja sin que nadie se entere (que es
// justamente lo que le pasó a `BrowserMock`).
export function AppShot({ className = '' }: { className?: string }) {
  return (
    <div className={`overflow-clip rounded-2xl filo bg-white shadow-pop ${className}`}>
      {/* Rejilla de tres columnas: las dos laterales son 1fr, así que la barra de
          direcciones queda centrada respecto a la VENTANA pase lo que pase a los
          lados. Con un contrapeso escrito a mano hay que reajustarlo cada vez que
          cambie un icono, y se descuadra en silencio. */}
      <div className="grid grid-cols-[1fr_46%_1fr] items-center border-b border-slate-200 bg-slate-100 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="size-2.5 rounded-full bg-[#ff5f57] sm:size-3" />
          <span className="size-2.5 rounded-full bg-[#febc2e] sm:size-3" />
          <span className="size-2.5 rounded-full bg-[#28c840] sm:size-3" />
          <span className="ml-2 hidden items-center gap-1 text-slate-400 sm:flex">
            <ChevronLeft className="size-4" aria-hidden />
            <ChevronRight className="size-4" aria-hidden />
          </span>
        </div>
        <div className="rounded-lg bg-white py-1 text-center text-[10px] text-slate-500 filo sm:py-1.5 sm:text-xs">
          apuntatefacil.com
        </div>
      </div>
      <img
        src="/hero-panel.png"
        alt="Vista general de Apúntate Fácil: el saludo, tres acciones rápidas y la gráfica de por dónde entra la gente."
        width={3024}
        height={1720}
        loading="eager"
        fetchPriority="high"
        className="block w-full"
      />
    </div>
  )
}
