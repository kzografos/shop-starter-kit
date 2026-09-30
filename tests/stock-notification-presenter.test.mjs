// The shop's stock-alert presenters (app/modules/ecommerce/utils/stock-notification-presenter.ts)
// behind the Core staff inbox: the inbox names no row type, so how a
// `low_stock` / `out_of_stock` row reads is entirely the shop's.
import { describeNotification, registerNotificationPresenter } from '../app/core/utils/notification-presenters.ts'
import { lowStockPresenter, outOfStockPresenter } from '../app/modules/ecommerce/utils/stock-notification-presenter.ts'
import { test } from 'node:test'
import assert from 'node:assert/strict'

// `t` echoes its values so the assertions see exactly what reaches the message.
const t = (key, values) => (values ? `${key}|${JSON.stringify(values)}` : key)
// Greek is the default locale (unprefixed); English is prefixed.
const ctxFor = (locale) => ({ t, localePath: (p) => (locale === 'el' ? p : `/${locale}${p}`), locale })
const en = ctxFor('en')
const el = ctxFor('el')
const PRODUCT = '7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f'
const NAMES = { name_el: 'Τροφή σκύλου', name_en: 'Dog food' }
const row = (type, extra = {}) => ({ id: 'n1', type, user_id: null, key: null, product_id: PRODUCT, stock: 3, meta: NAMES, is_read: false, created_at: '2026-09-28T00:00:00Z', ...extra })

test('before the shop registers, stock rows get the generic line: no tone (default icon), no action', () => {
  assert.deepEqual(describeNotification(row('low_stock'), en), { title: 'notifications.generic_title', body: '', to: null })
  assert.deepEqual(describeNotification(row('out_of_stock'), en), { title: 'notifications.generic_title', body: '', to: null })
})

test('registered as plugins/stock-notifications.ts does, the inbox rows route through the shop presenters', () => {
  registerNotificationPresenter('low_stock', lowStockPresenter)
  registerNotificationPresenter('out_of_stock', outOfStockPresenter)
  assert.equal(describeNotification(row('low_stock'), en).title, 'ecommerce.admin.low_stock_title')
  assert.equal(describeNotification(row('out_of_stock'), en).title, 'ecommerce.admin.out_of_stock_title')
})

test('low_stock in English: English name, stock level, warning tone, localised product action', () => {
  assert.deepEqual(describeNotification(row('low_stock'), en), {
    title: 'ecommerce.admin.low_stock_title',
    body: 'ecommerce.admin.low_stock_msg|{"name":"Dog food","stock":3}',
    tone: 'warning',
    to: `/en/admin/products?edit=${PRODUCT}`,
    actionLabel: 'ecommerce.admin.view_product',
  })
})

test('low_stock in Greek: Greek name, unprefixed product action', () => {
  assert.deepEqual(describeNotification(row('low_stock'), el), {
    title: 'ecommerce.admin.low_stock_title',
    body: 'ecommerce.admin.low_stock_msg|{"name":"Τροφή σκύλου","stock":3}',
    tone: 'warning',
    to: `/admin/products?edit=${PRODUCT}`,
    actionLabel: 'ecommerce.admin.view_product',
  })
})

test('out_of_stock in English: name only, danger tone', () => {
  assert.deepEqual(describeNotification(row('out_of_stock', { stock: 0 }), en), {
    title: 'ecommerce.admin.out_of_stock_title',
    body: 'ecommerce.admin.out_of_stock_msg|{"name":"Dog food"}',
    tone: 'danger',
    to: `/en/admin/products?edit=${PRODUCT}`,
    actionLabel: 'ecommerce.admin.view_product',
  })
})

test('out_of_stock in Greek', () => {
  assert.deepEqual(describeNotification(row('out_of_stock', { stock: 0 }), el), {
    title: 'ecommerce.admin.out_of_stock_title',
    body: 'ecommerce.admin.out_of_stock_msg|{"name":"Τροφή σκύλου"}',
    tone: 'danger',
    to: `/admin/products?edit=${PRODUCT}`,
    actionLabel: 'ecommerce.admin.view_product',
  })
})

test('a missing name in the active locale falls back to the other one, then to —', () => {
  assert.equal(describeNotification(row('low_stock', { meta: { name_el: 'Τροφή σκύλου' } }), en).body, 'ecommerce.admin.low_stock_msg|{"name":"Τροφή σκύλου","stock":3}')
  assert.equal(describeNotification(row('low_stock', { meta: { name_en: 'Dog food' } }), el).body, 'ecommerce.admin.low_stock_msg|{"name":"Dog food","stock":3}')
  assert.equal(describeNotification(row('low_stock', { meta: null }), en).body, 'ecommerce.admin.low_stock_msg|{"name":"—","stock":3}')
  assert.equal(describeNotification(row('out_of_stock', { meta: {} }), el).body, 'ecommerce.admin.out_of_stock_msg|{"name":"—"}')
})

test('a missing stock level reads as 0', () => {
  assert.equal(describeNotification(row('low_stock', { stock: null }), en).body, 'ecommerce.admin.low_stock_msg|{"name":"Dog food","stock":0}')
})

test('no product_id: no destination and no action label, tone kept', () => {
  for (const type of ['low_stock', 'out_of_stock']) {
    const v = describeNotification(row(type, { product_id: null }), en)
    assert.equal(v.to, null)
    assert.ok(!('actionLabel' in v))
    assert.equal(v.tone, type === 'out_of_stock' ? 'danger' : 'warning')
  }
})
