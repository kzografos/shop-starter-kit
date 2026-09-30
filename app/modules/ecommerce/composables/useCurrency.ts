// Money presentation for the shop. The currency is the project's
// (`app.config.region`, a Core contract the project fills — C3e); the Intl
// locale is the active i18n locale's `language` (the project's locale config).
// Neither is decided here.
export function useCurrency() {
  const { localeProperties } = useI18n()
  const appConfig = useAppConfig()

  // No fallback: without a `language` Intl would format in the host's default
  // locale, which silently differs between server and browser.
  function intlLocale(): string {
    const { code, language } = localeProperties.value
    if (!language) throw new Error(`useCurrency: locale "${code}" has no \`language\` in the i18n config`)
    return language
  }

  function formatter(): Intl.NumberFormat {
    return new Intl.NumberFormat(intlLocale(), {
      style: 'currency',
      currency: appConfig.region.currency,
      minimumFractionDigits: 2,
    })
  }

  function formatPrice(amount: number | string): string {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount
    return formatter().format(num)
  }

  // The symbol exactly as the formatter renders it for the active locale.
  const currencySymbol = computed(() => {
    const part = formatter().formatToParts(0).find((p) => p.type === 'currency')
    if (!part) throw new Error(`useCurrency: Intl produced no currency symbol for ${appConfig.region.currency}`)
    return part.value
  })

  return { formatPrice, currencySymbol }
}
