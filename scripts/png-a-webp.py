"""Pasa una captura del hero a WebP SIN PÉRDIDA y borra el PNG.

Con `--partir N` la corta antes en DOS piezas por la columna N: el lateral de la
app y su contenido. No es un capricho de compresión, es que las dos mitades se
animan distinto en el hero (el lateral se funde cruzado y el contenido se apaga
del todo antes de que entre el siguiente), y cada una necesita ser su propio
elemento. Partiendo el FICHERO en vez de recortar la misma imagen dos veces con
`clip-path`, el navegador no decodifica ocho mapas de bits de 3024x1720.

Vive aparte y no incrustado en `captura-hero.sh` porque un heredoc de Python
dentro de una función de bash dentro de otro heredoc es justo donde se pierde una
comilla y nadie la encuentra.
"""
import sys

from PIL import Image

args = sys.argv[1:]
partir = None
if "--partir" in args:
    i = args.index("--partir")
    partir = int(args[i + 1])
    del args[i : i + 2]

png = args[0]
im = Image.open(png)
base = png[: -len(".png")]

if partir is None:
    im.save(base + ".webp", "WEBP", lossless=True, method=6)
else:
    im.crop((0, 0, partir, im.height)).save(base + "-lateral.webp", "WEBP", lossless=True, method=6)
    im.crop((partir, 0, im.width, im.height)).save(base + "-contenido.webp", "WEBP", lossless=True, method=6)
