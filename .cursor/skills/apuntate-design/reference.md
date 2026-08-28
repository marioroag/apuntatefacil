# Referencia · Apúntate Fácil Design

## Mapa de archivos

| Qué | Dónde |
| --- | --- |
| Tokens Tailwind v4 (`@theme`) | `src/index.css` |
| Botones (planos, ago 2026) | `src/lib/buttons.ts` |
| Estados candidato | `src/lib/types.ts` → `STATUS_META` |
| Acento cliente + contraste AA | `src/lib/colors.ts` |
| Marca (nombre, dominio) | `src/lib/brand.ts` |
| Pricing (pago por proceso) | `src/lib/pricing.ts` |
| Formulario WYSIWYG | `src/components/FieldRenderer.tsx` |
| Formulario público | `src/screens/PublicForm.tsx`, `src/components/ApplicationForm.tsx` |
| Constructor | `src/screens/Builder.tsx` |
| Detalle candidato | `screens/CandidateModal.tsx` (tres pestañas + raíl) |
| Checkbox app | `src/components/ui/Checkbox.tsx` |
| Logo | `src/components/Logo.tsx` |
| Estrategia producto | `PRODUCT.md` |
| Sistema visual documentado | `DESIGN.md` |

## Tokens clave (ago 2026)

```
Acento:     #3b4fe4 (indigo-600 en Tailwind reasignado; gemelo ACENTO_MARCA en lib/colors.ts)
Hover:      #2d3fb0 (indigo-700)   Press: #263690 (indigo-800)
Lavado:     #eef2fe (indigo-50; el nav activo YA NO usa acento)
Tinta:      #131822 (slate-900)
Secundario: #50545e (slate-600)
Terciario:  #6f727c (slate-500)
Fondo app:  #f9fafb (slate-50)
Superficie: #FFFFFF
Borde:      #e5e7eb (slate-200)
Peligro:    #DC2626
```

Sombras (`@theme`): `control / raised (solo el pomo del Switch) / card / pop / sticky / acceso`. Marco de superficie: `filo` + `overflow-clip`.

## Formulario público (checklist)

- Una columna, max 480px
- Inputs 48px alto, fuente 16px (evita zoom iOS)
- Targets ≥ 44px; teclados `type=tel/email/number`, `inputmode`
- Validación al blur y al enviar, **nunca** al teclear
- En fallo de envío: **no** borrar respuestas ni CV
- Acento del cliente: CSS vars `--accent`, `--accent-contrast`, clase `text-on-accent`
- Consentimiento RGPD: casilla **sin marcar**, bloquea envío; `/privacidad` en pestaña nueva
- Builder dnd-kit: alternativa teclado subir/bajar obligatoria; Safari puede fallar en autoscroll

## Accesibilidad (suelo)

- `:focus-visible` siempre visible
- `<button>` / `<a>` reales
- Tablas semánticas con `aria-sort`
- Drag-to-reorder con alternativa teclado
- `prefers-reduced-motion` respetado
- Placeholder con significado ≥ 4.5:1

## Copy (glosario congelado)

| Usar | No usar |
| --- | --- |
| puesto | vacante, oferta, campaña |
| candidato | — |
| candidatura | envío (solo si aclara) |
| enlace | link |
| exportar | — |

Estados: nuevo, contactado, entrevista, descartado, contratado.

## Pricing (referencia copy)

- Pago por proceso abierto: 49 €/mes **+ IVA** por proceso (el IVA se dice siempre junto al precio)
- Todo el producto incluido; nunca cobrar por candidatos ni por usuario
- Prueba: primer proceso gratis 15 días o 25 candidaturas, sin tarjeta
- Pausar sigue cobrando y la UI lo dice; cerrar es un clic y deja de cobrarse
- Números redondos, sin `.99`

## Verificación ampliada

### Comandos (cwd explícito)

```bash
cd /Users/mario/criba && npm run build
cd /Users/mario/criba && npx tsc -b --noEmit
```

### Visual

1. Abrir la ruta afectada en navegador (`npm run dev` → http://localhost:5173)
2. Captura + revisión de jerarquía, espaciado, alineación
3. Probar estados: hover, focus, active, error, vacío, loading
4. En formulario público: simular envío fallido y confirmar que persiste lo escrito
5. Comprobar que acento no aparece en chips de estado

### Gotchas del entorno

- Preview embebido Chrome: no reproduce Safari/WebKit ni gestos dnd-kit
- `IntersectionObserver` no dispara en preview: usar animación CSS en montaje
- Para capturar secciones bajas: ocultar temporalmente las de arriba + `scrollTo(0,0)`

## Relación con otras skills

- **`impeccable`**: metodología genérica de craft UI. Usar junto con esta skill; la doctrina de Apúntate Fácil **gana** en conflictos.
- **`.cursor/rules/*.mdc`**: reglas por glob; esta skill las sintetiza para trabajo de diseño transversal.
