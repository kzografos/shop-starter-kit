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
  { name: "Royal Canin" },
  { name: "Purina Pro Plan" },
  { name: "Pedigree" },
  { name: "Whiskas" },
  { name: "Dreamies" },
  { name: "Trixie" },
  { name: "Kong" },
  { name: "Versele-Laga" },
  { name: "Vitakraft" },
  { name: "Hill's Science Diet" },
  { name: "Eukanuba" },
  { name: "Orijen" },
];
</script>
