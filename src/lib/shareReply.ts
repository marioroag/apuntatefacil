/**
 * Una respuesta se persiste como texto portable, no como el estado del editor.
 * Así el título y la URL se resuelven siempre con los datos actuales del puesto.
 */
export const SHARE_POSITION_TOKEN = '{{puesto}}'
export const SHARE_LINK_TOKEN = '{{enlace}}'

export type ShareToken = typeof SHARE_POSITION_TOKEN | typeof SHARE_LINK_TOKEN

export type ReplySegment =
  | { type: 'text'; value: string }
  | { type: 'token'; value: ShareToken }

const TOKEN_PATTERN = /(\{\{puesto\}\}|\{\{enlace\}\})/g

export function defaultReplyTemplate(): string {
  return `Hola, gracias por escribir. Para apuntarte a ${SHARE_POSITION_TOKEN}, rellena este formulario corto (1 min):\n${SHARE_LINK_TOKEN}`
}

/**
 * Mantiene el contenido de plantillas antiguas tal cual, salvo la garantía de
 * que existe exactamente una ficha de enlace. Es la única ficha obligatoria.
 */
export function normalizeReplyTemplate(template?: string | null): string {
  const source = template?.length ? template : defaultReplyTemplate()
  let seenLink = false
  let seenPosition = false
  let normalized = source.replace(/(\{\{puesto\}\}|\{\{enlace\}\})/g, (token) => {
    if (token === SHARE_LINK_TOKEN) {
      if (seenLink) return ''
      seenLink = true
      return SHARE_LINK_TOKEN
    }
    if (seenPosition) return ''
    seenPosition = true
    return SHARE_POSITION_TOKEN
  })
  if (!seenLink) normalized += `${normalized.endsWith('\n') || !normalized ? '' : '\n'}${SHARE_LINK_TOKEN}`
  return normalized
}

export function tokenizeReplyTemplate(template?: string | null, normalize = true): ReplySegment[] {
  const normalized = normalize ? normalizeReplyTemplate(template) : (template ?? '')
  const segments: ReplySegment[] = []
  let lastIndex = 0
  for (const match of normalized.matchAll(TOKEN_PATTERN)) {
    if (match.index === undefined) continue
    if (match.index > lastIndex) segments.push({ type: 'text', value: normalized.slice(lastIndex, match.index) })
    segments.push({ type: 'token', value: match[0] as ShareToken })
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < normalized.length) segments.push({ type: 'text', value: normalized.slice(lastIndex) })
  return segments
}

export function serializeReplySegments(segments: ReplySegment[]): string {
  const template = segments
    .map((segment) => segment.value)
    .join('')
  return normalizeReplyTemplate(template)
}

export function resolveReplyTemplate({
  template,
  title,
  url,
}: {
  template?: string | null
  title: string
  url: string
}): string {
  const puesto = title.trim() || 'este puesto'
  return normalizeReplyTemplate(template)
    .replaceAll(SHARE_POSITION_TOKEN, puesto)
    .replaceAll(SHARE_LINK_TOKEN, url)
}
