<template>
  <div class="admin-app">
    <!-- ── Sidebar ─────────────────────────────────────── -->
    <aside class="admin-sidebar">
      <!-- Logo -->
      <div class="admin-sidebar-head" style="flex-direction: column; align-items: flex-start; gap: 8px;">
        <div style="display: flex; align-items: center; gap: 10px; width: 100%;">
          <div class="admin-logo-mark">
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <ellipse cx="6" cy="10" rx="2" ry="2.5"/>
              <ellipse cx="18" cy="10" rx="2" ry="2.5"/>
              <ellipse cx="12" cy="6.5" rx="2" ry="2.5"/>
              <path d="M7.5 17c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4c0 1.5-1.5 2.5-2 2.5-1.5 0-1.5-1-2.5-1s-1 1-2.5 1c-.5 0-2-1-2-2.5z"/>
            </svg>
          </div>
          <div class="admin-logo-text">Mike Animal Show</div>
          <span class="admin-pill">Admin</span>
        </div>
        <NuxtLink :to="localePath('/')" class="admin-back-link">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          Επιστροφή στο κατάστημα
        </NuxtLink>
      </div>

      <!-- Nav -->
      <div class="admin-nav-section">
        <button
          class="admin-nav-item"
          :class="{ active: isDashboard }"
          @click="navigateTo(localePath('/admin'))"
        >
          <svg viewBox="0 0 24 24"><rect x="3.25" y="3.25" width="7.5" height="7.5" rx="1.5"/><rect x="13.25" y="3.25" width="7.5" height="4.5" rx="1.5"/><rect x="13.25" y="10.25" width="7.5" height="10.5" rx="1.5"/><rect x="3.25" y="13.25" width="7.5" height="7.5" rx="1.5"/></svg>
          <span>{{ $t('admin.dashboard') }}</span>
        </button>
        <button
          class="admin-nav-item"
          :class="{ active: isProducts }"
          @click="navigateTo(localePath('/admin/products'))"
        >
          <svg viewBox="0 0 24 24"><path d="M21 8 12 3 3 8v8l9 5 9-5V8z"/><path d="M3 8l9 5 9-5"/><path d="M12 13v8"/></svg>
          <span>{{ $t('admin.products') }}</span>
        </button>
        <button
          class="admin-nav-item"
          :class="{ active: isCategories }"
          @click="navigateTo(localePath('/admin/categories'))"
        >
          <svg viewBox="0 0 24 24"><path d="M20.59 13.41 11 3.99H4v7l9.59 9.41a2 2 0 0 0 2.82 0l4.18-4.17a2 2 0 0 0 0-2.82Z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg>
          <span>{{ $t('admin.categories') }}</span>
        </button>
        <button
          class="admin-nav-item"
          :class="{ active: isOrders }"
          @click="navigateTo(localePath('/admin/orders'))"
        >
          <svg viewBox="0 0 24 24"><path d="M3 4h2l2 12h12l2-8H7"/><circle cx="9" cy="20" r="1.25"/><circle cx="18" cy="20" r="1.25"/></svg>
          <span>{{ $t('admin.orders') }}</span>
        </button>
      </div>

      <div class="admin-nav-section">
        <span class="admin-nav-section-label">Workspace</span>
        <button
          class="admin-nav-item"
          :class="{ active: isCustomers }"
          @click="navigateTo(localePath('/admin/customers'))"
        >
          <svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2.75 19c.5-3 3.5-4.75 6.25-4.75S15 16 15.5 19"/><circle cx="17" cy="9" r="2.5"/><path d="M19 14.75c1.5.5 2.5 1.5 2.5 3"/></svg>
          <span>{{ $t('admin.customers') }}</span>
        </button>
        <button
          class="admin-nav-item"
          :class="{ active: isNewsletter }"
          @click="navigateTo(localePath('/admin/newsletter'))"
        >
          <svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>
          <span>{{ $t('admin.newsletter') }}</span>
        </button>
        <button
          class="admin-nav-item"
          :class="{ active: isSettings }"
          @click="navigateTo(localePath('/admin/settings'))"
        >
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          <span>{{ $t('admin.settings') }}</span>
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
      <div class="admin-topbar">
        <div>
          <h1 class="admin-page-title">{{ pageTitle }}</h1>
          <div class="admin-page-sub">{{ pageSub }}</div>
        </div>
      </div>
      <!-- Page slot -->
      <div class="admin-page">
        <slot />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
const authStore = useAuthStore()
const route = useRoute()
const localePath = useLocalePath()

// ── Active nav state ────────────────────────────────────────
const isDashboard = computed(() => {
  const p = route.path
  return p === '/admin' || p === '/el/admin' || p === '/en/admin'
})

const isProducts   = computed(() => route.path.includes('/admin/products'))
const isCategories = computed(() => route.path.includes('/admin/categories'))
const isOrders     = computed(() => route.path.includes('/admin/orders'))
const isSettings   = computed(() => route.path.includes('/admin/settings'))
const isCustomers  = computed(() => route.path.includes('/admin/customers'))
const isNewsletter = computed(() => route.path.includes('/admin/newsletter'))

// ── Page title / subtitle ───────────────────────────────────
const pageInfo = computed(() => {
  if (isProducts.value) {
    if (route.path.includes('/new'))
      return { title: 'Products', sub: 'Add a new product to your catalog.' }
    if (!route.path.endsWith('/products'))
      return { title: 'Products', sub: 'Edit product details.' }
    return { title: 'Products', sub: 'Manage inventory, pricing and availability.' }
  }
  if (isCategories.value)
    return { title: 'Categories', sub: 'Organize your catalog — animals and their subcategories.' }
  if (isOrders.value)
    return { title: 'Orders', sub: 'Track and update customer orders.' }
  if (isSettings.value)
    return { title: 'Settings', sub: 'Shipping and loyalty configuration.' }
  if (isCustomers.value)
    return { title: 'Customers', sub: 'Everyone who has registered at the shop.' }
  if (isNewsletter.value)
    return { title: 'Newsletter', sub: 'Subscribers to your mailing list.' }
  return { title: 'Dashboard', sub: "Welcome back — here's what's happening at the shop today." }
})

const pageTitle = computed(() => pageInfo.value.title)
const pageSub   = computed(() => pageInfo.value.sub)

// ── Theme toggle ────────────────────────────────────────────
const adminTheme = ref<'light' | 'dark'>('light')

function setTheme(t: 'light' | 'dark') {
  adminTheme.value = t
  try { localStorage.setItem('admin-theme', t) } catch {}
}

onMounted(() => {
  try {
    const saved = localStorage.getItem('admin-theme') as 'light' | 'dark' | null
    if (saved === 'light' || saved === 'dark') adminTheme.value = saved
  } catch {}
})

// ── User display ────────────────────────────────────────────
const displayName = computed(() => {
  const p = authStore.profile
  if (!p) return 'Admin'
  const name = (p as any).full_name
  if (name) {
    const parts = name.trim().split(' ')
    return parts.length >= 2 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0]
  }
  return (p as any).email?.split('@')[0] ?? 'Admin'
})

const initials = computed(() => {
  const p = authStore.profile
  if (!p) return 'A'
  const name = (p as any).full_name
  if (name) {
    const parts = name.trim().split(' ').filter(Boolean)
    if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
    return parts[0][0]?.toUpperCase() ?? 'A'
  }
  return ((p as any).email?.[0] ?? 'A').toUpperCase()
})
</script>
