import { Resend } from 'resend'

let _resend: Resend | null = null

function getResend() {
  if (!_resend) {
    const config = useRuntimeConfig()
    _resend = new Resend(config.resendApiKey)
  }
  return _resend
}

export interface OrderEmailData {
  orderId: string
  customerEmail: string
  customerName?: string
  items: Array<{ name: string; quantity: number; unitPrice: number }>
  subtotal: number
  shippingCost: number
  loyaltyDiscount: number
  total: number
  fulfillmentType: 'shipping' | 'pickup'
  shippingAddress?: {
    full_name: string
    address: string
    city: string
    postal_code: string
    phone: string
  } | null
}

export async function sendOrderConfirmation(data: OrderEmailData) {
  const config = useRuntimeConfig()

  // Skip silently if no API key configured (dev without Resend)
  if (!config.resendApiKey || config.resendApiKey === 're_REPLACE_ME') return

  const shortId = data.orderId.slice(0, 8).toUpperCase()
  const itemRows = data.items
    .map(
      (i) => `
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;color:#374151;">${i.name}</td>
        <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;text-align:center;color:#6b7280;">×${i.quantity}</td>
        <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;text-align:right;color:#374151;font-weight:600;">€${(i.unitPrice * i.quantity).toFixed(2)}</td>
      </tr>`,
    )
    .join('')

  const addressBlock =
    data.fulfillmentType === 'shipping' && data.shippingAddress
      ? `
      <p style="margin:4px 0;color:#374151;">${data.shippingAddress.full_name}</p>
      <p style="margin:4px 0;color:#374151;">${data.shippingAddress.address}</p>
      <p style="margin:4px 0;color:#374151;">${data.shippingAddress.city} ${data.shippingAddress.postal_code}</p>
      <p style="margin:4px 0;color:#374151;">Tel: ${data.shippingAddress.phone}</p>`
      : `<p style="color:#374151;">Παραλαβή από κατάστημα / Store pickup</p>`

  const html = `
<!DOCTYPE html>
<html lang="el">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 8px rgba(0,0,0,0.08);">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#fb923c 0%,#ef4444 100%);padding:32px 32px 24px;">
      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">PetShop CY</h1>
      <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">Παραγγελία #${shortId} επιβεβαιώθηκε ✓</p>
    </div>

    <!-- Body -->
    <div style="padding:32px;">
      <p style="margin:0 0 24px;color:#374151;">Γεια σας${data.customerName ? ` ${data.customerName}` : ''},</p>
      <p style="margin:0 0 24px;color:#374151;">Η παραγγελία σας ελήφθη και επεξεργάζεται. Σας ευχαριστούμε!</p>

      <!-- Items -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
        <thead>
          <tr>
            <th style="text-align:left;font-size:12px;color:#9ca3af;font-weight:600;padding-bottom:8px;border-bottom:2px solid #f3f4f6;">ΠΡΟΪΟΝ</th>
            <th style="text-align:center;font-size:12px;color:#9ca3af;font-weight:600;padding-bottom:8px;border-bottom:2px solid #f3f4f6;">ΤΕΜ.</th>
            <th style="text-align:right;font-size:12px;color:#9ca3af;font-weight:600;padding-bottom:8px;border-bottom:2px solid #f3f4f6;">ΣΥΝΟΛΟ</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>

      <!-- Totals -->
      <div style="background:#f9fafb;border-radius:8px;padding:16px;margin-bottom:24px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
          <span style="color:#6b7280;font-size:14px;">Υποσύνολο</span>
          <span style="color:#374151;font-size:14px;">€${data.subtotal.toFixed(2)}</span>
        </div>
        ${data.shippingCost > 0 ? `
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
          <span style="color:#6b7280;font-size:14px;">Αποστολή</span>
          <span style="color:#374151;font-size:14px;">€${data.shippingCost.toFixed(2)}</span>
        </div>` : `
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
          <span style="color:#6b7280;font-size:14px;">Αποστολή</span>
          <span style="color:#16a34a;font-size:14px;font-weight:600;">Δωρεάν</span>
        </div>`}
        ${data.loyaltyDiscount > 0 ? `
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
          <span style="color:#6b7280;font-size:14px;">Έκπτωση πόντων</span>
          <span style="color:#16a34a;font-size:14px;">−€${data.loyaltyDiscount.toFixed(2)}</span>
        </div>` : ''}
        <div style="display:flex;justify-content:space-between;border-top:1px solid #e5e7eb;padding-top:10px;margin-top:10px;">
          <span style="color:#111827;font-size:16px;font-weight:700;">Σύνολο</span>
          <span style="color:#f97316;font-size:16px;font-weight:700;">€${data.total.toFixed(2)}</span>
        </div>
      </div>

      <!-- Delivery -->
      <div style="border:1px solid #e5e7eb;border-radius:8px;padding:16px;">
        <p style="margin:0 0 8px;font-weight:600;color:#111827;font-size:14px;">
          ${data.fulfillmentType === 'shipping' ? '🚚 Διεύθυνση Αποστολής' : '🏪 Παραλαβή από Κατάστημα'}
        </p>
        ${addressBlock}
      </div>
    </div>

    <!-- Footer -->
    <div style="padding:20px 32px;background:#f9fafb;border-top:1px solid #f3f4f6;text-align:center;">
      <p style="margin:0;font-size:12px;color:#9ca3af;">PetShop CY &bull; Cyprus &bull; info@petshopcyprus.com</p>
    </div>
  </div>
</body>
</html>`

  const resend = getResend()
  await resend.emails.send({
    from: config.emailFrom as string,
    to: data.customerEmail,
    subject: `Παραγγελία #${shortId} επιβεβαιώθηκε ✓ — PetShop CY`,
    html,
  })
}
