<template>
  <USlideover v-model:open="open" side="right" :ui="{ content: '!bg-transparent !ring-0 !shadow-none !p-0 sm:max-w-lg' }">
    <template #content>
      <div
        class="ac-scope"
        :data-theme="adminTheme"
        style="display: flex; flex-direction: column; height: 100%; background: var(--ac-card); color: var(--ac-text);"
      >
        <!-- Header -->
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 18px 24px; border-bottom: 1px solid var(--ac-card-border); flex-shrink: 0;">
          <h3 style="font-family: Fraunces, serif; font-size: 19px; font-weight: 500; margin: 0;">
            {{ editing ? $t('admin.edit_product') : $t('admin.new_product') }}
          </h3>
          <button class="ac-drawer-close" :aria-label="$t('common.cancel')" @click="open = false">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <!-- Body (scrollable) -->
        <div style="flex: 1; overflow-y: auto; padding: 24px;">
          <form id="product-drawer-form" style="display: flex; flex-direction: column; gap: 16px;" @submit.prevent="save">
            <label class="acf">
              <span>{{ $t('admin.name_el') }} *</span>
              <input v-model="form.name_el" type="text" />
            </label>
            <label class="acf">
              <span>{{ $t('admin.name_en') }} *</span>
              <input v-model="form.name_en" type="text" />
            </label>
            <label class="acf">
              <span>Slug (URL) *</span>
              <input v-model="form.slug" type="text" placeholder="royal-canin-adult" @input="slugTouched = true" />
            </label>
            <label class="acf">
              <span>{{ $t('admin.description_el') }}</span>
              <textarea v-model="form.description_el" rows="2" />
            </label>
            <label class="acf">
              <span>{{ $t('admin.description_en') }}</span>
              <textarea v-model="form.description_en" rows="2" />
            </label>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
              <label class="acf">
                <span>{{ $t('admin.price') }} (€) *</span>
                <input v-model.number="form.price" type="number" step="0.01" min="0" />
              </label>
              <label class="acf">
                <span>{{ $t('admin.compare_at_price') }} (€)</span>
                <input v-model.number="form.compare_at_price" type="number" step="0.01" min="0" />
              </label>
              <label class="acf">
                <span>{{ $t('admin.stock') }} *</span>
                <input v-model.number="form.stock" type="number" min="0" />
              </label>
              <label class="acf">
                <span>{{ $t('admin.category') }}</span>
                <select v-model="form.category_id">
                  <option :value="null">—</option>
                  <option v-for="opt in categoryOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                </select>
              </label>
              <label class="acf">
                <span>{{ $t('filters.brand') }}</span>
                <input v-model="form.brand" type="text" />
              </label>
              <label class="acf">
                <span>{{ $t('filters.package_size') }}</span>
                <input v-model="form.package_size" type="text" />
              </label>
              <label class="acf">
                <span>{{ $t('filters.animal_age') }}</span>
                <select v-model="form.animal_age">
                  <option v-for="opt in ageOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                </select>
              </label>
            </div>

            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
              <input v-model="form.is_active" type="checkbox" style="width: 18px; height: 18px; accent-color: var(--ac-terracotta);" >
              <span style="font-size: 14px; color: var(--ac-text);">{{ $t('admin.active') }}</span>
            </label>

            <!-- Images -->
            <div>
              <span style="display: block; font-size: 13px; font-weight: 500; margin-bottom: 8px;">{{ $t('admin.photos') }}</span>
              <div v-if="form.images.length" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 10px;">
                <div v-for="(_, idx) in form.images" :key="form.images[idx]" class="ac-img-cell">
                  <img v-if="previewUrls[idx]" :src="previewUrls[idx]" :alt="`Image ${idx + 1}`" >
                  <div v-else class="ac-img-fallback">{{ form.images[idx] }}</div>
                  <button type="button" class="ac-img-remove" @click="removeImage(idx)">
                    <UIcon name="i-heroicons-trash" class="w-5 h-5" />
                  </button>
                </div>
              </div>
              <!-- Drag & drop zone -->
              <div
                class="ac-dropzone"
                :class="{ 'is-drag': dragging }"
                @click="fileInput?.click()"
                @dragover.prevent="dragging = true"
                @dragleave.prevent="dragging = false"
                @drop.prevent="onDrop"
              >
                <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-5-5L5 21" /></svg>
                <div style="font-size: 14px; font-weight: 500; margin-top: 8px;">{{ uploading ? $t('admin.uploading') : $t('admin.drop_or_click') }}</div>
                <div class="acf-hint">JPEG, PNG, WebP or GIF (max 5MB)</div>
              </div>
              <input ref="fileInput" type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple style="display: none;" @change="onPick" >
              <span v-if="uploadError" style="font-size: 13px; color: var(--ac-warm-red);">{{ uploadError }}</span>
            </div>

            <p v-if="error" style="color: var(--ac-warm-red); font-size: 13px; margin: 0;">{{ error }}</p>
          </form>
        </div>

        <!-- Footer (sticky) -->
        <div style="display: flex; justify-content: flex-end; gap: 10px; padding: 16px 24px; border-top: 1px solid var(--ac-card-border); flex-shrink: 0;">
          <button type="button" class="ac-scope-btn-ghost" @click="open = false">{{ $t('common.cancel') }}</button>
          <button type="submit" form="product-drawer-form" class="ac-btn-primary" :disabled="saving">
            <svg v-if="!saving" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" /></svg>
            {{ saving ? '…' : (editing ? $t('common.save') : $t('common.create')) }}
          </button>
        </div>
      </div>
    </template>
  </USlideover>
