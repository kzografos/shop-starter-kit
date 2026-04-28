<template>
  <div>
    <!-- Hero -->
    <section class="bg-gradient-to-br from-orange-50 to-red-50 py-20 px-4">
      <div class="max-w-4xl mx-auto text-center">
        <img src="/logo.svg" alt="PetShop CY" class="h-20 w-auto mx-auto mb-6" />
        <h1 class="text-4xl font-bold text-gray-900 mb-4">{{ $t('about.title') }}</h1>
        <p class="text-lg text-gray-600 max-w-2xl mx-auto">{{ $t('about.subtitle') }}</p>
      </div>
    </section>

    <!-- Story -->
    <section class="max-w-4xl mx-auto px-4 py-16">
      <div class="grid md:grid-cols-2 gap-12 items-center">
        <div>
          <h2 class="text-2xl font-bold text-gray-900 mb-4">{{ $t('about.story_title') }}</h2>
          <p class="text-gray-600 leading-relaxed mb-4">{{ $t('about.story_p1') }}</p>
          <p class="text-gray-600 leading-relaxed">{{ $t('about.story_p2') }}</p>
        </div>
        <div class="rounded-2xl overflow-hidden shadow-lg aspect-[4/3] bg-orange-100 flex items-center justify-center">
          <UIcon name="i-heroicons-heart" class="w-24 h-24 text-orange-300" />
        </div>
      </div>
    </section>

    <!-- Values -->
    <section class="bg-gray-50 py-16 px-4">
      <div class="max-w-5xl mx-auto">
        <h2 class="text-2xl font-bold text-gray-900 text-center mb-12">{{ $t('about.values_title') }}</h2>
        <div class="grid sm:grid-cols-3 gap-8">
          <div
            v-for="value in values"
            :key="value.icon"
            class="bg-white rounded-2xl p-6 text-center shadow-sm"
          >
            <div class="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
              style="background: linear-gradient(135deg, #fb923c 0%, #ef4444 100%)"
            >
              <UIcon :name="value.icon" class="w-7 h-7 text-white" />
            </div>
            <h3 class="font-semibold text-gray-900 mb-2">{{ value.title }}</h3>
            <p class="text-sm text-gray-500">{{ value.desc }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Stats -->
    <section class="max-w-4xl mx-auto px-4 py-16">
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
        <div v-for="stat in stats" :key="stat.label">
          <div class="text-3xl font-bold text-orange-500 mb-1">{{ stat.value }}</div>
          <div class="text-sm text-gray-500">{{ stat.label }}</div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()

const values = computed(() => [
  {
    icon: 'i-heroicons-heart',
    title: t('about.value1_title'),
    desc: t('about.value1_desc'),
  },
  {
    icon: 'i-heroicons-star',
    title: t('about.value2_title'),
    desc: t('about.value2_desc'),
  },
  {
    icon: 'i-heroicons-shield-check',
    title: t('about.value3_title'),
    desc: t('about.value3_desc'),
  },
])

const stats = computed(() => [
  { value: '500+', label: t('about.stat_products') },
  { value: '2,000+', label: t('about.stat_customers') },
  { value: '5★', label: t('about.stat_rating') },
  { value: '2018', label: t('about.stat_since') },
])

useSeoMeta({ title: `${t('nav.about')} | PetShop CY` })
</script>
