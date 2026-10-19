---
name: localize-app
description: Instructions and workflows for AI coding agents to inspect, initialize, extract, version, enrich context, translate, and maintain localization in web applications without requiring external translation API keys.
---

# Localize App Skill (Agent-Native Workflow)

Use this skill when asked to add, configure, update, or audit localization in a project (e.g., *"Add localization to this application"*, *"Add Kannada and Hindi"*, *"Translate new strings"*, *"Update stale translations"*).

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

## Core Architecture & Agent Role

Shallok pairs a deterministic AST CLI (`shallok`) with **the AI Agent as the translator and context enricher**:

1. **The CLI (`shallok`)** handles deterministic tasks:
   - AST extraction and safe code transformations (`shallok extract`).
   - Per-key versioning and SHA-256 hash reconciliation (`localization_base/`).
   - Runtime message compilation (`shallok build`).
   - Placeholder and catalog integrity checks (`shallok validate`).

2. **The AI Agent (You)** handles semantic intelligence:
   - **No external API keys or LLM provider keys needed!** You, as the AI agent, generate the translations directly.
   - **Context Enrichment**: You analyze the UI components, user flows, and screen layouts to provide rich, meaningful semantic `context` in `localization_base/` for each key.
   - **Culturally Appropriate Translations**: You translate the strings into configured target locales while strictly preserving interpolation tokens (e.g., `{count}`, `{name}`).

---

## 6-Phase Agent Workflow

### Phase A: Analyze
Execute read-only repository inspection before making changes:
```bash
shallok analyze --json
```

### Phase B: Plan and Review
Present a concise plan to the developer (framework, router, locales, scaffolding).

### Phase C: Initialize
```bash
shallok init --source en --locales kn,hi --framework <name> --yes
```

### Phase D: Extract & Enrich Context
1. Preview proposed extraction: `shallok extract --dry-run --json`
2. Extract strings: `shallok extract`
3. Enrich Context: `shallok context set <key> "<semantic_description>"`

### Phase E: Translate (AI-Driven)
1. Check status: `shallok status --json`
2. Generate Natural Translations preserving `{tokens}`.
3. Update catalog directly or via: `shallok entry set <locale> <key> "<translated_text>"`

### Phase F: Apply, Build & Validate
1. Transform source components: `shallok extract --apply`
2. Compile runtime message bundles: `shallok build`
3. Validate catalog integrity: `shallok validate`
