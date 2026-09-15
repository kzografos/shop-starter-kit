import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { RedisService } from '../redis/redis.service'
import { PaymentStatus } from '@prisma/client'
import { MEMBER_ROLE } from '../auth/permissions'

const CACHE_TTL = 300 // 5 min
type Granularity = 'day' | 'week' | 'month'

type OrderRow = { total: unknown; createdAt: Date }
type ItemRow = {
  productId: string | null
  quantity: number
  unitPrice: unknown
  product: { nameEl: string; nameEn: string; brand: string | null; categoryId: string | null; cost: unknown } | null
}

@Injectable()
export class AnalyticsService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async overview(fromISO: string, toISO: string, granularity: Granularity, compare: boolean) {
    const from = new Date(fromISO)
    const to = new Date(toISO)
    const key = `analytics:${fromISO}:${toISO}:${granularity}:${compare}`
    const cached = await this.redis.get(key)
    if (cached) return JSON.parse(cached)

    const result = await this.compute(from, to, granularity, compare)
    await this.redis.set(key, JSON.stringify(result), CACHE_TTL)
    return result
  }

  private paidWhere(from: Date, to: Date) {
    return { paymentStatus: PaymentStatus.PAID, createdAt: { gte: from, lte: to } }
  }

  private async fetchPeriod(from: Date, to: Date) {
    const [orders, items] = await Promise.all([
      this.prisma.order.findMany({ where: this.paidWhere(from, to), select: { total: true, createdAt: true } }),
      this.prisma.orderItem.findMany({
        where: { order: this.paidWhere(from, to) },
        select: {
          productId: true,
          quantity: true,
          unitPrice: true,
          product: { select: { nameEl: true, nameEn: true, brand: true, categoryId: true, cost: true } },
        },
      }),
    ])
    return { orders: orders as OrderRow[], items: items as ItemRow[] }
  }

  private summarize(orders: OrderRow[], items: ItemRow[]) {
    const revenue = orders.reduce((s, o) => s + Number(o.total), 0)
    const orderCount = orders.length
    let units = 0
    let costedMerch = 0
    let cogs = 0
    for (const it of items) {
      const line = it.quantity * Number(it.unitPrice)
      units += it.quantity
      if (it.product?.cost != null) {
        costedMerch += line
        cogs += it.quantity * Number(it.product.cost)
      }
    }
    const profit = costedMerch - cogs
    return {
      revenue,
      orders: orderCount,
      units,
      aov: orderCount ? revenue / orderCount : 0,
      profit,
      // null when no product in range has a cost recorded yet
      margin: costedMerch > 0 ? profit / costedMerch : null,
    }
  }

  private async compute(from: Date, to: Date, granularity: Granularity, compare: boolean) {
    const span = to.getTime() - from.getTime()
    const prevTo = new Date(from.getTime() - 1)
    const prevFrom = new Date(from.getTime() - span)

    const [cur, prev, categories, products] = await Promise.all([
      this.fetchPeriod(from, to),
      this.fetchPeriod(prevFrom, prevTo),
      this.prisma.category.findMany({ select: { id: true, nameEl: true, nameEn: true, parentId: true } }),
      this.prisma.product.findMany({
        where: { isActive: true },
        select: { id: true, nameEl: true, nameEn: true, stock: true, price: true, cost: true },
      }),
    ])

    const summary = this.summarize(cur.orders, cur.items)
    const prevSummary = this.summarize(prev.orders, prev.items)
    const pct = (c: number, p: number) => (p > 0 ? Math.round(((c - p) / p) * 1000) / 10 : c > 0 ? 100 : 0)

    // ── Revenue time-series (zero-filled buckets) ──
    const labels = bucketLabels(from, to, granularity)
    const idx = new Map(labels.map((l, i) => [l, i]))
    const revenue = new Array(labels.length).fill(0)
    for (const o of cur.orders) {
      const i = idx.get(bucketKey(o.createdAt, granularity))
      if (i !== undefined) revenue[i] += Number(o.total)
    }
    let prevRevenue: number[] | undefined
    if (compare) {
      const prevLabels = bucketLabels(prevFrom, prevTo, granularity)
      const tmp = new Array(prevLabels.length).fill(0)
      const pidx = new Map(prevLabels.map((l, i) => [l, i]))
      for (const o of prev.orders) {
        const i = pidx.get(bucketKey(o.createdAt, granularity))
        if (i !== undefined) tmp[i] += Number(o.total)
      }
      // Align to current bucket count for index-based overlay.
      prevRevenue = labels.map((_, i) => tmp[i] ?? 0)
    }

    // ── Per-product aggregation ──
    const prodMap = new Map<string, { name_el: string; name_en: string; units: number; revenue: number; profit: number; has_cost: boolean }>()
    const soldIds = new Set<string>()
    for (const it of cur.items) {
      if (!it.productId || !it.product) continue
      soldIds.add(it.productId)
      const line = it.quantity * Number(it.unitPrice)
      const hasCost = it.product.cost != null
      const lineProfit = hasCost ? it.quantity * (Number(it.unitPrice) - Number(it.product.cost)) : 0
      const cur2 = prodMap.get(it.productId)
      if (cur2) {
        cur2.units += it.quantity
        cur2.revenue += line
        cur2.profit += lineProfit
        cur2.has_cost = cur2.has_cost && hasCost
      } else {
        prodMap.set(it.productId, {
          name_el: it.product.nameEl,
          name_en: it.product.nameEn,
          units: it.quantity,
          revenue: line,
          profit: lineProfit,
          has_cost: hasCost,
        })
      }
    }
    const prods = Array.from(prodMap.entries()).map(([id, v]) => ({ id, ...v }))
    const topByUnits = [...prods].sort((a, b) => b.units - a.units).slice(0, 10)
    const topByRevenue = [...prods].sort((a, b) => b.revenue - a.revenue).slice(0, 10)
    const topByProfit = prods.filter((p) => p.has_cost).sort((a, b) => b.profit - a.profit).slice(0, 10)

    // ── Dead stock + inventory value (whole active catalog) ──
    const deadStock = products
      .filter((p) => p.stock > 0 && !soldIds.has(p.id))
      .map((p) => ({ id: p.id, name_el: p.nameEl, name_en: p.nameEn, stock: p.stock, value: p.stock * Number(p.price) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 20)
    const stockValueRetail = products.reduce((s, p) => s + p.stock * Number(p.price), 0)
    const stockValueCost = products.reduce((s, p) => s + (p.cost != null ? p.stock * Number(p.cost) : 0), 0)

    // ── Category mix (rolled up to top-level animal) ──
    const catMap = new Map(categories.map((c) => [c.id, c]))
    const topLevel = (catId: string | null): { id: string; name_el: string; name_en: string } | null => {
      let node = catId ? catMap.get(catId) : undefined
      let guard = 0
      while (node?.parentId && guard++ < 3) node = catMap.get(node.parentId)
      return node ? { id: node.id, name_el: node.nameEl, name_en: node.nameEn } : null
    }
    const categoryAgg = new Map<string, { name_el: string; name_en: string; revenue: number; units: number }>()
    const brandAgg = new Map<string, { revenue: number; units: number }>()
    for (const it of cur.items) {
      if (!it.product) continue
      const line = it.quantity * Number(it.unitPrice)
      const top = topLevel(it.product.categoryId)
      const cKey = top?.id ?? '_uncat'
      const c = categoryAgg.get(cKey)
      if (c) { c.revenue += line; c.units += it.quantity }
      else categoryAgg.set(cKey, { name_el: top?.name_el ?? 'Χωρίς κατηγορία', name_en: top?.name_en ?? 'Uncategorized', revenue: line, units: it.quantity })

      const bKey = it.product.brand || '_none'
      const b = brandAgg.get(bKey)
      if (b) { b.revenue += line; b.units += it.quantity }
      else brandAgg.set(bKey, { revenue: line, units: it.quantity })
    }
    const categoryMix = Array.from(categoryAgg.values()).sort((a, b) => b.revenue - a.revenue)
    const brandMix = Array.from(brandAgg.entries())
      .map(([brand, v]) => ({ brand: brand === '_none' ? '—' : brand, ...v }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)

    return {
      summary: {
        ...summary,
        revenue_change: pct(summary.revenue, prevSummary.revenue),
        orders_change: pct(summary.orders, prevSummary.orders),
        units_change: pct(summary.units, prevSummary.units),
        aov_change: pct(summary.aov, prevSummary.aov),
        profit_change: pct(summary.profit, prevSummary.profit),
      },
      series: { labels, revenue, prevRevenue },
      top_by_units: topByUnits,
      top_by_revenue: topByRevenue,
      top_by_profit: topByProfit,
      dead_stock: deadStock,
      stock_value_retail: stockValueRetail,
      stock_value_cost: stockValueCost,
      category_mix: categoryMix,
      brand_mix: brandMix,
    }
  }

  // ── Dashboard (moved unchanged from AdminService.getStats) ────

  async dashboardStats() {
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)

    const prevMonthStart = new Date(monthStart)
    prevMonthStart.setMonth(prevMonthStart.getMonth() - 1)

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29)
    thirtyDaysAgo.setHours(0, 0, 0, 0)

    const [
      revenueAll,
      revenueMonth,
      totalCustomers,
      newCustomers,
      recentOrders,
      last30Orders,
      statusGroups,
      topProductRows,
      lowStock,
      prevMonthRevenue,
      prevMonthNewCustomers,
    ] = await Promise.all([
      this.prisma.order.aggregate({
        _sum: { total: true },
        where: { paymentStatus: PaymentStatus.PAID },
      }),
      this.prisma.order.aggregate({
        _sum: { total: true },
        where: { paymentStatus: PaymentStatus.PAID, createdAt: { gte: monthStart } },
      }),
      this.prisma.user.count({ where: { role: MEMBER_ROLE } }),
      this.prisma.user.count({ where: { role: MEMBER_ROLE, createdAt: { gte: monthStart } } }),
      this.prisma.order.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, status: true, total: true, createdAt: true },
      }),
      this.prisma.order.findMany({
        where: { paymentStatus: PaymentStatus.PAID, createdAt: { gte: thirtyDaysAgo } },
        select: { createdAt: true, total: true },
      }),
      this.prisma.order.groupBy({ by: ['status'], _count: { _all: true } }),
      // Top sellers, aggregated in the database.
      //
      // This was findMany({ take: 500 }) with no orderBy and no filter, summed
      // in JS: an arbitrary 500 rows in whatever order Postgres returned them,
      // across all time and including unpaid orders. Past 500 line items ever
      // sold the figures were simply wrong, and the card is labelled "by units
      // sold this month".
      this.prisma.orderItem.groupBy({
        by: ['productId'],
        where: {
          productId: { not: null },
          order: { paymentStatus: PaymentStatus.PAID, createdAt: { gte: monthStart } },
        },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 5,
      }),
      this.prisma.product.findMany({
        where: { stock: { lt: 5 } },
        orderBy: { stock: 'asc' },
        take: 8,
        select: { id: true, nameEl: true, stock: true },
      }),
      this.prisma.order.aggregate({
        _sum: { total: true },
        where: {
          paymentStatus: PaymentStatus.PAID,
          createdAt: { gte: prevMonthStart, lt: monthStart },
        },
      }),
      this.prisma.user.count({
        where: { role: MEMBER_ROLE, createdAt: { gte: prevMonthStart, lt: monthStart } },
      }),
    ])

    const pctChange = (cur: number, prev: number) =>
      prev > 0 ? Math.round(((cur - prev) / prev) * 1000) / 10 : cur > 0 ? 100 : 0

    // groupBy cannot join, so resolve the five names in one follow-up query.
    const topProductIds = topProductRows.map((r) => r.productId).filter((id): id is string => !!id)
    const topProductNames = topProductIds.length
      ? await this.prisma.product.findMany({
          where: { id: { in: topProductIds } },
          select: { id: true, nameEl: true },
        })
      : []
    const nameById = new Map(topProductNames.map((p) => [p.id, p.nameEl]))

    return {
      totalRevenue: Number(revenueAll._sum.total ?? 0),
      monthRevenue: Number(revenueMonth._sum.total ?? 0),
      monthRevenueChange: pctChange(Number(revenueMonth._sum.total ?? 0), Number(prevMonthRevenue._sum.total ?? 0)),
      totalCustomers,
      newCustomers,
      newCustomersChange: pctChange(newCustomers, prevMonthNewCustomers),
      recentOrders,
      last30Days: last30Orders.map((o) => ({
        date: o.createdAt.toISOString().slice(0, 10),
        total: Number(o.total),
      })),
      orderStatusBreakdown: statusGroups.map((g) => ({
        status: g.status,
        count: g._count._all,
      })),
      topProducts: topProductRows.map((row) => ({
        // Falls back to the id if the product has since been deleted.
        name: nameById.get(row.productId!) ?? row.productId!,
        units: row._sum.quantity ?? 0,
      })),
      lowStock: lowStock.map((p) => ({ id: p.id, nameEl: p.nameEl, stock: p.stock })),
    }
  }
}

// ── Bucket helpers ──
function bucketKey(date: Date, gran: Granularity): string {
  const d = new Date(date)
  if (gran === 'month') return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
  if (gran === 'week') {
    const day = (d.getUTCDay() + 6) % 7 // Monday = 0
    d.setUTCDate(d.getUTCDate() - day)
    return d.toISOString().slice(0, 10)
  }
  return d.toISOString().slice(0, 10)
}

function bucketLabels(from: Date, to: Date, gran: Granularity): string[] {
  const out: string[] = []
  const d = new Date(from)
  if (gran === 'month') {
    d.setUTCDate(1)
    while (d <= to) {
      out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`)
      d.setUTCMonth(d.getUTCMonth() + 1)
    }
  } else if (gran === 'week') {
    const day = (d.getUTCDay() + 6) % 7
    d.setUTCDate(d.getUTCDate() - day)
    while (d <= to) {
      out.push(d.toISOString().slice(0, 10))
      d.setUTCDate(d.getUTCDate() + 7)
    }
  } else {
    while (d <= to) {
      out.push(d.toISOString().slice(0, 10))
      d.setUTCDate(d.getUTCDate() + 1)
    }
  }
  return out
}
