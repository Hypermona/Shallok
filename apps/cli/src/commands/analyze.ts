import React from 'react';
import { render } from 'ink';
import { analyzeProject } from '@shallok/core';
import { Printer } from '../output/printer.js';
import { AnalysisView } from '../ui/AnalysisView.js';

export async function analyzeCommand(options: { json?: boolean }): Promise<void> {
  const cwd = process.cwd();
  const printer = new Printer(options.json);

  try {
    const analysis = await analyzeProject(cwd);

    if (options.json) {
      printer.json(analysis);
      return;
    }

    if (process.stdout.isTTY) {
      render(React.createElement(AnalysisView, { analysis }));
    } else {
      printer.header('Shallok • Project Analysis');
      printer.log(`Framework: ${analysis.framework.name} (${analysis.framework.router || 'standard'})`);
      printer.log(`Languages: ${analysis.detectedLanguages.join(', ')}`);
      printer.log(`Existing localization: ${analysis.existingLocalization.library || 'None'}`);
      printer.log(`Candidate files: ${analysis.totalSourceFiles}`);
      printer.log(`Suggested locales: ${analysis.suggestedLocales.source} -> ${analysis.suggestedLocales.targets.join(', ')}`);
    }
  } catch (err: any) {
    printer.error(`Analysis failed: ${err.message}`);
    process.exit(1);
  }
}
