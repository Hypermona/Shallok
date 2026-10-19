# Translation Engine & Agent-Native Translation Reference

## Agent-Native Translation (Primary Workflow)
When using Shallok via an AI coding agent (e.g., in Claude, Cursor, Copilot, Antigravity):
- **No external API keys or LLM provider subscriptions are needed.**
- The AI agent itself generates accurate, natural translations for each target locale.
- The AI agent inspects `messages/<locale>.json` or runs `localize status --json` to identify entries with `status: "missing"` or `status: "stale"`.
- The AI agent writes the translated strings into `messages/<locale>.json` (or uses `localize entry set <locale> <key> "<translated_text>"`).

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

If a translation drops a placeholder or introduces an invalid placeholder, `localize validate` will fail with an error.

---

## CLI-Based Translation (Optional / Fallback)
For automated pipelines or scripts running outside an interactive AI agent:
1. **Mock Provider (`mock`)**: Default provider with built-in dictionary for local development and CI testing.
2. **LLM Provider (`llm`)**: Calls OpenAI, Gemini, or Anthropic HTTP APIs when `TRANSLATION_API_KEY` is provided.
