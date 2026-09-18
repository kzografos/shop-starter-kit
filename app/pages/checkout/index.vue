<template>
  <div class="bg-surface-page min-h-screen">
    <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <h1 class="font-display text-2xl font-bold text-[--color-bark] mb-6">{{ $t('checkout.title') }}</h1>

    <CheckoutSteps :current-step="2" />

    <div v-if="cartStore.items.length === 0" class="text-center py-20">
      <p class="text-gray-500 mb-4">{{ $t('cart.empty') }}</p>
      <UButton :label="$t('cart.continue_shopping')" :to="localePath('/products')" />
    </div>

    <div v-else class="grid lg:grid-cols-5 gap-8">
      <!-- Left: form -->
      <div class="lg:col-span-3 space-y-8">
        <!-- Contact (guest checkout) -->
        <UCard v-if="isGuest">
          <template #header>
            <h2 class="font-semibold">{{ $t('checkout.contact') }}</h2>
          </template>
          <UFormField :label="$t('checkout.email')" :hint="$t('checkout.email_hint')">
            <UInput v-model="form.guest_email" type="email" autocomplete="email" class="w-full" />
          </UFormField>
          <p class="mt-3 text-sm text-[--color-bark-light]">
            {{ $t('checkout.have_account') }}
            <NuxtLink :to="{ path: localePath('/login'), query: { redirect: localePath('/checkout') } }" class="text-terracotta font-medium hover:underline">
              {{ $t('header.login') }}
            </NuxtLink>
          </p>
        </UCard>

        <!-- Fulfillment type -->
        <UCard>
          <template #header>
            <h2 class="font-semibold">{{ $t('checkout.shipping') }}</h2>
          </template>
          <URadioGroup
            v-model="form.fulfillment_type"
            :items="[
              { value: 'shipping', label: $t('checkout.shipping') },
              { value: 'pickup', label: $t('checkout.pickup') },
            ]"
          />

          <!-- Shipping address (only when shipping selected) -->
          <div v-if="form.fulfillment_type === 'shipping'" class="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField :label="$t('checkout.full_name')" class="sm:col-span-2">
              <UInput v-model="form.shipping_address.full_name" class="w-full" />
            </UFormField>
            <UFormField :label="$t('checkout.address')" class="sm:col-span-2">
              <UInput v-model="form.shipping_address.address" class="w-full" />
            </UFormField>
            <UFormField :label="$t('checkout.city')">
              <UInput v-model="form.shipping_address.city" class="w-full" />
            </UFormField>
            <UFormField :label="$t('checkout.postal_code')">
              <UInput v-model="form.shipping_address.postal_code" class="w-full" />
            </UFormField>
            <UFormField :label="$t('checkout.phone')" class="sm:col-span-2">
              <UInput v-model="form.shipping_address.phone" type="tel" class="w-full" />
            </UFormField>
          </div>
        </UCard>

        <!-- Payment method -->
        <UCard>
          <template #header>
            <h2 class="font-semibold">{{ $t('checkout.payment') }}</h2>
          </template>
          <URadioGroup
            v-model="form.payment_method"
            :items="paymentOptions"
          />
        </UCard>

        <!-- Notes -->
        <UCard>
          <UFormField :label="$t('checkout.notes')">
            <UTextarea v-model="form.notes" class="w-full" :rows="3" />
          </UFormField>
        </UCard>
      </div>

      <!-- Right: order summary -->
      <div class="lg:col-span-2">
        <UCard class="sticky top-24">
          <template #header>
            <h2 class="font-semibold">{{ $t('checkout.order_summary') }}</h2>
          </template>

          <!-- Items -->
          <div class="space-y-3 mb-4">
            <div
              v-for="item in cartStore.items"
              :key="item.product.id"
              class="flex justify-between text-sm"
            >
              <span class="text-gray-700">
                {{ locale === 'el' ? item.product.name_el : item.product.name_en }}
                <span class="text-gray-400">× {{ item.quantity }}</span>
              </span>
              <span class="font-medium">€{{ (Number(item.product.price) * item.quantity).toFixed(2) }}</span>
            </div>
          </div>

          <div class="border-t pt-4 space-y-2 text-sm">
            <div class="flex justify-between">
              <span class="text-gray-600">{{ $t('cart.subtotal') }}</span>
              <span>€{{ cartStore.subtotal.toFixed(2) }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-600">{{ $t('checkout.shipping_cost') }}</span>
              <span v-if="!pricingReady" class="text-gray-400">—</span>
              <span v-else-if="shippingCost === 0" class="text-success font-medium">{{ $t('checkout.free_shipping') }}</span>
              <span v-else>€{{ shippingCost.toFixed(2) }}</span>
            </div>

            <!-- Loyalty points redemption -->
            <div v-if="canRedeemPoints" class="border-t pt-2">
              <div class="flex items-center justify-between mb-2">
                <span class="text-gray-600">{{ $t('checkout.use_points') }}</span>
                <USwitch v-model="usePoints" />
              </div>
              <div v-if="usePoints" class="flex justify-between text-success">
                <span>{{ $t('checkout.loyalty_discount') }} ({{ pointsToRedeem }} pts)</span>
                <span>−€{{ loyaltyDiscount.toFixed(2) }}</span>
              </div>
            </div>

            <div class="flex justify-between font-bold text-base border-t pt-2">
              <span>{{ $t('checkout.total') }}</span>
              <span v-if="!pricingReady" class="text-gray-400">—</span>
              <span v-else>€{{ total.toFixed(2) }}</span>
            </div>
          </div>

          <template #footer>
            <UAlert v-if="orderError" color="error" variant="soft" :description="orderError" class="mb-3" />
            <UButton
              :label="$t('checkout.place_order')"
              block
              :loading="loading"
              :disabled="!pricingReady"
              @click="placeOrder"
            />
          </template>
        </UCard>
      </div>
    </div>
  </div>
  </div>
</template>

<script setup lang="ts">
const { public: { apiBase } } = useRuntimeConfig()
const cartStore = useCartStore()
const authStore = useAuthStore()
const { locale, t } = useI18n()
const localePath = useLocalePath()
const loading = ref(false)
const usePoints = ref(false)
const orderError = ref('')

const form = reactive({
  guest_email: '',
  fulfillment_type: 'shipping' as 'shipping' | 'pickup',
  payment_method: 'stripe' as 'stripe' | 'cash_on_pickup' | 'card_on_pickup',
  notes: '',
  shipping_address: {
    full_name: '',
    address: '',
    city: '',
    postal_code: '',
    phone: '',
  },
})

const isGuest = computed(() => !authStore.isLoggedIn)
const emailValid = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.guest_email.trim()))

