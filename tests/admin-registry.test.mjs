// Admin Registry pure helpers (app/utils/admin-registry.ts): validation,
// visibility, grouping, route matching, landing page. Plain Node test runner:
//   pnpm test   (node --experimental-strip-types --test tests/)
import { validAdminSections, visibleAdminSections, groupAdminSections, matchAdminSection, requiredAdminCapability, firstAllowedAdminPath, isActiveAdminSection } from '../app/utils/admin-registry.ts'
import { test } from 'node:test'
import assert from 'node:assert/strict'
const check = (name, ok, detail = '') => test(name, () => assert.ok(ok, detail))

const S = (o) => ({ labelKey: 'x', icon: 'box', ...o })
const registry = [
  S({ id: 'dashboard', path: '/admin', capability: 'view:finance', order: 0, activeMatch: 'exact' }),
  S({ id: 'analytics', path: '/admin/analytics', capability: 'view:finance', order: 10 }),
  S({ id: 'products', path: '/admin/products', capability: 'view:catalog', order: 20 }),
  S({ id: 'categories', path: '/admin/categories', capability: 'view:catalog', order: 30 }),
  S({ id: 'orders', path: '/admin/orders', capability: 'view:orders', order: 40 }),
  S({ id: 'notifications', path: '/admin/notifications', capability: 'view:notifications', order: 50, badgeStateKey: 'admin-notif-unread' }),
  S({ id: 'customers', path: '/admin/customers', capability: 'view:customers', order: 60, group: 'workspace' }),
  S({ id: 'newsletter', path: '/admin/newsletter', capability: 'manage:marketing', order: 70, group: 'workspace' }),
  S({ id: 'staff', path: '/admin/staff', capability: 'manage:staff', order: 80, group: 'workspace' }),
  S({ id: 'settings', path: '/admin/settings', capability: 'manage:settings', order: 90, group: 'workspace' }),
]
const groups = [{ id: 'main', order: 10 }, { id: 'workspace', order: 20, labelKey: 'admin.group_workspace' }]
const canOf = (caps) => (c) => caps.includes(c)
const OWNER = canOf(['view:finance', 'view:catalog', 'manage:catalog', 'manage:inventory', 'view:orders', 'manage:orders', 'view:customers', 'manage:marketing', 'manage:settings', 'manage:staff', 'view:notifications', 'manage:media'])
const STOCK = canOf(['view:catalog', 'manage:catalog', 'manage:inventory', 'view:notifications', 'manage:media'])
const ACCOUNTANT = canOf(['view:finance', 'view:orders'])
const CUSTOMER = canOf([])
const ids = (list) => list.map((s) => s.id).join(',')

// validation
{ const bad = [
    S({ id: '', path: '/admin/x', capability: 'a', order: 1 }),
    S({ id: 'nopath', capability: 'a', order: 1 }),
    S({ id: 'nocap', path: '/admin/y', order: 1 }),
    { id: 'noicon', path: '/admin/z', labelKey: 'x', capability: 'a', order: 1 },
    S({ id: 'outside', path: '/shop', capability: 'a', order: 1 }),
    S({ id: 'products', path: '/admin/dup', capability: 'a', order: 1 }),
    S({ id: 'off', path: '/admin/off', capability: 'a', order: 1, enabled: false }),
    null, undefined, 42,
  ]
  const reasons = []
  const valid = validAdminSections([...registry, ...bad], (_, r) => reasons.push(r))
  check('invalid entries dropped (empty id, no path, no capability, no icon, path outside /admin, duplicate id, null/undefined/number), enabled:false skipped silently', ids(valid) === ids(registry) && reasons.length === 9, `${valid.length} valid, reasons: ${reasons.join(' | ')}`)
  check('empty and undefined registries → []', validAdminSections([]).length === 0 && validAdminSections(undefined).length === 0)
  const shuffled = validAdminSections([registry[9], registry[2], registry[0], registry[5]])
  check('sorted by order regardless of declaration order', ids(shuffled) === 'dashboard,products,notifications,settings') }

// visibility
{ check('owner sees every section', ids(visibleAdminSections(registry, OWNER)) === ids(registry))
  check('stock manager: products, categories, notifications only', ids(visibleAdminSections(registry, STOCK)) === 'products,categories,notifications')
  check('accountant: dashboard, analytics, orders only', ids(visibleAdminSections(registry, ACCOUNTANT)) === 'dashboard,analytics,orders')
  check('no capabilities → nothing', visibleAdminSections(registry, CUSTOMER).length === 0)
  check('a section needing a capability nobody registers is hidden for everyone', visibleAdminSections([S({ id: 'x', path: '/admin/x', capability: 'view:unknown', order: 1 })], OWNER).length === 0) }

// grouping
{ const g = groupAdminSections(visibleAdminSections(registry, OWNER), groups)
  check('owner: two groups in order, main unlabeled, workspace labeled', g.length === 2 && g[0].id === 'main' && !g[0].labelKey && g[1].id === 'workspace' && g[1].labelKey === 'admin.group_workspace' && ids(g[0].sections) === 'dashboard,analytics,products,categories,orders,notifications' && ids(g[1].sections) === 'customers,newsletter,staff,settings')
  const gs = groupAdminSections(visibleAdminSections(registry, STOCK), groups)
  check('stock manager: the empty workspace group disappears', gs.length === 1 && gs[0].id === 'main')
  check('empty visible list → no groups', groupAdminSections([], groups).length === 0)
  check('no groups declared → one synthetic main group', groupAdminSections(registry, undefined).length === 1 && groupAdminSections(registry, undefined)[0].sections.length === 10)
  check('unknown group id falls back to the first group', groupAdminSections([S({ id: 'q', path: '/admin/q', capability: 'a', order: 1, group: 'ghost' })], groups)[0].id === 'main') }

// matching + active state
{ const loc = (p) => '/en' + p
  check('/en/admin → dashboard (exact)', matchAdminSection(registry, '/en/admin', loc)?.id === 'dashboard')
  check('/en/admin/products → products, not dashboard (exact does not swallow)', matchAdminSection(registry, '/en/admin/products', loc)?.id === 'products')
  check('/en/admin/products/abc → products (prefix)', matchAdminSection(registry, '/en/admin/products/abc', loc)?.id === 'products')
  check('/en/admin/productsX → no section (prefix needs a slash boundary)', matchAdminSection(registry, '/en/admin/productsX', loc) === null)
  check('/en/admin/unknown → null; default-locale path without prefix matches with identity localize', matchAdminSection(registry, '/en/admin/unknown', loc) === null && matchAdminSection(registry, '/admin/orders')?.id === 'orders')
  check('trailing slash tolerated', isActiveAdminSection(registry[0], '/admin', '/admin/') && isActiveAdminSection(registry[2], '/admin/products', '/admin/products/'))
  check('requiredAdminCapability: orders → view:orders, unknown → null', requiredAdminCapability(registry, '/admin/orders') === 'view:orders' && requiredAdminCapability(registry, '/admin/nothing') === null) }

// landing
{ check('landing: owner → /admin, stock manager → /admin/products, accountant → /admin, customer → fallback', firstAllowedAdminPath(registry, OWNER) === '/admin' && firstAllowedAdminPath(registry, STOCK) === '/admin/products' && firstAllowedAdminPath(registry, ACCOUNTANT) === '/admin' && firstAllowedAdminPath(registry, CUSTOMER, '/') === '/')
  check('landing with an empty registry → fallback', firstAllowedAdminPath([], OWNER, '/') === '/') }

