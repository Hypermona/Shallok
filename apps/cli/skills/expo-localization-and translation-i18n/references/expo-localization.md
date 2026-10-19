# Expo & React Native Technical Reference

## Configuration Pattern (`i18n.ts`)
React Native applications require static message loading because dynamic Node.js filesystem operations (`fs.readFile`) are not available in native runtimes.

```typescript
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';

import enMessages from './messages/runtime/en.json';
import knMessages from './messages/runtime/kn.json';
import hiMessages from './messages/runtime/hi.json';

const resources = {
  en: { translation: enMessages },
  kn: { translation: knMessages },
  hi: { translation: hiMessages },
};

const deviceLanguage = getLocales()[0]?.languageCode ?? 'en';

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: deviceLanguage,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
```

## React Native Component Rules
1. **Text Nodes**:
   Raw strings cannot exist outside `<Text>` in React Native.
   - Correct: `<Text>{t('auth.title')}</Text>`
   - Incorrect: `<div>{t('auth.title')}</div>`
2. **Prop Localizations**:
   - `<TextInput placeholder={t('form.email')} />`
   - `<Button title={t('actions.submit')} />`
3. **Alerts & Modals**:
   - `Alert.alert(t('common.confirm'), t('dialog.delete_body'))`