// All shipping fields required when shipping is selected.
const shippingValid = computed(() => {
  if (form.fulfillment_type !== 'shipping') return true
  const a = form.shipping_address
  return [a.full_name, a.address, a.city, a.postal_code, a.phone].every(v => v.trim().length > 0)
})

const paymentOptions = computed(() => {
  const options = [{ value: 'stripe', label: t('checkout.payment_online') }]
  if (form.fulfillment_type === 'pickup') {
    options.push(
      { value: 'cash_on_pickup', label: t('checkout.payment_cash') },
      { value: 'card_on_pickup', label: t('checkout.payment_card') },
    )
  }
  return options
})

// Reset payment method when switching to shipping
watch(() => form.fulfillment_type, (val) => {
  if (val === 'shipping') form.payment_method = 'stripe'
})

// Pricing rules come from the server. They were hardcoded here as 50/5 and /100,
// so the moment the owner changed shipping or the loyalty rate in the admin the
// customer was shown one total and charged another.
type PricingSettings = {
  shipping_cost: number
  free_shipping_threshold: number
  loyalty_earn_rate: number
  loyalty_redeem_rate: number
  loyalty_min_redeem: number
}

const { data: pricing, refresh: refreshPricing } = await useFetch<PricingSettings>('/settings', {
  baseURL: apiBase,
  key: 'pricing-settings',
})

// The key is static, so a server-side fetch that fails leaves pricing null for
// the life of the page -- Nuxt reuses the (empty) payload on hydration instead
// of asking again. Retry once on the client, which reaches apiBase over the
// public origin even where the server rendering the page cannot.
onMounted(() => {
  if (!pricing.value) refreshPricing()
})

// Whether the server's pricing rules are actually known. Anything money-related
// stays unresolved until they are: showing a number we cannot stand behind is
// worse than showing none.
const pricingReady = computed(() => Boolean(pricing.value))

const shippingCost = computed(() => {
  if (form.fulfillment_type === 'pickup') return 0
  const p = pricing.value
  // Not "free" -- unknown. Returning 0 here rendered "free shipping" and a
  // total short by the shipping cost whenever /settings failed to load, so the
  // customer was quoted one amount and charged another. Callers must check
  // pricingReady before showing this.
  if (!p) return 0
  return cartStore.subtotal >= p.free_shipping_threshold ? 0 : p.shipping_cost
})

