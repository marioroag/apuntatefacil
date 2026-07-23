# Estrategia de pricing premium

**Fecha:** 2026-07-24
**Superficies futuras:** landing (`/`) y plan (`/app/plan`)
**Estado:** estrategia numérica aprobada por Mario; pendiente de revisión antes de preparar la implementación.

## Objetivo

Posicionar Apúntate Fácil como software premium para pymes de construcción y logística que contratan de forma recurrente. La estrategia prioriza autoridad, confianza y valor percibido sobre la captación del mayor número posible de clientes.

El cliente central es una empresa operativa de aproximadamente 30 a 150 empleados. La venta inicial se realiza mediante una demo o conversación breve y el producto contratado es software, sin consultoría ni servicio gestionado.

## Arquitectura aprobada

| Plan | Precio mensual | Relación con Pro | Función |
| --- | ---: | ---: | --- |
| Esencial | **185 €** | 78 % | Opción individual y plenamente útil |
| Pro | **237 €** | 100 % | Plan objetivo para la pyme recurrente |
| Multi | **533 €** | 225 % | Ancla creíble y solución para operaciones distribuidas |

Los tres importes son precios mensuales sin IVA.

### Esencial: 185 €/mes

- Queda 52 € por debajo de Pro.
- Pro supone un incremento del 28 % sobre Esencial.
- Mantiene una entrada premium sin hacer que el plan inferior sea tan barato que atraiga a empresas que obtendrían más valor de Pro.
- La terminación en 5 aporta fluidez sin utilizar el patrón minorista de terminar todos los planes en 9.

### Pro: 237 €/mes

- Es el precio protagonista y la referencia interna del catálogo.
- Queda aproximadamente un 5 % por debajo de 250 €, sin presentarse como un precio construido justo debajo de ese umbral.
- La precisión es moderada: euros enteros, sin decimales ni una terminación repetida en el resto de los planes.
- Debe presentarse como la opción recomendada para contratación recurrente y coordinación de equipo.

### Multi: 533 €/mes

- Pro cuesta aproximadamente el 44 % de Multi, por lo que se percibe claramente por debajo de la mitad.
- El precio es suficientemente alto para anclar el catálogo y capturar el valor de sedes, marcas y responsables distribuidos.
- Sigue dentro de un territorio creíble frente a software de contratación empresarial. No funciona como un plan artificial que nadie compraría.

## Principios de diseño numérico

1. **Relatividad antes que aislamiento.** Cada importe se evalúa frente a los otros dos. Pro debe resultar más valioso por una subida pequeña desde Esencial y financieramente prudente frente a Multi.
2. **Efecto compromiso.** Pro ocupa la posición intermedia en complejidad, pero cuesta bastante menos de la mitad que Multi.
3. **Precisión moderada.** Los números 185, 237 y 533 sugieren una valoración deliberada. No se usan decimales ni una precisión difícil de justificar.
4. **Sin patrón de ganga.** Las terminaciones 5, 7 y 3 evitan que el catálogo parezca una sucesión de precios promocionales.
5. **Ancla creíble.** Multi debe poder venderse por sí mismo. Su precio no se infla únicamente para manipular la percepción de Pro.
6. **Valor sobre coste.** Los precios no se derivan del coste técnico del software, sino de la complejidad operativa que resuelve cada plan.

La investigación sobre negociación indica que una precisión moderada puede hacer que una oferta parezca más informada y funcionar como un ancla más firme. La precisión excesiva puede transmitir inflexibilidad o falta de criterio, especialmente ante compradores expertos. Esta estrategia utiliza esa evidencia como apoyo, no como promesa de conversión.

## Segmentación de los planes

La diferenciación principal se hará mediante capacidades:

- **Esencial:** gestión individual y flujo básico completo.
- **Pro:** colaboración, coordinación, vistas guardadas, marca y automatización.
- **Multi:** sedes, marcas, permisos y responsables distribuidos.

Los procesos activos pueden mantenerse como protección operativa secundaria, pero no deben ser la justificación principal del salto de precio. Una empresa grande puede contratar muchas personas mediante un solo proceso, por lo que ese límite no representa por sí solo el valor recibido.

Los candidatos y los usuarios permanecen ilimitados en los planes de pago. No se penaliza una oleada de candidaturas ni se desincentiva que el equipo adopte el producto.

Las funciones de IA no justifican el precio hasta que existan. Cuando se construyan, se definirá una cantidad incluida y, si tienen coste variable relevante, un sistema adicional de créditos.

## Presentación

- Los tres precios deben mostrarse de forma pública y exacta.
- Pro lleva la chapa **“Recomendado”**.
- Los tres importes deben ser visibles simultáneamente en escritorio.
- En móvil, la interfaz debe conservar la comparación numérica aunque solo muestre el detalle de una tarjeta cada vez.
- El símbolo € puede tener menor peso visual que el número, sin ocultarlo.
- El IVA se comunica aparte y con claridad.
- No se usan precios tachados, descuentos ficticios, urgencia, prueba social inventada ni una falsa equivalencia diaria.

La periodicidad anual, los descuentos y los cambios en el plan de Prueba quedan fuera de esta especificación. Requieren decisiones propias basadas en datos de permanencia y estacionalidad.

## Validación comercial

185 / 237 / 533 es una hipótesis de lanzamiento diseñada, no un supuesto precio óptimo universal.

En las siguientes conversaciones comerciales se registrará:

- segmento y tamaño de la empresa;
- problema principal y frecuencia de contratación;
- plan presentado;
- aceptación, objeción explícita o ausencia de decisión;
- etapa exacta en la que se pierde la oportunidad;
- motivo declarado en un seguimiento posterior.

No se interpretará el silencio como una objeción de precio. Cuando exista una muestra suficiente, se contrastará la intención declarada con compras reales y se estudiará la sensibilidad a varios importes mediante una prueba estructurada.

## Fuentes de referencia

- Mason, Lee, Wiley y Ames, “Precise offers are potent anchors”: <https://doi.org/10.1016/j.jesp.2013.02.012>
- Loschelder et al., “The Too-Much-Precision Effect”: <https://doi.org/10.1177/0956797616666074>
- Thomas y Morwitz, “The Left-Digit Effect in Price Cognition”: <https://doi.org/10.1086/429600>
- Breezy HR, precios públicos: <https://breezy.hr/pricing>
- Workable, precios públicos: <https://www.workable.com/pricing>

## Fuera de alcance

- Modificar `src/lib/pricing.ts`.
- Cambiar los importes reales de Stripe.
- Alterar límites de servidor, RLS o migraciones.
- Rediseñar las tarjetas de precio.
- Crear descuentos, compromiso anual o una modalidad estacional.

Estas acciones solo se abordarán después de que Mario revise esta especificación y apruebe preparar el plan de implementación.
