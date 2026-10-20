# Shallok: AI-Powered, Versioned Localization Tool

**Shallok** is a developer tool and AI agent skill system that enables developers and AI coding agents (Antigravity, Cursor, Claude Code, GitHub Copilot) to add, configure, extract, translate, and maintain localization across existing codebases with **AST-based transformations**, **deterministic per-key versioning**, and **agent-native incremental translations**.

---

## Key Features

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

### 1. Developer CLI Entrypoint (`npx shallok init`)

Run in any React, Next.js, Expo, Astro, or Vue project:
```bash
npx shallok init
```
This command automatically:
1. Analyzes project architecture, detected framework, and router.
2. Scaffolds `localization.json`, `localization_base/`, `messages/`, and framework runtime files.
3. **Installs `shallok` into `devDependencies`** (using your detected package manager: pnpm, npm, yarn, or bun).
4. **Installs AI agent skills** directly into `.agents/skills/` and `skills/` so AI coding agents immediately recognize them.

### 2. Direct AI Agent Skill Entrypoint

Alternatively, install or copy any of the skills from `skills/` into your AI coding agent (e.g. into `.agents/skills/` or Claude/Cursor/Copilot).

Then simply prompt your AI agent:
> *"Add localization to this application with Kannada and Hindi"*

The AI agent will:
1. **Check if `shallok` CLI is present** in the project.
2. **If not present, install `shallok` into `devDependencies` automatically**.
3. Execute the 6-phase staged workflow (**Analyze → Plan → Init → Extract & Enrich Context → Translate → Build & Validate**) with **0 external API keys required**.

---

## CLI Commands Reference

> Run via your package runner (`npx shallok`, `pnpm shallok`) or global install (`npm i -g shallok`).

### 1. Repository Analysis
Inspects repository architecture, detected framework, languages, and existing localization setup:
```bash
shallok analyze
shallok analyze --json
```

### 2. Initialization
Scaffolds `localization.json`, `localization_base/`, message catalogs, and framework runtime files:
```bash
# Interactive setup
shallok init

# Non-interactive / scripted
shallok init --source en --locales kn,hi,fr --framework react --yes
```

### 3. Extraction & Code Transformation
Extracts user-facing strings into canonical keys and updates source files:
```bash
# Preview proposed keys and transformations without modifying files
shallok extract --dry-run

# Reconcile canonical catalog without changing source code
shallok extract

# Apply AST transformations to source code (replaces hardcoded strings with t(...) calls)
shallok extract --apply
```

### 4. Translation
Generates translations for missing or stale keys:
```bash
# Translate all target locales
shallok translate

# Target a specific locale
shallok translate --locale kn

# Force retranslation of all entries
shallok translate --force
```

### 5. Status & Health
View translation completeness percentages, active, missing, and stale counts:
```bash
shallok status
shallok status --json
```

### 6. Validation
Validates catalog integrity, stale translations, and placeholder parity (`{name}`):
```bash
shallok validate
```

### 7. Build Runtime Messages
Compiles the metadata-rich catalog into clean runtime message files for runtime libraries:
```bash
shallok build
shallok build --format nested
```

### 8. Health Report
Produce a full localization health report with breakdown of all locales:
```bash
shallok report
shallok report --json
```

### 9. Manage Locales
Add or remove target locales from your active project:
```bash
shallok locale add de
shallok locale remove fr
```

### 10. Key Rename
Safely renames a key across the canonical catalog, all locale catalogs, and all source code references:
```bash
shallok key rename old.key auth.login
```

### 11. Enrich Translation Context
Updates the semantic context for a key in the canonical catalog (strictly preserved across future extractions):
```bash
shallok context set app.pay_now "Primary CTA button in checkout flow to trigger payment modal"
```

### 12. Set Translation Entry
Updates or adds a translated string directly into a locale catalog:
```bash
shallok entry set kn app.pay_now "ಈಗ ಪಾವತಿಸಿ"
```

### 13. Sync Pipeline
Executes the complete pipeline (extract, translate, build, and validate) in a single run:
```bash
shallok sync --dry-run
shallok sync --yes
```

---

## Configuration: `localization.json`

Located at the root of your project:
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

## Canonical Source Catalog: `localization_base/`

Stores source strings and per-key versioning metadata:
```json
{
  "checkout.pay_now": {
    "key": "checkout.pay_now",
    "content": "Pay now",
    "context": "Primary action button on checkout screen",
    "relative_file_path": "src/components/checkout.tsx",
    "occurrences": [
      {
        "relative_file_path": "src/components/checkout.tsx",
        "line": 42
      }
    ],
    "last_updated_at": "2026-10-19T10:00:00.000Z",
    "key_version": 1,
    "content_hash": "sha256:4d78...",
    "status": "active"
  }
}
```

---

## Agent Skills: `skills/`

Shallok includes 5 pre-packaged skills designed for AI coding agents:

1. **[`localization-and-translation-i18n`](skills/localization-and-translation-i18n/)** (Framework-Independent)
   - Universal 6-phase localization workflow for any JavaScript / TypeScript application.
2. **[`react-localization-and-translation-i18n`](skills/react-localization-and-translation-i18n/)** (React)
   - Tailored for React (Vite, Next.js, CRA) using `react-i18next`.
3. **[`nextjs-localization-and-translation-i18n`](skills/nextjs-localization-and-translation-i18n/)** (Next.js)
   - Tailored for Next.js 13+ App Router & Pages Router using `next-intl`.
4. **[`expo-localization-and-translation-i18n`](skills/expo-localization-and-translation-i18n/)** (Expo & React Native)
   - Tailored for Expo / React Native mobile apps using `expo-localization` and `i18next`.
5. **[`astro-localization-and-translation-i18n`](skills/astro-localization-and-translation-i18n/)** (Astro)
   - Tailored for Astro websites and UI islands using `astro:i18n`.

---

## Repository Architecture

```text
shallok/
├── apps/
│   └── cli/                                           # Standalone Shallok CLI binary
│       ├── src/
│       │   ├── commands/                              # analyze, init, extract, translate, status, etc.
│       │   ├── ui/                                    # Ink React terminal UI components
│       │   ├── output/                                # Formatting & machine-readable JSON output
│       │   └── index.ts                               # CLI binary entry point
│       └── tsup.config.ts                             # Bundler configuration (self-contained ESM)
├── packages/
│   ├── core/                                          # AST engine, content hashing, per-key versioning
│   ├── framework-adapters/                            # React, Next.js, Expo, Astro, and Vue adapters
│   └── translation-providers/                         # Mock and LLM provider integrations
├── skills/
│   ├── localization-and-translation-i18n/             # Framework-independent AI agent skill
│   ├── react-localization-and-translation-i18n/        # React (react-i18next) skill
│   ├── nextjs-localization-and-translation-i18n/       # Next.js (next-intl) skill
│   ├── expo-localization-and-translation-i18n/         # Expo & React Native skill
│   └── astro-localization-and-translation-i18n/        # Astro (astro:i18n) skill
├── examples/
│   ├── react-app/                                     # Example React + TypeScript application
│   └── nextjs-app/                                    # Example Next.js App Router application
├── tests/                                             # Full Vitest integration & e2e test suite
└── README.md
```

---

## Development & Local Setup

```bash
git clone https://github.com/Hypermona/Shallok.git
cd Shallok
pnpm install
pnpm build
```

Run CLI locally:
```bash
# Direct run
node apps/cli/dist/index.js --help

# Run full test suite
pnpm test

# Typecheck all packages
pnpm typecheck
```

---

## License

MIT © Shallok Contributors
