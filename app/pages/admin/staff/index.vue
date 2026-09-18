<template>
  <div>
    <!-- Toolbar -->
    <div class="ac-table-toolbar">
      <div class="ac-table-toolbar-left">
        <div style="color: var(--ac-text-muted); font-size: 14px;">
          {{ staff.length }} {{ $t('admin.staff').toLowerCase() }}
        </div>
      </div>
      <button class="ac-btn-primary" @click="openCreate">
        <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
        {{ $t('admin.add_staff') }}
      </button>
    </div>

    <!-- Loading -->
    <div v-if="pending" class="ac-card" style="padding: 24px 20px; display: flex; flex-direction: column; gap: 10px;">
      <div v-for="n in 3" :key="n" style="height: 56px; background: var(--ac-bg-tint); border-radius: 8px;" />
    </div>

    <!-- Table -->
    <div v-else class="ac-card ac-table-card">
      <table class="ac-data">
        <thead>
          <tr>
            <th>{{ $t('admin.full_name') }}</th>
            <th>Email</th>
            <th>{{ $t('admin.role') }}</th>
            <th style="width: 90px; text-align: right;">Ενέργειες</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in staff" :key="s.id">
            <td>
              <span style="font-weight: 500;">{{ s.full_name || '—' }}</span>
              <span v-if="s.id === selfId" class="ac-badge ac-badge-sage" style="margin-left: 8px;">{{ $t('admin.you_label') }}</span>
            </td>
            <td class="ac-muted">{{ s.email }}</td>
            <td>
              <span class="ac-badge" :class="roleBadge(s.role)">
                <span class="ac-badge-dot" />
                {{ roleLabel(s.role) }}
              </span>
            </td>
            <td>
              <div class="ac-row-actions" style="justify-content: flex-end; opacity: 1;">
                <button class="ac-row-action-btn" :title="$t('common.edit')" :disabled="s.id === selfId" @click="openEdit(s)">
                  <svg viewBox="0 0 24 24"><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4Z" /></svg>
                </button>
                <button class="ac-row-action-btn danger" :title="$t('admin.remove_staff')" :disabled="s.id === selfId" @click="remove(s)">
                  <svg viewBox="0 0 24 24"><path d="M4 7h16" /><path d="M10 11v6M14 11v6" /><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12" /><path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" /></svg>
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Role legend -->
    <div class="ac-card" style="margin-top: 16px; padding: 16px 20px;">
      <div style="font-size: 13px; font-weight: 600; margin-bottom: 10px;">{{ $t('admin.role_access_title') }}</div>
      <div style="display: flex; flex-direction: column; gap: 8px; font-size: 13px; color: var(--ac-text-muted);">
        <div>· <strong style="color: var(--ac-text);">{{ $t('admin.role_owner') }}</strong> — {{ $t('admin.role_owner_desc') }}</div>
        <div>· <strong style="color: var(--ac-text);">{{ $t('admin.role_accountant') }}</strong> — {{ $t('admin.role_accountant_desc') }}</div>
        <div>· <strong style="color: var(--ac-text);">{{ $t('admin.role_stock_manager') }}</strong> — {{ $t('admin.role_stock_manager_desc') }}</div>
      </div>
    </div>

    <!-- Create / edit slide-over -->
    <USlideover v-model:open="drawerOpen" side="right" :ui="{ content: '!bg-transparent !ring-0 !shadow-none !p-0 sm:max-w-md' }">
      <template #content>
        <div class="ac-scope" :data-theme="adminTheme" style="display: flex; flex-direction: column; height: 100%; background: var(--ac-card); color: var(--ac-text);">
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 18px 24px; border-bottom: 1px solid var(--ac-card-border); flex-shrink: 0;">
            <h3 style="font-family: Fraunces, serif; font-size: 19px; font-weight: 500; margin: 0;">
              {{ editing ? $t('admin.edit_staff') : $t('admin.add_staff') }}
            </h3>
            <button class="ac-drawer-close" :aria-label="$t('common.cancel')" @click="drawerOpen = false">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>

          <div style="flex: 1; overflow-y: auto; padding: 24px;">
            <form id="staff-drawer-form" style="display: flex; flex-direction: column; gap: 16px;" @submit.prevent="save">
              <label class="acf">
                <span>{{ $t('admin.full_name') }}</span>
                <input v-model="form.fullName" type="text" >
              </label>
              <label class="acf">
                <span>Email *</span>
                <input v-model="form.email" type="email" :disabled="editing" >
                <span v-if="editing" class="acf-hint">{{ $t('admin.staff_email_locked') }}</span>
              </label>
              <label class="acf">
                <span>{{ $t('admin.role') }} *</span>
                <select v-model="form.role">
                  <option v-for="r in roleOptions" :key="r.value" :value="r.value">{{ r.label }}</option>
                </select>
              </label>
              <label class="acf">
                <span>{{ editing ? $t('admin.new_password') : $t('admin.password') }} {{ editing ? '' : '*' }}</span>
                <input v-model="form.password" type="password" autocomplete="new-password" :placeholder="editing ? '••••••••' : ''" >
                <span class="acf-hint">{{ editing ? $t('admin.set_password_optional') : $t('admin.password_min') }}</span>
              </label>
              <p v-if="error" style="color: var(--ac-warm-red); font-size: 13px; margin: 0;">{{ error }}</p>
            </form>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 10px; padding: 16px 24px; border-top: 1px solid var(--ac-card-border); flex-shrink: 0;">
            <button type="button" class="ac-scope-btn-ghost" @click="drawerOpen = false">{{ $t('common.cancel') }}</button>
            <button type="submit" form="staff-drawer-form" class="ac-scope-btn-primary" :disabled="saving">
              {{ saving ? '…' : (editing ? $t('common.save') : $t('common.create')) }}
            </button>
          </div>
        </div>
      </template>
    </USlideover>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