const pointsToRedeem = computed(() => {
  if (!usePoints.value || !pricing.value) return 0
  const { loyalty_min_redeem, loyalty_redeem_rate } = pricing.value
  // Never redeem more than the order is worth: points beyond the cart total
  // would be burned for nothing, since the server clamps the total at 0.
  const maxUseful = Math.floor(cartStore.subtotal * loyalty_redeem_rate)
  const use = Math.min(authStore.loyaltyPoints, maxUseful)
  // The server rejects any non-zero amount below the minimum, so redeem nothing
  // rather than send a value guaranteed to 400.
  return use >= loyalty_min_redeem ? use : 0
})

const loyaltyDiscount = computed(() =>
  pricing.value ? pointsToRedeem.value / pricing.value.loyalty_redeem_rate : 0,
)

// Offer the toggle only when redeeming would actually be accepted. The threshold
// was hardcoded as 500 in the template, so raising loyalty_min_redeem in the
// admin left the switch visible on balances the server would reject.
const canRedeemPoints = computed(() =>
  Boolean(
    authStore.isLoggedIn &&
    pricing.value &&
    authStore.loyaltyPoints >= pricing.value.loyalty_min_redeem,
  ),
)

const total = computed(() =>
  Math.max(0, cartStore.subtotal + shippingCost.value - loyaltyDiscount.value)
)

// Idempotency-Key for POST /orders: a double click or a retry after a timeout
// resends the same key and gets the same order back instead of a second one.
// Anything that changes what would be ordered (cart, delivery, payment,
// address, points, notes, guest email) starts a new key.
const idempotencyKey = ref(crypto.randomUUID())
watch([() => cartStore.items, form, pointsToRedeem], () => { idempotencyKey.value = crypto.randomUUID() }, { deep: true })

async function placeOrder() {
  if (isGuest.value && !emailValid.value) {
    orderError.value = t('checkout.email_required')
    return
  }
  if (!shippingValid.value) {
    orderError.value = t('checkout.shipping_required')
    return
  }
  // Remember the guest email so the Stripe success page can offer account creation.
  if (isGuest.value && import.meta.client) {
    localStorage.setItem('guest_checkout_email', form.guest_email.trim())
  }
  loading.value = true
  orderError.value = ''
  try {
    const order = await $fetch<{ id: string }>(`${apiBase}/orders`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Idempotency-Key': idempotencyKey.value },
      body: {
        items: cartStore.items.map(i => ({
          productId: i.product.id,
          quantity: i.quantity,
        })),
        fulfillmentType: form.fulfillment_type.toUpperCase(),
        paymentMethod: form.payment_method.toUpperCase(),
        shippingAddress: form.fulfillment_type === 'shipping' ? {
          fullName: form.shipping_address.full_name,
          address: form.shipping_address.address,
          city: form.shipping_address.city,
          postalCode: form.shipping_address.postal_code,
          phone: form.shipping_address.phone,
        } : undefined,
        loyaltyPointsToRedeem: pointsToRedeem.value,
        notes: form.notes || undefined,
        guestEmail: isGuest.value ? form.guest_email.trim() : undefined,
      },
    })

    if (form.payment_method === 'stripe') {
      const origin = window.location.origin
      const { url } = await $fetch<{ url: string }>(`${apiBase}/payments/create-checkout`, {
        method: 'POST',
        credentials: 'include',
        body: {
          orderId: order.id,
          successUrl: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${origin}/checkout/cancel?order_id=${order.id}`,
        },
      })
      window.location.href = url
    } else {
      // Pickup/cash orders are confirmed immediately → go to the shared success page
      // (handles confirmation UI + guest account offer; survives reloads/language switch).
      await navigateTo({ path: localePath('/checkout/success'), query: { order_id: order.id } })
    }
  } catch (e: unknown) {
    // Prefer the backend's validation message(s) over the raw "[POST] … 400" string.
    const data = (e as { data?: { message?: string | string[] } })?.data
    const msg = Array.isArray(data?.message) ? data.message[0] : data?.message
    orderError.value = msg ?? t('checkout.order_failed')
  } finally {
    loading.value = false
  }
}

useSeoMeta({ title: () => t('seo.checkout.title') })
</script>
