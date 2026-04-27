<template>
  <USlideover v-model:open="cartOpen" side="right" :ui="{ width: 'max-w-sm' }">
    <template #content>
      <div class="flex flex-col h-full">
        <!-- Header -->
        <div class="flex items-center justify-between px-6 py-4 border-b">
          <h2 class="text-lg font-semibold">{{ $t('cart.title') }}</h2>
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
          <UIcon name="i-heroicons-shopping-cart" class="w-16 h-16 text-gray-300" />
          <p class="text-gray-500">{{ $t('cart.empty') }}</p>
          <UButton
            :label="$t('cart.continue_shopping')"
            variant="outline"
            @click="cartOpen = false"
          />
        </div>

        <!-- Items -->
        <div v-else class="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <CartItem
            v-for="item in cartStore.items"
            :key="item.product.id"
            :item="item"
          />
        </div>

        <!-- Footer -->
        <div v-if="cartStore.items.length > 0" class="px-6 py-4 border-t space-y-3 bg-white">
          <div class="flex justify-between text-sm text-gray-600">
            <span>{{ $t('cart.subtotal') }}</span>
            <span class="font-semibold text-gray-900">€{{ cartStore.subtotal.toFixed(2) }}</span>
          </div>
          <UButton
            :label="$t('cart.checkout')"
            block
            :to="localePath('/checkout')"
            @click="cartOpen = false"
          />
          <UButton
            :label="$t('cart.continue_shopping')"
            block
            variant="ghost"
            color="neutral"
            @click="cartOpen = false"
          />
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
