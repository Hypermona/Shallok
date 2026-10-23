---
name: localization-and-translation-i18n
description: Framework-independent, agent-native localization and translation workflow. Uses Shallok CLI (shallok) for deterministic AST extraction, per-key versioning, and validation, with the AI coding agent directly enriching context and translating strings without external API keys.
---

# Framework-Independent Localization & Translation Skill

Use this skill when asked to add, configure, update, or audit localization in **any JavaScript/TypeScript application** regardless of the specific web or mobile framework.

## Two Ways Developers Use Shallok

1. **Via CLI (`npx shallok init`)**: The developer runs `npx shallok init` in their project. Shallok initializes the catalogs, installs `shallok` into `devDependencies`, and adds the skills directly into `.agents/skills/` and `skills/`.
2. **Direct Skill Installation**: The developer installs or links this skill into their AI coding agent and directly asks: *"Add localization to this application"* or *"Translate into Kannada and Hindi"*.

---

## Agent Step 0: Mandatory Pre-Flight Checklist (Run Before ANY Code or Config Changes)

> [!IMPORTANT]
> **AI AGENT MANDATORY RULE: NEVER RUN `shallok setup`!**
> The `shallok setup` command is solely for human developers to execute the initial setup (`npx shallok setup`). As an AI Agent, you already have access to this skill. You must **NEVER** run `shallok setup`. You must use `shallok init`, `shallok extract`, `shallok translate`, `shallok status`, `shallok validate`, and `shallok build`.

**Before making ANY changes to a new repo or an existing repo, you (the AI Agent) MUST execute the following checks in order:**

### 1. Check if Shallok is Installed
- Inspect `package.json` for `"shallok"` or `"@shallok/cli"` in `devDependencies` (or `dependencies`), or run:
  ```bash
  npx shallok --version
  ```
- **If `shallok` is NOT installed, install it immediately into `devDependencies`:**
  - If `pnpm-lock.yaml` exists: `pnpm add -D shallok`
  - If `yarn.lock` exists: `yarn add -D shallok`
  - If `bun.lockb` / `bun.lock` exists: `bun add -d shallok`
  - Otherwise: `npm install -D shallok`

### 2. Check if `localization.json` and `localization_base/` Exist
- Verify that `localization.json` exists in the project root.
- Verify that the `localization_base/` directory exists with `<source_locale>.json` and `metadata.json`.
- **If either does NOT exist, create them using Shallok:**
  ```bash
  shallok init --source en --locales kn,hi --framework <name> --yes
  ```

### 3. NEVER Delete `localization.json` or `localization_base/`
> [!CAUTION]
> **CRITICAL PERSISTENCE RULE: NEVER DELETE `localization.json` OR `localization_base/`!**
> - `localization.json` is the single source-of-truth project manifest.
> - `localization_base/` contains the canonical catalog (`<source_locale>.json`) with per-key version numbers (`key_version`), cryptographic content hashes (`sha256:`), source code occurrences, and enriched semantic context, alongside `metadata.json`.
> - **Under NO circumstances should you EVER delete `localization.json` or `localization_base/`**. Deleting them destroys the versioning history, wipes out human- and AI-enriched context, resets version counters, breaks incremental translation, and corrupts catalog synchronization.

---

## Core Architectural & Formatting Rules

### Rule 1: Always Use Normalized Paths for Keys (Never Object-Based Paths)
- **Always use normalized dot-separated key paths**: e.g., `"auth.login.title"`, `"checkout.pay_now"`, `"settings.profile.change_password"`.
- **Never use nested object-based paths**: Do not structure keys or catalogs as nested JSON objects (e.g., `{ "auth": { "login": { "title": "..." } } }`). All keys in `localization_base/<source_locale>.json`, `messages/<locale>.json`, and runtime bundles MUST be flat normalized string paths.
- **If an existing project is using object-based keys**:
  - **STOP and ask the user** for confirmation to flatten them into normalized dot-separated key paths before proceeding with extraction or catalog edits.
  - Explain that normalized dot-paths are required for deterministic AST extraction, per-key versioning, and collision-free reconciliation.
  - Upon user approval, migrate and flatten all nested keys to normalized dot-paths.

