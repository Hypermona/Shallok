import { describe, it, expect } from 'vitest';
import {
  computeContentHash,
  generateSemanticKey,
  reconcileCanonicalCatalog,
  reconcileLocaleCatalog,
  extractStringsFromSource,
  transformSourceFile,
  validateCatalogs,
  renameKey,
  CanonicalCatalog,
  LocaleCatalog,
  LocalizationManifest,
} from '../packages/core/src/index.js';

describe('Content Hashing', () => {
  it('generates deterministic sha256 hash', () => {
    const hash1 = computeContentHash('Pay now', 'Checkout button');
    const hash2 = computeContentHash('Pay now', 'Checkout button');
    const hash3 = computeContentHash('Pay now', 'Different context');

    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(hash1).not.toBe(hash3);
  });
});

describe('Semantic Key Generation', () => {
  it('derives semantic keys from file path and content', () => {
    const key = generateSemanticKey({
      filePath: 'src/components/checkout/PaymentForm.tsx',
      content: 'Pay now',
    });
    expect(key).toBe('checkout.pay_now');
  });

  it('handles collisions by appending context or counter', () => {
    const existing = new Map<string, string>([
      ['checkout.pay_now', 'Pay now'],
    ]);

    // Same content reuses key
    const reused = generateSemanticKey({
      filePath: 'src/components/checkout/PaymentForm.tsx',
      content: 'Pay now',
      existingKeys: existing,
    });
    expect(reused).toBe('checkout.pay_now');

    // Collision disambiguates using context
    const disambiguated = generateSemanticKey({
      filePath: 'src/components/checkout/PaymentForm.tsx',
      content: 'Pay now',
      context: 'secondary',
      existingKeys: new Set(['checkout.pay_now']), // simulate collision in set
    });
    expect(disambiguated).toBe('checkout.pay_now_secondary');
  });
});

