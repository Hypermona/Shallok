import { createHash } from 'node:crypto';

/**
 * Computes a deterministic SHA-256 hash for content and context.
 * Content and context changes constitute a translation-relevant source change.
 */
export function computeContentHash(content: string, context = ''): string {
  const normalizedContent = content.trim().replace(/\r\n/g, '\n');
  const normalizedContext = context.trim().replace(/\r\n/g, '\n');
  const payload = `${normalizedContent}::${normalizedContext}`;

  const hash = createHash('sha256').update(payload, 'utf8').digest('hex');
  return `sha256:${hash}`;
}
