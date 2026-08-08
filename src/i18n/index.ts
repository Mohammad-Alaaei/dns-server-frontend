import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import en from './locales/en/translation.json'

// Languages that use RTL
export const RTL_LANGUAGES = ['ar', 'he', 'fa', 'ur']

export const supportedLanguages = [
  { code: 'en', name: 'English', dir: 'ltr' as const },
]

const resources = {
  en: { translation: en },
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    lng: 'en',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  })

export function isRTL(lang: string): boolean {
  return RTL_LANGUAGES.includes(lang)
}

export function applyDocumentDirection(lang: string) {
  const dir = isRTL(lang) ? 'rtl' : 'ltr'
  document.documentElement.lang = lang
  document.documentElement.dir = dir
}

applyDocumentDirection(i18n.language || 'en')

i18n.on('languageChanged', (lng) => {
  applyDocumentDirection(lng)
})

export default i18n
