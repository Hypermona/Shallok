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

### Phase B: Plan and Review
Present a concise plan to the developer (libraries, locales, scaffolding).

### Phase C: Initialize
```bash
shallok init --source en --locales kn,hi --framework expo --yes
```

### Phase D: Extract & Enrich Context (AI-Driven)
1. Preview proposed extraction: `shallok extract --dry-run --json`
2. Extract strings to canonical catalog: `shallok extract`
3. Enrich Context: `shallok context set <key> "<semantic_description>"`

### Phase E: Translate (AI-Driven)
1. Check translation status: `shallok status --json`
2. Generate Natural Translations preserving interpolation tokens (`{count}`, `{name}`, etc.).
3. Update Target Locale Catalogs directly or via: `shallok entry set <locale> <key> "<translated_text>"`

### Phase F: Apply, Build & Validate
1. Transform React Native components: `shallok extract --apply`
2. Compile runtime message bundles: `shallok build`
3. Validate catalog integrity: `shallok validate`
