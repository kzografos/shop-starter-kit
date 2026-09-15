import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { MailService } from '../mail/mail.service'

@Injectable()
export class NewsletterService {
  constructor(
    private prisma: PrismaService,
    private mail: MailService,
  ) {}

  async subscribe(email: string) {
    const existing = await this.prisma.newsletterSubscriber.findUnique({ where: { email } })
    await this.prisma.newsletterSubscriber.upsert({
      where: { email },
      update: {},
      create: { email },
    })
    // Only-new: send the welcome email once, on first subscribe.
    if (!existing) {
      this.mail.sendWelcomeEmail(email).catch(() => null)
    }
    return { ok: true }
  }

  // Admin list. Moved unchanged from AdminService.getNewsletter().
  listSubscribers() {
    return this.prisma.newsletterSubscriber.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, email: true, createdAt: true },
    })
  }

  async unsubscribe(email: string) {
    try {
      await this.prisma.newsletterSubscriber.delete({ where: { email } })
    } catch {
      // record not found — ignore
    }
    return { ok: true }
  }
}
