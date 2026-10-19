# Per-Key Versioning & Context Reference

## Canonical Source Catalog (`localization_base/`)
The canonical catalog is the single source of truth for all active and obsolete keys, including their cryptographic content hashes and version counters.

### Structure of a Canonical Entry
```json
{
  "checkout.pay_now": {
    "key": "checkout.pay_now",
    "content": "Pay now",
    "context": "Primary action button on checkout screen to trigger payment modal",
    "relative_file_path": "src/components/checkout.tsx",
    "occurrences": [
      {
        "relative_file_path": "src/components/checkout.tsx",
        "line": 42,
        "column": 12
      }
    ],
    "last_updated_at": "2026-10-19T10:00:00.000Z",
    "key_version": 1,
    "content_hash": "sha256:...",
    "status": "active"
  }
}
```

## Context Enrichment by AI Agents
1. When strings are extracted via `localize extract`, the CLI provides baseline AST context (e.g. `JSX text in <button> (in App <button>)`).
2. The AI Agent analyzes the source code, component hierarchy, and user flow, and enriches the `context` with semantic clarity:
   - CLI method: `localize context set <key> "<semantic_description>"`
   - Direct edit: Update `"context"` in `localization_base/<source_locale>.json`.
3. **Preservation Guarantee**:
   Shallok's reconciliation algorithm (`reconcileCanonicalCatalog`) checks if a key already has an enriched context. Unless the source code introduces an explicit inline comment (`{/* context: ... */}`), the AI agent's enriched context is **strictly preserved** across all future extractions and will not be overwritten by generic AST node descriptions.

## Reconciliation & Versioning Rules
1. **New Key**: Initialized at `key_version = 1`, `status = "active"`.
2. **Unchanged Content & Context**: `key_version` and `last_updated_at` remain unchanged.
3. **Modified Source Content**: `key_version` increments by 1; `last_updated_at` is updated.
4. **File Move / Occurrence Change**: Path and occurrence lines are updated; `key_version` does NOT increment.
5. **Key Removed from Source**: Marked `status = "obsolete"`; preserved in catalog for historical retention.
6. **Key Reintroduced**: Reactivated as `"active"`.

## Stale Detection in Locale Catalogs
In `messages/<locale>.json`, each entry records:
```json
{
  "checkout.pay_now": {
    "value": "ಈಗ ಪಾವತಿಸಿ",
    "source_version": 1,
    "translated_at": "2026-10-19T10:05:00.000Z",
    "status": "translated"
  }
}
```
A translation is **stale** when `entry.source_version < canonicalEntry.key_version`. Stale entries retain their existing translated value for reference until the AI agent updates them.
