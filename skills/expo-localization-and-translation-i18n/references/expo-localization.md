# Expo & React Native Technical Reference

## Deployment Architecture: CDN-Backed Loading (OTA) vs. Local Bundling

Mobile apps benefit greatly from CDN-backed translation loading because updating text via App Store / Google Play requires full binary reviews.

### Critical Rules for Remote & CDN Translation Setups

1. **Existing Projects with Remote Fetching**:
   - If the project **already has a remote setup to fetch translations** (e.g. from Supabase, custom backend API, CDN, S3, or external service):
   - **DO NOT TOUCH OR MODIFY THE REMOTE FETCHING SETUP!** Keep the remote loader, caching logic, and endpoints intact.
   - **ONLY the default / source locale (e.g. `en`) translation should be done in Shallok's way**:
     - Maintain canonical keys in `localization_base/<source_locale>.json`.
     - Bundle ONLY the default locale fallback in `messages/runtime/<source_locale>.json` (or `messages/<source_locale>.json`).
     - Remote locales continue to be fetched via the project's existing remote setup.

2. **New Remote/CDN Setup**:
   - If user wants to load translations from CDN/remote:
   - **NO NEED TO HAVE FALLBACK FOR ALL LANGUAGES**: Do NOT create or statically import local fallback bundles for every language.
   - **ENSURE TARGET LOCALES ARE NOT BUNDLED WITH FINAL OUTPUT**:
     - **ONLY bundle the default/source locale** (e.g. `en`) as the initial/offline fallback.
     - **NEVER** statically import non-default locales (e.g. `kn`, `hi`, `fr`, `es`) into `i18n.ts` or app code!
     - Non-default locales are fetched on-demand from CDN / remote storage and cached in `AsyncStorage`.
     - This guarantees the production mobile binary stays minimal in size.

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

// ONLY the default/source locale is bundled as initial local fallback:
import enFallback from './messages/runtime/en.json';

const CDN_URL = process.env.EXPO_PUBLIC_TRANSLATIONS_CDN_URL;

// DO NOT statically import or bundle target locales (e.g. kn, hi, fr, es)!
// They are fetched dynamically on-demand from the CDN and cached in AsyncStorage.
const resources = {
  en: { translation: enFallback },
};

const deviceLanguage = getLocales()[0]?.languageCode ?? 'en';

export async function fetchRemoteTranslations(locale: string) {
  // If locale is default or already loaded, no network request needed
  if (locale === 'en' || !CDN_URL) return;

  // 1. Try loading from AsyncStorage cache first
  try {
    const cached = await AsyncStorage.getItem(`translations_${locale}`);
    if (cached) {
      i18n.addResourceBundle(locale, 'translation', JSON.parse(cached), true, true);
    }
  } catch {}

  // 2. Fetch fresh translation from CDN
  try {
    const res = await fetch(`${CDN_URL}/${locale}.json`);
    if (res.ok) {
      const messages = await res.json();
      i18n.addResourceBundle(locale, 'translation', messages, true, true);
      await AsyncStorage.setItem(`translations_${locale}`, JSON.stringify(messages));
    }
  } catch (err) {
    // If offline, falls back to cached bundle or default fallback (en)
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
