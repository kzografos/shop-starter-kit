<template>
  <div style="display: flex; flex-direction: column; gap: 20px; max-width: 760px;">
    <!-- Shipping -->
    <div class="ac-card" style="padding: 24px;">
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
        <div class="ac-section-icon">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h2l2 12h12l2-8H7" /><circle cx="9" cy="20" r="1.25" /><circle cx="18" cy="20" r="1.25" /></svg>
        </div>
        <div>
          <h2 style="font-family: Fraunces, serif; font-size: 17px; font-weight: 500; margin: 0;">{{ $t('admin.shipping_settings') }}</h2>
          <p style="font-size: 13px; color: var(--ac-text-muted); margin: 2px 0 0;">{{ $t('admin.shipping_settings_sub') }}</p>
        </div>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
        <label class="acf">
          <span>{{ $t('admin.shipping_cost') }} (€)</span>
          <input v-model.number="form.shipping_cost" type="number" min="0" step="0.01" />
        </label>
        <label class="acf">
          <span>{{ $t('admin.free_shipping_threshold') }} (€)</span>
          <input v-model.number="form.free_shipping_threshold" type="number" min="0" step="0.01" />
        </label>
      </div>
    </div>

    <!-- Loyalty -->
    <div class="ac-card" style="padding: 24px;">
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
        <div class="ac-section-icon">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3 7 7 .5-5.5 4.5 2 7-6.5-4-6.5 4 2-7L2 9.5 9 9z" /></svg>
        </div>
        <div>
          <h2 style="font-family: Fraunces, serif; font-size: 17px; font-weight: 500; margin: 0;">{{ $t('admin.loyalty_settings') }}</h2>
          <p style="font-size: 13px; color: var(--ac-text-muted); margin: 2px 0 0;">{{ $t('admin.loyalty_settings_sub') }}</p>
        </div>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
        <label class="acf">
          <span>{{ $t('admin.loyalty_earn_rate') }}</span>
          <input v-model.number="form.loyalty_earn_rate" type="number" min="0" step="1" />
          <span class="acf-hint">{{ $t('admin.loyalty_earn_hint') }}</span>
        </label>
        <label class="acf">
          <span>{{ $t('admin.loyalty_redeem_rate') }}</span>
          <input v-model.number="form.loyalty_redeem_rate" type="number" min="1" step="1" />
          <span class="acf-hint">{{ $t('admin.loyalty_redeem_hint') }}</span>
        </label>
        <label class="acf">
          <span>{{ $t('admin.loyalty_min_redeem') }}</span>
          <input v-model.number="form.loyalty_min_redeem" type="number" min="0" step="1" />
          <span class="acf-hint">{{ $t('admin.loyalty_min_hint') }}</span>
        </label>
      </div>
    </div>

    <div style="display: flex; justify-content: flex-end;">
      <button class="ac-btn-primary" :disabled="saving || pending" @click="save">
        <svg v-if="!saving" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" /></svg>
        {{ saving ? '…' : $t('common.save') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

const { public: { apiBase } } = useRuntimeConfig()
const { t } = useI18n()
const toast = useToast()

const saving = ref(false)
const form = reactive({
  shipping_cost: 5,
  free_shipping_threshold: 50,
  loyalty_earn_rate: 100,
  loyalty_redeem_rate: 100,
  loyalty_min_redeem: 500,
})

const { data, pending } = await useAsyncData('admin-settings', () =>
  $fetch<Record<string, string>>(`${apiBase}/admin/settings`, { credentials: 'include' }),
  { server: false, lazy: true },
)

watch(data, (s) => {
  if (!s) return
  for (const k of Object.keys(form) as Array<keyof typeof form>) {
    if (s[k] !== undefined) form[k] = Number(s[k])
  }
}, { immediate: true })

async function save() {
  if (saving.value) return
  saving.value = true
  try {
    await $fetch(`${apiBase}/admin/settings`, { method: 'PATCH', credentials: 'include', body: { ...form } })
    toast.add({ title: t('admin.saved'), color: 'success', icon: 'i-heroicons-check-circle' })
  } catch (e: unknown) {
    const msg = (e as { data?: { message?: string } })?.data?.message
    toast.add({ title: msg ?? t('admin.save_failed'), color: 'error', icon: 'i-heroicons-exclamation-triangle' })
  } finally {
    saving.value = false
  }
}
</script>
