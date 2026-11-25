import { useEffect, useRef, useState } from 'react'
import { MAX_IMAGES, validateImage } from '../../lib/validation.js'
import { useI18n } from '../../i18n/index.jsx'

export default function ImageUploader({ files, onChange, max = MAX_IMAGES }) {
  const { t } = useI18n()
  const inputRef = useRef(null)
  const [error, setError] = useState('')
  const [previews, setPreviews] = useState([])

  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f))
    setPreviews(urls)
    return () => urls.forEach((u) => URL.revokeObjectURL(u))
  }, [files])

  function handlePick(e) {
    const picked = Array.from(e.target.files || [])
    e.target.value = ''
    const next = [...files]
    let msg = ''
    for (const f of picked) {
      const problem = validateImage(f)
      if (problem) { msg = problem; continue }
      if (next.length >= max) { msg = max === 1 ? t('You can add 1 image.') : t('You can add up to {max} images.', { max }); break }
      next.push(f)
    }
    setError(msg)
    onChange(next)
  }

  return (
    <div>
      <input ref={inputRef} id="images" type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={handlePick} />
      <button type="button" className="btn-secondary" onClick={() => inputRef.current?.click()}>{t('Add photos')}</button>
      <span className="ms-3 text-xs text-slate-600">{max === 1 ? t('1 image, JPG, PNG or WebP, 5 MB.') : t('Up to {max} images, JPG, PNG or WebP, 5 MB each.', { max })}</span>
      {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
      {previews.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-3">
          {previews.map((src, i) => (
            <li key={src} className="relative">
              <img src={src} alt={t('Selected photo {n}', { n: i + 1 })} className="h-24 w-24 rounded-lg border border-slate-200 object-cover" />
              <button type="button" aria-label={t('Remove photo {n}', { n: i + 1 })} onClick={() => onChange(files.filter((_, idx) => idx !== i))}
                className="absolute -top-2 -end-2 h-6 w-6 rounded-full bg-ink-900 text-xs text-white">×</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
