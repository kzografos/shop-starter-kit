<template>
  <div>
    <!-- Stat cards -->
    <div class="ac-stat-grid">
      <div class="ac-card ac-stat">
        <div class="ac-stat-label">Συνολικά Έσοδα</div>
        <div class="ac-stat-value">
          <template v-if="loading"><span style="opacity: 0.3">—</span></template>
          <template v-else>€{{ Math.round(kpi.totalRevenue).toLocaleString('el-GR') }}</template>
        </div>
        <div>
          <span class="ac-trend-sub">όλων των εποχών</span>
        </div>
        <div class="ac-stat-icon" style="background: rgba(201,123,90,0.12); color: #C97B5A;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M18 7a7 7 0 1 0 0 10"/><path d="M3 10h10M3 14h10"/></svg>
        </div>
      </div>

      <div class="ac-card ac-stat">
        <div class="ac-stat-label">Έσοδα Μήνα</div>
        <div class="ac-stat-value">
          <template v-if="loading"><span style="opacity: 0.3">—</span></template>
          <template v-else>€{{ Math.round(kpi.monthRevenue).toLocaleString('el-GR') }}</template>
        </div>
        <div v-if="!loading">
          <span class="ac-trend" :class="kpi.monthRevenueChange >= 0 ? 'up' : 'down'">
            <svg v-if="kpi.monthRevenueChange >= 0" viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
            <svg v-else viewBox="0 0 24 24"><path d="M12 5v14M5 12l7 7 7-7"/></svg>
            {{ kpi.monthRevenueChange >= 0 ? '+' : '' }}{{ kpi.monthRevenueChange }}%
          </span>
          <span class="ac-trend-sub">vs προηγ. μήνα</span>
        </div>
        <div class="ac-stat-icon" style="background: rgba(168,184,154,0.15); color: #A8B89A;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l6-6 4 4 7-7"/><path d="M14 8h6v6"/></svg>
        </div>
      </div>

      <div class="ac-card ac-stat">
        <div class="ac-stat-label">Πελάτες</div>
        <div class="ac-stat-value">
          <template v-if="loading"><span style="opacity: 0.3">—</span></template>
          <template v-else>{{ kpi.totalCustomers.toLocaleString('el-GR') }}</template>
        </div>
        <div>
          <span class="ac-trend-sub">συνολικά εγγεγραμμένοι</span>
        </div>
        <div class="ac-stat-icon" style="background: rgba(90,143,201,0.12); color: #5A8FC9;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.75 19c.5-3 3.5-4.75 6.25-4.75S15 16 15.5 19"/><circle cx="17" cy="9" r="2.5"/><path d="M19 14.75c1.5.5 2.5 1.5 2.5 3"/></svg>
        </div>
      </div>

      <div class="ac-card ac-stat">
        <div class="ac-stat-label">Νέοι Μήνα</div>
        <div class="ac-stat-value">
          <template v-if="loading"><span style="opacity: 0.3">—</span></template>
          <template v-else>{{ kpi.newCustomers }}</template>
        </div>
        <div v-if="!loading">
          <span class="ac-trend" :class="kpi.newCustomersChange >= 0 ? 'up' : 'down'">
            <svg v-if="kpi.newCustomersChange >= 0" viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
            <svg v-else viewBox="0 0 24 24"><path d="M12 5v14M5 12l7 7 7-7"/></svg>
            {{ kpi.newCustomersChange >= 0 ? '+' : '' }}{{ kpi.newCustomersChange }}%
          </span>
          <span class="ac-trend-sub">vs προηγ. μήνα</span>
        </div>
        <div class="ac-stat-icon" style="background: rgba(212,162,76,0.15); color: #D4A24C;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.75 19c.5-3 3.5-4.75 6.25-4.75S15 16 15.5 19"/><path d="M19 8v6M16 11h6"/></svg>
        </div>
      </div>
    </div>

    <!-- Revenue Chart -->
    <div class="ac-card ac-chart-card">
      <div class="ac-card-head">
        <div>
          <div class="ac-card-title">Revenue</div>
          <div class="ac-card-sub">Τελευταίες 30 ημέρες</div>
        </div>
      </div>
      <div style="padding: 16px 20px 20px;">
        <div v-if="loading" style="height: 192px; display: flex; align-items: center; justify-content: center; color: var(--ac-text-faint);">
          Φόρτωση...
        </div>
        <LineChart
          v-else
          :data="revenueChartData"
          :height="192"
          :categories="revenueCategories"
          :y-formatter="(v: any) => `€${Number(v).toFixed(0)}`"
          :x-formatter="revenueXFormatter"
          :x-num-ticks="6"
        />
      </div>
    </div>

    <!-- Two col: Top Products + Orders Donut -->
    <div class="ac-two-col" style="margin-bottom: 20px;">
      <!-- Top 5 Products -->
      <div class="ac-card">
        <div class="ac-card-head">
          <div>
            <div class="ac-card-title">Top 5 Προϊόντα</div>
            <div class="ac-card-sub">Κατά τεμάχια πωλήσεων αυτόν τον μήνα</div>
          </div>
        </div>
        <div style="padding: 4px 20px 12px;">
          <div v-if="loading">
            <div v-for="n in 5" :key="n" style="padding: 14px 0; border-bottom: 1px solid var(--ac-hairline);">
              <div style="height: 12px; background: var(--ac-bg-tint); border-radius: 4px; margin-bottom: 8px;" />
              <div style="height: 6px; background: var(--ac-bg-tint); border-radius: 3px;" />
            </div>
          </div>
          <template v-else>
            <div
              v-for="(p, i) in topProducts"
              :key="p.name"
              class="ac-tp-row"
            >
              <div class="ac-tp-rank">0{{ i + 1 }}</div>
              <div>
                <div class="ac-tp-name">{{ p.name }}</div>
                <div class="ac-tp-bar-track">
                  <div class="ac-tp-bar-fill" :style="{ width: `${(p.units / (topProducts[0]?.units || 1)) * 100}%` }" />
                </div>
              </div>
              <div class="ac-tp-units">{{ p.units }}</div>
            </div>
            <div v-if="!topProducts.length" class="ac-empty">Δεν υπάρχουν δεδομένα</div>
          </template>
        </div>
      </div>

      <!-- Orders by Status Donut -->
      <div class="ac-card">
        <div class="ac-card-head">
          <div>
            <div class="ac-card-title">Παραγγελίες ανά Κατάσταση</div>
            <div class="ac-card-sub">Τελευταίες 30 ημέρες · {{ donutTotal }} σύνολο</div>
          </div>
        </div>
        <div class="ac-card-pad">
          <div v-if="loading" class="ac-donut-wrap">
            <div style="width: 160px; height: 160px; border-radius: 50%; background: var(--ac-bg-tint);" />
          </div>
          <template v-else-if="orderStatusData.length">
            <!-- SVG Donut -->
            <div class="ac-donut-wrap">
              <svg :viewBox="`0 0 180 180`" width="180" height="180">
                <path
                  v-for="(arc, i) in donutArcs"
                  :key="i"
                  :d="arc.path"
                  :fill="arc.color"
                />
                <text x="90" y="86" text-anchor="middle" font-size="11" fill="var(--ac-text-muted)" font-family="DM Sans">Σύνολο</text>
                <text x="90" y="106" text-anchor="middle" font-size="22" font-weight="500" fill="var(--ac-text)" font-family="Fraunces">{{ donutTotal }}</text>
              </svg>
            </div>
            <div class="ac-donut-legend">
              <div v-for="d in donutData" :key="d.label" class="ac-legend-row">
                <span class="ac-legend-swatch" :style="{ background: d.color }" />
                <span>{{ d.label }}</span>
                <span class="ac-legend-pct">{{ Math.round(d.count / donutTotal * 100) }}%</span>
                <span class="ac-legend-count">{{ d.count }}</span>
              </div>
            </div>
          </template>
          <div v-else class="ac-empty">Δεν υπάρχουν δεδομένα</div>
        </div>
      </div>
    </div>

    <!-- Bottom row: Low Stock + Recent Orders -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
      <!-- Low Stock -->
      <div class="ac-card">
        <div class="ac-card-head">
          <div>
            <div class="ac-card-title">Χαμηλό Απόθεμα</div>
            <div class="ac-card-sub">Προϊόντα που χρειάζονται ανεφοδιασμό</div>
          </div>
          <span v-if="!loading" class="ac-badge ac-badge-gold">{{ lowStock.length }}</span>
        </div>
        <div class="ac-card-pad">
          <div v-if="loading">
            <div v-for="n in 4" :key="n" style="height: 14px; background: var(--ac-bg-tint); border-radius: 4px; margin-bottom: 10px;" />
          </div>
          <div v-else-if="lowStock.length" style="display: flex; flex-direction: column; gap: 10px;">
            <div
              v-for="p in lowStock"
              :key="p.id"
              style="display: flex; align-items: center; justify-content: space-between;"
            >
              <span style="font-size: 13px; color: var(--ac-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-right: 12px;">{{ p.name_el }}</span>
              <span
                class="ac-stock-badge"
                :class="p.stock === 0 ? 'critical' : 'warning'"
              >{{ p.stock }} τεμ.</span>
            </div>
          </div>
          <div v-else class="ac-empty" style="padding: 24px 0;">Όλα τα αποθέματα OK ✓</div>
        </div>
      </div>

      <!-- Recent Orders -->
      <div class="ac-card">
        <div class="ac-card-head">
          <div class="ac-card-title">Πρόσφατες Παραγγελίες</div>
          <button class="ac-btn-primary" style="padding: 6px 12px; font-size: 12px;" @click="navigateTo(localePath('/admin/orders'))">
            Όλες
          </button>
        </div>
        <div v-if="loading">
          <div v-for="n in 5" :key="n" style="height: 44px; border-bottom: 1px solid var(--ac-hairline);" />
        </div>
        <div v-else-if="!recentOrders.length" class="ac-empty">Δεν υπάρχουν παραγγελίες ακόμα.</div>
        <div v-else>
          <div
            v-for="order in recentOrders"
            :key="order.id"
            style="display: flex; align-items: center; justify-content: space-between; padding: 11px 20px; border-bottom: 1px solid var(--ac-hairline); font-size: 13px;"
          >
            <span class="ac-mono" style="color: var(--ac-text-muted);">{{ order.id.slice(0, 8).toUpperCase() }}</span>
            <span
              class="ac-badge"
              :class="orderStatusBadgeClass(order.status)"
            >
              <span class="ac-badge-dot" />
              {{ order.status }}
            </span>
            <span style="font-weight: 600; color: var(--ac-text);">€{{ Number(order.total).toFixed(2) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

const { public: { apiBase } } = useRuntimeConfig()
const localePath = useLocalePath()

const loading = ref(true)

const kpi = reactive({ totalRevenue: 0, monthRevenue: 0, monthRevenueChange: 0, totalCustomers: 0, newCustomers: 0, newCustomersChange: 0 })
const recentOrders = ref<Array<{ id: string; status: string; total: number }>>([])
const revenueChartData = ref<{ 'Έσοδα': number }[]>([])
const revenueDates = ref<string[]>([])
const orderStatusData = ref<{ status: string; count: number }[]>([])
const topProducts = ref<{ name: string; units: number }[]>([])
const lowStock = ref<{ id: string; name_el: string; stock: number }[]>([])

const revenueCategories = { 'Έσοδα': { name: 'Έσοδα', color: '#C97B5A' } }

function revenueXFormatter(_: unknown, i: number) {
  return revenueDates.value[i] ?? ''
}

// ── Donut chart ─────────────────────────────────────────────
const DONUT_COLORS = ['#C97B5A', '#A8B89A', '#D4A24C', '#5A8FC9', '#6BAE7E']

const donutData = computed(() =>
  orderStatusData.value.map((o, i) => ({
    label: o.status,
    count: o.count,
    color: DONUT_COLORS[i % DONUT_COLORS.length],
  }))
)

const donutTotal = computed(() => donutData.value.reduce((a, b) => a + b.count, 0))

const donutArcs = computed(() => {
  const R = 64, r = 42, cx = 90, cy = 90
  let acc = -Math.PI / 2
  const total = donutTotal.value || 1
  return donutData.value.map(d => {
    const frac = d.count / total
    const a0 = acc
    const a1 = acc + frac * Math.PI * 2
    acc = a1
    const large = a1 - a0 > Math.PI ? 1 : 0
    const x0 = cx + R * Math.cos(a0), y0 = cy + R * Math.sin(a0)
    const x1 = cx + R * Math.cos(a1), y1 = cy + R * Math.sin(a1)
    const x2 = cx + r * Math.cos(a1), y2 = cy + r * Math.sin(a1)
    const x3 = cx + r * Math.cos(a0), y3 = cy + r * Math.sin(a0)
    return {
      path: `M${x0.toFixed(2)} ${y0.toFixed(2)} A${R} ${R} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} L${x2.toFixed(2)} ${y2.toFixed(2)} A${r} ${r} 0 ${large} 0 ${x3.toFixed(2)} ${y3.toFixed(2)} Z`,
      color: d.color,
    }
  })
})

onMounted(async () => {
  try {
    const stats = await $fetch<{
      total_revenue: number
      month_revenue: number
      month_revenue_change: number
      total_customers: number
      new_customers: number
      new_customers_change: number
      recent_orders: Array<{ id: string; status: string; total: number }>
      last_30_days: Array<{ date: string; total: number }>
      order_status_breakdown: Array<{ status: string; count: number }>
      top_products: Array<{ name: string; units: number }>
      low_stock: Array<{ id: string; name_el: string; stock: number }>
    }>(`${apiBase}/admin/stats`, { credentials: 'include' })

    kpi.totalRevenue  = stats.total_revenue ?? 0
    kpi.monthRevenue  = stats.month_revenue ?? 0
    kpi.monthRevenueChange = stats.month_revenue_change ?? 0
    kpi.totalCustomers = stats.total_customers ?? 0
    kpi.newCustomers  = stats.new_customers ?? 0
    kpi.newCustomersChange = stats.new_customers_change ?? 0

    recentOrders.value  = stats.recent_orders ?? []
    topProducts.value   = stats.top_products ?? []
    lowStock.value      = stats.low_stock ?? []
    orderStatusData.value = stats.order_status_breakdown ?? []

    // 30-day revenue chart
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29)
    thirtyDaysAgo.setHours(0, 0, 0, 0)

    const dayMap = new Map<string, number>()
    for (let i = 0; i < 30; i++) {
      const d = new Date(thirtyDaysAgo)
      d.setDate(d.getDate() + i)
      dayMap.set(d.toISOString().slice(0, 10), 0)
    }
    for (const o of (stats.last_30_days ?? [])) {
      if (dayMap.has(o.date)) dayMap.set(o.date, (dayMap.get(o.date) ?? 0) + o.total)
    }
    revenueDates.value = Array.from(dayMap.keys()).map(d => d.slice(5))
    revenueChartData.value = Array.from(dayMap.values()).map(v => ({ 'Έσοδα': v }))
  } catch (e) {
    console.error('Admin stats failed:', e)
  } finally {
    loading.value = false
  }
})

function orderStatusBadgeClass(status: string) {
  const map: Record<string, string> = {
    completed: 'ac-badge-sage',
    ready:     'ac-badge-sage',
    shipped:   'ac-badge-blue',
    processing:'ac-badge-gold',
    pending:   'ac-badge-gold',
    confirmed: 'ac-badge-blue',
    cancelled: 'ac-badge-red',
  }
  return map[status] ?? 'ac-badge-neutral'
}
</script>
