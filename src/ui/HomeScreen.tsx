import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { openRequestEmail } from '../data/feedback';
import { ExamDateEditor } from './ExamDateEditor';

export function ExamDateScreen({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { c } = useTheme();
  const [, setRevision] = useState(0);
  return <View style={{ flex: 1 }}>
    <View style={{ paddingHorizontal: 20, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderColor: c.line }}>
      <Text accessibilityRole="header" style={{ color: c.fg, fontSize: 20, lineHeight: 30, fontWeight: '800', flex: 1 }}>試験日を設定</Text>
      <Pressable accessibilityRole="button" onPress={onClose} style={{ minHeight: 44, padding: 10, justifyContent: 'center' }}><Text style={{ color: c.accent2, fontSize: 16, fontWeight: '700' }}>完了</Text></Pressable>
    </View>
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 36, gap: 18 }}>
      <Text style={{ color: c.muted, fontSize: 13, lineHeight: 23 }}>日付は、選ぶと保存されます。</Text>
      <ExamDateEditor onSaved={() => { setRevision(v => v + 1); onSaved(); }} />
    </ScrollView>
  </View>;
}
export function DeveloperMessage() {
  const { c } = useTheme();
  return <View style={{ padding: 16, gap: 10 }}>
    <Text style={{ color: c.fg, fontSize: 16, lineHeight: 27, fontWeight: '700' }}>使ってくださり、ありがとうございます。</Text>
    <Text style={{ color: c.muted, fontSize: 14, lineHeight: 25 }}>図解や解説を見直しながら、改善を続けています。率直な感想が、次に学ぶ方の参考に、開発を続ける励みにもなります。</Text>
    <Pressable accessibilityRole="button" onPress={() => { void openRequestEmail(); }} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ color: c.accent2, fontSize: 15, lineHeight: 25, fontWeight: '700' }}>ご意見・ご要望を送る ↗</Text></Pressable>
    <Text style={{ color: c.muted, fontSize: 12, lineHeight: 21 }}>safa · 評価もお問い合わせも任意です。</Text>
  </View>;
}
