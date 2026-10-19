import { ITranslationProvider, TranslationOptions, TranslationRequestItem, TranslationResponseItem } from '../types.js';

export interface LLMProviderConfig {
  apiKey?: string;
  endpoint?: string;
  model?: string;
  temperature?: number;
  maxRetries?: number;
}

export class LLMTranslationProvider implements ITranslationProvider {
  name = 'llm';
  private apiKey: string;
  private endpoint: string;
  private model: string;
  private maxRetries: number;

  constructor(config: LLMProviderConfig = {}) {
    this.apiKey =
      config.apiKey ||
      process.env.TRANSLATION_API_KEY ||
      process.env.OPENAI_API_KEY ||
      process.env.GEMINI_API_KEY ||
      '';
    this.endpoint =
      config.endpoint ||
      process.env.TRANSLATION_API_ENDPOINT ||
      'https://api.openai.com/v1/chat/completions';
    this.model = config.model || process.env.TRANSLATION_MODEL || 'gpt-4o-mini';
    this.maxRetries = config.maxRetries ?? 3;
  }

  async translateBatch(
    items: TranslationRequestItem[],
    options: TranslationOptions
  ): Promise<TranslationResponseItem[]> {
    if (items.length === 0) {
      return [];
    }

    if (!this.apiKey) {
      throw new Error(
        'LLM translation provider requires an API key. Set TRANSLATION_API_KEY or OPENAI_API_KEY environment variable.'
      );
    }

    const systemPrompt = `You are an expert software localization engine.
Your task is to translate UI strings from source language "${options.sourceLocale}" to target language "${options.targetLocale}".
Strict rules:
1. Preserve all interpolation variables (e.g., {name}, {count}) exactly as they appear in the source text.
2. Maintain HTML/JSX entities, formatting, and tone: ${options.formality || 'neutral'}.
3. Return a valid JSON array of objects with the structure:
[
  {
    "key": "string",
    "translatedValue": "string",
    "reviewRequired": false
  }
]
No explanation, markdown blocks, or surrounding text.`;

    const userPrompt = JSON.stringify(
      items.map((item) => ({
        key: item.key,
        content: item.content,
        context: item.context,
      }))
    );

    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await fetch(this.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: this.model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            temperature: 0.2,
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`LLM API returned status ${response.status}: ${errText}`);
        }

        const data: any = await response.json();
        const rawContent = data.choices?.[0]?.message?.content?.trim();
        if (!rawContent) {
          throw new Error('Empty response from LLM API.');
        }

        // Clean json markdown code fence if present
        const cleanedJson = rawContent.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
        const parsed = JSON.parse(cleanedJson) as TranslationResponseItem[];

        if (!Array.isArray(parsed)) {
          throw new Error('LLM response is not an array.');
        }

        return parsed;
      } catch (err: any) {
        lastError = err;
        if (attempt < this.maxRetries) {
          // Exponential backoff
          await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 500));
        }
      }
    }

    throw lastError || new Error('Translation batch failed.');
  }
}
