---
name: nextjs-localization-and-translation-i18n
description: Next.js-specific localization and translation workflow using next-intl and Shallok CLI (shallok). Covers App Router and Pages Router, Server and Client Components, routing middleware, context enrichment, direct agent translation without external API keys, runtime bundle compilation, and validation.
---

# Next.js Localization & Translation Skill (`next-intl`)

Use this skill when asked to add, configure, update, or audit localization in **Next.js applications** (Next.js 13, 14, 15+ App Router or Pages Router).

## Two Ways Developers Use Shallok

1. **Via CLI (`npx shallok init`)**: The developer runs `npx shallok init` in their project. Shallok initializes the catalogs, installs `shallok` into `devDependencies`, and adds this skill directly into `.agents/skills/` and `skills/`.
2. **Direct Skill Installation**: The developer installs or links this skill into their AI coding agent and directly asks: *"Add localization to this application"* or *"Translate into Kannada and Hindi"*.

---

## Agent Step 0: Verify & Install Shallok CLI

**Before executing any localization commands, you (the AI Agent) MUST verify that `shallok` is available:**

1. Check `package.json` for `"shallok"` in `devDependencies` or run:
   ```bash
   npx shallok --version
   ```
2. **If `shallok` is NOT installed, install it immediately** using the project's package manager:
   - If `pnpm-lock.yaml` exists: `pnpm add -D shallok`
   - If `yarn.lock` exists: `yarn add -D shallok`
   - If `bun.lockb` / `bun.lock` exists: `bun add -d shallok`
   - Otherwise: `npm install -D shallok`
   *(Alternatively, run commands directly via `npx shallok <command>`)*

---

## Architecture & Agent Role

Shallok pairs a deterministic AST CLI (`shallok`) with **the AI Agent as the semantic translator and context enricher**:

1. **The CLI (`shallok`)** handles deterministic tasks:
   - Scaffolds Next.js configuration files: `src/i18n/routing.ts` and `src/i18n/request.ts`.
   - AST parses Next.js JSX/TSX components (`shallok extract`).
   - Replaces user-facing strings with `{t('key')}` and imports `useTranslations` (`shallok extract --apply`).
   - Maintains per-key versioning and SHA-256 content hashes in `localization_base/`.
   - Compiles runtime message bundles to `messages/runtime/<locale>.json` (`shallok build`).
   - Validates 0 missing keys, 0 stale versions, and 0 broken placeholders (`shallok validate`).

2. **The AI Agent (You)** provides semantic intelligence:
   - **No external API keys required**: You generate natural, culturally authentic translations directly into target languages (e.g. Kannada, Hindi, Spanish, French, German).
   - **Context Enrichment**: You inspect Next.js Server Components, Client Components, and layout hierarchies to provide rich, descriptive `context` in `localization_base/` for each key.
   - **Integrity**: You preserve all interpolation tokens (`{userName}`, `{count}`, `{amount}`) exactly as they appear in the source text.

---

## 6-Phase Agent Workflow for Next.js

### Phase A: Analyze
Inspect repository architecture without modifying files:
```bash
shallok analyze --json
```
- Verify framework is detected as `nextjs`.
- Check Next.js version in `package.json` (`dependencies.next`).
- Check router type:
  - **App Router**: `app/` directory exists (with or without `src/`).
  - **Pages Router**: `pages/` directory exists.
- Identify candidate page and component files (`app/**/*.tsx`, `src/**/*.tsx`).
- Note user-requested target locales (e.g. `kn`, `hi`, `fr`, `es`).
- **Never edit files during Phase A.**

### Phase B: Plan and Review
Present a concise plan to the developer:
1. **Framework & Library**: Next.js with `next-intl`.
2. **Locales**: Source locale (e.g. `en`) and target locales (e.g. `kn` Kannada, `hi` Hindi).
3. **Dependencies to Install**:
   ```bash
   pnpm add next-intl
   ```
4. **Planned Scaffolding**:
   - `localization.json` (Project manifest)
   - `src/i18n/routing.ts` (Routing definition for `next-intl`)
   - `src/i18n/request.ts` (Request configuration for server-side loading)
   - `middleware.ts` (Locale detection and URL rewriting)
   - `localization_base/<source_locale>.json` & `metadata.json` (Canonical catalog & versions)
   - `messages/<locale>.json` (Authoritative target catalogs)
   - `messages/runtime/<locale>.json` (Compiled runtime message bundles)
5. **App Structure Updates**:
   - Nest routes under `app/[locale]/...`
   - Setup `NextIntlClientProvider` in `app/[locale]/layout.tsx` for client components
6. Confirm with user before proceeding (or proceed if `--yes` / requested).

### Phase C: Initialize
Initialize configuration and Next.js scaffolding:
```bash
shallok init --source en --locales kn,hi --framework nextjs --yes
```
This automatically creates:
- `localization.json`
- `src/i18n/routing.ts`
- `src/i18n/request.ts`
- Initial catalogs in `localization_base/` and `messages/`
- Installs `shallok` in `devDependencies` and copies skills

Ensure dependencies are installed:
```bash
pnpm add next-intl
```

### Phase D: Extract & Enrich Context (AI-Driven)
1. **Preview proposed extraction**:
   ```bash
   shallok extract --dry-run --json
   ```
2. **Extract strings to canonical catalog**:
   ```bash
   shallok extract
   ```
   This extracts text and JSX expressions to `localization_base/en.json`.

3. **Enrich Context (Performed by AI Agent)**:
   - Review `localization_base/en.json`.
   - Inspect the Next.js page or component where each key originates.
   - Enrich `context` with semantic clarity (e.g. *"Dashboard banner heading welcoming returning user"*).
   - Use the CLI:
     ```bash
     shallok context set <key> "<semantic_description>"
     ```
     Or edit `"context"` directly in `localization_base/en.json`.
   - **Preservation Guarantee**: Shallok's reconciliation algorithm strictly preserves your enriched context across all future extractions.

### Phase E: Translate (AI-Driven)
**No external API keys or LLM provider subscriptions are required.**
You, as the AI coding agent, generate the translations directly:

1. **Check translation status**:
   ```bash
   shallok status --json
   ```
   Identify keys in `messages/<locale>.json` marked with `status: "missing"` or `status: "stale"`.

2. **Generate Natural Translations**:
   - Translate each string into culturally authentic target language (e.g. Kannada, Hindi).
   - Use the source `content` and your enriched `context` for accurate terminology.
   - **Strict Rule**: Preserve all interpolation tokens (`{count}`, `{name}`, `{date}`) exactly as formatted in the source text.

3. **Update Target Locale Catalogs**:
   Write directly into `messages/<locale>.json` or use:
   ```bash
   shallok entry set <locale> <key> "<translated_text>"
   ```

### Phase F: Apply, Build & Validate
1. **Transform Next.js source components**:
   ```bash
   shallok extract --apply
   ```
2. **Verify Next.js Integration Files**:
   - `middleware.ts` configured with `next-intl/middleware`.
   - `next.config.mjs` with `createNextIntlPlugin`.
3. **Compile runtime message bundles**:
   ```bash
   shallok build
   ```
4. **Validate catalog integrity**:
   ```bash
   shallok validate
   ```
   Verifies 0 missing translations, 0 stale versions, 0 dropped or mismatched placeholders.
