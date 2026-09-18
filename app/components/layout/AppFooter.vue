<template>
  <footer>
    <!-- Newsletter -->
    <div class="bg-forest">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div class="max-w-xl mx-auto text-center">
          <p class="text-sage text-xs font-semibold tracking-widest uppercase mb-3">{{ $t('newsletter.eyebrow') }}</p>
          <h2 class="font-display text-3xl md:text-4xl font-bold text-cream mb-3">{{ $t('newsletter.title') }}</h2>
          <p class="text-sage text-sm mb-8">{{ $t('newsletter.subtitle') }}</p>

          <form v-if="!subscribed" class="flex gap-2 max-w-md mx-auto" @submit.prevent="subscribe">
            <input
              v-model="email"
              type="email"
              required
              :placeholder="$t('newsletter.placeholder')"
              class="flex-1 px-4 py-2.5 rounded-xl bg-forest border border-sage/30 text-cream placeholder-bark-light text-sm focus:outline-none focus:border-sage transition-colors"
            >
            <button
              type="submit"
              :disabled="loading"
              class="px-5 py-2.5 rounded-xl bg-terracotta text-white text-sm font-semibold hover:bg-terracotta-dark disabled:opacity-60 transition-colors shrink-0"
            >
              {{ loading ? '...' : $t('newsletter.cta') }}
            </button>
          </form>

          <div v-else class="flex items-center justify-center gap-2 text-sage">
            <UIcon name="i-heroicons-check-circle" class="w-5 h-5 text-gold" />
            <span class="text-sm font-medium">{{ $t('newsletter.success') }}</span>
          </div>

          <p v-if="error" class="mt-3 text-warm-red text-xs">{{ error }}</p>
        </div>
      </div>
    </div>

    <!-- Main footer -->
    <div class="bg-bark text-cream/70">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-10">
          <!-- Brand -->
          <div class="md:col-span-1">
            <BrandLockup inverted class="text-lg mb-4" />
            <p class="text-sm leading-relaxed">{{ $t('footer.description', { city: BUSINESS.address.city, country: BUSINESS.address.countryName }) }}</p>
          </div>

          <!-- Shop -->
          <div>
            <h3 class="text-cream text-sm font-semibold mb-4 uppercase tracking-widest">{{ $t('footer.shop') }}</h3>
            <ul class="space-y-2.5 text-sm">
              <li><NuxtLink :to="localePath('/products')" class="hover:text-cream transition-colors">{{ $t('nav.products') }}</NuxtLink></li>
            </ul>
          </div>

          <!-- Account -->
          <div>
            <h3 class="text-cream text-sm font-semibold mb-4 uppercase tracking-widest">{{ $t('footer.account_title') }}</h3>
            <ul class="space-y-2.5 text-sm">
              <li><NuxtLink :to="localePath('/account')" class="hover:text-cream transition-colors">{{ $t('nav.account') }}</NuxtLink></li>
              <li><NuxtLink :to="localePath('/account/orders')" class="hover:text-cream transition-colors">{{ $t('account.orders') }}</NuxtLink></li>
              <li><NuxtLink :to="localePath('/account/loyalty')" class="hover:text-cream transition-colors">{{ $t('footer.loyalty') }}</NuxtLink></li>
            </ul>
          </div>

          <!-- Info -->
          <div>
            <h3 class="text-cream text-sm font-semibold mb-4 uppercase tracking-widest">{{ $t('footer.info') }}</h3>
            <ul class="space-y-2.5 text-sm">
              <li><NuxtLink :to="localePath('/about')" class="hover:text-cream transition-colors">{{ $t('nav.about') }}</NuxtLink></li>
              <li><NuxtLink :to="localePath('/contact')" class="hover:text-cream transition-colors">{{ $t('nav.contact') }}</NuxtLink></li>
              <li>
                <span class="flex items-center gap-1.5">
                  <UIcon name="i-heroicons-truck" class="w-3.5 h-3.5 text-gold shrink-0" />
                  {{ $t('footer.shipping_info', { country: BUSINESS.address.countryName }) }}
                </span>
              </li>
            </ul>
          </div>
        </div>

        <div class="mt-10 pt-6 border-t border-cream/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-cream/40">
          <span>© {{ new Date().getFullYear() }} {{ BUSINESS.legalName }}. {{ $t('footer.rights') }}</span>
          <span class="flex items-center gap-1">
            <UIcon name="i-heroicons-heart" class="w-3 h-3 text-terracotta" />
            {{ $t('footer.made_with_love', { country: BUSINESS.address.countryName }) }}
          </span>
        </div>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { BUSINESS } from '~/utils/business'

const api = useApi()
const localePath = useLocalePath()
const { t } = useI18n()

const email = ref('')
const loading = ref(false)
const subscribed = ref(false)
const error = ref('')

async function subscribe() {
  loading.value = true
  error.value = ''
  try {
    await api(`/newsletter/subscribe`, {
      method: 'POST',
      body: { email: email.value },
    })
    subscribed.value = true
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : t('newsletter.error')
  } finally {
    loading.value = false
  }
}
</script>
