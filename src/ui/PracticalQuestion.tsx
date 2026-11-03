import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import type { Practical } from '../data/questions';
import { partCorrect } from '../data/practical';
import { useTheme, useStyles } from '../theme/ThemeContext';

export function PracticalQuestion({ practical, draft = {}, onChange, revealed = false, review = false }: {
  practical: Practical; draft?: Record<string, string>; onChange?: (id: string, value: string) => void;
  revealed?: boolean; review?: boolean;
}) {
  const { c } = useTheme();
  const s = useStyles();
  const [zoom, setZoom] = useState(false);
  return <View style={{ gap: 14, marginTop: 12 }}>
    <Pressable accessibilityRole="button" accessibilityLabel="問題図を拡大" onPress={() => setZoom(true)}>
      <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 8 }}>
        <SvgXml xml={practical.image} width="100%" height={250} />
      </View>
      <Text style={[s.guideBody, { color: c.accent, marginTop: 4 }]}>図をタップして拡大</Text>
    </Pressable>
    <Text style={[s.guideBody, { color: c.muted }]}>{practical.caption}</Text>
    {practical.parts.map((part, i) => {
      const correct = partCorrect(part, draft[part.id] ?? '');
      return <View key={part.id} style={s.card}>
        <Text style={s.cardTitle}>設問{i + 1}</Text>
        <Text style={[s.guideBody, { marginVertical: 10 }]}>{part.prompt}</Text>
        {!review && part.kind === 'text' ? <TextInput accessibilityLabel={`設問${i + 1}の記述解答`}
          value={draft[part.id] ?? ''} editable={!revealed} onChangeText={value => onChange?.(part.id, value)}
          placeholder="名称・数値などを記入" placeholderTextColor={c.faint} autoCorrect={false} autoCapitalize="none"
          style={{ color: c.fg, backgroundColor: c.card2, borderColor: c.line, borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 16 }} /> : null}
        {part.options?.map(option => <Pressable key={option.symbol} accessibilityRole="radio"
          accessibilityState={{ checked: draft[part.id] === option.symbol, disabled: revealed || review }}
          disabled={revealed || review} onPress={() => onChange?.(part.id, option.symbol)}
          style={[s.choice, { marginBottom: 8 }, !review && draft[part.id] === option.symbol && s.choiceSel,
            (revealed || review) && part.answers.includes(option.symbol) && s.choiceCorrect]}>
          <Text style={s.choiceNum}>{option.symbol}</Text><Text style={s.choiceTxt}>{option.text}</Text>
        </Pressable>)}
        {revealed || review ? <View style={{ marginTop: 10 }}>
          <Text style={[s.verdict, review || correct ? s.vOk : s.vNg]}>
            {review ? '解答例' : correct ? '◯ 正解' : '✕ 不正解'}：{part.answers[0]}
          </Text>
          {!review && !correct ? <Text style={s.guideBody}>あなたの解答：{draft[part.id]?.trim() || '未記入'}</Text> : null}
          <Text style={[s.guideBody, { marginTop: 6 }]}>{part.explain}</Text>
        </View> : null}
      </View>;
    })}
    <Text style={[s.guideBody, { color: c.muted, fontSize: 12 }]}>自作の練習問題です。記述は登録済みの名称・表記で自動判定します。小問は各1点の練習用採点で、公式の配点を再現するものではありません。</Text>
    <Modal visible={zoom} onRequestClose={() => setZoom(false)} animationType="fade">
      <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: 48 }}>
        <Pressable accessibilityRole="button" onPress={() => setZoom(false)} style={{ padding: 18 }}><Text style={s.backTxt}>‹ 図を閉じる</Text></Pressable>
        <Text style={[s.guideBody, { paddingHorizontal: 18 }]}>左右にスクロールして細部を確認できます。</Text>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
          <ScrollView horizontal><View style={{ backgroundColor: '#fff' }}><SvgXml xml={practical.image} width={960} height={640} /></View></ScrollView>
        </ScrollView>
      </View>
    </Modal>
  </View>;
}
