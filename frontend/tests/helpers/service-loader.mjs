// Test-only ESM loader: swaps src/lib/supabase.js for a controllable stub so the real service
// functions can be exercised without a Supabase project. globalThis.__SB holds the fake client.
export async function resolve(specifier, context, next) {
  const resolved = await next(specifier, context)
  if (specifier.endsWith('/lib/supabase.js')) {
    return { url: new URL('./supabase-stub.mjs', import.meta.url).href, format: 'module', shortCircuit: true }
  }
  return resolved
}
