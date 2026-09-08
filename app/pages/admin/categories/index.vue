<template>
  <div>
    <!-- Toolbar -->
    <div class="ac-table-toolbar">
      <div class="ac-table-toolbar-left">
        <div style="color: var(--ac-text-muted); font-size: 14px;">
          {{ cats.length }} {{ $t('admin.categories').toLowerCase() }}
        </div>
      </div>
      <button class="ac-btn-primary" @click="openCreate()">
        <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
        {{ $t('admin.add_category') }}
      </button>
    </div>

    <!-- Loading -->
    <div v-if="pending" class="ac-card" style="padding: 24px 20px; display: flex; flex-direction: column; gap: 10px;">
      <div v-for="n in 4" :key="n" style="height: 60px; background: var(--ac-bg-tint); border-radius: 8px;" />
    </div>

    <!-- Parent groups -->
    <div v-else style="display: flex; flex-direction: column; gap: 16px;">
      <div v-for="parent in parents" :key="parent.id" class="ac-card" style="padding: 0; overflow: hidden;">
        <!-- Parent row -->
        <div style="display: flex; align-items: center; gap: 12px; padding: 16px 20px;">
          <div style="flex: 1; min-width: 0;">
            <div style="font-weight: 600;">{{ name(parent) }}</div>
            <div class="ac-muted" style="font-size: 12px; margin-top: 2px;">
              /{{ parent.slug }} · {{ parent._count.products }} {{ $t('admin.products').toLowerCase() }} · {{ parent._count.children }} {{ $t('admin.subcategories') }}
            </div>
          </div>
          <button class="ac-filter-btn" @click="openCreate(parent.id)">
            <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
            {{ $t('admin.subcategory') }}
          </button>
          <div class="ac-row-actions" style="opacity: 1;">
            <button class="ac-row-action-btn" :title="$t('common.edit')" @click="openEdit(parent)">
              <svg viewBox="0 0 24 24"><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4Z" /></svg>
            </button>
            <button class="ac-row-action-btn danger" :title="$t('common.delete')" @click="remove(parent)">
              <svg viewBox="0 0 24 24"><path d="M4 7h16" /><path d="M10 11v6M14 11v6" /><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12" /><path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" /></svg>
            </button>
          </div>
        </div>

        <!-- Children -->
        <div v-if="childrenOf(parent.id).length" style="border-top: 1px solid var(--ac-border);">
          <div
            v-for="child in childrenOf(parent.id)"
            :key="child.id"
            style="display: flex; align-items: center; gap: 12px; padding: 12px 20px 12px 44px;"
          >
            <div style="flex: 1; min-width: 0;">
              <div style="font-size: 14px;">{{ name(child) }}</div>
              <div class="ac-muted" style="font-size: 12px; margin-top: 2px;">
                /{{ child.slug }} · {{ child._count.products }} {{ $t('admin.products').toLowerCase() }}
              </div>
            </div>
            <div class="ac-row-actions" style="opacity: 1;">
              <button class="ac-row-action-btn" :title="$t('common.edit')" @click="openEdit(child)">
                <svg viewBox="0 0 24 24"><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4Z" /></svg>
              </button>
              <button class="ac-row-action-btn danger" :title="$t('common.delete')" @click="remove(child)">
                <svg viewBox="0 0 24 24"><path d="M4 7h16" /><path d="M10 11v6M14 11v6" /><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12" /><path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" /></svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Create / Edit slide-over (themed to match admin light/dark) -->
    <USlideover v-model:open="modalOpen" side="right" :ui="{ content: '!bg-transparent !ring-0 !shadow-none !p-0 sm:max-w-md' }">
      <template #content>
        <div
          class="ac-scope"
          :data-theme="adminTheme"
          style="display: flex; flex-direction: column; height: 100%; background: var(--ac-card); color: var(--ac-text);"
        >
          <!-- Header -->
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 18px 24px; border-bottom: 1px solid var(--ac-card-border); flex-shrink: 0;">
            <h3 style="font-family: Fraunces, serif; font-size: 19px; font-weight: 500; margin: 0;">
              {{ editing ? $t('admin.edit_category') : $t('admin.new_category') }}
            </h3>
            <button class="ac-drawer-close" :aria-label="$t('common.cancel')" @click="modalOpen = false">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>

          <!-- Body (scrollable) -->
          <div style="flex: 1; overflow-y: auto; padding: 24px;">
            <form id="category-drawer-form" style="display: flex; flex-direction: column; gap: 16px;" @submit.prevent="save">
              <label class="acf">
                <span>{{ $t('admin.name_el') }} *</span>
                <input v-model="form.name_el" type="text" />
              </label>
              <label class="acf">
                <span>{{ $t('admin.name_en') }} *</span>
                <input v-model="form.name_en" type="text" />
              </label>
              <label class="acf">
                <span>Slug</span>
                <input v-model="form.slug" type="text" :disabled="editing" @input="slugTouched = true" />
                <span class="acf-hint">{{ editing ? $t('admin.slug_locked') : $t('admin.slug_help') }}</span>
              </label>
              <label class="acf">
                <span>{{ $t('admin.parent_category') }}</span>
                <select v-model="form.parent_id" :disabled="parentDisabled">
                  <option v-for="opt in parentOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                </select>
                <span v-if="parentDisabled" class="acf-hint">{{ $t('admin.parent_locked') }}</span>
              </label>
              <label class="acf">
                <span>{{ $t('admin.sort_order') }}</span>
                <input v-model.number="form.sort_order" type="number" min="0" />
              </label>

              <p v-if="error" style="color: var(--ac-warm-red); font-size: 13px; margin: 0;">{{ error }}</p>
            </form>
          </div>

          <!-- Footer (sticky) -->
          <div style="display: flex; justify-content: flex-end; gap: 10px; padding: 16px 24px; border-top: 1px solid var(--ac-card-border); flex-shrink: 0;">
            <button type="button" class="ac-scope-btn-ghost" @click="modalOpen = false">{{ $t('common.cancel') }}</button>
            <button type="submit" form="category-drawer-form" class="ac-scope-btn-primary" :disabled="saving">
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
const { t, locale } = useI18n()
const toast = useToast()

