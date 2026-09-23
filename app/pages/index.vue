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
          {{ $t('home.hero_subtitle', { country: BUSINESS.address.countryName }) }}
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
      <div class="hidden lg:block relative">
        <img
          src="/images/hero-placeholder.svg"
          :alt="BUSINESS.legalName"
          class="absolute inset-0 h-full w-full object-cover object-center"
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

        <!-- Cards — snapping carousel -->
        <div v-else-if="categories" class="relative">
          <!-- Prev arrow (desktop/tablet) -->
          <button
            class="hidden md:flex absolute -left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 items-center justify-center rounded-full bg-cream border border-[--color-border-warm] shadow-md text-bark hover:border-terracotta hover:text-terracotta transition disabled:opacity-0 disabled:pointer-events-none"
            :disabled="atStart"
            aria-label="Previous categories"
            @click="scrollByPage(-1)"
          >
            <UIcon name="i-heroicons-chevron-left" class="w-5 h-5" />
          </button>
          <!-- Next arrow -->
          <button
            class="hidden md:flex absolute -right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 items-center justify-center rounded-full bg-cream border border-[--color-border-warm] shadow-md text-bark hover:border-terracotta hover:text-terracotta transition disabled:opacity-0 disabled:pointer-events-none"
            :disabled="atEnd"
            aria-label="Next categories"
            @click="scrollByPage(1)"
          >
            <UIcon name="i-heroicons-chevron-right" class="w-5 h-5" />
          </button>

          <!-- Rail -->
          <div
            ref="railEl"
            class="flex gap-4 overflow-x-auto snap-x snap-mandatory no-scrollbar pb-1"
            @scroll.passive="updateRailState"
          >
          <NuxtLink
            v-for="(cat, i) in categories"
            :key="cat.id"
            :to="localePath(`/products?category=${cat.slug}`)"
            class="snap-start shrink-0 w-[78%] sm:w-[42%] lg:w-[22%] group relative rounded-2xl overflow-hidden h-44 md:h-56 block"
            :class="catBg(i)"
          >
            <!-- Gradient overlay bottom (subtle, for text contrast) -->
            <div class="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-black/30 via-black/10 to-transparent" />

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

          <!-- Dots -->
          <div class="flex justify-center gap-2 mt-5">
            <button
              v-for="(cat, i) in categories"
              :key="cat.id"
              class="h-2 rounded-full transition-all duration-200"
              :class="activeIndex === i ? 'w-6 bg-terracotta' : 'w-2 bg-[--color-border-warm] hover:bg-[--color-bark-light]'"
              :aria-label="`Go to ${locale === 'el' ? cat.name_el : cat.name_en}`"
              @click="scrollToCard(i)"
            />
          </div>
        </div>

      </div>
    </section>

    <!-- Module sections — contributed through app.config `homeSections` (E8d).
         The deals rail and the brands marquee are contributed here since E8d2;
         the categories rail above follows in E8d3. -->
    <component
      :is="section.component"
      v-for="section in homeSections"
      :key="section.component"
    />

    <!-- Shipping info banner -->
    <section class="bg-bark border-y border-bark-light/20">
      <div class="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <div
          class="flex flex-col sm:flex-row items-center justify-center gap-8 text-sm font-medium text-cream/80"
        >
          <span class="flex items-center gap-2">
            <UIcon name="i-heroicons-truck" class="w-5 h-5 text-gold" />
            {{ $t('footer.shipping_info', { country: BUSINESS.address.countryName }) }}
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
import type { Category } from '#shop/types'
import { BUSINESS } from '#project/utils/business'

const localePath = useLocalePath()
const { locale } = useI18n()
const api = useApi()
const appConfig = useAppConfig()

// Home sections contributed by the enabled modules (E8d); empty until they
// contribute, and the page never names a module.
const homeSections = computed(() =>
  [...(appConfig.homeSections ?? [])].sort((a, b) => a.order - b.order),
)

const stats = [
  { value: '200+', labelKey: 'hero.stat_products' },
  { value: '1,500+', labelKey: 'hero.stat_customers' },
  { value: '4.9★', labelKey: 'hero.stat_rating' },
  { value: '€50+', labelKey: 'hero.stat_shipping' },
]

const { data: categories, pending } = useAsyncData('root-categories', async () => {
  const tree = await api<Category[]>(`/categories`).catch(() => [])
  return tree.filter((c) => !c.parent_id)
}, { server: false, lazy: true })

// Rotating brand-colour backgrounds, cycled by card index — the solid
// coloured tile + category name is the design (no image, slug-independent).
const CATEGORY_BGS = ['bg-forest', 'bg-terracotta', 'bg-sage-dark', 'bg-bark']

function catBg(index: number): string {
  return CATEGORY_BGS[index % CATEGORY_BGS.length] ?? CATEGORY_BGS[0]!
}

// ── Category carousel (native scroll-snap) ───────────────────
const railEl = ref<HTMLElement | null>(null)
const activeIndex = ref(0)
const atStart = ref(true)
const atEnd = ref(false)

function updateRailState() {
  const el = railEl.value
  if (!el) return
  atStart.value = el.scrollLeft <= 2
  atEnd.value = el.scrollLeft + el.clientWidth >= el.scrollWidth - 2
  const cards = Array.from(el.children) as HTMLElement[]
  let nearest = 0
  let min = Infinity
  cards.forEach((c, i) => {
    const d = Math.abs(c.offsetLeft - el.scrollLeft)
    if (d < min) { min = d; nearest = i }
  })
  activeIndex.value = nearest
}

function scrollToCard(i: number) {
  const el = railEl.value
  const card = el?.children[i] as HTMLElement | undefined
  if (el && card) el.scrollTo({ left: card.offsetLeft, behavior: 'smooth' })
}

function scrollByPage(dir: number) {
  const el = railEl.value
  if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: 'smooth' })
}

// Recompute edge/active state once cards are rendered.
watch(categories, () => nextTick(updateRailState))
onMounted(() => nextTick(updateRailState))

useSeoMeta({
  // Title omitted → global template renders the brand name (language-neutral) on the homepage.
  description: () => locale.value === 'el'
    ? `Ποιοτικά προϊόντα σε καλές τιμές, με παράδοση στην πόρτα σας σε όλη την ${BUSINESS.address.countryName}.`
    : `Quality products at great prices, delivered to your door across ${BUSINESS.address.countryName}.`,
})
</script>

<style scoped>
/* Hide the native scrollbar on the category rail (snap still works) */
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
</style>
