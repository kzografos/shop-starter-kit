<template>
  <div class="admin-app">
    <!-- ── Sidebar ─────────────────────────────────────── -->
    <aside class="admin-sidebar">
      <!-- Logo -->
      <div class="admin-sidebar-head" style="flex-direction: column; align-items: flex-start; gap: 8px;">
        <div style="display: flex; align-items: center; gap: 10px; width: 100%;">
          <component :is="brand.component" v-if="brand" inverted class="text-base" />
          <span class="admin-pill">Admin</span>
        </div>
        <NuxtLink :to="localePath('/')" class="admin-back-link">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          Επιστροφή στο κατάστημα
        </NuxtLink>
      </div>

      <!-- Nav: groups and sections from the Admin Registry (app.config.adminSections) -->
      <div v-for="group in groups" :key="group.id" class="admin-nav-section" :data-admin-group="group.id">
        <span v-if="group.labelKey" class="admin-nav-section-label">{{ $t(group.labelKey) }}</span>
        <button
          v-for="section in group.sections"
          :key="section.id"
          class="admin-nav-item"
          :class="{ active: isActive(section) }"
          :data-admin-section="section.id"
          @click="navigateTo(localePath(section.path))"
        >
          <AdminIcon :name="section.icon" />
          <span>{{ $t(section.labelKey) }}</span>
          <span v-if="badge(section) > 0" class="admin-nav-badge">{{ badge(section) > 99 ? '99+' : badge(section) }}</span>
        </button>
      </div>

      <!-- Footer -->
      <div class="admin-sidebar-foot">
        <!-- Theme toggle -->
        <div class="admin-theme-toggle">
          <button :class="{ active: adminTheme === 'light' }" @click="setTheme('light')">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
            Light
          </button>
          <button :class="{ active: adminTheme === 'dark' }" @click="setTheme('dark')">
            <svg viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            Dark
          </button>
        </div>
        <!-- User card -->
        <div class="admin-user-card">
          <div class="admin-avatar">{{ initials }}</div>
          <div class="admin-user-info">
            <div class="admin-user-name">{{ displayName }}</div>
            <div class="admin-user-role">Administrator</div>
          </div>
          <button class="admin-signout" title="Sign out" @click="authStore.signOut()">
            <svg viewBox="0 0 24 24"><path d="M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>
          </button>
        </div>
      </div>
    </aside>

    <!-- ── Main content area ───────────────────────────── -->
    <main class="admin-content" :data-theme="adminTheme">
      <!-- Topbar -->
      <div class="admin-topbar" style="display: flex; align-items: center; justify-content: space-between; gap: 16px;">
        <div>
          <h1 class="admin-page-title">{{ pageTitle }}</h1>
          <div class="admin-page-sub">{{ pageSub }}</div>
        </div>
        <!-- Notifications bell -->
        <button
          v-if="can('view:notifications')"
          class="admin-bell"
          :title="$t('admin.notifications')"
          @click="navigateTo(localePath('/admin/notifications'))"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <span v-if="unread > 0" class="admin-bell-badge">{{ unread > 99 ? '99+' : unread }}</span>
        </button>
      </div>
      <!-- Page slot -->
      <div class="admin-page">
        <slot />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import type { AdminSectionContribution } from '~/types/contributions'
import { validAdminSections } from '~/utils/admin-registry'

// The brand mark is the project's, contributed through `app.config.brand`.
const brand = computed(() => useAppConfig().brand)

// The shell knows no section by name: the sidebar, the active state, the page
// title and the landing page all come from the Admin Registry
// (app.config.adminSections / adminGroups, see docs/ADMIN-REGISTRY.md).
const authStore = useAuthStore()
const route = useRoute()
const localePath = useLocalePath()
const { can } = usePermissions()
const { groups, current, isActive } = useAdminRegistry()

// Counter badges: a section names a `useState<number>` key; whoever owns the
// number writes it (the notifications composable, for the inbox). The refs
// are created once here, in setup, for every registered key.
const badgeStates = new Map(
  validAdminSections(useAppConfig().adminSections)
    .filter((s) => s.badgeStateKey)
    .map((s) => [s.badgeStateKey!, useState<number>(s.badgeStateKey!, () => 0)] as const),
)
const badge = (section: AdminSectionContribution) => (section.badgeStateKey ? badgeStates.get(section.badgeStateKey)?.value ?? 0 : 0)

// ── Notifications (Core inbox bell in the topbar) ───────────
const { unread, refreshCount } = useAdminNotifications()
let notifTimer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  if (!can('view:notifications')) return // only notification-capable staff poll the inbox
  refreshCount()
  notifTimer = setInterval(refreshCount, 60_000)
})
onBeforeUnmount(() => { if (notifTimer) clearInterval(notifTimer) })
// Refresh as soon as the admin opens the notifications page (count may drop).
watch(() => route.path, (p) => { if (can('view:notifications') && p.includes('/admin/notifications')) refreshCount() })

// ── Page title / subtitle: from the section the route belongs to ──
const { t, te } = useI18n()
const pageTitle = computed(() => (current.value ? t(current.value.labelKey) : t('admin.title')))
const pageSub = computed(() => {
  const key = current.value?.subtitleKey
  return key && te(key) ? t(key) : ''
})

// ── Theme toggle ────────────────────────────────────────────
const adminTheme = ref<'light' | 'dark'>('light')

function setTheme(t: 'light' | 'dark') {
  adminTheme.value = t
  try { localStorage.setItem('admin-theme', t) } catch { /* storage unavailable (private mode) */ }
}

onMounted(() => {
  try {
    const saved = localStorage.getItem('admin-theme') as 'light' | 'dark' | null
    if (saved === 'light' || saved === 'dark') adminTheme.value = saved
  } catch { /* storage unavailable (private mode) */ }
})

// ── User display ────────────────────────────────────────────
const displayName = computed(() => {
  const p = authStore.profile
  if (!p) return 'Admin'
  const name = p.full_name
  if (name) {
    const parts = name.trim().split(' ')
    return parts.length >= 2 ? `${parts[0]} ${parts[parts.length - 1]?.[0] ?? ''}.` : (parts[0] ?? 'Admin')
  }
  return p.email.split('@')[0] ?? 'Admin'
})

const initials = computed(() => {
  const p = authStore.profile
  if (!p) return 'A'
  const name = p.full_name
  if (name) {
    const parts = name.trim().split(' ').filter(Boolean)
    if (parts.length >= 2) return `${parts[0]?.[0] ?? ''}${parts[parts.length - 1]?.[0] ?? ''}`.toUpperCase()
    return parts[0]?.[0]?.toUpperCase() ?? 'A'
  }
  return (p.email[0] ?? 'A').toUpperCase()
})
</script>
