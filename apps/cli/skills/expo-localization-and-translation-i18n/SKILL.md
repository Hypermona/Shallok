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
   - Scaffolds `i18n.ts` configuring `expo-localization` and `i18next`.
   - AST parses mobile React Native components (`shallok extract`).
   - Replaces user-facing strings in `<Text>`, `<TextInput>`, and props with `{t('key')}` (`shallok extract --apply`).
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
- Identify mobile entry point (`App.tsx`, `index.js`, or `app/_layout.tsx`).
- Identify candidate screen and component files (`src/**/*.tsx`, `app/**/*.tsx`, `components/**/*.tsx`).
- Note user-requested target locales (e.g. `kn`, `hi`, `fr`, `es`).
- **Never edit files during Phase A.**

### Phase B: Plan and Review
Present a concise plan to the developer:
1. **Framework & Libraries**: Expo / React Native with `expo-localization`, `i18next`, and `react-i18next`.
2. **Locales**: Source locale (e.g. `en`) and target locales (e.g. `kn` Kannada, `hi` Hindi).
3. **Dependencies to Install**:
   ```bash
   npx expo install expo-localization
   pnpm add i18next react-i18next
   ```
4. **Planned Scaffolding**:
   - `localization.json` (Project manifest)
   - `i18n.ts` (Mobile i18n initialization at root)
   - `localization_base/<source_locale>.json` & `metadata.json` (Canonical catalog & versions)
   - `messages/<locale>.json` (Authoritative target catalogs)
   - `messages/runtime/<locale>.json` (Static runtime bundles imported by Metro)
5. **Root Integration**: Adding `import './i18n';` in `App.tsx` or `app/_layout.tsx`.
6. Confirm with user before proceeding (or proceed if `--yes` / requested).

### Phase C: Initialize
Initialize configuration and Expo scaffolding:
```bash
shallok init --source en --locales kn,hi --framework expo --yes
```
This automatically creates:
- `localization.json`
- `i18n.ts` (with `getLocales()` device language detection)
- Initial catalogs in `localization_base/` and `messages/`
- Installs `shallok` in `devDependencies` and copies skills

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

3. **Enrich Context (Performed by AI Agent)**:
   - Review `localization_base/en.json`.
   - Inspect the mobile screen and component context.
   - Enrich `context` with semantic clarity (e.g. *"Header label on Bluetooth pairing bottom sheet modal"*).
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
   - Keep mobile screen space constraints in mind (e.g. concise button labels).
   - Use the source `content` and your enriched `context` for accurate terminology.
   - **Strict Rule**: Preserve all interpolation tokens (`{count}`, `{name}`, `{date}`) exactly as formatted in the source text.

3. **Update Target Locale Catalogs**:
   Write directly into `messages/<locale>.json` or use:
   ```bash
   shallok entry set <locale> <key> "<translated_text>"
   ```

### Phase F: Apply, Build & Validate
1. **Transform React Native components**:
   ```bash
   shallok extract --apply
   ```
   This injects `const { t } = useTranslation();` and replaces hardcoded text with `{t('key')}`.

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
