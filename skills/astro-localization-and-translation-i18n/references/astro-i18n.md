# Astro & astro:i18n Technical Reference

## Loading Architecture: Local Bundled Loading for Static SSG & SSR

For Astro websites and applications, **always keep translations LOCAL** in `messages/runtime/<locale>.json`.
- **Zero Build-Time Latency**: Static site generation renders all pages without making external HTTP requests.
- **Resilient Static Output**: Builds do not fail when third-party CDN or bucket services are unreachable.
- **Instant Hydration**: HTML pages already include the translated strings directly in the static markup.

### Legacy Base Locale Migration
If an existing Astro app was importing from `src/locales/en.json` or `locales/en.json`:
1. Reconcile keys into `localization_base/en.json`.
2. Update the dynamic import in `src/i18n/utils.ts` to target `../../messages/runtime/${locale}.json`.
3. Deprecate and remove the old legacy locale folder.

---

## Configuration Pattern

### 1. `astro.config.mjs`
```javascript
import { defineConfig } from 'astro/config';

export default defineConfig({
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'kn', 'hi'],
    routing: {
      prefixDefaultLocale: false,
    },
  },
});
```

### 2. `src/i18n/utils.ts`
```typescript
export const defaultLocale = 'en';
export const locales = ['en', 'kn', 'hi'] as const;

export type Locale = (typeof locales)[number];

export async function useTranslations(locale: Locale) {
  const messages = (await import(`../../messages/runtime/${locale}.json`)).default;

  return function t(key: string): string {
    return (messages as Record<string, string>)[key] || key;
  };
}
```

## Routing Conventions
- Root / Default Locale: `src/pages/index.astro`
- Subpath / Translated Locales: `src/pages/[locale]/index.astro`
- Current Locale Access: `Astro.currentLocale`
- Preferred Locale Detection: `Astro.preferredLocale`
