// Real data access (Supabase). All permission checks are enforced by the database (RLS), not by this file.
import { supabase } from '../lib/supabase.js'
import { translate } from '../i18n/core.js'
import { createSignedUrlCache } from '../lib/signedUrls.js'
import { recordSubmitStep, errorInfo } from '../lib/submitDiagnostics.js'

const BUCKET = 'item-images'
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

function friendly(error) {
  if (!error) return translate('Something went wrong. Try again.')
  if (error.code === 'P0001') return error.message // messages written by our own database functions
  if (error.code === '42501' || /row-level security|permission denied/i.test(error.message || '')) return translate('You don’t have permission to do that.')
  if (error.code === '23514') return translate('Some values are not valid. Check the form and try again.')
  if (error.code === '23505') return translate('That already exists.')
  if (/fetch|network/i.test(error.message || '')) return translate('Network problem. Check your connection and try again.')
  return translate('Something went wrong. Try again.')
}
const fail = (error) => { throw new Error(friendly(error)) }

// Storage often returns HTTP 400 while the real cause is in error.status/error.message. Auth and
// configuration failures must not be collapsed into the generic "could not upload" message.
function storageProblem(error) {
  const status = Number(error?.status ?? error?.statusCode)
  const msg = (error?.message || '').toLowerCase()
  if (status === 401 || /jwt|unauthor|no_authorization|token/.test(msg)) return translate('Your session has expired. Please sign in again.')
  if (status === 403 || /row-level security|permission denied|forbidden/.test(msg)) return translate('You don’t have permission to upload photos.')
  if (status === 404 || /bucket not found|nosuchbucket/.test(msg)) return translate('Photo storage is not configured. Ask the administrator to create the item-images bucket.')
  return translate('Some images could not be uploaded.')
}

// A 42501 from PostgREST is an authorization failure, but the table/column tells us which action
// was refused. Log the raw error in the caller, then use an operation-specific Arabic message.
function permissionMessage(error, key) {
  if (error?.code === '42501' || /row-level security|permission denied/i.test(error?.message || '')) return translate(key)
  return friendly(error)
}

async function me() {
  // Protected operations need a valid user JWT. getSession() distinguishes "not logged in" from
  // a broken session; getUser() verifies the token with Auth before any Storage call is made.
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  recordSubmitStep('auth.getSession', sessionError
    ? { ...errorInfo(sessionError), hasUser: false }
    : { ok: true, hasUser: Boolean(sessionData?.session) })
  if (sessionError || !sessionData?.session) {
    throw new Error(translate(sessionError ? 'Your session has expired. Please sign in again.' : 'Please log in first.'))
  }
  const { data, error } = await supabase.auth.getUser()
  recordSubmitStep('auth.getUser', error
    ? { ...errorInfo(error), hasUser: false }
    : { ok: true, hasUser: Boolean(data?.user) })
  if (error || !data?.user) throw new Error(translate('Your session has expired. Please sign in again.'))
  return data.user.id
}

// The photo bucket is private (migration 008). Photos are shown through short-lived signed URLs that Storage only
// issues when the database policy lets the caller read that file (see lib/signedUrls.js for the cache).
const urlCache = createSignedUrlCache({ sign: (paths, ttl) => supabase.storage.from(BUCKET).createSignedUrls(paths, ttl) })
const signedUrls = (paths) => urlCache.get(paths)
const forgetSignedUrls = (paths) => urlCache.forget(paths)

/** Maps database rows to items and fills each cover photo with a signed URL (one batched request). */
export async function mapItems(rows) {
  const urls = await signedUrls(rows.map((r) => r.cover_path))
  return rows.map((r) => ({ ...mapItem(r), coverUrl: urls.get(r.cover_path) || null }))
}

function mapItem(r) {
  return {
    id: r.id, type: r.type, name: r.name, category: r.category, description: r.description,
    location: r.location_text, city: r.city, date: r.event_date, time: r.event_time || '',
    lat: r.latitude ?? r.approx_lat ?? null, lng: r.longitude ?? r.approx_lng ?? null,
    color: r.color, brand: r.brand || '', status: r.status, extra: r.additional_details || '',
    userId: r.user_id, isHidden: r.is_hidden, createdAt: r.created_at, coverUrl: null, // filled in by mapItems() with a signed URL
  }
}

