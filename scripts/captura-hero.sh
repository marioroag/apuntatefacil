#!/usr/bin/env bash
#
# Regenera la captura del hero de la landing (public/hero-panel.png).
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
# Tres cosas que NO son opcionales y explican la forma del script:
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
#  3. El ancho. Chrome en headless no baja de ~600px de ancho de LAYOUT por mucho
#     que se le pase `--window-size` más estrecho: por debajo de eso maqueta a 600
#     y recorta, o sea que finge un desbordamiento que no existe. Este script vale
#     para escritorio; para verificar móvil hay que usar un navegador de verdad.
set -euo pipefail

PUERTO="${1:-5173}"
BASE="http://localhost:${PUERTO}"
ANCHO="${2:-1512}"
ALTO="${3:-860}"

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DESTINO="$RAIZ/public/hero-panel.png"
SIEMBRA="$RAIZ/public/__captura-siembra.html"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PERFIL="$(mktemp -d)"

limpiar() { rm -f "$SIEMBRA"; rm -rf "$PERFIL" 2>/dev/null || true; }
trap limpiar EXIT

[ -x "$CHROME" ] || { echo "No encuentro Google Chrome en $CHROME"; exit 1; }
curl -sf -o /dev/null "$BASE/" || { echo "No hay servidor en $BASE (¿npm run dev?)"; exit 1; }

# Estado de alguien que YA usa la app: unos puestos vistos hace un rato y otros sin
# mirar. No inventa datos (las candidaturas son las de la demo), elige el momento.
cat > "$SIEMBRA" <<'HTML'
<!doctype html><meta charset="utf-8"><title>siembra</title>
<style>html,body{margin:0;height:100%;overflow:hidden}iframe{display:block;width:100vw;height:100vh;border:0}</style>
<script>
  const hace = (h) => new Date(Date.now() - h * 3600e3).toISOString()
  localStorage.setItem('apuntatefacil.seen.v1', JSON.stringify({
    cmp_peon: hace(0.2),          // recién mirado: sin cifra
    cmp_carretillero: hace(0.5),  // recién mirado: sin cifra
    cmp_oficial: hace(96),        // unas pocas desde entonces
    cmp_electricista: hace(150),  // unas cuantas más
    // cmp_mozo y cmp_preparador se quedan sin ver: llegan al tope ("15+")
  }))
  localStorage.setItem('apuntatefacil.board-seen.v1', JSON.stringify({ demo: hace(3) }))
</script>
<iframe src="/demo/resumen" title="app"></iframe>
HTML

rm -f "$DESTINO"
echo "Capturando ${ANCHO}x${ALTO} a 2x..."
"$CHROME" --headless=new --disable-gpu --hide-scrollbars \
  --force-device-scale-factor=2 --window-size="${ANCHO},${ALTO}" \
  --force-prefers-reduced-motion --virtual-time-budget=10000 \
  --user-data-dir="$PERFIL" --screenshot="$DESTINO" \
  "$BASE/__captura-siembra.html" >/dev/null 2>&1 &
PID=$!
for _ in $(seq 1 40); do [ -s "$DESTINO" ] && sleep 1 && break; sleep 1; done
kill "$PID" 2>/dev/null || true

[ -s "$DESTINO" ] || { echo "FALLÓ: no se generó $DESTINO"; exit 1; }
sips -g pixelWidth -g pixelHeight "$DESTINO" | tail -2
echo "Listo: $DESTINO"
