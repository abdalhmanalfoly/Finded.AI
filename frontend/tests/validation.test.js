import test from 'node:test'
import assert from 'node:assert/strict'
import {
  validateLogin, validateRegister, validateEmail, validateReport, validateImage, MAX_IMAGE_BYTES, MAX_IMAGES,
} from '../src/lib/validation.js'

const today = new Date().toISOString().slice(0, 10)
const tomorrow = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10)
const goodReport = {
  name: 'Black Samsung phone', category: 'Phones', description: 'Cracked clear case and blue lanyard',
  location: 'Maadi metro', city: 'Cairo', date: today, time: 'Morning', color: 'Black', brand: 'Samsung', extra: '',
}

test('login: valid input passes', () => assert.deepEqual(validateLogin({ email: 'a@b.com', password: 'x' }), {}))
test('login: bad email and empty password fail', () => {
  const e = validateLogin({ email: 'nope', password: '' })
  assert.ok(e.email && e.password)
})

test('register: valid input passes', () => {
  assert.deepEqual(validateRegister({ name: 'Sara', email: 's@x.com', password: 'longenough1', confirm: 'longenough1' }), {})
})
test('register: short password, mismatch and short name fail', () => {
  const e = validateRegister({ name: 'S', email: 's@x.com', password: 'short', confirm: 'other' })
  assert.ok(e.name && e.password && e.confirm)
})
test('email validation', () => {
  assert.deepEqual(validateEmail('ok@example.com'), {})
  assert.ok(validateEmail('bad@').email)
})

test('report: valid lost and found reports pass', () => {
  assert.deepEqual(validateReport(goodReport, 'lost'), {})
  assert.deepEqual(validateReport({ ...goodReport, brand: '' }, 'found'), {})
})
test('report: empty form reports every required field', () => {
  const e = validateReport({ name: '', category: '', description: '', location: '', city: '', date: '', time: '', color: '', brand: '', extra: '' }, 'lost')
  for (const k of ['name', 'category', 'description', 'location', 'city', 'date', 'color']) assert.ok(e[k], `missing error for ${k}`)
})
test('report: future date is rejected', () => assert.ok(validateReport({ ...goodReport, date: tomorrow }, 'lost').date))
test('report: too-long name and description are rejected', () => {
  assert.ok(validateReport({ ...goodReport, name: 'x'.repeat(101) }, 'lost').name)
  assert.ok(validateReport({ ...goodReport, description: 'x'.repeat(1001) }, 'lost').description)
})
test('report: whitespace-only name is rejected', () => assert.ok(validateReport({ ...goodReport, name: '     ' }, 'lost').name))

test('image: allowed types pass', () => {
  for (const type of ['image/jpeg', 'image/png', 'image/webp']) assert.equal(validateImage({ name: 'a', type, size: 1000 }), null)
})
test('image: svg, gif, html and pdf are rejected', () => {
  for (const type of ['image/svg+xml', 'image/gif', 'text/html', 'application/pdf']) assert.ok(validateImage({ name: 'a', type, size: 1000 }))
})
test('image: over 5 MB is rejected, exactly 5 MB passes', () => {
  assert.ok(validateImage({ name: 'big', type: 'image/png', size: MAX_IMAGE_BYTES + 1 }))
  assert.equal(validateImage({ name: 'ok', type: 'image/png', size: MAX_IMAGE_BYTES }), null)
})
test('image limit is 3', () => assert.equal(MAX_IMAGES, 3))
