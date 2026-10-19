import { FrameworkConfig } from './manifest.js';

export interface ProjectAnalysis {
  framework: FrameworkConfig;
  sourceDirectories: string[];
  detectedLanguages: ('typescript' | 'javascript')[];
  existingLocalization: {
    library: string | null;
    configFile: string | null;
    catalogsFound: string[];
  };
  totalSourceFiles: number;
  candidateSourceFiles: string[];
  suggestedLocales: {
    source: string;
    targets: string[];
  };
}
