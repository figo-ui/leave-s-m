import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import am from './locales/am.json';
import om from './locales/om.json';

const storedLanguage = localStorage.getItem('language') || 'en';

const resources = {
  en: { translation: en },
  am: { translation: am },
  om: { translation: om }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: storedLanguage,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
