import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enMessages from '../messages/en.json';
import knMessages from '../messages/kn.json';
import hiMessages from '../messages/hi.json';

const resources = {
  en: { translation: enMessages },
  kn: { translation: knMessages },
  hi: { translation: hiMessages },
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
