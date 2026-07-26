# Meridian: hallazgos de usarlo de verdad

Sesión del 2026-07-25 en local, con `gpt-5.6-luna` y datos de "Reformas del Norte"
(2 puestos, 12 candidaturas). Objetivo del usuario simulado: **cubrir el puesto de
albañilería esta semana**. Ordenado por gravedad, no por orden de aparición.

> **Estado: los 20 arreglados y verificados el 2026-07-25.** Al arreglarlos
> salieron dos fallos de fondo que no se veían usando la interfaz y que están
> anotados al final: una **fuga de teléfonos al modelo** y una **carrera** que
> se comía turnos del hilo.

---

## Graves

### 1. El hilo se queda "pensando" para siempre
Pregunté *"tengo que cubrir el puesto de albañilería esta semana, ¿a quién llamo hoy?"*
y estuve **40 segundos mirando tres puntitos**. Nunca respondió. En el log de la
función: `wall clock duration warning` y `early termination has been triggered`, o
sea que el runtime mató la ejecución por pasarse de tiempo y la petición no vuelve
nunca. Pasa igual en producción, no es cosa del local.

Lo que lo agrava:
- **No hay timeout en el cliente**: el spinner es eterno.
- **No se puede cancelar** ni reintentar.
- **El composer sigue activo**, así que el usuario reenvía y apila peticiones.
- **Al recargar, tu pregunta ha desaparecido**: los turnos se guardan al final de
  la función, así que si muere no queda rastro. Escribes, esperas, recargas y es
  como si nunca hubieras preguntado.

Arreglo: guardar el turno del usuario **antes** de llamar al modelo; poner un plazo
en el servidor (si queda poco tiempo, forzar `responder` con lo que ya se sepa);
timeout en el cliente con mensaje honesto y botón de reintentar; y bloquear el
envío mientras piensa.

### 2. No sabe buscar por nombre
*"apúntame una entrevista con Andrés el jueves"* → **"No encuentro ninguna
candidatura con el nombre Andrés"**, con Andrés Melián visible en pantalla, en la
tarjeta de justo encima. `buscar_candidatos` solo filtra por `campo_id`, no tiene
búsqueda por nombre ni texto libre, así que el modelo no puede resolver algo tan
básico como llamar a alguien por su nombre.

(Lo de no poder agendar entrevistas lo dijo bien y sin rodeos. El problema es solo
el nombre.)

### 3. La "ronda de llamadas" no tiene teléfonos
Es la receta estrella y la que encaja con el trabajo real de la mañana, pero la
lista **no enseña ni un número**. Para llamar hay que abrir la ficha de cada uno,
volver, abrir la siguiente. En móvil debería ser un enlace `tel:` directo.

---

## El hilo pierde el hilo

### 4. Pulsar un botón no deja rastro de tu turno
Pincho "Ronda de llamadas de hoy" en el menú "+" y aparece una respuesta de
Meridian **sin que se vea qué he pedido yo**. El hilo queda como si Meridian
hubiera hablado solo: no hay burbuja mía, no queda claro que he tenido turno, y
al releer no hay forma de saber por qué dijo eso.

Pasa con **todo lo que se lanza desde un botón**: las cuatro tareas rápidas,
Comparar, Escribir, Marcar como, Exportar y abrir una tarea desde Actividad. El
único camino que deja rastro es escribir en el composer (`pushUser` solo se llama
ahí).

Y hay una incoherencia que lo empeora: **los chips de sugerencia sí dejan rastro**,
porque por dentro pasan por el composer. Así que dos cosas que al usuario le
parecen lo mismo (pulsar una pastilla) se comportan distinto según cuál sea.

Arreglo: que cada acción por botón escriba su propio turno de usuario, con la
frase que habrías dicho tú ("Ronda de llamadas de hoy", "Compara a estos 2",
"Escribe a 3 candidatos"). Es lo que hace que el hilo se lea como una conversación
y no como un tablón de avisos.

