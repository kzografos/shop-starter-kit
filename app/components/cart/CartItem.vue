<template>
  <div class="flex gap-3 py-2">
    <img
      :src="item.product.images[0] || '/placeholder.png'"
      :alt="productName"
      class="w-16 h-16 object-cover rounded-lg bg-gray-100 flex-shrink-0"
    >
    <div class="flex-1 min-w-0">
      <p class="text-sm font-medium text-gray-900 line-clamp-2 leading-tight">{{ productName }}</p>
      <p class="text-sm text-primary-600 font-semibold mt-0.5">€{{ item.product.price.toFixed(2) }}</p>
      <div class="flex items-center gap-2 mt-2">
        <button
          class="w-6 h-6 flex items-center justify-center rounded border border-gray-300 text-gray-600 hover:border-primary-500 hover:text-primary-500 transition-colors text-sm"
          @click="cartStore.updateQuantity(item.product.id, item.quantity - 1)"
        >−</button>
        <span class="text-sm font-medium w-6 text-center">{{ item.quantity }}</span>
        <button
          class="w-6 h-6 flex items-center justify-center rounded border border-gray-300 text-gray-600 hover:border-primary-500 hover:text-primary-500 transition-colors text-sm"
          :disabled="item.quantity >= item.product.stock"
          @click="cartStore.updateQuantity(item.product.id, item.quantity + 1)"
        >+</button>
      </div>
    </div>
    <button
      class="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0 self-start mt-0.5"
      :aria-label="$t('cart.remove')"
      @click="cartStore.removeItem(item.product.id)"
    >
      <UIcon name="i-heroicons-trash" class="w-4 h-4" />
    </button>
  </div>
</template>

<script setup lang="ts">
import type { CartItem } from '~/types'

const props = defineProps<{ item: CartItem }>()

const { locale } = useI18n()
const cartStore = useCartStore()

const productName = computed(() =>
  locale.value === 'el' ? props.item.product.name_el : props.item.product.name_en
)
</script>
