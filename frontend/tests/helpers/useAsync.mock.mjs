// Test double for src/hooks/useAsync.js: resolves each call in order across render passes (see ssr-run.mjs).
export default function useAsync(fn) {
  const s = globalThis.__SSR
  const i = s.idx++
  if (i in s.cache) return { data: s.cache[i].data, loading: false, error: s.cache[i].error, reload() {} }
  s.pending.push(Promise.resolve().then(fn).then((data) => { s.cache[i] = { data, error: null } }, (error) => { s.cache[i] = { data: null, error } }))
  return { data: null, loading: true, error: null, reload() {} }
}
