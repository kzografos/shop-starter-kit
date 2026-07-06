<template>
  <div class="flex gap-3 py-3 border-b border-[--color-border-warm] last:border-b-0">
    <img
      :src="item.product.images[0] || '/images/placeholder-product.svg'"
      :alt="productName"
      class="w-16 h-16 object-cover rounded-lg bg-[--color-surface-page] shrink-0"
      @error="(e: Event) => ((e.target as HTMLImageElement).src = '/images/placeholder-product.svg')"
    />
    <div class="flex-1 min-w-0">
      <p class="text-sm font-medium text-[--color-bark] line-clamp-2 leading-tight">
        {{ productName }}
      </p>
      <p class="text-sm text-terracotta font-semibold mt-0.5">
        {{ formatPrice(item.product.price) }}
      </p>
      <div class="flex items-center gap-2 mt-2">
        <button
          class="w-6 h-6 flex items-center justify-center rounded border border-[--color-border-warm] text-[--color-bark-light] hover:border-terracotta hover:text-terracotta transition-colors text-sm"
          @click="cartStore.updateQuantity(item.product.id, item.quantity - 1)"
        >
          −
        </button>
        <span class="text-sm font-medium w-6 text-center text-[--color-bark]">{{
          item.quantity
        }}</span>
        <button
          class="w-6 h-6 flex items-center justify-center rounded border border-[--color-border-warm] text-[--color-bark-light] hover:border-terracotta hover:text-terracotta transition-colors text-sm"
          :disabled="item.quantity >= item.product.stock"
          @click="cartStore.updateQuantity(item.product.id, item.quantity + 1)"
        >
          +
        </button>
      </div>
    </div>
    <button
      class="text-[--color-bark-light] hover:text-[--color-warm-red] transition-colors shrink-0 self-start mt-0.5"
      :aria-label="$t('cart.remove')"
      @click="cartStore.removeItem(item.product.id)"
    >
      <UIcon name="i-heroicons-trash" class="w-4 h-4" />
    </button>
  </div>
</template>

<script setup lang="ts">
import type { CartItem } from '~~/types'

const props = defineProps<{ item: CartItem }>()

const { locale } = useI18n()
const cartStore = useCartStore()
const { formatPrice } = useCurrency()

const productName = computed(() =>
  locale.value === 'el' ? props.item.product.name_el : props.item.product.name_en
)
</script>
