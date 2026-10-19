# Framework Adapters Reference

## Supported Frameworks

### 1. React (`react-i18next`)
- **Initialization**: Generates `src/i18n.ts` configuring `i18next` with `initReactI18next`.
- **Runtime Messages**: Generates clean key-value message files in `messages/<locale>.json`.
- **AST Transformation**:
  - Adds `import { useTranslation } from 'react-i18next';`
  - Injects `const { t } = useTranslation();` in components
  - Replaces text with `{t('key')}`

### 2. Next.js (`next-intl`)
- **App Router Support**:
  - Generates `src/i18n/routing.ts` defining `locales` and `defaultLocale`.
  - Generates `src/i18n/request.ts` using `getRequestConfig`.
- **Runtime Messages**: Generates runtime message files in `messages/<locale>.json`.
- **AST Transformation**:
  - Adds `import { useTranslations } from 'next-intl';`
  - Injects `const t = useTranslations();` in components
  - Replaces text with `{t('key')}`

### 3. Vue (`vue-i18n`)
- **Initialization**: Generates `src/i18n.ts` using `createI18n`.
- **Runtime Messages**: Generates nested runtime message files in `messages/<locale>.json`.
