/**
 * i18n bootstrap. Imported once for side effects from `main.jsx` before the
 * first render. Locale state lives in `useUIStore` (persisted via Zustand);
 * `App.jsx` syncs `useUIStore.language` -> `i18n.changeLanguage(lang)`.
 *
 * We deliberately skip i18next-browser-languagedetector and run with two
 * baked-in resources (`en`, `zh`) — keeps boot deterministic and trivial to
 * audit. All keys are nested under the default namespace (`translation`).
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import zh from './locales/zh.json';

export const SUPPORTED_LANGUAGES = ['en', 'zh'];
export const DEFAULT_LANGUAGE = 'en';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    zh: { translation: zh },
  },
  lng: DEFAULT_LANGUAGE,
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: SUPPORTED_LANGUAGES,
  interpolation: {
    escapeValue: false, // React already escapes values
  },
  returnNull: false,
});

/**
 * Map our short locale code to the BCP-47 tag used by Intl APIs.
 */
export function intlLocale(lang) {
  return lang === 'zh' ? 'zh-CN' : 'en-US';
}

export default i18n;
