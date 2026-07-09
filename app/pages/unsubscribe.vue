<template>
  <div class="min-h-screen flex items-center justify-center px-4 py-12 bg-[--color-surface-page]">
    <div class="w-full max-w-md">
      <div class="text-center mb-8">
        <NuxtLink :to="localePath('/')">
          <BrandLockup class="text-2xl" />
        </NuxtLink>
      </div>

      <div class="bg-[--color-surface-card] border border-[--color-border-warm] rounded-2xl p-8 text-center">
        <!-- Confirm (no API call until the button is clicked) -->
        <template v-if="status === 'confirm'">
          <UIcon name="i-heroicons-envelope-open" class="w-12 h-12 text-terracotta mx-auto mb-4" />
          <h1 class="font-display text-2xl font-bold text-[--color-bark] mb-2">{{ $t('unsubscribe.confirm_title') }}</h1>
          <p class="text-[--color-bark-light] text-sm mb-6">{{ $t('unsubscribe.confirm_desc', { email, name: brandName }) }}</p>
          <UButton
            block
            :label="$t('unsubscribe.confirm_btn')"
            :ui="{ base: 'h-12 justify-center rounded-xl text-base' }"
            @click="onConfirm"
          />
        </template>

        <!-- Processing -->
        <template v-else-if="status === 'pending'">
          <UIcon name="i-heroicons-arrow-path" class="w-10 h-10 text-terracotta animate-spin mx-auto mb-4" />
          <p class="text-[--color-bark-light]">{{ $t('unsubscribe.processing') }}</p>
        </template>

        <!-- Success -->
        <template v-else-if="status === 'success'">
          <UIcon name="i-heroicons-check-circle" class="w-12 h-12 text-success mx-auto mb-4" />
          <h1 class="font-display text-2xl font-bold text-[--color-bark] mb-2">{{ $t('unsubscribe.success_title') }}</h1>
          <p class="text-[--color-bark-light] text-sm">{{ $t('unsubscribe.success_desc', { name: brandName }) }}</p>
        </template>

        <!-- Invalid link -->
        <template v-else-if="status === 'invalid'">
          <UIcon name="i-heroicons-exclamation-triangle" class="w-12 h-12 text-danger mx-auto mb-4" />
          <h1 class="font-display text-2xl font-bold text-[--color-bark] mb-2">{{ $t('unsubscribe.error_title') }}</h1>
          <p class="text-[--color-bark-light] text-sm">{{ $t('unsubscribe.invalid_desc') }}</p>
        </template>

        <!-- Error -->
        <template v-else>
          <UIcon name="i-heroicons-x-circle" class="w-12 h-12 text-danger mx-auto mb-4" />
          <h1 class="font-display text-2xl font-bold text-[--color-bark] mb-2">{{ $t('unsubscribe.error_title') }}</h1>
          <p class="text-[--color-bark-light] text-sm">{{ $t('unsubscribe.error_desc') }}</p>
        </template>

        <NuxtLink
          :to="localePath('/')"
          class="inline-block mt-6 text-terracotta font-medium hover:text-terracotta-dark transition-colors"
        >
          ← {{ $t('unsubscribe.back_home') }}
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { BUSINESS } from '~/utils/business'

definePageMeta({ layout: false })

const { t } = useI18n()
const route = useRoute()
const localePath = useLocalePath()
const api = useApi()

const brandName = BUSINESS.name
const email = typeof route.query.email === 'string' ? route.query.email.trim() : ''
const isValid = !!email && email.includes('@')

// Confirm-first: never call the API on load (email clients / scanners pre-fetch links).
const status = ref<'confirm' | 'pending' | 'success' | 'invalid' | 'error'>(isValid ? 'confirm' : 'invalid')

async function onConfirm() {
  status.value = 'pending'
  try {
    await api(`/newsletter/unsubscribe?email=${encodeURIComponent(email)}`, { method: 'DELETE' })
    status.value = 'success'
  } catch {
    status.value = 'error'
  }
}

useSeoMeta({ title: () => t('unsubscribe.title') })
</script>
