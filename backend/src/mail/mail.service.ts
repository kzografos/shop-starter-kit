import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Resend } from 'resend'
import * as nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name)
  private readonly from: string
  private readonly brandName: string
  private readonly transport: 'smtp' | 'resend'
  private resend?: Resend
  private smtp?: Transporter

  constructor(private config: ConfigService) {
    this.from = config.get('EMAIL_FROM', 'Sample Store <orders@example.com>')
    this.brandName = config.get('BRAND_NAME', 'Sample Store')
    // Default 'resend' when unset → prod-safe. The kit ships MAIL_TRANSPORT=smtp
    // in .env.example so a fresh clone catches mail locally (Mailpit).
    this.transport = config.get('MAIL_TRANSPORT', 'resend') === 'smtp' ? 'smtp' : 'resend'

    if (this.transport === 'smtp') {
      const host = config.get('SMTP_HOST', 'localhost')
      const port = Number(config.get('SMTP_PORT', 1025))
      // Mailpit accepts unauthenticated mail — no auth in dev.
      this.smtp = nodemailer.createTransport({ host, port, secure: false })
      this.logger.log(`Mail transport: SMTP ${host}:${port}`)
    } else {
      // Lazy Resend init — only when actually using it, so smtp/dev boots
      // without a RESEND_API_KEY.
      this.resend = new Resend(config.getOrThrow('RESEND_API_KEY'))
      this.logger.log('Mail transport: Resend')
    }
  }

  private async send(to: string, subject: string, html: string) {
    if (this.transport === 'smtp') {
      return this.smtp!.sendMail({ from: this.from, to, subject, html })
    }
    return this.resend!.emails.send({ from: this.from, to, subject, html })
  }

  async sendPasswordReset(to: string, token: string) {
    const nuxtUrl = this.config.get('NUXT_URL', 'http://localhost:3000')
    const link = `${nuxtUrl}/reset-password?token=${token}`

    await this.send(
      to,
      `Reset your ${this.brandName} password`,
      `
          <p>You requested a password reset.</p>
          <p><a href="${link}">Click here to reset your password</a></p>
          <p>This link expires in 1 hour. If you did not request this, ignore this email.</p>
        `,
    ).catch((err) => this.logger.error('Password reset email failed', err))
  }

  async sendOrderConfirmation(to: string, orderId: string) {
    await this.send(
      to,
      `Order confirmed — ${this.brandName}`,
      `<p>Your order <strong>#${orderId.slice(0, 8).toUpperCase()}</strong> has been confirmed. Thank you!</p>`,
    ).catch((err) => this.logger.error('Order confirmation email failed', err))
  }
}
