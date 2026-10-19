# Framework Adapters Reference

## Supported Frameworks

### 1. React (`react-i18next`)
- **Initialization**: Generates `src/i18n.ts` configuring `i18next` with `initReactI18next`.
- **Runtime Messages**: Generates clean key-value message files in `messages/runtime/<locale>.json`.
- **AST Transformation**:
  - Adds `import { useTranslation } from 'react-i18next';`
  - Injects `const { t } = useTranslation();` in components
  - Replaces text with `{t('key')}`

### 2. Next.js (`next-intl`)
- **App Router Support**:
  - Generates `src/i18n/routing.ts` defining `locales` and `defaultLocale`.
  - Generates `src/i18n/request.ts` using `getRequestConfig`.
- **Runtime Messages**: Generates runtime message files in `messages/runtime/<locale>.json`.
- **AST Transformation**:
  - Adds `import { useTranslations } from 'next-intl';`
  - Injects `const t = useTranslations();` in components
  - Replaces text with `{t('key')}`

### 3. Expo / React Native (`expo-localization` + `react-i18next`)
- **Initialization**: Generates `i18n.ts` using `getLocales` from `expo-localization` and `i18next`.
- **Runtime Messages**: Generates runtime message files in `messages/runtime/<locale>.json`.
- **AST Transformation**:
  - Adds `import { useTranslation } from 'react-i18next';`
  - Injects `const { t } = useTranslation();` in mobile components
  - Replaces text inside `<Text>` and attributes like `placeholder` with `{t('key')}`

### 4. Astro (`astro:i18n`)
- **Initialization**: Generates `src/i18n/utils.ts` defining `locales`, `defaultLocale`, and `useTranslations`.
- **Runtime Messages**: Generates runtime message files in `messages/runtime/<locale>.json`.
- **Component Usage**:
  - In Astro components frontmatter: `const t = await useTranslations(locale);`
  - Renders `{t('key')}` in templates and islands.

### 5. Vue (`vue-i18n`)
- **Initialization**: Generates `src/i18n.ts` using `createI18n`.
- **Runtime Messages**: Generates runtime message files in `messages/runtime/<locale>.json`.
