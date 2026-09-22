<template>
  <!-- Search (desktop) — hidden on /products where page has its own search -->
  <div v-if="!route.path.includes('/products')" class="hidden md:flex flex-1 max-w-xs">
    <UInput
      v-model="searchQuery"
      :placeholder="$t('header.search_placeholder')"
      icon="i-heroicons-magnifying-glass"
      size="sm"
      class="w-full [&_input]:rounded-full [&_input]:bg-surface-card [&_input]:border [&_input]:border-[--color-border-warm] [&_input]:placeholder-[--color-bark-light] [&_input]:focus:border-terracotta [&_input]:text-bark [&_input]:text-sm"
      :ui="{ base: 'rounded-full' }"
      @keyup.enter="goToSearch"
    />
  </div>
</template>

<script setup lang="ts">
// Contributed to the header through app.config `headerActions` (registered globally).
const route = useRoute()
const router = useRouter()
const localePath = useLocalePath()
const searchQuery = ref('')

function goToSearch() {
  if (!searchQuery.value.trim()) return
  const filtersStore = useFiltersStore()
  filtersStore.search = searchQuery.value.trim()
  router.push(localePath('/products'))
}
</script>
