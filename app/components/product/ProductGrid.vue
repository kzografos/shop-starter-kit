<template>
  <div>
    <!-- Error state -->
    <div v-if="error" class="flex justify-center py-16 text-bark-light">
      {{ $t('products.error') }}
    </div>

    <!-- Empty state -->
    <div v-else-if="!loading && products.length === 0" class="flex justify-center py-16 text-bark-light">
      {{ $t('products.empty') }}
    </div>

    <!-- Skeleton grid -->
    <div v-else-if="loading" class="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
      <div
        v-for="n in 6"
        :key="n"
        class="flex flex-col bg-cream rounded-2xl overflow-hidden border border-cream-pale animate-pulse"
      >
        <div class="aspect-square bg-cream-pale" />
        <div class="flex flex-col flex-1 p-4 gap-1.5">
          <div class="h-3 w-1/3 rounded bg-cream-pale" />
          <div class="h-4 w-3/4 rounded bg-cream-pale mt-0.5" />
          <div class="h-5 w-1/4 rounded bg-cream-pale mt-auto pt-2" />
        </div>
        <div class="px-4 pb-4">
          <div class="h-10 w-full rounded-xl bg-cream-pale" />
        </div>
      </div>
    </div>

    <!-- Product grid -->
    <div v-else class="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
      <ProductCard
        v-for="product in products"
        :key="product.id"
        v-memo="[product.id, favouritesStore.isFavourite(product.id)]"
        :product="product"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Product } from "~~/types";

defineProps<{
  products: Product[];
  loading?: boolean;
  error?: string | null;
}>();

const favouritesStore = useFavouritesStore();
</script>
