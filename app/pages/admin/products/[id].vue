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

        <!-- Image URLs -->
        <UFormField label="URLs Φωτογραφιών (μία ανά γραμμή)">
          <UTextarea
            :model-value="form.images.join('\n')"
            :rows="4"
            class="w-full font-mono text-sm"
            @update:model-value="form.images = $event.split('\n').map(s => s.trim()).filter(Boolean)"
          />
        </UFormField>

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
const supabase = useSupabaseClient()
const localePath = useLocalePath()
const { t } = useI18n()
const saving = ref(false)

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

const { data: categories } = await useAsyncData('admin-categories', async () => {
  const { data } = await supabase.from('categories').select('*').order('name_el')
  return data
})

const categoryOptions = computed(() =>
  (categories.value ?? []).map(c => ({ label: c.name_el, value: c.id }))
)

// Load existing product
if (!isNew.value) {
  const { data } = await useAsyncData(`admin-product-${route.params.id}`, async () => {
    const { data } = await supabase.from('products').select('*').eq('id', route.params.id).single()
    return data
  })
  if (data.value) {
    Object.assign(form, {
      ...data.value,
      images: data.value.images ?? [],
    })
  }
}

async function save() {
  saving.value = true
  try {
    const payload = { ...form }
    if (isNew.value) {
      await supabase.from('products').insert(payload)
    } else {
      await supabase.from('products').update(payload).eq('id', route.params.id as string)
    }
    await navigateTo(localePath('/admin/products'))
  } finally {
    saving.value = false
  }
}
</script>
