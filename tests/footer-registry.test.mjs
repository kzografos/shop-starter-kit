// Footer registry pure helper (app/utils/footer-registry.ts): column order,
// item grouping, item order, unknown-column fallback, empty input. Plain Node
// test runner:  pnpm test
import { footerColumns } from '../app/utils/footer-registry.ts'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const C = (id, order, labelKey = `footer.${id}`) => ({ id, labelKey, order })
const I = (column, order, extra = {}) => ({ column, labelKey: `${column}.${order}`, order, ...extra })

const columns = [C('info', 40), C('shop', 20), C('account', 30)]
const items = [
  I('account', 20, { to: '/account/orders' }),
  I('shop', 10, { to: '/products' }),
  I('account', 10, { to: '/account' }),
  I('info', 30, { icon: 'i-heroicons-truck' }), // no `to`: plain text
  I('info', 10, { to: '/about' }),
  I('account', 30, { to: '/account/loyalty' }),
  I('info', 20, { to: '/contact' }),
]

test('columns come back sorted by order', () => {
  assert.deepEqual(footerColumns(columns, items).map((c) => c.id), ['shop', 'account', 'info'])
})

test('items are grouped under the column they name', () => {
  const byId = Object.fromEntries(footerColumns(columns, items).map((c) => [c.id, c.items.map((i) => i.to ?? i.labelKey)]))
  assert.deepEqual(byId.shop, ['/products'])
  assert.deepEqual(byId.account, ['/account', '/account/orders', '/account/loyalty'])
  assert.deepEqual(byId.info, ['/about', '/contact', 'info.30'])
})

test('items inside a column are sorted by order, whatever order they were contributed in', () => {
  const account = footerColumns(columns, items).find((c) => c.id === 'account')
  assert.deepEqual(account.items.map((i) => i.order), [10, 20, 30])
  const shuffled = footerColumns(columns, [...items].reverse())
  assert.deepEqual(shuffled.find((c) => c.id === 'info').items.map((i) => i.order), [10, 20, 30])
})

test('an item naming an unknown column joins the first column (same fallback as groupAdminSections)', () => {
  const out = footerColumns(columns, [...items, I('nope', 5, { to: '/orphan' })])
  const shop = out.find((c) => c.id === 'shop')
  assert.deepEqual(shop.items.map((i) => i.to), ['/orphan', '/products'])
  assert.equal(out.flatMap((c) => c.items).length, items.length + 1, 'nothing is dropped')
})

test('column and item contracts survive: `to` and `icon` are passed through untouched', () => {
  const info = footerColumns(columns, items).find((c) => c.id === 'info')
  const plain = info.items.at(-1)
  assert.equal(plain.to, undefined)
  assert.equal(plain.icon, 'i-heroicons-truck')
  assert.equal(info.labelKey, 'footer.info')
})

test('empty or missing input is safe', () => {
  assert.deepEqual(footerColumns([], []), [])
  assert.deepEqual(footerColumns(undefined, undefined), [])
  assert.deepEqual(footerColumns(columns, []), [], 'columns with no items are omitted')
  assert.deepEqual(footerColumns(undefined, items), [], 'items with no declared column render nothing')
  assert.deepEqual(footerColumns([C('only', 1)], undefined), [])
})

test('the input arrays are not mutated', () => {
  const cols = [C('b', 20), C('a', 10)]
  const its = [I('a', 20), I('a', 10)]
  footerColumns(cols, its)
  assert.deepEqual(cols.map((c) => c.id), ['b', 'a'])
  assert.deepEqual(its.map((i) => i.order), [20, 10])
})
