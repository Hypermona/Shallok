import { z } from 'zod';
import { Occurrence } from './catalog.js';

export interface ExtractedString {
  suggestedKey: string;
  content: string;
  context: string;
  hasExplicitComment?: boolean;
  occurrence: Occurrence;
  variables?: string[];
  isAmbiguous?: boolean;
}

export interface ExtractionResult {
  strings: ExtractedString[];
  modifiedFiles: string[];
  skippedStrings: Array<{
    reason: string;
    content: string;
    occurrence: Occurrence;
  }>;
}

export interface FileTransformResult {
  filePath: string;
  originalCode: string;
  transformedCode: string;
  changed: boolean;
  extractedKeys: string[];
}
