// Server-renders real pages of the app (preview mode, sample data) in the requested language and prints JSON.
// Run through tests/ssr.test.js:  node --import ./tests/helpers/register.mjs tests/helpers/ssr-run.mjs ar
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const React = require('react')
const { renderToString } = require('react-dom/server')
const { MemoryRouter } = require('react-router-dom')

const { default: App } = await import('../../src/App.jsx')
const { AuthProvider } = await import('../../src/context/AuthContext.jsx')
const { I18nProvider } = await import('../../src/i18n/index.jsx')
const { SAMPLE_ITEMS } = await import('../../src/data/sampleData.js')

const lang = process.argv[2] || 'en'
const first = SAMPLE_ITEMS[0].id
const paths = ['/', '/lost', '/found', `/items/${first}`, '/login', '/register', '/forgot-password', '/privacy', '/terms', '/report/lost', '/report/found',
  '/dashboard', '/matches', '/notifications', '/requests', '/profile', '/admin', '/does-not-exist']

const out = []
for (const path of paths) {
  globalThis.__SSR = { idx: 0, cache: {}, pending: [] }
  let html = ''; let error = null
  try {
    for (let pass = 0; pass < 4; pass++) {
      globalThis.__SSR.idx = 0
      globalThis.__SSR.pending = []
      html = renderToString(React.createElement(I18nProvider, { initialLang: lang }, React.createElement(MemoryRouter, { initialEntries: [path] }, React.createElement(AuthProvider, null, React.createElement(App)))))
      if (!globalThis.__SSR.pending.length) break
      await Promise.all(globalThis.__SSR.pending)
    }
  } catch (e) { error = String(e && e.stack || e).split('\n').slice(0, 4).join(' | ') }
  out.push({ path, html, error })
}
console.log(JSON.stringify(out))
