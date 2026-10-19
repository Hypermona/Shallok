import React from 'react';
import { Box, Text } from 'ink';
import { ProjectAnalysis } from '@shallok/core';

export interface AnalysisViewProps {
  analysis: ProjectAnalysis;
}

export const AnalysisView: React.FC<AnalysisViewProps> = ({ analysis }) => {
  return (
    <Box flexDirection="column" padding={1} borderStyle="round" borderColor="cyan">
      <Text bold color="cyan">
        Shallok • Project Analysis
      </Text>
      <Box height={1} />
      <Box>
        <Text bold>Framework: </Text>
        <Text color="green">{analysis.framework.name.toUpperCase()}</Text>
        {analysis.framework.router && (
          <Text dimColor> ({analysis.framework.router} router)</Text>
        )}
      </Box>
      <Box>
        <Text bold>Language: </Text>
        <Text color="yellow">{analysis.detectedLanguages.join(', ')}</Text>
      </Box>
      <Box>
        <Text bold>Existing Localization: </Text>
        <Text color={analysis.existingLocalization.library ? 'green' : 'dim'}>
          {analysis.existingLocalization.library || 'Not detected'}
        </Text>
      </Box>
      <Box>
        <Text bold>Candidate Source Files: </Text>
        <Text color="blue">{analysis.totalSourceFiles} files detected</Text>
      </Box>
      <Box>
        <Text bold>Suggested Locales: </Text>
        <Text color="magenta">
          Source: {analysis.suggestedLocales.source} | Targets: {analysis.suggestedLocales.targets.join(', ')}
        </Text>
      </Box>
    </Box>
  );
};