// Mirror the admin layout's theme so teleported modal matches light/dark.
const adminTheme = ref<'light' | 'dark'>('light')
onMounted(() => {
  const saved = localStorage.getItem('admin-theme')
  if (saved === 'light' || saved === 'dark') adminTheme.value = saved
})

interface AdminCategory {
  id: string
  slug: string
  name_el: string
  name_en: string
  parent_id: string | null
  sort_order: number
  _count: { products: number; children: number }
}

const { data, pending, refresh } = useAsyncData('admin-categories', () =>
  $fetch<AdminCategory[]>(`${apiBase}/admin/categories`, { credentials: 'include' }),
  { server: false },
)

const cats = computed(() => data.value ?? [])
const parents = computed(() => cats.value.filter((c) => !c.parent_id))
const childrenOf = (id: string) => cats.value.filter((c) => c.parent_id === id)
const name = (c: AdminCategory) => (locale.value === 'el' ? c.name_el : c.name_en)

// ── Modal state ─────────────────────────────────────────────
const modalOpen = ref(false)
const editing = ref(false)
const saving = ref(false)
const error = ref('')
const slugTouched = ref(false)
const editingHasChildren = ref(false)

const form = reactive({
  id: '' as string,
  name_el: '',
  name_en: '',
  slug: '',
  parent_id: '' as string,
  sort_order: 0,
})

// Auto-suggest slug from the English name while creating.
watch(() => form.name_en, (v) => {
  if (!editing.value && !slugTouched.value) form.slug = slugify(v)
})

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

const parentOptions = computed(() => [
  { label: t('admin.no_parent'), value: '' },
  ...parents.value
    .filter((p) => p.id !== form.id) // can't parent itself
    .map((p) => ({ label: name(p), value: p.id })),
])

// Parent select disabled when editing a category that has its own subcategories.
const parentDisabled = computed(() => editing.value && editingHasChildren.value)

function resetForm() {
  form.id = ''
  form.name_el = ''
  form.name_en = ''
  form.slug = ''
  form.parent_id = ''
  form.sort_order = 0
  error.value = ''
  slugTouched.value = false
  editingHasChildren.value = false
}

function openCreate(parentId: string | null = null) {
  resetForm()
  editing.value = false
  form.parent_id = parentId ?? ''
  modalOpen.value = true
}

function openEdit(cat: AdminCategory) {
  resetForm()
  editing.value = true
  form.id = cat.id
  form.name_el = cat.name_el
  form.name_en = cat.name_en
  form.slug = cat.slug
  form.parent_id = cat.parent_id ?? ''
  form.sort_order = cat.sort_order
  editingHasChildren.value = cat._count.children > 0
  modalOpen.value = true
}

async function save() {
  if (saving.value) return
  error.value = ''
  if (!form.name_el.trim() || !form.name_en.trim() || !form.slug.trim()) {
    error.value = t('admin.category_required')
    return
  }
  saving.value = true
  try {
    const body = {
      name_el: form.name_el.trim(),
      name_en: form.name_en.trim(),
      parent_id: form.parent_id || null,
      sort_order: form.sort_order || 0,
    }
    if (editing.value) {
      // Slug is locked after creation — the API has always ignored it on update
      // and now rejects it outright, so it is not sent.
      await $fetch(`${apiBase}/admin/categories/${form.id}`, { method: 'PATCH', credentials: 'include', body })
    } else {
      await $fetch(`${apiBase}/admin/categories`, { method: 'POST', credentials: 'include', body: { ...body, slug: form.slug.trim() } })
    }
    modalOpen.value = false
    toast.add({ title: t('admin.saved'), color: 'success', icon: 'i-heroicons-check-circle' })
    await refresh()
  } catch (e: unknown) {
    const msg = (e as { data?: { message?: string } })?.data?.message
    error.value = msg ?? t('admin.save_failed')
  } finally {
    saving.value = false
  }
}

async function remove(cat: AdminCategory) {
  if (!confirm(`${t('admin.delete_category_confirm')} "${name(cat)}"?`)) return
  try {
    await $fetch(`${apiBase}/admin/categories/${cat.id}`, { method: 'DELETE', credentials: 'include' })
    toast.add({ title: t('admin.deleted'), color: 'success', icon: 'i-heroicons-check-circle' })
    await refresh()
  } catch (e: unknown) {
    const msg = (e as { data?: { message?: string } })?.data?.message
    toast.add({ title: msg ?? t('admin.delete_failed'), color: 'error', icon: 'i-heroicons-exclamation-triangle' })
  }
}
</script>
