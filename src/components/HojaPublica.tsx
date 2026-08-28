/**
 * LA CABECERA DE UNA PÁGINA PÚBLICA: la foto A SANGRE y la HOJA que sube sobre
 * ella (diseño de Mario en Figma, ago 2026).
 *
 * Nació en el anuncio y desde ago 2026 la usan las DOS superficies que ve un
 * candidato, el anuncio y el formulario, porque son la misma página en dos
 * momentos: pulsas "Apúntate ahora" y lo único que tiene que cambiar es lo que
 * hay debajo de la foto. Antes el formulario metía su banner DENTRO de una
 * tarjeta de 480px flotando sobre gris, así que al pulsar el botón se cambiaba
 * de producto: la foto encogía, se redondeaba por las cuatro esquinas y el
 * fondo se volvía gris.
 *
 * Está escrita UNA vez a propósito. El radio y el solape son un par que se toca
 * a la vez (ver abajo), y escritos en dos ficheros el día que se afine uno el
 * otro se queda con la mitad del gesto.
 *
 * RADIO GRANDE (32) Y SOLAPE DE 28 (Mario: "más redondeado para que haga mejor
 * blend con la foto"). Con poco solape, un radio grande deja las esquinas de la
 * foto asomando por los lados como dos cuernos; con solape de sobra, la curva
 * entra en la foto y la transición se lee como una sola pieza. Es el único
 * sitio de la app con este radio, y se justifica en que aquí no separa dos
 * superficies del producto: funde una foto con una hoja.
 *
 * LA HOJA LLEGA A LOS BORDES Y LO QUE SE ACOTA ES EL CONTENIDO, en dos
 * elementos. Con la hoja acotada, en una ventana ancha quedaban dos colas de
 * foto de 28px a los lados acabadas en seco: el banner va a sangre y la hoja no,
 * así que por debajo de la foto y fuera de la hoja no había nada que rematara.
 * Regla general: un elemento que SOLAPA a otro a sangre tiene que ser a sangre
 * también, o hay que rematar lo que asome por los lados.
 *
 * SIN FOTO, EL BANNER ES EL COLOR DE LA IDENTIDAD. Antes no se pintaba nada y la
 * página empezaba en seco, con el título pegado al filo del navegador; una
 * franja del acento la abre igual y de paso dice de quién es esto antes de leer
 * una palabra. Es el mismo recurso que el cuadro con la inicial cuando no hay
 * logo, y va más baja (96/112) porque es un relleno que da identidad, no una
 * imagen que haya que mirar.
 *
 * EL ALTO CON FOTO ES 136 EN MÓVIL Y 152 EN ESCRITORIO. En un móvil, 136 ya son
 * una cabecera; en una ventana de 1400 la misma medida es una franja fina, y con
 * la hoja comiéndole 28 se quedaba en poco más de cien. Se probó a 200 y a 168 y
 * las dos eran de más: la cabecera empezaba a disputarle la primera pantalla al
 * puesto, que es lo que se ha venido a leer. El techo de una foto de cabecera es
 * el punto donde deja de presentar la página y pasa a ser la página.
 */
export function HojaPublica({
  bannerUrl,
  children,
}: {
  bannerUrl: string | null | undefined
  /** El contenido de la hoja. Se acota él, no la hoja. */
  children: React.ReactNode
}) {
  return (
    <>
      {bannerUrl ? (
        <img src={bannerUrl} alt="" className="h-[136px] w-full object-cover lg:h-[152px]" />
      ) : (
        <div className="h-24 w-full bg-accent lg:h-28" aria-hidden />
      )}
      <div className="relative -mt-7 rounded-t-[32px] bg-white">{children}</div>
    </>
  )
}
