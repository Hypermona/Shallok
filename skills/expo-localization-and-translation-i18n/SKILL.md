---
name: expo-localization-and-translation-i18n
description: Expo and React Native localization and translation workflow using expo-localization, i18next, and Shallok CLI (shallok). Covers device language detection via getLocales(), mobile Text/TextInput transformations, Metro-bundled runtime messages, context enrichment, direct agent translation without external API keys, and validation.
---

# Expo & React Native Localization Skill (`expo-localization` + `react-i18next`)

Use this skill when asked to add, configure, update, or audit localization in **Expo and React Native mobile applications** (Expo Router, React Navigation, bare React Native).

## Two Ways Developers Use Shallok

1. **Via CLI (`npx shallok init`)**: The developer runs `npx shallok init` in their project. Shallok initializes the catalogs, installs `shallok` into `devDependencies`, and adds this skill directly into `.agents/skills/` and `skills/`.
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
  shallok init --source en --locales kn,hi --framework expo --yes
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
  - The `context` provides critical disambiguation (grammatical gender, button vs label vs heading, formality, mobile character limits).
  - Strictly preserve all interpolation tokens (`{userName}`, `{count}`, `{amount}`) exactly as formatted in the source `content`.

### Rule 5: Migrate Legacy Base Locale References to Specified Structure
- **If the mobile app already has an existing localization setup**:
  - Check how the base/source locale (`source_locale`, e.g., `en`) is imported and loaded.
  - If any file (e.g. `i18n.ts`, `src/i18n.ts`, `app/_layout.tsx`, `App.tsx`) is importing a legacy file (such as `src/locales/en.json`, `locales/en.json`, or arbitrary JSON files):
    1. **Reconcile strings** into `localization_base/<source_locale>.json` and `messages/<source_locale>.json`.
    2. **Update all code imports** to point to the standardized compiled runtime bundle (`messages/runtime/<locale>.json`) or the CDN loader.
    3. Remove or deprecate the legacy base locale file so that Shallok does NOT extract it as source code (preventing false occurrences like `"relative_file_path": "src/locales/en.json"`).

### Rule 6: Mobile Translation Architecture: CDN-Backed Dynamic Loading (OTA Updates)
- **Suggest loading translations from a CDN for Expo & React Native**:
  - App Store and Google Play binary releases require review cycles that take days or weeks. Shipping translations solely inside the mobile binary prevents quick fixes for typos, copy tweaks, or adding languages.
  - Recommend hosting compiled `messages/runtime/<locale>.json` on a CDN or cloud storage bucket (e.g. Cloudflare R2, AWS S3/CloudFront, Supabase Storage, Vercel Blob).
- **Environment Variables & Configuration**:
  - Define `EXPO_PUBLIC_TRANSLATIONS_CDN_URL=https://cdn.yourdomain.com/locales` in `.env` and `.env.example`.
  - **Prompt and ask the user to configure/update `EXPO_PUBLIC_TRANSLATIONS_CDN_URL`** with their actual CDN endpoint.
- **Resilient Mobile Runtime Loader with Local Offline Fallback**:
  - Configure `i18n.ts` to fetch dynamic translations from `${EXPO_PUBLIC_TRANSLATIONS_CDN_URL}/${locale}.json` and cache them locally using `AsyncStorage`.
  - Always bundle `messages/runtime/<locale>.json` locally as fallback resources, ensuring the app works 100% offline or on first launch before network connectivity is established.
- **Upload Script**:
  - Suggest / scaffold an upload script (e.g., `scripts/upload-locales.mjs`) to automate publishing compiled `messages/runtime/` dictionaries to the CDN.

---

## Architecture & Agent Role

Shallok pairs a deterministic AST CLI (`shallok`) with **the AI Agent as the semantic translator and context enricher**:

1. **The CLI (`shallok`)** handles deterministic tasks:
   - Scaffolds `i18n.ts` configuring `expo-localization` and `i18next`.
   - AST parses mobile React Native components (`shallok extract`).
   - Replaces user-facing strings in `<Text>`, `<TextInput>`, and props with `{t('key')}` using normalized dot-separated key paths (`shallok extract --apply`).
   - Maintains per-key versioning and SHA-256 content hashes in `localization_base/`.
   - Compiles static runtime message bundles to `messages/runtime/<locale>.json` for Metro bundling (`shallok build`).
   - Validates 0 missing keys, 0 stale versions, and 0 broken placeholders (`shallok validate`).

2. **The AI Agent (You)** provides semantic intelligence:
   - **No external API keys required**: You generate natural, culturally authentic mobile translations directly into target languages (e.g. Kannada, Hindi, Spanish, French, German).
   - **Context Enrichment**: You inspect mobile screens, modals, navigation stacks, and touch targets to provide rich, descriptive `context` in `localization_base/` for each key.
   - **Integrity**: You preserve all interpolation tokens (`{userName}`, `{count}`, `{amount}`) exactly as they appear in the source text.

---

## 6-Phase Agent Workflow for Expo

### Phase A: Analyze
Inspect repository architecture without modifying files:
```bash
shallok analyze --json
```
- Verify framework is detected as `expo` (or `react-native`).
- Inspect `package.json` for Expo SDK version and navigation library (Expo Router `expo-router` or `@react-navigation`).
- Check existing translation catalogs and folders (`locales/`, `src/locales/`, `messages/`).
- Check if existing base locale is referencing legacy files (e.g., `src/locales/en.json`, `locales/en.json`).
- Check if existing keys use object-based nesting or normalized dot-paths.
- Identify mobile entry point (`App.tsx`, `index.js`, or `app/_layout.tsx`).
- Identify candidate screen and component files (`src/**/*.tsx`, `app/**/*.tsx`, `components/**/*.tsx`).
- Note user-requested target locales (e.g. `kn`, `hi`, `fr`, `es`).
- **Never edit files during Phase A.**

