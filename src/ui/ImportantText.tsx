import React from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { emphasisRuns, emphasisStyle, type EmphasisHints, type EmphasisKind } from './emphasis';

export function ImportantText({ text, hints }: { text: string; hints?: EmphasisHints }) {
  const { resolved } = useTheme();
  return <>{emphasisRuns(text, hints).map((run, i) => run.kind ? <Text key={i} style={emphasisStyle(resolved === 'dark', run.kind)}>{run.text}</Text> : run.text)}</>;
}
export function EmphasisLegend() {
  const { resolved } = useTheme();
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 10 }}>
    {([['key', '重要語句'], ['num', '数値'], ['trap', '条件・注意']] as [EmphasisKind, string][]).map(([kind, text]) => <Text key={kind}
      style={{ ...emphasisStyle(resolved === 'dark', kind), fontSize: 12, lineHeight: 22 }}>{text}</Text>)}
  </View>;
}
