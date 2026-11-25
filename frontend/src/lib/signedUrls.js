// In-memory cache for short-lived signed photo URLs (the photo bucket is private since migration 008).
// `sign(paths, ttlSeconds)` is the Storage call (createSignedUrls). It is injected so this file has no dependencies and
// can be tested in Node. URLs are refreshed a few minutes before they expire; a failed request only means the pictures
// do not show, it never throws into the page that lists the reports.
export const SIGNED_URL_TTL = 3600
export const REFRESH_MARGIN_MS = 5 * 60 * 1000

export function createSignedUrlCache({ sign, ttl = SIGNED_URL_TTL, margin = REFRESH_MARGIN_MS, now = () => Date.now() }) {
  const cache = new Map() // path -> { url, expires }
  let failures = 0
  const fresh = (c) => c && c.expires - margin > now()

  async function get(paths) {
    const wanted = [...new Set((paths || []).filter(Boolean))]
    const stale = wanted.filter((p) => !fresh(cache.get(p)))
    if (stale.length) {
      try {
        const { data, error } = await sign(stale, ttl)
        if (error) failures += 1
        else {
          for (const row of data || []) {
            if (row && row.path && row.signedUrl && !row.error) cache.set(row.path, { url: row.signedUrl, expires: now() + ttl * 1000 })
            else failures += 1
          }
        }
      } catch { failures += 1 /* network failure: show no picture rather than break the page */ }
    }
    return new Map(wanted.map((p) => [p, fresh(cache.get(p)) ? cache.get(p).url : null]))
  }

  const forget = (paths) => { for (const p of paths || []) cache.delete(p) }
  return { get, forget, size: () => cache.size, failureCount: () => failures }
}