const cleanTerm = (q) => (q || '').replace(/[%*,()\\]/g, ' ').trim().slice(0, 60)

export async function listItems({ type, q = '', category = '', color = '', status = '', dateFrom = '', dateTo = '', page = 1, pageSize = 6 } = {}) {
  let query = supabase.from('public_items').select('*', { count: 'exact' }).eq('type', type)
  if (category) query = query.eq('category', category)
  if (color) query = query.eq('color', color)
  if (status) query = query.eq('status', status)
  if (dateFrom) query = query.gte('event_date', dateFrom)
  if (dateTo) query = query.lte('event_date', dateTo)
  const term = cleanTerm(q)
  if (term) query = query.or(`name.ilike.%${term}%,description.ilike.%${term}%,location_text.ilike.%${term}%,city.ilike.%${term}%,brand.ilike.%${term}%`)
  const from = (page - 1) * pageSize
  const { data, count, error } = await query.order('created_at', { ascending: false }).range(from, from + pageSize - 1)
  if (error) fail(error)
  return { items: await mapItems(data), total: count ?? 0, page, pageSize }
}

export async function getLatest(type, n = 3) {
  const { data, error } = await supabase.from('public_items').select('*').eq('type', type).order('created_at', { ascending: false }).limit(n)
  if (error) fail(error)
  return mapItems(data)
}

export async function getItem(id) {
  // Start with the safe public view so anonymous visitors never depend on protected-table access.
  const publicResult = await supabase.from('public_items').select('*').eq('id', id).maybeSingle()
  if (publicResult.error) fail(publicResult.error)
  let data = publicResult.data

  // Anonymous visitors must still be able to read the public row above. Only validate a
  // user when the browser actually has a session; an expired session simply means "signed out".
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) fail(sessionError)
  let authUser = null
  if (sessionData?.session) {
    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (!authError) authUser = authData.user
  }

  // Owners and admins may also view private/hidden/resolved records through the RLS-protected table.
  if (authUser) {
    const privateResult = await supabase.from('items').select('*').eq('id', id).maybeSingle()
    if (privateResult.error && privateResult.error.code !== '42501') fail(privateResult.error)
    if (privateResult.data) data = privateResult.data
  }
  if (!data) throw new Error(translate('Item not found'))
  const { data: imgs, error: imageError } = await supabase.from('item_images').select('id, storage_path, position').eq('item_id', id).order('position')
  if (imageError) fail(imageError)
  const item = mapItem(data)
  const urls = await signedUrls((imgs || []).map((i) => i.storage_path))
  item.images = (imgs || []).map((i) => ({ id: i.id, path: i.storage_path, url: urls.get(i.storage_path) }))
  item.coverUrl = item.images[0]?.url || null
  item.isOwner = Boolean(authUser && data.user_id === authUser.id)
  return item
}

export async function getMyItems() {
  const uid = await me()
  const { data, error } = await supabase.from('items').select('*').eq('user_id', uid).order('created_at', { ascending: false })
  if (error) fail(error)
  return mapItems(data)
}

