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
    w('app/modules/ecommerce/components/cart/CartButton.global.vue', '<template><button>x</button></template>\n')
    w('app/pages/login.vue', '<template><div /></template>\n<script setup lang="ts">\nconst cart = useCartStore()\n</script>\n')
    w('app/modules/ecommerce/stores/cart.ts', 'export const useCartStore = () => ({})\n')
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
    assert.ok(fe.includes('layouts/default.vue>modules/ecommerce/components/cart/CartButton.global.vue:auto-component'), fe.join(', '))
    assert.ok(fe.includes('pages/login.vue>modules/ecommerce/stores/cart.ts:auto-import'))
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

test('N0: ROOT layer and the non-TypeScript ownership report (report only, --strict unaffected)', () => {
  const root = mkdtempSync(join(tmpdir(), 'audit-nonts-'))
  try {
    const w = (rel, content) => { mkdirSync(dirname(join(root, rel)), { recursive: true }); writeFileSync(join(root, rel), content) }
    w('src/core/x.ts', 'export const x = 1\n')
    // Composition root: app.vue reads project config, a root plugin uses a Core composable.
    w('app/app.vue', "<template><NuxtPage /></template>\n<script setup lang=\"ts\">\nimport { ICON } from '#project/project.config'\n</script>\n")
    w('app/plugins/theme.client.ts', 'export default () => { useTheme() }\n')
    w('app/app.config.ts', 'export default {}\n')
    w('app/core/composables/useTheme.ts', "export const useTheme = () => t('common.save')\n")
    w('app/project/project.config.ts', "export const ICON = '/favicon.svg'\n")
    w('app/project/pages/about.vue', "<template><img src=\"/images/shared.svg\"></template>\n<script setup lang=\"ts\">\nconst a = t('about.title')\n</script>\n")
    w('app/modules/ecommerce/components/ShopTile.vue', "<template><img src=\"/images/shared.svg\" class=\"text-brandy\"></template>\n<script setup lang=\"ts\">\nconst c = [t('cart.title'), t('common.save'), t(`orders.status_${s}`)]\n</script>\n")
    const messages = JSON.stringify({ about: { title: 'A' }, cart: { title: 'C' }, common: { save: 'S' }, orders: { status_new: 'N' }, unused: { key: 'U' } })
    w('i18n/el.json', messages); w('i18n/en.json', messages)
    w('public/favicon.svg', '<svg/>'); w('public/images/shared.svg', '<svg/>'); w('public/orphan.png', 'x')
    w('app/assets/css/brand.css', ':root {\n  --brand-x: #c97b5a;\n}\n')
    w('app/assets/css/main.css', "@theme {\n  --color-brandy: var(--brand-x);\n  --font-display: 'Test Font', serif;\n}\n")
    w('nuxt.config.ts', "export default { app: { head: { link: [{ href: 'https://fonts.googleapis.com/css2?family=Test+Font:wght@400' }] } } }\n")

    const args = ['--backend', join(root, 'src'), '--frontend', join(root, 'app'), '--types', join(root, 'types'), '--prisma', join(root, 'prisma')]
    const json = run(...args, '--json')
    assert.equal(json.status, 0, json.stderr)
    const r = JSON.parse(json.stdout)
    const layerOf = (file) => r.frontend.edgeList.find((e) => e.from === file)?.fromLayer

    // A, B: composition root files are ROOT; app.config.ts keeps its project exception.
    assert.equal(layerOf('app.vue'), 'ROOT')
    assert.equal(layerOf('plugins/theme.client.ts'), 'ROOT')
    assert.equal(r.frontend.filesByLayer.ROOT, 2, JSON.stringify(r.frontend.filesByLayer))
    assert.equal(r.frontend.filesByLayer.PROJECT, 3, 'app.config.ts + the two project files')
    // ROOT → PROJECT and ROOT → CORE are composition, never forbidden.
    assert.deepEqual(r.frontend.crossLayer['ROOT→PROJECT'], 1)
    assert.deepEqual(r.frontend.crossLayer['ROOT→CORE'], 1)
    assert.deepEqual(r.frontend.forbidden, [])

    // C, D, E: i18n key ownership (static and dynamic keys), unreferenced keys reported.
    const i18n = r.frontend.nonTs.i18n
    assert.equal(i18n.identicalKeySets, true)
    assert.equal(i18n.keyOwner['about.title'], 'PROJECT')
    assert.equal(i18n.keyOwner['cart.title'], 'SHOP')
    assert.equal(i18n.keyOwner['common.save'], 'CORE+SHOP')
    assert.equal(i18n.keyOwner['orders.status_new'], 'SHOP', 'dynamic key prefix counts')
    assert.equal(i18n.keyOwner['unused.key'], 'UNREFERENCED')

    // F, G: public assets — a project asset, a shared asset, an unreferenced one.
    const asset = (url) => r.frontend.nonTs.publicAssets.find((a) => a.url === url)
    assert.equal(asset('/favicon.svg').owner, 'PROJECT')
    assert.equal(asset('/images/shared.svg').owner, 'SHARED')
    assert.deepEqual(asset('/images/shared.svg').layers, ['PROJECT', 'SHOP'])
    assert.equal(asset('/orphan.png').owner, 'UNREFERENCED')

    // H: CSS custom properties — the brand value read by the theme file, the
    // @theme token read through the utility it generates.
    const cssVar = (name) => r.frontend.nonTs.cssVariables.find((v) => v.name === name)
    assert.deepEqual(cssVar('--brand-x').definedIn, ['assets/css/brand.css'])
    assert.deepEqual(cssVar('--brand-x').readBy, ['assets/css/main.css'])
    assert.equal(cssVar('--brand-x').use, 'cross-file')
    assert.deepEqual(cssVar('--color-brandy').readerLayers, ['SHOP'])
    const font = r.frontend.nonTs.fonts.find((f) => f.family === 'Test Font')
    assert.deepEqual(font.loadedBy, ['../nuxt.config.ts'])

    // I: the report never makes --strict fail.
    const strict = run(...args, '--strict')
    assert.equal(strict.status, 0, strict.stderr)
    assert.match(strict.stdout, /non-TypeScript ownership \(report only\)/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
