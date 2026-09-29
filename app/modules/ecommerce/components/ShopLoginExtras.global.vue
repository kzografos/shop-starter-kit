<template>
  <!-- Loyalty info box -->
  <div
    class="mt-6 flex items-start gap-3 p-4 rounded-xl bg-[--color-surface-card] border border-[--color-border-warm] text-sm text-[--color-bark-light]"
  >
    <UIcon name="i-heroicons-gift" class="w-5 h-5 text-terracotta shrink-0" />
    <span>{{ $t('ecommerce.login.loyalty_note') }}</span>
  </div>

  <NuxtLink
    :to="localePath('/products')"
    class="flex items-center justify-center gap-1.5 text-sm text-[--color-bark-light] hover:text-[--color-bark] transition-colors mt-5 mb-2"
  >
    <UIcon name="i-heroicons-arrow-left" class="w-4 h-4" />
    {{ $t('ecommerce.login.continue_browsing') }}
  </NuxtLink>
</template>

<script setup lang="ts">
// The shop's extras on the Core login page, contributed through app.config
// `loginExtras` (B3): the loyalty promise and the way back to the catalogue
// belong to the module that runs them, not to the auth page.
const localePath = useLocalePath()
</script>
