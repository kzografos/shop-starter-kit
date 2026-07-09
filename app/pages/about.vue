<template>
  <div class="bg-surface-page">
    <!-- Hero -->
    <section class="relative overflow-hidden py-24 sm:py-32 px-4" style="background: linear-gradient(135deg, var(--color-surface-card), var(--color-cream-pale))">
      <span class="absolute top-6 left-8 text-6xl opacity-15 select-none pointer-events-none">🛍️</span>
      <span class="absolute bottom-6 right-8 text-6xl opacity-15 select-none pointer-events-none">📦</span>
      <div class="max-w-4xl mx-auto text-center relative z-10">
        <h1 class="font-display text-4xl sm:text-5xl font-bold text-bark mb-4">{{ $t('about.title') }}</h1>
        <p class="text-lg text-bark-light max-w-2xl mx-auto">{{ $t('about.subtitle') }}</p>
      </div>
    </section>

    <!-- Story -->
    <section class="max-w-4xl mx-auto px-4 py-16">
      <div class="grid md:grid-cols-2 gap-12 items-center">
        <div>
          <h2 class="font-display text-3xl font-bold text-bark mb-6">{{ $t('about.story_title') }}</h2>
          <p class="text-bark-light leading-relaxed mb-4">{{ $t('about.story_p1') }}</p>
          <p class="text-bark-light leading-relaxed">{{ $t('about.story_p2', { country: BUSINESS.address.countryName }) }}</p>
        </div>
        <div class="relative h-72 flex items-center justify-center">
          <div class="absolute left-4 top-0 w-44 h-56 rounded-2xl bg-cream shadow-lg rotate-[-5deg] overflow-hidden flex items-center justify-center">
            <img src="/images/placeholder-product.svg" alt="" class="w-full h-full object-contain p-4" >
          </div>
          <div class="absolute right-4 bottom-0 w-44 h-56 rounded-2xl shadow-lg rotate-[4deg] overflow-hidden flex items-center justify-center" style="background: #EFE7D6;">
            <img src="/images/placeholder-product.svg" alt="" class="w-full h-full object-contain p-4" >
          </div>
        </div>
      </div>
    </section>

    <!-- Values -->
    <section class="bg-cream-pale py-16 px-4">
      <div class="max-w-5xl mx-auto">
        <h2 class="font-display text-3xl font-bold text-bark text-center mb-12">{{ $t('about.values_title') }}</h2>
        <div class="grid sm:grid-cols-3 gap-8">
          <div
            v-for="(value, i) in values"
            :key="value.icon"
            :ref="(el) => { if (el) cardRefs[i] = el as Element }"
            class="bg-white rounded-2xl p-6 text-center shadow-sm cursor-default transition-all duration-300 hover:-translate-y-2 hover:shadow-md"
            :class="visibleCards[i] ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'"
          >
            <div class="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 bg-linear-to-br from-terracotta to-terracotta-dark">
              <UIcon :name="value.icon" class="w-7 h-7 text-white" />
            </div>
            <h3 class="font-semibold text-bark mb-2">{{ value.title }}</h3>
            <p class="text-sm text-bark-light">{{ value.desc }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Stats -->
    <section class="bg-cream py-16 px-4">
      <div class="max-w-4xl mx-auto">
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
          <div>
            <div class="font-display text-4xl font-bold text-terracotta mb-1">200+</div>
            <div class="text-sm text-bark-light uppercase tracking-wider">Προϊόντα</div>
          </div>
          <div>
            <div class="font-display text-4xl font-bold text-terracotta mb-1">1,500+</div>
            <div class="text-sm text-bark-light uppercase tracking-wider">Ικανοποιημένοι πελάτες</div>
          </div>
          <div>
            <div class="font-display text-4xl font-bold text-terracotta mb-1">4.9★</div>
            <div class="text-sm text-bark-light uppercase tracking-wider">Αξιολόγηση</div>
          </div>
          <div>
            <div class="font-display text-4xl font-bold text-terracotta mb-1">2018</div>
            <div class="text-sm text-bark-light uppercase tracking-wider">Ίδρυση</div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { BUSINESS } from '~/utils/business'

const { t } = useI18n()

const values = computed(() => [
  { icon: 'i-heroicons-heart', title: t('about.value1_title'), desc: t('about.value1_desc') },
  { icon: 'i-heroicons-star', title: t('about.value2_title'), desc: t('about.value2_desc') },
  { icon: 'i-heroicons-shield-check', title: t('about.value3_title'), desc: t('about.value3_desc') },
])

// Cards scroll fade-in
const cardRefs: Element[] = []
const visibleCards = ref([false, false, false])

onMounted(() => {
  const cardObs = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const idx = cardRefs.indexOf(entry.target)
        if (idx !== -1) {
          setTimeout(() => { visibleCards.value[idx] = true }, idx * 150)
        }
        cardObs.unobserve(entry.target)
      }
    })
  }, { threshold: 0.2 })
  cardRefs.forEach(el => el && cardObs.observe(el))
})

useSeoMeta({ title: () => t('nav.about') })
</script>
