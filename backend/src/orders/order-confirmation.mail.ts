import type { MailMessage, MailService } from '../mail/mail.service'

/**
 * Order-confirmation email. Owned by the orders module; Core's MailService
 * only supplies branding, the shared layout and the transport.
 *
 * Moved verbatim from MailService.sendOrderConfirmation(): subject and HTML
 * are byte-identical to what was sent before.
 */
export function orderConfirmationMail(mail: MailService, to: string, orderId: string): MailMessage {
  const { name: brandName, color: brandColor } = mail.brand
  const shortId = orderId.slice(0, 8).toUpperCase()
  const content = `
      <p style="margin:0 0 8px;">Your order <strong style="color:${brandColor};">#${shortId}</strong> has been confirmed.</p>
      <p style="margin:0;">Thank you for shopping with ${brandName}!</p>`
  return { to, subject: `Order confirmed — ${brandName}`, html: mail.renderLayout(content) }
}
