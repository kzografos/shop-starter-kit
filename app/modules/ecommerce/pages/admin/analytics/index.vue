<template>
  <div>
    <!-- Date range control -->
    <DateRangeControl style="margin-bottom: 20px;" @change="onRange" />

    <!-- KPI cards -->
    <div class="ac-stat-grid">
      <div v-for="k in kpiCards" :key="k.label" class="ac-card ac-stat">
        <div class="ac-stat-label">{{ k.label }}<AdminInfo v-if="k.info">{{ k.info }}</AdminInfo></div>
        <div class="ac-stat-value">
          <template v-if="pending"><span style="opacity: 0.3">—</span></template>
          <template v-else>{{ k.value }}</template>
        </div>
        <div v-if="!pending">
          <span v-if="k.delta !== null" class="ac-trend" :class="k.delta >= 0 ? 'up' : 'down'">
            <svg v-if="k.delta >= 0" viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
            <svg v-else viewBox="0 0 24 24"><path d="M12 5v14M5 12l7 7 7-7" /></svg>
            {{ k.delta >= 0 ? '+' : '' }}{{ k.delta }}%
          </span>
          <span class="ac-trend-sub">{{ k.sub }}</span>
        </div>
        <div class="ac-stat-icon" :style="{ background: k.iconBg, color: k.iconColor }" v-html="k.icon" />
      </div>
    </div>

    <!-- Revenue chart -->
    <div class="ac-card ac-chart-card" style="margin-bottom: 20px;">
      <div class="ac-card-head">
        <div>
          <div class="ac-card-title">{{ $t('admin.revenue') }}</div>
          <div class="ac-card-sub">{{ granLabel }}</div>
        </div>
      </div>
      <div style="padding: 16px 20px 20px;">
        <div v-if="pending" style="height: 240px; display: flex; align-items: center; justify-content: center; color: var(--ac-text-faint);">…</div>
        <div v-else-if="!revData.length" class="ac-empty" style="height: 240px; display: flex; align-items: center; justify-content: center;">{{ $t('admin.no_data') }}</div>
        <LineChart
          v-else
          :data="revData"
          :height="240"
          :categories="revCategories"
          :y-formatter="(v: any) => `${currencySymbol}${Number(v).toFixed(0)}`"
          :x-formatter="xFormatter"
          :x-num-ticks="6"
        />
      </div>
    </div>

    <!-- Category mix + Brand mix -->
    <div class="ac-two-col" style="margin-bottom: 20px;">
      <!-- Category donut -->
      <div class="ac-card">
        <div class="ac-card-head">
          <div>
            <div class="ac-card-title">{{ $t('admin.category_mix') }}</div>
            <div class="ac-card-sub">{{ $t('admin.by_revenue') }}</div>
          </div>
        </div>
        <div class="ac-card-pad">
          <div v-if="pending" class="ac-donut-wrap"><div style="width: 160px; height: 160px; border-radius: 50%; background: var(--ac-bg-tint);" /></div>
          <template v-else-if="categoryMix.length">
            <div class="ac-donut-wrap">
              <svg viewBox="0 0 180 180" width="180" height="180">
                <path v-for="(arc, i) in catArcs" :key="i" :d="arc.path" :fill="arc.color" />
                <text x="90" y="86" text-anchor="middle" font-size="11" fill="var(--ac-text-muted)" font-family="DM Sans">{{ $t('admin.revenue') }}</text>
                <text x="90" y="106" text-anchor="middle" font-size="18" font-weight="500" fill="var(--ac-text)" font-family="Fraunces">{{ money(catTotal) }}</text>
              </svg>
            </div>
            <div class="ac-donut-legend">
              <div v-for="(d, i) in categoryMix" :key="d.name_en" class="ac-legend-row">
                <span class="ac-legend-swatch" :style="{ background: DONUT_COLORS[i % DONUT_COLORS.length] }" />
                <span>{{ locale === 'el' ? d.name_el : d.name_en }}</span>
                <span class="ac-legend-pct">{{ Math.round(d.revenue / catTotal * 100) }}%</span>
                <span class="ac-legend-count">{{ money(d.revenue) }}</span>
              </div>
            </div>
          </template>
          <div v-else class="ac-empty">{{ $t('admin.no_data') }}</div>
        </div>
      </div>

      <!-- Brand bars -->
      <div class="ac-card">
        <div class="ac-card-head">
          <div>
            <div class="ac-card-title">{{ $t('admin.brand_mix') }}</div>
            <div class="ac-card-sub">{{ $t('admin.by_revenue') }}</div>
          </div>
        </div>
        <div style="padding: 4px 20px 16px;">
          <div v-if="pending">
            <div v-for="n in 6" :key="n" style="height: 30px; background: var(--ac-bg-tint); border-radius: 4px; margin: 10px 0;" />
          </div>
          <template v-else-if="brandMix.length">
            <div v-for="b in brandMix" :key="b.brand" class="ac-bar-row">
              <div class="ac-bar-label">{{ b.brand }}</div>
              <div class="ac-bar-track"><div class="ac-bar-fill" :style="{ width: `${b.revenue / brandMax * 100}%` }" /></div>
              <div class="ac-bar-value">{{ money(b.revenue) }}</div>
            </div>
          </template>
          <div v-else class="ac-empty">{{ $t('admin.no_data') }}</div>
        </div>
      </div>
    </div>

    <!-- Top sellers -->
    <div class="ac-card" style="margin-bottom: 20px;">
      <div class="ac-card-head">
        <div>
          <div class="ac-card-title">{{ $t('admin.top_sellers') }}</div>
          <div class="ac-card-sub">{{ granLabel }}</div>
        </div>
        <div class="ac-filter-tabs">
          <button class="ac-filter-tab" :class="{ active: metric === 'units' }" @click="metric = 'units'">{{ $t('admin.metric_units') }}</button>
          <button class="ac-filter-tab" :class="{ active: metric === 'revenue' }" @click="metric = 'revenue'">{{ $t('admin.metric_revenue') }}</button>
          <button class="ac-filter-tab" :class="{ active: metric === 'profit' }" @click="metric = 'profit'">{{ $t('admin.metric_profit') }}</button>
        </div>
      </div>
      <div style="padding: 4px 20px 16px;">
        <div v-if="pending">
          <div v-for="n in 6" :key="n" style="height: 30px; background: var(--ac-bg-tint); border-radius: 4px; margin: 10px 0;" />
        </div>
        <template v-else-if="topList.length">
          <div v-for="(p, i) in topList" :key="p.id" class="ac-bar-row">
            <div class="ac-tp-rank">{{ String(i + 1).padStart(2, '0') }}</div>
            <div class="ac-bar-label" style="flex: 1;">{{ locale === 'el' ? p.name_el : p.name_en }}</div>
            <div class="ac-bar-track"><div class="ac-bar-fill" :style="{ width: `${metricVal(p) / topMax * 100}%` }" /></div>
            <div class="ac-bar-value">{{ metric === 'units' ? metricVal(p) : money(metricVal(p)) }}</div>
          </div>
          <p v-if="metric === 'profit' && !topList.length" class="ac-empty">{{ $t('admin.no_cost_data') }}</p>
        </template>
        <div v-else class="ac-empty">
          {{ metric === 'profit' ? $t('admin.no_cost_data') : $t('admin.no_data') }}
        </div>
      </div>
    </div>

    <!-- Dead stock -->
    <div class="ac-card">
      <div class="ac-card-head">
        <div>
          <div class="ac-card-title">{{ $t('admin.dead_stock') }}</div>
          <div class="ac-card-sub">
            {{ $t('admin.dead_stock_sub') }}
            <template v-if="!pending"> · {{ $t('admin.inventory_value') }}: {{ money(stockRetail) }}<span v-if="stockCost"> · {{ money(stockCost) }} {{ $t('admin.at_cost') }}</span></template>
          </div>
        </div>
        <span v-if="!pending" class="ac-badge ac-badge-gold">{{ deadStock.length }}</span>
      </div>
      <div v-if="pending" class="ac-card-pad">
        <div v-for="n in 5" :key="n" style="height: 16px; background: var(--ac-bg-tint); border-radius: 4px; margin-bottom: 10px;" />
      </div>
      <table v-else-if="deadStock.length" class="ac-data">
        <thead>
          <tr>
            <th>{{ $t('admin.name_el') }}</th>
            <th style="text-align: right;">{{ $t('admin.stock') }}</th>
            <th style="text-align: right;">{{ $t('admin.tied_value') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in deadStock" :key="p.id">
            <td>
              <button class="ac-link-name" style="background: none; border: none; cursor: pointer; padding: 0; font: inherit;" @click="navigateTo(localePath(`/admin/products?edit=${p.id}`))">
                {{ locale === 'el' ? p.name_el : p.name_en }}
              </button>
            </td>
            <td class="ac-mono" style="text-align: right;">{{ p.stock }}</td>
            <td class="ac-mono" style="text-align: right;">{{ money(p.value) }}</td>
          </tr>
        </tbody>
      </table>
      <div v-else class="ac-empty" style="padding: 24px 0;">{{ $t('admin.no_dead_stock') }} ✓</div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

const api = useApi()
const { t, locale } = useI18n()
const localePath = useLocalePath()
const { currencySymbol } = useCurrency()

type RangePayload = { from: string; to: string; granularity: 'day' | 'week' | 'month'; compare: boolean }
interface ProdRow { id: string; name_el: string; name_en: string; units: number; revenue: number; profit: number; has_cost: boolean }
interface Overview {
  summary: { revenue: number; orders: number; units: number; aov: number; profit: number; margin: number | null;
    revenue_change: number; orders_change: number; units_change: number; aov_change: number; profit_change: number }
  series: { labels: string[]; revenue: number[]; prevRevenue?: number[] }
  top_by_units: ProdRow[]; top_by_revenue: ProdRow[]; top_by_profit: ProdRow[]
  dead_stock: { id: string; name_el: string; name_en: string; stock: number; value: number }[]
  stock_value_retail: number; stock_value_cost: number
  category_mix: { name_el: string; name_en: string; revenue: number; units: number }[]
  brand_mix: { brand: string; revenue: number; units: number }[]
}

const range = ref<RangePayload | null>(null)
function onRange(r: RangePayload) { range.value = r }

const { data, pending } = useAsyncData<Overview | null>('admin-analytics', () => {
  if (!range.value) return Promise.resolve(null)
  return api<Overview>(`/admin/analytics`, {
    query: { from: range.value.from, to: range.value.to, granularity: range.value.granularity, compare: range.value.compare },
  })
}, { server: false, watch: [range] })

const DONUT_COLORS = ['#C97B5A', '#A8B89A', '#D4A24C', '#5A8FC9', '#6BAE7E', '#B57BA6', '#D67E6B']

const money = (n: number) => `${currencySymbol.value}${Math.round(n).toLocaleString('el-GR')}`
const num = (n: number) => Math.round(n).toLocaleString('el-GR')

// ── KPI cards ──
const kpiCards = computed(() => {
  const s = data.value?.summary
  const marginTxt = s?.margin == null ? '—' : `${(s.margin * 100).toFixed(1)}%`
  return [
    { label: t('admin.kpi_revenue'), value: money(s?.revenue ?? 0), delta: s?.revenue_change ?? null, sub: t('admin.vs_prev'), info: t('admin.revenue_info'),
      iconBg: 'rgba(201,123,90,0.12)', iconColor: '#C97B5A', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M18 7a7 7 0 1 0 0 10"/><path d="M3 10h10M3 14h10"/></svg>' },
    { label: t('admin.kpi_orders'), value: num(s?.orders ?? 0), delta: s?.orders_change ?? null, sub: t('admin.vs_prev'), info: '',
      iconBg: 'rgba(168,184,154,0.15)', iconColor: '#A8B89A', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h2l2 12h12l2-8H7"/><circle cx="9" cy="20" r="1.25"/><circle cx="18" cy="20" r="1.25"/></svg>' },
    { label: t('admin.kpi_aov'), value: money(s?.aov ?? 0), delta: s?.aov_change ?? null, sub: t('admin.vs_prev'), info: '',
      iconBg: 'rgba(90,143,201,0.12)', iconColor: '#5A8FC9', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l6-6 4 4 7-7"/><path d="M14 8h6v6"/></svg>' },
    { label: t('admin.kpi_units'), value: num(s?.units ?? 0), delta: s?.units_change ?? null, sub: t('admin.vs_prev'), info: '',
      iconBg: 'rgba(212,162,76,0.15)', iconColor: '#D4A24C', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8 12 3 3 8v8l9 5 9-5V8z"/><path d="M3 8l9 5 9-5"/></svg>' },
    { label: t('admin.kpi_profit'), value: `${money(s?.profit ?? 0)} · ${marginTxt}`, delta: s?.profit_change ?? null, sub: t('admin.vs_prev'), info: t('admin.profit_info'),
      iconBg: 'rgba(107,174,126,0.15)', iconColor: '#6BAE7E', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>' },
  ]
})

// ── Revenue chart ──
const revData = computed(() => {
  const s = data.value?.series
  if (!s?.labels?.length) return []
  return s.labels.map((_, i) => {
    const row: Record<string, number> = { current: s.revenue[i] ?? 0 }
    if (s.prevRevenue) row.previous = s.prevRevenue[i] ?? 0
    return row
  })
})
const revCategories = computed(() => {
  const base: Record<string, { name: string; color: string }> = { current: { name: t('admin.revenue'), color: '#C97B5A' } }
  if (data.value?.series?.prevRevenue) base.previous = { name: t('admin.prev_period'), color: '#9CA3AF' }
  return base
})
function xFormatter(_: number | Date, i?: number) {
  const l = data.value?.series?.labels?.[i ?? 0] ?? ''
  return l.length === 7 ? l : l.slice(5) // month "YYYY-MM" full, else "MM-DD"
}
const granLabel = computed(() => {
  const g = range.value?.granularity
  return g === 'month' ? t('admin.gran_month') : g === 'week' ? t('admin.gran_week') : t('admin.gran_day')
})

// ── Category donut ──
const categoryMix = computed(() => data.value?.category_mix ?? [])
const catTotal = computed(() => categoryMix.value.reduce((a, b) => a + b.revenue, 0) || 1)
const catArcs = computed(() => {
  const R = 64, r = 42, cx = 90, cy = 90
  let acc = -Math.PI / 2
  const total = catTotal.value
  return categoryMix.value.map((d, i) => {
    const frac = d.revenue / total
    const a0 = acc, a1 = acc + frac * Math.PI * 2
    acc = a1
    const large = a1 - a0 > Math.PI ? 1 : 0
    const x0 = cx + R * Math.cos(a0), y0 = cy + R * Math.sin(a0)
    const x1 = cx + R * Math.cos(a1), y1 = cy + R * Math.sin(a1)
    const x2 = cx + r * Math.cos(a1), y2 = cy + r * Math.sin(a1)
    const x3 = cx + r * Math.cos(a0), y3 = cy + r * Math.sin(a0)
    return {
      path: `M${x0.toFixed(2)} ${y0.toFixed(2)} A${R} ${R} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} L${x2.toFixed(2)} ${y2.toFixed(2)} A${r} ${r} 0 ${large} 0 ${x3.toFixed(2)} ${y3.toFixed(2)} Z`,
      color: DONUT_COLORS[i % DONUT_COLORS.length],
    }
  })
})

// ── Brand bars ──
const brandMix = computed(() => data.value?.brand_mix ?? [])
const brandMax = computed(() => Math.max(1, ...brandMix.value.map((b) => b.revenue)))

// ── Top sellers ──
const metric = ref<'units' | 'revenue' | 'profit'>('revenue')
const topList = computed<ProdRow[]>(() => {
  if (!data.value) return []
  if (metric.value === 'units') return data.value.top_by_units
  if (metric.value === 'profit') return data.value.top_by_profit
  return data.value.top_by_revenue
})
function metricVal(p: ProdRow) { return p[metric.value] as number }
const topMax = computed(() => Math.max(1, ...topList.value.map(metricVal)))

// ── Dead stock + inventory value ──
const deadStock = computed(() => data.value?.dead_stock ?? [])
const stockRetail = computed(() => data.value?.stock_value_retail ?? 0)
const stockCost = computed(() => data.value?.stock_value_cost ?? 0)
</script>
