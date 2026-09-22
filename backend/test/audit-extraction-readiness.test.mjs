// The extraction-readiness audit script (scripts/audit-extraction-readiness.js):
// one positive run on the real tree (known baseline, deterministic) and one
// negative run on a synthetic tree with forbidden edges and a cycle.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const SCRIPT = join(here, '..', 'scripts', 'audit-extraction-readiness.js')
const run = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' })

test('positive: real tree — baseline boundaries hold and output is deterministic', () => {
  const a = run('--json'), b = run('--json')
  assert.equal(a.status, 0, a.stderr)
  assert.equal(a.stdout, b.stdout, 'two runs must produce identical JSON')
  const r = JSON.parse(a.stdout)
  assert.ok(r.backend.files >= 100 && r.frontend.files >= 60, 'scans both trees')
  assert.ok(r.backend.edgesByKind.di > 50 && r.backend.edgesByKind.import > 200, 'resolves imports and constructor DI')
  assert.ok(r.frontend.edgesByKind['auto-component'] > 20 && r.frontend.edgesByKind['auto-import'] > 50, 'resolves Nuxt auto-imports')
  // Backend: no forbidden edge of any runtime kind — Core→Shop, Infra→Shop and,
  // since F1 was closed, Infra→Core (the providers own their presence checks).
  assert.deepEqual(r.backend.forbidden, [], JSON.stringify(r.backend.forbidden))
  assert.equal(r.backend.shopPrismaFromCore.length, 0, 'no Core service touches a shop model')
  assert.deepEqual(r.backend.fileCycles, [], 'no file-level runtime cycle')
  assert.deepEqual(r.backend.folderCycles, [['core/auth', 'core/users']], 'the one known unit cycle (guards contract)')
  assert.deepEqual(r.backend.events.publishers.map((p) => p.event), ['user.authenticated'])
  // Frontend: no Core→Shop code edge; Core→Project edges are the documented brand residue.
  assert.equal(r.frontend.forbidden.filter((e) => e.toLayer === 'SHOP').length, 0, JSON.stringify(r.frontend.forbidden.filter((e) => e.toLayer === 'SHOP')))
  assert.ok(r.frontend.forbidden.every((e) => e.fromLayer === 'CORE' && e.toLayer === 'PROJECT'))
  assert.ok(r.frontend.coreToShopViaRegistry.length >= 4, 'app.config contributions are reported as registry edges')
  assert.deepEqual(r.frontend.fileCycles, [])
  // Limitations are reported, not hidden.
  assert.ok(r.frontend.unresolved.some((u) => u.spec === '<component :is>'))
  assert.ok(r.backend.unresolved.some((u) => /DI token/.test(u.reason)))
})

test('negative: synthetic tree — forbidden edges, DI, auto-component and a cycle are found; --strict fails', () => {
  const root = mkdtempSync(join(tmpdir(), 'audit-fixture-'))
  try {
    const w = (rel, content) => { mkdirSync(dirname(join(root, rel)), { recursive: true }); writeFileSync(join(root, rel), content) }
    // backend: Core service imports + injects a Shop service; Shop imports Core back (runtime cycle)
    w('src/core/users/users.service.ts', "import { ProductsService } from '../../modules/ecommerce/products/products.service'\nexport class UsersService { constructor(private products: ProductsService) {} }\n")
    w('src/modules/ecommerce/products/products.service.ts', "import { UsersService } from '../../../core/users/users.service'\nimport type { Thing } from '../../../core/users/thing'\nexport class ProductsService { constructor(private users: UsersService) {} }\n")
    w('src/core/users/thing.ts', 'export type Thing = string\n')
    w('src/infrastructure/mail/mail.service.ts', "export class MailService { async x() { await this.prisma.order.findMany() } }\n")
    w('prisma/ecommerce.prisma', 'model Order {\n  id String @id\n}\n')
    // frontend: Core layout uses a Shop component through the template; Core page auto-imports a Shop store
    w('app/layouts/default.vue', '<template><div><CartButton /><UIcon /></div></template>\n')
    w('app/components/cart/CartButton.global.vue', '<template><button>x</button></template>\n')
    w('app/pages/login.vue', '<template><div /></template>\n<script setup lang="ts">\nconst cart = useCartStore()\n</script>\n')
    w('app/stores/cart.ts', 'export const useCartStore = () => ({})\n')
    w('app/utils/x.ts', "// useCartStore() mentioned in a comment must not count\nexport const x = 1\n")
    w('types/index.ts', 'export interface Profile { id: string }\n')

    const args = ['--backend', join(root, 'src'), '--frontend', join(root, 'app'), '--types', join(root, 'types'), '--prisma', join(root, 'prisma')]
    const json = run(...args, '--json')
    assert.equal(json.status, 0, json.stderr)
    const r = JSON.parse(json.stdout)
    const be = r.backend.forbidden.map((e) => `${e.from}>${e.to}:${e.kind}`)
    assert.ok(be.includes('core/users/users.service.ts>modules/ecommerce/products/products.service.ts:import'), be.join(', '))
    assert.ok(be.includes('core/users/users.service.ts>modules/ecommerce/products/products.service.ts:di'), 'constructor injection is an edge')
    assert.ok(!be.some((x) => x.includes('thing.ts')), 'type-only imports are not forbidden edges')
    assert.ok(r.backend.forbiddenTypeOnly.length === 0, 'shop → core type import is allowed')
    assert.deepEqual(r.backend.fileCycles, [['core/users/users.service.ts', 'modules/ecommerce/products/products.service.ts']])
    assert.deepEqual(r.backend.folderCycles, [['core/users', 'modules/ecommerce/products']])
    assert.ok(r.backend.edgeList.some((e) => e.kind === 'prisma' && e.from === 'infrastructure/mail/mail.service.ts' && e.toLayer === 'SHOP'), 'Infra touching a shop model is a prisma edge')
    const fe = r.frontend.forbidden.map((e) => `${e.from}>${e.to}:${e.kind}`)
    assert.ok(fe.includes('layouts/default.vue>components/cart/CartButton.global.vue:auto-component'), fe.join(', '))
    assert.ok(fe.includes('pages/login.vue>stores/cart.ts:auto-import'))
    assert.ok(!r.frontend.edgeList.some((e) => e.from === 'utils/x.ts'), 'identifiers inside comments are ignored')
    assert.equal(r.frontend.packageComponentUses, 1, 'UIcon counted as a package component, not unresolved')

    const strict = run(...args, '--strict')
    assert.equal(strict.status, 1)
    assert.match(strict.stderr, /forbidden cross-layer edge/)
    assert.match(strict.stdout, /core\/users\/users\.service\.ts → modules\/ecommerce\/products\/products\.service\.ts/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
