import { SEED, SEED_BRANDS } from './seed'
import { brandAssetUrl } from './brandAsset'
import { DEMO_COMPANY } from './auth'
import { anuncioVacio } from './anuncio'
import type { Anuncio } from './anuncio'
import type { Campaign } from './types'

/**
 * EL ENLACE PÚBLICO DE UN PUESTO DE LA DEMO.
 *
 * Los seis puestos de la demo viven en `localStorage`, no en la base, así que
 * `get_public_campaign` no los conoce: hasta hoy, copiar el enlace de un puesto
 * en /demo y abrirlo daba "Este enlace ya no está activo". La demo enseñaba una
 * puerta que no abre, que es exactamente lo que esta doctrina prohíbe en todas
 * partes menos aquí, por descuido.
 *
 * Importa mal el seed (es grande) desde el chunk del formulario público, así que
 * QUIEN LO CARGA LO HACE A MANO Y TARDE: `PublicForm` solo lo pide con un
 * `import()` dinámico cuando el RPC no reconoce el slug, o cuando no hay
 * Supabase configurado. Un candidato de verdad no se descarga nunca este módulo.
 *
 * NO lee `localStorage`: lo que se enseña es el SEED, no la demo que ese
 * navegador tenga a medias. El enlace tiene que decir lo mismo abierto desde
 * otro ordenador, que es para lo que sirve un enlace.
 */
export type PuestoPublicoDemo = {
  campaign: Campaign
  anuncio: Anuncio
  companyName: string
  companyDescription: string
  retencionMeses: number | null
  logoUrl: string | null
  bannerUrl: string | null
  location: string
  provincia: string
  otros: OtroPuesto[]
}

/** Un puesto de la lista de "otros abiertos", con la foto de SU marca. */
export type OtroPuesto = {
  slug: string
  title: string
  location: string
  provincia: string
  brandLabel: string
  bannerUrl: string | null
}

const marcaDe = (brandId: string | null) =>
  (brandId ? SEED_BRANDS.find((b) => b.id === brandId) : null) ?? null

const nombreDe = (c: Campaign) => marcaDe(c.brandId)?.name || SEED.company.name

export function puestoPublicoDemo(slug: string | undefined): PuestoPublicoDemo | null {
  if (!slug) return null
  const campaign = SEED.campaigns.find((c) => c.slug === slug)
  if (!campaign) return null

  return {
    campaign,
    anuncio: campaign.anuncio ?? anuncioVacio(),
    companyName: nombreDe(campaign),
    companyDescription: DEMO_COMPANY.descripcion,
    retencionMeses: DEMO_COMPANY.retencion_meses,
    // Las marcas de la demo apuntan a ficheros de `public/brand-demo`, no al
    // bucket: `brandAssetUrl` devuelve las rutas absolutas tal cual, así que la
    // demo enseña su foto de cabecera igual que un puesto de verdad.
    logoUrl: brandAssetUrl(marcaDe(campaign.brandId)?.logoPath),
    bannerUrl: brandAssetUrl(marcaDe(campaign.brandId)?.bannerPath),
    location: campaign.location,
    provincia: campaign.provincia,
    // Mismas reglas que el RPC: solo puestos activos y como mucho cinco.
    otros: SEED.campaigns
      .filter((c) => c.id !== campaign.id && c.status === 'activa')
      .slice(0, 5)
      .map((c) => ({
        slug: c.slug,
        title: c.title,
        location: c.location,
        provincia: c.provincia,
        brandLabel: nombreDe(c),
        bannerUrl: brandAssetUrl(marcaDe(c.brandId)?.bannerPath),
      })),
  }
}
