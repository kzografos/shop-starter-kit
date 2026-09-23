<template>
  <div class="ac-card ac-daterange">
    <div class="ac-dr-presets">
      <button
        v-for="p in presets"
        :key="p.key"
        class="ac-filter-tab"
        :class="{ active: active === p.key }"
        @click="selectPreset(p.key)"
      >{{ p.label }}</button>
    </div>

    <div v-if="active === 'custom'" class="ac-dr-custom">
      <input v-model="customFrom" type="date" class="ac-dr-date" @change="applyCustom" >
      <span style="color: var(--ac-text-muted);">—</span>
      <input v-model="customTo" type="date" class="ac-dr-date" @change="applyCustom" >
    </div>

    <div class="ac-dr-right">
      <div class="ac-filter-tabs">
        <button
          v-for="g in grans"
          :key="g.key"
          class="ac-filter-tab"
          :class="{ active: granularity === g.key }"
          @click="setGran(g.key)"
        >{{ g.label }}</button>
      </div>
      <label class="ac-dr-compare">
        <input v-model="compare" type="checkbox" @change="emitChange" >
        <span>{{ $t('admin.compare_prev') }}</span>
      </label>
    </div>
  </div>
</template>

<script setup lang="ts">
type Gran = 'day' | 'week' | 'month'
type PresetKey =
  | 'today' | '7d' | '30d' | 'this_month' | 'last_month'
  | 'this_quarter' | 'last_quarter' | 'ytd' | 'custom'

const emit = defineEmits<{
  change: [payload: { from: string; to: string; granularity: Gran; compare: boolean }]
}>()

const { t } = useI18n()

const presets = computed<{ key: PresetKey; label: string }[]>(() => [
  { key: 'today', label: t('admin.range_today') },
  { key: '7d', label: t('admin.range_7d') },
  { key: '30d', label: t('admin.range_30d') },
  { key: 'this_month', label: t('admin.range_this_month') },
  { key: 'last_month', label: t('admin.range_last_month') },
  { key: 'this_quarter', label: t('admin.range_this_quarter') },
  { key: 'last_quarter', label: t('admin.range_last_quarter') },
  { key: 'ytd', label: t('admin.range_ytd') },
  { key: 'custom', label: t('admin.range_custom') },
])
const grans: { key: Gran; label: string }[] = [
  { key: 'day', label: t('admin.gran_day') },
  { key: 'week', label: t('admin.gran_week') },
  { key: 'month', label: t('admin.gran_month') },
]

const active = ref<PresetKey>('30d')
const granularity = ref<Gran>('day')
const compare = ref(false)
const customFrom = ref(toInput(addDays(startOfToday(), -29)))
const customTo = ref(toInput(new Date()))

function startOfToday() { const d = new Date(); d.setHours(0, 0, 0, 0); return d }
function endOfToday() { const d = new Date(); d.setHours(23, 59, 59, 999); return d }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x }
function toInput(d: Date) { return d.toISOString().slice(0, 10) }

// Pick a sensible granularity for a span, in days.
function suggestGran(days: number): Gran {
  if (days <= 31) return 'day'
  if (days <= 120) return 'week'
  return 'month'
}

function rangeFor(key: PresetKey): { from: Date; to: Date } {
  const now = new Date()
  const y = now.getFullYear()
  const to = endOfToday()
  switch (key) {
    case 'today': return { from: startOfToday(), to }
    case '7d': return { from: addDays(startOfToday(), -6), to }
    case '30d': return { from: addDays(startOfToday(), -29), to }
    case 'this_month': return { from: new Date(y, now.getMonth(), 1), to }
    case 'last_month': return {
      from: new Date(y, now.getMonth() - 1, 1),
      to: new Date(y, now.getMonth(), 0, 23, 59, 59, 999),
    }
    case 'this_quarter': {
      const q = Math.floor(now.getMonth() / 3)
      return { from: new Date(y, q * 3, 1), to }
    }
    case 'last_quarter': {
      const q = Math.floor(now.getMonth() / 3)
      const startMonth = q * 3 - 3
      const from = new Date(y, startMonth, 1)
      const end = new Date(y, startMonth + 3, 0, 23, 59, 59, 999)
      return { from, to: end }
    }
    case 'ytd': return { from: new Date(y, 0, 1), to }
    case 'custom': return {
      from: new Date(`${customFrom.value}T00:00:00`),
      to: new Date(`${customTo.value}T23:59:59.999`),
    }
  }
}

function currentRange() {
  return rangeFor(active.value)
}

function selectPreset(key: PresetKey) {
  active.value = key
  if (key !== 'custom') {
    const { from, to } = rangeFor(key)
    const days = Math.round((to.getTime() - from.getTime()) / 86_400_000)
    granularity.value = suggestGran(days)
  }
  emitChange()
}
function applyCustom() {
  if (!customFrom.value || !customTo.value) return
  const { from, to } = rangeFor('custom')
  granularity.value = suggestGran(Math.round((to.getTime() - from.getTime()) / 86_400_000))
  emitChange()
}
function setGran(g: Gran) { granularity.value = g; emitChange() }

function emitChange() {
  const { from, to } = currentRange()
  emit('change', {
    from: from.toISOString(),
    to: to.toISOString(),
    granularity: granularity.value,
    compare: compare.value,
  })
}

onMounted(emitChange)
</script>
