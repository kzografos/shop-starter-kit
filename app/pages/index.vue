<template>
  <div>
    <!-- Hero -->
    <section class="relative overflow-hidden bg-forest py-24 md:py-36">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="max-w-2xl">
          <p class="text-sage text-sm font-medium tracking-widest uppercase mb-4">{{ $t('home.hero_label') }}</p>
          <h1 class="font-display text-5xl md:text-7xl font-bold text-cream leading-[1.05] mb-6">
            {{ $t('home.hero_title') }}
            <em class="text-terracotta not-italic">{{ $t('home.hero_title_accent') }}</em>
          </h1>
          <p class="text-sage text-lg md:text-xl mb-10 max-w-lg leading-relaxed">
            {{ $t('home.hero_subtitle') }}
          </p>
          <div class="flex flex-wrap gap-4">
            <NuxtLink
              :to="localePath('/products')"
              class="inline-flex items-center px-8 py-3.5 rounded-full bg-terracotta text-white font-semibold text-base hover:bg-terracotta-dark transition-colors"
            >
              {{ $t('home.shop_now') }}
            </NuxtLink>
            <NuxtLink
              :to="localePath('/brands')"
              class="inline-flex items-center px-8 py-3.5 rounded-full border border-sage/40 text-cream font-semibold text-base hover:border-sage transition-colors"
            >
              {{ $t('home.explore_brands') }}
            </NuxtLink>
          </div>
        </div>

        <!-- Trust badges -->
        <div class="mt-16 flex flex-wrap gap-6">
          <div v-for="badge in trustBadges" :key="badge.label" class="flex items-center gap-2 text-sage text-sm">
            <UIcon :name="badge.icon" class="w-4 h-4 text-gold shrink-0" />
            {{ badge.label }}
          </div>
        </div>
      </div>
    </section>

    <!-- Top-level categories -->
    <section class="bg-cream-pale">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 class="font-display text-3xl font-bold text-bark mb-8">{{ $t('home.categories') }}</h2>

        <div v-if="pending" class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <USkeleton v-for="n in 4" :key="n" class="h-32 rounded-2xl" />
        </div>

        <div v-else-if="categories" class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <NuxtLink
            v-for="cat in categories"
            :key="cat.id"
            :to="localePath(`/products?category=${cat.slug}`)"
            class="group flex flex-col items-center justify-center p-6 bg-cream rounded-2xl border border-cream-pale hover:border-terracotta hover:shadow-md transition-all text-center"
          >
            <span class="text-4xl mb-3">{{ catEmoji(cat.slug) }}</span>
            <span class="font-semibold text-bark group-hover:text-terracotta transition-colors">
              {{ locale === 'el' ? cat.name_el : cat.name_en }}
            </span>
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- Brands marquee -->
    <BrandsMarquee />

    <!-- Shipping info banner -->
    <section class="bg-bark border-y border-bark-light/20">
      <div class="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <div class="flex flex-col sm:flex-row items-center justify-center gap-8 text-sm font-medium text-cream/80">
          <span class="flex items-center gap-2">
            <UIcon name="i-heroicons-truck" class="w-5 h-5 text-gold" />
            {{ $t('footer.shipping_info') }}
          </span>
          <span class="flex items-center gap-2">
            <UIcon name="i-heroicons-star" class="w-5 h-5 text-gold" />
            {{ $t('loyalty.earn_info') }}
          </span>
          <span class="flex items-center gap-2">
            <UIcon name="i-heroicons-shield-check" class="w-5 h-5 text-gold" />
            {{ $t('home.vet_approved') }}
          </span>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
const localePath = useLocalePath()
const { locale, t } = useI18n()
const supabase = useSupabaseClient()

const trustBadges = [
  { icon: 'i-heroicons-check-badge', label: t('home.badge_vet') },
  { icon: 'i-heroicons-arrow-uturn-left', label: t('home.badge_returns') },
  { icon: 'i-heroicons-truck', label: t('home.badge_shipping') },
]

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
