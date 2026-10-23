# React & react-i18next Technical Reference

## Deployment Architecture: CDN-Backed Loading vs. Local Bundling

For React SPAs (Vite, Webpack), loading translations from a CDN allows continuous translation updates without redeploying the web frontend.

### Critical Rules for Remote & CDN Translation Setups

1. **Existing Projects with Remote Fetching**:
   - If the project **already has a remote setup to fetch translations** (e.g. from backend API, Supabase, CDN, S3, or external service):
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
     - **NEVER** statically import non-default locales (e.g. `kn`, `hi`, `fr`, `es`) into `src/i18n.ts` or app code!
     - Non-default locales are fetched on-demand from CDN / remote storage and cached in `localStorage`.
     - This guarantees the production web bundle stays small.

### 1. CDN Dynamic Loading Pattern (Recommended for Web SPAs)

Configure `.env`:
```env
VITE_TRANSLATIONS_CDN_URL=https://cdn.yourdomain.com/locales
```

`src/i18n.ts`:
```typescript
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// ONLY the default/source locale is bundled as initial local fallback:
import enFallback from '../messages/runtime/en.json';

const CDN_URL = import.meta.env.VITE_TRANSLATIONS_CDN_URL;

// DO NOT statically import or bundle target locales (e.g. kn, hi, fr, es)!
// They are fetched dynamically on-demand from the CDN and cached in localStorage.
const resources = {
  en: { translation: enFallback },
};

export async function fetchRemoteTranslations(locale: string) {
  if (locale === 'en' || !CDN_URL) return;

  // 1. Try localStorage cache first
  try {
    const cached = localStorage.getItem(`translations_${locale}`);
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
      localStorage.setItem(`translations_${locale}`, JSON.stringify(messages));
    }
  } catch (err) {
    // Falls back seamlessly to cached bundle or default fallback (en)
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
