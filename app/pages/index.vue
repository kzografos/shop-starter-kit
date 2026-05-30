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

        <!-- Stats — 2×2 grid on mobile (balanced), inline row from sm up -->
        <div class="grid grid-cols-2 gap-x-8 gap-y-6 sm:flex sm:gap-8 sm:flex-wrap mt-8 pt-8 border-t border-white/20">
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
    <section class="bg-surface-page py-16">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        <!-- Section heading -->
        <div class="flex items-end justify-between mb-10">
          <div>
            <p class="text-terracotta text-xs font-semibold tracking-widest uppercase mb-2">
              {{ $t('home.categories_eyebrow') }}
            </p>
            <h2 class="font-display text-3xl sm:text-4xl font-bold text-[--color-bark]">
              {{ $t('home.categories') }}
            </h2>
          </div>
          <NuxtLink
            :to="localePath('/products')"
            class="hidden sm:flex items-center gap-1.5 text-sm text-[--color-bark-light] hover:text-terracotta transition-colors"
          >
            {{ $t('home.view_all') }}
            <UIcon name="i-heroicons-arrow-right" class="w-4 h-4" />
          </NuxtLink>
        </div>

        <!-- Skeleton -->
        <div v-if="pending" class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <USkeleton v-for="n in 4" :key="n" class="h-72 rounded-2xl" />
        </div>

        <!-- Cards -->
        <div v-else-if="categories" class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <NuxtLink
            v-for="cat in categories"
            :key="cat.id"
            :to="localePath(`/products?category=${cat.slug}`)"
            class="group relative rounded-2xl overflow-hidden h-64 md:h-80 block"
            :class="catConfig[cat.slug]?.bg ?? 'bg-forest'"
          >
            <!-- Animal image — large, bottom-right positioned -->
            <img
              v-if="catImage(cat.slug)"
              :src="catImage(cat.slug)"
              :alt="locale === 'el' ? cat.name_el : cat.name_en"
              class="absolute bottom-0 right-0 h-44 md:h-56 w-auto object-contain group-hover:scale-110 transition-transform duration-500 drop-shadow-xl"
            />

            <!-- Gradient overlay bottom -->
            <div class="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />

            <!-- Top-left: eyebrow -->
            <div class="absolute top-4 left-4">
              <span class="text-white/50 text-xs font-medium uppercase tracking-widest">
                {{ $t('home.category_label') }}
              </span>
            </div>

            <!-- Bottom-left: name + explore -->
            <div class="absolute bottom-4 left-4 right-4">
              <p class="font-display text-xl md:text-2xl font-bold text-white leading-tight mb-1">
                {{ locale === 'el' ? cat.name_el : cat.name_en }}
              </p>
              <div class="flex items-center gap-1 text-white/70 text-xs font-medium">
                <span>{{ $t('home.explore') }}</span>
                <UIcon
                  name="i-heroicons-arrow-right"
                  class="w-3 h-3 group-hover:translate-x-1 transition-transform duration-200"
                />
              </div>
            </div>
          </NuxtLink>
        </div>

      </div>
    </section>

    <!-- Testimonials -->
    <section class="bg-surface-page py-16 px-4">
      <div class="max-w-6xl mx-auto sm:px-6 lg:px-8">

        <!-- Heading -->
        <div class="text-center mb-12">
          <p class="text-terracotta text-xs font-semibold tracking-widest uppercase mb-3">
            ★★★★★ 4.9
          </p>
          <h2 class="font-display text-3xl sm:text-4xl font-bold text-[--color-bark] mb-3">
            {{ $t('testimonials.title') }}
          </h2>
          <p class="text-[--color-bark-light] max-w-md mx-auto text-sm">
            {{ $t('testimonials.subtitle') }}
          </p>
        </div>

        <!-- Review cards -->
        <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">

          <!-- Review 1 -->
          <div class="bg-[--color-surface-card] rounded-2xl p-6 border border-[--color-border-warm] flex flex-col gap-4">
            <div class="flex items-center gap-1 text-gold">
              <span v-for="i in 5" :key="i" class="text-base">★</span>
            </div>
            <p class="text-sm text-[--color-bark] leading-relaxed flex-1">
              "Εξαιρετική εξυπηρέτηση και πολύ γρήγορη παράδοση! Βρήκα όλα τα προϊόντα που χρειαζόμουν για τον σκύλο μου σε πολύ καλές τιμές. Σίγουρα θα ξαναγοράσω!"
            </p>
            <div class="flex items-center justify-between pt-3 border-t border-[--color-border-warm]">
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-full bg-terracotta flex items-center justify-center shrink-0">
                  <span class="text-white text-sm font-bold">Μ</span>
                </div>
                <div>
                  <p class="text-sm font-semibold text-[--color-bark]">Μαρία Παπαδοπούλου</p>
                  <p class="text-xs text-[--color-bark-light]">Λευκωσία</p>
                </div>
              </div>
              <span class="text-xs text-[--color-bark-light] bg-[--color-surface-page] px-2 py-1 rounded-full border border-[--color-border-warm]">
                Google
              </span>
            </div>
          </div>

          <!-- Review 2 -->
          <div class="bg-[--color-surface-card] rounded-2xl p-6 border border-[--color-border-warm] flex flex-col gap-4">
            <div class="flex items-center gap-1 text-gold">
              <span v-for="i in 5" :key="i" class="text-base">★</span>
            </div>
            <p class="text-sm text-[--color-bark] leading-relaxed flex-1">
              "Το καλύτερο online pet shop στην Κύπρο! Τεράστια ποικιλία προϊόντων, εύκολη πλοήγηση και το σύστημα πόντων ανταμοιβής είναι φανταστικό. Ανεπιφύλακτα το συστήνω!"
            </p>
            <div class="flex items-center justify-between pt-3 border-t border-[--color-border-warm]">
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-full bg-forest flex items-center justify-center shrink-0">
                  <span class="text-white text-sm font-bold">Γ</span>
                </div>
                <div>
                  <p class="text-sm font-semibold text-[--color-bark]">Γιώργος Χριστοδούλου</p>
                  <p class="text-xs text-[--color-bark-light]">Λάρνακα</p>
                </div>
              </div>
              <span class="text-xs text-[--color-bark-light] bg-[--color-surface-page] px-2 py-1 rounded-full border border-[--color-border-warm]">
                Google
              </span>
            </div>
          </div>

          <!-- Review 3 -->
          <div class="bg-[--color-surface-card] rounded-2xl p-6 border border-[--color-border-warm] flex flex-col gap-4 sm:col-span-2 lg:col-span-1">
            <div class="flex items-center gap-1 text-gold">
              <span v-for="i in 5" :key="i" class="text-base">★</span>
            </div>
            <p class="text-sm text-[--color-bark] leading-relaxed flex-1">
              "Amazing selection and super fast delivery! My cats absolutely love the Royal Canin food I ordered. The loyalty points system is a great bonus. Highly recommend to all pet owners in Cyprus!"
            </p>
            <div class="flex items-center justify-between pt-3 border-t border-[--color-border-warm]">
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-full bg-sage-dark flex items-center justify-center shrink-0">
                  <span class="text-white text-sm font-bold">A</span>
                </div>
                <div>
                  <p class="text-sm font-semibold text-[--color-bark]">Andreas Georgiou</p>
                  <p class="text-xs text-[--color-bark-light]">Λεμεσός</p>
                </div>
              </div>
              <span class="text-xs text-[--color-bark-light] bg-[--color-surface-page] px-2 py-1 rounded-full border border-[--color-border-warm]">
                Facebook
              </span>
            </div>
          </div>

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
import type { Category } from '~~/types'

const localePath = useLocalePath()
const { locale } = useI18n()
const { public: { apiBase } } = useRuntimeConfig()

const stats = [
  { value: '200+', labelKey: 'hero.stat_products' },
  { value: '1,500+', labelKey: 'hero.stat_customers' },
  { value: '4.9★', labelKey: 'hero.stat_rating' },
  { value: '€50+', labelKey: 'hero.stat_shipping' },
]

const { data: categories, pending } = useAsyncData('root-categories', async () => {
  const tree = await $fetch<Category[]>(`${apiBase}/categories`, { credentials: 'include' }).catch(() => [])
  return tree.filter((c) => !c.parent_id)
}, { server: false, lazy: true })

const catImages: Record<string, string> = {
  dogs: '/categories/dog.png',
  cats: '/categories/cat.png',
  birds: '/categories/bird.png',
  rodents: '/categories/rodent.png',
}

const catConfig: Record<string, { bg: string }> = {
  dogs: { bg: 'bg-forest' },
  cats: { bg: 'bg-terracotta' },
  birds: { bg: 'bg-sage-dark' },
  rodents: { bg: 'bg-bark' },
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
