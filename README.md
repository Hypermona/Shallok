# Shallok: AI-Powered, Versioned Localization Tool

**Shallok** (`localize`) is a developer tool and AI agent skill that enables developers and AI coding agents to add, configure, and maintain localization in web applications with **AST-based transformations**, **deterministic per-key versioning**, and **incremental translations**.

---

## Key Features

- **Agent-Independent Core**: Works seamlessly via CLI in interactive terminal mode, CI/CD pipelines, and as machine-readable JSON for AI agents.
- **AST-Based Code Transformations**: Parses TSX/JSX and TypeScript safely with Babel; replaces hardcoded strings with hook calls without fragile regexes.
- **Stable Semantic Keys**: Generates deterministic semantic keys (e.g. `auth.sign_in`, `checkout.pay_now`) that remain stable across wording revisions.
- **Per-Key Versioning & SHA-256 Content Hashing**: Changing one string increments only its version; unrelated translations are preserved.
- **Incremental Translation**: Only translates missing, stale, or explicitly requested entries, avoiding redundant API costs.
- **Provider-Independent Engine**: Includes a deterministic mock dictionary provider for offline testing and an AI/LLM provider for production translations.
- **Framework Adapters**: First-class support for React (`react-i18next`), Next.js App & Pages Router (`next-intl`), and Vue (`vue-i18n`).
- **Interactive Ink Terminal UI**: Beautiful interactive console screens with automatic non-TTY / `--json` fallback.
- **Agent Skill Included**: Pre-packaged `localize-app` skill with comprehensive workflow references.

---

## Repository Architecture

```text
shallok/
├── apps/
│   └── cli/                       # Commander CLI + Ink terminal UI
│       └── src/
│           ├── commands/          # analyze, init, extract, translate, status, etc.
│           ├── ui/                # Ink React terminal components
│           ├── output/            # Output formatting & JSON printer
│           └── index.ts           # CLI binary entry point
├── packages/
│   ├── core/                      # Engine: AST extraction, hashing, versioning, reconciliation
│   ├── framework-adapters/        # React, Next.js, and Vue adapters
│   └── translation-providers/     # Mock and LLM provider implementations
├── skills/
│   └── localize-app/              # AI Agent skill and reference manuals
├── examples/
│   ├── react-app/                 # Example React + TypeScript application
│   └── nextjs-app/                # Example Next.js App Router application
├── tests/                         # Full Vitest integration test suite
└── README.md
```

---

## Installation & Setup

### Prerequisites
- Node.js LTS (v20+ or v24+)
- pnpm / npm / yarn / bun

---

## Two Ways to Use Shallok

### 1. Developer CLI Entrypoint (`npx shallok init`)
Run in any React, Next.js, Expo, or Astro project:
```bash
npx shallok init
```
This command automatically:
1. Analyzes project architecture and detects the framework and router.
2. Scaffolds `localization.json`, `localization_base/`, `messages/`, and framework files.
3. **Installs `shallok` into `devDependencies`** (using your detected package manager: pnpm, npm, yarn, or bun).
4. **Adds the agent skills** directly into `.agents/skills/` and `skills/` so AI coding agents immediately recognize them.

### 2. Direct AI Agent Skill Entrypoint
Alternatively, install or copy any of the skills from `skills/` into your AI coding agent (e.g. into `.agents/skills/` or Claude/Cursor/Copilot).
Then simply prompt your AI agent:
> *"Add localization to this application with Kannada and Hindi"*

The AI agent will:
1. **Check if `shallok` CLI is present** in the project.
2. **If not present, install `shallok` into `devDependencies` automatically**.
3. Execute the 6-phase staged workflow (Analyze → Plan → Init → Extract & Enrich Context → Translate → Build & Validate) with **0 external API keys required**.

---

## Development & Local Setup
```bash
git clone https://github.com/your-org/shallok.git
cd shallok
pnpm install
pnpm build
```