### Rule 2: Always Use the `messages/` Directory Structure (Ask User & Migrate If Different)
- **Standard translations folder**: Shallok strictly standardizes on `messages/` for authoritative locale catalogs (`messages/<locale>.json`) and compiled runtime bundles (`messages/runtime/<locale>.json`).
- **If the project uses any other folder structure** (e.g., `locales/`, `src/locales/`, `translations/`, `lang/`, `src/i18n/locales/`):
  - **STOP and ask the user** for approval to switch to the standardized `messages/` directory structure.
  - Upon user approval, **migrate** all existing translation files into `messages/`, update framework configuration and import paths, reconcile existing strings into `localization_base/`, and clean up the old directory.

### Rule 3: Check Context for All Keys in `localization_base/{source_locale}` Before Translating
- **Before generating any translations for any target locale**:
  - Inspect all active keys in `localization_base/<source_locale>.json` (e.g., `localization_base/en.json`).
  - Verify that **every key has meaningful, accurate semantic `context`**.
  - If any key lacks context, has an empty context (`""`), or contains only generic AST descriptions (e.g., `"JSX text in button"`), you MUST inspect the component/screen and **generate rich semantic context for all such keys BEFORE generating translations**.
  - Enrich context via:
    ```bash
    shallok context set <key> "<semantic_description>"
    ```
    or directly edit the `"context"` field in `localization_base/<source_locale>.json`.

### Rule 4: Always Generate Translations from `localization_base/{source_locale}` and Its Context
- **Never translate raw strings in isolation**:
  - All translations MUST be generated directly from `localization_base/<source_locale>.json`, reading BOTH the source string (`content`) and its semantic `context`.
  - The `context` provides critical disambiguation (grammatical gender, button vs label vs heading, formality, technical terminology).
  - Strictly preserve all interpolation tokens (`{userName}`, `{count}`, `{amount}`) exactly as formatted in the source `content`.

### Rule 5: Migrate Legacy Base Locale References to Specified Structure
- **If the application already has a localization setup**:
  - Inspect how the base/source locale (`source_locale`, e.g., `en`) is loaded.
  - If any configuration or code file (e.g., `i18n.ts`, `src/i18n.ts`, `src/i18n/request.ts`, `app/_layout.tsx`, `main.tsx`) is importing or referencing a legacy file other than our specified structure (e.g., `src/locales/en.json`, `locales/en.json`, `public/locales/en.json`):
    1. **Reconcile legacy base strings** into `localization_base/<source_locale>.json` and `messages/<source_locale>.json`.
    2. **Update all code imports and references** across the project to point to the standardized compiled runtime bundle (`messages/runtime/<locale>.json`) or the CDN loader.
    3. Remove or deprecate the legacy base locale file so that Shallok's AST extraction does NOT falsely extract the legacy JSON file as source code.

### Rule 6: Translation Loading Strategy: Local for Static/SSR vs. CDN for Client/Mobile
Choose the loading strategy based on application architecture:
- **Static & SSR Applications (Astro, Next.js, and similar static/SSR apps)**:
  - **Recommend keeping translations LOCAL** in `messages/runtime/<locale>.json`.
  - Load directly from the local bundle or filesystem during server rendering or static build.
  - **Benefits**: Zero network latency, instant First Contentful Paint (FCP), seamless Server Component hydration, and zero remote network failure risks.
