# Ideas futuras

Este documento recoge posibles ampliaciones que no forman parte del alcance actual. Cada idea deberá validarse antes de pasar a diseño e implementación.

## Comprobación automática del interés de candidatos

### Idea

Detectar candidatos cuya candidatura lleve un tiempo sin actividad y enviarles automáticamente un correo para comprobar si siguen interesados en el puesto.

El correo usaría la misma plantilla y las mismas respuestas de la comprobación manual:

- **Sí, sigo interesado**
- **No, ya no me interesa**

La respuesta se guardaría como una señal independiente del estado del candidato.

### Posible funcionamiento

- La empresa configura cuánto tiempo debe pasar desde la candidatura o la última actividad.
- El sistema muestra qué candidatos cumplen las condiciones antes de activar la automatización.
- Los envíos se realizan de forma programada solo a candidatos con email.
- Si no hay respuesta, podría enviarse un único recordatorio tras un plazo definido.
- La empresa puede pausar la automatización y consultar los envíos y respuestas.

### Condiciones para retomarla

- Validar primero el uso real de la comprobación manual.
- Confirmar qué plazo y frecuencia necesitan los clientes.
- Definir límites de envío, reintentos y protección frente a correos repetitivos.
- Revisar entregabilidad, trazabilidad y obligaciones de protección de datos.

### Fuera del alcance actual

La primera versión será manual: la empresa selecciona candidatos, confirma el envío y puede reenviar a quienes no respondan después de 7 días.
