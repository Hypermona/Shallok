import React from 'react';
import { Box, Text } from 'ink';
import { ExtractedString } from '@shallok/core';

export interface ExtractionPreviewProps {
  strings: ExtractedString[];
  modifiedFiles: string[];
  isDryRun: boolean;
}

export const ExtractionPreview: React.FC<ExtractionPreviewProps> = ({
  strings,
  modifiedFiles,
  isDryRun,
}) => {
  return (
    <Box flexDirection="column" padding={1} borderStyle="round" borderColor="yellow">
      <Text bold color="yellow">
        Shallok • Extraction {isDryRun ? '(Dry Run Preview)' : 'Results'}
      </Text>
      <Box height={1} />
      <Box>
        <Text bold>Extracted Strings: </Text>
        <Text color="green">{strings.length} entries</Text>
      </Box>
      <Box>
        <Text bold>Impacted Files: </Text>
        <Text color="cyan">{modifiedFiles.length} files</Text>
      </Box>
      <Box height={1} />
      <Text bold underline>
        Proposed Keys (sample):
      </Text>
      {strings.slice(0, 8).map((s, idx) => (
        <Box key={idx} flexDirection="column">
          <Box>
            <Text color="magenta">{s.suggestedKey}</Text>
            <Text dimColor> → </Text>
            <Text>"{s.content.slice(0, 40)}"</Text>
          </Box>
          <Text dimColor>
            {s.occurrence.relative_file_path}:{s.occurrence.line} ({s.context})
          </Text>
        </Box>
      ))}
      {strings.length > 8 && (
        <Text dimColor>...and {strings.length - 8} more entries.</Text>
      )}
    </Box>
  );
};
