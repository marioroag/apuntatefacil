// La plantilla guarda solo el texto del mensaje. El enlace público se añade al
// copiar, así no se puede borrar ni quedarse obsoleto al cambiar la marca.

export function replyBodyForCampaign({ title }: { title: string }): string {
  const puesto = title.trim() || 'este puesto'
  return `Hola, gracias por escribir. Para apuntarte a ${puesto}, rellena este formulario corto (1 min):`
}

export function replyForCampaign({ title, url, body }: { title: string; url: string; body?: string }): string {
  return `${body?.trim() || replyBodyForCampaign({ title })}\n${url}`
}
