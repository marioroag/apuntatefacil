#!/usr/bin/env bash
#
# Regenera las CUATRO capturas del hero de la landing:
#
#   public/hero-panel.webp        Vista general
#   public/hero-tablero.webp      El tablero de un puesto de albañilería
#   public/hero-tabla.webp        El MISMO puesto en tabla: son dos formas de ver
#                                 lo mismo, y eso solo se cuenta enseñándolas
#                                 seguidas
#   public/hero-ficha.webp        SOLO el modal de la ficha, sobre transparente:
#                                 se pinta ENCIMA de la tabla, que es lo que pasa
#                                 de verdad al abrir a un candidato desde ella
#   public/hero-entrevistas.webp  La agenda, con las citas de hoy
#
# WEBP SIN PÉRDIDA, no PNG: las cuatro juntas pesan 431 KB en vez de 1,2 MB, y
# "sin pérdida" quiere decir exactamente eso, ni un píxel distinto. En una captura
# de interfaz, con texto de 11px y filos de 1px, la versión con pérdida ablanda
# justo lo que esta casa se pasa el día afinando; y encima aquí sale MÁS grande
# (152 KB contra 107 en la primera), porque el ruido que inventa el cuantizador no
# comprime. Lo hace Pillow, que ya está en la máquina: `sips` no sabe escribir
# webp aunque acepte el flag (devuelve error y deja el fichero a medias).
#
# El marco del navegador va pasando por ellas (ver `AppShot`), así que se generan
# JUNTAS y a la misma medida: si una saliera con otro tamaño, el marco daría un
# salto al cambiar de pantalla.
#
# El marco del navegador del hero va en código (components/AppShot.tsx) y solo la
# PANTALLA es esta imagen, sacada de la demo. Por eso existe este script: la
# alternativa era dibujar a mano una réplica de la app, que es lo que hacía el
# viejo `BrowserMock` y acabó enseñando un producto que ya no existe (pastillas de
# estado con anillo, un "Exportar a Excel" que se mudó al menú `···`). Con esto,
# cuando Vista general cambie, la landing se pone al día ejecutando una orden.
#
#   npm run dev                       # en otra terminal
#   ./scripts/captura-hero.sh 5173    # el puerto que te haya tocado
#
# Cuatro cosas que NO son opcionales y explican la forma del script:
#
#  1. `--force-prefers-reduced-motion`. La gráfica de Vista general entra con un
#     `scaleY(0) -> 1`, y en headless el disparo cae antes de que termine: la
#     captura sale con la gráfica VACÍA. Con reduced-motion el estado de partida
#     ni se aplica (es la salida que la propia doctrina ya declara), así que la
#     curva se pinta entera desde el primer fotograma.
#
#  2. La página de siembra. Sin ella, un perfil nuevo tiene todos los puestos sin
#     ver y el lateral sale con SEIS "15+" idénticos en columna, que se leen como
#     una chapa atascada y no como datos. Chrome en headless no evalúa JS, así que
#     lo que escribe `localStorage` es una página servida desde el MISMO ORIGEN,
#     que se borra al acabar (trap) y por eso no vive en el repo.
#
#  3. LA HORA A LA QUE SE EJECUTA SE CONGELA EN LA IMAGEN. El saludo sale del
#     reloj ("Buenas tardes, Marta"), así que lanzarlo a las once de la noche deja
#     un "Buenas noches" impreso en el hero de la landing para siempre. Lánzalo en
#     horario de oficina. Por lo mismo, el ÚLTIMO día de la gráfica es un día a
#     medias: a media mañana lleva un tercio de sus candidaturas y la curva acaba
#     cayendo, que es justo lo que esta captura no puede decir (Mario, ago 2026).
#     El punto dulce es media tarde: día casi completo y saludo de tarde.
#
#  4. El ancho. Chrome en headless no baja de ~600px de ancho de LAYOUT por mucho
#     que se le pase `--window-size` más estrecho: por debajo de eso maqueta a 600
#     y recorta, o sea que finge un desbordamiento que no existe. Este script vale
#     para escritorio; para verificar móvil hay que usar un navegador de verdad.
set -euo pipefail

PUERTO="${1:-5173}"
BASE="http://localhost:${PUERTO}"
ANCHO="${2:-1512}"
ALTO="${3:-860}"


RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SIEMBRA="$RAIZ/public/__captura-siembra.html"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PERFIL="$(mktemp -d)"

