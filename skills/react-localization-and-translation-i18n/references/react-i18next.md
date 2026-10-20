# React & react-i18next Technical Reference

## Deployment Architecture: CDN-Backed Loading vs. Local Bundling

For React SPAs (Vite, Webpack), loading translations from a CDN allows continuous translation updates without redeploying the web frontend.

### 1. CDN Dynamic Loading Pattern (Recommended for Web SPAs)

Configure `.env`:
```env
VITE_TRANSLATIONS_CDN_URL=https://cdn.yourdomain.com/locales
```

`src/i18n.ts`:
```typescript
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Local bundled fallbacks (from our specified structure)
import enFallback from '../messages/runtime/en.json';
import knFallback from '../messages/runtime/kn.json';

const CDN_URL = import.meta.env.VITE_TRANSLATIONS_CDN_URL;

const resources = {
  en: { translation: enFallback },
  kn: { translation: knFallback },
};

export async function fetchRemoteTranslations(locale: string) {
  if (!CDN_URL) return;
  try {
    const res = await fetch(`${CDN_URL}/${locale}.json`);
    if (res.ok) {
      const messages = await res.json();
      i18n.addResourceBundle(locale, 'translation', messages, true, true);
      localStorage.setItem(`translations_${locale}`, JSON.stringify(messages));
    }
  } catch (err) {
    // Falls back seamlessly to bundled local messages
  }
}

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // React already escapes values safely
    },
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
- Update imports in `src/i18n.ts` and `src/main.tsx` to point to `../messages/runtime/en.json` (or CDN loader).
- Deprecate or remove `src/locales/en.json`.

---

## Hook Usage (`useTranslation`)
- Import: `import { useTranslation } from 'react-i18next';`
- Call inside functional component: `const { t, i18n } = useTranslation();`
- Text replacement: `<h1>{t('key')}</h1>`
- Interpolation: `{t('welcome_user', { name: user.name })}`
- Language switching: `i18n.changeLanguage('kn');`

## JSX Attributes to Localize
The Babel AST extractor automatically targets:
- `placeholder` (e.g. `<input placeholder={t('form.email_placeholder')} />`)
- `aria-label` (e.g. `<button aria-label={t('nav.close_menu')} />`)
- `title`
- `alt`
- `label`
