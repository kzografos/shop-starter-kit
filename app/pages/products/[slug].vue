<template>
  <div v-if="product" class="bg-surface-page min-h-screen">
    <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Breadcrumb -->
      <nav class="flex items-center gap-2 text-sm mb-8 flex-wrap">
        <NuxtLink
          :to="localePath('/products')"
          class="text-[--color-bark-light] hover:text-[--color-bark] transition-colors"
        >
          {{ $t('nav.products') }}
        </NuxtLink>

        <template v-if="product.category">
          <span class="text-[--color-border-warm]">/</span>
          <NuxtLink
            :to="localePath(`/products?category=${product.category.slug}`)"
            class="text-[--color-bark-light] hover:text-[--color-bark] transition-colors"
          >
            {{ locale === 'el' ? product.category.name_el : product.category.name_en }}
          </NuxtLink>
        </template>

        <span class="text-[--color-border-warm]">/</span>
        <span class="text-[--color-bark] font-medium truncate max-w-[200px]">{{
          productName
        }}</span>
      </nav>

      <div class="grid md:grid-cols-2 gap-10 lg:gap-16">
        <!-- Images -->
        <div class="space-y-4">
          <div
            class="aspect-square bg-cream-pale rounded-2xl overflow-hidden border border-[--color-border-warm]"
          >
            <img
              :src="product.images[selectedImage] || '/placeholder.svg'"
              :alt="productName"
              class="w-full h-full object-cover"
              @error="(e: Event) => ((e.target as HTMLImageElement).src = '/placeholder.svg')"
            />
          </div>
          <div v-if="product.images.length > 1" class="flex gap-2 flex-wrap">
            <button
              v-for="(img, i) in product.images"
              :key="i"
              class="w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors"
              :class="selectedImage === i ? 'border-terracotta' : 'border-[--color-border-warm]'"
              @click="selectedImage = i"
            >
              <img
                :src="img"
                class="w-full h-full object-cover"
                @error="(e: Event) => ((e.target as HTMLImageElement).src = '/placeholder.svg')"
              />
            </button>
          </div>
        </div>

        <!-- Info -->
        <div class="space-y-6">
          <div>
            <p
              v-if="product.brand"
              class="text-xs text-[--color-bark-light] uppercase tracking-widest font-semibold mb-2"
            >
              {{ product.brand }}
            </p>
            <h1 class="font-display text-3xl font-bold text-[--color-bark] leading-tight">
              {{ productName }}
            </h1>
          </div>

          <p class="text-4xl font-bold text-terracotta">€{{ Number(product.price).toFixed(2) }}</p>

          <!-- Stock badge -->
          <div class="flex items-center gap-2">
            <span
              v-if="product.stock === 0"
              class="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-[--color-warm-red]/10 text-[--color-warm-red]"
            >
              <span class="w-1.5 h-1.5 rounded-full bg-[--color-warm-red] inline-block" />
              {{ $t('product.out_of_stock') }}
            </span>
            <span
              v-else
              class="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-sage/20 text-[--color-sage-dark]"
            >
              <span class="w-1.5 h-1.5 rounded-full bg-[--color-sage-dark] inline-block" />
              {{ $t('product.in_stock') }}
            </span>
          </div>

          <!-- Attribute pills -->
          <div class="flex flex-wrap gap-2">
            <span
              v-if="product.package_size"
              class="text-xs px-3 py-1 rounded-full bg-[--color-surface-card] border border-[--color-border-warm] text-[--color-bark-light] font-medium"
            >
              {{ product.package_size }}
            </span>
            <span
              v-if="product.animal_age && product.animal_age !== 'all'"
              class="text-xs px-3 py-1 rounded-full bg-[--color-surface-card] border border-[--color-border-warm] text-[--color-bark-light] font-medium capitalize"
            >
              {{ $t(`product.age_${product.animal_age}`) }}
            </span>
            <span
              v-if="product.category"
              class="text-xs px-3 py-1 rounded-full bg-[--color-surface-card] border border-[--color-border-warm] text-[--color-bark-light] font-medium"
            >
              {{ locale === 'el' ? product.category.name_el : product.category.name_en }}
            </span>
          </div>

          <!-- Quantity + Add to Cart + Favourite -->
          <div v-if="product.stock > 0" class="flex items-center gap-3">
            <div
              class="flex items-center border border-[--color-border-warm] rounded-xl overflow-hidden bg-[--color-surface-card]"
            >
              <button
                class="px-3 py-2.5 hover:bg-[--color-surface-page] transition-colors disabled:opacity-40 text-[--color-bark]"
                :disabled="qty <= 1"
                @click="qty--"
              >
                −
              </button>
              <span
                class="px-4 py-2.5 font-semibold text-[--color-bark] min-w-12 text-center border-x border-[--color-border-warm]"
                >{{ qty }}</span
              >
              <button
                class="px-3 py-2.5 hover:bg-[--color-surface-page] transition-colors disabled:opacity-40 text-[--color-bark]"
                :disabled="qty >= product.stock"
                @click="qty++"
              >
                +
              </button>
            </div>

            <button
              class="flex-1 py-2.5 px-6 rounded-xl bg-terracotta text-white font-semibold text-sm hover:bg-terracotta-dark transition-colors"
              @click="addToCart"
            >
              {{ $t('product.add_to_cart') }}
            </button>

            <button
              class="w-11 h-11 flex items-center justify-center rounded-xl border border-[--color-border-warm] hover:border-terracotta bg-[--color-surface-card] transition-colors"
              @click="handleFavourite"
            >
              <UIcon
                :name="isFav ? 'i-heroicons-heart-solid' : 'i-heroicons-heart'"
                class="w-5 h-5 transition-colors"
                :class="isFav ? 'text-terracotta' : 'text-[--color-bark-light]'"
              />
            </button>
          </div>

          <!-- Description -->
          <div v-if="productDescription" class="pt-6 border-t border-[--color-border-warm]">
            <h2 class="font-display text-lg font-bold text-[--color-bark] mb-3">
              {{ $t('product.description') }}
            </h2>
            <p class="text-sm text-[--color-bark-light] leading-relaxed">
              {{ productDescription }}
            </p>
          </div>
        </div>
      </div>

      <!-- Related products -->
      <div v-if="relatedProducts && relatedProducts.length > 0" class="mt-16">
        <h2 class="font-display text-2xl font-bold text-[--color-bark] mb-6">
          {{ $t('product.related') }}
        </h2>
        <ProductGrid :products="relatedProducts" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Product } from '~~/types'

