# Per-Key Versioning & Context Reference

## Strict Catalog Persistence: NEVER Delete `localization.json` or `localization_base/`
> [!CAUTION]
> `localization.json` and `localization_base/` are the permanent foundation of the localization system:
> - `localization.json` stores project settings, locales, paths, and key strategies.
> - `localization_base/` stores canonical source strings, per-key version counters (`key_version`), cryptographic SHA-256 hashes (`content_hash`), occurrence positions, and enriched semantic `context`.
> - **Under NO circumstances should you EVER delete `localization.json` or `localization_base/`**. Deleting them resets version counters, destroys human- and AI-enriched context, breaks incremental translation, and corrupts catalog synchronization.

---

## Canonical Source Catalog (`localization_base/`)
The canonical catalog is the single source of truth for all active and obsolete keys, including their cryptographic content hashes and version counters.

### Key Format: Normalized Dot-Separated Paths Only
- All keys must use normalized dot-separated string paths (e.g. `"checkout.pay_now"`, `"auth.login.title"`).
- **Never use nested object-based keys**.
- If an existing project uses object-based keys, ask the user to convert and flatten them to normalized dot-paths before modifying catalogs.

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

## Context Enrichment & Verification Before Translation
1. When strings are extracted via `shallok extract`, the CLI provides baseline AST context (e.g. `JSX text in <button> (in App <button>)`).
2. **Mandatory Check Before Translation**: Before generating any translations, check that all active keys in `localization_base/<source_locale>.json` have proper, high-quality semantic context.
3. If any key lacks context or has only generic AST descriptions, analyze the source code, component hierarchy, and user flow, and enrich the `context` with semantic clarity:
   - CLI method: `shallok context set <key> "<semantic_description>"`
   - Direct edit: Update `"context"` in `localization_base/<source_locale>.json`.
4. **Always Translate from Source Locale + Context**: Translations must be derived directly from `localization_base/<source_locale>.json` using BOTH `content` and `context`.
5. **Preservation Guarantee**:
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
A translation is **stale** when `entry.source_version < canonicalEntry.key_version`. Stale entries retain their existing translated value for reference until the AI agent updates them from `localization_base/<source_locale>.json` and its enriched `context`.