describe('Reconciliation & Per-Key Versioning', () => {
  it('initializes new keys at version 1 and active status', () => {
    const extracted = [
      {
        suggestedKey: 'checkout.pay_now',
        content: 'Pay now',
        context: 'button',
        occurrence: { relative_file_path: 'src/checkout.tsx', line: 10 },
      },
    ];

    const result = reconcileCanonicalCatalog({
      currentCatalog: {},
      extractedStrings: extracted,
      now: '2026-10-19T10:00:00.000Z',
    });

    expect(result.diff.addedKeys).toContain('checkout.pay_now');
    expect(result.catalog['checkout.pay_now'].key_version).toBe(1);
    expect(result.catalog['checkout.pay_now'].status).toBe('active');
  });

  it('increments version ONLY when content or context changes', () => {
    const initialCatalog: CanonicalCatalog = {
      'checkout.pay_now': {
        key: 'checkout.pay_now',
        content: 'Pay now',
        context: 'button',
        relative_file_path: 'src/checkout.tsx',
        occurrences: [{ relative_file_path: 'src/checkout.tsx', line: 10 }],
        last_updated_at: '2026-10-19T10:00:00.000Z',
        key_version: 1,
        content_hash: computeContentHash('Pay now', 'button'),
        status: 'active',
      },
      'header.title': {
        key: 'header.title',
        content: 'Welcome',
        context: '',
        relative_file_path: 'src/header.tsx',
        occurrences: [{ relative_file_path: 'src/header.tsx', line: 5 }],
        last_updated_at: '2026-10-19T10:00:00.000Z',
        key_version: 1,
        content_hash: computeContentHash('Welcome', ''),
        status: 'active',
      },
    };

    // pay_now content changes, header.title is unchanged
    const extracted = [
      {
        suggestedKey: 'checkout.pay_now',
        content: 'Complete Payment',
        context: 'button',
        occurrence: { relative_file_path: 'src/checkout.tsx', line: 10 },
      },
      {
        suggestedKey: 'header.title',
        content: 'Welcome',
        context: '',
        occurrence: { relative_file_path: 'src/header.tsx', line: 5 },
      },
    ];

    const result = reconcileCanonicalCatalog({
      currentCatalog: initialCatalog,
      extractedStrings: extracted,
      now: '2026-10-19T11:00:00.000Z',
    });

    // checkout.pay_now version incremented to 2
    expect(result.catalog['checkout.pay_now'].key_version).toBe(2);
    expect(result.catalog['checkout.pay_now'].last_updated_at).toBe('2026-10-19T11:00:00.000Z');
    expect(result.diff.modifiedKeys).toContain('checkout.pay_now');

    // header.title preserved at version 1
    expect(result.catalog['header.title'].key_version).toBe(1);
    expect(result.catalog['header.title'].last_updated_at).toBe('2026-10-19T10:00:00.000Z');
    expect(result.diff.unchangedKeys).toContain('header.title');
  });

  it('marks removed keys obsolete without deleting', () => {
    const initialCatalog: CanonicalCatalog = {
      'old.banner': {
        key: 'old.banner',
        content: 'Special Offer',
        context: '',
        relative_file_path: 'src/banner.tsx',
        occurrences: [{ relative_file_path: 'src/banner.tsx', line: 5 }],
        last_updated_at: '2026-10-19T10:00:00.000Z',
        key_version: 1,
        content_hash: computeContentHash('Special Offer', ''),
        status: 'active',
      },
    };

    const result = reconcileCanonicalCatalog({
      currentCatalog: initialCatalog,
      extractedStrings: [],
      preserveObsoleteKeys: true,
    });

    expect(result.diff.obsoleteKeys).toContain('old.banner');
    expect(result.catalog['old.banner'].status).toBe('obsolete');
    expect(result.catalog['old.banner'].occurrences).toEqual([]);
  });

  it('detects stale translations in locale catalog when source version increments', () => {
    const canonical: CanonicalCatalog = {
      'checkout.pay_now': {
        key: 'checkout.pay_now',
        content: 'Complete Payment',
        context: '',
        relative_file_path: 'src/checkout.tsx',
        occurrences: [{ relative_file_path: 'src/checkout.tsx', line: 10 }],
        last_updated_at: '2026-10-19T11:00:00.000Z',
        key_version: 2,
        content_hash: computeContentHash('Complete Payment', ''),
        status: 'active',
      },
    };

    const localeCatalog: LocaleCatalog = {
      'checkout.pay_now': {
        value: 'Payer maintenant',
        source_version: 1, // Stale! Canonical is version 2
        translated_at: '2026-10-19T10:00:00.000Z',
        status: 'translated',
      },
    };

    const reconciled = reconcileLocaleCatalog({
      canonicalCatalog: canonical,
      localeCatalog,
      locale: 'fr',
    });

    expect(reconciled.staleCount).toBe(1);
    expect(reconciled.catalog['checkout.pay_now'].status).toBe('stale');
    expect(reconciled.catalog['checkout.pay_now'].value).toBe('Payer maintenant'); // Preserved
  });
});