limpiar() { rm -f "$SIEMBRA"; rm -rf "$PERFIL" 2>/dev/null || true; }
trap limpiar EXIT

[ -x "$CHROME" ] || { echo "No encuentro Google Chrome en $CHROME"; exit 1; }
curl -sf -o /dev/null "$BASE/" || { echo "No hay servidor en $BASE (¿npm run dev?)"; exit 1; }

# Estado de alguien que YA usa la app: unos puestos vistos hace un rato y otros sin
# mirar. No inventa datos (las candidaturas son las de la demo), elige el momento.
#
# La pantalla llega por la query, y con ella lo que haya que preparar antes: el
# modo tablero es una PREFERENCIA guardada (no vive en la URL), y la ficha hay que
# desplazarla un poco o los documentos se quedan pegados al filo de abajo.
cat > "$SIEMBRA" <<'HTML'
<!doctype html><meta charset="utf-8"><title>siembra</title>
<style>html,body{margin:0;height:100%;overflow:hidden}iframe{display:block;width:100vw;height:100vh;border:0}</style>
<script>
  const pantalla = new URLSearchParams(location.search).get('p') || 'resumen'
  const hace = (h) => new Date(Date.now() - h * 3600e3).toISOString()
  localStorage.setItem('apuntatefacil.seen.v1', JSON.stringify({
    cmp_peon: hace(0.2),          // recién mirado: sin cifra
    cmp_carretillero: hace(0.5),  // recién mirado: sin cifra
    cmp_oficial: hace(96),        // unas pocas desde entonces
    cmp_electricista: hace(150),  // unas cuantas más
    // cmp_mozo y cmp_preparador se quedan sin ver: llegan al tope ("15+")
  }))
  localStorage.setItem('apuntatefacil.board-seen.v1', JSON.stringify({ demo: hace(3) }))
  localStorage.setItem('apuntatefacil.panel.modo', pantalla === 'tablero' ? 'tablero' : 'tabla')

  const RUTAS = {
    resumen: '/demo/resumen',
    // El MISMO puesto en las dos, y el mismo del que es el candidato de la ficha
    // (Joaquín, `cmp_oficial`): la ficha se pinta ENCIMA de la tabla, así que si
    // fueran puestos distintos se vería una ficha de "Oficial de 1ª" abierta sobre
    // la lista de "Peón de albañil". Se vio en pantalla.
    tablero: '/demo/puestos/cmp_oficial',
    tabla: '/demo/puestos/cmp_oficial',
    ficha: '/demo/puestos/cmp_oficial?candidato=cand_cv_joaquin',
    entrevistas: '/demo/entrevistas',
  }
  // OJO: el script corre mientras se parsea, así que `document.body` TODAVÍA NO
  // EXISTE. Colgando el iframe de ahí, las cuatro capturas salían en blanco y del
  // mismo tamaño exacto (19 KB), que es la pista de que no se pintó nada.
  const f = document.createElement('iframe')
  f.title = 'app'
  f.src = RUTAS[pantalla]
  document.documentElement.appendChild(f)

  // LA FICHA SE FOTOGRAFÍA SOLA, SOBRE TRANSPARENTE (Mario, ago 2026).
  //
  // Antes se capturaba la pantalla entera con el modal encima, y traía un problema
  // que no merecía la pena arreglar: esa captura llevaba SU PROPIO lateral, con
  // otra fila activa que la de la tabla, así que al llegar el paso de la ficha el
  // menú daba un salto. Capturando solo el modal y pintándolo ENCIMA de la tabla,
  // el fondo no cambia en absoluto: se abre una ficha desde la lista, que es lo que
  // pasa de verdad.
  //
  // Va a tamaño completo (3024x1720) con todo lo demás transparente, no recortada
  // al modal: así en el hero es una capa más con `inset-0` y no hay que calcular
  // dónde colocarla. Lo transparente no pesa (el webp sin pérdida lo deja en nada).
  //
  // Dos retoques más, que son la única licencia que este script se toma sobre el
  // producto y por eso van escritos:
  //
  //  · SIN "Volver a analizar". Es un control de trabajo (repetir el triaje) y en
  //    una captura no se puede pulsar: solo alarga el bloque del informe. Se
  //    esconde SOLO AQUÍ; en el producto sigue siendo la única puerta para volver
  //    a analizar a alguien.
  //
  //  · SIN DESPLAZAR: se enseña lo que se ve al abrirla. El 0 se fuerza porque en
  //    un navegador de verdad la columna arranca ahí (medido) pero en headless
  //    aterriza ~120px más abajo y la captura salía con el informe cortado.
  if (pantalla === 'ficha') {
    const retocar = () => {
      const d = f.contentDocument
      // `.z-50` NO es decorativo en este selector: el SHELL de la app es también
      // un `.fixed.inset-0` (es el primer hijo de #root), así que sin él se
      // seleccionaba la app entera y `visibility: visible` la devolvía a la vista.
      // Se vio en la captura: salía el lateral encima de un agujero transparente.
      const capa = d && d.querySelector('.fixed.inset-0.z-50')
      if (!capa) return setTimeout(retocar, 150)

      // SE MUEVE EL MODAL FUERA Y SE APAGA EL SHELL, en vez de esconder cosas con
      // CSS. Con `visibility` la cascada no se portó igual en headless que en un
      // navegador de verdad (comprobado en los dos: en el pane el `<aside>` salía
      // `hidden` y la captura seguía trayendo el lateral y la tabla pintados), y
      // depender de eso para una captura que se regenera a ciegas es frágil.
      //
      // Moverlo NO lo descoloca: la capa del modal es `fixed inset-0`, o sea que
      // se posiciona contra la ventana, no contra su padre. Sale exactamente donde
      // estaba. Y con el shell en `display:none` no queda nada más que pintar.
      d.body.appendChild(capa)
      const raiz = d.getElementById('root')
      if (raiz) raiz.style.display = 'none'
      d.documentElement.style.background = 'transparent'
      d.body.style.background = 'transparent'

      const telon = capa.querySelector('[aria-hidden]')
      if (telon) telon.style.display = 'none'

      // La sombra la lleva el propio modal, y aquí se refuerza: sin nada detrás
      // que la reciba, la de la casa se queda corta para que la ficha se lea como
      // una capa por encima de la tabla.
      const panel = capa.querySelector('[class*="shadow-pop"]')
      if (panel)
        panel.style.boxShadow =
          '0 40px 90px -20px rgba(18,22,34,.28), 0 16px 36px -12px rgba(18,22,34,.18)'

      // Por TEXTO y no por una clase: el botón no tiene ninguna que lo distinga,
      // y una clase de utilidad copiada aquí se queda vieja al primer retoque.
      const boton = [...d.querySelectorAll('button')].find((b) => (b.textContent || '').includes('Volver a analizar'))
      if (boton) boton.style.display = 'none'

      const col = [...d.querySelectorAll('div')].find((e) => e.scrollHeight > e.clientHeight + 40 && e.clientHeight > 200)
      if (col) col.scrollTop = 0
    }
    setTimeout(retocar, 800)
  }
