<template>
  <div class="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
    <span class="text-amber-500 text-lg">⭐</span>
    <div>
      <p class="text-xs text-amber-600 font-medium">{{ $t('loyalty.your_points') }}</p>
      <p class="text-sm font-bold text-amber-700">{{ authStore.loyaltyPoints }} {{ $t('loyalty.points') }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
const authStore = useAuthStore()
</script>
