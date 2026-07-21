// Plantilla única de los correos que enviamos por Resend (aviso de candidatura nueva,
// invitación al equipo). Doctrina "Instrumento de precisión": sobria y de marca, una
// superficie blanca sobre el gris de la app, un único acento ultramarine para la acción.
// Sin gradientes ni imágenes; layout con tablas y estilos en línea para que aguante en
// Gmail / Outlook / Apple Mail. En email no carga Geist: la marca la lleva el wordmark.

const C = {
  accent: '#374cce',
  ink: '#131822',
  ink2: '#50545e',
  ink3: '#6f727c',
  bg: '#f9fafb',
  surface: '#ffffff',
  border: '#e5e7eb',
}
const FONT = "system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"

// Escapa texto para incrustarlo en HTML. El cuerpo (bodyHtml) lo compone el llamante,
// que debe escapar él mismo cualquier dato de usuario; el resto lo escapa renderEmail.
export const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

// Buzón donde caen los avisos de soporte (consulta nueva y respuesta del cliente).
// Por defecto el correo del fundador, mismo criterio que el allowlist de is_support_staff;
// el secret SUPPORT_TO lo sobreescribe en prod cuando haya buzón compartido (soporte@).
export const SUPPORT_INBOX = Deno.env.get('SUPPORT_TO') ?? 'mario.rodriguez.aguado@gmail.com'

// Correo plano para soporte: como el de una persona, no de marketing. Sin tarjeta ni
// botón: fondo blanco, una columna estrecha, texto a la izquierda, con el wordmark
// arriba como única marca. El acento ultramarine queda solo si el cuerpo incluye un
// enlace (acción). El cuerpo lo compone el llamante (escapando sus datos).
export function renderPlainEmail(preview: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"></head>
<body style="margin:0;padding:0;background:#ffffff">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preview)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff">
    <tr><td style="padding:24px 20px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;text-align:left">
        <tr><td style="font-family:${FONT};color:${C.ink}">
          <div style="font-size:17px;font-weight:800;letter-spacing:-0.02em">apuntatefacil</div>
          <div style="margin:22px 0 0;font-size:15px;line-height:1.65">${bodyHtml}</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

export type EmailButton = { label: string; href: string }

export function renderEmail(opts: {
  preview: string // texto del preheader (la línea que asoma en la bandeja)
  heading?: string // titular opcional: en avisos sí, en correos conversacionales no
  bodyHtml: string // HTML ya compuesto y escapado por el llamante
  button?: EmailButton
  buttons?: EmailButton[]
  footnote?: string
}): string {
  const { preview, heading, bodyHtml, button, buttons, footnote } = opts
  const head = heading
    ? `<h1 style="margin:24px 0 0;font-family:${FONT};font-size:19px;font-weight:600;letter-spacing:-0.01em;line-height:1.35;color:${C.ink}">${esc(heading)}</h1>`
    : ''
  const allButtons = buttons ?? (button ? [button] : [])
  const btn = allButtons.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 0">
        ${allButtons.map((item, index) => `
          <tr><td style="${index ? 'padding-top:8px;' : ''}">
            <a href="${item.href}" style="display:block;padding:12px 22px;font-family:${FONT};font-size:15px;font-weight:600;line-height:1.15;text-align:center;text-decoration:none;border-radius:8px;${index === 0 ? `background:${C.accent};color:#ffffff` : `background:#ffffff;color:${C.ink};border:1px solid ${C.border}`}">${esc(item.label)}</a>
          </td></tr>`).join('')}
       </table>`
    : ''
  const foot = footnote
    ? `<p style="margin:24px 0 0;font-family:${FONT};font-size:13px;line-height:1.6;color:${C.ink3}">${esc(footnote)}</p>`
    : ''
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"></head>
<body style="margin:0;padding:0;background:${C.bg}">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preview)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.bg}">
    <tr><td align="center" style="padding:40px 16px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;text-align:left">
        <tr><td style="background:${C.surface};border:1px solid ${C.border};border-radius:16px;padding:32px">
          <div style="font-family:${FONT};font-size:17px;font-weight:800;letter-spacing:-0.02em;color:${C.ink}">apuntatefacil</div>
          ${head}
          <div style="margin:${heading ? '10px' : '24px'} 0 0;font-family:${FONT};font-size:15px;line-height:1.6;color:${C.ink2}">${bodyHtml}</div>
          ${btn}
          ${foot}
        </td></tr>
        <tr><td style="padding:16px 8px 0;font-family:${FONT};font-size:12px;line-height:1.6;color:${C.ink3}">
          Apúntate Fácil · apuntatefacil.com
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}
