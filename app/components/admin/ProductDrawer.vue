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
              <input v-model="form.slug" type="text" placeholder="example-product-name" @input="slugTouched = true" />
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
                <span>{{ $t('admin.cost') }} (€)</span>
                <input v-model.number="form.cost" type="number" step="0.01" min="0" />
                <span class="acf-hint">{{ $t('admin.cost_hint') }}</span>
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
            </div>

            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
              <input v-model="form.is_active" type="checkbox" style="width: 18px; height: 18px; accent-color: var(--ac-terracotta);" >
              <span style="font-size: 14px; color: var(--ac-text);">{{ $t('admin.active') }}</span>
            </label>

            <!-- Images -->
            <div>
              <span style="display: block; font-size: 13px; font-weight: 500; margin-bottom: 8px;">{{ $t('admin.photos') }}</span>
              <!-- `form.images` order is the display order; index 0 is the primary image. -->
              <div v-if="form.images.length" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 10px;">
                <div v-for="(ref, idx) in form.images" :key="ref" class="ac-img-item" :class="{ 'is-busy': imagesBusy }">
                  <div class="ac-img-cell">
                    <img v-if="previewUrls[idx]" :src="previewUrls[idx]" :alt="`Image ${idx + 1}`" >
                    <div v-else class="ac-img-fallback">{{ ref }}</div>
                    <span v-if="idx === 0" class="ac-img-primary">{{ $t('admin.primary_image') }}</span>
                  </div>
                  <div class="ac-img-actions">
                    <button type="button" class="ac-img-action" :title="$t('admin.move_left')" :aria-label="$t('admin.move_left')" :disabled="imagesBusy || idx === 0" @click="moveImage(idx, idx - 1)">
                      <UIcon name="i-heroicons-chevron-left" class="w-4 h-4" />
                    </button>
                    <button type="button" class="ac-img-action" :title="$t('admin.set_primary')" :aria-label="$t('admin.set_primary')" :disabled="imagesBusy || idx === 0" @click="setPrimary(idx)">
                      <UIcon name="i-heroicons-star" class="w-4 h-4" />
                    </button>
                    <button type="button" class="ac-img-action" :title="$t('admin.move_right')" :aria-label="$t('admin.move_right')" :disabled="imagesBusy || idx === form.images.length - 1" @click="moveImage(idx, idx + 1)">
                      <UIcon name="i-heroicons-chevron-right" class="w-4 h-4" />
                    </button>
                    <button type="button" class="ac-img-action is-danger" :title="$t('admin.remove_image')" :aria-label="$t('admin.remove_image')" :disabled="imagesBusy" @click="removeImage(idx)">
                      <UIcon name="i-heroicons-trash" class="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
              <!-- Drag & drop zone -->
              <div
                class="ac-dropzone"
                :class="{ 'is-drag': dragging, 'is-busy': imagesBusy }"
                :aria-busy="imagesBusy"
                @click="!imagesBusy && fileInput?.click()"
                @dragover.prevent="dragging = true"
                @dragleave.prevent="dragging = false"
                @drop.prevent="onDrop"
              >
                <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-5-5L5 21" /></svg>
                <div style="font-size: 14px; font-weight: 500; margin-top: 8px;">{{ uploading ? $t('admin.uploading') : $t('admin.drop_or_click') }}</div>
                <div class="acf-hint">JPEG, PNG, WebP or GIF (max 5MB)</div>
              </div>
              <input ref="fileInput" type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple style="display: none;" @change="onPick" >
              <span v-if="uploadError" style="display: block; margin-top: 8px; font-size: 13px; color: var(--ac-warm-red);">{{ uploadError }}</span>
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
// One image request at a time (upload, reorder or remove): buttons and the
// dropzone are disabled while it runs, so a double click cannot fire twice.
const imagesBusy = ref(false)
const uploadError = ref('')
const error = ref('')
const dragging = ref(false)
const slugTouched = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const previewUrls = ref<string[]>([])

