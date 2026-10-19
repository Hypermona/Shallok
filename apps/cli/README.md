# Shallok (`shallok`)

> AI-Powered, Versioned Localization Tool for Developers & AI Coding Agents.

Shallok is a developer tool and AI agent skill system that enables developers and AI coding agents (Antigravity, Cursor, Claude Code, GitHub Copilot) to add, configure, extract, translate, and maintain localization across existing codebases.

## Features

- **AST-Based Extraction**: Deterministic AST parsing (Babel) safely extracts user-facing text and attributes into stable semantic keys.
- **Agent-Native Translation**: **Zero external API keys required**. AI coding agents translate missing and stale keys directly with natural cultural fluency.
- **AI-Enriched Semantic Context**: Context notes are enriched by AI agents and strictly preserved across extractions.
- **Per-Key Versioning & Content Hashing**: SHA-256 content hashes detect source modifications and mark translations stale on a granular, per-key basis.
- **Framework Adapters**:
  - **React**: `react-i18next` with `src/i18n.ts`
  - **Next.js**: `next-intl` (App Router `routing.ts`, `request.ts`, `middleware.ts`)
  - **Expo / React Native**: `expo-localization` + `i18next` with native device locale detection
  - **Astro**: `astro:i18n` with dynamic message compilation
- **Placeholder & Integrity Validation**: Validates 0 missing keys, 0 stale versions, and 0 corrupted placeholder tokens (`{count}`, `{name}`).

---

## Quickstart

### 1. Developer CLI Quickstart
Run in any React, Next.js, Expo, or Astro project:
```bash
npx shallok init
```
This command automatically:
1. Analyzes project architecture, detected framework, and router.
2. Scaffolds `localization.json`, `localization_base/`, `messages/`, and framework files.
3. Installs `shallok` into `devDependencies` using your project's package manager.
4. Installs AI agent skills directly into `.agents/skills/` and `skills/`.

### 2. Direct AI Agent Skill Usage
Copy any of the skills from `skills/` into your AI agent's skills directory (e.g. `.agents/skills/`), then tell your agent:
> *"Add localization to this application with Kannada and Hindi"*

The agent automatically verifies `shallok` is present, installs it if needed, and executes the complete 6-phase localization workflow.

---

## CLI Commands

```bash
# Analyze project architecture
shallok analyze --json

# Initialize configuration and framework files
shallok init --source en --locales kn,hi,fr --framework react --yes

# Extract strings and preview changes
shallok extract --dry-run
shallok extract

# Apply AST transformations to source code
shallok extract --apply

# Check localization status
shallok status

# Compile runtime message bundles
shallok build

# Validate placeholder and catalog integrity
shallok validate
```

---

## License

MIT © Shallok Contributors
