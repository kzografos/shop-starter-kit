<template>
  <div>
    <!-- Hero -->
    <section class="bg-cream-pale py-20 px-4">
      <div class="max-w-4xl mx-auto text-center">
        <img src="/logo.svg" alt="PetShop CY" class="h-20 w-auto mx-auto mb-6" />
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
          <p class="text-bark-light leading-relaxed">{{ $t('about.story_p2') }}</p>
        </div>
        <div class="relative h-72 flex items-center justify-center">
          <div class="absolute left-4 top-0 w-44 h-56 rounded-2xl bg-cream shadow-lg rotate-[-5deg] overflow-hidden flex items-center justify-center">
            <img src="/categories/dog.png" alt="Dog" class="w-full h-full object-contain p-4" />
          </div>
          <div class="absolute right-4 bottom-0 w-44 h-56 rounded-2xl shadow-lg rotate-[4deg] overflow-hidden flex items-center justify-center" style="background: #EFE7D6;">
            <img src="/categories/cat.png" alt="Cat" class="w-full h-full object-contain p-4" />
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
    <section ref="statsSection" class="bg-cream py-16 px-4">
      <div class="max-w-4xl mx-auto">
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
          <div v-for="stat in animatedStats" :key="stat.label">
            <div class="font-display text-4xl font-bold text-terracotta mb-1">{{ stat.display }}</div>
            <div class="text-sm text-bark-light uppercase tracking-wider">{{ stat.label }}</div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()

const values = computed(() => [
  { icon: 'i-heroicons-heart', title: t('about.value1_title'), desc: t('about.value1_desc') },
  { icon: 'i-heroicons-star', title: t('about.value2_title'), desc: t('about.value2_desc') },
  { icon: 'i-heroicons-shield-check', title: t('about.value3_title'), desc: t('about.value3_desc') },
])

// Cards scroll fade-in
const cardRefs: Element[] = []
const visibleCards = ref([false, false, false])

// Stats count-up
const statsSection = ref<HTMLElement | null>(null)
const statsStarted = ref(false)
const animatedValues = ref([0, 0, 0, 0])

const statDefs = [
  { target: 500, suffix: '+', comma: false },
  { target: 2000, suffix: '+', comma: true },
  { target: 5, suffix: '★', comma: false },
  { target: 2018, suffix: '', comma: false },
]

const animatedStats = computed(() =>
  statDefs.map((s, i) => ({
    display: (s.comma
      ? animatedValues.value[i].toLocaleString('en-US')
      : String(animatedValues.value[i])) + s.suffix,
    label: [t('about.stat_products'), t('about.stat_customers'), t('about.stat_rating'), t('about.stat_since')][i],
  }))
)

function animateStats() {
  statDefs.forEach((stat, i) => {
    const duration = 1500
    const startTime = performance.now()
    function step(now: number) {
      const progress = Math.min((now - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      animatedValues.value[i] = Math.round(eased * stat.target)
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  })
}

onMounted(() => {
  if (statsSection.value) {
    const statsObs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !statsStarted.value) {
        statsStarted.value = true
        animateStats()
        statsObs.disconnect()
      }
    }, { threshold: 0.5 })
    statsObs.observe(statsSection.value)
  }

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

useSeoMeta({ title: `${t('nav.about')} | PetShop CY` })
</script>
