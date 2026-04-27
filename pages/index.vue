<template>
  <div>
    <!-- Hero -->
    <section class="relative overflow-hidden bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 py-20 md:py-32">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h1 class="text-4xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
          {{ $t('home.hero_title') }}
        </h1>
        <p class="text-xl text-gray-600 mb-10 max-w-2xl mx-auto">
          {{ $t('home.hero_subtitle') }}
        </p>
        <UButton
          :label="$t('home.shop_now')"
          size="xl"
          :to="localePath('/products')"
          class="shadow-lg"
        />
      </div>
    </section>

    <!-- Top-level categories -->
    <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <h2 class="text-2xl font-bold text-gray-900 mb-8">{{ $t('home.categories') }}</h2>

      <div v-if="pending" class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <USkeleton v-for="n in 4" :key="n" class="h-32 rounded-2xl" />
      </div>

      <div v-else-if="categories" class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <NuxtLink
          v-for="cat in categories"
          :key="cat.id"
          :to="localePath(`/products?category=${cat.slug}`)"
          class="group flex flex-col items-center justify-center p-6 bg-white rounded-2xl border border-gray-100 hover:border-primary-300 hover:shadow-md transition-all text-center"
        >
          <span class="text-4xl mb-3">{{ catEmoji(cat.slug) }}</span>
          <span class="font-semibold text-gray-800 group-hover:text-primary-600 transition-colors">
            {{ locale === 'el' ? cat.name_el : cat.name_en }}
          </span>
        </NuxtLink>
      </div>
    </section>

    <!-- Shipping info banner -->
    <section class="bg-primary-50 border-y border-primary-100">
      <div class="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <div class="flex flex-col sm:flex-row items-center justify-center gap-6 text-sm font-medium text-primary-700">
          <span class="flex items-center gap-2">
            <UIcon name="i-heroicons-truck" class="w-5 h-5" />
            {{ $t('footer.shipping_info') }}
          </span>
          <span class="flex items-center gap-2">
            <UIcon name="i-heroicons-star" class="w-5 h-5" />
            {{ $t('loyalty.earn_info') }}
          </span>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
const localePath = useLocalePath()
const { locale } = useI18n()
const supabase = useSupabaseClient()

const { data: categories, pending } = await useAsyncData('root-categories', async () => {
  const { data } = await supabase
    .from('categories')
    .select('*')
    .is('parent_id', null)
    .order('sort_order')
  return data
})

function catEmoji(slug: string) {
  const map: Record<string, string> = {
    dogs: '🐕',
    cats: '🐈',
    birds: '🦜',
    rodents: '🐹',
  }
  return map[slug] ?? '🐾'
}

useSeoMeta({
  title: 'PetShop CY — Το Pet Shop σας στην Κύπρο',
  description: 'Τροφές, αξεσουάρ και περιποίηση για σκύλους, γάτες, πουλιά και τρωκτικά. Αποστολή σε όλη την Κύπρο.',
})
</script>
