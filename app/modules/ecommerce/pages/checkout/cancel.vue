<template>
  <div class="max-w-lg mx-auto px-4 py-20 text-center">
    <div class="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-6">
      <UIcon name="i-heroicons-x-mark" class="w-12 h-12 text-gray-400" />
    </div>

    <h1 class="text-3xl font-bold text-gray-900 mb-3">{{ $t('checkout.cancel_title') }}</h1>
    <p class="text-gray-500 mb-8">{{ $t('checkout.cancel_message') }}</p>

    <div class="flex flex-col sm:flex-row gap-3 justify-center">
      <!-- Retry payment for the same order -->
      <UButton
        v-if="orderId"
        :label="$t('checkout.retry_payment')"
        :loading="retrying"
        icon="i-heroicons-credit-card"
        @click="retryPayment"
      />
      <UButton
        :label="$t('cart.continue_shopping')"
        :to="localePath('/products')"
        variant="outline"
        color="neutral"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({})

const { t } = useI18n()

const api = useApi()
const route = useRoute()
const localePath = useLocalePath()
const retrying = ref(false)

const orderId = computed(() => route.query.order_id as string | undefined)

async function retryPayment() {
  if (!orderId.value) return
  retrying.value = true
  try {
    const origin = window.location.origin
    const { url } = await api<{ url: string }>(`/payments/create-checkout`, {
      method: 'POST',
      body: {
        orderId: orderId.value,
        successUrl: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${origin}/checkout/cancel?order_id=${orderId.value}`,
      },
    })
    window.location.href = url
  } catch {
    retrying.value = false
  }
}

useSeoMeta({ title: () => t('seo.payment_cancelled.title') })
</script>
