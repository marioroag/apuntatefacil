// Copia texto al portapapeles de forma robusta. navigator.clipboard solo existe
// en contextos seguros (https o localhost); si abres la app por IP de red, en
// http, o en navegadores que lo bloquean, falla. En ese caso usamos el método
// clásico (textarea oculto + execCommand) que funciona casi en cualquier sitio.
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* cae al método clásico */
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.top = '-9999px'
    document.body.appendChild(ta)
    ta.select()
    ta.setSelectionRange(0, text.length)
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}
