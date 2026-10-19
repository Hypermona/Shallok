# React & react-i18next Technical Reference

## Configuration Pattern (`src/i18n.ts`)
Shallok sets up a deterministic configuration importing compiled runtime message bundles from `messages/runtime/`:

```typescript
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enMessages from '../messages/runtime/en.json';
import knMessages from '../messages/runtime/kn.json';
import hiMessages from '../messages/runtime/hi.json';

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
      escapeValue: false, // React already escapes values safely
    },
  });

export default i18n;
```

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
