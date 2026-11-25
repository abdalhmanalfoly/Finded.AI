// Preview-mode data access layer. Returns clearly-labeled SAMPLE data when Supabase is not configured.
import { SAMPLE_ITEMS, SAMPLE_MATCHES, SAMPLE_ACTIVITY, SAMPLE_FLAGS, SAMPLE_USERS } from '../data/sampleData.js'
import { translate } from '../i18n/core.js'

const delay = (ms = 400) => new Promise((r) => setTimeout(r, ms))

export async function listItems({ type, q = '', category = '', color = '', status = '', dateFrom = '', dateTo = '', page = 1, pageSize = 6 } = {}) {
  await delay()
  const term = q.trim().toLowerCase()
  const all = SAMPLE_ITEMS.filter((i) => {
    if (type && i.type !== type) return false
    if (category && i.category !== category) return false
    if (color && i.color !== color) return false
    if (status && i.status !== status) return false
    if (dateFrom && i.date < dateFrom) return false
    if (dateTo && i.date > dateTo) return false
    if (!status && (i.status === 'resolved' || i.status === 'closed')) return false
    if (term && !`${i.name} ${i.description} ${i.location} ${i.city} ${i.brand}`.toLowerCase().includes(term)) return false
    return true
  })
  const start = (page - 1) * pageSize
  return { items: all.slice(start, start + pageSize), total: all.length, page, pageSize }
}

export async function getLatest(type, n = 3) {
  await delay(300)
  return SAMPLE_ITEMS.filter((i) => i.type === type && i.status === 'active').slice(0, n)
}

export async function getItem(id) {
  await delay(300)
  const item = SAMPLE_ITEMS.find((i) => i.id === id)
  if (!item) throw new Error(translate('Item not found'))
  return item
}

export async function getMatches() {
  await delay()
  return SAMPLE_MATCHES.map((m) => ({
    ...m,
    lost: SAMPLE_ITEMS.find((i) => i.id === m.lostId),
    found: SAMPLE_ITEMS.find((i) => i.id === m.foundId),
  }))
}

export async function getDashboard() {
  await delay()
  const mine = SAMPLE_ITEMS.filter((i) => ['l1', 'l2', 'l3', 'l6', 'f4'].includes(i.id))
  return {
    reports: mine,
    activity: SAMPLE_ACTIVITY,
    stats: {
      lost: mine.filter((i) => i.type === 'lost').length,
      found: mine.filter((i) => i.type === 'found').length,
      active: mine.filter((i) => i.status === 'active').length,
      matches: SAMPLE_MATCHES.length,
      resolved: mine.filter((i) => i.status === 'resolved').length,
    },
  }
}

export async function getAdminData() {
  await delay()
  return {
    reports: SAMPLE_ITEMS.map((i) => ({ ...i, hidden: false })),
    flags: SAMPLE_FLAGS,
    users: SAMPLE_USERS,
    totals: { reports: SAMPLE_ITEMS.length, flags: SAMPLE_FLAGS.length, users: SAMPLE_USERS.length },
    stats: { users: SAMPLE_USERS.length, reports: SAMPLE_ITEMS.length, matches: SAMPLE_MATCHES.length, openFlags: SAMPLE_FLAGS.length },
  }
}

// ---- Features that need a real backend. In preview mode they explain what is missing. ----
const NEEDS_BACKEND = () => { throw new Error(translate('Connect Supabase to use this feature (see docs/DEPLOYMENT_GUIDE.md).')) }
export const listAdminPage = async () => []
export const exportMyData = NEEDS_BACKEND
export const deleteMyAccount = NEEDS_BACKEND
export const createItem = NEEDS_BACKEND
export const updateItem = NEEDS_BACKEND
export const deleteItem = NEEDS_BACKEND
export const setItemStatus = NEEDS_BACKEND
export const removeImage = NEEDS_BACKEND
export const uploadImages = NEEDS_BACKEND
export const dismissMatch = NEEDS_BACKEND
export const requestContact = NEEDS_BACKEND
export const createFlag = NEEDS_BACKEND
export const respondRequest = NEEDS_BACKEND
export const cancelRequest = NEEDS_BACKEND
export const sendMessage = NEEDS_BACKEND
export const adminSetHidden = NEEDS_BACKEND
export const closeStaleItems = NEEDS_BACKEND
export const adminSuspend = NEEDS_BACKEND
export const adminResolveFlag = NEEDS_BACKEND
export const updateProfile = NEEDS_BACKEND
export const markNotificationRead = NEEDS_BACKEND
export const markAllNotificationsRead = NEEDS_BACKEND
export async function listAdminActions() { return [] }
export async function listNotifications() { return [] }
export async function unreadCount() { return 0 }
export async function listRequests() { return [] }
export async function listMessages() { return [] }
export async function subscribeNotifications() { return () => {} }
export async function subscribeMessages() { return () => {} }