- **Client & Mobile Applications (Expo, React Native, React SPA / Vite)**:
  - **Existing Projects with Remote Fetching**:
    - If the project **already has a remote setup to fetch translations** (e.g. Supabase, custom backend API, CDN, S3, or external service):
    - **DO NOT TOUCH OR MODIFY THE REMOTE FETCHING SETUP!** Keep the remote loader, caching logic, and endpoints intact.
    - **ONLY the default / source locale (e.g. `en`) translation should be done in Shallok's way**:
      - Maintain canonical keys in `localization_base/<source_locale>.json`.
      - Bundle ONLY the default locale fallback in `messages/runtime/<source_locale>.json` (or `messages/<source_locale>.json`).
      - Non-default locales continue to be served via the existing remote setup.
  - **New Setups with CDN / Remote Loading**:
    - If the user wants to load translations from CDN/remote:
    - **NO NEED TO HAVE FALLBACKS FOR ALL LANGUAGES**: Do NOT create or statically import local fallback message files for every language.
    - **MAKE SURE TARGET LOCALES ARE NOT BUNDLED WITH FINAL OUTPUT**:
      - **ONLY bundle the default / source locale** (e.g. `en`) as the initial/offline fallback.
      - **DO NOT statically import target locales** (e.g. `kn`, `hi`, `fr`, `es`) in client code or app entry points!
      - Target locales are fetched on-demand from CDN / remote source and cached locally (`AsyncStorage` / `localStorage`).
      - This keeps final client/mobile bundle size minimal and enables instant OTA copy updates.
  - **Scaffold CDN Environment Variables**:
    - For Expo: `EXPO_PUBLIC_TRANSLATIONS_CDN_URL=https://cdn.yourdomain.com/locales`
    - For React / Vite: `VITE_TRANSLATIONS_CDN_URL=https://cdn.yourdomain.com/locales`
  - **Upload Script**: Provide an upload script (e.g. `scripts/upload-locales.mjs`) to upload compiled `messages/runtime/` bundles to the CDN.

---

## Architecture & Agent Role

Shallok pairs a deterministic AST CLI (`shallok`) with **the AI Agent as the semantic translator and context enricher**:

1. **The CLI (`shallok`)** performs deterministic operations:
   - AST parsing, string discovery, and safe code transformations (`shallok extract`).
   - Per-key versioning and SHA-256 content hashing in `localization_base/`.
   - Compiling runtime-ready message bundles in `messages/runtime/` (`shallok build`).
   - Validating 0 missing keys, 0 stale versions, and 0 broken placeholders (`shallok validate`).

2. **The AI Agent (You)** provides semantic intelligence:
   - **No external API keys needed**: You generate natural, authentic translations directly into target languages (e.g. Kannada, Hindi, French, Spanish, German, etc.).
   - **Context Enrichment**: You analyze the UI components and user journey to provide clear, high-quality semantic `context` in `localization_base/` for each key.
   - **Integrity**: You preserve all interpolation tokens (`{count}`, `{name}`, `{amount}`) exactly as they appear in the source text.

---

## 6-Phase Agent Workflow

### Phase A: Analyze
Inspect repository architecture without modifying files:
```bash
shallok analyze --json
```
- Examine detected framework, router, programming language, and source paths (`src/`).
- Check existing translation catalogs and folders (`locales/`, `src/locales/`, `messages/`).
- Check if existing base locale is referencing legacy files (e.g., `src/locales/en.json`, `locales/en.json`).
- Check if existing keys use object-based nesting or normalized dot-paths.
- Determine if the project is Static/SSR (Next.js, Astro) or Client/Mobile (Expo, React Native, React SPA).
- Determine candidate source files and target locales from the user request.
- **Never edit files during Phase A.**

### Phase B: Plan and Review
Present a concise plan to the developer:
1. **Detected Framework**: Framework name and router type.
2. **Runtime Localization Solution**: Suggested runtime library (e.g. `next-intl`, `react-i18next`, `expo-localization`).
3. **Locales**: Source locale (e.g. `en`) and target locales (e.g. `kn` Kannada, `hi` Hindi).
4. **Directory & Key Architecture Check**:
   - If non-standard locale folders or legacy base locale references exist: Propose migrating to `messages/` and updating all import references to `messages/runtime/<locale>.json`.
   - If object-based keys exist: Propose flattening to normalized dot-path keys and request user confirmation.
5. **Loading Strategy Recommendation**:
   - For **Astro / Next.js**: Recommend local bundle loading from `messages/runtime/`.
   - For **Expo / React Native / React SPA**: Recommend CDN loading with `EXPO_PUBLIC_TRANSLATIONS_CDN_URL` or `VITE_TRANSLATIONS_CDN_URL`, with local fallback, and ask the user to configure the CDN ENV.
6. **Planned Scaffolding**:
   - `localization.json` (Project manifest)
   - `localization_base/<source_locale>.json` & `metadata.json` (Canonical catalog & versions — **never delete**)
   - `messages/<locale>.json` (Authoritative locale catalogs)
   - Framework adapter configuration