const form = reactive({
  slug: '', name_el: '', name_en: '', description_el: '', description_en: '',
  price: 0, compare_at_price: null as number | null, cost: null as number | null, stock: 0,
  brand: '', category_id: null as string | null,
  is_active: true, images: [] as string[],
})

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
    price: 0, compare_at_price: null, cost: null, stock: 0, brand: '',
    category_id: null, is_active: true, images: [],
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
      // Copy only the fields the form owns. Spreading the whole response used to
      // add id, created_at and updated_at onto the reactive form, which then went
      // back out in the PATCH body — and the API now rejects unknown fields.
      Object.assign(form, {
        slug: (data.slug as string) ?? '',
        name_el: (data.name_el as string) ?? '',
        name_en: (data.name_en as string) ?? '',
        description_el: (data.description_el as string) ?? '',
        description_en: (data.description_en as string) ?? '',
        price: Number(data.price ?? 0),
        compare_at_price: data.compare_at_price === null || data.compare_at_price === undefined
          ? null
          : Number(data.compare_at_price),
        cost: data.cost === null || data.cost === undefined ? null : Number(data.cost),
        stock: Number(data.stock ?? 0),
        brand: (data.brand as string) ?? '',
        category_id: (data.category_id as string | null) ?? null,
        is_active: data.is_active !== false,
        images: (data.images as string[]) ?? [],
      })
      // `images` are the stored object keys that get submitted back; image_urls
      // are the presigned URLs used only for the thumbnails. Keeping them apart
      // is what stops an expiring URL being saved as the permanent reference.
      previewUrls.value = (data.image_urls as string[]) ?? []
    }
  }
})

// ── Images ──
// Editing an existing product talks to the product's image sub-resource and
// persists immediately; the API response is the source of truth for the order
// shown. A new product has no id yet, so its images stay local (uploaded via
// /uploads/image) until the product is created with them.
type ImagesPayload = { images: string[]; image_urls: string[] }
const imagesBase = () => `${apiBase}/admin/products/${props.productId}/images`

function applyImages(payload: ImagesPayload) {
  form.images = [...payload.images]
  previewUrls.value = [...payload.image_urls]
}

async function uploadList(files: FileList | File[]) {
  if (imagesBusy.value) return
  uploading.value = true
  imagesBusy.value = true
  uploadError.value = ''
  try {
    for (const file of Array.from(files)) {
      const fd = new FormData()
      fd.append('file', file)
      if (editing.value) {
        applyImages(await $fetch<ImagesPayload>(imagesBase(), { method: 'POST', credentials: 'include', body: fd }))
      } else {
        const { key, url } = await $fetch<{ key: string; url: string }>(`${apiBase}/uploads/image`, {
          method: 'POST', credentials: 'include', body: fd,
        })
        form.images.push(key)
        previewUrls.value.push(url)
      }
    }
  } catch {
    uploadError.value = t('admin.upload_failed')
  } finally {
    uploading.value = false
    imagesBusy.value = false
  }
}

/** Moves one image to a new position; position 0 makes it the primary image. */
async function moveImage(from: number, to: number) {
  if (imagesBusy.value || to < 0 || to >= form.images.length || from === to) return
  const images = [...form.images]
  const [moved] = images.splice(from, 1)
  images.splice(to, 0, moved)
  if (!editing.value) {
    const urls = [...previewUrls.value]
    const [movedUrl] = urls.splice(from, 1)
    urls.splice(to, 0, movedUrl)
    form.images = images
    previewUrls.value = urls
    return
  }
  imagesBusy.value = true
  uploadError.value = ''
  try {
    applyImages(await $fetch<ImagesPayload>(`${imagesBase()}/order`, { method: 'PATCH', credentials: 'include', body: { images } }))
  } catch {
    uploadError.value = t('admin.image_update_failed')
  } finally {
    imagesBusy.value = false
  }
}

function setPrimary(idx: number) {
  return moveImage(idx, 0)
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
async function removeImage(idx: number) {
  if (imagesBusy.value) return
  if (!confirm(t('admin.remove_image_confirm'))) return
  if (!editing.value) {
    form.images.splice(idx, 1)
    previewUrls.value.splice(idx, 1)
    return
  }
  imagesBusy.value = true
  uploadError.value = ''
  try {
    // `ref` may be a storage key or an absolute URL (spaces, query strings):
    // always one encodeURIComponent, decoded once by the API router.
    const ref = form.images[idx]
    applyImages(await $fetch<ImagesPayload>(`${imagesBase()}/${encodeURIComponent(ref)}`, { method: 'DELETE', credentials: 'include' }))
  } catch {
    uploadError.value = t('admin.image_update_failed')
  } finally {
    imagesBusy.value = false
  }
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