</script>
HTML

capturar() {
  local pantalla="$1" destino="$RAIZ/public/$2"
  local perfil; perfil="$(mktemp -d)"
  rm -f "$destino"
  echo "  $pantalla -> public/$2"
  # Solo la ficha se captura sobre transparente (ARGB, alfa a cero). Va como
  # cadena y no como array porque el bash de macOS es el 3.2, y ahí un array vacío
  # expandido con `set -u` puesto revienta con "unbound variable".
  local fondo=""
  [ "$pantalla" = "ficha" ] && fondo="--default-background-color=00000000"
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars \
    --force-device-scale-factor=2 --window-size="${ANCHO},${ALTO}" \
    --force-prefers-reduced-motion --virtual-time-budget=12000 \
    ${fondo:+"$fondo"} \
    --user-data-dir="$perfil" --screenshot="$destino" \
    "$BASE/__captura-siembra.html?p=$pantalla" >/dev/null 2>&1 &
  local pid=$!
  for _ in $(seq 1 40); do [ -s "$destino" ] && sleep 2 && break; sleep 1; done
  kill "$pid" 2>/dev/null || true
  rm -rf "$perfil" 2>/dev/null || true
  [ -s "$destino" ] || { echo "FALLÓ: no se generó $destino"; exit 1; }
  python3 "$RAIZ/scripts/png-a-webp.py" "$destino" || {
    echo "FALLÓ el paso a webp. Hace falta Pillow: pip3 install pillow"; exit 1; }
  rm -f "$destino"
}

echo "Capturando ${ANCHO}x${ALTO} a 2x..."
capturar resumen hero-panel.png
capturar tablero hero-tablero.png
capturar tabla hero-tabla.png
capturar ficha hero-ficha.png
capturar entrevistas hero-entrevistas.png
echo "Listo."
