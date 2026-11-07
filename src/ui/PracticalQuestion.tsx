import React, { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import type { Practical } from '../data/questions';
import { assessPart } from '../data/practical';
import { practicalImages } from '../data/practicalImages';
import { useTheme, useStyles } from '../theme/ThemeContext';

export function PracticalQuestion({ practical, draft = {}, onChange, revealed = false, review = false, onZoomChange }: {
  practical: Practical; draft?: Record<string, string>; onChange?: (id: string, value: string) => void;
  revealed?: boolean; review?: boolean; onZoomChange?: (open: boolean) => void;
}) {
  const { c } = useTheme();
  const s = useStyles();
  const [zoom, setZoom] = useState(false);
  const changeZoom = (open: boolean) => { setZoom(open); onZoomChange?.(open); };
  const raster = practical.imageAsset ? practicalImages[practical.imageAsset] : undefined;
  const showAssessment = !review || Object.keys(draft).length > 0;
  return <View style={{ gap: 14, marginTop: 12 }}>
    <Pressable accessibilityRole="button" accessibilityLabel="問題図を拡大" onPress={() => changeZoom(true)}>
      <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 8, aspectRatio: 1.5 }}>
        {raster ? <Image source={raster} accessibilityLabel="鑑別問題の図" resizeMode="contain" style={{ width: '100%', height: '100%' }} /> : <SvgXml xml={practical.image} width="100%" height="100%" />}
      </View>
      <Text style={[s.guideBody, { color: c.accent, marginTop: 4 }]}>図をタップして拡大</Text>
    </Pressable>
    <Text style={[s.guideBody, { color: c.muted }]}>{practical.caption}</Text>
    {practical.parts.map((part, i) => {
      const scored = assessPart(part, draft[part.id] ?? '');
      const correct = scored.earned === scored.total;
      return <View key={part.id} style={s.card}>
        <Text style={s.cardTitle}>設問{i + 1}</Text>
        <Text style={[s.guideBody, { marginVertical: 10 }]}>{part.prompt}</Text>
        {!review && part.kind === 'text' ? <TextInput accessibilityLabel={`設問${i + 1}の記述解答`}
          value={draft[part.id] ?? ''} editable={!revealed} onChangeText={value => onChange?.(part.id, value)}
          placeholder={part.rubric ? '理由や働きを文章で説明（1〜2文）' : '名称・数値などを記入'} placeholderTextColor={c.faint} autoCorrect={false} autoCapitalize="none"
          multiline={!!part.rubric} maxLength={part.rubric ? 1000 : 120} textAlignVertical="top"
          style={{ color: c.fg, backgroundColor: c.card2, borderColor: c.line, borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 16, minHeight: part.rubric ? 110 : 48 }} /> : null}
        {part.rubric && !revealed && !review ? <Text style={[s.guideBody, { color: c.muted, marginTop: 6 }]}>説明の要点ごとに部分点を付けます。端末内での参考判定です。</Text> : null}
        {part.options?.map(option => <Pressable key={option.symbol} accessibilityRole="radio"
          accessibilityState={{ checked: draft[part.id] === option.symbol, disabled: revealed || review }}
          disabled={revealed || review} onPress={() => onChange?.(part.id, option.symbol)}
          style={[s.choice, { marginBottom: 8 }, !review && draft[part.id] === option.symbol && s.choiceSel,
            (revealed || review) && part.answers.includes(option.symbol) && s.choiceCorrect]}>
          <Text style={s.choiceNum}>{option.symbol}</Text><Text style={s.choiceTxt}>{option.text}</Text>
        </Pressable>)}
        {revealed || review ? <View style={{ marginTop: 10 }}>
          <Text style={[s.verdict, review || correct ? s.vOk : s.vNg]}>
            {review ? '解答例' : part.rubric ? (scored.needsReview ? '要確認' : correct ? '要点一致（参考）' : '未記入') : correct ? '◯ 正解' : '✕ 不正解'}：{part.answers[0]}
          </Text>
          {showAssessment && (review || !correct || part.rubric) ? <Text style={s.guideBody}>あなたの解答：{draft[part.id]?.trim() || '未記入'}</Text> : null}
          {part.rubric ? <View style={{ marginTop: 8 }}>
            <Text style={s.guideBody}>{!showAssessment ? '確認する要点' : `自動確認点：${scored.earned}/${scored.total}点`}</Text>
            {scored.criteria.map((item, n) => <Text key={n} style={s.guideBody}>{!showAssessment ? '・' : item.matched ? '✓ ' : '△ '}{item.label}</Text>)}
            {showAssessment ? <Text style={[s.guideBody, { color: c.muted, marginTop: 6 }]}>△は未確認の要点です。言い換えや文章の意味を完全には判定できないため、不正解と断定せず解答例と比較してください。要点一致でも説明全体の正しさを保証するものではありません。</Text> : null}
          </View> : null}
          <Text style={[s.guideBody, { marginTop: 6 }]}>{part.explain}</Text>
        </View> : null}
      </View>;
    })}
    <Text style={[s.guideBody, { color: c.muted, fontSize: 12 }]}>自作の練習問題です。名称・数値・記号は各1点、文章説明は要点ごとに1点の参考採点です。回答は外部に送信しません。本番の配点・採点基準とは異なります。</Text>
    <Modal visible={zoom} onRequestClose={() => changeZoom(false)} animationType="fade">
      <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: 48 }}>
        <Pressable accessibilityRole="button" onPress={() => changeZoom(false)} style={{ padding: 18 }}><Text style={s.backTxt}>‹ 図を閉じる</Text></Pressable>
        <Text style={[s.guideBody, { paddingHorizontal: 18 }]}>左右にスクロールして細部を確認できます。</Text>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
          <ScrollView horizontal><View style={{ backgroundColor: '#fff' }}>{raster ? <Image source={raster} resizeMode="contain" style={{ width: 1536, height: 1024 }} /> : <SvgXml xml={practical.image} width={960} height={640} />}</View></ScrollView>
        </ScrollView>
      </View>
    </Modal>
  </View>;
}
