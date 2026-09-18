<template>
  <div class="bg-surface-page min-h-screen">
    <div class="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8 max-w-6xl mx-auto px-4 py-10">
      <AccountSidebar />

      <!-- Main content -->
      <div class="flex flex-col gap-6 min-w-0">
        <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 class="font-display text-3xl font-bold text-[--color-bark]">
              {{ $t('notifications.title') }}
            </h1>
            <p class="text-sm text-[--color-bark-light] mt-1">{{ $t('notifications.history_subtitle') }}</p>
          </div>
          <UButton
            v-if="page && page.unread > 0"
            :label="$t('notifications.mark_all_read')"
            icon="i-heroicons-check"
            variant="outline"
            size="sm"
            :loading="marking === 'all'"
            :disabled="marking !== null"
            data-action="mark-all-read"
            @click="onMarkAll"
          />
        </div>

        <!-- Initial loading -->
        <div v-if="pending && !page" class="space-y-3" data-state="loading">
          <USkeleton v-for="n in 5" :key="n" class="h-20 rounded-xl" />
        </div>

        <!-- Error -->
        <div v-else-if="error && !page" class="text-center py-16" data-state="error">
          <UIcon name="i-heroicons-exclamation-circle" class="w-12 h-12 text-[--color-bark-light] mx-auto mb-3" />
          <p class="text-[--color-bark-light]">{{ $t('notifications.load_failed') }}</p>
          <UButton :label="$t('common.retry')" variant="outline" class="mt-4" data-action="retry" @click="refresh()" />
        </div>

        <!-- Empty -->
        <div v-else-if="page && page.total === 0" class="text-center py-20" data-state="empty">
          <UIcon name="i-heroicons-bell-slash" class="w-16 h-16 text-[--color-bark-light] mx-auto mb-4" />
          <p class="text-[--color-bark-light]">{{ $t('notifications.empty') }}</p>
          <UButton :label="$t('account.orders')" :to="localePath('/account/orders')" variant="outline" class="mt-4" />
        </div>

        <template v-else-if="page">
          <!-- Summary line: how many in total, which page -->
          <p class="text-xs text-[--color-bark-light]" data-testid="notification-summary">
            {{ $t('notifications.total_count', page.total) }} ·
            {{ $t('notifications.page_of', { page: page.page, total: page.total_pages }) }}
          </p>

          <!-- List: newest first, as the API orders it. Dimmed while another page loads. -->
          <ul
            class="bg-[--color-surface-card] rounded-xl border border-[--color-border-warm] divide-y divide-[--color-border-soft] overflow-hidden transition-opacity"
            :class="pending ? 'opacity-50 pointer-events-none' : ''"
            :aria-busy="pending"
            data-state="list"
          >
            <li
              v-for="n in page.items"
              :key="n.id"
              :data-notification-id="n.id"
              :data-read="n.is_read ? 'true' : 'false'"
              class="flex items-start gap-3 sm:gap-4 px-4 sm:px-5 py-4"
              :class="n.is_read ? '' : 'bg-cream-pale/50'"
            >
              <span
                class="mt-2 w-2 h-2 rounded-full shrink-0"
                :class="n.is_read ? 'bg-[--color-border-warm]' : 'bg-terracotta'"
                aria-hidden="true"
              />
              <div class="min-w-0 flex-1">
                <component
                  :is="describe(n).to ? NuxtLink : 'div'"
                  :to="describe(n).to ?? undefined"
                  class="block min-w-0"
                  :class="describe(n).to ? 'hover:text-terracotta transition-colors' : ''"
                  @click="onOpen(n)"
                >
                  <p class="text-sm text-[--color-bark] break-words" :class="n.is_read ? 'font-normal' : 'font-semibold'">
                    {{ describe(n).title }}
                  </p>
                  <p class="text-sm text-[--color-bark-light] mt-0.5 break-words">{{ describe(n).body }}</p>
                </component>
                <p class="text-xs text-[--color-bark-light] mt-1.5 flex flex-wrap items-center gap-x-2">
                  <span>{{ formatDate(n.created_at) }}</span>
                  <span aria-hidden="true">·</span>
                  <span>{{ n.is_read ? $t('notifications.read') : $t('notifications.unread') }}</span>
                </p>
              </div>
              <UButton
                v-if="!n.is_read"
                icon="i-heroicons-check"
                variant="ghost"
                size="sm"
                :aria-label="$t('notifications.mark_read')"
                :title="$t('notifications.mark_read')"
                :loading="marking === n.id"
                :disabled="marking !== null"
                class="shrink-0"
                data-action="mark-read"
                @click="onMarkOne(n.id)"
              />
            </li>
          </ul>

          <!-- Pagination -->
          <nav
            v-if="page.total_pages > 1"
            class="flex items-center justify-between gap-4"
            :aria-label="$t('notifications.pagination')"
            data-testid="pagination"
          >
            <UButton
              :label="$t('notifications.previous')"
              icon="i-heroicons-chevron-left"
              variant="outline"
              size="sm"
              :disabled="pending || page.page <= 1"
              data-action="prev-page"
              @click="goTo(page.page - 1)"
            />
            <span class="text-sm text-[--color-bark-light]" aria-current="page">
              {{ $t('notifications.page_of', { page: page.page, total: page.total_pages }) }}
            </span>
            <UButton
              :label="$t('notifications.next')"
              trailing-icon="i-heroicons-chevron-right"
              variant="outline"
              size="sm"
              :disabled="pending || page.page >= page.total_pages"
              data-action="next-page"
              @click="goTo(page.page + 1)"
            />
          </nav>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// The full notification history, paged by the API (20 per page, newest
