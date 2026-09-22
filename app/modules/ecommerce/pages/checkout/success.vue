<template>
  <div class="bg-surface-page min-h-screen">
    <div class="max-w-lg mx-auto px-4 py-12 text-center">
      <CheckoutSteps :current-step="3" />

      <div v-if="verifying" class="flex justify-center items-center py-16">
        <UIcon name="i-heroicons-arrow-path" class="w-10 h-10 text-sage animate-spin" />
      </div>

      <template v-else-if="errorMessage">
        <div class="w-24 h-24 rounded-full bg-danger-bg flex items-center justify-center mx-auto mb-6">
          <UIcon name="i-heroicons-x-mark" class="w-12 h-12 text-danger" />
        </div>
        <h1 class="font-display text-3xl font-bold text-[--color-bark] mb-3">
          {{ $t('checkout.verification_failed_title') }}
        </h1>
        <p class="text-[--color-bark-light] mb-8">{{ errorMessage }}</p>
        <UButton :label="$t('nav.home')" :to="localePath('/')" />
      </template>

      <template v-else>
        <div class="w-24 h-24 rounded-full bg-sage flex items-center justify-center mx-auto mb-6">
          <UIcon name="i-heroicons-check" class="w-12 h-12 text-white" />
        </div>

        <h1 class="font-display text-3xl font-bold text-[--color-bark] mb-3">
          {{ $t('checkout.success_title') }}
        </h1>
        <p class="text-[--color-bark-light] mb-8">{{ $t('checkout.success_message') }}</p>

        <div class="flex flex-col sm:flex-row gap-3 justify-center">
          <UButton
            v-if="isLoggedIn"
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

        <!-- Guest → offer account creation (paid order auto-links + earns points on signup) -->
        <GuestAccountCTA
          v-if="!isLoggedIn && guestEmail"
          :email="guestEmail"
          @done="clearGuestEmail"
          @skip="clearGuestEmail"
        />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
const cartStore = useCartStore()
const authStore = useAuthStore()
const { isLoggedIn } = storeToRefs(authStore)
const route = useRoute()
const api = useApi()

const verifying = ref(true)
const errorMessage = ref<string | null>(null)
const guestEmail = ref('')

onMounted(async () => {
  const sessionId = route.query.session_id as string | undefined
  const orderId = route.query.order_id as string | undefined

  // Neither = direct/invalid visit.
  if (!sessionId && !orderId) {
    errorMessage.value = t('checkout.session_id_missing')
    verifying.value = false
    return
  }

  try {
    // Stripe path: confirm payment actually completed. Non-Stripe (pickup/cash)
    // orders arrive with order_id and are already confirmed server-side.
    if (sessionId) {
      const { status } = await api<{ status: string }>('/payments/verify-session', {
        query: { session_id: sessionId },
      })
      if (status !== 'paid') {
        errorMessage.value = t('checkout.payment_not_completed')
        return
      }
    }

    cartStore.clear()
    await authStore.fetchProfile()
    // Guest checkout: pick up the email stored at checkout to offer account creation.
    // Do NOT clear it here — a language switch re-mounts this page and must still find it.
    if (!isLoggedIn.value) {
      guestEmail.value = localStorage.getItem('guest_checkout_email') ?? ''
    }
  } catch {
    errorMessage.value = t('checkout.verification_failed')
  } finally {
    verifying.value = false
  }
})

function clearGuestEmail() {
  guestEmail.value = ''
  localStorage.removeItem('guest_checkout_email')
}

useSeoMeta({ title: () => t('seo.order_confirmed.title') })
</script>
