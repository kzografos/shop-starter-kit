<template>
  <section class="py-10 bg-white border-y border-gray-100">
    <p class="text-center text-xs font-semibold uppercase tracking-widest text-gray-400 mb-8">
      {{ $t('home.brands') }}
    </p>

    <UMarquee pause-on-hover :repeat="3" class="mask-[linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
      <div
        v-for="brand in brands"
        :key="brand.name"
        class="inline-flex items-center gap-2.5 px-10 cursor-default group"
      >
        <UIcon :name="brand.icon" class="w-6 h-6 text-orange-400 group-hover:text-orange-500 transition-colors shrink-0" />
        <span class="text-[15px] font-semibold text-gray-500 group-hover:text-orange-500 transition-colors whitespace-nowrap">
          {{ brand.name }}
        </span>
      </div>
    </UMarquee>
  </section>
</template>

<script setup lang="ts">
const brands = [
  { name: 'Royal Canin',         icon: 'i-heroicons-star' },
  { name: 'Purina Pro Plan',     icon: 'i-heroicons-heart' },
  { name: 'Pedigree',            icon: 'i-heroicons-sparkles' },
  { name: 'Whiskas',             icon: 'i-heroicons-moon' },
  { name: 'Dreamies',            icon: 'i-heroicons-gift' },
  { name: 'Trixie',              icon: 'i-heroicons-bolt' },
  { name: 'Kong',                icon: 'i-heroicons-shield-check' },
  { name: 'Versele-Laga',        icon: 'i-heroicons-sun' },
  { name: 'Vitakraft',           icon: 'i-heroicons-beaker' },
  { name: "Hill's Science Diet", icon: 'i-heroicons-academic-cap' },
  { name: 'Eukanuba',            icon: 'i-heroicons-trophy' },
  { name: 'Orijen',              icon: 'i-heroicons-fire' },
]
</script>
