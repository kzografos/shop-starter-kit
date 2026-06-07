<template>
  <div>
    <!-- Toolbar -->
    <div class="ac-table-toolbar">
      <div class="ac-table-toolbar-left">
        <div style="color: var(--ac-text-muted); font-size: 14px;">
          {{ subscribers.length }} {{ $t('admin.subscribers') }}
        </div>
      </div>
      <button class="ac-btn-primary" :disabled="!subscribers.length" @click="exportCsv">
        <svg viewBox="0 0 24 24"><path d="M12 3v12M7 10l5 5 5-5M5 21h14" /></svg>
        {{ $t('admin.export_csv') }}
      </button>
    </div>

    <!-- Table -->
    <div class="ac-card ac-table-card">
      <div v-if="pending" style="padding: 24px 20px; display: flex; flex-direction: column; gap: 10px;">
        <div v-for="n in 8" :key="n" style="height: 40px; background: var(--ac-bg-tint); border-radius: 6px;" />
      </div>

      <table v-else class="ac-data">
        <thead>
          <tr>
            <th style="width: 60%;">Email</th>
            <th>{{ $t('admin.subscribed_on') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!subscribers.length">
            <td colspan="2" class="ac-empty">{{ $t('admin.no_subscribers') }}</td>
          </tr>
          <tr v-for="s in subscribers" :key="s.id">
            <td style="font-weight: 500;">{{ s.email }}</td>
            <td class="ac-muted">{{ formatDate(s.created_at) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

const { public: { apiBase } } = useRuntimeConfig()
const { locale } = useI18n()

interface Subscriber { id: string; email: string; created_at: string }

const { data, pending } = useAsyncData('admin-newsletter', () =>
  $fetch<Subscriber[]>(`${apiBase}/admin/newsletter`, { credentials: 'include' }),
  { server: false },
)

const subscribers = computed(() => data.value ?? [])

function formatDate(d: string) {
  return new Date(d).toLocaleDateString(locale.value === 'el' ? 'el-GR' : 'en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function exportCsv() {
  const rows = [['Email', 'Subscribed'], ...subscribers.value.map((s) => [s.email, new Date(s.created_at).toISOString()])]
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `newsletter-subscribers-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
</script>
