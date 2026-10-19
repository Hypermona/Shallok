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
- Determine candidate source files and target locales from the user request.
- **Never edit files during Phase A.**

### Phase B: Plan and Review
Present a concise plan to the developer:
1. **Detected Framework**: Framework name and router type.
2. **Runtime Localization Solution**: Suggested runtime library (e.g. `next-intl`, `react-i18next`, `expo-localization`).
3. **Locales**: Source locale (e.g. `en`) and target locales (e.g. `kn` Kannada, `hi` Hindi).
4. **Planned Scaffolding**:
   - `localization.json` (Project manifest)
   - `localization_base/<source_locale>.json` & `metadata.json` (Canonical catalog & versions)
   - `messages/<locale>.json` (Locale catalogs)
   - Framework adapter configuration
5. Confirm with the user before proceeding (or proceed if `--yes` / user requested).

### Phase C: Initialize
Initialize project configuration and catalogs:
```bash
shallok init --source en --locales kn,hi --framework <name> --yes
```

### Phase D: Extract & Enrich Context (AI-Driven)
1. **Preview proposed extraction**:
   ```bash
   shallok extract --dry-run --json
   ```
2. **Extract strings and reconcile catalog**:
   ```bash
   shallok extract
   ```
3. **Enrich Context (Performed by AI Agent)**:
   - Inspect `localization_base/<source_locale>.json`.
   - While the CLI records initial AST element locations, you analyze the actual screen and component purpose.
   - Enrich `context` with semantic clarity (e.g. *"Primary CTA button on checkout page to trigger payment modal"*).
   - Use the CLI:
     ```bash
     shallok context set <key> "<semantic_description>"
     ```
     Or edit `"context"` directly in `localization_base/<source_locale>.json`.
   - **Preservation Guarantee**: Shallok's reconciliation algorithm strictly preserves your enriched context across all future extractions.

### Phase E: Translate (AI-Driven)
**No external API keys or LLM provider subscriptions are required.**
You, as the AI coding agent, generate the translations directly:

1. **Identify entries needing translation**:
   ```bash
   shallok status --json
   ```
   Inspect `messages/<locale>.json` for keys with `status: "missing"` or `status: "stale"`.

2. **Generate Translations**:
   - Translate each entry into natural, culturally accurate target language using the source `content` and your enriched `context`.
   - **Rule**: Strictly preserve all interpolation placeholders (`{name}`, `{count}`, `{price}`).

3. **Update Target Locale Catalogs**:
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
   Replaces hardcoded strings with `{t('key')}` and injects necessary hooks.

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
  Translate active keys into `messages/<locale>.json`, then run `shallok build && shallok validate`.

- **Source wording changed**:
  Run `shallok extract`. Only modified keys increment version (`key_version`); only dependent entries are flagged `stale`. Translate the changed string, then `shallok build`.

- **Rename a key**:
  ```bash
  shallok key rename <oldKey> <newKey>
  shallok build
  ```
