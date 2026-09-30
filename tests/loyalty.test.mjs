// Shop loyalty view of the Core profile (app/modules/ecommerce/utils/loyalty.ts): the balance is a
// user-extension field Core does not name; absent or malformed reads as 0.
import { loyaltyPointsOf } from '../app/modules/ecommerce/utils/loyalty.ts'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const core = { id: 'u1', email: 'a@b.c', full_name: null, phone: null, role: 'customer', permissions: [], created_at: '2026-09-18T00:00:00Z' }

test('reads loyalty_points off the profile payload', () => {
  assert.equal(loyaltyPointsOf({ ...core, loyalty_points: 1250 }), 1250)
  assert.equal(loyaltyPointsOf({ ...core, loyalty_points: 0 }), 0)
})

test('no profile (guest, not loaded) → 0', () => {
  assert.equal(loyaltyPointsOf(null), 0)
  assert.equal(loyaltyPointsOf(undefined), 0)
})

test('profile without the extension (loyalty module absent) → 0, not NaN', () => {
  assert.equal(loyaltyPointsOf(core), 0)
})

test('malformed extension value never leaks into arithmetic', () => {
  assert.equal(loyaltyPointsOf({ ...core, loyalty_points: '12' }), 0)
  assert.equal(loyaltyPointsOf({ ...core, loyalty_points: NaN }), 0)
  assert.equal(loyaltyPointsOf({ ...core, loyalty_points: null }), 0)
})
