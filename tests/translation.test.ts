import { describe, it, expect } from 'vitest';
import {
  MockTranslationProvider,
  TranslationOrchestrator,
} from '../packages/translation-providers/src/index.js';
import { CanonicalCatalog, LocaleCatalog, computeContentHash } from '../packages/core/src/index.js';

describe('Translation Engine', () => {
  it('translates known strings to Hindi, Kannada, and French using MockProvider', async () => {
    const provider = new MockTranslationProvider();

    const items = [
      { key: 'checkout.pay_now', content: 'Pay now', context: '', sourceVersion: 1, variables: [] },
      { key: 'auth.sign_in', content: 'Sign in', context: '', sourceVersion: 1, variables: [] },
    ];

    const frRes = await provider.translateBatch(items, { sourceLocale: 'en', targetLocale: 'fr' });
    expect(frRes.find((r) => r.key === 'checkout.pay_now')?.translatedValue).toBe('Payer maintenant');
    expect(frRes.find((r) => r.key === 'auth.sign_in')?.translatedValue).toBe('Se connecter');

    const hiRes = await provider.translateBatch(items, { sourceLocale: 'en', targetLocale: 'hi' });
    expect(hiRes.find((r) => r.key === 'checkout.pay_now')?.translatedValue).toBe('अभी भुगतान करें');

    const knRes = await provider.translateBatch(items, { sourceLocale: 'en', targetLocale: 'kn' });
    expect(knRes.find((r) => r.key === 'checkout.pay_now')?.translatedValue).toBe('ಈಗ ಪಾವತಿಸಿ');
  });

  it('orchestrates incremental translation skipping already translated current entries', async () => {
    const provider = new MockTranslationProvider();
    const orchestrator = new TranslationOrchestrator(provider);

    const canonical: CanonicalCatalog = {
      'checkout.pay_now': {
        key: 'checkout.pay_now',
        content: 'Pay now',
        context: '',
        relative_file_path: 'src/checkout.tsx',
        occurrences: [{ relative_file_path: 'src/checkout.tsx', line: 1 }],
        last_updated_at: '2026-10-19T10:00:00.000Z',
        key_version: 1,
        content_hash: computeContentHash('Pay now', ''),
        status: 'active',
      },
      'auth.sign_in': {
        key: 'auth.sign_in',
        content: 'Sign in',
        context: '',
        relative_file_path: 'src/auth.tsx',
        occurrences: [{ relative_file_path: 'src/auth.tsx', line: 1 }],
        last_updated_at: '2026-10-19T10:00:00.000Z',
        key_version: 1,
        content_hash: computeContentHash('Sign in', ''),
        status: 'active',
      },
    };

    // French already has checkout.pay_now translated at version 1
    const localeCatalogs: Record<string, LocaleCatalog> = {
      fr: {
        'checkout.pay_now': {
          value: 'Payer maintenant',
          source_version: 1,
          translated_at: '2026-10-19T10:00:00.000Z',
          status: 'translated',
        },
      },
    };

    const summaries = await orchestrator.translateLocales({
      canonicalCatalog: canonical,
      localeCatalogs,
      sourceLocale: 'en',
      targetLocales: ['fr'],
    });

    expect(summaries.fr.totalRequested).toBe(1); // Only auth.sign_in needed translation!
    expect(summaries.fr.skipped).toBe(1); // checkout.pay_now skipped
    expect(summaries.fr.translated).toBe(1);

    expect(localeCatalogs.fr['auth.sign_in'].value).toBe('Se connecter');
    expect(localeCatalogs.fr['auth.sign_in'].source_version).toBe(1);
    expect(localeCatalogs.fr['auth.sign_in'].status).toBe('translated');
  });

  it('preserves existing values when translation provider fails', async () => {
    const failingProvider = new MockTranslationProvider(true); // simulated failure
    const orchestrator = new TranslationOrchestrator(failingProvider);

    const canonical: CanonicalCatalog = {
      'checkout.pay_now': {
        key: 'checkout.pay_now',
        content: 'Pay now',
        context: '',
        relative_file_path: 'src/checkout.tsx',
        occurrences: [{ relative_file_path: 'src/checkout.tsx', line: 1 }],
        last_updated_at: '2026-10-19T10:00:00.000Z',
        key_version: 2, // stale in fr
        content_hash: computeContentHash('Pay now', ''),
        status: 'active',
      },
    };

    const localeCatalogs: Record<string, LocaleCatalog> = {
      fr: {
        'checkout.pay_now': {
          value: 'Ancien texte',
          source_version: 1,
          translated_at: '2026-10-19T10:00:00.000Z',
          status: 'stale',
        },
      },
    };

    const summaries = await orchestrator.translateLocales({
      canonicalCatalog: canonical,
      localeCatalogs,
      sourceLocale: 'en',
      targetLocales: ['fr'],
    });

    expect(summaries.fr.failed).toBe(1);
    // Value must not be wiped out or corrupted!
    expect(localeCatalogs.fr['checkout.pay_now'].value).toBe('Ancien texte');
  });
});
