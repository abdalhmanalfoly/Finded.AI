
import { useI18n } from '../../i18n/index.jsx'

export default function ScoreBar({ score }) {
  const { t } = useI18n()
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium">{t('Similarity estimate')}</span>
        <span className="font-semibold">{score}%</span>
      </div>
      <div className="mt-1 h-2 rounded-full bg-slate-200" role="progressbar" aria-valuenow={score} aria-valuemin={0} aria-valuemax={100} aria-label={t('Similarity estimate')}>
        <div className="h-2 rounded-full bg-accent-500" style={{ width: `${score}%` }} />
      </div>
      <p className="mt-1 text-xs text-slate-600">{t('An estimate, not proof that these are the same item.')}</p>
    </div>
  )
}
