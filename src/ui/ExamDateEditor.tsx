import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { examDateText, getExamDate, setExamDate } from '../data/examDate';

export function ExamDateEditor({ onSaved }: { onSaved: () => void }) {
  const { c } = useTheme();
  const now = new Date(), selected = getExamDate();
  const initial = selected ? selected.split('-').map(Number) : [now.getFullYear(), now.getMonth() + 1];
  const [month, setMonth] = useState({ y: initial[0], m: initial[1] });
  const [saving, setSaving] = useState(false);
  const first = new Date(month.y, month.m - 1, 1).getDay(), count = new Date(month.y, month.m, 0).getDate();
  const dateKey = (d: number) => month.y + '-' + String(month.m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  const save = async (date: string | null) => { if (saving) return; setSaving(true); try { await setExamDate(date); onSaved(); } finally { setSaving(false); } };
  const changeMonth = (delta: number) => { const d = new Date(month.y, month.m - 1 + delta, 1); setMonth({ y: d.getFullYear(), m: d.getMonth() + 1 }); };
  return <View style={{ gap: 12 }}>
    <Text accessibilityRole="header" style={{ color: c.fg, fontSize: 18, lineHeight: 29, fontWeight: '800' }}>試験日</Text>
    <Text accessibilityLiveRegion="polite" style={{ color: selected ? c.fg : c.muted, fontSize: 14, lineHeight: 25 }}>{examDateText() ?? '受験する日をタップしてください。'}</Text>
    <View style={{ backgroundColor: c.card, borderWidth: 1, borderColor: c.line, borderRadius: 16, padding: 10, gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable accessibilityRole="button" accessibilityLabel="前の月" onPress={() => changeMonth(-1)} style={{ width: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: c.accent2, fontSize: 24 }}>‹</Text></Pressable>
        <Text accessibilityLiveRegion="polite" style={{ color: c.fg, fontSize: 16, lineHeight: 27, fontWeight: '700', flexShrink: 1 }}>{month.y}年 {month.m}月</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="次の月" onPress={() => changeMonth(1)} style={{ width: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: c.accent2, fontSize: 24 }}>›</Text></Pressable>
      </View>
      <View style={{ flexDirection: 'row' }}>{['日','月','火','水','木','金','土'].map(day => <Text key={day} style={{ width: '14.2857%', textAlign: 'center', color: c.muted, fontSize: 12, lineHeight: 26 }}>{day}</Text>)}</View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {Array.from({ length: first + count }, (_, index) => { const day = index - first + 1; if (day < 1) return <View key={index} style={{ width: '14.2857%', height: 44 }} />;
          const checked = selected === dateKey(day), today = month.y === now.getFullYear() && month.m === now.getMonth() + 1 && day === now.getDate();
          return <Pressable key={index} accessibilityRole="button" accessibilityLabel={month.y + '年' + month.m + '月' + day + '日'} accessibilityState={{ selected: checked, disabled: saving }} disabled={saving}
            onPress={() => { void save(dateKey(day)); }} style={{ width: '14.2857%', minHeight: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: checked ? '#B13238' : 'transparent', borderRadius: 10 }}>
            <Text style={{ color: checked ? '#FFFFFF' : c.fg, fontSize: 16, lineHeight: 27, fontWeight: checked || today ? '800' : '400', textDecorationLine: today ? 'underline' : 'none' }}>{day}</Text>
          </Pressable>;
        })}
      </View>
    </View>
    {selected ? <Pressable accessibilityRole="button" disabled={saving} onPress={() => { void save(null); }} style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }}><Text style={{ color: c.accent2, fontSize: 14, lineHeight: 24 }}>試験日を解除</Text></Pressable> : null}
  </View>;
}
