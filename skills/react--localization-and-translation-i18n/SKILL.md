---
name: react--localization-and-translation-i18n
description: React-specific localization and translation workflow using react-i18next and Shallok CLI (shallok). Guides AI coding agents through AST extraction of React JSX/TSX components, context enrichment, direct agent translation without external API keys, runtime bundle compilation, and validation.
---

# React Localization & Translation Skill (`react-i18next`)

Use this skill when asked to add, configure, update, or audit localization in **React applications** (Vite, Create React App, Webpack, SPAs).

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
   - Scaffolds `src/i18n.ts` configuring `react-i18next`.
   - AST parses React JSX/TSX components (`shallok extract`).
   - Replaces user-facing strings and JSX elements with `{t('key')}` and imports `useTranslation` (`shallok extract --apply`).
   - Maintains per-key versioning and SHA-256 content hashes in `localization_base/`.
   - Compiles runtime message bundles to `messages/runtime/<locale>.json` (`shallok build`).
   - Validates 0 missing keys, 0 stale versions, and 0 broken placeholders (`shallok validate`).

2. **The AI Agent (You)** provides semantic intelligence:
   - **No external API keys required**: You generate natural, culturally authentic translations directly into target languages (e.g. Kannada, Hindi, Spanish, French, German).
   - **Context Enrichment**: You inspect React components, state flows, and screen layouts to provide rich, descriptive `context` in `localization_base/` for each key.
   - **Integrity**: You preserve all interpolation tokens (`{userName}`, `{count}`, `{amount}`) exactly as they appear in the source text.

---

## 6-Phase Agent Workflow for React

### Phase A: Analyze
Inspect repository architecture without modifying files:
```bash
shallok analyze --json
```
- Verify framework is detected as `react`.
- Check React version in `package.json` (`dependencies.react`).
- Identify source directory (typically `src/`) and entry file (`src/main.tsx`, `src/index.tsx`, or `src/App.tsx`).
- Identify candidate React component files (`src/**/*.tsx`, `src/**/*.jsx`).
- Note user-requested target locales (e.g. `kn`, `hi`, `fr`, `es`).
- **Never edit files during Phase A.**

### Phase B: Plan and Review
Present a concise plan to the developer:
1. **Framework & Library**: React with `react-i18next` and `i18next`.
2. **Locales**: Source locale (e.g. `en`) and target locales (e.g. `kn` Kannada, `hi` Hindi).
3. **Dependencies to Install**:
   ```bash
   pnpm add i18next react-i18next
   ```
4. **Planned Scaffolding**:
   - `localization.json` (Project manifest)
   - `src/i18n.ts` (React-i18next configuration)
   - `localization_base/<source_locale>.json` & `metadata.json` (Canonical catalog & versions)
   - `messages/<locale>.json` (Target locale catalogs)
   - `messages/runtime/<locale>.json` (Compiled runtime bundles)
5. **Entry Point Integration**: Adding `import './i18n';` in `src/main.tsx` (or `src/index.tsx`).
6. Confirm with user before proceeding (or proceed if `--yes` / requested).

### Phase C: Initialize
Initialize configuration and React scaffolding:
```bash
shallok init --source en --locales kn,hi --framework react --yes
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
3. **Enrich Context (Performed by AI Agent)**:
   - Review `localization_base/en.json`.
   - Inspect the React component code where each key is used.
   - Enrich `context` with semantic clarity (e.g. *"Primary CTA button inside CheckoutModal component to submit credit card payment"*).
   - Use the CLI:
     ```bash
     shallok context set <key> "<semantic_description>"
     ```
     Or edit `"context"` directly in `localization_base/en.json`.

### Phase E: Translate (AI-Driven)
**No external API keys or LLM provider subscriptions are required.**
You, as the AI coding agent, generate the translations directly:
1. Check translation status:
   ```bash
   shallok status --json
   ```
2. Generate Natural Translations preserving interpolation tokens (`{count}`, `{name}`, etc.).
3. Update Target Locale Catalogs directly or via:
   ```bash
   shallok entry set <locale> <key> "<translated_text>"
   ```

### Phase F: Apply, Build & Validate
1. Transform React components: `shallok extract --apply`
2. Compile runtime message bundles: `shallok build`
3. Validate catalog integrity: `shallok validate`
