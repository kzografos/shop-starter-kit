<template>
  <div v-if="isLoggedIn" ref="rootRef" class="relative" @keydown.esc="close">
    <button
      class="relative h-8 w-8 flex items-center justify-center rounded-full text-bark-light hover:text-bark hover:bg-cream-pale transition-all"
      :aria-label="unread > 0 ? $t('notifications.open_unread', { count: unread }) : $t('notifications.open')"
      aria-haspopup="dialog"
      :aria-expanded="open"
      aria-controls="notification-panel"
      data-testid="notification-bell"
      @click="toggle"
    >
      <UIcon name="i-heroicons-bell" class="w-5 h-5" />
      <span
        v-if="unread > 0"
        class="absolute -top-0.5 -right-0.5 min-w-4.5 h-4.5 flex items-center justify-center rounded-full bg-terracotta text-white text-[10px] font-bold px-1"
        data-testid="notification-badge"
      >
        {{ unread > 99 ? '99+' : unread }}
      </span>
    </button>

    <div
      v-show="open"
      id="notification-panel"
      role="dialog"
      :aria-label="$t('notifications.title')"
      class="fixed inset-x-4 top-16 md:absolute md:inset-x-auto md:right-0 md:top-full md:mt-2 md:w-96 bg-surface-card border border-[--color-border-warm] rounded-2xl shadow-[0_4px_24px_rgba(58,58,46,0.12)] overflow-hidden z-50"
      data-testid="notification-panel"
    >
      <!-- Header -->
      <div class="flex items-center justify-between gap-3 px-4 py-3 border-b border-[--color-border-warm]">
        <p class="text-sm font-semibold text-[--color-bark]">{{ $t('notifications.title') }}</p>
        <button
          v-if="unread > 0"
          class="text-xs font-medium text-terracotta hover:underline disabled:opacity-50"
          :disabled="busy"
          data-action="mark-all-read"
          @click="onMarkAll"
        >
          {{ $t('notifications.mark_all_read') }}
        </button>
      </div>

      <!-- Loading -->
      <div v-if="loading && !loaded" class="p-4 space-y-3" data-state="loading">
        <USkeleton v-for="n in 3" :key="n" class="h-12 rounded-lg" />
      </div>

      <!-- Error -->
      <div v-else-if="error" class="px-4 py-8 text-center" data-state="error">
        <p class="text-sm text-[--color-bark-light]">{{ $t('notifications.load_failed') }}</p>
        <UButton :label="$t('common.retry')" size="sm" variant="outline" class="mt-3" data-action="retry" @click="load()" />
      </div>

      <!-- Empty -->
      <div v-else-if="items.length === 0" class="px-4 py-10 text-center" data-state="empty">
        <UIcon name="i-heroicons-bell-slash" class="w-10 h-10 text-[--color-bark-light] mx-auto mb-2" />
        <p class="text-sm text-[--color-bark-light]">{{ $t('notifications.empty') }}</p>
      </div>

      <!-- List: newest first, as the API orders it -->
      <ul v-else class="max-h-[60vh] overflow-y-auto divide-y divide-[--color-border-soft]" data-state="list">
        <li v-for="n in items" :key="n.id" :data-notification-id="n.id" :data-read="n.is_read ? 'true' : 'false'">
          <component
            :is="describe(n).to ? NuxtLink : 'button'"
            :to="describe(n).to ?? undefined"
            class="w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[--color-surface-page]"
            :class="n.is_read ? '' : 'bg-cream-pale/60'"
            @click="onOpen(n)"
          >
            <span
              class="mt-1.5 w-2 h-2 rounded-full shrink-0"
              :class="n.is_read ? 'bg-transparent' : 'bg-terracotta'"
              aria-hidden="true"
            />
            <span class="min-w-0 flex-1">
              <span class="block text-sm text-[--color-bark]" :class="n.is_read ? 'font-normal' : 'font-semibold'">
                {{ describe(n).title }}
                <span v-if="!n.is_read" class="sr-only">({{ $t('notifications.unread') }})</span>
              </span>
              <span class="block text-xs text-[--color-bark-light] mt-0.5">{{ describe(n).body }}</span>
              <span class="block text-[11px] text-[--color-bark-light] mt-1">{{ formatDate(n.created_at) }}</span>
            </span>
            <button
              v-if="!n.is_read"
              class="shrink-0 p-1 rounded-full text-[--color-bark-light] hover:text-terracotta hover:bg-cream-pale"
              :aria-label="$t('notifications.mark_read')"
              :title="$t('notifications.mark_read')"
              data-action="mark-read"
              @click.prevent.stop="onMarkOne(n.id)"
            >
              <UIcon name="i-heroicons-check" class="w-4 h-4" />
            </button>
          </component>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
// Contributed to the header through app.config `headerActions` (registered globally).
// Renders only for a signed-in user; the API scopes every row to that user,
// so the staff inbox (userId null) can never appear here.
import type { Notification } from '~~/types'

const NuxtLink = resolveComponent('NuxtLink')
const { locale } = useI18n()
const { isLoggedIn } = storeToRefs(useAuthStore())
const { items, unread, loaded, loading, error, load, refreshCount, markRead, markAllRead, describe, reset } = useCustomerNotifications()

const rootRef = ref<HTMLElement | null>(null)
const open = ref(false)
const busy = ref(false)

function close() {
  open.value = false
}

function toggle() {
  open.value = !open.value
  // The list is fetched when the panel opens, and refreshed on every open so
  // a status change since the last look is not missed.
  if (open.value) load()
}

async function onMarkOne(id: string) {
  busy.value = true
  try { await markRead(id) } catch { /* the row stays unread; the next open retries */ } finally { busy.value = false }
}

async function onMarkAll() {
  busy.value = true
  try { await markAllRead() } catch { /* same */ } finally { busy.value = false }
}

function onOpen(n: Notification) {
  if (!n.is_read) markRead(n.id).catch(() => {})
  if (describe(n).to) close()
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(locale.value === 'el' ? 'el-GR' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' })
}

onMounted(() => {
  const onClickOutside = (e: MouseEvent) => {
    if (rootRef.value && !rootRef.value.contains(e.target as Node)) close()
  }
  document.addEventListener('click', onClickOutside)
  onUnmounted(() => document.removeEventListener('click', onClickOutside))
})

// The badge follows the session: fetched once the profile resolves, dropped on sign-out.
watch(isLoggedIn, (on) => { if (on) refreshCount(); else { close(); reset() } }, { immediate: true })
</script>
