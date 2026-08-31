#!/usr/bin/env bash
#
# Regenera la captura del ANUNCIO EN MÓVIL del hero (public/hero-anuncio.webp).
#
# Hermano de `captura-hero.sh` y por el mismo motivo: el marco del teléfono va en
# código (components/AppShot.tsx) y solo la PANTALLA es esta imagen, sacada de la
# demo. Así, cuando la página del anuncio cambie, la landing se pone al día
# ejecutando una orden en vez de quedarse enseñando un producto que ya no existe.
#
#   npm run dev                            # en otra terminal
#   ./scripts/captura-hero-movil.sh 5173   # el puerto que te haya tocado
#
# LA PARTE QUE NO ES OBVIA: EL IFRAME NO ES UN CAPRICHO.
#
# Chrome en headless no baja de ~600px de ancho de LAYOUT por mucho que se le pase
# un `--window-size` más estrecho: por debajo maqueta a 600 y recorta, o sea que
# devuelve una pantalla ancha disfrazada de móvil (lo dice el propio
# `captura-hero.sh`, que por eso solo vale para escritorio). El suelo es del
# documento de arriba, NO de un iframe: dentro, el ancho lo manda el CSS. Así que
# se abre una ventana holgada, se mete la página en un iframe de 390x844 (el
# tamaño lógico de un iPhone moderno) CENTRADO, y se recorta después.
#
# Y se centra a propósito: `sips -c` recorta por el CENTRO, así que centrar el
# iframe es lo que hace que el recorte caiga clavado sobre él sin cuentas.
# Con 800x900 a 2x: sobra (1600-780)/2 = 410 por lado y (1800-1688)/2 = 56 arriba,
# que es exactamente donde el iframe empieza. Si tocas una medida, tocas las dos.
set -euo pipefail

PUERTO="${1:-5173}"
BASE="http://localhost:${PUERTO}"
# El puesto de logística: su marca es verde, así que el teléfono no repite el
# gris del panel de al lado y de paso enseña lo que esa página tiene de propio,
# que la cara la pone la empresa. Slug de `cmp_mozo` en seed.ts.
SLUG="${2:-h4j7f1d6s2}"

ANCHO_MOVIL=390
ALTO_MOVIL=844
ANCHO_VENTANA=800
ALTO_VENTANA=900

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DESTINO="$RAIZ/public/hero-anuncio.png"   # se convierte a .webp al final
SIEMBRA="$RAIZ/public/__captura-movil.html"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PERFIL="$(mktemp -d)"

limpiar() { rm -f "$SIEMBRA"; rm -rf "$PERFIL" 2>/dev/null || true; }
trap limpiar EXIT

[ -x "$CHROME" ] || { echo "No encuentro Google Chrome en $CHROME"; exit 1; }
curl -sf -o /dev/null "$BASE/" || { echo "No hay servidor en $BASE (¿npm run dev?)"; exit 1; }

cat > "$SIEMBRA" <<HTML
<!doctype html><meta charset="utf-8"><title>captura móvil</title>
<style>
  html,body{margin:0;height:100%;overflow:hidden;background:#fff}
  body{display:grid;place-items:center}
  iframe{display:block;width:${ANCHO_MOVIL}px;height:${ALTO_MOVIL}px;border:0}
</style>
<iframe src="/a/${SLUG}" title="anuncio"></iframe>
HTML

rm -f "$DESTINO"
echo "Capturando ${ANCHO_MOVIL}x${ALTO_MOVIL} a 2x (ventana ${ANCHO_VENTANA}x${ALTO_VENTANA})..."
"$CHROME" --headless=new --disable-gpu --hide-scrollbars \
  --force-device-scale-factor=2 --window-size="${ANCHO_VENTANA},${ALTO_VENTANA}" \
  --force-prefers-reduced-motion --virtual-time-budget=10000 \
  --user-data-dir="$PERFIL" --screenshot="$DESTINO" \
  "$BASE/__captura-movil.html" >/dev/null 2>&1 &
PID=$!
for _ in $(seq 1 40); do [ -s "$DESTINO" ] && sleep 1 && break; sleep 1; done
kill "$PID" 2>/dev/null || true

[ -s "$DESTINO" ] || { echo "FALLÓ: no se generó $DESTINO"; exit 1; }
sips -c $((ALTO_MOVIL * 2)) $((ANCHO_MOVIL * 2)) "$DESTINO" >/dev/null
sips -g pixelWidth -g pixelHeight "$DESTINO" | tail -2
# WebP SIN PÉRDIDA: mismo píxel, la mitad de peso. Ver `captura-hero.sh`.
python3 "$RAIZ/scripts/png-a-webp.py" "$DESTINO" || {
  echo "FALLÓ el paso a webp. Hace falta Pillow: pip3 install pillow"; exit 1; }
rm -f "$DESTINO"
echo "Listo: ${DESTINO%.png}.webp"