export async function uploadImages(itemId, files, startPosition = 0) {
  const uid = await me()
  const uploaded = []
  let problem = null
  for (const [i, file] of files.entries()) {
    const ext = EXT[file.type]
    if (!ext || file.size > 5 * 1024 * 1024) { problem = translate('Some images were skipped (wrong type or over 5 MB).'); continue }
    const path = `${uid}/${crypto.randomUUID()}.${ext}`
    const up = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false })
    recordSubmitStep('storage.upload', up.error ? { ...errorInfo(up.error), hasUser: true } : { ok: true, hasUser: true })
    if (up.error) {
      // Stop the batch and undo it: a 401/403/404 will affect every file, so continuing would
      // create an item with missing photos. The real reason reaches the user via storageProblem().
      if (uploaded.length) {
        const cleanup = await supabase.storage.from(BUCKET).remove(uploaded)
        recordSubmitStep('rollback.storage.remove', cleanup.error ? { ...errorInfo(cleanup.error), hasUser: true } : { ok: true, hasUser: true })
      }
      throw new Error(storageProblem(up.error))
    }
    uploaded.push(path)
    const ins = await supabase.from('item_images').insert({ item_id: itemId, storage_path: path, position: startPosition + i })
    recordSubmitStep('item_images.insert', ins.error ? { ...errorInfo(ins.error), hasUser: true } : { ok: true, hasUser: true })
    if (ins.error) {
      const cleanup = await supabase.storage.from(BUCKET).remove([path])
      recordSubmitStep('rollback.storage.remove', cleanup.error ? { ...errorInfo(cleanup.error), hasUser: true } : { ok: true, hasUser: true })
      throw new Error(permissionMessage(ins.error, 'You don’t have permission to attach photos to this report.'))
    }
  }
  if (uploaded.length) embedItemImages(itemId) // fire-and-forget: photo matching is a bonus, never blocks saving
  return problem
}

/** Asks the `embed-image` Edge Function to compute photo vectors for this report (no-op when it is not deployed). */
async function embedItemImages(itemId) {
  try {
    const result = await supabase.functions.invoke('embed-image', { body: { itemId } })
    recordSubmitStep('rpc.embed-image', result.error
      ? { ...errorInfo(result.error), hasUser: true }
      : { ok: true, hasUser: true })
  } catch (e) {
    // Optional feature: a failed embedding never blocks saving, but record it for diagnosis.
    recordSubmitStep('rpc.embed-image', { ...errorInfo(e), hasUser: true })
  }
}

/** Asks the `nemotron-match` Edge Function to build document embeddings and AI match candidates. */
async function requestAiMatching(itemId) {
  try {
    const result = await supabase.functions.invoke('nemotron-match', { body: { itemId } })
    recordSubmitStep('rpc.nemotron-match', result.error
      ? { ...errorInfo(result.error), hasUser: true }
      : { ok: true, hasUser: true })
  } catch (e) {
    // Asynchronous pipeline: a failure never blocks saving the report.
    recordSubmitStep('rpc.nemotron-match', { ...errorInfo(e), hasUser: true })
  }
}

const hasCoords = (v) => v.lat !== '' && v.lat != null && v.lng !== '' && v.lng != null && Number.isFinite(Number(v.lat)) && Number.isFinite(Number(v.lng))

const toRow = (v) => {
  const row = {
    name: v.name.trim(), category: v.category, description: v.description.trim(), location_text: v.location.trim(),
    city: v.city.trim(), event_date: v.date, event_time: v.time || null, color: v.color,
    brand: v.brand?.trim() || null, additional_details: v.extra?.trim() || null,
  }
  // Only include coordinate columns when the user actually picked a point. Projects that never
  // applied migration 007 have no INSERT grant on latitude/longitude, and sending explicit NULLs
  // for those columns makes PostgreSQL reject the entire report with SQLSTATE 42501.
  if (hasCoords(v)) { row.latitude = Number(v.lat); row.longitude = Number(v.lng) }
  return row
}

export async function createItem(type, values, files = []) {
  const uid = await me()
  const { data, error } = await supabase.from('items').insert({ user_id: uid, type, ...toRow(values) }).select('id').single()
  recordSubmitStep('items.insert', error
    ? { ...errorInfo(error), hasUser: Boolean(uid) }
    : { ok: true, hasUser: Boolean(uid) })
  if (error) throw new Error(permissionMessage(error, 'You don’t have permission to create a report.'))
  try {
    const imageProblem = files.length ? await uploadImages(data.id, files) : null
    requestAiMatching(data.id) // fire-and-forget: never delays report submission
    recordSubmitStep('submit.success', { ok: true, hasUser: Boolean(uid) })
    return { id: data.id, imageProblem }
  } catch (e) {
    // Uploads already cleaned up their own objects; remove the report so a failed photo upload
    // never leaves a half-created record behind. A failed rollback is logged and reported.
    let rollback
    try { rollback = await supabase.from('items').delete().eq('id', data.id) }
    catch (rollbackError) {
      recordSubmitStep('rollback.items.delete', { ...errorInfo(rollbackError), hasUser: Boolean(uid) })
      throw new Error(`${e.message} ${translate('Some leftover data could not be cleaned up automatically.')}`)
    }
    recordSubmitStep('rollback.items.delete', rollback.error
      ? { ...errorInfo(rollback.error), hasUser: Boolean(uid) }
      : { ok: true, hasUser: Boolean(uid) })
    if (rollback.error) throw new Error(`${e.message} ${translate('Some leftover data could not be cleaned up automatically.')}`)
    throw e
  }
}

