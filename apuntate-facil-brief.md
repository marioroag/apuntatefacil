# Apúntate Fácil — Brief de empresa

> Documento para dar contexto a un asesor de dirección. Recoge lo que hay a día de hoy
> (junio 2026): producto, mercado, modelo de negocio, marca, stack, estado y decisiones.
> Es una foto del estado real, no un plan cerrado.

---

## 1. En una frase

SaaS español que ordena la contratación que hoy se hace por chat (sobre todo **Milanuncios**)
para perfiles **blue-collar / locales**: la empresa sigue poniendo su anuncio como siempre, pero
a quien responde le manda **un enlace** en vez de chatear; el enlace abre un **formulario corto**,
cada envío entra como **candidato ordenado** en una lista que se **filtra y exporta a Excel**.

- **Marca:** Apúntate Fácil
- **Dominio:** apuntatefacil.com
- **Tagline:** "Apúntate fácil, contrata fácil."
- **Promesa de portada:** "Un mensaje es todo lo que necesitas para contratar."

---

## 2. El problema y la propuesta de valor

**Problema:** cada vacante en Milanuncios recibe decenas de respuestas (referencia de sector que
usamos: ~56 por vacante) que se pierden en el chat. El que contrata contesta lo mismo 30 veces,
copia teléfonos a mano, y para cuando llama al bueno ya está pillado.

**Propuesta:** todas las respuestas en un sitio, ordenadas. Tú mandas un enlace y eliges sin perder
a nadie. El orden lo pone el sistema, no la persona.

**Cómo funciona (3 pasos):**
1. Pones tu anuncio en Milanuncios como siempre.
2. A quien te conteste le mandas un enlace (formulario corto, mobile-first, las preguntas las eliges tú).
3. Recibes todo ordenado en una pantalla: filtras (carnet, zona, experiencia), marcas estados, exportas a Excel.

---

## 3. Mercado y posicionamiento

- **Cliente:** quien contrata por Milanuncios y similares. Multisector blue-collar: **hostelería,
  construcción, logística, limpieza, comercio, reformas, cuidados**. Desde un bar a una ETT con varias sedes.
- **Anclaje de coste** (lo que cuesta contratar hoy, que usamos para justificar el precio):
  - A mano: ~56 candidatos por vacante en chats sueltos, horas revisando, buenos perfiles que se pierden.
  - Pagando: oferta destacada en InfoJobs **295–369 €**; empresa de selección **15–20 % del salario**;
    una mala contratación puede costar **hasta 3 sueldos**.
- **Diferenciación:** no traemos candidatos (eso lo sigue haciendo el anuncio del cliente); ordenamos
  y filtramos a los que ya llegan. Honestidad explícita: "no te traemos gente nueva" era una promesa de marca.

---

## 4. Modelo de negocio y precios

Suscripción mensual o **anual (2 meses gratis = mensual × 10)**, IVA aparte, **sin permanencia**,
cancelar/reanudar cuando quieras. "Lo que ves es lo que pagas" (sin precios "desde" ni letra pequeña).

| Plan | Precio/mes | Puestos a la vez | Lo que añade |
| --- | --- | --- | --- |
| **Prueba** (free) | 0 € | 1 | Hasta 15 candidatos. Sin tarjeta. Al llegar a 15, el puesto se pausa hasta subir de plan. Es el punto de entrada por defecto de toda cuenta nueva. |
| **Esencial** | 150 € | 2 | Candidatos y usuarios ilimitados, formulario a medida, filtros/notas/valoraciones, export a Excel, soporte humano. |
| **Pro** (recomendado) | 250 € | 10 | Todo lo de Esencial + Bandeja (nuevos de todos los puestos en una lista), vistas guardadas, 1 marca con branding. |
| **Multi** | 450 € | ∞ | Todo lo de Pro + sedes, encargados por sede, marcas ilimitadas, resumen de todas las sedes. |

- **Anual:** Esencial 1500 € / Pro 2500 € / Multi 4500 € al año.
- **Topes técnicos (servidor):** candidatos por cuenta — Prueba 15, resto ∞. Marcas — Pro 1, Multi ∞.
- **Roles de equipo:** propietario (owner), miembro, encargado (acotado por sede, solo ve/exporta lo suyo).
- **Freemium:** el plan de Prueba se añadió hace nada como embudo de entrada (probar gratis → toparse con
  el límite → subir de plan). Antes "trial" era un muro de pago; ahora da acceso real con topes.

---

## 5. Marca y principios

- **Voz:** directa, honesta, sin jerga, para alguien que no es de oficina. Tuteo.
- **Sin dark patterns** (decisión firme): nada de urgencia falsa, prueba social inventada, costes ocultos
  ni fricción de salida. Precios redondos y citables.
- **Diseño:** acento índigo `#4F46E5` solo para acción/navegación/foco; nunca para estados. 5 estados de
  candidato con paleta propia (nuevo slate, contactado azul, entrevista ámbar, contratado verde,
  descartado slate apagado, nunca rojo). Alineación a la izquierda, titulares que cuentan la historia solos.
