<template>
  <div>
    <!-- Toolbar -->
    <div class="ac-table-toolbar">
      <div class="ac-table-toolbar-left">
        <div class="ac-search">
          <svg class="ac-search-icon" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
          <input v-model="search" placeholder="Search products, brands…" />
        </div>
        <button class="ac-filter-btn" @click="showCsvUpload = true">
          <svg viewBox="0 0 24 24"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>
          Import CSV
        </button>
      </div>
      <button class="ac-btn-primary" @click="openCreate">
        <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
        {{ $t('admin.add_product') }}
      </button>
    </div>

    <!-- Table -->
    <div class="ac-card ac-table-card">
      <div v-if="pending" style="padding: 24px 20px; display: flex; flex-direction: column; gap: 10px;">
        <div v-for="n in 8" :key="n" style="height: 44px; background: var(--ac-bg-tint); border-radius: 6px;" />
      </div>

      <table v-else class="ac-data">
        <thead>
          <tr>
            <th style="width: 36%;">
              <button class="ac-sort-th" :class="{ active: sortCol === 'name' }" @click="toggleSort('name')">
                Όνομα <SortIcon :col="sortCol" :dir="sortDir" name="name" />
              </button>
            </th>
            <th>
              <button class="ac-sort-th" :class="{ active: sortCol === 'brand' }" @click="toggleSort('brand')">
                Μάρκα <SortIcon :col="sortCol" :dir="sortDir" name="brand" />
              </button>
            </th>
            <th>
              <button class="ac-sort-th" :class="{ active: sortCol === 'price' }" @click="toggleSort('price')">
                Τιμή <SortIcon :col="sortCol" :dir="sortDir" name="price" />
              </button>
            </th>
            <th>
              <button class="ac-sort-th" :class="{ active: sortCol === 'stock' }" @click="toggleSort('stock')">
                {{ $t('admin.stock') }} <SortIcon :col="sortCol" :dir="sortDir" name="stock" />
              </button>
            </th>
            <th>Κατάσταση</th>
            <th style="width: 80px; text-align: right;">Ενέργειες</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!products.length">
            <td colspan="6" class="ac-empty">Δεν βρέθηκαν προϊόντα</td>
          </tr>
          <tr v-for="p in products" :key="p.id">
            <td>
              <button class="ac-link-name" style="background: none; border: none; cursor: pointer; padding: 0; font: inherit; text-align: left;" @click="openEdit(p.id)">{{ p.name_el }}</button>
            </td>
            <td class="ac-muted">{{ p.brand || '—' }}</td>
            <td class="ac-mono">€{{ Number(p.price).toFixed(2) }}</td>
            <td>
              <span :class="p.stock < 10 ? 'ac-stock-low ac-mono' : 'ac-mono'">{{ p.stock }}</span>
            </td>
            <td>
              <span class="ac-badge" :class="p.is_active ? 'ac-badge-sage' : 'ac-badge-red'">
                <span class="ac-badge-dot" />
                {{ p.is_active ? $t('admin.active') : $t('admin.inactive') }}
              </span>
            </td>
            <td>
              <div class="ac-row-actions" style="justify-content: flex-end;">
                <button class="ac-row-action-btn" title="Edit" @click="openEdit(p.id)">
                  <svg viewBox="0 0 24 24"><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4Z"/></svg>
                </button>
                <button class="ac-row-action-btn danger" title="Deactivate" @click="confirmDelete(p)">
                  <svg viewBox="0 0 24 24"><path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12"/><path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"/></svg>
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Pagination -->
      <div v-if="!pending && totalPages > 1" class="ac-pagination">
        <div style="color: var(--ac-text-muted);">{{ total }} προϊόντα</div>
        <div class="ac-pag-btns">
          <button class="ac-pag-btn" :disabled="page === 1" @click="page--">
            <svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <button
            v-for="p in visiblePages"
            :key="p"
            class="ac-pag-btn"
            :class="{ active: p === page }"
            @click="page = p"
          >{{ p }}</button>
          <button class="ac-pag-btn" :disabled="page === totalPages" @click="page++">
            <svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>
          </button>
        </div>
      </div>
    </div>

    <!-- CSV Upload Modal -->
    <UModal v-model:open="showCsvUpload">
      <template #content>
        <div style="padding: 24px;">
          <h3 style="font-family: Fraunces, serif; font-size: 18px; font-weight: 500; margin: 0 0 8px;">{{ $t('admin.import_csv') }}</h3>
          <p style="font-size: 13px; color: var(--ac-text-muted); margin-bottom: 16px;">
            CSV format: slug, name_el, name_en, price, stock, brand, category_slug
          </p>
          <UInput type="file" accept=".csv" @change="handleCsvUpload" />
          <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 16px;">
            <UButton :label="$t('common.cancel')" variant="outline" @click="() => { showCsvUpload = false }" />
            <UButton :label="$t('admin.import_csv')" :disabled="!csvFile" @click="importCsv" />
          </div>
        </div>
      </template>
    </UModal>

    <!-- Create / edit drawer -->
    <ProductDrawer v-model:open="drawerOpen" :product-id="editingId" @saved="refresh" />
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

