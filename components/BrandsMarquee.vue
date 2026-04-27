<template>
  <section class="py-10 bg-white border-y border-gray-100 overflow-hidden">
    <p class="text-center text-xs font-semibold uppercase tracking-widest text-gray-400 mb-8">
      {{ $t('home.brands') }}
    </p>

    <div class="marquee-track">
      <div class="marquee-list">
        <div
          v-for="(brand, i) in [...brands, ...brands]"
          :key="i"
          class="marquee-item"
        >
          <UIcon :name="brand.icon" class="w-7 h-7 text-orange-400 shrink-0" />
          <span class="brand-label">{{ brand.name }}</span>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
const brands = [
  { name: 'Royal Canin',       icon: 'i-heroicons-star' },
  { name: 'Purina Pro Plan',   icon: 'i-heroicons-heart' },
  { name: 'Pedigree',          icon: 'i-heroicons-sparkles' },
  { name: 'Whiskas',           icon: 'i-heroicons-moon' },
  { name: 'Dreamies',          icon: 'i-heroicons-gift' },
  { name: 'Trixie',            icon: 'i-heroicons-bolt' },
  { name: 'Kong',              icon: 'i-heroicons-shield-check' },
  { name: 'Versele-Laga',      icon: 'i-heroicons-sun' },
  { name: 'Vitakraft',         icon: 'i-heroicons-beaker' },
  { name: "Hill's Science Diet", icon: 'i-heroicons-academic-cap' },
  { name: 'Eukanuba',          icon: 'i-heroicons-trophy' },
  { name: 'Orijen',            icon: 'i-heroicons-fire' },
]
</script>

<style scoped>
.marquee-track {
  display: flex;
  width: 100%;
  overflow: hidden;
  mask-image: linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%);
  -webkit-mask-image: linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%);
}

.marquee-list {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  animation: marquee 35s linear infinite;
  width: max-content;
}

.marquee-list:hover {
  animation-play-state: paused;
}

.marquee-item {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 0 40px;
  white-space: nowrap;
  cursor: default;
}

.brand-label {
  font-size: 15px;
  font-weight: 600;
  color: #6b7280;
  transition: color 150ms;
}

.marquee-item:hover .brand-label {
  color: #f97316;
}

.marquee-item:hover :deep(svg) {
  color: #f97316;
}

@keyframes marquee {
  from { transform: translateX(0); }
  to   { transform: translateX(-50%); }
}
</style>
