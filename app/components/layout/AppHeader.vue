<template>
  <header
    class="sticky top-0 z-50 transition-all duration-300 border-b border-[#EDE5D5]"
    :class="scrolled
      ? 'bg-cream/95 backdrop-blur-md shadow-[0_1px_12px_rgba(58,58,46,0.08)]'
      : 'bg-cream'"
  >
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-16 gap-4">
        <!-- Logo -->
        <NuxtLink :to="localePath('/')" class="shrink-0 flex items-center gap-2">
          <img src="/logo.svg" alt="PetShop CY" class="h-9 w-auto" >
        </NuxtLink>

        <!-- Desktop nav -->
        <nav class="hidden md:flex items-center gap-1">
          <NuxtLink
            v-for="link in navLinks"
            :key="link.to"
            :to="link.to"
            class="px-3 py-1.5 rounded-lg text-sm font-medium text-bark-light hover:text-bark hover:bg-cream-pale transition-all duration-150"
            active-class="text-bark bg-cream-pale"
          >
            {{ link.label }}
          </NuxtLink>
        </nav>

        <!-- Search (desktop) — hidden on /products where page has its own search -->
        <div v-if="!route.path.includes('/products')" class="hidden md:flex flex-1 max-w-xs">
          <UInput
            v-model="searchQuery"
            :placeholder="$t('header.search_placeholder')"
            icon="i-heroicons-magnifying-glass"
            size="sm"
            class="w-full [&_input]:rounded-full [&_input]:bg-[#EFE7D6] [&_input]:border [&_input]:border-[#D8D4C2] [&_input]:placeholder-[#A8A99A] [&_input]:focus:border-terracotta [&_input]:text-bark [&_input]:text-sm"
            :ui="{ base: 'rounded-full' }"
            @keyup.enter="goToSearch"
          />
        </div>

        <!-- Actions -->
        <div class="flex items-center gap-3">
          <!-- Locale toggle — pill matching icon visual weight -->
          <button
            class="h-8 px-2.5 rounded-full text-xs font-semibold text-bark-light hover:text-bark hover:bg-cream-pale border border-transparent hover:border-[#D8D4C2] transition-all"
            @click="toggleLocale"
          >
            {{ $t('header.locale') }}
          </button>

          <!-- Account dropdown (logged in) -->
          <UDropdownMenu v-if="user" :items="userMenuItems">
            <button class="h-8 w-8 flex items-center justify-center rounded-full text-bark-light hover:text-bark hover:bg-cream-pale transition-all">
              <UIcon name="i-heroicons-user-circle" class="w-5 h-5" />
            </button>
          </UDropdownMenu>

          <!-- Login button (logged out) -->
          <NuxtLink
            v-else
            :to="localePath('/login')"
            class="h-8 px-3 flex items-center rounded-full text-sm font-medium text-bark-light hover:text-bark hover:bg-cream-pale transition-all"
          >
            {{ $t('header.login') }}
          </NuxtLink>

          <!-- Cart -->
          <button
            class="relative h-8 w-8 flex items-center justify-center rounded-full text-bark-light hover:text-bark hover:bg-cream-pale transition-all"
            @click="cartOpen = true"
          >
            <UIcon name="i-heroicons-shopping-bag" class="w-5 h-5" :class="cartBouncing ? 'cart-bounce' : ''" />
            <span
              v-if="cartStore.itemCount > 0"
              class="absolute -top-0.5 -right-0.5 min-w-4.5 h-4.5 flex items-center justify-center rounded-full bg-terracotta text-white text-[10px] font-bold px-1"
            >
              {{ cartStore.itemCount }}
            </span>
          </button>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
const { locale, setLocale, t } = useI18n()
const localePath = useLocalePath()
const user = useSupabaseUser()
const authStore = useAuthStore()
const cartStore = useCartStore()
const cartOpen = useState('cart-open', () => false)
const router = useRouter()

const route = useRoute()
const searchQuery = ref('')
const scrolled = ref(false)
const cartBouncing = ref(false)

watch(() => cartStore.itemCount, () => {
  cartBouncing.value = true
  setTimeout(() => { cartBouncing.value = false }, 400)
})

const navLinks = computed(() => [
  { to: localePath('/products'), label: t('nav.products') },
  { to: localePath('/brands'), label: t('nav.brands') },
  { to: localePath('/about'), label: t('nav.about') },
  { to: localePath('/contact'), label: t('nav.contact') },
])

onMounted(() => {
  const onScroll = () => { scrolled.value = window.scrollY > 16 }
  window.addEventListener('scroll', onScroll, { passive: true })
  onUnmounted(() => window.removeEventListener('scroll', onScroll))
})

function toggleLocale() {
  setLocale(locale.value === 'el' ? 'en' : 'el')
}

function goToSearch() {
  if (!searchQuery.value.trim()) return
  const filtersStore = useFiltersStore()
  filtersStore.search = searchQuery.value.trim()
  router.push(localePath('/products'))
}

async function handleLogout() {
  await authStore.signOut()
  await navigateTo(localePath('/'))
}

interface MenuItem {
  label: string
  icon: string
  to?: string
  onSelect?: () => void
}

const userMenuItems = computed(() => {
  const items: MenuItem[][] = [
    [
      {
        label: t('nav.account'),
        icon: 'i-heroicons-user',
        to: localePath('/account'),
      },
      ...(authStore.isAdmin
        ? [{ label: t('nav.admin'), icon: 'i-heroicons-cog-6-tooth', to: localePath('/admin') }]
        : []),
    ],
    [
      {
        label: t('nav.logout'),
        icon: 'i-heroicons-arrow-right-on-rectangle',
        onSelect: handleLogout,
      },
    ],
  ]
  return items
})
</script>
