import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Resend } from 'resend'
import * as nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'
import { isMailConfigured } from '../core/config/env.validation'

export interface MailMessage {
  to: string
  subject: string
  html: string
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name)
  private readonly from: string
  private readonly brandName: string
  private readonly brandColor: string
  private readonly brandLogoUrl: string
  private readonly siteUrl: string
  private readonly transport: 'smtp' | 'resend'
  // False when no usable transport is configured: sends are rejected with a
  // clear error (callers already log and continue) instead of boot failing.
  readonly isEnabled: boolean
  private resend?: Resend
  private smtp?: Transporter

  constructor(private config: ConfigService) {
    this.from = config.get('EMAIL_FROM', 'Sample Store <orders@example.com>')
    this.brandName = config.get('BRAND_NAME', 'Sample Store')
    // BRAND_COLOR is a literal hex — email clients can't read CSS vars, so this
    // intentionally duplicates the app's brand.css --brand-primary.
    this.brandColor = config.get('BRAND_COLOR', '#c97b5a')
    this.brandLogoUrl = config.get('BRAND_LOGO_URL', '')
    // Reuse NUXT_URL as the site/base URL; SITE_URL can override it.
    this.siteUrl = config.get('SITE_URL', config.get('NUXT_URL', 'http://localhost:3000'))
    // Default 'resend' when unset → prod-safe. The kit ships MAIL_TRANSPORT=smtp
    // in .env.example so a fresh clone catches mail locally (Mailpit).
    this.transport = config.get('MAIL_TRANSPORT', 'resend') === 'smtp' ? 'smtp' : 'resend'

    this.isEnabled = isMailConfigured(config)
    if (!this.isEnabled) {
      this.logger.warn(
        'Mail not configured (MAIL_TRANSPORT=resend without RESEND_API_KEY) — password reset, order and welcome emails will not be sent',
      )
    } else if (this.transport === 'smtp') {
      const host = config.get('SMTP_HOST', 'localhost')
      const port = Number(config.get('SMTP_PORT', 1025))
      // Mailpit accepts unauthenticated mail — no auth in dev.
      this.smtp = nodemailer.createTransport({ host, port, secure: false })
      this.logger.log(`Mail transport: SMTP ${host}:${port}`)
    } else {
      this.resend = new Resend(config.getOrThrow('RESEND_API_KEY'))
      this.logger.log('Mail transport: Resend')
    }
  }

  /** Branding values a module-owned template may use. Read-only. */
  get brand(): { name: string; color: string; logoUrl: string; siteUrl: string } {
    return { name: this.brandName, color: this.brandColor, logoUrl: this.brandLogoUrl, siteUrl: this.siteUrl }
  }

  // Primary-button inline style (reused by reset + welcome CTAs).
  buttonStyle(): string {
    return `display:inline-block;background-color:${this.brandColor};color:#ffffff;text-decoration:none;font-weight:600;padding:12px 28px;border-radius:8px;font-size:15px;`
  }

  // Shared branded shell — table-based, inline styles only (Gmail/Outlook-safe).
  renderLayout(content: string, opts?: { unsubscribeUrl?: string }): string {
    const year = new Date().getFullYear()
    const header = this.brandLogoUrl
      ? `<img src="${this.brandLogoUrl}" alt="${this.brandName}" height="40" style="display:block;margin:0 auto;border:0;">`
      : `<span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">${this.brandName}</span>`
    const unsubscribe = opts?.unsubscribeUrl
      ? `<br><a href="${opts.unsubscribeUrl}" style="color:#8a7d6d;">Unsubscribe</a>`
      : ''
    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#f4ede1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4ede1;padding:24px 0;"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background-color:#ffffff;border-radius:12px;overflow:hidden;">
<tr><td style="background-color:${this.brandColor};padding:28px 32px;text-align:center;">${header}</td></tr>
<tr><td style="padding:32px;color:#33302b;font-size:16px;line-height:1.6;">${content}</td></tr>
<tr><td style="padding:20px 32px 28px;text-align:center;border-top:1px solid #eeeeee;color:#8a7d6d;font-size:13px;line-height:1.5;">© ${year} ${this.brandName}${unsubscribe}</td></tr>
</table></td></tr></table></body></html>`
  }

  private async send(to: string, subject: string, html: string) {
    if (!this.isEnabled) throw new Error('Mail transport is not configured')
    if (this.transport === 'smtp') {
      return this.smtp!.sendMail({ from: this.from, to, subject, html })
    }
    return this.resend!.emails.send({ from: this.from, to, subject, html })
  }

  /**
   * Sends a fully rendered message. Never throws: a failed send is logged as
   * `<label> failed`, exactly as the per-template methods have always done, so
   * a mail outage cannot fail the caller's request. Modules own their
   * templates (subject + html) and call this.
   */
  async sendMail(message: MailMessage, label = 'Email'): Promise<void> {
    await this.send(message.to, message.subject, message.html)
      .catch((err) => this.logger.error(`${label} failed`, err))
  }

  async sendPasswordReset(to: string, token: string) {
    const link = `${this.siteUrl}/reset-password?token=${token}`
    const content = `
      <p style="margin:0 0 18px;">You requested a password reset.</p>
      <p style="margin:0 0 26px;"><a href="${link}" style="${this.buttonStyle()}">Reset your password</a></p>
      <p style="margin:0;color:#8a7d6d;font-size:14px;">This link expires in 1 hour. If you didn't request this, you can ignore this email.</p>`
    await this.send(to, `Reset your ${this.brandName} password`, this.renderLayout(content))
      .catch((err) => this.logger.error('Password reset email failed', err))
  }

  async sendWelcomeEmail(to: string, unsubscribeUrl: string) {
    const content = `
      <p style="margin:0 0 16px;">Thanks for subscribing to ${this.brandName}!</p>
      <p style="margin:0 0 26px;">You'll be first to hear about new arrivals and exclusive offers.</p>
      <p style="margin:0;"><a href="${this.siteUrl}" style="${this.buttonStyle()}">Start shopping →</a></p>`
    await this.send(to, `Welcome to ${this.brandName}`, this.renderLayout(content, { unsubscribeUrl }))
      .catch((err) => this.logger.error('Welcome email failed', err))
  }
}
