# Translation Engine & Agent-Native Translation Reference

## Agent-Native Translation (Primary Workflow)
When using Shallok via an AI coding agent (e.g., in Antigravity, Claude, Cursor, Copilot):
- **No external API keys or LLM provider subscriptions are needed.**
- The AI agent itself generates accurate, natural translations for each target locale.
- **Always verify context first**: Before translating any key, check that all keys in `localization_base/<source_locale>.json` have proper semantic context. If any key lacks context or has generic AST context, generate rich context before translating.
- **Always translate from `localization_base/<source_locale>.json` and its context**: Never translate raw isolated string fragments. Combine the canonical source `content` and its semantic `context` to generate culturally authentic, grammatically correct translations.
- Inspect `messages/<locale>.json` or run `shallok status --json` to identify entries with `status: "missing"` or `status: "stale"`.
- Write the translated strings into `messages/<locale>.json` (or use `shallok entry set <locale> <key> "<translated_text>"`).

## Core Rules for Translations

### 1. Pre-Flight Verification & Persistence
- Before making changes to a new or existing repo, verify `shallok` is installed and check that `localization.json` and `localization_base/` exist. If not, initialize with `shallok init`.
- **NEVER delete `localization.json` or `localization_base/`**. They hold the single source of truth, content hashes, version counters, and context.

### 2. Normalized Dot-Paths for Keys
- All keys must use normalized dot notation (e.g., `"checkout.pay_now"`, `"auth.login.title"`).
- Never use nested object structures. If an existing codebase uses nested objects for keys, ask the user to convert/flatten them to normalized dot-path keys.

### 3. Standardized `messages/` Folder
- All translations must reside in `messages/` (`messages/<locale>.json` and `messages/runtime/<locale>.json`).
- If an existing project uses another directory (such as `locales/`, `src/locales/`, `translations/`), ask the user to switch to `messages/` and migrate existing files.

### 4. Context Verification Before Translation
- Check all keys in `localization_base/<source_locale>.json` have meaningful semantic context.
- If any key lacks context, generate clear context describing the screen, element, and user action before initiating translation.

### 5. Always Translate from Source Locale Catalog + Context
- Read both `content` and `context` from `localization_base/<source_locale>.json`.
- Preserve all interpolation placeholders (`{name}`, `{count}`, `{amount}`) exactly as formatted.

---

### Translation Schema
Each entry in `messages/<locale>.json` maintains:
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

### Supported Statuses
- `missing`: Key exists in canonical catalog but has no translation.
- `stale`: Key source version was incremented; old translation preserved for reference.
- `translated`: Translated and matching the current canonical `source_version`.
- `review_required`: Flagged for human review.
- `approved`: Formally approved translation.

---

## Placeholder Preservation Rules
The AI agent must strictly preserve all interpolation placeholders in target translations:
- Source: `"Welcome back, {userName}! You have {itemCount} items in your cart."`
- Kannada: `"ಮರಳಿ ಸ್ವಾಗತ, {userName}! ನಿಮ್ಮ ಕಾರ್ಟ್‌ನಲ್ಲಿ {itemCount} ಐಟಂಗಳು ಇವೆ."`
- Hindi: `"वापसी पर स्वागत है, {userName}! आपके कार्ट में {itemCount} आइटम हैं।"`

If a translation drops a placeholder or introduces an invalid placeholder, `shallok validate` will fail with an error.

---

## CLI-Based Translation (Optional / Fallback)
For automated pipelines or scripts running outside an interactive AI agent:
1. **Mock Provider (`mock`)**: Default provider with built-in dictionary for local development and CI testing.
2. **LLM Provider (`llm`)**: Calls OpenAI, Gemini, or Anthropic HTTP APIs when `TRANSLATION_API_KEY` is provided.