const { public: { apiBase } } = useRuntimeConfig()
const { t } = useI18n()
const toast = useToast()
const authStore = useAuthStore()
const selfId = computed(() => authStore.profile?.id ?? '')

const adminTheme = ref<'light' | 'dark'>('light')
onMounted(() => {
  const saved = localStorage.getItem('admin-theme')
  if (saved === 'light' || saved === 'dark') adminTheme.value = saved
})

interface StaffMember { id: string; email: string; full_name: string | null; role: string; created_at: string }

const { data, pending, refresh } = useAsyncData('admin-staff', () =>
  $fetch<StaffMember[]>(`${apiBase}/admin/staff`, { credentials: 'include' }),
  { server: false },
)
const staff = computed(() => data.value ?? [])

const roleOptions = [
  { value: 'STOCK_MANAGER', label: t('admin.role_stock_manager') },
  { value: 'ACCOUNTANT', label: t('admin.role_accountant') },
  { value: 'ADMIN', label: t('admin.role_owner') },
]
function roleLabel(role: string) {
  if (role === 'admin') return t('admin.role_owner')
  if (role === 'accountant') return t('admin.role_accountant')
  if (role === 'stock_manager') return t('admin.role_stock_manager')
  return role
}
function roleBadge(role: string) {
  if (role === 'admin') return 'ac-badge-gold'
  if (role === 'accountant') return 'ac-badge-sage'
  return 'ac-badge-blue'
}

// ── Drawer ──
const drawerOpen = ref(false)
const editing = ref(false)
const saving = ref(false)
const error = ref('')
const form = reactive({ id: '', email: '', fullName: '', role: 'STOCK_MANAGER', password: '' })

function resetForm() {
  form.id = ''; form.email = ''; form.fullName = ''; form.role = 'STOCK_MANAGER'; form.password = ''
  error.value = ''
}
function openCreate() { resetForm(); editing.value = false; drawerOpen.value = true }
function openEdit(s: StaffMember) {
  resetForm()
  editing.value = true
  form.id = s.id
  form.email = s.email
  form.fullName = s.full_name ?? ''
  form.role = s.role.toUpperCase()
  drawerOpen.value = true
}

async function save() {
  if (saving.value) return
  error.value = ''
  if (!editing.value && (!form.email.trim() || form.password.length < 8)) {
    error.value = t('admin.staff_required')
    return
  }
  saving.value = true
  try {
    if (editing.value) {
      await $fetch(`${apiBase}/admin/staff/${form.id}/role`, { method: 'PATCH', credentials: 'include', body: { role: form.role } })
      if (form.password) {
        await $fetch(`${apiBase}/admin/staff/${form.id}/password`, { method: 'PATCH', credentials: 'include', body: { password: form.password } })
      }
    } else {
      await $fetch(`${apiBase}/admin/staff`, { method: 'POST', credentials: 'include', body: { email: form.email.trim(), fullName: form.fullName.trim() || undefined, role: form.role, password: form.password } })
    }
    toast.add({ title: t('admin.saved'), color: 'success', icon: 'i-heroicons-check-circle' })
    drawerOpen.value = false
    await refresh()
  } catch (e: unknown) {
    const msg = (e as { data?: { message?: string | string[] } })?.data?.message
    error.value = (Array.isArray(msg) ? msg[0] : msg) ?? t('admin.save_failed')
  } finally {
    saving.value = false
  }
}

async function remove(s: StaffMember) {
  if (!confirm(`${t('admin.remove_staff_confirm')} "${s.full_name || s.email}"?`)) return
  try {
    await $fetch(`${apiBase}/admin/staff/${s.id}`, { method: 'DELETE', credentials: 'include' })
    toast.add({ title: t('admin.deleted'), color: 'success', icon: 'i-heroicons-check-circle' })
    await refresh()
  } catch (e: unknown) {
    const msg = (e as { data?: { message?: string } })?.data?.message
    toast.add({ title: msg ?? t('admin.delete_failed'), color: 'error', icon: 'i-heroicons-exclamation-triangle' })
  }
}
</script>
