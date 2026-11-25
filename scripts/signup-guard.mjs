#!/usr/bin/env node
// One-shot gate for signup TESTS. It makes no network requests by itself.
//
// Rules enforced here:
//   - disabled unless the caller passes an explicit authorization
//   - exactly one request maximum, no retries and no parallel signups
//   - cooldown must already have elapsed (never call signup to probe it)
//   - login/session tests must reuse an existing dedicated test account
//
// Intended use in a controlled test harness:
//   const signupOnce = createSignupGate({ allow: userExplicitlyAuthorized })
//   const result = await signupOnce(() => fetch(`${url}/auth/v1/signup`, { method: 'POST', ... }))

import { pathToFileURL } from 'node:url'

export const SIGNUP_TEST_LIMIT = 1
export const EXPLICIT_AUTHORIZATION = 'EXPLICIT_INSTRUCTION'

export class SignupTestNotAllowedError extends Error {
  constructor(message) {
    super(message)
    this.name = 'SignupTestNotAllowedError'
  }
}

export function createSignupGate({
  allow = process.env.FINDIT_ALLOW_SIGNUP_TEST === EXPLICIT_AUTHORIZATION,
  limit = SIGNUP_TEST_LIMIT,
} = {}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > SIGNUP_TEST_LIMIT) {
    throw new Error(`Signup test limit must be 1..${SIGNUP_TEST_LIMIT}; retries are not permitted.`)
  }

  let sent = 0
  let inFlight = false

  return async function signupOnce(request) {
    if (typeof request !== 'function') throw new TypeError('signupOnce expects a request function.')
    if (!allow) {
      throw new SignupTestNotAllowedError('Signup test disabled. An explicit instruction is required.')
    }
    if (inFlight) {
      throw new SignupTestNotAllowedError('A signup test is already in progress. Never run signup tests in parallel.')
    }
    if (sent >= limit) {
      throw new SignupTestNotAllowedError('Signup test request limit reached. No retries are permitted.')
    }

    sent += 1
    inFlight = true
    try {
      return await request()
    } finally {
      inFlight = false
    }
  }
}

// Running this file directly is a no-op by design: it must never issue a request.
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  console.error('This helper makes no requests. Use createSignupGate only inside an explicitly authorized, one-shot test.')
  process.exit(2)
}
