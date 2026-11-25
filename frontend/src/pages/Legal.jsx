import { Link } from 'react-router-dom'
import { useI18n } from '../i18n/index.jsx'

// Plain-language starter text. Have it reviewed by a qualified person for your country before a public launch.
const PAGES = {
  privacy: {
    title: 'Privacy notice',
    sections: [
      ['What we collect', 'Your email address and display name (account), the lost/found reports you write (item details, area, date, up to 3 photos), your contact requests and messages, and notifications generated for you.'],
      ['What other people can see', 'Public report pages show the item name, category, description, color, brand, general area, date and photos. Your email, phone number and any "private details" you add are never shown publicly. Messages are visible only to the two people in a contact thread.'],
      ['Photos', 'Report photos are stored in a private storage bucket. Public pages receive short-lived signed links, so guessing or sharing a raw storage URL does not grant access. Do not upload photos that show faces, ID cards, addresses or other personal data. When image-embedding enrichment is enabled, a photo may also be sent to an image-analysis service that returns a numeric fingerprint used only for matching.'],
      ['How matching works', 'Match suggestions are similarity estimates computed from the text of reports (name, category, description, color, brand, area and date), from the map distance when both reports have a pin, and from the photos when photo matching is enabled. They are not proof that two items are the same.'],
      ['Your choices', 'You can edit or delete your reports and photos at any time. You can also export your data or permanently delete your account from the Profile page.'],
      ['Moderation', 'Administrators can hide reports, suspend accounts and review reports flagged by users. Their actions are logged.'],
    ],
  },
  terms: {
    title: 'Terms of use',
    sections: [
      ['Using FindIt AI', 'Post only real lost or found items. Do not post misleading, offensive or unlawful content, and do not use the service to harass other people.'],
      ['Safety', 'Meet in a public place, ask for proof of ownership, and never share ID numbers, passwords or financial details. We do not verify the identity of users or the ownership of items.'],
      ['Matches', 'Suggested matches are estimates. You are responsible for deciding whether to contact someone and whether an item is yours.'],
      ['Moderation', 'We may hide reports or suspend accounts that break these terms or are flagged as abusive.'],
      ['No guarantee', 'The service is provided as is, without a guarantee that a lost item will be found.'],
    ],
  },
}

export default function Legal({ page }) {
  const { t } = useI18n()
  const p = PAGES[page]
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold">{t(p.title)}</h1>
      <p className="mt-1 text-sm text-slate-600">{t('Short version in plain language. Last updated November 2026.')}</p>
      {p.sections.map(([h, tx]) => (
        <section key={h} className="mt-6">
          <h2 className="font-semibold">{t(h)}</h2>
          <p className="mt-1 text-slate-700">{t(tx)}</p>
        </section>
      ))}
      <p className="mt-8 text-sm"><Link className="text-brand-700 hover:underline" to="/">{t('← Back to home')}</Link></p>
    </div>
  )
}