// first). The bell panel keeps showing only the newest page; this page is
// where older entries live. Same server-side scoping: GET /notifications is
// the caller's own rows, so nothing foreign can appear here.
import type { Notification, NotificationList } from '~~/types'

definePageMeta({ middleware: 'auth' })

const NuxtLink = resolveComponent('NuxtLink')
const route = useRoute()
const router = useRouter()
const localePath = useLocalePath()
const { t, locale } = useI18n()
const toast = useToast()
const { fetchPage, markRead, markAllRead, describe } = useCustomerNotifications()

// The page number lives in the URL so back/forward and reload land on the same page.
const requestedPage = computed(() => {
  const n = Number(route.query.page)
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1
})

const marking = ref<string | 'all' | null>(null)

const { data: page, pending, error, refresh } = useAsyncData<NotificationList | null>(
  () => `notifications-page-${requestedPage.value}`,
  () => fetchPage(requestedPage.value),
  { server: false, lazy: true, watch: [requestedPage], default: () => null },
)

// A page past the end (rows marked read elsewhere, a stale link) shows the last real page instead of nothing.
watch(page, (p) => {
  if (p && p.items.length === 0 && p.total > 0 && p.page > p.total_pages) goTo(p.total_pages)
})

watch(error, (e) => {
  if (e && page.value) toast.add({ title: t('notifications.load_failed'), color: 'error', icon: 'i-heroicons-exclamation-circle' })
})

function goTo(n: number) {
  router.push({ query: { ...route.query, page: n > 1 ? String(n) : undefined } })
}

function applyRead(ids: string[] | 'all') {
  if (!page.value) return
  let cleared = 0
  for (const n of page.value.items) {
    if (!n.is_read && (ids === 'all' || ids.includes(n.id))) { n.is_read = true; cleared++ }
  }
  page.value.unread = ids === 'all' ? 0 : Math.max(0, page.value.unread - cleared)
}

async function onMarkOne(id: string) {
  marking.value = id
  try {
    await markRead(id)
    applyRead([id])
  } catch {
    toast.add({ title: t('notifications.mark_read_failed'), color: 'error', icon: 'i-heroicons-exclamation-circle' })
  } finally {
    marking.value = null
  }
}

async function onMarkAll() {
  marking.value = 'all'
  try {
    await markAllRead()
    applyRead('all')
  } catch {
    toast.add({ title: t('notifications.mark_all_read_failed'), color: 'error', icon: 'i-heroicons-exclamation-circle' })
  } finally {
    marking.value = null
  }
}

function onOpen(n: Notification) {
  // Opening the order it is about counts as reading it; navigation proceeds either way.
  if (!n.is_read) markRead(n.id).then(() => applyRead([n.id])).catch(() => {})
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(locale.value === 'el' ? 'el-GR' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' })
}
</script>
