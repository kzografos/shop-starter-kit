import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Resend } from 'resend'

@Injectable()
export class MailService {
  private resend: Resend
  private from: string
  private readonly logger = new Logger(MailService.name)

  constructor(private config: ConfigService) {
    this.resend = new Resend(config.getOrThrow('RESEND_API_KEY'))
    this.from = config.get('EMAIL_FROM', 'PetShop CY <orders@petshopcyprus.com>')
  }

  async sendPasswordReset(to: string, token: string) {
    const nuxtUrl = this.config.get('NUXT_URL', 'http://localhost:3000')
    const link = `${nuxtUrl}/reset-password?token=${token}`

    await this.resend.emails
      .send({
        from: this.from,
        to,
        subject: 'Reset your PetShop CY password',
        html: `
          <p>You requested a password reset.</p>
          <p><a href="${link}">Click here to reset your password</a></p>
          <p>This link expires in 1 hour. If you did not request this, ignore this email.</p>
        `,
      })
      .catch((err) => this.logger.error('Password reset email failed', err))
  }

  async sendOrderConfirmation(to: string, orderId: string) {
    await this.resend.emails
      .send({
        from: this.from,
        to,
        subject: 'Order confirmed — PetShop CY',
        html: `<p>Your order <strong>#${orderId.slice(0, 8).toUpperCase()}</strong> has been confirmed. Thank you!</p>`,
      })
      .catch((err) => this.logger.error('Order confirmation email failed', err))
  }
}
