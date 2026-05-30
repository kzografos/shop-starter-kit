<template>
  <header
    class="sticky top-0 z-50 transition-all duration-300 border-b border-[--color-border-soft]"
    :class="
      scrolled ? 'bg-cream/95 backdrop-blur-md shadow-[0_1px_12px_rgba(58,58,46,0.08)]' : 'bg-cream'
    "
  >
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-16 gap-4">
        <!-- Logo -->
        <NuxtLink :to="localePath('/')" class="shrink-0 flex items-center gap-2">
          <img src="/logo.svg" alt="PetShop CY" class="h-9 w-auto" />
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
            class="w-full [&_input]:rounded-full [&_input]:bg-surface-card [&_input]:border [&_input]:border-[--color-border-warm] [&_input]:placeholder-[--color-bark-light] [&_input]:focus:border-terracotta [&_input]:text-bark [&_input]:text-sm"
            :ui="{ base: 'rounded-full' }"
            @keyup.enter="goToSearch"
          />
        </div>

        <!-- Actions -->
        <div class="flex items-center gap-3">
          <!-- Locale toggle -->
          <div class="flex items-center gap-2">
            <button
              class="transition-opacity duration-150 hover:opacity-100 flex items-center"
              :class="locale === 'el' ? 'opacity-100' : 'opacity-35'"
              aria-label="Ελληνικά"
              @click="setLocale('el')"
            >
              <span class="fi fi-cy fis rounded-sm w-5 h-5" />
            </button>
            <span class="text-[--color-border-warm] text-xs">|</span>
            <button
              class="transition-opacity duration-150 hover:opacity-100 flex items-center"
              :class="locale === 'en' ? 'opacity-100' : 'opacity-35'"
              aria-label="English"
              @click="setLocale('en')"
            >
              <span class="fi fi-gb fis rounded-sm w-5 h-5" />
            </button>
          </div>

          <!-- Account dropdown (logged in) — desktop only; mobile uses the hamburger menu -->
          <div v-if="isLoggedIn" ref="dropdownRef" class="relative hidden md:block">
            <button
              class="h-8 w-8 flex items-center justify-center rounded-full text-bark-light hover:text-bark hover:bg-cream-pale transition-all"
              @click="userMenuOpen = !userMenuOpen"
            >
              <UIcon name="i-heroicons-user-circle" class="w-5 h-5" />
            </button>

            <div
              v-show="userMenuOpen"
              class="absolute right-0 top-full mt-2 w-56 bg-surface-card border border-[--color-border-warm] rounded-2xl shadow-[0_4px_24px_rgba(58,58,46,0.12)] overflow-hidden z-50"
            >
              <!-- User info header -->
              <div class="px-4 py-3 border-b border-[--color-border-warm]">
                <div class="flex items-center gap-3">
                  <div
                    class="w-8 h-8 rounded-full bg-terracotta flex items-center justify-center shrink-0"
                  >
                    <span class="text-white text-sm font-bold font-display">{{
                      avatarInitial
                    }}</span>
                  </div>
                  <div class="min-w-0">
                    <p class="text-sm font-semibold text-[--color-bark] truncate">
                      {{ displayName }}
                    </p>
                    <p class="text-xs text-[--color-bark-light] truncate">{{ profile?.email }}</p>
                  </div>
                </div>
              </div>

              <!-- Account links -->
              <div class="py-1">
                <NuxtLink
                  :to="localePath('/account')"
                  class="flex items-center gap-3 px-4 py-2.5 text-sm text-[--color-bark] hover:bg-[--color-surface-page] transition-colors"
                  @click="userMenuOpen = false"
                >
                  <UIcon name="i-heroicons-user" class="w-4 h-4 text-[--color-bark-light]" />
                  {{ t('nav.account') }}
                </NuxtLink>
                <NuxtLink
                  v-if="isAdmin"
                  :to="localePath('/admin')"
                  class="flex items-center gap-3 px-4 py-2.5 text-sm text-[--color-bark] hover:bg-[--color-surface-page] transition-colors"
                  @click="userMenuOpen = false"
                >
                  <UIcon name="i-heroicons-cog-6-tooth" class="w-4 h-4 text-[--color-bark-light]" />
                  {{ t('nav.admin') }}
                </NuxtLink>
              </div>

              <!-- Sign out -->
              <div class="border-t border-[--color-border-warm] py-1">
                <button
                  class="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-terracotta hover:bg-[--color-surface-page] transition-colors"
                  @click="handleLogout"
                >
                  <UIcon name="i-heroicons-arrow-right-on-rectangle" class="w-4 h-4" />
                  {{ t('nav.logout') }}
                </button>
              </div>
            </div>
          </div>

          <!-- Login button (logged out) — desktop only; mobile uses the hamburger menu -->
          <NuxtLink
            v-else
            :to="localePath('/login')"
            class="h-8 px-3 hidden md:flex items-center rounded-full text-sm font-medium text-bark-light hover:text-bark hover:bg-cream-pale transition-all whitespace-nowrap"
          >
            {{ $t('header.login') }}
          </NuxtLink>

          <!-- Mobile menu button -->
          <button
            class="md:hidden h-8 w-8 flex items-center justify-center rounded-full text-bark-light hover:text-bark hover:bg-cream-pale transition-all"
            @click="mobileMenuOpen = !mobileMenuOpen"
          >
            <UIcon
              :name="mobileMenuOpen ? 'i-heroicons-x-mark' : 'i-heroicons-bars-3'"
              class="w-5 h-5"
            />
          </button>

          <!-- Cart -->
          <button
            class="relative h-8 w-8 flex items-center justify-center rounded-full text-bark-light hover:text-bark hover:bg-cream-pale transition-all"
            @click="cartOpen = true"
          >
            <UIcon
              name="i-heroicons-shopping-bag"
              class="w-5 h-5"
              :class="cartBouncing ? 'cart-bounce' : ''"
            />
            <span
              v-if="itemCount > 0"
              class="absolute -top-0.5 -right-0.5 min-w-4.5 h-4.5 flex items-center justify-center rounded-full bg-terracotta text-white text-[10px] font-bold px-1"
            >
              {{ itemCount }}
            </span>
          </button>
        </div>
      </div>
    </div>

  </header>

  <!-- Mobile menu — teleported to body to avoid backdrop-filter stacking context bug -->
  <Teleport to="body">
    <!-- Backdrop -->
    <Transition
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-150"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-show="mobileMenuOpen"
        class="md:hidden fixed inset-0 z-40 bg-bark/20 backdrop-blur-sm"
        @click="mobileMenuOpen = false"
      />
    </Transition>

    <!-- Panel -->
    <Transition
      enter-active-class="transition-all duration-250 ease-out"
      enter-from-class="opacity-0 -translate-y-3"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition-all duration-200 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-3"
    >
      <div
        v-show="mobileMenuOpen"
        class="md:hidden fixed inset-0 z-50 bg-cream flex flex-col overflow-y-auto"
      >
        <!-- Close bar -->
        <div class="flex items-center justify-between px-4 py-4 border-b border-[--color-border-soft] shrink-0">
          <NuxtLink :to="localePath('/')" class="font-display font-bold text-[--color-bark] text-lg" @click="mobileMenuOpen = false">
            PetShop CY
          </NuxtLink>
          <button class="h-8 w-8 flex items-center justify-center rounded-full hover:bg-cream-pale transition-colors" @click="mobileMenuOpen = false">
            <UIcon name="i-heroicons-x-mark" class="w-5 h-5 text-[--color-bark-light]" />
          </button>
        </div>

        <!-- Nav links — grows to fill space -->
        <nav class="flex flex-col px-4 py-2 flex-1">
          <NuxtLink
            v-for="link in navLinks"
            :key="link.to"
            :to="link.to"
            class="flex items-center justify-between py-4 text-base font-medium border-b border-[--color-border-soft] last:border-0 transition-colors"
            :class="
              $route.path.startsWith(link.to)
                ? 'text-terracotta'
                : 'text-[--color-bark] hover:text-terracotta'
            "
            @click="mobileMenuOpen = false"
          >
            {{ link.label }}
            <UIcon name="i-heroicons-chevron-right" class="w-4 h-4 opacity-40" />
          </NuxtLink>
        </nav>

        <!-- Bottom section — account + language pinned to bottom -->
        <div class="shrink-0 mt-auto">
          <div class="border-t border-[--color-border-soft] px-4">
            <NuxtLink
              v-if="isLoggedIn"
              :to="localePath('/account')"
              class="flex items-center justify-between py-4 text-base font-medium text-[--color-bark] hover:text-terracotta transition-colors"
              @click="mobileMenuOpen = false"
            >
              <span class="flex items-center gap-2">
                <UIcon name="i-heroicons-user-circle" class="w-5 h-5" />
                {{ $t('nav.account') }}
              </span>
              <UIcon name="i-heroicons-chevron-right" class="w-4 h-4 opacity-40" />
            </NuxtLink>
            <NuxtLink
              v-else
              :to="localePath('/login')"
              class="flex items-center justify-between py-4 text-base font-medium text-terracotta hover:text-terracotta-dark transition-colors"
              @click="mobileMenuOpen = false"
            >
              <span class="flex items-center gap-2">
                <UIcon name="i-heroicons-arrow-right-on-rectangle" class="w-5 h-5" />
                {{ $t('header.login') }}
              </span>
              <UIcon name="i-heroicons-chevron-right" class="w-4 h-4 opacity-40" />
            </NuxtLink>
          </div>

          <div class="flex items-center gap-3 px-4 py-5 border-t border-[--color-border-soft]">
            <span class="text-xs text-[--color-bark-light] font-medium">{{
              $t('header.language')
            }}</span>
            <button
              class="transition-opacity hover:opacity-100"
              :class="locale === 'el' ? 'opacity-100' : 'opacity-35'"
              @click="switchLocale('el')"
            >
              <span class="fi fi-cy fis rounded-sm w-5 h-5" />
            </button>
            <span class="text-[--color-border-warm] text-xs">|</span>
            <button
              class="transition-opacity hover:opacity-100"
              :class="locale === 'en' ? 'opacity-100' : 'opacity-35'"
              @click="switchLocale('en')"
            >
              <span class="fi fi-gb fis rounded-sm w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
