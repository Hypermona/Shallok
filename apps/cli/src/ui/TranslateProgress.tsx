import React from 'react';
import { Box, Text } from 'ink';
import { TranslationRunSummary } from '@shallok/translation-providers';

export interface TranslateProgressProps {
  summaries: Record<string, TranslationRunSummary>;
}

export const TranslateProgress: React.FC<TranslateProgressProps> = ({ summaries }) => {
  return (
    <Box flexDirection="column" padding={1} borderStyle="round" borderColor="green">
      <Text bold color="green">
        Shallok • Translation Execution Summary
      </Text>
      <Box height={1} />
      {Object.values(summaries).map((sum) => (
        <Box key={sum.locale} flexDirection="column" marginBottom={1}>
          <Box flexDirection="row">
            <Text bold color="cyan">
              [{sum.locale.toUpperCase()}]:{' '}
            </Text>
            <Text color="green">{sum.translated} translated, </Text>
            <Text color="yellow">{sum.skipped} skipped, </Text>
            <Text color={sum.failed > 0 ? 'red' : 'dim'}>{sum.failed} failed</Text>
          </Box>
          {sum.errors.slice(0, 3).map((err, idx) => (
            <Text key={idx} color="red">
              ✖ {err.key}: {err.error}
            </Text>
          ))}
        </Box>
      ))}
    </Box>
  );
};
