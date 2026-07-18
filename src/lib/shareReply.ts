const LEGACY_POSITION_TOKEN = '{{puesto}}'
const LEGACY_LINK_TOKEN = '{{enlace}}'

export function replyBodyForCampaign({ title }: { title: string }): string {
  const puesto = title.trim() || 'este puesto'
  return `Hola, gracias por escribir. Para apuntarte a ${puesto}, rellena este formulario corto (1 min):`
}

/**
 * Las plantillas creadas durante la versión con fichas siguen siendo válidas:
 * resolvemos el puesto y retiramos el enlace, que ahora añade siempre el sistema.
 */
export function editableReplyBody({
  body,
  title,
}: {
  body?: string | null
  title: string
}): string {
  if (!body?.trim()) return replyBodyForCampaign({ title })
  return body
    .replaceAll(LEGACY_POSITION_TOKEN, title.trim() || 'este puesto')
    .replaceAll(LEGACY_LINK_TOKEN, '')
    .trim()
}

export function replyForCampaign({
  title,
  url,
  body,
}: {
  title: string
  url: string
  body?: string | null
}): string {
  return `${editableReplyBody({ body, title })}\n${url}`
}