Run CLI locally:
```bash
# Direct run
node apps/cli/dist/index.js --help

# Or via pnpm filter
pnpm --filter shallok run build
```


## CLI Commands

### 1. Repository Analysis
Inspects repository architecture, detected framework, languages, and existing localization setup:
```bash
localize analyze
localize analyze --json
```

### 2. Initialization
Scaffolds `localization.json`, `localization_base/`, message catalogs, and framework setup:
```bash
localize init --source en --locales kn,hi,fr --framework react --yes
```

### 3. Extraction & Reconciliation
Extracts user-facing strings into canonical keys:
```bash
# Preview proposed keys and transformations without modifying files
localize extract --dry-run

# Reconcile canonical catalog
localize extract

# Apply AST transformations to source code
localize extract --apply
```

### 4. Translation
Generates translations for missing or stale keys:
```bash
# Translate all target locales using default provider
localize translate

# Target a specific locale
localize translate --locale kn

# Retranslate all entries
localize translate --force
```

### 5. Status & Health
View translation completeness percentages, active, missing, and stale counts:
```bash
localize status
localize status --json
```

### 6. Validation
Validates catalog integrity, stale translations, and placeholder parity (`{name}`):
```bash
localize validate
```

### 7. Build Runtime Messages
Compiles the metadata-rich catalog into clean runtime message files for runtime libraries:
```bash
localize build
localize build --format nested
```

### 8. Manage Locales
Add or remove target locales:
```bash
localize locale add de
localize locale remove fr
```

### 9. Key Rename
Safely renames a key across canonical catalog, all locale catalogs, and all source references:
```bash
localize key rename old.key auth.login
```

### 10. Enrich Translation Context (AI Agent / Developer)
Updates the semantic context for a key in the canonical catalog (preserves across future extractions):
```bash
localize context set app.pay_now "Primary CTA button in checkout flow to trigger payment modal"
```

### 11. Set Translation Entry (AI Agent / Developer)
Updates or adds a translated string directly into a locale catalog without needing external API keys:
```bash
localize entry set kn app.pay_now "ಈಗ ಪಾವತಿಸಿ"
```

### 12. Sync
Executes the complete pipeline (extract, translate, build, validate):
```bash
localize sync --dry-run
localize sync
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

Shallok provides both a framework-independent core skill and tailored framework-specific skills for AI coding agents:

1. **`skills/localization-and-translation-i18n/`** (Framework-Independent)
   - Works across any JavaScript / TypeScript application.
2. **`skills/react-localization-and-translation-i18n/`** (React)
   - Tailored for React (Vite, CRA, Webpack) using `react-i18next`.
3. **`skills/nextjs-localization-and-translation-i18n/`** (Next.js)
   - Tailored for Next.js 13+ App Router & Pages Router using `next-intl`.
4. **`skills/expo-localization-and-translation-i18n/`** (Expo & React Native)
   - Tailored for Expo / React Native mobile apps using `expo-localization` and `i18next`.
5. **`skills/astro-localization-and-translation-i18n/`** (Astro)
   - Tailored for Astro websites and UI islands using `astro:i18n`.

### How to Use Skills with AI Agents
1. Point or link your AI coding agent to the appropriate `SKILL.md` (e.g., `skills/localization-and-translation-i18n/SKILL.md` or framework-specific skill).
2. Give your agent simple, high-level instructions:
   - *"Add localization to this application with Kannada and Hindi."*
   - *"Extract strings from the new checkout page."*
   - *"Enrich context and translate all missing or stale keys."*
3. The AI agent executes the 6-phase workflow (**Analyze → Plan → Initialize → Extract → Translate → Validate**) with **zero external API keys required**.


---

## Running the Test Suite

```bash
pnpm test
```
Runs the full Vitest suite covering hashing, key generation, AST extraction and transformation, per-key versioning, translation orchestrator, and framework adapters.
