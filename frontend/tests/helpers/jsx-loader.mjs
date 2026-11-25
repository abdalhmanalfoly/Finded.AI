// Minimal Node ESM loader so the real app source (JSX, import.meta.env) can be server-rendered in tests without Vite.
// JSX is compiled with a tiny Babel plugin to React.createElement; src/hooks/useAsync.js is swapped for a test double.
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const babel = require('@babel/core')
const t = require('@babel/types')

function cleanText(raw) {
  const lines = raw.split(/\r\n|\n|\r/)
  let last = 0
  lines.forEach((l, i) => { if (/[^ \t]/.test(l)) last = i })
  let out = ''
  lines.forEach((line, i) => {
    let s = line.replace(/\t/g, ' ')
    if (i !== 0) s = s.replace(/^ +/, '')
    if (i !== lines.length - 1) s = s.replace(/ +$/, '')
    if (s) { out += s + (i !== last ? ' ' : '') }
  })
  return out
}

function jsxName(n) {
  if (t.isJSXIdentifier(n)) return /^[a-z]/.test(n.name) ? t.stringLiteral(n.name) : t.identifier(n.name)
  if (t.isJSXMemberExpression(n)) return t.memberExpression(jsxName(n.object), t.identifier(n.property.name))
  throw new Error('Unsupported JSX name')
}

function plugin() {
  const build = (tag, attrs, children) => {
    const props = attrs.length ? t.objectExpression(attrs.map((a) => {
      if (t.isJSXSpreadAttribute(a)) return t.spreadElement(a.argument)
      const name = a.name.name
      const key = /^[A-Za-z_$][\w$]*$/.test(name) ? t.identifier(name) : t.stringLiteral(name)
      let value = a.value
      if (value === null) value = t.booleanLiteral(true)
      else if (t.isJSXExpressionContainer(value)) value = value.expression
      return t.objectProperty(key, value)
    })) : t.nullLiteral()
    const kids = []
    for (const c of children) {
      if (t.isJSXText(c)) { const s = cleanText(c.value); if (s) kids.push(t.stringLiteral(s)) }
      else if (t.isJSXExpressionContainer(c)) { if (!t.isJSXEmptyExpression(c.expression)) kids.push(c.expression) }
      else if (!t.isJSXSpreadChild(c)) kids.push(c)
    }
    return t.callExpression(t.memberExpression(t.identifier('React'), t.identifier('createElement')), [tag, props, ...kids])
  }
  return {
    visitor: {
      JSXElement: { exit(path) { const n = path.node; path.replaceWith(build(jsxName(n.openingElement.name), n.openingElement.attributes, n.children)) } },
      JSXFragment: { exit(path) { path.replaceWith(build(t.memberExpression(t.identifier('React'), t.identifier('Fragment')), [], path.node.children)) } },
    },
  }
}

export async function resolve(specifier, context, next) {
  const r = await next(specifier, context)
  if (r.url.endsWith('/src/hooks/useAsync.js')) return { ...r, url: new URL('./useAsync.mock.mjs', import.meta.url).href }
  return r
}

export async function load(url, context, next) {
  if (url.includes('/frontend/src/') && /\.(jsx|js)$/.test(url)) {
    let source = await readFile(fileURLToPath(url), 'utf8')
    source = source.replaceAll('import.meta.env', '(globalThis.__ENV || {})')
    if (url.endsWith('.jsx')) {
      source = "import React from 'react'\n" + source
      source = babel.transformSync(source, { filename: fileURLToPath(url), babelrc: false, configFile: false, parserOpts: { plugins: ['jsx'], sourceType: 'module' }, plugins: [plugin] }).code
    }
    return { format: 'module', source, shortCircuit: true }
  }
  return next(url, context)
}
