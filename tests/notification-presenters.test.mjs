// Notification presenter registry (app/core/utils/notification-presenters.ts) and the
// shop's order_status presenter (app/modules/ecommerce/utils/order-notification-presenter.ts).
// Core phrases nothing itself; a module registers how its rows read.
import { describeNotification, registerNotificationPresenter, registeredNotificationTypes } from '../app/core/utils/notification-presenters.ts'
import { orderStatusPresenter } from '../app/modules/ecommerce/utils/order-notification-presenter.ts'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const t = (key, values) => (values && 'order' in values ? `${key}|${values.order}` : key)
const localePath = (p) => `/el${p}`
const ctx = { t, localePath }
const row = (type, meta, extra = {}) => ({ id: 'n1', type, user_id: 'u1', key: null, product_id: null, stock: null, meta, is_read: false, created_at: '2026-09-18T00:00:00Z', ...extra })
const ORDER = '0f9a1b2c-3d4e-4f60-8a71-92b3c4d5e6f7'

test('unregistered type: generic title, empty body, no destination (never blank)', () => {
  assert.deepEqual(describeNotification(row('something_new', null), ctx), { title: 'notifications.generic_title', body: '', to: null })
})

test('order_status before registration falls back too — Core has no built-in order wording', () => {
  assert.ok(!registeredNotificationTypes().includes('order_status'))
  assert.equal(describeNotification(row('order_status', { order_id: ORDER, status: 'confirmed' }), ctx).title, 'notifications.generic_title')
})

test('registering the shop presenter routes order_status rows through it', () => {
  registerNotificationPresenter('order_status', orderStatusPresenter)
  assert.deepEqual(registeredNotificationTypes(), ['order_status'])
  const v = describeNotification(row('order_status', { order_id: ORDER, status: 'confirmed' }), ctx)
  assert.deepEqual(v, {
    title: 'notifications.order_confirmed_title',
    body: `notifications.order_confirmed_body|#${ORDER.slice(0, 8).toUpperCase()}`,
    to: `/el/account/orders/${ORDER}`,
  })
})

test('every known status has its own key; status case is normalised', () => {
  for (const s of ['confirmed', 'processing', 'ready', 'completed', 'cancelled']) {
    const v = describeNotification(row('order_status', { order_id: ORDER, status: s.toUpperCase() }), ctx)
    assert.equal(v.title, `notifications.order_${s}_title`)
    assert.equal(v.body, `notifications.order_${s}_body|#${ORDER.slice(0, 8).toUpperCase()}`)
  }
})

test('unknown status keeps the generic order line and still links the order', () => {
  const v = describeNotification(row('order_status', { order_id: ORDER, status: 'refunded' }), ctx)
  assert.equal(v.title, 'notifications.order_status_title')
  assert.equal(v.body, `notifications.order_status_body|#${ORDER.slice(0, 8).toUpperCase()}`)
  assert.equal(v.to, `/el/account/orders/${ORDER}`)
})

test('missing or malformed meta: no destination, empty order reference, no throw', () => {
  assert.deepEqual(describeNotification(row('order_status', null), ctx), { title: 'notifications.order_status_title', body: 'notifications.order_status_body|', to: null })
  assert.equal(describeNotification(row('order_status', { order_id: 42, status: 7 }), ctx).to, null)
})

test('a presenter that throws falls back to the generic line instead of breaking the header', () => {
  registerNotificationPresenter('explosive', () => { throw new Error('boom') })
  assert.deepEqual(describeNotification(row('explosive', null), ctx), { title: 'notifications.generic_title', body: '', to: null })
})

test('registering a type again replaces the presenter (project layer may override wording)', () => {
  registerNotificationPresenter('order_status', () => ({ title: 'custom', body: '', to: null }))
  assert.equal(describeNotification(row('order_status', { order_id: ORDER, status: 'confirmed' }), ctx).title, 'custom')
  registerNotificationPresenter('order_status', orderStatusPresenter)
})