describe('AST String Extraction and Transformation', () => {
  it('extracts JSXText and user-facing attributes', () => {
    const sampleCode = `
      import React from 'react';

      export function LoginForm() {
        console.log('Rendering form');
        return (
          <div className="container">
            <h1>Sign in to your account</h1>
            <input placeholder="Enter your email" type="email" />
            <button aria-label="Submit login form">Sign In</button>
          </div>
        );
      }
    `;

    const extracted = extractStringsFromSource({
      filePath: 'src/components/LoginForm.tsx',
      code: sampleCode,
    });

    const contents = extracted.strings.map((s) => s.content);
    expect(contents).toContain('Sign in to your account');
    expect(contents).toContain('Enter your email');
    expect(contents).toContain('Submit login form');
    expect(contents).toContain('Sign In');
    // console.log and className container must NOT be extracted
    expect(contents).not.toContain('Rendering form');
    expect(contents).not.toContain('container');
  });

  it('transforms code safely by replacing strings and injecting hook', () => {
    const sampleCode = `
      import React from 'react';

      export function LoginForm() {
        return (
          <div>
            <h1>Sign In</h1>
          </div>
        );
      }
    `;

    const result = transformSourceFile({
      filePath: 'src/components/LoginForm.tsx',
      code: sampleCode,
      framework: 'react',
    });

    expect(result.changed).toBe(true);
    expect(result.transformedCode).toMatch(/useTranslation/);
    expect(result.transformedCode).toMatch(/react-i18next/);
    expect(result.transformedCode).toMatch(/t\(["']loginform\.sign_in["']\)/);
  });
});

describe('Catalog Validation', () => {
  it('flags missing keys, stale translations, and missing placeholders', () => {
    const manifest: LocalizationManifest = {
      schema_version: 1,
      localization_version: 1,
      source_locale: 'en',
      supported_locales: ['en', 'fr'],
      framework: { name: 'react', router: null, localization_library: 'react-i18next', library_version: null },
      paths: { source_directories: ['src'], base_directory: 'localization_base', translations_directory: 'messages' },
      key_strategy: 'semantic',
      translation: { provider: null, model: null, batch_size: 25 },
      options: {
        include_accessibility_text: true,
        preserve_obsolete_keys: true,
        require_review_for_ambiguous_strings: true,
        require_review_for_stale_translations: true,
      },
    };

    const canonical: CanonicalCatalog = {
      'greeting.welcome': {
        key: 'greeting.welcome',
        content: 'Hello, {userName}!',
        context: '',
        relative_file_path: 'src/greeting.tsx',
        occurrences: [{ relative_file_path: 'src/greeting.tsx', line: 1 }],
        last_updated_at: '2026-10-19T10:00:00.000Z',
        key_version: 2,
        content_hash: computeContentHash('Hello, {userName}!', ''),
        status: 'active',
      },
    };

    // fr translation is missing {userName} placeholder and has stale source_version
    const locales: Record<string, LocaleCatalog> = {
      fr: {
        'greeting.welcome': {
          value: 'Bonjour le monde!', // missing {userName}
          source_version: 1, // stale
          translated_at: '2026-10-19T09:00:00.000Z',
          status: 'translated',
        },
      },
    };

    const validation = validateCatalogs({
      manifest,
      canonicalCatalog: canonical,
      localeCatalogs: locales,
    });

    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => e.type === 'missing_placeholder')).toBe(true);
    expect(validation.warnings.some((w) => w.type === 'stale_version')).toBe(true);
  });
});

describe('Key Renaming', () => {
  it('safely renames key across canonical and locale catalogs', async () => {
    const canonical: CanonicalCatalog = {
      'old.key': {
        key: 'old.key',
        content: 'Sign In',
        context: '',
        relative_file_path: 'src/login.tsx',
        occurrences: [{ relative_file_path: 'src/login.tsx', line: 1 }],
        last_updated_at: '2026-10-19T10:00:00.000Z',
        key_version: 1,
        content_hash: computeContentHash('Sign In', ''),
        status: 'active',
      },
    };

    const locales: Record<string, LocaleCatalog> = {
      fr: {
        'old.key': {
          value: 'Se connecter',
          source_version: 1,
          translated_at: '2026-10-19T10:00:00.000Z',
          status: 'translated',
        },
      },
    };

    const result = await renameKey({
      projectRoot: process.cwd(),
      oldKey: 'old.key',
      newKey: 'auth.login',
      canonicalCatalog: canonical,
      localeCatalogs: locales,
    });

    expect(result.canonicalUpdated).toBe(true);
    expect(canonical['old.key']).toBeUndefined();
    expect(canonical['auth.login']).toBeDefined();
    expect(canonical['auth.login'].key).toBe('auth.login');

    expect(locales.fr['old.key']).toBeUndefined();
    expect(locales.fr['auth.login'].value).toBe('Se connecter');
  });
});

