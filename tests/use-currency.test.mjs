// useCurrency (app/modules/ecommerce/composables/useCurrency.ts): prices and the
// currency symbol follow the project's currency (app.config.region) and the
// active i18n locale's `language`, and follow a locale switch without a reload.
//   pnpm test
// Nuxt auto-imports (useI18n, useAppConfig, computed) are stubbed on globalThis
// with real Vue reactivity; the locale objects mirror the project's config.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computed, ref } from 'vue'

const LOCALES = [
  { code: 'el', language: 'el-GR' },
  { code: 'en', language: 'en-GB' },
  { code: 'xx' }, // no `language`: must fail loudly, never format in the host locale
]
const active = ref('el')
globalThis.computed = computed
globalThis.useI18n = () => ({ localeProperties: computed(() => LOCALES.find((l) => l.code === active.value)) })
globalThis.useAppConfig = () => ({ region: { currency: 'EUR' } })

const { useCurrency } = await import('../app/modules/ecommerce/composables/useCurrency.ts')
const VALUES = [0, 5, 49.99, 1234.5, -3.5]
// Intl separates the Greek amount from the symbol with a no-break space.
const NBSP = String.fromCharCode(0xa0)

test('el → el-GR: prices and symbol', () => {
  active.value = 'el'
  const { formatPrice, currencySymbol } = useCurrency()
  assert.deepEqual(VALUES.map(formatPrice), [`0,00${NBSP}€`, `5,00${NBSP}€`, `49,99${NBSP}€`, `1.234,50${NBSP}€`, `-3,50${NBSP}€`])
  assert.equal(currencySymbol.value, '€')
})

test('en → en-GB: prices and symbol', () => {
  active.value = 'en'
  const { formatPrice, currencySymbol } = useCurrency()
  assert.deepEqual(VALUES.map(formatPrice), ['€0.00', '€5.00', '€49.99', '€1,234.50', '-€3.50'])
  assert.equal(currencySymbol.value, '€')
})

test('string amounts are parsed as before', () => {
  active.value = 'el'
  assert.equal(useCurrency().formatPrice('49.99'), `49,99${NBSP}€`)
})

test('one instance follows locale switches el → en → el without a reload', () => {
  active.value = 'el'
  const { formatPrice, currencySymbol } = useCurrency()
  assert.equal(formatPrice(1234.5), `1.234,50${NBSP}€`)
  active.value = 'en'
  assert.equal(formatPrice(1234.5), '€1,234.50')
  assert.equal(currencySymbol.value, '€')
  active.value = 'el'
  assert.equal(formatPrice(1234.5), `1.234,50${NBSP}€`)
  assert.equal(currencySymbol.value, '€')
})

test('the symbol comes from Intl for the configured currency, not a literal', () => {
  active.value = 'en'
  globalThis.useAppConfig = () => ({ region: { currency: 'GBP' } })
  try {
    const { formatPrice, currencySymbol } = useCurrency()
    assert.equal(currencySymbol.value, '£')
    assert.equal(formatPrice(5), '£5.00')
  } finally {
    globalThis.useAppConfig = () => ({ region: { currency: 'EUR' } })
  }
})

test('a locale without `language` fails loudly instead of using the host locale', () => {
  active.value = 'xx'
  const { formatPrice } = useCurrency()
  assert.throws(() => formatPrice(5), /locale "xx" has no `language`/)
  active.value = 'el'
})
