import React from 'react';
import { Box, Text } from 'ink';
import { ProjectStatusReport } from '@shallok/core';

export interface StatusViewProps {
  report: ProjectStatusReport;
}

export const StatusView: React.FC<StatusViewProps> = ({ report }) => {
  return (
    <Box flexDirection="column" padding={1} borderStyle="round" borderColor="blue">
      <Text bold color="blue">
        Shallok • Localization Status
      </Text>
      <Box height={1} />
      <Box>
        <Text bold>Source Locale: </Text>
        <Text color="cyan">{report.sourceLocale}</Text>
      </Box>
      <Box>
        <Text bold>Total Active Keys: </Text>
        <Text color="green">{report.activeKeys}</Text>
        {report.obsoleteKeys > 0 && (
          <Text dimColor> ({report.obsoleteKeys} obsolete)</Text>
        )}
      </Box>
      <Box>
        <Text bold>Overall Completeness: </Text>
        <Text color={report.overallCompletenessPercentage >= 100 ? 'green' : 'yellow'}>
          {report.overallCompletenessPercentage}%
        </Text>
      </Box>
      <Box height={1} />
      <Text bold underline>
        Locale Breakdown:
      </Text>
      {Object.values(report.locales).map((loc) => (
        <Box key={loc.locale} flexDirection="row" justifyContent="space-between" width={50}>
          <Text color={loc.isSourceLocale ? 'cyan' : 'white'}>
            [{loc.locale.toUpperCase()}]{loc.isSourceLocale ? ' (Source)' : ''}:
          </Text>
          <Text color={loc.completenessPercentage >= 100 ? 'green' : 'yellow'}>
            {loc.completenessPercentage}%
          </Text>
          <Text dimColor>
            (curr: {loc.translatedCount}, miss: {loc.missingCount}, stale: {loc.staleCount})
          </Text>
        </Box>
      ))}
    </Box>
  );
};
