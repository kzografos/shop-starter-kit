<template>
  <div
    class="group relative flex flex-col bg-cream rounded-2xl overflow-hidden border border-cream-pale hover:border-terracotta/40 hover:-translate-y-1 hover:shadow-lg transition-all duration-300"
  >
    <!-- Image -->
    <NuxtLink :to="localePath(`/products/${product.slug}`)" class="block relative overflow-hidden">
      <div class="aspect-square bg-cream-pale">
        <NuxtImg
          :src="product.images[0]"
          :alt="product.name_el || product.name_en"
          width="400"
          height="400"
          format="webp"
          quality="80"
          loading="lazy"
          fit="cover"
          class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
        />
      </div>

      <!-- Out of stock overlay -->
      <div
        v-if="product.stock === 0"
        class="absolute inset-0 bg-bark/40 flex items-center justify-center"
      >
        <span class="bg-warm-red text-white text-xs font-semibold px-3 py-1 rounded-full">
          {{ $t('product.out_of_stock') }}
        </span>
      </div>
    </NuxtLink>

    <!-- Sale badge -->
    <span
      v-if="onSale"
      class="absolute top-2 left-2 z-10 bg-warm-red text-white text-xs font-bold px-2 py-1 rounded-full shadow-sm"
    >
      −{{ discountPct }}%
    </span>

    <!-- Favourite button — larger tap target on mobile (≈40px) -->
    <button
      class="absolute top-2 right-2 z-10 w-10 h-10 sm:w-8 sm:h-8 flex items-center justify-center rounded-full bg-white/80 backdrop-blur-sm shadow-sm hover:bg-white transition-all duration-150"
      :aria-label="$t('favourites.title')"
      @click.prevent="handleFavourite"
    >
      <UIcon
        :name="isFav ? 'i-heroicons-heart-solid' : 'i-heroicons-heart'"
        class="w-5 h-5 sm:w-4 sm:h-4 transition-colors duration-150"
        :class="isFav ? 'text-terracotta' : 'text-bark-light'"
      />
    </button>

    <!-- Auth modal -->
    <UModal v-model:open="showAuthModal">
      <template #content>
        <div class="p-6 text-center">
          <!-- Hero icon in a soft tinted circle -->
          <div class="w-14 h-14 rounded-full bg-terracotta/10 flex items-center justify-center mx-auto mb-4">
            <UIcon name="i-heroicons-heart" class="w-7 h-7 text-terracotta" />
          </div>
          <h3 class="font-display text-xl font-bold text-bark mb-2">
            {{ $t('favourites.auth_title') }}
          </h3>
          <p class="text-bark-light text-sm mb-6">
            {{ $t('favourites.auth_desc') }}
          </p>
          <div class="flex gap-3 justify-center">
            <NuxtLink
              :to="localePath('/login')"
              class="px-5 h-11 inline-flex items-center rounded-full bg-terracotta text-white text-sm font-semibold hover:bg-terracotta-dark transition-colors"
              @click="showAuthModal = false"
            >
              {{ $t('auth.login_btn') }}
            </NuxtLink>
            <NuxtLink
              :to="localePath('/login?tab=register')"
              class="px-5 h-11 inline-flex items-center rounded-full border border-[--color-border-warm] text-bark text-sm font-semibold hover:border-terracotta hover:text-terracotta transition-colors"
              @click="showAuthModal = false"
            >
              {{ $t('auth.register_btn') }}
            </NuxtLink>
          </div>
        </div>
      </template>
    </UModal>

    <!-- Content -->
    <div class="flex flex-col flex-1 p-4 gap-1.5">
      <NuxtLink :to="localePath(`/products/${product.slug}`)">
        <p
          v-if="product.brand"
          class="text-xs text-bark-light uppercase tracking-widest font-medium"
        >
          {{ product.brand }}
        </p>
        <h3
          class="text-sm font-medium text-bark line-clamp-2 leading-snug mt-0.5 group-hover:text-terracotta transition-colors duration-200"
        >
          {{ displayName }}
        </h3>
      </NuxtLink>

      <div class="mt-auto pt-2 flex items-baseline gap-2">
        <p class="text-base font-bold" :class="onSale ? 'text-warm-red' : 'text-bark'">{{ formatPrice(product.price) }}</p>
        <p v-if="onSale" class="text-sm text-bark-light line-through">{{ formatPrice(product.compare_at_price!) }}</p>
      </div>
    </div>

    <!-- Slide-in CTA -->
    <div
      class="px-4 pb-4 opacity-100 translate-y-0 sm:opacity-0 sm:translate-y-2 sm:group-hover:opacity-100 sm:group-hover:translate-y-0 transition-all duration-200"
    >
      <button
        class="w-full h-10 flex items-center justify-center gap-1.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors duration-200"
        :class="
          product.stock === 0
            ? 'bg-cream-pale text-bark-light cursor-not-allowed'
            : 'bg-terracotta text-white hover:bg-terracotta-dark'
        "
        :disabled="product.stock === 0"
        @click.prevent="addToCart"
      >
        <UIcon v-if="product.stock !== 0" name="i-heroicons-shopping-bag" class="w-4 h-4" />
        {{ product.stock === 0 ? $t('product.out_of_stock') : $t('product.add_short') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Product } from '~~/types'

const props = defineProps<{ product: Product }>()

const { locale, t } = useI18n()
const localePath = useLocalePath()
const { formatPrice } = useCurrency()
const cartStore = useCartStore()
const favouritesStore = useFavouritesStore()
const authStore = useAuthStore()
const toast = useToast()

const showAuthModal = ref(false)

const productName = computed(() =>
  locale.value === 'el' ? props.product.name_el : props.product.name_en
)

const displayName = computed(() => {
  const name = productName.value
  const brand = props.product.brand
  if (brand && name.startsWith(brand)) return name.slice(brand.length).trim()
  return name
})

const isFav = computed(() => favouritesStore.isFavourite(props.product.id))

const onSale = computed(() =>
  props.product.compare_at_price != null && props.product.compare_at_price > props.product.price,
)
const discountPct = computed(() =>
  onSale.value
    ? Math.round((1 - props.product.price / props.product.compare_at_price!) * 100)
    : 0,
)

function handleFavourite() {
  if (!authStore.isLoggedIn) {
    showAuthModal.value = true
    return
  }
  favouritesStore.toggle(props.product.id)
}

function addToCart() {
  cartStore.addItem(props.product)
  toast.add({
    title: t('cart.added_toast'),
    description: productName.value,
    icon: 'i-heroicons-shopping-bag',
    color: 'primary',
    duration: 2500,
  })
}
</script>