### 5. Lo que haces con botones no se guarda
Como esas acciones no pasan por la función, **tampoco se persisten**: al recargar,
las recetas, las comparativas y los detalles de tarea desaparecen, mientras que
las respuestas del modelo siguen ahí. El hilo guardado cuenta media historia, y
encima la mitad que falta no es la que el usuario recuerda haber pedido.

---

## Información que falta o engaña

### 6. "y 1 más" es texto muerto
Dice *"Te he ordenado las 7 llamadas de hoy"*, enseña 6, y la séptima **no hay
forma de verla**: "y 1 más" no es un botón ni un enlace. En una lista de llamadas
es especialmente malo, porque falta gente a la que tengo que llamar. Debería
desplegar o llevar a la bandeja con ese filtro.

### 7. El comparador no compara
- Las filas de las dos tarjetas **no están alineadas** (el mismo campo aparece a
  distinta altura porque los resúmenes miden distinto). Justo lo que rompe el
  "lado a lado": no puedes leer en horizontal.
- **No resalta las diferencias.** Andrés y Juan Carlos tienen carnet, vehículo,
  disponibilidad y zona idénticos: lo único que cambia es la experiencia. Eso
  debería saltar a la vista y hay que buscarlo a mano.
- **No se puede hacer nada desde ahí.** Comparo, decido, y no hay ningún botón:
  toca volver arriba, buscarlos en la lista y seleccionarlos. Callejón sin salida.
- Recorta el nombre: **"Juan Carlos"** en vez de "Juan Carlos Perdomo", y el puesto
  queda en "Oficial de primera de albañil...".
- **Solo caben dos o tres.** Lo señaló Mario: las tarjetas viejas escalaban a
  cuatro y cinco, y el rediseño lo dejó capado en 3.

Se probó con una tabla de columna fija, pero **Mario eligió mantener las
tarjetas**: escalan solas (comparar dos o seis es añadir fichas) y son el estilo
que quiere. Así que se vuelve a tarjetas, con los defectos arreglados dentro de
ese estilo:
- **Secciones alineadas** entre tarjetas: el resumen y la cabecera tienen altura
  fija, que era lo que descolocaba las filas de datos cuando un resumen medía
  tres líneas y otro dos. Verificado: los datos arrancan a la misma altura en las
  cinco tarjetas.
- **Nombre completo** ("Juan Carlos Perdomo", no "Juan Carlos") y el puesto en
  dos líneas en vez de recortado.
- **Acciones al final** y sugerencias en el turno.
- Tope holgado (10): las tarjetas se desplazan, así que caben las que hagan falta.

Lo único que no da el formato de tarjetas es resaltar en qué se diferencian y
comparar de un vistazo campos que solo tiene uno de los formularios.

### 8. El parte se cuelga medallas ajenas
*"Ojo: 5 que **destacaste** llevan días sin contactar"*. No destaqué a nadie: los
destacó Meridian. Debería ser "que encajan bien" o "que te destaqué".

### 9. Un "0" gigante como respuesta a un fallo
Cuando no encontró a Andrés pintó una tarjeta de dato con **"0 · Coincidencias con
Andrés"**. Un cero enorme en la pantalla no informa de nada que no dijera ya el
texto, y visualmente parece un resultado.

---

## Acciones que se echan de menos en los widgets

### 10. No hay "seleccionar todos"
Con 7 filas, marcar a todos para "márcalos como contactados" son 7 clics.

### 11. No se puede borrar la conversación
La función existe en el código (`clearMeridianThread`) pero **no hay ningún botón**.
Además de comodidad es el control de privacidad del usuario sobre su hilo.

### 12. Nada para ir tachando la ronda de llamadas
Voy llamando y no tengo dónde marcar por quién voy. Las casillas son para acciones
en bloque, no para seguir el avance.

### 13. Después de comparar, no hay siguiente paso
Ese turno se queda **sin sugerencias**. Es justo el momento en que el usuario ya
ha decidido y quiere actuar.