const { locale, setLocale, t } = useI18n()
const localePath = useLocalePath()
const authStore = useAuthStore()
const cartStore = useCartStore()
const { isLoggedIn, profile, isAdmin } = storeToRefs(authStore)
const { itemCount } = storeToRefs(cartStore)
const cartOpen = useState('cart-open', () => false)
const router = useRouter()

const route = useRoute()
const searchQuery = ref('')
const scrolled = ref(false)
const cartBouncing = ref(false)

watch(itemCount, () => {
    cartBouncing.value = true
    setTimeout(() => {
      cartBouncing.value = false
    }, 400)
  }
)

const navLinks = computed(() => [
  { to: localePath('/products'), label: t('nav.products') },
  { to: localePath('/brands'), label: t('nav.brands') },
  { to: localePath('/about'), label: t('nav.about') },
  { to: localePath('/contact'), label: t('nav.contact') },
])

onMounted(() => {
  const onScroll = () => {
    scrolled.value = window.scrollY > 16
  }
  window.addEventListener('scroll', onScroll, { passive: true })
  onUnmounted(() => window.removeEventListener('scroll', onScroll))

  const onClickOutside = (e: MouseEvent) => {
    if (dropdownRef.value && !dropdownRef.value.contains(e.target as Node)) {
      userMenuOpen.value = false
    }
  }
  document.addEventListener('click', onClickOutside)
  onUnmounted(() => document.removeEventListener('click', onClickOutside))
})

function goToSearch() {
  if (!searchQuery.value.trim()) return
  const filtersStore = useFiltersStore()
  filtersStore.search = searchQuery.value.trim()
  router.push(localePath('/products'))
}

function switchLocale(lang: 'el' | 'en') {
  setLocale(lang)
}

async function handleLogout() {
  userMenuOpen.value = false
  await authStore.signOut()
  await navigateTo(localePath('/'))
}

const dropdownRef = ref<HTMLElement | null>(null)
const userMenuOpen = ref(false)
const mobileMenuOpen = ref(false)

watch(
  () => route.name?.toString().replace(/___\w+$/, ''),
  () => {
    mobileMenuOpen.value = false
  }
)

const avatarInitial = computed(() => {
  const name = profile.value?.full_name || profile.value?.email || '?'
  return name[0].toUpperCase()
})

const displayName = computed(() => {
  const name = profile.value?.full_name
  if (name) return name.split(' ')[0]
  const email = profile.value?.email || ''
  return email.split('@')[0]
})
</script>
