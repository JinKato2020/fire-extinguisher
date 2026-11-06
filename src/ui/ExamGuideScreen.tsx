import React from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { getContent } from '../data/contentStore';
import { Markdown } from './LessonMarkdown';
import { emphasisStyle } from './emphasis';
import bundled from '../../content/exam-guide.json';

export function ExamGuideScreen({ onClose }: { onClose: () => void }) {
  const { c, resolved } = useTheme();
  const { fontScale } = useWindowDimensions();
  const candidate = getContent<typeof bundled>('content/exam-guide.json');
  const guide = candidate?.schema === 1 && typeof candidate.body === 'string' && candidate.stats?.length === 3 ? candidate : bundled;
  return <View style={{ flex: 1 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 6, borderBottomWidth: 1, borderColor: c.line }}>
      <Text accessibilityRole="header" style={{ color: c.fg, fontSize: 19, lineHeight: 29, fontWeight: '800', flex: 1 }}>試験の総合解説</Text>
      <Pressable accessibilityRole="button" onPress={onClose} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 }}><Text style={{ color: c.accent2, fontSize: 15 }}>閉じる</Text></Pressable>
    </View>
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 36 }}>
      <Text style={{ color: c.muted, fontSize: 12, lineHeight: 21, marginTop: 6 }}>消防設備士 乙種第6類</Text>
      <Text accessibilityRole="header" style={{ color: c.fg, fontSize: 26, lineHeight: 39, fontWeight: '800', marginTop: 6, marginBottom: 16 }}>まず、試験の全体像を。</Text>
      <View style={{ flexDirection: fontScale > 1.3 ? 'column' : 'row', gap: 8, marginBottom: 18 }}>
        {guide.stats.map(stat => <View key={stat.label} style={{ flex: 1, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, borderRadius: 14, padding: 12, gap: 6 }}>
          <Text style={{ color: c.fg, fontSize: 13, lineHeight: 23, fontWeight: '700' }}>{stat.label}</Text>
          <Text style={{ ...emphasisStyle(resolved === 'dark', 'num'), backgroundColor: 'transparent', fontSize: 29, lineHeight: 38 }}>{stat.value}<Text style={{ fontSize: 12 }}> {stat.unit}</Text></Text>
          <Text style={{ color: c.muted, fontSize: 11, lineHeight: 20 }}>{stat.detail}</Text>
        </View>)}
      </View>
      <Markdown body={guide.body} hideTitle />
    </ScrollView>
  </View>;
}
