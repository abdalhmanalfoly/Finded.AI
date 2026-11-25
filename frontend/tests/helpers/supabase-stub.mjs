// Fake supabase client used by tests/upload.test.js. The service imports this module instead of
// src/lib/supabase.js, and every call is forwarded to globalThis.__SB.
export const isConfigured = true
export const supabase = new Proxy({}, {
  get: (_, prop) => globalThis.__SB?.[prop],
})
