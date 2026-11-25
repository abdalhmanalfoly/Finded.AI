import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import ar from '../src/i18n/ar.js'
import { translate, setLanguage, LANGS } from '../src/i18n/core.js'

const root = fileURLToPath(new URL('..', import.meta.url))
const placeholders = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',')
const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;')

function render(lang) {
  const r = spawnSync(process.execPath, ['--import', './tests/helpers/register.mjs', 'tests/helpers/ssr-run.mjs', lang],
    { cwd: root, env: { ...process.env, NODE_ENV: 'production' }, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  assert.equal(r.status, 0, r.stderr.slice(0, 800))
  return JSON.parse(r.stdout)
}

test('every Arabic entry keeps the same {placeholders} as its English key', () => {
  for (const [k, v] of Object.entries(ar)) assert.equal(placeholders(v), placeholders(k), `placeholders differ for "${k}"`)
})

test('translate(): exact keys, variables, server-generated text and fallback', () => {
  setLanguage('ar')
  assert.equal(translate('Log in'), ar['Log in'])
  assert.equal(translate('Page {page} of {pages}', { page: 2, pages: 5 }), 'صفحة 2 من 5')
  assert.equal(translate('Same color: Black'), 'نفس اللون: أسود')
  assert.equal(translate('Same category: Wallets and bags'), 'نفس الفئة: محافظ وحقائب')
  assert.equal(translate('Found 3 day(s) after it was lost'), 'وُجد بعد 3 يوم من فقده')
  assert.equal(translate('Someone sent a request about "Blue wallet".'), 'أرسل أحدهم طلبًا بخصوص "Blue wallet".')
  assert.match(translate('Your report "Keys" may match another report (similarity estimate 82%).'), /82%/)
  assert.equal(translate('A sentence nobody translated'), 'A sentence nobody translated')
  setLanguage('en')
  assert.equal(translate('Log in'), 'Log in')
  assert.equal(translate('Page {page} of {pages}', { page: 1, pages: 3 }), 'Page 1 of 3')
  assert.equal(LANGS.ar.dir, 'rtl')
})

test('all pages render in English and Arabic without errors', () => {
  const en = render('en')
  const arPages = render('ar')
  assert.ok(en.length >= 18)
  for (const p of [...en, ...arPages]) {
    assert.equal(p.error, null, `${p.path}: ${p.error}`)
    assert.ok(p.html.length > 1000, `${p.path} rendered too little`)
  }
  for (const p of arPages) assert.match(p.html, /[؀-ۿ]/, `${p.path} has no Arabic`)
  assert.match(en[0].html, /العربية/, 'English pages offer a switch to Arabic')
  assert.match(arPages[0].html, />English</, 'Arabic pages offer a switch to English')
})

test('Arabic pages leak no untranslated UI sentences', () => {
  const en = render('en').map((p) => p.html).join('\n')
  const arHtml = render('ar').map((p) => p.html).join('\n')
  const sampleText = readFileSync(new URL('../src/data/sampleData.js', import.meta.url), 'utf8') // user-entered sample content, not UI text
  const rendered = Object.keys(ar).filter((k) => k.length >= 12 && !k.includes('{') && !sampleText.includes(k) && en.includes(escapeHtml(k)))
  assert.ok(rendered.length >= 60, `only ${rendered.length} dictionary keys were exercised by the rendered pages`)
  for (const k of rendered) assert.ok(!arHtml.includes(escapeHtml(k)), `"${k}" is still English in the Arabic page`)
})

test('item page shows the OpenStreetMap embed (no API key) in both languages', () => {
  for (const lang of ['en', 'ar']) {
    const page = render(lang).find((p) => p.path.startsWith('/items/'))
    assert.match(page.html, /<iframe[^>]+src="https:\/\/www\.openstreetmap\.org\/export\/embed\.html\?bbox=/, `${lang}: map iframe`)
    assert.match(page.html, /marker=29\.96020,31\.25690/)
  }
})

test('report form offers the optional location picker', () => {
  const page = render('ar').find((p) => p.path === '/report/lost')
  assert.match(page.html, /id="lat"/)
  assert.match(page.html, /استخدم موقعي الحالي/)
})
