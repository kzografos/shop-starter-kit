// Single source of truth for the shop's real business details.
// Used by the footer, contact page, WhatsApp button, and SEO structured data.
export const BUSINESS = {
  name: 'Mike Animal Show', // short brand for UI
  legalName: 'Mike Animal Show Pet Shop', // full name for SEO / structured data
  tagline: 'Everything you need, delivered to your door.',

  phone: '+35799584273', // tel: link
  phoneDisplay: '+357 99 584 273', // human-readable
  whatsapp: '35799584273', // wa.me number (no +)

  address: {
    street: 'Anexartisias 100',
    postalCode: '3040',
    city: 'Limassol',
    region: 'Limassol',
    country: 'CY',
    countryName: 'Cyprus',
  },

  geo: { lat: 34.6857, lon: 33.0292 },

  // Display hours — `key` maps to an i18n label, `value` is shown as-is.
  displayHours: [
    { key: 'weekdays', value: '09:00 – 19:00' }, // Mon–Tue, Thu–Fri
    { key: 'wednesday', value: '09:00 – 14:00' },
    { key: 'saturday', value: '09:00 – 15:00' },
    { key: 'sunday', value: null }, // closed
  ] as const,

  // Machine-readable hours for schema.org openingHoursSpecification.
  schemaHours: [
    { days: ['Monday', 'Tuesday', 'Thursday', 'Friday'], opens: '09:00', closes: '19:00' },
    { days: ['Wednesday'], opens: '09:00', closes: '14:00' },
    { days: ['Saturday'], opens: '09:00', closes: '15:00' },
  ],
}
