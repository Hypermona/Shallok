# Framework Adapters Reference

## Loading Strategies: Local vs. CDN

| Framework Type | Recommended Strategy | Primary Rationale | Configuration & ENV |
| :--- | :--- | :--- | :--- |
| **Astro** (`astro:i18n`) | **Local** (`messages/runtime/`) | Static builds (SSG) & SSR; zero network hops, zero build dependency on external services. | Bundled in `src/i18n/utils.ts` |
| **Next.js** (`next-intl`) | **Local** (`messages/runtime/`) | Server Components & SSR; instant First Contentful Paint, zero latency in Node/Edge. | Bundled in `src/i18n/request.ts` |
| **Expo / React Native** | **CDN-Backed** (+ Local Fallback) | Instant Over-The-Air (OTA) translation & typo fixes without waiting for App Store review. | `EXPO_PUBLIC_TRANSLATIONS_CDN_URL` + AsyncStorage caching (default locale only bundled) |
| **React SPA** (Vite / CRA) | **CDN-Backed** (+ Local Fallback) | Instant copy updates without rebuilding web bundle. | `VITE_TRANSLATIONS_CDN_URL` + localStorage caching (default locale only bundled) |

---

## Supported Frameworks & Adapters

### 1. React (`react-i18next`)
- **Initialization**: Generates `src/i18n.ts` configuring `i18next` with `initReactI18next`.
- **Runtime Messages**: Generates clean key-value message files in `messages/runtime/<locale>.json`.
- **Remote & CDN Loading**:
  - If project already has remote fetching setup: **DO NOT TOUCH** it. Only manage default locale (`en`) the Shallok way.
  - If setting up CDN loading: No fallback for all languages. **Ensure target locales are NOT bundled with final output**; only bundle default locale (`en`).
- **Legacy Migration**: If `src/main.tsx` or `src/i18n.ts` imported `src/locales/en.json`, migrate to `messages/runtime/` or CDN loader.
- **AST Transformation**:
  - Adds `import { useTranslation } from 'react-i18next';`
  - Injects `const { t } = useTranslation();` in components
  - Replaces text with `{t('key')}` using normalized dot-separated key paths.

### 2. Next.js (`next-intl`)
- **App Router Support**:
  - Generates `src/i18n/routing.ts` defining `locales` and `defaultLocale`.
  - Generates `src/i18n/request.ts` using `getRequestConfig` loading local `messages/runtime/<locale>.json`.
- **Runtime Messages**: Generates runtime message files in `messages/runtime/<locale>.json`.
- **Loading Strategy**: Local loading recommended for Server Components and SSR.
- **Legacy Migration**: If `src/i18n/request.ts` or `middleware.ts` imported old locale JSONs, update imports to `messages/runtime/<locale>.json`.
- **AST Transformation**:
  - Adds `import { useTranslations } from 'next-intl';`
  - Injects `const t = useTranslations();` in components
  - Replaces text with `{t('key')}` using normalized dot-separated key paths.

### 3. Expo / React Native (`expo-localization` + `react-i18next`)
- **Initialization**: Generates `i18n.ts` using `getLocales` from `expo-localization` and `i18next`.
- **Runtime Messages**: Generates runtime message files in `messages/runtime/<locale>.json`.
- **Remote & CDN Loading**:
  - If project already has remote fetching setup: **DO NOT TOUCH** it. Only manage default locale (`en`) the Shallok way.
  - If setting up CDN loading: No fallback for all languages. **Ensure target locales are NOT bundled with final output**; only bundle default locale (`en`).
- **Legacy Migration**: If `app/_layout.tsx` or `src/i18n.ts` imported `src/locales/en.json`, migrate to `messages/runtime/` or CDN loader.
- **AST Transformation**:
  - Adds `import { useTranslation } from 'react-i18next';`
  - Injects `const { t } = useTranslation();` in mobile components
  - Replaces text inside `<Text>` and attributes like `placeholder` with `{t('key')}` using normalized dot-separated key paths.

### 4. Astro (`astro:i18n`)
- **Initialization**: Generates `src/i18n/utils.ts` defining `locales`, `defaultLocale`, and `useTranslations` loading local `messages/runtime/<locale>.json`.
- **Runtime Messages**: Generates runtime message files in `messages/runtime/<locale>.json`.
- **Loading Strategy**: Local loading recommended for fast static SSG and hybrid SSR.
- **Legacy Migration**: If `src/i18n/utils.ts` or `.astro` files imported old locale JSONs, update imports to `messages/runtime/<locale>.json`.
- **Component Usage**:
  - In Astro components frontmatter: `const t = await useTranslations(locale);`
  - Renders `{t('key')}` in templates and islands using normalized dot-separated key paths.

### 5. Vue (`vue-i18n`)
- **Initialization**: Generates `src/i18n.ts` using `createI18n`.
- **Runtime Messages**: Generates runtime message files in `messages/runtime/<locale>.json`.
