import path from 'node:path';

// Note: Do NOT include direction prepositions ('in', 'out', 'on', 'off', 'up', 'down')
// as they are vital in UI terms like "sign_in", "sign_out", "log_in", "check_out"
const COMMON_STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'to', 'of', 'for', 'with', 'at', 'by'
]);

/**
 * Normalizes a string into a clean snake_case slug suitable for a key part.
 */
export function slugify(text: string, maxWords = 4): string {
  const cleaned = text
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, ' ')
    .trim();

  const words = cleaned
    .split(/\s+/)
    .filter((w) => w.length > 0 && !COMMON_STOP_WORDS.has(w));

  const chosenWords = words.length > 0 ? words.slice(0, maxWords) : ['text'];
  return chosenWords.join('_').slice(0, 32);
}

/**
 * Derives a clean namespace from a file path.
 * e.g., "src/components/checkout/PaymentForm.tsx" -> "checkout"
 * "src/components/checkout.tsx" -> "checkout"
 * "src/app/auth/login/page.tsx" -> "auth.login"
 */
export function deriveNamespace(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const parsed = path.parse(normalized);
  
  // Clean up directory segments
  const parts = parsed.dir
    .split('/')
    .filter((p) => p && !['src', 'components', 'pages', 'app', 'routes', 'views'].includes(p.toLowerCase()));

  let baseName = parsed.name.toLowerCase();
  const isGenericName = ['index', 'page', 'component', 'view', 'route', 'paymentform', 'form', 'modal', 'card'].includes(baseName);

  if (isGenericName && parts.length > 0) {
    baseName = parts.pop()!;
  }

  const namespaceParts = [...parts, baseName]
    .map((p) => p.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase())
    .filter(Boolean);

  if (namespaceParts.length === 0) {
    return 'common';
  }

  // Use up to 2 segments for namespace: e.g. "auth.login" or "checkout"
  return namespaceParts.slice(-2).join('.');
}

/**
 * Generates a stable semantic key for a given string and occurrence context.
 */
export function generateSemanticKey(options: {
  filePath: string;
  content: string;
  context?: string;
  existingKeys?: Map<string, string> | Set<string>; // key -> content
  overrideKey?: string;
}): string {
  if (options.overrideKey) {
    return options.overrideKey;
  }

  const namespace = deriveNamespace(options.filePath);
  const actionOrNoun = slugify(options.content, 4) || 'text';
  let candidateKey = `${namespace}.${actionOrNoun}`;

  if (!options.existingKeys) {
    return candidateKey;
  }

  // Check for collision
  const existingSet = options.existingKeys instanceof Set
    ? options.existingKeys
    : new Set(options.existingKeys.keys());

  if (!existingSet.has(candidateKey)) {
    return candidateKey;
  }

  // If existingKeys is a Map of key -> content, check if the content matches
  if (options.existingKeys instanceof Map) {
    const existingContent = options.existingKeys.get(candidateKey);
    if (existingContent === options.content) {
      return candidateKey; // Identical string can share the key
    }
  }

  // Collision with different content: disambiguate using context or numeric suffix
  if (options.context) {
    const contextSlug = slugify(options.context, 2);
    const contextualKey = `${candidateKey}_${contextSlug}`;
    if (!existingSet.has(contextualKey)) {
      return contextualKey;
    }
  }

  let counter = 2;
  while (existingSet.has(`${candidateKey}_${counter}`)) {
    counter++;
  }

  return `${candidateKey}_${counter}`;
}
