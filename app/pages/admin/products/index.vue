<template>
  <div class="p-8">
    <div class="flex items-center justify-between mb-8">
      <h1 class="text-2xl font-bold text-gray-900">{{ $t('admin.products') }}</h1>
      <div class="flex gap-3">
        <UButton
          icon="i-heroicons-arrow-up-tray"
          :label="$t('admin.import_csv')"
          variant="outline"
          @click="showCsvUpload = true"
        />
        <UButton
          icon="i-heroicons-plus"
          :label="$t('admin.add_product')"
          :to="localePath('/admin/products/new')"
        />
      </div>
    </div>

    <!-- Search -->
    <div class="mb-6">
      <UInput
        v-model="search"
        placeholder="Αναζήτηση..."
        icon="i-heroicons-magnifying-glass"
        class="max-w-xs"
      />
    </div>

    <!-- Table -->
    <UCard>
      <div v-if="pending" class="space-y-3">
        <USkeleton v-for="n in 5" :key="n" class="h-12 rounded" />
      </div>

      <UTable
        v-else
        :rows="filteredProducts"
        :columns="columns"
      >
        <template #is_active-data="{ row }">
          <UBadge
            :label="row.is_active ? $t('admin.active') : $t('admin.inactive')"
            :color="row.is_active ? 'success' : 'neutral'"
            variant="subtle"
          />
        </template>
        <template #stock-data="{ row }">
          <span :class="row.stock < 5 ? 'text-red-600 font-semibold' : ''">{{ row.stock }}</span>
        </template>
        <template #price-data="{ row }">
          <span>€{{ Number(row.price).toFixed(2) }}</span>
        </template>
        <template #actions-data="{ row }">
          <div class="flex gap-2">
            <UButton
              icon="i-heroicons-pencil"
              variant="ghost"
              size="xs"
              :to="localePath(`/admin/products/${row.id}`)"
            />
            <UButton
              icon="i-heroicons-trash"
              variant="ghost"
              color="error"
              size="xs"
              @click="confirmDelete(row)"
            />
          </div>
        </template>
      </UTable>
    </UCard>

    <!-- CSV upload modal -->
    <UModal v-model:open="showCsvUpload">
      <template #content>
        <div class="p-6">
          <h3 class="font-semibold text-lg mb-4">{{ $t('admin.import_csv') }}</h3>
          <p class="text-sm text-gray-600 mb-4">
            CSV format: slug, name_el, name_en, price, stock, brand, animal_age, category_slug
          </p>
          <UInput type="file" accept=".csv" @change="handleCsvUpload" />
          <div class="flex justify-end gap-3 mt-4">
            <UButton :label="$t('common.cancel')" variant="outline" @click="showCsvUpload = false" />
            <UButton :label="$t('admin.import_csv')" :disabled="!csvFile" @click="importCsv" />
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

const supabase = useSupabaseClient()
const localePath = useLocalePath()
const search = ref('')
const showCsvUpload = ref(false)
const csvFile = ref<File | null>(null)

const columns = [
  { key: 'name_el', label: 'Όνομα' },
  { key: 'brand', label: 'Μάρκα' },
  { key: 'price', label: 'Τιμή' },
  { key: 'stock', label: $t('admin.stock') },
  { key: 'is_active', label: 'Κατάσταση' },
  { key: 'actions', label: '' },
]

const { data: products, pending, refresh } = await useAsyncData('admin-products', async () => {
  const { data } = await supabase
    .from('products')
    .select('*')
    .order('created_at', { ascending: false })
  return data
})

const filteredProducts = computed(() => {
  if (!products.value || !search.value) return products.value ?? []
  const q = search.value.toLowerCase()
  return products.value.filter(p =>
    p.name_el.toLowerCase().includes(q) ||
    p.name_en.toLowerCase().includes(q) ||
    (p.brand ?? '').toLowerCase().includes(q)
  )
})

function handleCsvUpload(e: Event) {
  csvFile.value = (e.target as HTMLInputElement).files?.[0] ?? null
}

async function importCsv() {
  if (!csvFile.value) return
  // CSV import implementation — parse and upsert
  showCsvUpload.value = false
  csvFile.value = null
  refresh()
}

async function confirmDelete(product: any) {
  if (!confirm(`Διαγραφή "${product.name_el}";`)) return
  await supabase.from('products').update({ is_active: false }).eq('id', product.id)
  refresh()
}

function $t(key: string) {
  const { t } = useI18n()
  return t(key)
}
</script>