export async function updateItem(id, values) {
  const { data, error } = await supabase.from('items').update(toRow(values)).eq('id', id).select('id').maybeSingle()
  if (error) fail(error)
  if (!data) throw new Error(translate('This report could not be updated. It may have been removed or you may not have permission.'))
  requestAiMatching(id) // refresh embeddings/query when the description changed
}

export async function setItemStatus(id, status) {
  const { data, error } = await supabase.from('items').update({ status }).eq('id', id).select('id').maybeSingle()
  if (error) fail(error)
  if (!data) throw new Error(translate('This report status could not be changed. It may have been removed or you may not have permission.'))
  requestAiMatching(id)
}

export async function removeImage(image) {
  const { data, error } = await supabase.from('item_images').delete().eq('id', image.id).select('id').maybeSingle()
  if (error) fail(error)
  if (!data) throw new Error(translate('This photo could not be deleted. It may have already been removed or you may not have permission.'))
  const { error: storageError } = await supabase.storage.from(BUCKET).remove([image.path])
  forgetSignedUrls([image.path])
  if (storageError) fail(storageError)
}

export async function deleteItem(id) {
  const { data: imgs, error: imageQueryError } = await supabase.from('item_images').select('storage_path').eq('item_id', id)
  if (imageQueryError) fail(imageQueryError)
  const { data, error } = await supabase.from('items').delete().eq('id', id).select('id').maybeSingle()
  if (error) fail(error)
  if (!data) throw new Error(translate('This report could not be deleted. It may have already been removed or you may not have permission.'))
  if (imgs?.length) {
    const { error: storageError } = await supabase.storage.from(BUCKET).remove(imgs.map((i) => i.storage_path))
    forgetSignedUrls(imgs.map((i) => i.storage_path))
    if (storageError) fail(storageError)
  }
}

async function itemsByIds(ids) {
  const map = new Map()
  if (!ids.length) return map
  const own = await supabase.from('items').select('*').in('id', ids)
  if (own.error && own.error.code !== '42501') fail(own.error)
  const pub = await supabase.from('public_items').select('*').in('id', ids)
  if (pub.error) fail(pub.error)
  for (const it of await mapItems(pub.data || [])) map.set(it.id, it)
  for (const it of await mapItems(own.data || [])) map.set(it.id, { ...it, coverUrl: it.coverUrl || map.get(it.id)?.coverUrl || null }) // own rows carry no cover_path
  return map
}

export async function getMatches() {
  const uid = await me()
  const { data, error } = await supabase.from('matches').select('*').order('score', { ascending: false })
  if (error) fail(error)
  const visible = data.filter((m) => !m.dismissed_by.includes(uid))
  const items = await itemsByIds([...new Set(visible.flatMap((m) => [m.lost_item_id, m.found_item_id]))])
  return visible
    .map((m) => ({ id: m.id, score: m.score, reasons: m.reasons, status: m.status, lost: items.get(m.lost_item_id), found: items.get(m.found_item_id), myId: uid }))
    .filter((m) => m.lost && m.found)
}

export async function dismissMatch(id) {
  const { error } = await supabase.rpc('dismiss_match', { p_match_id: id })
  if (error) fail(error)
}

export async function requestContact(itemId, message, matchId = null) {
  const { data, error } = await supabase.rpc('create_contact_request', { p_item_id: itemId, p_message: message, p_match_id: matchId })
  if (error) fail(error)
  return data
}

