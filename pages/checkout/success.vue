<template>
  <div class="max-w-lg mx-auto px-4 py-20 text-center">
    <div
      class="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6"
      style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%)"
    >
      <UIcon name="i-heroicons-check" class="w-12 h-12 text-white" />
    </div>

    <h1 class="text-3xl font-bold text-gray-900 mb-3">{{ $t('checkout.success_title') }}</h1>
    <p class="text-gray-500 mb-8">{{ $t('checkout.success_message') }}</p>

    <div class="flex flex-col sm:flex-row gap-3 justify-center">
      <UButton
        :label="$t('nav.account')"
        :to="localePath('/account/orders')"
        icon="i-heroicons-clipboard-document-list"
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