---

## Copy

### 14. El texto repite la lista que tiene debajo
*"Hay 4 candidatos de albañilería con vehículo propio: Andrés Melián, Daniela
Quintana, Juan Carlos Perdomo y Yeray Santana"*, y justo debajo los cuatro con su
nombre. Leo lo mismo dos veces. El texto debería aportar lo que la lista no dice
("dos ya están en marcha: Daniela en entrevista y Yeray contactado").

### 15. Motivos que repiten la etiqueta
En las recetas: *"Encaja bien y lleva 5 días esperando"* con la etiqueta "Encaja
bien" a dos centímetros. (En las respuestas del modelo ya está corregido.)

### 16. "Ya está en estado entrevista"
Sobra "estado". Y en otra fila: "Encaja bien, llámale primero" rompe el formato
del resto.

### 17. Chips de sugerencia demasiado largos
*"Los mejores para Oficial de primera de albañilería"* ocupa una fila entera y
descoloca el grupo. Los chips del modelo (2 a 4 palabras) están bien; los fijos del
parte, no.

---

## Accesibilidad

### 18. Botones sin nombre
Los de abrir la ficha desde una lista y las tarjetas del comparador salen como
`button` a secas en el árbol de accesibilidad. Con lector de pantalla no se sabe a
quién abren. Las casillas sí están bien etiquetadas.

---

## Móvil (375px)

### 19. El comparador se ve mal
Las tarjetas son de ancho fijo (248px): se ve una y media, con la segunda cortada
a mitad de palabra ("Encaja", "Años d"). Se puede desplazar en horizontal, así que
funciona, pero no está pensado para móvil. Quizá ahí deba apilarse.

### 20. El placeholder se corta
*"Pídele algo a Meridian, por ejemplo..."* queda cortado. Debería ser más corto en
pantallas pequeñas.

---

## Lo que sí funciona bien (para no tocarlo)

- **Entiende faltas y lenguaje coloquial**: *"de los de albañileria quien tiene
  vehiculo propio"* (sin tildes) lo resolvió perfecto, acotando al puesto correcto.
- **Los motivos por fila** de las respuestas del modelo son concretos y útiles
  ("Ya está en entrevista", "Ya está contactado").
- **Las recetas del menú "+" son instantáneas**, y el contraste con los 5-20 s del
  modelo se nota mucho a favor.
- **El estado vacío de Actividad enseña para qué sirve**, no dice "no hay nada".
- **Es honesto con sus límites**: dijo sin rodeos que no puede agendar entrevistas.
- **El traspaso a la propuesta de escribir** sigue siendo lo mejor del panel: el
  modelo elige a quién y el correo real aparece con sus dos botones.


---

## Dos fallos que aparecieron al arreglar los 20

### A. Los teléfonos SÍ llegaban al modelo
`tools.ts` redactaba los campos de tipo `'tel'`, pero en este producto el tipo
real es **`'phone'`** (ver `FieldType` en `src/lib/types.ts`). O sea que el
teléfono de cada candidatura viajaba a OpenAI dentro de `ver_candidato`. Lo
descubrió el compilador al escribir la lista de llamadas, no la interfaz.

Peor todavía: **mi test decía que no había fuga**, porque la fixture usaba el
tipo equivocado y comprobaba el caso que no era. Arreglado el código y la
fixture, que ahora usa el tipo real.

### B. Una carrera se comía turnos del hilo
Al guardar tu turno y el de Meridian casi a la vez, las dos escrituras veían el
hilo vacío, las dos intentaban crearlo y una moría contra el índice único: el
turno que perdía se descartaba en silencio. Se veía justo como el punto 4, pero
después de arreglarlo (en la primera prueba se guardó la respuesta y no la
pregunta).

Arreglado con un upsert en vez de "mira si existe y si no créalo", en la RPC y
en la edge function. Y los registros del cliente van ahora **en cola**, para que
la pregunta quede siempre antes que la respuesta.
