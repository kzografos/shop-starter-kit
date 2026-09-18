// Registry-driven settings form helpers (app/utils/settings-form.ts): which
// fields render, in which cards, initial values, and the PATCH body.
//   pnpm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderableDefinitions, settingsCards, initialFormValues, patchBody } from '../app/utils/settings-form.ts'

const D = (o) => ({ type: 'number', default: '1', group: 'g', label_key: 'l', ...o })
const groups = [
  { id: 'loyalty', label_key: 'admin.loyalty_settings', order: 20 },
  { id: 'shipping', label_key: 'admin.shipping_settings', description_key: 'admin.shipping_settings_sub', icon: 'cart', order: 10 },
]
const definitions = [
  D({ key: 'loyalty_min_redeem', group: 'loyalty', order: 30, default: '500' }),
  D({ key: 'free_shipping_threshold', group: 'shipping', order: 20, default: '50.00', unit: '€', step: 0.01 }),
  D({ key: 'shipping_cost', group: 'shipping', order: 10, default: '5.00', unit: '€', min: 0 }),
  D({ key: 'loyalty_earn_rate', group: 'loyalty', order: 10, default: '100' }),
  D({ key: 'loyalty_redeem_rate', group: 'loyalty', order: 20, default: '100', min: 1 }),
]
const payload = { groups, definitions, values: { shipping_cost: '7.5', free_shipping_threshold: '200', loyalty_earn_rate: '100', loyalty_redeem_rate: '100', loyalty_min_redeem: '500' } }
const keys = (list) => list.map((d) => d.key).join(',')

test('renderableDefinitions keeps number/string definitions and drops malformed ones', () => {
  const out = renderableDefinitions([...definitions, D({ key: '', group: 'g' }), D({ key: 'flag', type: 'boolean' }), null, undefined, { type: 'number' }])
  assert.equal(out.length, 5)
  assert.deepEqual(renderableDefinitions(undefined), [])
})

test('settingsCards: groups in order, fields in order, empty groups dropped', () => {
  const cards = settingsCards(payload)
  assert.deepEqual(cards.map((c) => c.id), ['shipping', 'loyalty'])
  assert.equal(keys(cards[0].fields), 'shipping_cost,free_shipping_threshold')
  assert.equal(keys(cards[1].fields), 'loyalty_earn_rate,loyalty_redeem_rate,loyalty_min_redeem')
  assert.equal(cards[0].icon, 'cart')
  assert.equal(settingsCards({ groups, definitions: [] }).length, 0)
  assert.equal(settingsCards(null).length, 0)
})

test('settingsCards: a definition with an unknown group gets a trailing card labelled by the group id', () => {
  const cards = settingsCards({ groups, definitions: [...definitions, D({ key: 'x', group: 'ops' })] })
  assert.deepEqual(cards.map((c) => c.id), ['shipping', 'loyalty', 'ops'])
  assert.equal(cards[2].label_key, 'ops')
  assert.equal(keys(cards[2].fields), 'x')
})

test('initialFormValues: stored values typed per definition; default when a value is missing', () => {
  const form = initialFormValues(payload)
  assert.deepEqual(form, { shipping_cost: 7.5, free_shipping_threshold: 200, loyalty_earn_rate: 100, loyalty_redeem_rate: 100, loyalty_min_redeem: 500 })
  const partial = initialFormValues({ definitions, values: { shipping_cost: '9' } })
  assert.equal(partial.shipping_cost, 9)
  assert.equal(partial.loyalty_min_redeem, 500)
  const str = initialFormValues({ definitions: [D({ key: 'note', type: 'string', default: 'hi' })], values: {} })
  assert.equal(str.note, 'hi')
  assert.deepEqual(initialFormValues(null), {})
})

test('patchBody: editable renderable keys only, unknown form keys and non-editable definitions excluded', () => {
  const defs = [...definitions, D({ key: 'locked', editable: false, default: '42' })]
  const body = patchBody(defs, { shipping_cost: 6, free_shipping_threshold: 60, loyalty_earn_rate: 1, loyalty_redeem_rate: 2, loyalty_min_redeem: 3, locked: 1, stray: 9 })
  assert.deepEqual(Object.keys(body).sort(), ['free_shipping_threshold', 'loyalty_earn_rate', 'loyalty_min_redeem', 'loyalty_redeem_rate', 'shipping_cost'])
  assert.equal(body.shipping_cost, 6)
  assert.deepEqual(patchBody(undefined, { a: 1 }), {})
  assert.deepEqual(patchBody(definitions, {}), {})
})
