import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { PaymentStatus } from '@prisma/client'

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getStats() {
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
      this.prisma.user.count({ where: { role: 'CUSTOMER' } }),
      this.prisma.user.count({ where: { role: 'CUSTOMER', createdAt: { gte: monthStart } } }),
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
        where: { role: 'CUSTOMER', createdAt: { gte: prevMonthStart, lt: monthStart } },
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