// ── Sort icon component ────────────────────────────────────
const SortIcon = defineComponent({
  props: { col: String, dir: String, name: String },
  setup(props) {
    return () => {
      const active = props.col === props.name
      const asc    = props.dir === 'asc'
      return h('span', { class: 'ac-sort-icon' }, [
        h('svg', {
          viewBox: '0 0 24 24',
          width: 14, height: 14,
          fill: 'none',
          stroke: active ? '#C97B5A' : 'currentColor',
          'stroke-width': 2,
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
        }, [
          !active || asc
            ? h('path', { d: 'M12 5v14M5 12l7-7 7 7', opacity: (!active || asc) ? 1 : 0.3 })
            : h('path', { d: 'M12 19V5M5 12l7 7 7-7' }),
        ]),
      ])
    }
  },
})

const api = useApi()
const search = ref('')
const page   = ref(1)
const sortCol = ref<string>('')
const sortDir = ref<'asc' | 'desc'>('asc')
const showCsvUpload = ref(false)
const csvFile = ref<File | null>(null)

// Create / edit drawer
const drawerOpen = ref(false)
const editingId = ref<string | null>(null)
function openCreate() { editingId.value = 'new'; drawerOpen.value = true }
function openEdit(id: string) { editingId.value = id; drawerOpen.value = true }

// Deep link from the notifications page: /admin/products?edit=<id>
const route = useRoute()
onMounted(() => {
  const id = route.query.edit
  if (typeof id === 'string' && id) openEdit(id)
})

type ProductRow = { id: string; name_el: string; brand: string; price: number; stock: number; is_active: boolean }
type ProductsResponse = { products: ProductRow[]; total: number; page: number; totalPages: number }

const { data, pending, refresh } = useAsyncData('admin-products', () =>
  api<ProductsResponse>(`/admin/products`, {
    query: {
      page: page.value,
      search: search.value || undefined,
      sort: sortCol.value || undefined,
      order: sortCol.value ? sortDir.value : undefined,
    },
  }),
  { server: false, watch: [page] }
)

const products   = computed(() => data.value?.products ?? [])
const total      = computed(() => data.value?.total ?? 0)
const totalPages = computed(() => data.value?.totalPages ?? 1)

const visiblePages = computed(() => {
  const tp = totalPages.value, p = page.value
  if (tp <= 7) return Array.from({ length: tp }, (_, i) => i + 1)
  if (p <= 4)  return [1, 2, 3, 4, 5, tp]
  if (p >= tp - 3) return [1, tp - 4, tp - 3, tp - 2, tp - 1, tp]
  return [1, p - 1, p, p + 1, tp]
})

function toggleSort(col: string) {
  if (sortCol.value === col) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortCol.value = col
    sortDir.value = col === 'price' || col === 'stock' ? 'desc' : 'asc'
  }
  page.value = 1
  refresh()
}

let searchTimer: ReturnType<typeof setTimeout>
watch(search, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { page.value = 1; refresh() }, 350)
})

function handleCsvUpload(e: Event) {
  csvFile.value = (e.target as HTMLInputElement).files?.[0] ?? null
}

async function importCsv() {
  if (!csvFile.value) return
  showCsvUpload.value = false
  csvFile.value = null
  refresh()
}

async function confirmDelete(product: ProductRow) {
  if (!confirm(`Απενεργοποίηση "${product.name_el}";`)) return
  await api(`/admin/products/${product.id}/deactivate`, {
    method: 'PATCH',
    })
  refresh()
}
</script>
