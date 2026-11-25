import test from 'node:test'
import assert from 'node:assert/strict'
import { createSignupGate, SIGNUP_TEST_LIMIT } from '../../scripts/signup-guard.mjs'

test('signup gate is disabled by default and makes no request', async () => {
  const previous = process.env.FINDIT_ALLOW_SIGNUP_TEST
  delete process.env.FINDIT_ALLOW_SIGNUP_TEST
  let calls = 0
  try {
    const gate = createSignupGate()
    await assert.rejects(() => gate(async () => { calls += 1 }), /explicit instruction/i)
    assert.equal(calls, 0)
  } finally {
    if (previous === undefined) delete process.env.FINDIT_ALLOW_SIGNUP_TEST
    else process.env.FINDIT_ALLOW_SIGNUP_TEST = previous
  }
})

test('signup gate allows exactly one authorized request and never retries', async () => {
  let calls = 0
  const gate = createSignupGate({ allow: true })
  const result = await gate(async () => { calls += 1; return { status: 200 } })
  assert.deepEqual(result, { status: 200 })
  assert.equal(calls, 1)
  await assert.rejects(() => gate(async () => { calls += 1 }), /limit reached/i)
  assert.equal(calls, 1)
})

test('signup gate refuses parallel signup requests', async () => {
  let release
  const pending = new Promise((resolve) => { release = resolve })
  const gate = createSignupGate({ allow: true })
  const first = gate(async () => { await pending; return 'first' })
  await assert.rejects(() => gate(async () => 'second'), /already in progress/i)
  release()
  assert.equal(await first, 'first')
})

test('signup gate hard-caps the request limit at one', () => {
  assert.equal(SIGNUP_TEST_LIMIT, 1)
  assert.throws(() => createSignupGate({ allow: true, limit: 2 }), /limit must be 1/i)
})