export async function createFlag({ itemId, reason, details }) {
  const uid = await me()
  const { error } = await supabase.from('flags').insert({ reporter_id: uid, item_id: itemId, reason, details: details || null })
  if (error) fail(error)
}

export async function listNotifications() {
  const { data, error } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(50)
  if (error) fail(error)
  return data
}

export async function unreadCount() {
  const { count, error } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('is_read', false)
  if (error) fail(error)
  return count ?? 0
}

export async function markNotificationRead(id) {
  const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id)
  if (error) fail(error)
}

export async function markAllNotificationsRead() {
  const { error } = await supabase.from('notifications').update({ is_read: true }).eq('is_read', false)
  if (error) fail(error)
}

export async function listRequests() {
  const uid = await me()
  const { data, error } = await supabase.from('contact_requests').select('*').order('created_at', { ascending: false })
  if (error) fail(error)
  const items = await itemsByIds([...new Set(data.map((r) => r.item_id))])
  const { data: profiles, error: profilesError } = await supabase.from('contact_profiles').select('id, display_name').in('id', [...new Set(data.flatMap((r) => [r.requester_id, r.recipient_id]))])
  if (profilesError) fail(profilesError)
  const names = new Map((profiles || []).map((p) => [p.id, p.display_name]))
  return data.map((r) => {
    const incoming = r.recipient_id === uid
    return {
      id: r.id, itemId: r.item_id, itemName: items.get(r.item_id)?.name || translate('an item'), status: r.status, message: r.message,
      createdAt: r.created_at, direction: incoming ? 'incoming' : 'outgoing', otherName: names.get(incoming ? r.requester_id : r.recipient_id) || translate('User'),
    }
  })
}

export async function respondRequest(id, accept) {
  const { error } = await supabase.rpc('respond_contact_request', { p_request_id: id, p_accept: accept })
  if (error) fail(error)
}

export async function cancelRequest(id) {
  const { error } = await supabase.rpc('cancel_contact_request', { p_request_id: id })
  if (error) fail(error)
}

export async function listMessages(requestId) {
  const uid = await me()
  const { data, error } = await supabase.from('messages').select('*').eq('request_id', requestId).order('created_at')
  if (error) fail(error)
  return data.map((m) => ({ id: m.id, body: m.body, createdAt: m.created_at, mine: m.sender_id === uid }))
}

export async function sendMessage(requestId, body) {
  const uid = await me()
  const { error } = await supabase.from('messages').insert({ request_id: requestId, sender_id: uid, body: body.trim() })
  if (error) fail(error)
}

export async function updateProfile({ displayName, city }) {
  const uid = await me()
  const { data, error } = await supabase.from('profiles')
    .update({ display_name: displayName.trim(), city: city?.trim() || null })
    .eq('id', uid).select('id').maybeSingle()
  if (error) fail(error)
  if (!data) throw new Error(translate('Your profile could not be updated. Please sign in again and retry.'))
}

export async function getDashboard() {
  const [reports, matches, notes] = await Promise.all([getMyItems(), getMatches(), listNotifications()])
  return {
    reports,
    activity: notes.slice(0, 5).map((n) => `${translate(n.title)}: ${translate(n.body)}`),
    stats: {
      lost: reports.filter((i) => i.type === 'lost').length,
      found: reports.filter((i) => i.type === 'found').length,
      active: reports.filter((i) => i.status === 'active').length,
      matches: matches.length,
      resolved: reports.filter((i) => i.status === 'resolved').length,
    },
  }
}

const ADMIN_PAGE = 50
const adminMappers = {
  reports: (r) => ({ ...mapItem(r), hidden: r.is_hidden }),
  flags: (f) => ({ id: f.id, itemId: f.item_id, reportedUserId: f.reported_user_id || null, reason: f.reason, details: f.details || '', status: f.status }),
  users: (u) => ({ id: u.id, name: u.display_name, role: u.role, suspended: u.is_suspended, joined: u.created_at.slice(0, 10) }),
}
const adminTables = { reports: 'items', flags: 'flags', users: 'profiles' }

