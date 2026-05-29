import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { MailService } from '../mail/mail.service'
import { CreateOrderDto } from './dto/create-order.dto'
import { Decimal } from '@prisma/client/runtime/library'

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private mail: MailService,
  ) {}

  async create(userId: string | null, userEmail: string | null, dto: CreateOrderDto) {
    // Guest checkout: must supply an email for the order confirmation.
    const guestEmail = userId ? null : dto.guestEmail
    if (!userId && !guestEmail)
      throw new BadRequestException('Email is required to place an order as a guest')
    const confirmationEmail = userEmail ?? guestEmail!
    // Capture as const so TS narrows it inside the transaction closure below.
    const uid = userId

    // Load settings
    const settings = await this.prisma.setting.findMany()
    const s = Object.fromEntries(settings.map((r) => [r.key, parseFloat(r.value)]))

    // Load user for loyalty check (logged-in only)
    const user = userId
      ? await this.prisma.user.findUniqueOrThrow({ where: { id: userId } })
      : null

    // Validate loyalty points — guests cannot redeem
    const pointsToRedeem = user ? (dto.loyaltyPointsToRedeem ?? 0) : 0
    if (pointsToRedeem > 0) {
      if (pointsToRedeem < s.loyalty_min_redeem)
        throw new BadRequestException(`Minimum ${s.loyalty_min_redeem} points to redeem`)
      if (pointsToRedeem > user!.loyaltyPoints)
        throw new BadRequestException('Insufficient loyalty points')
    }

    // Load products and verify stock + prices
    const productIds = dto.items.map((i) => i.productId)
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, isActive: true },
    })

    if (products.length !== productIds.length)
      throw new BadRequestException('One or more products not found or inactive')

    // Calculate server-side totals
    let subtotal = 0
    for (const item of dto.items) {
      const product = products.find((p) => p.id === item.productId)!
      subtotal += Number(product.price) * item.quantity
    }

    const shippingCost =
      dto.fulfillmentType === 'PICKUP' ? 0
      : subtotal >= s.free_shipping_threshold ? 0
      : s.shipping_cost

    const loyaltyDiscount = pointsToRedeem / s.loyalty_redeem_rate
    const total = Math.max(0, subtotal + shippingCost - loyaltyDiscount)

    // Create order + items + loyalty in a transaction
    const order = await this.prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          userId,
          guestEmail,
          fulfillmentType: dto.fulfillmentType,
          paymentMethod: dto.paymentMethod,
          subtotal,
          shippingCost,
          loyaltyDiscount,
          total,
          shippingAddress: dto.shippingAddress ? { ...dto.shippingAddress } : undefined,
          notes: dto.notes,
          status: 'PENDING',
          paymentStatus: 'PENDING',
        },
      })

      // Decrement stock + create items
      for (const item of dto.items) {
        const product = products.find((p) => p.id === item.productId)!
        const updated = await tx.product.updateMany({
          where: { id: item.productId, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        })
        if (updated.count === 0)
          throw new BadRequestException(`Insufficient stock for: ${product.nameEn}`)

        await tx.orderItem.create({
          data: {
            orderId: newOrder.id,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: Number(product.price),
            productName: product.nameEl || product.nameEn,
            productPrice: Number(product.price),
          },
        })
      }

      // Loyalty: redeem (logged-in only — guests can't redeem)
      if (uid && pointsToRedeem > 0) {
        await tx.loyaltyTransaction.create({
          data: { userId: uid, orderId: newOrder.id, pointsDelta: -pointsToRedeem, type: 'REDEEM' },
        })
        await tx.user.update({
          where: { id: uid },
          data: { loyaltyPoints: { decrement: pointsToRedeem } },
        })
      }

      // Non-Stripe orders are settled immediately (cash/card on pickup).
      // Stripe orders are confirmed on webhook instead.
      if (dto.paymentMethod !== 'STRIPE') {
        // Loyalty: earn (logged-in only — Stripe earns on webhook)
        if (uid) {
          const pointsEarned = Math.floor(total * s.loyalty_earn_rate)
          await tx.loyaltyTransaction.create({
            data: { userId: uid, orderId: newOrder.id, pointsDelta: pointsEarned, type: 'EARN' },
          })
          await tx.user.update({
            where: { id: uid },
            data: { loyaltyPoints: { increment: pointsEarned } },
          })
        }
        await tx.order.update({
          where: { id: newOrder.id },
          data: { status: 'CONFIRMED', paymentStatus: 'PAID' },
        })
      }

      return newOrder
    })

    this.mail.sendOrderConfirmation(confirmationEmail, order.id).catch(() => null)

    return { id: order.id }
  }

  async findByUser(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      include: {
        items: {
          select: {
            id: true,
            productId: true,
            productName: true,
            productPrice: true,
            quantity: true,
            unitPrice: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async findOneForUser(orderId: string, userId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: {
        items: {
          select: {
            id: true,
            productId: true,
            productName: true,
            productPrice: true,
            quantity: true,
            unitPrice: true,
          },
        },
      },
    })
    if (!order) throw new NotFoundException('Order not found')
    return order
  }
}
