// useApi (app/core/composables/useApi.ts): success, 401 → refresh → one retry,
// refresh failure → hook + original error, no refresh for /auth/ urls,
// 403/404/409 untouched, single-flight refresh across instances, FormData and
// headers passed through untouched.
//   pnpm test
// The composable relies on Nuxt auto-imports ($fetch, useRuntimeConfig,
// useNuxtApp) and `import.meta.client`; they are stubbed on globalThis here.
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

const calls = []
let responses = []          // queue of handlers: (url, opts) => value | throws
const hooks = []
globalThis.useRuntimeConfig = () => ({ public: { apiBase: 'http://api.test' } })
globalThis.useNuxtApp = () => ({ callHook: async (name) => { hooks.push(name) } })
const fetchError = (status, data) => Object.assign(new Error(`[${status}]`), { response: { status }, statusCode: status, data })
globalThis.$fetch = async (url, opts) => {
  calls.push({ url, opts })
  const next = responses.shift()
  if (!next) throw new Error('unexpected request ' + url)
  return next(url, opts)
}
// import.meta.client is not set by plain Node; the composable falls back to
// the per-instance path, which is also what the server uses. The shared-tab
// path is exercised in the browser harness.
const { useApi } = await import('../app/core/composables/useApi.ts')

beforeEach(() => { calls.length = 0; responses = []; hooks.length = 0 })

test('success: baseURL + credentials added, caller options and generic result preserved', async () => {
  responses.push(() => ({ ok: 1 }))
  const api = useApi()
  const r = await api('/orders', { method: 'POST', body: { a: 1 }, headers: { 'Idempotency-Key': 'k-1234567' } })
  assert.deepEqual(r, { ok: 1 })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, '/orders')
  assert.equal(calls[0].opts.baseURL, 'http://api.test')
  assert.equal(calls[0].opts.credentials, 'include')
  assert.equal(calls[0].opts.method, 'POST')
  assert.deepEqual(calls[0].opts.body, { a: 1 })
  assert.equal(calls[0].opts.headers['Idempotency-Key'], 'k-1234567')
})

test('401 → one refresh → one retry with identical options', async () => {
  responses.push(() => { throw fetchError(401) }, () => ({ refreshed: true }), () => ({ data: 'after' }))
  const api = useApi()
  const r = await api('/admin/staff', { query: { page: 2 } })
  assert.deepEqual(r, { data: 'after' })
  assert.deepEqual(calls.map((c) => c.url), ['/admin/staff', 'http://api.test/auth/refresh', '/admin/staff'])
  assert.equal(calls[1].opts.method, 'POST')
  assert.deepEqual(calls[2].opts.query, { page: 2 })
  assert.equal(hooks.length, 0)
})

test('401 → refresh fails → api:unauthenticated fired once, original 401 rethrown, no retry', async () => {
  const original = fetchError(401, { message: 'Unauthorized' })
  responses.push(() => { throw original }, () => { throw fetchError(401) })
  const api = useApi()
  await assert.rejects(api('/profile'), (e) => e === original)
  assert.deepEqual(calls.map((c) => c.url), ['/profile', 'http://api.test/auth/refresh'])
  assert.deepEqual(hooks, ['api:unauthenticated'])
})

test('retry that 401s again propagates (no loop)', async () => {
  const second = fetchError(401)
  responses.push(() => { throw fetchError(401) }, () => ({}), () => { throw second })
  const api = useApi()
  await assert.rejects(api('/notifications'), (e) => e === second)
  assert.equal(calls.length, 3)
})

test('/auth/ urls never trigger a refresh', async () => {
  const err = fetchError(401, { message: 'Invalid credentials' })
  responses.push(() => { throw err })
  const api = useApi()
  await assert.rejects(api('/auth/login', { method: 'POST', body: {} }), (e) => e === err)
  assert.equal(calls.length, 1)
  assert.equal(hooks.length, 0)
})

for (const status of [400, 403, 404, 409, 500]) {
  test(`${status} propagates untouched with the backend payload, no refresh`, async () => {
    const err = fetchError(status, { message: `msg-${status}`, statusCode: status })
    responses.push(() => { throw err })
    const api = useApi()
    await assert.rejects(api('/orders/x/cancel', { method: 'POST' }), (e) => e === err && e.data.message === `msg-${status}`)
    assert.equal(calls.length, 1)
  })
}

test('concurrent 401s on one instance share a single refresh', async () => {
  let release
  const gate = new Promise((r) => { release = r })
  responses.push(
    () => { throw fetchError(401) }, () => { throw fetchError(401) },
    () => gate.then(() => ({})),                 // the one refresh
    () => ({ a: 1 }), () => ({ b: 2 }),
  )
  const api = useApi()
  const p1 = api('/a'), p2 = api('/b')
  await new Promise((r) => setTimeout(r, 10)); release()
  const [r1, r2] = await Promise.all([p1, p2])
  assert.deepEqual([r1, r2], [{ a: 1 }, { b: 2 }])
  assert.equal(calls.filter((c) => c.url.endsWith('/auth/refresh')).length, 1)
})

test('FormData body and custom headers pass through unchanged', async () => {
  const fd = new FormData(); fd.append('file', new Blob(['x']), 'x.png')
  responses.push(() => ({ key: 'k' }))
  const api = useApi()
  await api('/admin/products/1/images', { method: 'POST', body: fd, headers: { 'X-Test': '1' } })
  assert.equal(calls[0].opts.body, fd)
  assert.equal(calls[0].opts.headers['X-Test'], '1')
})

test('network error (no response) propagates without a refresh attempt', async () => {
  const err = new Error('fetch failed')
  responses.push(() => { throw err })
  const api = useApi()
  await assert.rejects(api('/settings'), (e) => e === err)
  assert.equal(calls.length, 1)
})
