# Next.js & next-intl Technical Reference

## Configuration Pattern

### 1. `src/i18n/routing.ts`
```typescript
import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['en', 'kn', 'hi'],
  defaultLocale: 'en',
});
```

### 2. `src/i18n/request.ts`
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
