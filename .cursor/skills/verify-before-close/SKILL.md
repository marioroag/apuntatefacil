---
name: verify-before-close
description: Verification checklist before closing any Apúntate Fácil task — browser testing for UI changes, build, tsc, gotchas (Chrome preview, Safari/dnd-kit, IntersectionObserver). Use when finishing a task, before saying done, after UI/UX changes, or when the user mentions verificar, build, revisar, or comprobar.
---

# Apúntate Fácil · Verificar antes de cerrar

Mismo rigor en el cambio pequeño que en el grande. **No dar nada por bueno sin verlo.**

## 1. ¿Hay cambio observable?

Si tocó UI, copy, layout, interacción o formulario: **obligatorio navegador**. Si solo backend/types sin efecto visible: build + tsc bastan.

## 2. Navegador (cambios observables)

1. `cd /Users/mario/criba && npm run dev` → http://localhost:5173
2. Abrir la ruta afectada (demo: `/demo/*`; real: `/app/...`; público: `/a/:slug`)
3. Capturar, mirar jerarquía/espaciado/alineación
4. Probar interacciones: clicks, toggles, hover, focus, error, vacío, loading
5. Formulario público: envío fallido → **no** debe borrar respuestas ni CV
6. Estados candidato: acento ultramarine **no** en chips de estado; descartado **sin rojo**

## 3. Build y tipos (siempre)

```bash
cd /Users/mario/criba && pwd    # confirmar cwd
cd /Users/mario/criba && npm run build
cd /Users/mario/criba && npx tsc --noEmit
```

El cwd del shell se resetea entre llamadas: **siempre** `cd /Users/mario/criba` explícito.

## 4. Gotchas del entorno

| Problema | Qué hacer |
| --- | --- |
| Preview Chrome no reproduce Safari/WebKit | Pedir verificación en navegador real o solución determinista |
| dnd-kit drag no funciona en preview | Eventos sintéticos no disparan sensores; probar en navegador real |
| Safari autoscroll dnd-kit deriva | Bug conocido; no desplegar a ciegas |
| `IntersectionObserver` / `whileInView` | No dispara en preview embebido; usar animación CSS en montaje |
| Capturar sección baja | Ocultar temporalmente secciones de arriba + `scrollTo(0,0)` |

## 5. Cierre

Si algo no cumple: **rehacer** antes de reportar terminado. No cerrar con "debería funcionar".

## Referencias

- Regla: `.cursor/rules/project.mdc`
- Diseño: `.cursor/skills/apuntate-design/SKILL.md`