</template>

<script setup lang="ts">
const open = defineModel<boolean>('open', { default: false })
const props = defineProps<{ productId: string | null }>()
const emit = defineEmits<{ saved: [] }>()

const { public: { apiBase } } = useRuntimeConfig()
const { t, locale } = useI18n()
const toast = useToast()

const editing = computed(() => !!props.productId && props.productId !== 'new')

const adminTheme = ref<'light' | 'dark'>('light')
onMounted(() => {
  const saved = localStorage.getItem('admin-theme')
  if (saved === 'light' || saved === 'dark') adminTheme.value = saved
})

const saving = ref(false)
const uploading = ref(false)
const uploadError = ref('')
const error = ref('')
const dragging = ref(false)
const slugTouched = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const previewUrls = ref<string[]>([])

const form = reactive({
  slug: '', name_el: '', name_en: '', description_el: '', description_en: '',
  price: 0, compare_at_price: null as number | null, stock: 0,
  brand: '', package_size: '', animal_age: 'all', category_id: null as string | null,
  is_active: true, images: [] as string[],
})

const ageOptions = [
  { label: t('age.all'), value: 'all' },
  { label: t('age.puppy'), value: 'puppy' },
  { label: t('age.kitten'), value: 'kitten' },
  { label: t('age.adult'), value: 'adult' },
  { label: t('age.senior'), value: 'senior' },
]

// Category options — flatten the tree (parents + indented children).
type CatNode = { id: string; name_el: string; name_en: string; children?: CatNode[] }
const { data: tree } = useAsyncData('product-drawer-categories', () =>
  $fetch<CatNode[]>(`${apiBase}/categories`, { credentials: 'include' }),
  { server: false },
)
const categoryOptions = computed(() => {
  const name = (c: CatNode) => (locale.value === 'el' ? c.name_el : c.name_en)
  const out: Array<{ label: string; value: string }> = []
  for (const p of tree.value ?? []) {
    out.push({ label: name(p), value: p.id })
    for (const c of p.children ?? []) out.push({ label: `— ${name(c)}`, value: c.id })
  }
  return out
})

watch(() => form.name_en, (v) => {
  if (!editing.value && !slugTouched.value) {
    form.slug = v.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  }
})

function resetForm() {
  Object.assign(form, {
    slug: '', name_el: '', name_en: '', description_el: '', description_en: '',
    price: 0, compare_at_price: null, stock: 0, brand: '', package_size: '',
    animal_age: 'all', category_id: null, is_active: true, images: [],
  })
  previewUrls.value = []
  error.value = ''
  uploadError.value = ''
  slugTouched.value = false
}

// Load product when opening in edit mode; reset when opening in create mode.
watch(open, async (isOpen) => {
  if (!isOpen) return
  resetForm()
  if (editing.value) {
    const data = await $fetch<Record<string, unknown>>(`${apiBase}/admin/products/${props.productId}`, { credentials: 'include' }).catch(() => null)
    if (data) {
      Object.assign(form, {
        ...data,
        images: (data.images as string[]) ?? [],
        // animal_age comes back as the uppercase enum (e.g. "ALL") — the select uses lowercase.
        animal_age: String(data.animal_age ?? 'all').toLowerCase(),
      })
      previewUrls.value = []
    }
  }
})

async function uploadList(files: FileList | File[]) {
  uploading.value = true
  uploadError.value = ''
  try {
    for (const file of Array.from(files)) {
      const fd = new FormData()
      fd.append('file', file)
      const { key, url } = await $fetch<{ key: string; url: string }>(`${apiBase}/uploads/image`, {
        method: 'POST', credentials: 'include', body: fd,
      })
      form.images.push(key)
      previewUrls.value.push(url)
    }
  } catch {
    uploadError.value = t('admin.upload_failed')
  } finally {
    uploading.value = false
  }
}

function onPick(e: Event) {
  const files = (e.target as HTMLInputElement).files
  if (files?.length) uploadList(files)
  if (fileInput.value) fileInput.value.value = ''
}
function onDrop(e: DragEvent) {
  dragging.value = false
  const files = e.dataTransfer?.files
  if (files?.length) uploadList(files)
}
function removeImage(idx: number) {
  form.images.splice(idx, 1)
  previewUrls.value.splice(idx, 1)
}

async function save() {
  if (saving.value) return
  error.value = ''
  if (!form.name_el.trim() || !form.name_en.trim() || !form.slug.trim()) {
    error.value = t('admin.product_required')
    return
  }
  saving.value = true
  try {
    if (editing.value) {
      await $fetch(`${apiBase}/admin/products/${props.productId}`, { method: 'PATCH', credentials: 'include', body: { ...form } })
    } else {
      await $fetch(`${apiBase}/admin/products`, { method: 'POST', credentials: 'include', body: { ...form } })
    }
    toast.add({ title: t('admin.saved'), color: 'success', icon: 'i-heroicons-check-circle' })
    open.value = false
    emit('saved')
  } catch (e: unknown) {
    const msg = (e as { data?: { message?: string | string[] } })?.data?.message
    error.value = (Array.isArray(msg) ? msg[0] : msg) ?? t('admin.save_failed')
  } finally {
    saving.value = false
  }
}
</script>
