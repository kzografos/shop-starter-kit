<template>
  <section class="py-10 bg-cream-pale border-y border-cream">
    <h2 class="font-display text-3xl font-bold text-bark text-center mb-8">
      {{ $t("home.brands") }}
    </h2>

    <UMarquee
      pause-on-hover
      :repeat="3"
      class="mask-[linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]"
    >
      <button
        v-for="brand in brands"
        :key="brand.name"
        class="inline-flex items-center px-10 cursor-pointer group"
        @click="goToBrand(brand.name)"
      >
        <span
          class="text-xl font-semibold uppercase tracking-widest text-bark-light group-hover:text-terracotta transition-colors whitespace-nowrap"
        >
          {{ brand.name }}
        </span>
      </button>
    </UMarquee>
  </section>
</template>

<script setup lang="ts">
const localePath = useLocalePath();
const filtersStore = useFiltersStore();
const router = useRouter();

function goToBrand(name: string) {
  filtersStore.reset();
  filtersStore.selectedBrands = [name];
  router.push(localePath("/products"));
}

const brands = [
  { name: "Brand 1" },
  { name: "Brand 2" },
  { name: "Brand 3" },
  { name: "Brand 4" },
  { name: "Brand 5" },
  { name: "Brand 6" },
  { name: "Brand 7" },
  { name: "Brand 8" },
];
</script>
