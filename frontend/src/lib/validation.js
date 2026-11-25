
import { translate } from '../i18n/core.js'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateLogin({ email, password }) {
  const e = {}
  if (!EMAIL_RE.test(email.trim())) e.email = translate('Enter a valid email address.')
  if (!password) e.password = translate('Enter your password.')
  return e
}

export function validateRegister({ name, email, password, confirm }) {
  const e = {}
  if (name.trim().length < 2) e.name = translate('Enter your name (at least 2 characters).')
  if (!EMAIL_RE.test(email.trim())) e.email = translate('Enter a valid email address.')
  if (password.length < 8) e.password = translate('Use at least 8 characters.')
  if (confirm !== password) e.confirm = translate('Passwords do not match.')
  return e
}

export function validateEmail(email) {
  return EMAIL_RE.test(email.trim()) ? {} : { email: translate('Enter a valid email address.') }
}

export function validateReport(v, type) {
  const e = {}
  const today = new Date().toISOString().slice(0, 10)
  if (v.name.trim().length < 3) e.name = translate('Enter an item name (at least 3 characters).')
  if (!v.category) e.category = translate('Choose a category.')
  if (v.description.trim().length < 10) e.description = translate('Describe the item in at least 10 characters.')
  if (v.location.trim().length < 3) e.location = type === 'lost' ? translate('Enter the last known area.') : translate('Enter where you found it.')
  if (!v.city.trim()) e.city = translate('Enter the city.')
  if (!v.date) e.date = translate('Choose a date.')
  else if (v.date > today) e.date = translate('The date cannot be in the future.')
  if (!v.color) e.color = translate('Choose a color.')
  const hasLat = v.lat !== '' && v.lat != null
  const hasLng = v.lng !== '' && v.lng != null
  if (hasLat !== hasLng) e.lat = translate('Enter both latitude and longitude.')
  else if (hasLat) {
    const la = Number(v.lat); const ln = Number(v.lng)
    if (!Number.isFinite(la) || la < -90 || la > 90) e.lat = translate('Latitude must be between -90 and 90.')
    else if (!Number.isFinite(ln) || ln < -180 || ln > 180) e.lat = translate('Longitude must be between -180 and 180.')
  }
  if (v.name.length > 100) e.name = translate('Keep the name under 100 characters.')
  if (v.description.length > 1000) e.description = translate('Keep the description under 1000 characters.')
  return e
}

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
export const MAX_IMAGES = 3

export function validateImage(file) {
  if (!IMAGE_TYPES.includes(file.type)) return translate('{name}: use a JPG, PNG or WebP image.', { name: file.name })
  if (file.size > MAX_IMAGE_BYTES) return translate('{name}: the image is larger than 5 MB.', { name: file.name })
  return null
}
