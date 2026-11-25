# Auth test policy

Signup tests are **off by default** and must obey these rules:

1. Never call `/auth/v1/signup` unless the user has explicitly instructed a controlled signup test.
2. Wait for the Supabase Auth cooldown to elapse. Never call signup to check whether the cooldown has expired.
3. One signup test = exactly **one** HTTP request. No retries, no backoff retries, no parallel runs.
4. Do not create a new account for routine tests. Reuse the dedicated existing test account for login/session tests.
5. Do not change Supabase Auth rate limits or disable any security protection to make tests easier.
6. Never generate additional test accounts unless explicitly requested.

`scripts/signup-guard.mjs` implements the hard limit. It performs no network requests by itself; a test harness must pass the request function through `createSignupGate()`. The gate refuses to run without explicit authorization, rejects a second request, and rejects concurrent signups.

The frontend also has a single-flight guard in `frontend/src/context/AuthContext.jsx` so a UI double-submit cannot issue two signup requests.
