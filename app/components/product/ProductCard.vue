<template>
  <div class="group relative flex flex-col bg-cream rounded-2xl overflow-hidden border border-cream-pale hover:border-terracotta/40 hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
    <!-- Image -->
    <NuxtLink :to="localePath(`/products/${product.slug}`)" class="block relative overflow-hidden">
      <div class="aspect-square bg-cream-pale">
        <img
          :src="product.images[0] || '/placeholder.png'"
          :alt="productName"
          class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          loading="lazy"
        />
      </div>

      <!-- Out of stock overlay -->
      <div v-if="product.stock === 0" class="absolute inset-0 bg-bark/40 flex items-center justify-center">
        <span class="bg-warm-red text-white text-xs font-semibold px-3 py-1 rounded-full">
          {{ $t('product.out_of_stock') }}
        </span>
      </div>
    </NuxtLink>

    <!-- Content -->
    <div class="flex flex-col flex-1 p-4 gap-1.5">
      <NuxtLink :to="localePath(`/products/${product.slug}`)">
        <p v-if="product.brand" class="text-xs text-bark-light uppercase tracking-widest font-medium">
          {{ product.brand }}
        </p>
        <h3 class="text-sm font-medium text-bark line-clamp-2 leading-snug mt-0.5 group-hover:text-terracotta transition-colors duration-200">
          {{ productName }}
        </h3>
      </NuxtLink>

      <p class="text-base font-bold text-bark mt-auto pt-2">€{{ product.price.toFixed(2) }}</p>
    </div>

    <!-- Slide-in CTA -->
    <div class="px-4 pb-4 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200">
      <button
        class="w-full py-2.5 rounded-xl text-sm font-semibold transition-colors duration-200"
        :class="product.stock === 0
          ? 'bg-cream-pale text-bark-light cursor-not-allowed'
          : 'bg-terracotta text-white hover:bg-terracotta-dark'"
        :disabled="product.stock === 0"
        @click.prevent="addToCart"
      >
        {{ product.stock === 0 ? $t('product.out_of_stock') : $t('product.add_to_cart') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Product } from '~/types'

const props = defineProps<{ product: Product }>()

const { locale, t } = useI18n()
const localePath = useLocalePath()
const cartStore = useCartStore()
const cartOpen = useState('cart-open', () => false)
const toast = useToast()

const productName = computed(() =>
  locale.value === 'el' ? props.product.name_el : props.product.name_en
)

function addToCart() {
  cartStore.addItem(props.product)
  toast.add({
    title: t('cart.added_toast'),
    description: productName.value,
    icon: 'i-heroicons-shopping-bag',
    color: 'success',
    duration: 2500,
  })
}
</script>
