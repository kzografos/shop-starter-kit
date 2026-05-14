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
}
