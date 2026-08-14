import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import hi from './locales/hi.json';

const STORAGE_KEY = 'hs_admin_web_lang';

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    hi: { translation: hi },
  },
  lng: localStorage.getItem(STORAGE_KEY) || 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export function setAppLanguage(lng: 'en' | 'hi') {
  localStorage.setItem(STORAGE_KEY, lng);
  void i18n.changeLanguage(lng);
}

export default i18n;
