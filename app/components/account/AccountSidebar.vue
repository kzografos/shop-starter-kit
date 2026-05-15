<template>
  <aside
    class="h-fit lg:sticky lg:top-6 bg-[--color-surface-card] rounded-2xl border border-[--color-border-warm] p-6"
  >
    <!-- Avatar + name -->
    <div class="flex flex-col items-center text-center mb-6">
      <div class="w-16 h-16 rounded-full bg-terracotta flex items-center justify-center mb-3">
        <span class="font-display text-2xl font-bold text-white">
          {{ avatarInitial }}
        </span>
      </div>
      <p class="text-xs text-[--color-bark-light] mb-0.5">{{ $t('account.greeting') }}</p>
      <p class="font-display font-bold text-[--color-bark] text-base leading-tight">
        {{ displayName }}
      </p>
    </div>

    <!-- Nav -->
    <nav class="flex flex-col gap-1 mb-6">
      <NuxtLink
        v-for="item in navItems"
        :key="item.to"
        :to="item.to"
        class="flex items-center gap-3 w-full px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
        :class="
          isActive(item.to)
            ? 'bg-terracotta text-white'
            : 'text-[--color-bark-light] hover:bg-[--color-surface-page] hover:text-[--color-bark]'
        "
      >
        <span>{{ item.icon }}</span>
        {{ $t(item.labelKey) }}
      </NuxtLink>
    </nav>

    <div class="h-px bg-[--color-border-warm] mb-4" />

    <button
      class="w-full px-4 py-2.5 rounded-xl text-sm font-medium text-terracotta hover:bg-[--color-surface-page] transition-colors text-left cursor-pointer border border-transparent hover:border-terracotta"
      @click="authStore.signOut()"
    >
      {{ $t('nav.logout') }}
    </button>
  </aside>
</template>

<script setup lang="ts">
const authStore = useAuthStore()
const localePath = useLocalePath()
const route = useRoute()

const navItems = computed(() => [
  { to: localePath('/account'), icon: '🏠', labelKey: 'account.title' },
  { to: localePath('/account/orders'), icon: '📦', labelKey: 'account.orders' },
  { to: localePath('/account/favourites'), icon: '❤️', labelKey: 'account.favourites' },
  { to: localePath('/account/loyalty'), icon: '⭐', labelKey: 'account.loyalty' },
])

function isActive(path: string) {
  return route.path === path || (path !== localePath('/account') && route.path.startsWith(path))
}

const avatarInitial = computed(() => {
  const name = authStore.profile?.full_name || authStore.profile?.email || '?'
  return name[0].toUpperCase()
})

const displayName = computed(() => {
  const name = authStore.profile?.full_name
  if (name) return name.split(' ')[0]
  const email = authStore.profile?.email || ''
  return email.split('@')[0]
})
</script>
