// Single source of truth for the shop's real business details.
// Used by the footer, contact page, WhatsApp button, and SEO structured data.
export const BUSINESS = {
  name: 'Sample Store',
  legalName: 'Sample Store',
  tagline: 'Everything you need, delivered to your door.',

  brand: {
    logo: null as string | null,          // null → text lockup; set a path to override
    logoInverted: null as string | null,
    wordmarkAccent: 'Store',              // suffix of `name` rendered in accent colour; '' = none
    favicon: '/favicon.svg',              // browser-tab icon (<link rel=icon>); swap to rebrand
    ogImage: '/og-image.png',             // social share card; app.vue resolves it to an absolute URL
    social: { instagram: null, facebook: null, tiktok: null } as Record<string, string | null>,
    whatsappEnabled: true,
  },

  // Contact numbers. Every consumer treats an empty string as "not configured"
  // and hides the corresponding UI, so a store with no phone renders cleanly.
  phone: '', // tel: link, e.g. '+35722000000'
  phoneDisplay: '', // human-readable, e.g. '+357 22 000 000'
  whatsapp: '', // wa.me number, digits only, no '+' — empty hides the button

  address: {
    street: 'Anexartisias 100',
    postalCode: '3040',
    city: 'Limassol',
    region: 'Limassol',
    country: 'CY',
    countryName: 'Cyprus',
  },

  geo: { lat: 34.6857, lon: 33.0292 },

  // IANA timezone for the open/closed calculation (useOpeningHours).
  timezone: 'Asia/Nicosia',

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

// Regional settings (C3e). The currency every price is shown in; the core
// and the modules receive it through `app.config.region`, never from here.
// The backend charges in its own configured currency — keep the two equal.
export const REGION = {
  currency: 'EUR',
}

// The languages this shop is served in, and the one served without a URL
// prefix (C3d). Build-time: the root nuxt.config.ts reads them for
// @nuxtjs/i18n, which keeps the mechanism (strategy, detection, langDir).
// `file` names the root message file for that locale. `as const`: the i18n
// module types locale codes as a literal union.
export const LOCALES = {
  locales: [
    { code: 'el', name: 'Ελληνικά', file: 'el.json', language: 'el-GR' },
    { code: 'en', name: 'English', file: 'en.json', language: 'en-GB' },
  ],
  defaultLocale: 'el',
} as const
