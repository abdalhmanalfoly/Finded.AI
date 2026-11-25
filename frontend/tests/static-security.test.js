import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name)
    if (d.name === 'node_modules' || d.name === 'dist') return []
    return d.isDirectory() ? walk(p) : [p]
  })
}
const srcFiles = walk(path.join(root, 'src')).filter((f) => /\.(js|jsx)$/.test(f))
const read = (f) => fs.readFileSync(f, 'utf8')
const stripComments = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

test('XSS: no dangerouslySetInnerHTML, innerHTML, eval or document.write in src', () => {
  const bad = []
  for (const f of srcFiles) {
    const t = read(f)
    if (/dangerouslySetInnerHTML|\.innerHTML\s*=|\beval\(|new Function\(|document\.write/.test(t)) bad.push(path.relative(root, f))
  }
  assert.deepEqual(bad, [])
})

test('SECRETS: no service-role key or secret-looking values in src', () => {
  const bad = []
  for (const f of srcFiles) {
    const t = stripComments(read(f))
    if (/service_role|SERVICE_ROLE|sb_secret_|eyJ[A-Za-z0-9_-]{30,}/.test(t)) bad.push(path.relative(root, f))
  }
  assert.deepEqual(bad, [])
})

test('SECRETS: only the public Supabase variables are read from the environment', () => {
  const names = new Set()
  for (const f of srcFiles) for (const m of read(f).matchAll(/import\.meta\.env\.([A-Z0-9_]+)/g)) names.add(m[1])
  assert.deepEqual([...names].sort(), ['VITE_SUPABASE_ANON_KEY', 'VITE_SUPABASE_URL'])
})

test('SECRETS: local env files are git-ignored and .env.example has no values', () => {
  const rootIgnore = read(path.join(root, '..', '.gitignore'))
  const frontendIgnore = read(path.join(root, '.gitignore'))
  assert.match(rootIgnore, /^\.env$/m)
  assert.match(rootIgnore, /^\.env\.\*$/m)
  assert.match(rootIgnore, /^!\.env\.example$/m)
  assert.match(frontendIgnore, /^\.env\.local$/m)
  for (const line of read(path.join(root, '.env.example')).split('\n')) {
    if (line.trim() && !line.startsWith('#')) assert.match(line, /^[A-Z0-9_]+=$/, `value found in .env.example: ${line}`)
  }
})

test('E2E: preview mode has an explicit empty env file', () => {
  const lines = read(path.join(root, '.env.e2e')).split('\n')
    .map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
  assert.deepEqual(lines.sort(), ['VITE_SUPABASE_ANON_KEY=', 'VITE_SUPABASE_URL='])
  assert.match(read(path.join(root, 'playwright.config.js')), /--mode e2e/)
})

test('AUTH: signup is single-shot with an in-flight guard and no retry loop', () => {
  const t = read(path.join(root, 'src/context/AuthContext.jsx'))
  assert.equal((t.match(/supabase\.auth\.signUp\(/g) || []).length, 1)
  assert.match(t, /singleAuthRequest/)
  assert.match(t, /const authInFlight = \{ signUp/)
  assert.doesNotMatch(t, /\bfor \(|\bwhile \(|\bsetTimeout\(/)
})

test('AUTH: login and password reset are also single-flight', () => {
  const t = read(path.join(root, 'src/context/AuthContext.jsx'))
  assert.match(t, /singleAuthRequest\('signIn'/)
  assert.match(t, /singleAuthRequest\('resetPassword'/)
})

test('ENV: template documents exactly the two public Vite variables', () => {
  const lines = read(path.join(root, '.env.example')).split('\n')
    .map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
  assert.deepEqual(lines.sort(), ['VITE_SUPABASE_ANON_KEY=', 'VITE_SUPABASE_URL='])
})

test('UPLOADS: file input accepts only jpeg/png/webp (no svg)', () => {
  const t = read(path.join(root, 'src/components/ui/ImageUploader.jsx'))
  assert.match(t, /accept="image\/jpeg,image\/png,image\/webp"/)
  assert.doesNotMatch(t, /svg/i)
})

test('ROUTES: every internal link target in src exists as a route', () => {
  const app = read(path.join(root, 'src/App.jsx'))
  const routes = [...app.matchAll(/path="([^"]+)"/g)].map((m) => m[1])
  const toRegex = (r) => new RegExp('^' + r.replace(/:[^/]+/g, '[^/]+').replace('*', '.*') + '$')
  const matchers = routes.map(toRegex)
  const bad = []
  for (const f of srcFiles) {
    for (const m of read(f).matchAll(/(?:to|navigate\()=?\{?\s*['"`](\/[^'"`?#$]*)/g)) {
      const target = m[1].replace(/\/$/, '') || '/'
      if (!matchers.some((r) => r.test(target))) bad.push(`${path.relative(root, f)} -> ${target}`)
    }
  }
  assert.deepEqual(bad, [])
})
