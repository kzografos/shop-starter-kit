<template>
  <div class="flex items-center justify-center mb-10">
    <template v-for="(s, index) in steps" :key="s.key">
      <!-- Step -->
      <div class="flex items-center gap-2">
        <!-- Circle -->
        <div
          class="w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors"
          :class="{
            'bg-sage text-white': currentStep > s.number,
            'bg-terracotta text-white shadow-sm': currentStep === s.number,
            'bg-[--color-surface-card] border border-[--color-border-warm] text-[--color-bark-light]': currentStep < s.number,
          }"
        >
          <UIcon v-if="currentStep > s.number" name="i-heroicons-check" class="w-4 h-4" />
          <span v-else class="text-sm font-bold">{{ s.number }}</span>
        </div>

        <!-- Label -->
        <span
          class="text-sm font-medium transition-colors hidden sm:block"
          :class="currentStep >= s.number ? 'text-[--color-bark]' : 'text-[--color-bark-light]'"
        >
          {{ $t(s.labelKey) }}
        </span>
      </div>

      <!-- Connector line -->
      <div
        v-if="index < steps.length - 1"
        class="h-px w-8 sm:w-16 mx-2 transition-colors"
        :class="currentStep > s.number ? 'bg-sage' : 'bg-[--color-border-warm]'"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
defineProps<{ currentStep: 1 | 2 | 3 }>()

const steps = [
  { number: 1, key: 'cart', labelKey: 'checkout.step_cart' },
  { number: 2, key: 'checkout', labelKey: 'checkout.step_details' },
  { number: 3, key: 'confirmation', labelKey: 'checkout.step_confirmation' },
]
</script>
