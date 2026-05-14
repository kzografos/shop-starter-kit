<template>
  <div class="p-8 max-w-3xl">
    <div class="flex items-center gap-4 mb-8">
      <UButton icon="i-heroicons-arrow-left" variant="ghost" :to="localePath('/admin/products')" />
      <h1 class="text-2xl font-bold text-gray-900">
        {{ isNew ? $t('admin.add_product') : $t('admin.edit') }}
      </h1>
    </div>

    <UCard>
      <form class="space-y-6" @submit.prevent="save">
        <div class="grid sm:grid-cols-2 gap-4">
          <UFormField label="Slug (URL)" required>
            <UInput v-model="form.slug" placeholder="dog-food-royal-canin" class="w-full" />
          </UFormField>
          <UFormField :label="$t('admin.active')">
            <USwitch v-model="form.is_active" />
          </UFormField>
          <UFormField label="Όνομα (Ελληνικά)" required>
            <UInput v-model="form.name_el" class="w-full" />
          </UFormField>
          <UFormField label="Name (English)" required>
            <UInput v-model="form.name_en" class="w-full" />
          </UFormField>
          <UFormField label="Περιγραφή (ΕΛ)" class="sm:col-span-2">
            <UTextarea v-model="form.description_el" :rows="3" class="w-full" />
          </UFormField>
          <UFormField label="Description (EN)" class="sm:col-span-2">
            <UTextarea v-model="form.description_en" :rows="3" class="w-full" />
          </UFormField>
          <UFormField label="Τιμή (€)" required>
            <UInput v-model.number="form.price" type="number" step="0.01" min="0" class="w-full" />
          </UFormField>
          <UFormField :label="$t('admin.stock')" required>
            <UInput v-model.number="form.stock" type="number" min="0" class="w-full" />
          </UFormField>
          <UFormField :label="$t('filters.brand')">
            <UInput v-model="form.brand" class="w-full" />
          </UFormField>
          <UFormField :label="$t('filters.package_size')">
            <UInput v-model="form.package_size" class="w-full" />
          </UFormField>
          <UFormField :label="$t('filters.animal_age')">
            <USelect
              v-model="form.animal_age"
              :items="ageOptions"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Κατηγορία">
            <USelect
              v-model="form.category_id"
              :items="categoryOptions"
              class="w-full"
            />
          </UFormField>
        </div>

        <!-- Images -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Φωτογραφίες</label>

          <!-- Preview grid -->
          <div v-if="form.images.length" class="grid grid-cols-3 sm:grid-cols-4 gap-3 mb-3">
            <div
              v-for="(url, idx) in form.images"
              :key="url"
              class="relative group aspect-square rounded-lg overflow-hidden border border-gray-200"
            >
              <img :src="url" :alt="`Image ${idx + 1}`" class="w-full h-full object-cover" >
              <button
                type="button"
                class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                @click="form.images.splice(idx, 1)"
              >
                <UIcon name="i-heroicons-trash" class="w-5 h-5 text-white" />
              </button>
            </div>
          </div>

          <!-- Upload button -->
          <div class="flex items-center gap-3">
            <input
              ref="fileInput"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              class="hidden"
              @change="uploadFiles"
            >
            <UButton
              type="button"
              icon="i-heroicons-cloud-arrow-up"
              variant="outline"
              :loading="uploading"
              :label="uploading ? 'Uploading...' : 'Upload Images'"
              @click="(fileInput as HTMLInputElement)?.click()"
            />
            <span v-if="uploadError" class="text-sm text-red-500">{{ uploadError }}</span>
          </div>
        </div>

        <div class="flex justify-end gap-3">
          <UButton :label="$t('common.cancel')" variant="outline" :to="localePath('/admin/products')" />
          <UButton :label="$t('common.save')" type="submit" :loading="saving" />
        </div>
      </form>
    </UCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

const route = useRoute()
const { public: { apiBase } } = useRuntimeConfig()
const localePath = useLocalePath()
const { t } = useI18n()
const saving = ref(false)
const uploading = ref(false)
const uploadError = ref('')
const fileInput = ref<HTMLInputElement | null>(null)

async function uploadFiles(event: Event) {
  const files = (event.target as HTMLInputElement).files
  if (!files?.length) return
  uploading.value = true
  uploadError.value = ''
  try {
    for (const file of Array.from(files)) {
      const fd = new FormData()
      fd.append('file', file)
      const { url } = await $fetch<{ url: string }>(`${apiBase}/uploads/image`, {
        method: 'POST',
        credentials: 'include',
        body: fd,
      })
      form.images.push(url)
    }
  } catch {
    uploadError.value = 'Upload failed'
  } finally {
    uploading.value = false
    if (fileInput.value) fileInput.value.value = ''
  }
}

const isNew = computed(() => route.params.id === 'new')

const form = reactive({
  slug: '',
  name_el: '',
  name_en: '',
  description_el: '',
  description_en: '',
  price: 0,
  stock: 0,
  brand: '',
  package_size: '',
  animal_age: 'all' as string,
  category_id: null as string | null,
  is_active: true,
  images: [] as string[],
})

const ageOptions = [
  { label: t('age.all'), value: 'all' },
  { label: t('age.puppy'), value: 'puppy' },
  { label: t('age.kitten'), value: 'kitten' },
  { label: t('age.adult'), value: 'adult' },
  { label: t('age.senior'), value: 'senior' },
]

type Category = { id: string; name_el: string }

const { data: categories } = useAsyncData('admin-categories', () =>
  $fetch<Category[]>(`${apiBase}/categories`, { credentials: 'include' })
)

const categoryOptions = computed(() =>
  (categories.value ?? []).map((c: Category) => ({ label: c.name_el, value: c.id }))
)

if (!isNew.value) {
  const { data: productData } = useAsyncData(`admin-product-${route.params.id}`, () =>
    $fetch<Record<string, unknown>>(`${apiBase}/admin/products/${route.params.id}`, { credentials: 'include' })
  )
  watch(productData, (val) => {
    if (val) Object.assign(form, { ...val, images: (val.images as string[]) ?? [] })
  }, { immediate: true })
}

async function save() {
  saving.value = true
  try {
    if (isNew.value) {
      await $fetch(`${apiBase}/admin/products`, {
        method: 'POST',
        body: { ...form },
        credentials: 'include',
      })
    } else {
      await $fetch(`${apiBase}/admin/products/${route.params.id}`, {
        method: 'PATCH',
        body: { ...form },
        credentials: 'include',
      })
    }
    await navigateTo(localePath('/admin/products'))
  } finally {
    saving.value = false
  }
}
</script>
