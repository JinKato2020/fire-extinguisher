import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';
import { useTheme, useStyles } from '../theme/ThemeContext';
import type { Chapter } from '../data/chapters';
import { CHAPTER_SHORT } from '../theme/colors';
import { RELATION_MAPS } from '../data/relationMaps.generated';
import content from '../../docs/relation-maps/structure.json';
import { parseLessons } from './lessons';

type Target = { chapterNo: string; lessonIdx: number };
type Props = {
  onClose: () => void; pro: boolean; onPaywall: () => void;
  chapters: Chapter[];
  renderLesson: (target: Target, onBack: () => void, onNav: (no: string, idx: number) => void) => React.ReactNode;
};

export function RelationMapScreen({ onClose, pro, onPaywall, chapters, renderLesson }: Props) {
  const { c, resolved } = useTheme();
  const s = useStyles();
  const { width, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [ch, setCh] = useState(1);
  const [diagramIndex, setDiagramIndex] = useState(0);
  const [showRelations, setShowRelations] = useState(false);
  const [showTopics, setShowTopics] = useState(false);
  const [zoom, setZoom] = useState(false);
  const [zoomStep, setZoomStep] = useState(1);
  const [lesson, setLesson] = useState<Target | null>(null);
  const map = content.chapters.find(m => m.chapter === ch)!;
  const diagram = map.diagrams[diagramIndex] ?? map.diagrams[0];
  const accessible = pro || ch <= 3;
  const topics = map.topics.filter(t => diagram.topicIds.includes(t.id));
  const source = chapters.find(c => c.no === String(ch));
  const lessons = parseLessons(source?.body ?? '');
  const svg = RELATION_MAPS[ch + '/' + diagram.id][resolved];
  const diagramW = Math.max(240, Math.min(width - 32, 640));
  const ratio = diagram.height / diagram.width;
  const zoomWidths = [diagramW, diagramW * 1.5, diagramW * 2, diagramW * 3];
  const fullW = zoomWidths[zoomStep];
  const keyColor = resolved === 'dark' ? '#8EC5EE' : '#246A9C';
  const conditionColor = resolved === 'dark' ? '#F3C37E' : '#996010';
  const resultColor = resolved === 'dark' ? '#83D5BB' : '#16785B';
  const reset = () => { setShowRelations(false); setShowTopics(false); setZoom(false); };
  const chooseChapter = (value: number) => { setCh(value); setDiagramIndex(0); reset(); };
  const chooseDiagram = (value: number) => { setDiagramIndex(value); reset(); };
  const name = (id: string) => diagram.nodes.find(n => n.id === id)!.label;
  const rich = (text: string) => text.split(/(\*\*.*?\*\*)/g).map((part, i) => part.startsWith('**')
    ? <Text key={i} style={{ color: keyColor, fontWeight: '800' }}>{part.slice(2, -2)}</Text> : part);
  const control = (label: string, onPress: () => void, disabled = false) => <Pressable key={label} accessibilityRole="button"
    accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => ({ minHeight: 44, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1,
      borderColor: c.line, backgroundColor: pressed ? c.card2 : c.card, opacity: disabled ? 0.4 : 1, justifyContent: 'center' })}>
    <Text style={{ color: c.fg, fontSize: 15, fontWeight: '700' }}>{label}</Text>
  </Pressable>;
  if (lesson && accessible) return <>{renderLesson(lesson, () => setLesson(null), (chapterNo, lessonIdx) => setLesson({ chapterNo, lessonIdx }))}</>;

  return <View style={{ flex: 1, backgroundColor: c.bg }}>
    <View style={s.modalBar}>
      <Pressable accessibilityRole="button" onPress={onClose} hitSlop={10} style={s.backBtn}><Text style={s.backTxt}>‹ 閉じる</Text></Pressable>
      <Text style={s.modalTitle}>相関図</Text><View style={{ width: 56 }} />
    </View>
    <ScrollView key={ch + '/' + diagram.id} style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <View style={{ maxWidth: 640, width: '100%', alignSelf: 'center' }}>
        <View accessibilityRole="tablist" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {content.chapters.map(m => <Pressable key={m.chapter} accessibilityRole="tab" accessibilityLabel={'第' + m.chapter + '章 ' + CHAPTER_SHORT[String(m.chapter)]}
            accessibilityState={{ selected: ch === m.chapter }} onPress={() => chooseChapter(m.chapter)}
            style={{ minHeight: 44, width: width >= 600 ? (diagramW - 30) / 6 : (diagramW - 12) / 3,
              padding: 10, borderRadius: 9, alignItems: 'center', backgroundColor: ch === m.chapter ? c.accent : c.card }}>
            <Text style={{ color: ch === m.chapter ? c.onAccent : c.fg, fontWeight: '700', fontSize: 14 }}>第{m.chapter}章</Text>
          </Pressable>)}
        </View>
        <Text style={{ color: c.muted, fontSize: 14, lineHeight: 22, marginTop: 16 }}>{map.title}</Text>
        {!accessible ? <View style={[s.card, { marginTop: 16 }]}>
          <Text style={s.cardTitle}>この章の相関図はProで</Text>
          <Text style={{ color: c.muted, lineHeight: 25, marginVertical: 12 }}>無料は第1〜3章。Proで全6章の相関図が見られます。</Text>
          {control('Proを確認する', onPaywall)}
        </View> : <>
          <Text style={{ color: c.fg, fontWeight: '800', fontSize: 20, marginTop: 4, marginBottom: 12 }}>知りたい関係を選ぶ</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {map.diagrams.map((d, i) => <Pressable key={d.id} accessibilityRole="button" accessibilityLabel={d.title}
              accessibilityState={{ selected: i === diagramIndex }} onPress={() => chooseDiagram(i)}
              style={{ minHeight: 44, width: (diagramW - 8) / 2, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1,
                borderColor: i === diagramIndex ? c.accent : c.line, backgroundColor: c.card }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: i === diagramIndex ? c.accent : c.fg }}>{i + 1}. {d.title}</Text>
            </Pressable>)}
          </View>
          <View style={{ marginTop: 24, marginBottom: 8 }}>
            <Text style={{ color: keyColor, fontSize: 13, fontWeight: '800', marginBottom: 6 }}>{diagram.kind}</Text>
            <Text accessibilityRole="header" style={{ color: c.fg, fontSize: 22, lineHeight: 32, fontWeight: '800' }}>{diagram.question}</Text>
          </View>
          <Text style={{ color: c.muted, fontSize: 14, lineHeight: 23, marginBottom: 8 }}>上から矢印の言葉をたどります。分岐は観点の違い、合流は関係する条件や結論を表します。</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginVertical: 6 }}>
            {[[keyColor, '用語・しくみ'], [conditionColor, '条件・確認'], [resultColor, '判断・結果']].map(([color, label]) =>
              <Text key={label} style={{ color, fontSize: 13, fontWeight: '700' }}>┃ {label}</Text>)}
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="相関図を拡大する" onPress={() => { setZoomStep(fontScale > 1.3 ? 2 : 1); setZoom(true); }}
            style={{ alignSelf: 'center', marginTop: 8, borderRadius: 12, overflow: 'hidden', backgroundColor: c.card }}>
            <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <SvgXml xml={svg} width={diagramW} height={diagramW * ratio} />
            </View>
            <Text style={{ color: keyColor, textAlign: 'center', fontSize: 14, fontWeight: '700', padding: 12 }}>タップで拡大 ↗</Text>
          </Pressable>
          <View style={{ marginTop: 24 }}>
            <Text accessibilityRole="header" style={{ color: c.fg, fontSize: 18, fontWeight: '800', marginBottom: 10 }}>この図で押さえること</Text>
            {diagram.reading.map((line, i) => <Text key={i} style={{ color: c.fg, fontSize: 17, lineHeight: 29, marginBottom: 12 }}>{rich(line)}</Text>)}
            <View style={{ borderLeftWidth: 3, borderLeftColor: conditionColor, paddingLeft: 12, marginBottom: 16 }}>
              <Text style={{ color: conditionColor, fontWeight: '800', fontSize: 15, marginBottom: 5 }}>混同しやすい点</Text>
              <Text style={{ color: c.fg, fontSize: 16, lineHeight: 27 }}>{diagram.pitfall}</Text>
            </View>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="矢印の関係を文章で読む" accessibilityState={{ expanded: showRelations }}
            onPress={() => setShowRelations(!showRelations)} style={{ minHeight: 48, justifyContent: 'center', borderTopWidth: 1, borderColor: c.line, paddingVertical: 12 }}>
            <Text style={{ color: keyColor, fontSize: 16, fontWeight: '700' }}>{showRelations ? '−' : '＋'} 矢印の関係を文章で読む</Text>
          </Pressable>
          {showRelations && diagram.edges.map((e, i) => <View key={i} style={{ paddingVertical: 12, borderBottomWidth: 1, borderColor: c.line }}>
            <Text style={{ color: c.muted, fontSize: 14, marginBottom: 6 }}>{i + 1}. {e.label}</Text>
            <Text style={{ color: c.fg, fontSize: 17, lineHeight: 28 }}>{name(e.source)} → {name(e.target)}</Text>
          </View>)}
          <Pressable accessibilityRole="button" accessibilityLabel="関連用語と教材を読む" accessibilityState={{ expanded: showTopics }}
            onPress={() => setShowTopics(!showTopics)} style={{ minHeight: 48, justifyContent: 'center', borderTopWidth: 1, borderColor: c.line, paddingVertical: 12 }}>
            <Text style={{ color: keyColor, fontSize: 16, fontWeight: '700' }}>{showTopics ? '−' : '＋'} 関連用語 {topics.length}件・教材を読む</Text>
          </Pressable>
          {showTopics && topics.map(t => <View key={t.id} style={{ paddingVertical: 16, borderBottomWidth: 1, borderColor: c.line }}>
            <Text style={{ color: keyColor, fontSize: 18, fontWeight: '800', marginBottom: 6 }}>{t.name}</Text>
            {t.lines.map(line => <Text key={line} style={{ color: c.fg, fontSize: 16, lineHeight: 27, marginBottom: 5 }}>{line}</Text>)}
            {t.references.map(ref => {
              const idx = lessons.findIndex(l => ref === 'はじめに' || ref === '準備' ? l.key === 'intro' : l.label.startsWith(ref + ' '));
              return idx >= 0 ? <Pressable key={ref} accessibilityRole="button" accessibilityLabel={'教材を読む：' + lessons[idx].label}
                onPress={() => setLesson({ chapterNo: String(ch), lessonIdx: idx })} style={{ minHeight: 44, justifyContent: 'center', paddingVertical: 8 }}>
                <Text style={{ color: keyColor, fontSize: 15, lineHeight: 24 }}>教材：{lessons[idx].label} ›</Text>
              </Pressable> : null;
            })}
          </View>)}
        </>}
      </View>
    </ScrollView>
    <Modal visible={zoom && accessible && !lesson} animationType="fade" onRequestClose={() => setZoom(false)}>
      <View style={{ flex: 1, backgroundColor: c.card, paddingTop: insets.top, paddingBottom: insets.bottom }}>
        <View style={{ padding: 12, borderBottomWidth: 1, borderColor: c.line }}>
          <Text style={{ color: c.fg, fontSize: 18, fontWeight: '800', marginBottom: 8 }}>{diagram.title}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {control('− 縮小', () => setZoomStep(Math.max(0, zoomStep - 1)), zoomStep === 0)}
            {control('＋ 拡大', () => setZoomStep(Math.min(3, zoomStep + 1)), zoomStep === 3)}
            {control('全体', () => setZoomStep(0))}
            {control('✕ 閉じる', () => setZoom(false))}
          </View>
          <Text style={{ color: c.muted, fontSize: 13, marginTop: 8 }}>縦・横にスクロールできます</Text>
        </View>
        <ScrollView key={zoomStep} style={{ flex: 1 }} nestedScrollEnabled>
          <ScrollView horizontal nestedScrollEnabled contentContainerStyle={{ width: fullW, height: fullW * ratio }}>
            <SvgXml xml={svg} width={fullW} height={fullW * ratio} />
          </ScrollView>
        </ScrollView>
      </View>
    </Modal>
  </View>;
}
