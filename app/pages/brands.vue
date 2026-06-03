<template>
  <div class="bg-surface-page min-h-screen">
    <!-- Hero -->
    <section class="py-14 px-4">
      <div class="max-w-7xl mx-auto sm:px-6 lg:px-8">
        <p class="text-terracotta text-xs font-semibold tracking-widest uppercase mb-3">{{ $t('brands.eyebrow') }}</p>
        <h1 class="font-display text-4xl sm:text-5xl font-bold text-[--color-bark] mb-3">{{ $t('brands.title') }}</h1>
        <p class="text-[--color-bark-light] max-w-xl">{{ $t('brands.subtitle') }}</p>
        <p v-if="brands?.length" class="mt-4 text-sm text-[--color-bark-light]">
          <span class="font-semibold text-[--color-bark]">{{ brands.length }}</span> {{ $t('brands.available') }}
        </p>
      </div>
    </section>

    <!-- Loading -->
    <div v-if="pending" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-6">
      <div class="grid sm:grid-cols-3 gap-5">
        <USkeleton v-for="n in 3" :key="n" class="h-36 rounded-2xl" />
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <USkeleton v-for="n in 8" :key="n" class="h-24 rounded-2xl" />
      </div>
    </div>

    <template v-else-if="brands?.length">
      <!-- Featured brands (top 3) -->
      <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-6">
        <div class="grid sm:grid-cols-3 gap-5">
          <button
            v-for="brand in featuredBrands"
            :key="brand.name"
            class="group relative bg-[--color-surface-card] rounded-2xl p-8 overflow-hidden text-left border border-[--color-border-warm] hover:border-terracotta transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
            @click="goToBrand(brand.name)"
          >
            <!-- Decorative large initial -->
            <span class="absolute -bottom-4 -right-2 font-display text-[8rem] font-bold text-terracotta/8 leading-none select-none pointer-events-none">
              {{ brand.name[0] }}
            </span>

            <!-- Bottom slide bar -->
            <div class="absolute bottom-0 left-0 right-0 h-0.5 bg-terracotta scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />

            <div class="relative">
              <!-- Brand initial badge -->
              <div class="w-10 h-10 rounded-xl bg-terracotta/10 flex items-center justify-center mb-4">
                <span class="font-display text-lg font-bold text-terracotta">{{ brand.name[0] }}</span>
              </div>
              <p class="font-display text-xl font-bold text-[--color-bark] group-hover:text-terracotta transition-colors duration-300 leading-tight mb-1">
                {{ brand.name }}
              </p>
              <p class="text-[--color-bark-light] text-sm">
                {{ brand.count }} {{ brand.count === 1 ? $t('brands.product') : $t('brands.products') }}
              </p>
            </div>

            <UIcon name="i-heroicons-arrow-right" class="absolute top-6 right-6 w-4 h-4 text-[--color-bark-light]/30 group-hover:text-terracotta/60 group-hover:translate-x-0.5 transition-all duration-300" />
          </button>
        </div>
      </section>

      <!-- Regular brands -->
      <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <button
            v-for="brand in regularBrands"
            :key="brand.name"
            class="group relative bg-[--color-surface-card] rounded-xl p-5 overflow-hidden text-left border border-[--color-border-warm] hover:border-terracotta transition-all duration-300 hover:-translate-y-0.5"
            @click="goToBrand(brand.name)"
          >
            <div class="absolute bottom-0 left-0 right-0 h-0.5 bg-terracotta scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
            <div class="w-7 h-7 rounded-lg bg-terracotta/10 flex items-center justify-center mb-3">
              <span class="font-display text-sm font-bold text-terracotta">{{ brand.name[0] }}</span>
            </div>
            <p class="font-display text-base font-bold text-[--color-bark] group-hover:text-terracotta transition-colors duration-300 leading-tight">
              {{ brand.name }}
            </p>
            <p class="text-[--color-bark-light] text-xs mt-1">
              {{ brand.count }} {{ brand.count === 1 ? $t('brands.product') : $t('brands.products') }}
            </p>
          </button>
        </div>
      </section>
    </template>

    <p v-else-if="!pending" class="text-center text-[--color-bark-light] py-24">
      {{ $t('brands.empty') }}
    </p>
  </div>
</template>

<script setup lang="ts">
const localePath = useLocalePath()
const filtersStore = useFiltersStore()
const router = useRouter()
const { t } = useI18n()
const { public: { apiBase } } = useRuntimeConfig()

const { data: brands, pending } = useAsyncData('brands-page', async () => {
  const data = await $fetch<Array<{ brand: string; count: number }>>(
    `${apiBase}/products/brands`,
    { credentials: 'include' },
  ).catch(() => [])
  return data.map((r) => ({ name: r.brand, count: r.count }))
}, { server: false })

const featuredBrands = computed(() => brands.value?.slice(0, 3) ?? [])
const regularBrands = computed(() => brands.value?.slice(3) ?? [])

function goToBrand(brandName: string) {
  filtersStore.reset()
  filtersStore.selectedBrands = [brandName]
  router.push(localePath('/products'))
}

useSeoMeta({
  title: t('brands.title'),
  description: t('brands.subtitle'),
})
</script>
