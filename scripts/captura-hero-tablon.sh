#!/usr/bin/env bash
#
# Regenera el recorte del TABLÓN DE EQUIPO del hero (public/hero-tablon.webp):
# dos mensajes de un hilo, con los candidatos propuestos y una mención.
#
# Tercero de la familia (`captura-hero.sh`, `captura-hero-movil.sh`) y por el
# mismo motivo: lo que se enseña en la landing sale de la demo, así que cuando el
# hilo cambie de pinta la landing se pone al día con una orden.
#
#   npm run dev                             # en otra terminal
#   ./scripts/captura-hero-tablon.sh 5173   # el puerto que te haya tocado
#
# LO QUE HACE DISTINTO A SUS HERMANOS: aquí no se captura una pantalla entera,
# sino un TROZO de dentro de un panel que scrollea. Chrome no sabe recortar una
# región, así que lo hace la propia página de siembra: mete la app en un iframe,
# BUSCA los dos mensajes por su texto, MIDE dónde han caído y desplaza el iframe
# dentro de una caja del tamaño del recorte. Así el encuadre se corrige solo si el
# hilo crece o cambia de sitio; lo único fijo es el TAMAÑO, que es lo estable.
#
# Y la caja va centrada en la ventana a propósito: `sips -c` recorta por el
# CENTRO, así que centrarla es lo que hace que el recorte caiga clavado sin
# cuentas. Con 900x600 a 2x sobran (1800-840)/2 = 480 por lado y (1200-380)/2 =
# 410 arriba. Si tocas una medida, tocas las dos.
set -euo pipefail

PUERTO="${1:-5173}"
BASE="http://localhost:${PUERTO}"

RECORTE_ANCHO=368
RECORTE_ALTO=190
# 400 NO es un ancho cualquiera: es el más estrecho en el que el mensaje de Sergio
# sigue cabiendo en UNA línea (medido de 320 a 420 de veinte en veinte; a 380 y por
# debajo se parte en dos y el recorte crece a 212px de alto en vez de 190). El
# panel del tablón es `w-full max-w-[460px]`, así que a 400 mide 400 y su columna
# de contenido 368, que es el recorte. Más estrecho no sale más pequeño: sale más
# alto.
VENTANA_APP_ANCHO=400
VENTANA_APP_ALTO=900
ANCHO_VENTANA=900
ALTO_VENTANA=600

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DESTINO="$RAIZ/public/hero-tablon.png"   # se convierte a .webp al final
SIEMBRA="$RAIZ/public/__captura-tablon.html"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PERFIL="$(mktemp -d)"

limpiar() { rm -f "$SIEMBRA"; rm -rf "$PERFIL" 2>/dev/null || true; }
trap limpiar EXIT

[ -x "$CHROME" ] || { echo "No encuentro Google Chrome en $CHROME"; exit 1; }
curl -sf -o /dev/null "$BASE/" || { echo "No hay servidor en $BASE (¿npm run dev?)"; exit 1; }

cat > "$SIEMBRA" <<HTML
<!doctype html><meta charset="utf-8"><title>captura tablón</title>
<style>
  html,body{margin:0;height:100%;overflow:hidden;background:#fff}
  body{display:grid;place-items:center}
  .caja{width:${RECORTE_ANCHO}px;height:${RECORTE_ALTO}px;overflow:hidden;position:relative;background:#fff}
  iframe{position:absolute;top:0;left:0;width:${VENTANA_APP_ANCHO}px;height:${VENTANA_APP_ALTO}px;border:0}
</style>
<div class="caja"><iframe src="/demo/equipo?peticion=req_carretilleros" title="tablón"></iframe></div>
<script>
  const f = document.querySelector('iframe')
  const buscar = (d, txt) =>
    [...d.querySelectorAll('li.group\\\\/msg')].find((e) => e.textContent.includes(txt))
  const intentar = () => {
    const d = f.contentDocument
    const a = d && buscar(d, 'Te propongo estos dos')
    if (!a) return setTimeout(intentar, 150)
    // El hilo abre por el FINAL (es un chat), así que estos dos mensajes caen
    // pegados al campo de escribir y el recorte se lo llevaba por delante. Se
    // sube el hilo hasta poner el primero arriba: debajo quedan los siguientes
    // mensajes, que es lo que tiene que verse.
    a.scrollIntoView({ block: 'start' })
    setTimeout(() => {
      const r = a.getBoundingClientRect()
      // El iframe se desplaza para que el primer mensaje caiga en 0,0 de la caja.
      f.style.transform = 'translate(' + -Math.round(r.left) + 'px,' + -Math.round(r.top) + 'px)'
    }, 300)
  }
  setTimeout(intentar, 400)
</script>
HTML

rm -f "$DESTINO"
echo "Capturando ${RECORTE_ANCHO}x${RECORTE_ALTO} a 2x..."
"$CHROME" --headless=new --disable-gpu --hide-scrollbars \
  --force-device-scale-factor=2 --window-size="${ANCHO_VENTANA},${ALTO_VENTANA}" \
  --force-prefers-reduced-motion --virtual-time-budget=12000 \
  --user-data-dir="$PERFIL" --screenshot="$DESTINO" \
  "$BASE/__captura-tablon.html" >/dev/null 2>&1 &
PID=$!
for _ in $(seq 1 40); do [ -s "$DESTINO" ] && sleep 2 && break; sleep 1; done
kill "$PID" 2>/dev/null || true

[ -s "$DESTINO" ] || { echo "FALLÓ: no se generó $DESTINO"; exit 1; }
sips -c $((RECORTE_ALTO * 2)) $((RECORTE_ANCHO * 2)) "$DESTINO" >/dev/null
sips -g pixelWidth -g pixelHeight "$DESTINO" | tail -2
# WebP SIN PÉRDIDA: mismo píxel, la mitad de peso. Ver `captura-hero.sh`.
python3 "$RAIZ/scripts/png-a-webp.py" "$DESTINO" || {
  echo "FALLÓ el paso a webp. Hace falta Pillow: pip3 install pillow"; exit 1; }
rm -f "$DESTINO"
echo "Listo: ${DESTINO%.png}.webp"
