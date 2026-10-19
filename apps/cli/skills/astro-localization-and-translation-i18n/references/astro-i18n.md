# Astro & astro:i18n Technical Reference

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
