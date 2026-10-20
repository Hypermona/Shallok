# Expo & React Native Technical Reference

## Deployment Architecture: CDN-Backed Loading (OTA) vs. Local Bundling

Mobile apps benefit greatly from CDN-backed translation loading because updating text via App Store / Google Play requires full binary reviews.

### 1. CDN Dynamic Loading Pattern (Recommended for Production & OTA Updates)

Configure `.env`:
```env
EXPO_PUBLIC_TRANSLATIONS_CDN_URL=https://cdn.yourdomain.com/locales
```

`i18n.ts`:
```typescript
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Local bundled fallbacks (from our specified structure)
import enFallback from './messages/runtime/en.json';
import knFallback from './messages/runtime/kn.json';

const CDN_URL = process.env.EXPO_PUBLIC_TRANSLATIONS_CDN_URL;

const resources = {
  en: { translation: enFallback },
  kn: { translation: knFallback },
};

const deviceLanguage = getLocales()[0]?.languageCode ?? 'en';

export async function fetchRemoteTranslations(locale: string) {
  if (!CDN_URL) return;
  try {
    const res = await fetch(`${CDN_URL}/${locale}.json`);
    if (res.ok) {
      const messages = await res.json();
      i18n.addResourceBundle(locale, 'translation', messages, true, true);
      await AsyncStorage.setItem(`translations_${locale}`, JSON.stringify(messages));
    }
  } catch (err) {
    // Falls back seamlessly to bundled local messages
  }
}

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: deviceLanguage,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });

export default i18n;
```

### 2. Upload Script (`scripts/upload-locales.mjs`)
Suggest creating an upload script to sync `messages/runtime/` to CDN/bucket:
```javascript
import fs from 'node:fs';
import path from 'node:path';

// Upload all JSON files in messages/runtime/ to Cloudflare R2 / S3 / Supabase Storage
const runtimeDir = path.resolve('messages/runtime');
const files = fs.readdirSync(runtimeDir);
for (const file of files) {
  console.log(`Uploading ${file} to CDN...`);
}
```

### 3. Legacy Base Locale Migration
If existing code imported `src/locales/en.json`:
- Reconcile keys into `localization_base/en.json`.
- Update imports in `i18n.ts` and `app/_layout.tsx` to point to `./messages/runtime/en.json` (or CDN loader).
- Deprecate or remove `src/locales/en.json`.

---

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
