import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class NewsletterService {
  constructor(private prisma: PrismaService) {}

  async subscribe(email: string) {
    await this.prisma.newsletterSubscriber.upsert({
      where: { email },
      update: {},
      create: { email },
    })
    return { ok: true }
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
