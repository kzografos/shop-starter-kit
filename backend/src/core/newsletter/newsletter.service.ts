import { ForbiddenException, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createHmac, timingSafeEqual } from 'crypto'
import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { MailService } from '../../infrastructure/mail/mail.service'

@Injectable()
export class NewsletterService {
  constructor(
    private prisma: PrismaService,
    private mail: MailService,
    private config: ConfigService,
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
      this.mail.sendWelcomeEmail(email, this.unsubscribeUrl(email)).catch(() => null)
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

  /**
   * Removes a subscriber, but only for the holder of that address's
   * unsubscribe link. The token is an HMAC of the address, so a link can be
   * verified without storing anything and stays valid for as long as the
   * secret does; a wrong token is refused before the database is touched, and
   * the answer never says whether the address was subscribed.
   */
  async unsubscribe(email: string, token: string) {
    if (!this.verifyUnsubscribeToken(email, token)) throw new ForbiddenException('Invalid unsubscribe link')
    try {
      await this.prisma.newsletterSubscriber.delete({ where: { email } })
    } catch {
      // record not found — ignore (a repeated click on the same link)
    }
    return { ok: true }
  }

  /** The link placed in newsletter emails: address plus its proof of ownership. */
  unsubscribeUrl(email: string): string {
    return `${this.mail.brand.siteUrl}/unsubscribe?email=${encodeURIComponent(email)}&token=${this.unsubscribeToken(email)}`
  }

  unsubscribeToken(email: string): string {
    return createHmac('sha256', this.config.getOrThrow<string>('JWT_SECRET'))
      .update(`newsletter-unsubscribe:${email.trim().toLowerCase()}`)
      .digest('base64url')
  }

  private verifyUnsubscribeToken(email: string, token: string): boolean {
    const expected = Buffer.from(this.unsubscribeToken(email))
    const given = Buffer.from(String(token ?? ''))
    return given.length === expected.length && timingSafeEqual(given, expected)
  }
}
