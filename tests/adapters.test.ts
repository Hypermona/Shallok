import { describe, it, expect } from 'vitest';
import {
  compileCatalogToRuntime,
  ReactAdapter,
  NextjsAdapter,
  getAdapter,
} from '../packages/framework-adapters/src/index.js';
import { CanonicalCatalog, LocaleCatalog, computeContentHash } from '../packages/core/src/index.js';

describe('Framework Adapters & Runtime Compilation', () => {
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
    'checkout.title': {
      key: 'checkout.title',
      content: 'Checkout',
      context: '',
      relative_file_path: 'src/checkout.tsx',
      occurrences: [{ relative_file_path: 'src/checkout.tsx', line: 2 }],
      last_updated_at: '2026-10-19T10:00:00.000Z',
      key_version: 1,
      content_hash: computeContentHash('Checkout', ''),
      status: 'active',
    },
    'obsolete.item': {
      key: 'obsolete.item',
      content: 'Old',
      context: '',
      relative_file_path: 'src/old.tsx',
      occurrences: [],
      last_updated_at: '2026-10-19T10:00:00.000Z',
      key_version: 1,
      content_hash: computeContentHash('Old', ''),
      status: 'obsolete',
    },
  };

  const localeCatalog: LocaleCatalog = {
    'checkout.pay_now': {
      value: 'Payer maintenant',
      source_version: 1,
      translated_at: '2026-10-19T10:00:00.000Z',
      status: 'translated',
    },
    // checkout.title is missing in fr catalog, should fallback to canonical content
  };

  it('compiles catalog to flat runtime dictionary and omits obsolete keys', () => {
    const flat = compileCatalogToRuntime(localeCatalog, canonical, 'flat');

    expect(flat['checkout.pay_now']).toBe('Payer maintenant');
    expect(flat['checkout.title']).toBe('Checkout'); // Fallback to source content
    expect(flat['obsolete.item']).toBeUndefined(); // Obsolete omitted from runtime bundle
  });

  it('compiles catalog to nested runtime dictionary for nested-ready libraries', () => {
    const nested = compileCatalogToRuntime(localeCatalog, canonical, 'nested');

    expect(nested.checkout).toBeDefined();
    expect(nested.checkout.pay_now).toBe('Payer maintenant');
    expect(nested.checkout.title).toBe('Checkout');
    expect(nested.obsolete).toBeUndefined();
  });

  it('retrieves correct adapter from registry', () => {
    const react = getAdapter('react');
    expect(react).toBeInstanceOf(ReactAdapter);

    const next = getAdapter('nextjs');
    expect(next).toBeInstanceOf(NextjsAdapter);
  });
});
