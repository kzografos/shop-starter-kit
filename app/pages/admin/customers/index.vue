<template>
  <div>
    <!-- Toolbar -->
    <div class="ac-table-toolbar">
      <div class="ac-table-toolbar-left">
        <div class="ac-search">
          <svg class="ac-search-icon" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input v-model="search" :placeholder="$t('admin.search_customers')" />
        </div>
      </div>
      <div style="color: var(--ac-text-muted); font-size: 14px;">{{ total }} {{ $t('admin.customers').toLowerCase() }}</div>
    </div>

    <!-- Table -->
    <div class="ac-card ac-table-card">
      <div v-if="pending" style="padding: 24px 20px; display: flex; flex-direction: column; gap: 10px;">
        <div v-for="n in 8" :key="n" style="height: 44px; background: var(--ac-bg-tint); border-radius: 6px;" />
      </div>

      <table v-else class="ac-data">
        <thead>
          <tr>
            <th style="width: 28%;">{{ $t('admin.customer_name') }}</th>
            <th>Email</th>
            <th>{{ $t('admin.orders') }}</th>
            <th>{{ $t('admin.loyalty_points_short') }}</th>
            <th>{{ $t('admin.joined') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!customers.length">
            <td colspan="5" class="ac-empty">{{ $t('admin.no_customers') }}</td>
          </tr>
          <tr v-for="c in customers" :key="c.id">
            <td style="font-weight: 500;">{{ c.full_name || '—' }}</td>
            <td class="ac-muted">{{ c.email }}</td>
            <td class="ac-mono">{{ c._count.orders }}</td>
            <td class="ac-mono">{{ c.loyalty_points }}</td>
            <td class="ac-muted">{{ formatDate(c.created_at) }}</td>
          </tr>
        </tbody>
      </table>

      <!-- Pagination -->
      <div v-if="!pending && totalPages > 1" class="ac-pagination">
        <div style="color: var(--ac-text-muted);">{{ total }} {{ $t('admin.customers').toLowerCase() }}</div>
        <div class="ac-pag-btns">
          <button class="ac-pag-btn" :disabled="page === 1" @click="page--">
            <svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <button
            v-for="p in visiblePages"
            :key="p"
            class="ac-pag-btn"
            :class="{ active: p === page }"
            @click="page = p"
          >{{ p }}</button>
          <button class="ac-pag-btn" :disabled="page === totalPages" @click="page++">
            <svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6" /></svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

const { public: { apiBase } } = useRuntimeConfig()
const { locale } = useI18n()
const search = ref('')
const page = ref(1)

interface CustomerRow {
  id: string
  email: string
  full_name: string | null
  loyalty_points: number
  created_at: string
  _count: { orders: number }
}
interface Resp { customers: CustomerRow[]; total: number; page: number; totalPages: number }

const { data, pending, refresh } = useAsyncData('admin-customers', () =>
  $fetch<Resp>(`${apiBase}/admin/customers`, {
    credentials: 'include',
    query: { page: page.value, search: search.value || undefined },
  }),
  { server: false, watch: [page] },
)

const customers = computed(() => data.value?.customers ?? [])
const total = computed(() => data.value?.total ?? 0)
const totalPages = computed(() => data.value?.totalPages ?? 1)

const visiblePages = computed(() => {
  const tp = totalPages.value, p = page.value
  if (tp <= 7) return Array.from({ length: tp }, (_, i) => i + 1)
  if (p <= 4) return [1, 2, 3, 4, 5, tp]
  if (p >= tp - 3) return [1, tp - 4, tp - 3, tp - 2, tp - 1, tp]
  return [1, p - 1, p, p + 1, tp]
})

function formatDate(d: string) {
  return new Date(d).toLocaleDateString(locale.value === 'el' ? 'el-GR' : 'en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

let searchTimer: ReturnType<typeof setTimeout>
watch(search, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { page.value = 1; refresh() }, 350)
})
</script>
