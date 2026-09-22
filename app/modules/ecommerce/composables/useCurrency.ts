export function useCurrency() {
  const { locale } = useI18n()

  function formatPrice(amount: number | string): string {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount
    return new Intl.NumberFormat(locale.value === 'el' ? 'el-GR' : 'en-CY', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
    }).format(num)
  }

  return { formatPrice }
}
