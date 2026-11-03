import React from 'react';
import { Text, View } from 'react-native';
import { categoryLabels, type Category, type assessmentSummary } from '../data/practical';
import { useStyles } from '../theme/ThemeContext';

export function PracticalAssessment({ summary }: { summary: ReturnType<typeof assessmentSummary> }) {
  const s = useStyles();
  const entries = (Object.keys(categoryLabels) as Category[]).filter(key => summary.categories[key].total > 0);
  if (!entries.length) return null;
  const weak = entries.filter(key => summary.categories[key].earned / summary.categories[key].total < .6);
  return <View style={[s.card, { marginTop: 14, alignSelf: 'stretch' }]}>
    <Text style={s.cardTitle}>鑑別の総合評価（参考）</Text>
    {entries.map(key => {
      const value = summary.categories[key];
      return <Text key={key} style={[s.guideBody, { marginTop: 8 }]}>{categoryLabels[key]}：{value.earned}/{value.total}点・{Math.round(value.earned / value.total * 100)}%</Text>;
    })}
    <Text style={[s.guideBody, { marginTop: 12 }]}>{weak.length ? `復習の候補：${weak.map(key => categoryLabels[key]).join('、')}` : '各項目で練習用の目安（60%）に到達しています。'}</Text>
    <Text style={[s.guideBody, { marginTop: 8 }]}>文章の自己確認：{summary.reviewCount}件。未解答は0点で集計します。文章は要点の一致による参考点で、未確認の言い換えを不正解と断定しません。解答例で補ってください。</Text>
  </View>;
}