7. Confirm with the user before proceeding (or proceed if `--yes` / user requested).

### Phase C: Initialize
Initialize project configuration and catalogs:
```bash
shallok init --source en --locales kn,hi --framework <name> --yes
```
1. If migrating from an existing non-standard folder (e.g., `src/locales/en.json`), copy/migrate existing translations into `messages/` and reconcile into `localization_base/`.
2. **Update all code references**: Replace legacy imports like `import en from './locales/en.json'` with `messages/runtime/` or CDN loader.
3. If using CDN loading (Expo / React Native / React), create/update `.env` / `.env.example` with the CDN URL variable and prompt the user to configure it.

### Phase D: Extract & Enrich Context (AI-Driven)
1. **Preview proposed extraction**:
   ```bash
   shallok extract --dry-run --json
   ```
2. **Extract strings and reconcile catalog**:
   ```bash
   shallok extract
   ```
3. **Mandatory Context Check & Enrichment (Performed by AI Agent)**:
   - Inspect `localization_base/<source_locale>.json`.
   - **Verify that every key has proper semantic context**.
   - If any key lacks context or has only generic AST descriptions, analyze the screen and component purpose and enrich `context` BEFORE proceeding to translation:
     ```bash
     shallok context set <key> "<semantic_description>"
     ```
     Or edit `"context"` directly in `localization_base/<source_locale>.json`.
   - **Preservation Guarantee**: Shallok's reconciliation algorithm strictly preserves your enriched context across all future extractions.

### Phase E: Translate (AI-Driven from `localization_base/{source_locale}` + Context)
**No external API keys or LLM provider subscriptions are required.**
You, as the AI coding agent, generate the translations directly:

1. **Verify Context First**: Ensure all keys in `localization_base/<source_locale>.json` have proper semantic context.
2. **Identify entries needing translation**:
   ```bash
   shallok status --json
   ```
   Inspect `messages/<locale>.json` for keys with `status: "missing"` or `status: "stale"`.

3. **Generate Translations from `localization_base/{source_locale}` and Its Context**:
   - Translate each entry into natural, culturally accurate target language reading the source `content` AND its semantic `context` from `localization_base/<source_locale>.json`.
   - **Rule**: Strictly preserve all interpolation placeholders (`{name}`, `{count}`, `{price}`).

4. **Update Target Locale Catalogs**:
   Update `messages/<locale>.json` directly or using the CLI:
   ```bash
   shallok entry set <locale> <key> "<translated_text>"
   ```
   Or write catalog entries directly in `messages/<locale>.json`:
   ```json
   {
     "checkout.pay_now": {
       "value": "ಈಗ ಪಾವತಿಸಿ",
       "source_version": 1,
       "translated_at": "2026-10-19T14:00:00.000Z",
       "status": "translated"
     }
   }
   ```

### Phase F: Apply, Build & Validate
1. **Apply AST transformations to source files**:
   ```bash
   shallok extract --apply
   ```
   Replaces hardcoded strings with `{t('key')}` using normalized dot-separated key paths and injects necessary hooks.

2. **Build runtime message bundles**:
   ```bash
   shallok build
   ```
   Compiles runtime dictionaries to `messages/runtime/<locale>.json`.

3. **Validate catalog integrity**:
   ```bash
   shallok validate
   ```
   Verifies:
   - 0 active keys missing translations.
   - 0 stale versions.
   - 0 dropped or altered placeholders.

4. **Summarize results**:
   Present modified files, supported locales, 100% completeness, and validation status.

---

## Maintenance Workflows

- **Add a new language**:
  ```bash
  shallok locale add <locale>
  ```
  Check context in `localization_base/<source_locale>.json`, translate active keys into `messages/<locale>.json` using source content and context, then run `shallok build && shallok validate`.

- **Source wording changed**:
  Run `shallok extract`. Only modified keys increment version (`key_version`); only dependent entries are flagged `stale`. Check and update context if needed, translate the changed string from `localization_base/<source_locale>.json` and context, then `shallok build`.

- **Rename a key**:
  ```bash
  shallok key rename <oldKey> <newKey>
  shallok build
  ```
