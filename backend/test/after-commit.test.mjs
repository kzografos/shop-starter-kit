// Unit test for the detached post-commit helper. Runs against the compiled
// output (`npm run build` first; `npm run verify` does so), like the other
// backend checks under scripts/, so no second TypeScript toolchain is needed.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { afterCommit } = require('../dist/common/utils/after-commit.js')

const fakeLogger = () => {
  const errors = []
  return { errors, error: (message, stack) => errors.push({ message, stack }), warn() {}, log() {} }
}
const settle = () => new Promise((r) => setImmediate(r))

test('success: work runs, nothing is logged, returns without awaiting', async () => {
  const logger = fakeLogger()
  let ran = false
  const result = afterCommit(logger, 'Order 1 analytics invalidation', async () => {
    ran = true
  })
  assert.equal(result, undefined)
  await settle()
  assert.equal(ran, true)
  assert.deepEqual(logger.errors, [])
})

test('work starts synchronously, before the caller continues', () => {
  const logger = fakeLogger()
  let started = false
  afterCommit(logger, 'x', async () => {
    started = true
  })
  assert.equal(started, true)
})

test('rejection: logged with label, message and stack; never propagates', async () => {
  const logger = fakeLogger()
  const unhandled = []
  const onUnhandled = (err) => unhandled.push(err)
  process.on('unhandledRejection', onUnhandled)
  try {
    afterCommit(logger, 'Order 1 stock alert for product p1', () => Promise.reject(new Error('db down')))
    await settle()
  } finally {
    process.off('unhandledRejection', onUnhandled)
  }
  assert.deepEqual(unhandled, [])
  assert.equal(logger.errors.length, 1)
  assert.equal(logger.errors[0].message, 'Order 1 stock alert for product p1 failed after commit: db down')
  assert.match(logger.errors[0].stack, /Error: db down/)
})

test('synchronous throw inside work is caught and logged the same way', async () => {
  const logger = fakeLogger()
  assert.doesNotThrow(() =>
    afterCommit(logger, 'Order 1 confirmation email', () => {
      throw new Error('sync boom')
    }),
  )
  await settle()
  assert.equal(logger.errors.length, 1)
  assert.equal(logger.errors[0].message, 'Order 1 confirmation email failed after commit: sync boom')
})

test('non-Error rejection is stringified and logged without a stack', async () => {
  const logger = fakeLogger()
  afterCommit(logger, 'x', () => Promise.reject('plain string'))
  await settle()
  assert.deepEqual(logger.errors, [{ message: 'x failed after commit: plain string', stack: undefined }])
})

test('one failing effect does not stop sibling effects', async () => {
  const logger = fakeLogger()
  const done = []
  afterCommit(logger, 'a', () => Promise.reject(new Error('a failed')))
  afterCommit(logger, 'b', async () => {
    done.push('b')
  })
  afterCommit(logger, 'c', async () => {
    done.push('c')
  })
  await settle()
  assert.deepEqual(done, ['b', 'c'])
  assert.equal(logger.errors.length, 1)
  assert.equal(logger.errors[0].message, 'a failed after commit: a failed')
})
