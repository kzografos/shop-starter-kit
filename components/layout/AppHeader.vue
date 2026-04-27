<template>
  <header class="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-16 gap-4">
        <!-- Logo -->
        <NuxtLink :to="localePath('/')" class="flex-shrink-0">
          <img src="/logo.svg" alt="PetShop CY" class="h-10 w-auto" />
        </NuxtLink>

        <!-- Desktop nav -->
        <nav class="hidden md:flex items-center gap-6">
          <NuxtLink
            :to="localePath('/products')"
            class="text-sm font-medium text-gray-700 hover:text-primary-500 transition-colors"
          >
            {{ $t('nav.products') }}
          </NuxtLink>
        </nav>

        <!-- Search (desktop) -->
        <div class="hidden md:flex flex-1 max-w-xs">
          <UInput
            v-model="searchQuery"
            :placeholder="$t('header.search_placeholder')"
            icon="i-heroicons-magnifying-glass"
            size="sm"
            class="w-full"
            @keyup.enter="goToSearch"
          />
        </div>

        <!-- Actions -->
        <div class="flex items-center gap-1">
          <!-- Locale toggle -->
          <UButton
            :label="$t('header.locale')"
            variant="ghost"
            color="neutral"
            size="sm"
            @click="toggleLocale"
          />

          <!-- Account -->
          <UButton
            v-if="user"
            icon="i-heroicons-user"
            variant="ghost"
            color="neutral"
            size="sm"
            :to="localePath('/account')"
          />
          <UButton
            v-else
            :label="$t('header.login')"
            variant="ghost"
            color="neutral"
            size="sm"
            :to="localePath('/login')"
          />

          <!-- Cart -->
          <UButton
            icon="i-heroicons-shopping-cart"
            variant="ghost"
            color="neutral"
            size="sm"
            :badge="cartStore.itemCount > 0 ? String(cartStore.itemCount) : undefined"
            @click="cartOpen = true"
          />
        </div>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
const { locale, setLocale } = useI18n()
const localePath = useLocalePath()
const user = useSupabaseUser()
const cartStore = useCartStore()
const cartOpen = useState('cart-open', () => false)
const router = useRouter()

const searchQuery = ref('')

function toggleLocale() {
  setLocale(locale.value === 'el' ? 'en' : 'el')
}

function goToSearch() {
  if (!searchQuery.value.trim()) return
  const filtersStore = useFiltersStore()
  filtersStore.search = searchQuery.value.trim()
  router.push(localePath('/products'))
}
</script>