- **WYSIWYG real:** un único renderizador pinta a la vez la preview del constructor y el formulario público.

---

## 6. Stack técnico e infraestructura

- **Frontend:** Vite + React 19 + TypeScript + Tailwind v4 + react-router + framer-motion + dnd-kit +
  SheetJS (export Excel). SPA estática.
- **Backend:** Supabase (Postgres con RLS + Auth + Storage + Edge Functions en Deno). Región Central EU (Frankfurt).
- **Pagos:** Stripe (Checkout + suscripciones + webhook). Cuenta "arc".
- **Email:** Resend (aviso de nueva candidatura, invitaciones, y emails de acceso vía SMTP de Supabase Auth).
- **Login:** email + contraseña y Google.
- **Hosting:** Vercel (apuntatefacil.com).
- **4 superficies:** `/` landing · `/app` panel del cliente · `/app/puestos/:id` base de candidatos +
  constructor de formulario · `/a/:slug` formulario público mobile-first.

---

## 7. Estado actual (junio 2026)

- **Fase:** pre-lanzamiento. La web y el panel están **desplegados en producción** y funcionando.
- **Stripe en modo TEST** (fase de pruebas). Ya están creados los precios anuales en **live** para el día
  del lanzamiento; cuando se pase a live solo hay que cablear esas claves.
- **Construido y operativo:** puestos + formularios personalizables, formulario público con CV, gestión de
  candidatos (estados, valoración de 5 estrellas, notas, filtros, export a Excel), Bandeja, vistas guardadas,
  sedes y encargados, marcas con branding, invitaciones de equipo, dashboard, billing completo (alta, cambio
  de plan con prorrateo, cancelar/reanudar), GDPR básico, landing + FAQ + privacidad.
- **Añadido muy reciente:** plan de Prueba (freemium con autopausa al límite), facturación anual con switch
  mensual/anual, cambio de periodo sin cambiar de plan, y reanudar suscripción tras cancelar.
- **Landing:** refrescada (hero "Un mensaje es todo lo que necesitas para contratar", sección comparativa
  "Mira la diferencia en el propio chat", precios sin anclaje agresivo, FAQ).

---

## 8. Equipo

- **Fundador:** Mario (trabaja en solitario). Se defiende en la terminal pero no es desarrollador senior;
  construye el producto apoyándose en IA (el flujo típico es: él hace los clics en webs, la IA hace la parte
  de terminal/código). Implica que conviene explicar las decisiones técnicas en términos claros.

---

## 9. Decisiones ya tomadas (para no relitigar)

- Precios redondos (150/250/450), sin "desde", sin permanencia, IVA aparte.
- Anual = 2 meses gratis.
- El plan de Prueba es la puerta de entrada por defecto (no un plan que se "compra"); 1 puesto y 15 candidatos.
- Sin dark patterns, copy honesto incluso cuando resta (p. ej. "no te traemos gente nueva").
- El producto **no** capta candidatos; ordena los que llegan del anuncio del cliente.
- España primero (idioma, €, "Hecho en España").

---

## 10. Preguntas abiertas / temas para dirección

> No son decisiones tomadas; son los frentes donde un asesor aportaría más.

- **Dependencia de Milanuncios:** el valor depende de que el cliente siga trayendo candidatos por su cuenta.
  ¿Riesgo de concentración? ¿Conviene posicionar también para otros canales (carteles/QR, redes, etc.)?
- **Captación de clientes (go-to-market):** ¿cómo llega Apúntate Fácil a bares, obras, ETTs? No hay aún un
  motor de adquisición definido. Canal, mensaje y coste de adquisición están por validar.
- **Validación de precio:** 150–450 €/mes es premium para un bar pequeño y barato para una ETT. ¿Segmentar
  el mensaje por tamaño de cliente? ¿El plan de Prueba convierte lo suficiente?
- **Lanzamiento:** queda pasar Stripe a live y abrir registro real. ¿Beta con tiendas/empresas gratis primero?
- **Monetización del freemium:** ¿15 candidatos es el límite correcto para forzar el upgrade sin frustrar?
- **Defensibilidad:** el producto es replicable; ¿la ventaja es marca/honestidad/UX, o hace falta foso (datos,
  integraciones, comunidad)?
- **Soporte humano** como promesa: escala con un fundador en solitario, ¿hasta cuándo?

---

## 11. Infra (referencia, sin secretos)

- Frontend en Vercel, dominio apuntatefacil.com.
- Supabase de producción (Postgres + Edge Functions), región Central EU (Frankfurt).
- Stripe cuenta "arc" (hoy en test; precios mensuales y anuales creados para Esencial/Pro/Multi).
- Resend para email transaccional.
- Las claves viven cifradas en Supabase/Vercel; no se incluyen aquí.
