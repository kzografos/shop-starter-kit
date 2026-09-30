<template>
  <div style="display: flex; flex-direction: column; gap: 20px; max-width: 760px;">
    <!-- Loading -->
    <div v-if="pending && !data" class="ac-card" style="padding: 24px; color: var(--ac-text-muted); font-size: 13px;" data-state="loading">
      {{ $t('common.loading') }}
    </div>

    <!-- Error -->
    <div v-else-if="error && !data" class="ac-card" style="padding: 24px;" data-state="error">
      <p style="font-size: 13px; color: var(--ac-text-muted); margin: 0 0 12px;">{{ $t('admin.settings_load_failed') }}</p>
      <button class="ac-btn-primary" @click="refresh()">{{ $t('common.retry') }}</button>
    </div>

    <!-- Nothing registered -->
    <div v-else-if="cards.length === 0" class="ac-card" style="padding: 24px; color: var(--ac-text-muted); font-size: 13px;" data-state="empty">
      {{ $t('admin.no_settings') }}
    </div>

    <!-- One card per registered group, one field per registered setting -->
    <template v-else>
      <div v-for="card in cards" :key="card.id" class="ac-card" style="padding: 24px;" :data-settings-group="card.id">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
          <div class="ac-section-icon">
            <AdminIcon :name="card.icon ?? ''" style="width: 20px; height: 20px;" />
          </div>
          <div>
            <h2 style="font-family: Fraunces, serif; font-size: 17px; font-weight: 500; margin: 0;">{{ label(card.label_key) }}</h2>
            <p v-if="card.description_key" style="font-size: 13px; color: var(--ac-text-muted); margin: 2px 0 0;">{{ label(card.description_key) }}</p>
          </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
          <label v-for="field in card.fields" :key="field.key" class="acf" :data-setting="field.key">
            <span>{{ label(field.label_key) }}<template v-if="field.unit"> ({{ field.unit }})</template></span>
            <input
              v-if="field.type === 'number'"
              v-model.number="form[field.key]"
              type="number"
              :min="field.min"
              :max="field.max"
              :step="field.step ?? 'any'"
              :disabled="field.editable === false"
            >
            <input
              v-else
              v-model="form[field.key]"
              type="text"
              :disabled="field.editable === false"
            >
            <span v-if="field.description_key" class="acf-hint">{{ label(field.description_key) }}</span>
          </label>
        </div>
      </div>

      <div style="display: flex; justify-content: flex-end;">
        <button class="ac-btn-primary" :disabled="saving || pending" data-action="save" @click="save">
          <svg v-if="!saving" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" /></svg>
          {{ saving ? '…' : $t('common.save') }}
        </button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
// Registry-driven: the API returns the groups and definitions modules
// registered (Settings Registry, docs/SETTINGS-REGISTRY.md) with the current
// values; this page renders exactly that list and never names a setting.
import type { AdminSettingsPayload } from '~~/types'
import { initialFormValues, patchBody, settingsCards, type SettingFormValue } from '#core/utils/settings-form'

definePageMeta({ layout: 'admin', middleware: 'admin' })

const api = useApi()
const { t, te } = useI18n()
const toast = useToast()

const saving = ref(false)
const form = reactive<Record<string, SettingFormValue>>({})

const { data, pending, error, refresh } = await useAsyncData('admin-settings', () =>
  api<AdminSettingsPayload>(`/admin/settings`),
  { server: false, lazy: true },
)

const cards = computed(() => settingsCards(data.value))
// A definition whose key has no translation shows the key rather than nothing.
const label = (key: string) => (te(key) ? t(key) : key)

watch(data, (payload) => {
  if (!payload) return
  Object.assign(form, initialFormValues(payload))
}, { immediate: true })

async function save() {
  if (saving.value || !data.value) return
  saving.value = true
  try {
    data.value = await api<AdminSettingsPayload>(`/admin/settings`, { method: 'PATCH', body: patchBody(data.value.definitions, form) })
    toast.add({ title: t('admin.saved'), color: 'success', icon: 'i-heroicons-check-circle' })
  } catch (e: unknown) {
    const msg = (e as { data?: { message?: string | string[] } })?.data?.message
    toast.add({ title: (Array.isArray(msg) ? msg[0] : msg) ?? t('admin.save_failed'), color: 'error', icon: 'i-heroicons-exclamation-triangle' })
  } finally {
    saving.value = false
  }
}
</script>