const route = useRoute()
const { locale, t } = useI18n()
const localePath = useLocalePath()
const cartStore = useCartStore()
const cartOpen = useState('cart-open', () => false)
const favouritesStore = useFavouritesStore()
const authStore = useAuthStore()
const toast = useToast()
const { public: { apiBase } } = useRuntimeConfig()

const selectedImage = ref(0)
const qty = ref(1)

const { data: product, status } = useAsyncData(`product-${route.params.slug}`, () =>
  $fetch<Product>(`${apiBase}/products/${route.params.slug}`, { credentials: 'include' }).catch(() => null),
  { server: false, lazy: true },
)

// 404 reactively once the client fetch settles (lazy can't throw synchronously in setup).
watch([status, product], ([s, p]) => {
  if (s === 'success' && !p) {
    showError({ statusCode: 404, statusMessage: 'Product not found', fatal: true })
  }
}, { immediate: true })

const { data: relatedProducts } = useAsyncData(`related-${route.params.slug}`, async () => {
  if (!product.value) return []
  return $fetch<Product[]>(`${apiBase}/products/${route.params.slug}/related`, { credentials: 'include' })
    .catch(() => [] as Product[])
}, { server: false, lazy: true, watch: [product] })

const productName = computed(() =>
  locale.value === 'el' ? product.value?.name_el : product.value?.name_en
)
const productDescription = computed(() =>
  locale.value === 'el' ? product.value?.description_el : product.value?.description_en
)

const isFav = computed(() => favouritesStore.isFavourite(product.value?.id ?? ''))

function handleFavourite() {
  if (!authStore.isLoggedIn) {
    navigateTo(localePath('/login'))
    return
  }
  favouritesStore.toggle(product.value!.id)
}

function addToCart() {
  if (!product.value) return
  cartStore.addItem(product.value, qty.value)
  toast.add({
    title: t('cart.added_toast'),
    description: productName.value,
    icon: 'i-heroicons-shopping-bag',
    color: 'primary',
    duration: 2500,
  })
  cartOpen.value = true
}

useSeoMeta({ title: () => `${productName.value} | PetShop CY` })
</script>
