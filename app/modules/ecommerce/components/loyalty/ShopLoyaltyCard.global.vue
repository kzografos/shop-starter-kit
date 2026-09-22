<template>
  <!-- Loyalty card with progress bar -->
  <div class="bg-forest rounded-2xl p-8">
    <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
      <div class="flex-1">
        <p class="text-xs font-semibold uppercase tracking-widest text-sage mb-2">
          {{ $t('account.loyalty') }}
        </p>
        <p class="font-display text-5xl font-bold text-white mb-1">
          {{ loyaltyPoints.toLocaleString() }}
        </p>
        <p class="text-sm text-white/60 mb-6">{{ $t('loyalty.points') }}</p>

        <!-- Progress bar -->
        <div class="max-w-sm">
          <div class="flex justify-between text-xs text-white/50 mb-2">
            <span>{{ loyaltyPoints }} {{ $t('loyalty.points') }}</span>
            <span>3,000 {{ $t('loyalty.points') }}</span>
          </div>
          <div class="h-1.5 bg-white/20 rounded-full overflow-hidden">
            <div
              class="h-full bg-terracotta rounded-full transition-all duration-500"
              :style="{ width: `${Math.min((loyaltyPoints / 3000) * 100, 100)}%` }"
            />
          </div>
          <p class="text-xs text-white/50 mt-2">
            {{ Math.max(3000 - loyaltyPoints, 0).toLocaleString() }}
            {{ $t('account.points_until_reward') }}
          </p>
        </div>
      </div>

      <NuxtLink
        :to="localePath('/account/loyalty')"
        class="shrink-0 self-start px-5 py-2.5 rounded-xl border border-white/30 text-white text-sm font-medium hover:bg-white/10 transition-colors"
      >
        {{ $t('account.redeem') }}
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
// Contributed to the account dashboard through app.config `accountCards` (registered globally).
const { points: loyaltyPoints } = useLoyalty()
const localePath = useLocalePath()
</script>
