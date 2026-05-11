<template>
  <div>
    <!-- Hero -->
    <section class="grid grid-cols-1 lg:grid-cols-2 min-h-145">
      <!-- Left column -->
      <div class="bg-forest flex flex-col justify-center px-10 py-16 lg:px-16 min-h-125 lg:min-h-0">
        <p class="text-sage text-xs font-medium tracking-widest uppercase mb-4">
          {{ $t('hero.tagline') }}
        </p>
        <h1 class="font-display text-4xl md:text-5xl font-bold text-cream leading-[1.05] mb-6">
          {{ $t('home.hero_title') }}<br />
          <em class="text-terracotta not-italic">{{ $t('home.hero_title_accent') }}</em>
        </h1>
        <p class="text-white/70 text-base md:text-lg mb-10 max-w-sm leading-relaxed">
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
            class="inline-flex items-center px-8 py-3.5 rounded-full border border-white/40 text-cream font-semibold text-base hover:border-white transition-colors"
          >
            {{ $t('home.explore_brands') }}
          </NuxtLink>
        </div>

        <!-- Stats row -->
        <div class="flex gap-8 flex-wrap mt-8 pt-8 border-t border-white/20">
          <div v-for="stat in stats" :key="stat.labelKey" class="flex flex-col">
            <span class="text-2xl font-bold font-display text-white">{{ stat.value }}</span>
            <span class="text-xs text-white/60 mt-0.5">{{ $t(stat.labelKey) }}</span>
          </div>
        </div>
      </div>

      <!-- Right column: image, hidden on mobile -->
      <div class="hidden lg:block">
        <img
          src="/hero-image.png"
          alt="PetShop CY"
          class="w-full h-full object-cover object-center"
        />
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
            class="group flex flex-col items-center justify-center p-6 pt-8 pb-6 bg-cream rounded-2xl border border-cream-pale hover:border-terracotta hover:shadow-md transition-all text-center overflow-hidden"
          >
            <!-- Real image if available, emoji fallback -->
            <img
              v-if="catImage(cat.slug)"
              :src="catImage(cat.slug)"
              :alt="cat.slug"
              class="h-24 w-auto object-contain mb-4 group-hover:scale-105 transition-transform duration-300"
            />
            <span v-else class="text-5xl mb-4 block">🐾</span>

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
        <div
          class="flex flex-col sm:flex-row items-center justify-center gap-8 text-sm font-medium text-cream/80"
        >
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
const { locale } = useI18n()
const supabase = useSupabaseClient()

const stats = [
  { value: '200+', labelKey: 'hero.stat_products' },
  { value: '1,500+', labelKey: 'hero.stat_customers' },
  { value: '4.9★', labelKey: 'hero.stat_rating' },
  { value: '€50+', labelKey: 'hero.stat_shipping' },
]

const { data: categories, pending } = await useAsyncData('root-categories', async () => {
  const { data } = await supabase
    .from('categories')
    .select('*')
    .is('parent_id', null)
    .order('sort_order')
  return data
})

const catImages: Record<string, string> = {
  dogs: '/categories/dog.png',
  cats: '/categories/cat.png',
  birds: '/categories/bird.png',
  rodents: '/categories/rodent.png',
}

function catImage(slug: string): string | undefined {
  return catImages[slug] ?? undefined
}

useSeoMeta({
  title: 'PetShop CY — Το Pet Shop σας στην Κύπρο',
  description:
    'Τροφές, αξεσουάρ και περιποίηση για σκύλους, γάτες, πουλιά και τρωκτικά. Αποστολή σε όλη την Κύπρο.',
})
</script>
