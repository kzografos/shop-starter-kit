<template>
  <USlideover v-model:open="cartOpen" side="right" :ui="{ content: 'w-full sm:max-w-sm' }">
    <template #content>
      <div class="flex flex-col h-full bg-surface-page">
        <!-- Header -->
        <div
          class="flex items-center justify-between px-6 py-4 border-b border-[--color-border-warm]"
        >
          <h2 class="font-display text-lg font-bold text-[--color-bark]">{{ $t('cart.title') }}</h2>
          <UButton
            icon="i-heroicons-x-mark"
            variant="ghost"
            color="neutral"
            @click="cartOpen = false"
          />
        </div>

        <!-- Empty state -->
        <div
          v-if="cartStore.items.length === 0"
          class="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center"
        >
          <UIcon name="i-heroicons-shopping-cart" class="w-16 h-16 text-[--color-bark-light]" />
          <p class="text-[--color-bark-light]">{{ $t('cart.empty') }}</p>
          <UButton
            :label="$t('cart.continue_shopping')"
            variant="outline"
            @click="cartOpen = false"
          />
        </div>

        <!-- Items -->
        <div v-else class="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <CartItem v-for="item in cartStore.items" :key="item.product.id" :item="item" />
        </div>

        <!-- Footer -->
        <div
          v-if="cartStore.items.length > 0"
          class="px-6 py-4 border-t border-[--color-border-warm] space-y-3 bg-surface-page"
        >
          <div class="flex justify-between text-sm">
            <span class="text-bark-light">{{ $t('cart.subtotal') }}</span>
            <span class="font-semibold text-bark">€{{ cartStore.subtotal.toFixed(2) }}</span>
          </div>
          <NuxtLink
            :to="localePath('/checkout')"
            class="w-full py-2.5 text-sm font-semibold text-white bg-terracotta hover:bg-terracotta-dark rounded-xl text-center transition-colors block"
            @click="cartOpen = false"
          >
            {{ $t('cart.checkout') }}
          </NuxtLink>
          <button
            class="w-full py-2 text-sm font-medium text-bark-light hover:text-bark transition-colors cursor-pointer"
            @click="cartOpen = false"
          >
            {{ $t('cart.continue_shopping') }}
          </button>
        </div>
      </div>
    </template>
  </USlideover>
</template>

<script setup lang="ts">
const cartStore = useCartStore()
const cartOpen = useState('cart-open', () => false)
const localePath = useLocalePath()
</script>
