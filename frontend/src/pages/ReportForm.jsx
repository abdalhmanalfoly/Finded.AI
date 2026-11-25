import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Field from '../components/ui/Field.jsx'
import ImageUploader from '../components/ui/ImageUploader.jsx'
import LocationPicker from '../components/ui/LocationPicker.jsx'
import { Spinner, ErrorState } from '../components/ui/States.jsx'
import { validateReport, MAX_IMAGES } from '../lib/validation.js'
import { CATEGORIES, COLORS } from '../data/sampleData.js'
import useAsync from '../hooks/useAsync.js'
import { createItem, updateItem, getItem, removeImage, uploadImages } from '../services/itemsService.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useI18n } from '../i18n/index.jsx'

const EMPTY = { name: '', category: '', description: '', location: '', city: '', date: '', time: '', color: '', brand: '', extra: '', lat: '', lng: '' }
const TIMES = ['Morning', 'Afternoon', 'Evening', 'Night', 'Not sure']

export default function ReportForm({ type: createType }) {
  const { t } = useI18n()
  const { id } = useParams()
  const editing = Boolean(id)
  const { isSuspended } = useAuth()
  const navigate = useNavigate()
  const existing = useAsync(() => (editing ? getItem(id) : Promise.resolve(null)), [id])

  const [v, setV] = useState(EMPTY)
  const [files, setFiles] = useState([])
  const [images, setImages] = useState([])
  const [removingId, setRemovingId] = useState('')
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value })

  const item = existing.data
  const type = editing ? item?.type : createType

  useEffect(() => {
    if (item) {
      setV({ name: item.name, category: item.category, description: item.description, location: item.location, city: item.city, date: item.date, time: item.time, color: item.color, brand: item.brand, extra: item.extra, lat: item.lat ?? '', lng: item.lng ?? '' })
      setImages(item.images || [])
    }
  }, [item])

  if (editing && existing.loading) return <Spinner label={t('Loading report')} />
  if (editing && (existing.error || !item?.isOwner)) {
    return <div className="mx-auto max-w-2xl px-4 py-12"><ErrorState title={t('Can’t edit this report')} text={t('It doesn’t exist, or it isn’t yours.')} onRetry={existing.reload} /></div>
  }

  const isLost = type === 'lost'

  async function onSubmit(e) {
    e.preventDefault()
    if (busy) return
    const errs = validateReport(v, type)
    setErrors(errs); setMessage('')
    if (Object.keys(errs).length > 0) { document.getElementById(Object.keys(errs)[0])?.focus(); return }
    if (isSuspended) { setMessage(t('Your account is suspended, so you can’t save reports.')); return }
    setBusy(true)
    try {
      if (editing) {
        await updateItem(id, v)
        const problem = files.length ? await uploadImages(id, files, images.length) : null
        navigate(`/items/${id}`, { state: { notice: problem || t('Report updated.') } })
      } else {
        const { id: newId, imageProblem } = await createItem(type, v, files)
        navigate(`/items/${newId}`, { state: { notice: imageProblem ? t('Report saved. {problem}', { problem: imageProblem }) : t('Report saved. We’ll notify you if we find a possible match.') } })
      }
    } catch (err) {
      setMessage(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function dropImage(img) {
    if (removingId) return
    setRemovingId(img.id)
    try { await removeImage(img); setImages((xs) => xs.filter((x) => x.id !== img.id)) } catch (err) { setMessage(err.message) } finally { setRemovingId('') }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold">{editing ? t('Edit your report') : isLost ? t('Report a lost item') : t('Report a found item')}</h1>
      <p className="mt-1 text-sm text-slate-600">{t('The more detail you add, the better the matches.')}</p>

      {isSuspended && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{t('Your account is suspended, so you can’t save reports.')}</p>}

      <div className="mt-4 rounded-lg bg-brand-50 p-3 text-sm text-ink-900">
        {t('Privacy tip: don’t enter passwords, serial numbers, ID numbers or your exact home address. Keep one detail private to prove ownership later.')}
      </div>

      <form onSubmit={onSubmit} noValidate className="mt-6 space-y-8">
        <fieldset className="card space-y-4">
          <legend className="px-1 font-semibold">{t('Item')}</legend>
          <Field label={t('Item name')} id="name" error={errors.name}>
            <input id="name" className="input" maxLength={100} placeholder={t('Black Samsung phone')} value={v.name} onChange={set('name')} />
          </Field>
          <Field label={t('Category')} id="category" error={errors.category}>
            <select id="category" className="input" value={v.category} onChange={set('category')}>
              <option value="">{t('Choose a category')}</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{t(c)}</option>)}
            </select>
          </Field>
          <Field label={t('Description')} id="description" error={errors.description}>
            <textarea id="description" rows={4} maxLength={1000} className="input" placeholder={t('Cracked clear case, blue lanyard')} value={v.description} onChange={set('description')} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('Color')} id="color" error={errors.color}>
              <select id="color" className="input" value={v.color} onChange={set('color')}>
                <option value="">{t('Choose a color')}</option>
                {COLORS.map((c) => <option key={c} value={c}>{t(c)}</option>)}
              </select>
            </Field>
            {isLost && (
              <Field label={t('Brand (optional)')} id="brand">
                <input id="brand" className="input" maxLength={60} placeholder={t('Samsung')} value={v.brand} onChange={set('brand')} />
              </Field>
            )}
          </div>
        </fieldset>

        <fieldset className="card space-y-4">
          <legend className="px-1 font-semibold">{t('Where and when')}</legend>
          <Field label={isLost ? t('Last known location') : t('Where you found it')} id="location" error={errors.location} hint={t('A general area is enough, such as a street or landmark.')}>
            <input id="location" className="input" maxLength={200} placeholder={t('Maadi, near the metro station')} value={v.location} onChange={set('location')} />
          </Field>
          <LocationPicker lat={v.lat} lng={v.lng} onChange={(c) => setV((x) => ({ ...x, ...c }))} error={errors.lat} />
          <Field label={t('City')} id="city" error={errors.city}>
            <input id="city" className="input" maxLength={80} placeholder={t('Cairo')} value={v.city} onChange={set('city')} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={isLost ? t('Date lost') : t('Date found')} id="date" error={errors.date}>
              <input id="date" type="date" className="input" value={v.date} onChange={set('date')} />
            </Field>
            <Field label={t('Approximate time')} id="time">
              <select id="time" className="input" value={v.time} onChange={set('time')}>
                <option value="">{t('Choose a time')}</option>
                {TIMES.map((tm) => <option key={tm} value={tm}>{t(tm)}</option>)}
              </select>
            </Field>
          </div>
        </fieldset>

        <fieldset className="card space-y-4">
          <legend className="px-1 font-semibold">{t('Photos and extra details')}</legend>
          {images.length > 0 && (
            <ul className="flex flex-wrap gap-3">
              {images.map((img, i) => (
                <li key={img.id} className="relative">
                  <img src={img.url} alt={t('Saved photo {n}', { n: i + 1 })} className="h-24 w-24 rounded-lg border border-slate-200 object-cover" />
                  <button type="button" aria-label={t('Delete saved photo {n}', { n: i + 1 })} disabled={Boolean(removingId)} onClick={() => dropImage(img)} className="absolute -top-2 -end-2 h-6 w-6 rounded-full bg-red-600 text-xs text-white">×</button>
                </li>
              ))}
            </ul>
          )}
          <ImageUploader files={files} onChange={setFiles} max={MAX_IMAGES - images.length} />
          <Field label={t('Additional details (optional)')} id="extra" hint={t('Only you can see this. Use it for private details that prove ownership.')}>
            <textarea id="extra" rows={3} maxLength={1000} className="input" value={v.extra} onChange={set('extra')} />
          </Field>
        </fieldset>

        {message && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{message}</p>}
        {Object.keys(errors).length > 0 && <p role="alert" className="text-sm text-red-700">{t('Fix the highlighted fields and try again.')}</p>}

        <div className="flex gap-3">
          <button type="submit" disabled={busy || isSuspended} className="btn-primary">{busy ? t('Saving…') : editing ? t('Save changes') : t('Submit report')}</button>
          <Link to={editing ? `/items/${id}` : isLost ? '/lost' : '/found'} className="btn-secondary">{t('Cancel')}</Link>
        </div>
      </form>
    </div>
  )
}
