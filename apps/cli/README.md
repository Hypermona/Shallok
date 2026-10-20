# Shallok (`shallok`)

> AI-Powered, Versioned Localization Tool for Developers & AI Coding Agents.

[![npm version](https://img.shields.io/npm/v/shallok.svg)](https://www.npmjs.com/package/shallok)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

**Shallok** is a developer tool and AI agent skill system that enables developers and AI coding agents (Antigravity, Cursor, Claude Code, GitHub Copilot) to add, configure, extract, translate, and maintain localization across existing codebases with **AST-based transformations**, **deterministic per-key versioning**, and **agent-native incremental translations**.

---

## Features

- **Agent-Native Translation**: **Zero external API keys required**. AI coding agents translate missing and stale keys directly with natural cultural fluency.
- **AST-Based Code Transformations**: Parses TSX/JSX and TypeScript safely with Babel; replaces hardcoded strings with framework hook/function calls without fragile regexes.
- **Per-Key Versioning & SHA-256 Content Hashing**: Granular content hashing detects source modifications; changing one string increments only its version while preserving all other translations.
- **AI-Enriched Semantic Context**: Context notes are enriched by AI agents and developers, strictly preserved across extractions.
- **Framework Adapters**: First-class support for:
  - **React**: `react-i18next` with `src/i18n.ts`
  - **Next.js**: `next-intl` (App Router `routing.ts`, `request.ts`, `middleware.ts` & Pages Router)
  - **Expo / React Native**: `expo-localization` + `i18next` with native device locale detection
  - **Astro**: `astro:i18n` with dynamic message compilation and UI island support
  - **Vue**: `vue-i18n` with Vue composition API setup
- **Placeholder & Integrity Validation**: Validates 0 missing keys, 0 stale versions, and 0 corrupted placeholder tokens (`{count}`, `{name}`).
- **Interactive Ink Terminal UI**: Beautiful interactive console screens with automatic non-TTY and `--json` fallback for AI agent orchestration.
- **5 Pre-Packaged Agent Skills**: Tailored skills for general i18n, React, Next.js, Expo, and Astro.

---

## Two Ways to Use Shallok

### 1. Developer CLI Quickstart (`npx shallok init`)

Run in any React, Next.js, Expo, Astro, or Vue project:
```bash
npx shallok init
```
This command automatically:
1. Analyzes project architecture, detected framework, and router.
2. Scaffolds `localization.json`, `localization_base/`, `messages/`, and framework runtime files.
3. Installs `shallok` into `devDependencies` using your detected package manager (pnpm, npm, yarn, or bun).
4. Installs AI agent skills directly into `.agents/skills/` and `skills/` so AI coding agents immediately recognize them.

### 2. Direct AI Agent Skill Usage

Alternatively, install or copy any of the skills from `skills/` into your AI coding agent (e.g. `.agents/skills/` or Claude/Cursor/Copilot), then tell your agent:
> *"Add localization to this application with Kannada and Hindi"*

The AI agent will:
1. Check if `shallok` CLI is present in the project.
2. If not present, install `shallok` into `devDependencies` automatically.
3. Execute the 6-phase staged workflow (**Analyze → Plan → Init → Extract & Enrich Context → Translate → Build & Validate**) with **0 external API keys required**.

---

## CLI Commands Reference

> Run via your package runner (`npx shallok`, `pnpm shallok`) or global install (`npm i -g shallok`).

### Project Setup & Analysis
```bash
# Analyze repository architecture without modifying files
shallok analyze
shallok analyze --json

# Initialize configuration and framework files
shallok init
shallok init --source en --locales kn,hi,fr --framework react --yes
```

### Extraction & Code Transformation
```bash
# Preview proposed keys and transformations without modifying files
shallok extract --dry-run

# Reconcile canonical catalog without modifying source code
shallok extract

# Apply AST transformations to source code (replaces hardcoded strings with t(...) calls)
shallok extract --apply
```

### Translation & Context
```bash
# Generate missing or stale translations
shallok translate
shallok translate --locale kn
shallok translate --force

# Update semantic context for a key in canonical catalog (preserved across future extractions)
shallok context set app.pay_now "Primary CTA button in checkout flow to trigger payment modal"

# Directly update a translated entry in a locale catalog
shallok entry set kn app.pay_now "ಈಗ ಪಾವತಿಸಿ"
```

### Health, Validation & Build
```bash
# Check localization status & translation completeness
shallok status
shallok status --json

# Produce a full localization health report
shallok report
shallok report --json

# Validate placeholder parity ({name}) and catalog integrity
shallok validate

# Compile runtime-compatible message bundles
shallok build
shallok build --format nested
```

### Management & Automation
```bash
# Add or remove target locales
shallok locale add de
shallok locale remove fr

# Rename a key across canonical catalog, locale catalogs, and source references
shallok key rename old.key auth.login

# Full end-to-end sync pipeline (extract, translate, build, and validate)
shallok sync --dry-run
shallok sync --yes
```

---

## Manifest Schema: `localization.json`

Located at the root of the target project:
```json
{
  "schema_version": 1,
  "localization_version": 1,
  "source_locale": "en",
  "supported_locales": ["en", "kn", "hi", "fr", "de"],
  "framework": {
    "name": "nextjs",
    "router": "app",
    "localization_library": "next-intl",
    "library_version": null
  },
  "paths": {
    "source_directories": ["src"],
    "base_directory": "localization_base",
    "translations_directory": "messages"
  },
  "key_strategy": "semantic",
  "translation": {
    "provider": "mock",
    "model": null,
    "batch_size": 25
  },
  "options": {
    "include_accessibility_text": true,
    "preserve_obsolete_keys": true,
    "require_review_for_ambiguous_strings": true,
    "require_review_for_stale_translations": true
  }
}
```

---

## Agent Skills Included

Shallok ships with 5 tailored skills for AI coding agents:
- `skills/localization-and-translation-i18n/`: Framework-independent core workflow
- `skills/react-localization-and-translation-i18n/`: React (`react-i18next`)
- `skills/nextjs-localization-and-translation-i18n/`: Next.js (`next-intl`)
- `skills/expo-localization-and-translation-i18n/`: Expo & React Native (`expo-localization` + `i18next`)
- `skills/astro-localization-and-translation-i18n/`: Astro (`astro:i18n`)

---

## License

MIT © [Shallok Contributors](https://github.com/Hypermona/Shallok)
