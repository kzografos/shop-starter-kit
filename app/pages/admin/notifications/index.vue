<template>
  <div>
    <!-- Toolbar -->
    <div class="ac-table-toolbar">
      <div class="ac-table-toolbar-left">
        <div class="ac-filter-tabs">
          <button class="ac-filter-tab" :class="{ active: !unreadOnly }" @click="setFilter(false)">{{ $t('admin.notif_all') }}</button>
          <button class="ac-filter-tab" :class="{ active: unreadOnly }" @click="setFilter(true)">
            {{ $t('admin.notif_unread') }}
            <span v-if="unread > 0" class="ac-tab-count">{{ unread }}</span>
          </button>
        </div>
      </div>
      <button class="ac-filter-btn" :disabled="unread === 0 || marking" @click="markAll">
        <svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5" /></svg>
        {{ $t('admin.mark_all_read') }}
      </button>
    </div>

    <!-- Loading -->
    <div v-if="pending" class="ac-card" style="padding: 16px 20px; display: flex; flex-direction: column; gap: 12px;">
      <div v-for="n in 5" :key="n" style="height: 54px; background: var(--ac-bg-tint); border-radius: 8px;" />
    </div>

    <!-- Empty -->
    <div v-else-if="!items.length" class="ac-card" style="padding: 48px 24px; text-align: center; color: var(--ac-text-muted);">
      <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin: 0 auto 12px; opacity: 0.6;"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
      <div style="font-size: 14px;">{{ $t('admin.no_notifications') }}</div>
    </div>

    <!-- List -->
    <div v-else class="ac-card" style="padding: 0; overflow: hidden;">
      <div
        v-for="n in items"
        :key="n.id"
        class="ac-notif-row"
        :class="{ unread: !n.is_read }"
      >
        <div class="ac-notif-icon" :class="n.type === 'OUT_OF_STOCK' ? 'out' : 'low'">
          <svg v-if="n.type === 'OUT_OF_STOCK'" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M15 9l-6 6M9 9l6 6" /></svg>
          <svg v-else viewBox="0 0 24 24"><path d="M12 9v4M12 17h.01" /><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /></svg>
        </div>
        <div style="flex: 1; min-width: 0;">
          <div style="font-weight: 600; font-size: 14px;">
            {{ n.type === 'OUT_OF_STOCK' ? $t('admin.out_of_stock_title') : $t('admin.low_stock_title') }}
          </div>
          <div class="ac-muted" style="font-size: 13px; margin-top: 2px;">
            {{ message(n) }}
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 14px; flex-shrink: 0;">
          <button v-if="n.product_id" class="ac-link-name" style="background: none; border: none; cursor: pointer; font: inherit; font-size: 13px;" @click="viewProduct(n)">
            {{ $t('admin.view_product') }}
          </button>
          <span class="ac-muted" style="font-size: 12px; white-space: nowrap;">{{ timeAgo(n.created_at) }}</span>
          <button
            v-if="!n.is_read"
            class="ac-notif-dot"
            :title="$t('admin.mark_all_read')"
            @click="markOne(n)"
          />
          <span v-else style="width: 10px;" />
        </div>
      </div>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="ac-pagination">
        <div style="color: var(--ac-text-muted);">{{ total }}</div>
        <div class="ac-pag-btns">
          <button class="ac-pag-btn" :disabled="page === 1" @click="page--">
            <svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <span class="ac-pag-btn active">{{ page }}</span>
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
const { t, locale } = useI18n()
const localePath = useLocalePath()
const { unread, refreshCount } = useAdminNotifications()

interface NotifMeta { name_el?: string; name_en?: string }
interface Notif {
  id: string
  type: 'LOW_STOCK' | 'OUT_OF_STOCK'
  product_id: string | null
  stock: number | null
  meta: NotifMeta | null
  is_read: boolean
  created_at: string
}
interface NotifResponse { items: Notif[]; total: number; page: number; totalPages: number; unread: number }

const page = ref(1)
const unreadOnly = ref(false)
const marking = ref(false)

const { data, pending, refresh } = useAsyncData('admin-notifications', () =>
  $fetch<NotifResponse>(`${apiBase}/admin/notifications`, {
    credentials: 'include',
    query: { page: page.value, unread: unreadOnly.value ? 'true' : undefined },
  }),
  { server: false, watch: [page, unreadOnly] },
)

const items = computed(() => data.value?.items ?? [])
const total = computed(() => data.value?.total ?? 0)
const totalPages = computed(() => data.value?.totalPages ?? 1)

// Keep the shared badge in sync with each fetch.
watch(() => data.value?.unread, (v) => { if (typeof v === 'number') unread.value = v })

function setFilter(v: boolean) { unreadOnly.value = v; page.value = 1 }

function productName(n: Notif) {
  const name = locale.value === 'el' ? n.meta?.name_el : n.meta?.name_en
  return name || n.meta?.name_en || n.meta?.name_el || '—'
}
function message(n: Notif) {
  return n.type === 'OUT_OF_STOCK'
    ? t('admin.out_of_stock_msg', { name: productName(n) })
    : t('admin.low_stock_msg', { name: productName(n), stock: n.stock ?? 0 })
}

const rtf = computed(() => new Intl.RelativeTimeFormat(locale.value, { numeric: 'auto' }))
function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.round(diff / 60000)
  if (Math.abs(min) < 60) return rtf.value.format(-min, 'minute')
  const hr = Math.round(min / 60)
  if (Math.abs(hr) < 24) return rtf.value.format(-hr, 'hour')
  return rtf.value.format(-Math.round(hr / 24), 'day')
}

async function markOne(n: Notif) {
  n.is_read = true
  await $fetch(`${apiBase}/admin/notifications/${n.id}/read`, { method: 'PATCH', credentials: 'include' }).catch(() => null)
  await refreshCount()
  if (unreadOnly.value) refresh()
}

async function markAll() {
  if (marking.value) return
  marking.value = true
  try {
    await $fetch(`${apiBase}/admin/notifications/read-all`, { method: 'PATCH', credentials: 'include' })
    await refresh()
    await refreshCount()
  } finally {
    marking.value = false
  }
}

function viewProduct(n: Notif) {
  if (!n.is_read) markOne(n)
  navigateTo(localePath(`/admin/products?edit=${n.product_id}`))
}
</script>
