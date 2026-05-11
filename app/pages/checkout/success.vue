<template>
  <div class="bg-surface-page min-h-screen">
    <div class="max-w-lg mx-auto px-4 py-12 text-center">
      <CheckoutSteps :current-step="3" />

      <div class="w-24 h-24 rounded-full bg-sage flex items-center justify-center mx-auto mb-6">
        <UIcon name="i-heroicons-check" class="w-12 h-12 text-white" />
      </div>

      <h1 class="font-display text-3xl font-bold text-[--color-bark] mb-3">
        {{ $t('checkout.success_title') }}
      </h1>
      <p class="text-[--color-bark-light] mb-8">{{ $t('checkout.success_message') }}</p>

      <div class="flex flex-col sm:flex-row gap-3 justify-center">
        <UButton
          :label="$t('nav.account')"
          :to="localePath('/account/orders')"
          icon="i-heroicons-clipboard-document-list"
        />
        <NuxtLink
          :to="localePath('/products')"
          class="inline-flex items-center px-5 py-2.5 rounded-xl border border-[--color-border-warm] text-sm font-medium text-[--color-bark] hover:border-terracotta hover:text-terracotta transition-colors"
        >
          {{ $t('cart.continue_shopping') }}
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const localePath = useLocalePath()
const cartStore = useCartStore()
const authStore = useAuthStore()

onMounted(async () => {
  // Clear cart and refresh loyalty points after successful payment
  cartStore.clear()
  await authStore.fetchProfile()
})

useSeoMeta({ title: 'Order Confirmed | PetShop CY' })
</script>
