<template>
  <div v-if="product" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <!-- Breadcrumb -->
    <UBreadcrumb
      :links="[
        { label: $t('nav.products'), to: localePath('/products') },
        { label: productName },
      ]"
      class="mb-8"
    />

    <div class="grid md:grid-cols-2 gap-10 lg:gap-16">
      <!-- Images -->
      <div class="space-y-4">
        <div class="aspect-square bg-gray-50 rounded-2xl overflow-hidden">
          <img
            :src="product.images[selectedImage] || '/placeholder.png'"
            :alt="productName"
            class="w-full h-full object-cover"
          />
        </div>
        <div v-if="product.images.length > 1" class="flex gap-2 flex-wrap">
          <button
            v-for="(img, i) in product.images"
            :key="i"
            class="w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors"
            :class="selectedImage === i ? 'border-primary-500' : 'border-gray-200'"
            @click="selectedImage = i"
          >
            <img :src="img" class="w-full h-full object-cover" />
          </button>
        </div>
      </div>

      <!-- Info -->
      <div class="space-y-6">
        <div>
          <p v-if="product.brand" class="text-sm text-gray-500 uppercase tracking-wider font-medium mb-1">
            {{ product.brand }}
          </p>
          <h1 class="text-3xl font-bold text-gray-900">{{ productName }}</h1>
        </div>

        <p class="text-4xl font-bold text-gray-900">€{{ product.price.toFixed(2) }}</p>

        <div>
          <UBadge
            v-if="product.stock === 0"
            :label="$t('product.out_of_stock')"
            color="error"
          />
          <UBadge
            v-else
            :label="`${$t('product.in_stock')}: ${product.stock}`"
            color="success"
          />
        </div>

        <!-- Quantity + Add to cart -->
        <div v-if="product.stock > 0" class="flex items-center gap-4">
          <div class="flex items-center border border-gray-300 rounded-lg overflow-hidden">
            <button
              class="px-3 py-2 hover:bg-gray-50 transition-colors disabled:opacity-40"
              :disabled="qty <= 1"
              @click="qty--"
            >−</button>
            <span class="px-4 py-2 font-medium min-w-[3rem] text-center">{{ qty }}</span>
            <button
              class="px-3 py-2 hover:bg-gray-50 transition-colors disabled:opacity-40"
              :disabled="qty >= product.stock"
              @click="qty++"
            >+</button>
          </div>
          <UButton
            :label="$t('product.add_to_cart')"
            size="lg"
            class="flex-1"
            @click="addToCart"
          />
        </div>

        <!-- Description -->
        <div v-if="productDescription" class="prose prose-sm max-w-none text-gray-600 border-t pt-6">
          <p>{{ productDescription }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const { locale } = useI18n()
const localePath = useLocalePath()
const supabase = useSupabaseClient()
const cartStore = useCartStore()
const cartOpen = useState('cart-open', () => false)

const selectedImage = ref(0)
const qty = ref(1)

const { data: product } = await useAsyncData(`product-${route.params.slug}`, async () => {
  const { data, error } = await supabase
    .from('products')
    .select('*, category:categories(*)')
    .eq('slug', route.params.slug as string)
    .eq('is_active', true)
    .single()
  if (error) throw createError({ statusCode: 404, fatal: true })
  return data
})

const productName = computed(() =>
  locale.value === 'el' ? product.value?.name_el : product.value?.name_en
)
const productDescription = computed(() =>
  locale.value === 'el' ? product.value?.description_el : product.value?.description_en
)

function addToCart() {
  if (!product.value) return
  cartStore.addItem(product.value, qty.value)
  cartOpen.value = true
}

useSeoMeta({ title: () => `${productName.value} | PetShop CY` })
</script>
