// Injects schema.org LocalBusiness/Store JSON-LD so the shop is eligible for
// Google rich results (name, address, geo, hours, phone) — local SEO for the store in Limassol.
import { BUSINESS } from '~/utils/business'

export const useBusinessSchema = () => {
  const { public: { siteUrl } } = useRuntimeConfig()
  const base = (siteUrl as string) || 'http://localhost:3000'

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Store',
    name: BUSINESS.legalName,
    description: BUSINESS.tagline,
    // Only advertise an image when a real logo asset is configured (avoids a 404).
    ...(BUSINESS.brand.logo ? { image: `${base}${BUSINESS.brand.logo}` } : {}),
    url: base,
    telephone: BUSINESS.phone,
    priceRange: '€€',
    currenciesAccepted: 'EUR',
    address: {
      '@type': 'PostalAddress',
      streetAddress: BUSINESS.address.street,
      postalCode: BUSINESS.address.postalCode,
      addressLocality: BUSINESS.address.city,
      addressRegion: BUSINESS.address.region,
      addressCountry: BUSINESS.address.country,
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: BUSINESS.geo.lat,
      longitude: BUSINESS.geo.lon,
    },
    openingHoursSpecification: BUSINESS.schemaHours.map((h) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: h.days,
      opens: h.opens,
      closes: h.closes,
    })),
  }

  useHead({
    script: [{ type: 'application/ld+json', innerHTML: JSON.stringify(schema) }],
  })
}