### Phase B: Plan and Review
Present a concise plan to the developer:
1. **Framework & Libraries**: Expo / React Native with `expo-localization`, `i18next`, and `react-i18next`.
2. **Locales**: Source locale (e.g. `en`) and target locales (e.g. `kn` Kannada, `hi` Hindi).
3. **Directory & Legacy File Migration**:
   - If non-standard locale folders or legacy base locale files exist (e.g. `src/locales/en.json`): Propose migrating to `messages/` and updating all import references to `messages/runtime/<locale>.json`.
   - If object-based keys exist: Explicitly propose flattening to normalized dot-path keys and request user confirmation.
4. **Loading Strategy Recommendation**:
   - Propose loading translations from a CDN via `EXPO_PUBLIC_TRANSLATIONS_CDN_URL` with local offline fallback for OTA updates without app store reviews.
   - Ask the user to configure their CDN endpoint in `.env`.
5. **Dependencies to Install**:
   ```bash
   npx expo install expo-localization @react-native-async-storage/async-storage
   pnpm add i18next react-i18next
   ```
6. **Planned Scaffolding**:
   - `localization.json` (Project manifest)
   - `i18n.ts` (Mobile i18n initialization at root with CDN loader & local fallback)
   - `.env` / `.env.example` (Configured with `EXPO_PUBLIC_TRANSLATIONS_CDN_URL`)
   - `scripts/upload-locales.mjs` (Script to sync `messages/runtime/` to CDN)
   - `localization_base/<source_locale>.json` & `metadata.json` (Canonical catalog & versions — **never delete**)
   - `messages/<locale>.json` (Authoritative target catalogs)
   - `messages/runtime/<locale>.json` (Static runtime bundles imported by Metro)
7. **Root Integration**: Adding `import './i18n';` in `App.tsx` or `app/_layout.tsx`.
8. Confirm with user before proceeding (or proceed if `--yes` / requested).

### Phase C: Initialize
Initialize configuration and Expo scaffolding:
```bash
shallok init --source en --locales kn,hi --framework expo --yes
```
1. If migrating from an existing non-standard folder (e.g., `locales/` or `src/locales/`), copy/migrate existing translations into `messages/` and reconcile into `localization_base/`.
2. **Update all code references**: Replace legacy imports like `import en from './locales/en.json'` with `messages/runtime/` or CDN loader.
3. Configure `.env` and `.env.example` with `EXPO_PUBLIC_TRANSLATIONS_CDN_URL` and ask the user to update it with their CDN URL.
4. Scaffold `scripts/upload-locales.mjs` if CDN loading is chosen.

Ensure mobile dependencies are installed:
```bash
npx expo install expo-localization
pnpm add i18next react-i18next
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
   This extracts text inside `<Text>`, `<Button title="...">`, and `<TextInput placeholder="...">` into `localization_base/en.json`.

3. **Mandatory Context Check & Enrichment (Performed by AI Agent)**:
   - Review `localization_base/en.json`.
   - **Verify that every key has proper semantic context**.
   - If any key lacks context or has only generic AST descriptions, inspect the mobile screen and component context and enrich `context` with semantic clarity BEFORE proceeding to translation:
     ```bash
     shallok context set <key> "<semantic_description>"
     ```
     Or edit `"context"` directly in `localization_base/en.json`.
   - **Preservation Guarantee**: Shallok's reconciliation algorithm strictly preserves your enriched context across all future extractions.

### Phase E: Translate (AI-Driven from `localization_base/{source_locale}` + Context)
**No external API keys or LLM provider subscriptions are required.**
You, as the AI coding agent, generate the translations directly:

1. **Verify Context First**: Ensure all keys in `localization_base/<source_locale>.json` have proper semantic context.
2. **Check translation status**:
   ```bash
   shallok status --json
   ```
   Identify keys in `messages/<locale>.json` marked with `status: "missing"` or `status: "stale"`.

3. **Generate Translations from `localization_base/{source_locale}` and Its Context**:
   - Translate each string into culturally authentic target language (e.g. Kannada, Hindi) reading source `content` AND its semantic `context` from `localization_base/<source_locale>.json`.
   - Keep mobile screen space constraints in mind (e.g. concise button labels).
   - Use the source `content` and your enriched `context` for accurate terminology.
   - **Strict Rule**: Preserve all interpolation tokens (`{count}`, `{name}`, `{date}`) exactly as formatted in the source text.

4. **Update Target Locale Catalogs**:
   Write directly into `messages/<locale>.json` or use:
   ```bash
   shallok entry set <locale> <key> "<translated_text>"
   ```

### Phase F: Apply, Build & Validate
1. **Transform React Native components**:
   ```bash
   shallok extract --apply
   ```
   This injects `const { t } = useTranslation();` and replaces hardcoded text with `{t('key')}` using normalized dot-separated key paths.

2. **Verify Root Entry Integration**:
   Ensure `App.tsx` or `app/_layout.tsx` imports `i18n.ts`:
   ```tsx
   import './i18n'; // <-- Must be at the top of the entry file
   ```

3. **Compile runtime message bundles**:
   ```bash
   shallok build
   ```
   Compiles static dictionaries into `messages/runtime/<locale>.json`.

4. **Validate catalog integrity**:
   ```bash
   shallok validate
   ```
   Verifies 0 missing translations, 0 stale versions, 0 dropped or mismatched placeholders.
