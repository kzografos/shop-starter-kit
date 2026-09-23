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


    <!-- Module sections — contributed through app.config `homeSections` (E8d).
         Everything the enabled modules show between the hero and the closing
         banner: the shop's categories rail, deals and brands marquee. -->
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
import { BUSINESS } from '#project/utils/business'

const localePath = useLocalePath()
const { locale } = useI18n()
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

useSeoMeta({
  // Title omitted → global template renders the brand name (language-neutral) on the homepage.
  description: () => locale.value === 'el'
    ? `Ποιοτικά προϊόντα σε καλές τιμές, με παράδοση στην πόρτα σας σε όλη την ${BUSINESS.address.countryName}.`
    : `Quality products at great prices, delivered to your door across ${BUSINESS.address.countryName}.`,
})
</script>
