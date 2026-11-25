// Bounded, safe in-memory diagnostics for the report-submission pipeline.
// Deliberately not written to the console in production.
// Only operational metadata is recorded: no tokens, API keys, emails, user IDs, file names or
// request bodies. The original error code/message/details/hint are kept so a failed operation can
// be identified without exposing private data in logs.
const MAX_ENTRIES = 40
let history = []

// PostgREST `details` can echo failing row values, and hints mention table/column names. Redact
// anything that could identify a person or a credential before it is retained in memory.
function scrub(value) {
  if (value == null) return null
  return String(value).slice(0, 300)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '[uuid]')
    .replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, '[token]')
    .replace(/sb_(publishable|secret|temp)_[A-Za-z0-9_-]+/g, '[key]')
    .replace(/[A-Za-z0-9_-]+\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.(?:jpg|jpeg|png|webp)/gi, '[path]')
}

export function errorInfo(error) {
  return {
    ok: false,
    status: error?.status ?? error?.statusCode ?? null,
    code: error?.code ?? null,
    message: scrub(error?.message),
    details: scrub(error?.details),
    hint: scrub(error?.hint),
  }
}

export function recordSubmitStep(operation, result = {}) {
  const entry = {
    operation,
    at: new Date().toISOString(),
    ok: result.ok !== false,
    status: result.status ?? null,
    code: result.code ?? null,
    message: scrub(result.message),
    details: scrub(result.details),
    hint: scrub(result.hint),
    hasUser: Boolean(result.hasUser),
  }
  history = [...history.slice(-(MAX_ENTRIES - 1)), entry]
  return entry
}

/** Test/support accessor. Returns a copy so callers cannot mutate the internal log. */
export function getSubmitDiagnostics() { return history.slice() }
export function clearSubmitDiagnostics() { history = [] }
