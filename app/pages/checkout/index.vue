<template>
  <div class="bg-surface-page min-h-screen">
    <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <h1 class="font-display text-2xl font-bold text-[--color-bark] mb-6">{{ $t('checkout.title') }}</h1>

    <CheckoutSteps :current-step="2" />

    <div v-if="success" class="text-center py-20">
      <UIcon name="i-heroicons-check-circle" class="w-20 h-20 text-green-500 mx-auto mb-4" />
      <h2 class="text-2xl font-bold text-gray-900 mb-2">{{ $t('checkout.success_title') }}</h2>
      <p class="text-gray-600 mb-8">{{ $t('checkout.success_message') }}</p>
      <UButton :label="$t('nav.account')" :to="localePath('/account/orders')" />
    </div>

    <div v-else-if="cartStore.items.length === 0" class="text-center py-20">
      <p class="text-gray-500 mb-4">{{ $t('cart.empty') }}</p>
      <UButton :label="$t('cart.continue_shopping')" :to="localePath('/products')" />
    </div>

    <div v-else class="grid lg:grid-cols-5 gap-8">
      <!-- Left: form -->
      <div class="lg:col-span-3 space-y-8">
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
              <span v-if="shippingCost === 0" class="text-green-600 font-medium">{{ $t('checkout.free_shipping') }}</span>
              <span v-else>€{{ shippingCost.toFixed(2) }}</span>
            </div>

            <!-- Loyalty points redemption -->
            <div v-if="authStore.isLoggedIn && authStore.loyaltyPoints >= 500" class="border-t pt-2">
              <div class="flex items-center justify-between mb-2">
                <span class="text-gray-600">{{ $t('checkout.use_points') }}</span>
                <USwitch v-model="usePoints" />
              </div>
              <div v-if="usePoints" class="flex justify-between text-green-600">
                <span>{{ $t('checkout.loyalty_discount') }} ({{ pointsToRedeem }} pts)</span>
                <span>−€{{ loyaltyDiscount.toFixed(2) }}</span>
              </div>
            </div>

            <div class="flex justify-between font-bold text-base border-t pt-2">
              <span>{{ $t('checkout.total') }}</span>
              <span>€{{ total.toFixed(2) }}</span>
            </div>
          </div>

          <template #footer>
            <UAlert v-if="orderError" color="error" variant="soft" :description="orderError" class="mb-3" />
            <UButton
              :label="$t('checkout.place_order')"
              block
              :loading="loading"
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
definePageMeta({ middleware: 'auth' })

const { public: { apiBase } } = useRuntimeConfig()
const cartStore = useCartStore()
const authStore = useAuthStore()
const { locale, t } = useI18n()
const localePath = useLocalePath()
const loading = ref(false)
const success = ref(false)
const usePoints = ref(false)
const orderError = ref('')

const form = reactive({
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

const shippingCost = computed(() => {
  if (form.fulfillment_type === 'pickup') return 0
  return cartStore.subtotal >= 50 ? 0 : 5
})

const pointsToRedeem = computed(() => {
  if (!usePoints.value) return 0
  return Math.min(authStore.loyaltyPoints, 5000)
})

const loyaltyDiscount = computed(() => pointsToRedeem.value / 100)

const total = computed(() =>
  Math.max(0, cartStore.subtotal + shippingCost.value - loyaltyDiscount.value)
)

async function placeOrder() {
  loading.value = true
  orderError.value = ''
  try {
    const order = await $fetch<{ id: string }>(`${apiBase}/orders`, {
      method: 'POST',
      credentials: 'include',
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
      cartStore.clear()
      await authStore.fetchProfile()
      success.value = true
    }
  } catch (e: unknown) {
    orderError.value = e instanceof Error ? e.message : 'Something went wrong'
  } finally {
    loading.value = false
  }
}

useSeoMeta({ title: () => t('seo.checkout.title') })
</script>
