// Permission Registry outputs, pinned. Builds the registry the way Nest does at
// boot — Core's constructor contribution plus every registrar's onModuleInit —
// against the compiled output, and asserts the exact arrays the guard,
// /profile and the staff list see. A moved or edited preset/capability must
// change this file on purpose.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { PermissionsRegistryService } = require('../dist/core/auth/permissions.registry.service.js')
const { AnalyticsPermissions } = require('../dist/modules/ecommerce/analytics/analytics-permissions.js')
const { OrdersPermissions } = require('../dist/modules/ecommerce/orders/orders-permissions.js')
const { CatalogPermissions } = require('../dist/modules/ecommerce/products/catalog-permissions.js')
const { EcommercePermissions, SHOP_ROLE_PRESETS } = require('../dist/modules/ecommerce/ecommerce-permissions.js')

// Registrars in an order that differs from the module import order on purpose:
// outputs must not depend on which module initialises first.
const boot = (order = [CatalogPermissions, EcommercePermissions, OrdersPermissions, AnalyticsPermissions]) => {
  const registry = new PermissionsRegistryService()
  for (const Registrar of order) new Registrar(registry).onModuleInit()
  registry.validate()
  return registry
}

const ADMIN = [
  'view:finance', // analytics (order 10)
  'view:orders', 'manage:orders', // orders (20)
  'view:catalog', 'manage:catalog', 'manage:inventory', // catalog (30)
  'view:customers', 'manage:marketing', 'manage:settings', 'manage:staff', 'view:notifications', 'manage:media', // core (40)
]

test('owner sees every capability in contribution order', () => {
  const r = boot()
  assert.deepEqual(r.permissionsFor('admin'), ADMIN)
  assert.deepEqual(r.allCapabilities(), ADMIN)
})

test('accountant preset is exactly view:finance, view:orders', () => {
  assert.deepEqual(boot().permissionsFor('accountant'), ['view:finance', 'view:orders'])
})

test('stock_manager preset is exactly the five catalogue/inbox/media capabilities, in this order', () => {
  assert.deepEqual(boot().permissionsFor('stock_manager'), ['view:catalog', 'manage:catalog', 'manage:inventory', 'view:notifications', 'manage:media'])
})

test('customer, unknown and missing roles hold nothing', () => {
  const r = boot()
  assert.deepEqual(r.permissionsFor('customer'), [])
  assert.deepEqual(r.permissionsFor('nobody'), [])
  assert.deepEqual(r.permissionsFor(null), [])
  assert.deepEqual(r.permissionsFor(undefined), [])
})

test('staff roles are the owner plus the two shop presets, in registration order', () => {
  assert.deepEqual(boot().staffRoles(), ['admin', 'accountant', 'stock_manager'])
  assert.deepEqual(Object.keys(SHOP_ROLE_PRESETS), ['accountant', 'stock_manager'])
})

test('registrar initialisation order does not change any output', () => {
  const a = boot([AnalyticsPermissions, OrdersPermissions, CatalogPermissions, EcommercePermissions])
  const b = boot([EcommercePermissions, CatalogPermissions, AnalyticsPermissions, OrdersPermissions])
  for (const role of ['admin', 'accountant', 'stock_manager', 'customer']) assert.deepEqual(a.permissionsFor(role), b.permissionsFor(role))
  assert.deepEqual(a.staffRoles(), b.staffRoles())
  assert.deepEqual(a.allCapabilities(), b.allCapabilities())
})

test('presets are owned by the shop root: orders registers capabilities only', () => {
  const registry = new PermissionsRegistryService()
  new OrdersPermissions(registry).onModuleInit()
  assert.deepEqual(registry.staffRoles(), ['admin'])
  assert.ok(registry.allCapabilities().includes('view:orders'))
})

test('duplicate preset registration fails boot', () => {
  const r = boot()
  assert.throws(() => new EcommercePermissions(r).onModuleInit(), /Role preset "accountant" is already registered/)
})

test('a preset naming an unregistered capability fails validation', () => {
  const registry = new PermissionsRegistryService()
  new EcommercePermissions(registry).onModuleInit() // references view:finance etc., not registered yet
  assert.throws(() => registry.validate(), /references unregistered capability/)
})
