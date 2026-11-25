import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { LANGS, STORAGE_KEY, detectLanguage, setLanguage, translate, currentLocale } from './core.js'

export { LANGS, translate, currentLocale }

const I18nContext = createContext({ t: translate, lang: 'en', dir: 'ltr', setLang: () => {} })

export function I18nProvider({ children, initialLang }) {
  const [lang, setLangState] = useState(() => (initialLang && LANGS[initialLang] ? initialLang : detectLanguage()))
  setLanguage(lang) // set during render so child components and services see the right language immediately

  useEffect(() => {
    if (typeof document === 'undefined') return
    document.documentElement.lang = lang
    document.documentElement.dir = LANGS[lang].dir
    try { localStorage.setItem(STORAGE_KEY, lang) } catch { /* ignore */ }
  }, [lang])

  const value = useMemo(() => ({ t: translate, lang, dir: LANGS[lang].dir, setLang: (l) => { if (LANGS[l]) setLangState(l) } }), [lang])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export const useI18n = () => useContext(I18nContext)
