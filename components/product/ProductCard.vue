<template>
  <div class="group relative flex flex-col bg-white rounded-2xl overflow-hidden border border-gray-100 hover:border-primary-200 hover:shadow-md transition-all duration-200">
    <NuxtLink :to="localePath(`/products/${product.slug}`)" class="block">
      <div class="aspect-square overflow-hidden bg-gray-50">
        <img
          :src="product.images[0] || '/placeholder.png'"
          :alt="productName"
          class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
      </div>
    </NuxtLink>

    <div class="flex flex-col flex-1 p-3 gap-2">
      <NuxtLink :to="localePath(`/products/${product.slug}`)">
        <p v-if="product.brand" class="text-xs text-gray-400 uppercase tracking-wide font-medium">
          {{ product.brand }}
        </p>
        <h3 class="text-sm font-medium text-gray-900 line-clamp-2 leading-snug group-hover:text-primary-600 transition-colors">
          {{ productName }}
        </h3>
      </NuxtLink>

      <div class="flex items-center justify-between mt-auto pt-1">
        <p class="text-lg font-bold text-gray-900">€{{ product.price.toFixed(2) }}</p>
        <UBadge
          v-if="product.stock === 0"
          :label="$t('product.out_of_stock')"
          color="error"
          variant="subtle"
          size="sm"
        />
      </div>

      <UButton
        :label="product.stock === 0 ? $t('product.out_of_stock') : $t('product.add_to_cart')"
        block
        size="sm"
        :disabled="product.stock === 0"
        @click="addToCart"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Product } from '~/types'

const props = defineProps<{ product: Product }>()

const { locale } = useI18n()
const localePath = useLocalePath()
const cartStore = useCartStore()
const cartOpen = useState('cart-open', () => false)

const productName = computed(() =>
  locale.value === 'el' ? props.product.name_el : props.product.name_en
)

function addToCart() {
  cartStore.addItem(props.product)
  cartOpen.value = true
}
</script>
