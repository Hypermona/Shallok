## Loading Architecture: Local Bundled Loading for Server Components & SSR

For Next.js App Router and Pages Router, **always keep translations LOCAL** in `messages/runtime/<locale>.json`.
- **Zero Network Latency**: Server Components and Edge middleware resolve dictionaries directly from memory/disk without remote HTTP requests.
- **Resilient Builds**: Static site exports and SSR hydration never fail due to external CDN outages.

### Legacy Base Locale Migration
If an existing Next.js app was importing from `src/locales/en.json` or `locales/en.json`:
1. Reconcile keys into `localization_base/en.json`.
2. Update the dynamic import in `src/i18n/request.ts` to target `../../messages/runtime/${locale}.json`.
3. Deprecate and remove the old legacy locale folder.

---

## Configuration Pattern

### 1. `src/i18n/routing.ts`
```typescript
import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['en', 'kn', 'hi'],
  defaultLocale: 'en',
});
```

### 2. `src/i18n/request.ts` (Loads Local `messages/runtime/`)
```typescript
import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  if (!locale || !routing.locales.includes(locale as any)) {
    locale = routing.defaultLocale;
  }

  return {
    locale,
    messages: (await import(`../../messages/runtime/${locale}.json`)).default,
  };
});
```

### 3. `middleware.ts`
```typescript
import createMiddleware from 'next-intl/middleware';
import { routing } from './src/i18n/routing';

export default createMiddleware(routing);

export const config = {
  matcher: ['/', '/(kn|hi|en)/:path*']
};
```

## Hook & Async Usage
- **Server Components**:
  ```typescript
  import { getTranslations } from 'next-intl/server';
  const t = await getTranslations();
  ```
- **Client Components**:
  ```typescript
  'use client';
  import { useTranslations } from 'next-intl';
  const t = useTranslations();
  ```
- **Navigation**:
  ```typescript
  import { createNavigation } from 'next-intl/navigation';
  import { routing } from './routing';
  export const { Link, redirect, usePathname, useRouter } = createNavigation(routing);
  ```