/** First page (50 rows) of each admin list plus the real totals; use listAdminPage for more. */
export async function getAdminData() {
  const page = (table) => supabase.from(table).select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(0, ADMIN_PAGE - 1)
  const [items, flags, users, stats] = await Promise.all([page('items'), page('flags'), page('profiles'), supabase.rpc('admin_stats')])
  for (const r of [items, flags, users, stats]) if (r.error) fail(r.error)
  return {
    reports: items.data.map(adminMappers.reports),
    flags: flags.data.map(adminMappers.flags),
    users: users.data.map(adminMappers.users),
    totals: { reports: items.count ?? items.data.length, flags: flags.count ?? flags.data.length, users: users.count ?? users.data.length },
    stats: { users: stats.data.users, reports: stats.data.reports, matches: stats.data.matches, openFlags: stats.data.open_flags },
  }
}

/** Next page of one admin list. kind = 'reports' | 'flags' | 'users'. */
export async function listAdminPage(kind, offset = 0) {
  const table = adminTables[kind]
  if (!table) throw new Error(translate('Something went wrong. Try again.'))
  const { data, error } = await supabase.from(table).select('*').order('created_at', { ascending: false }).range(offset, offset + ADMIN_PAGE - 1)
  if (error) fail(error)
  return data.map(adminMappers[kind])
}

export async function listAdminActions(limit = 100) {
  const { data, error } = await supabase.rpc('admin_list_actions', { p_limit: limit })
  if (error) fail(error)
  return data.map((a) => ({ id: a.id, createdAt: a.created_at, admin: a.admin_name, action: a.action, targetType: a.target_type, targetId: a.target_id, note: a.note || '' }))
}

export async function closeStaleItems(days = 90) {
  const { data, error } = await supabase.rpc('close_stale_items', { p_days: days })
  if (error) fail(error)
  return data
}

export async function adminSetHidden(id, hidden) {
  const { error } = await supabase.rpc('admin_set_item_hidden', { p_item_id: id, p_hidden: hidden })
  if (error) fail(error)
}

export async function adminSuspend(id, suspended) {
  const { error } = await supabase.rpc('admin_set_user_suspended', { p_user_id: id, p_suspended: suspended })
  if (error) fail(error)
}

export async function adminResolveFlag(id, status, note) {
  const { error } = await supabase.rpc('admin_resolve_flag', { p_flag_id: id, p_status: status, p_note: note || null })
  if (error) fail(error)
}

// ---------- realtime (Supabase Realtime; Row Level Security still decides which rows each user receives) ----------
function subscribe(name, table, filter, onChange) {
  const channel = supabase.channel(`${name}-${crypto.randomUUID()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table, ...(filter ? { filter } : {}) }, () => onChange())
    .subscribe()
  return () => { supabase.removeChannel(channel) }
}

export async function subscribeNotifications(onChange) {
  const uid = await me()
  return subscribe('notifications', 'notifications', `user_id=eq.${uid}`, onChange)
}

export async function subscribeMessages(requestId, onChange) {
  return subscribe('messages', 'messages', `request_id=eq.${requestId}`, onChange)
}

// ---------- privacy: data export and account deletion ----------
export async function exportMyData() {
  const { data, error } = await supabase.rpc('export_my_data')
  if (error) fail(error)
  return data
}

/** Removes the user's photo files (SQL cannot delete stored files), then the account and everything linked to it. */
export async function deleteMyAccount() {
  const uid = await me()
  for (let round = 0; round < 50; round += 1) {
    const { data: files, error } = await supabase.storage.from(BUCKET).list(uid, { limit: 100 })
    if (error) fail(error)
    if (!files?.length) break
    const { error: removeError } = await supabase.storage.from(BUCKET).remove(files.map((f) => `${uid}/${f.name}`))
    if (removeError) fail(removeError)
  }
  const { error } = await supabase.rpc('delete_my_account')
  if (error) fail(error)
  await supabase.auth.signOut()
}
