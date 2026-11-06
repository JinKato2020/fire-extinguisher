import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { Markdown } from './LessonMarkdown';
import { parseMarkdown } from './markdown';
import { chooseRecall, readingSections, recallCandidates, RECALL_LABELS, type RecallCategory } from './recall';
import { StudyRecallContext, type CheckResult } from './StudyRecallContext';
import { recordActivity } from '../data/studyActivity';
import { EmphasisLegend } from './ImportantText';

/** Reading and retrieval share the same authored content, with a persistent answer toolbar. */
export function LessonStudy({ body, onLessonLink, children, studyId, initialScrollOffset = 0, onScrollPosition }: {
  body?: string; onLessonLink?: (number: number) => void; children?: React.ReactNode;
  studyId?: string; initialScrollOffset?: number; onScrollPosition?: (y: number) => void;
}) {
  const { c, resolved } = useTheme();
  const blocks = useMemo(() => parseMarkdown(body ?? ''), [body]);
  const candidates = useMemo(() => recallCandidates(blocks), [blocks]);
  const sections = useMemo(() => readingSections(blocks), [blocks]);
  const checks = blocks.filter(b => b.type === 'check').length;
  const title = ['h1', 'h2'].includes(blocks[0]?.type) ? blocks[0].text : '教材';
  const [active, setActive] = useState(false);
  const [category, setCategory] = useState<RecallCategory | 'all'>('all');
  const [round, setRound] = useState(0);
  const [revealed, setRevealed] = useState(new Set<string>());
  const [results, setResults] = useState<Record<string, CheckResult>>({});
  const [outline, setOutline] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const restored = useRef(false);
  const bodyY = useRef(0);
  const positions = useRef<Record<number, number>>({});
  useEffect(() => {
    setActive(false); setCategory('all'); setRound(0); setRevealed(new Set()); setResults({}); setOutline(false);
    restored.current = false;
    scroll.current?.scrollTo({ y: initialScrollOffset, animated: false });
  }, [body]);
  const selected = useMemo(() => chooseRecall(candidates, category, round), [candidates, category, round]);
  const selectedMap = useMemo(() => new Map((active ? selected : []).map(b => [b.id, b])), [active, selected]);
  const opened = selected.filter(b => revealed.has(b.id)).length;
  const allOpen = selected.length > 0 && opened === selected.length;
  const poolSize = candidates.filter(b => category === 'all' || b.category === category).length;
  const ink = resolved === 'light' ? '#225D84' : '#9BCBF2';
  const jump = (start: number) => scroll.current?.scrollTo({ y: bodyY.current + (positions.current[start] ?? 0), animated: true });
  const toggle = (id: string) => setRevealed(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const report = (id: string, result: CheckResult | null) => {
    setResults(prev => { const next = {...prev}; if (result) next[id] = result; else delete next[id]; return next; });
    if (studyId && result && result !== 'seen') void recordActivity('checks', studyId + ':' + id);
  };
  const button = (label: string, action: () => void, selectedState?: boolean, accessibilityLabel = label) => <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityState={{ selected: selectedState }} onPress={action}
    style={{ minHeight: 44, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, backgroundColor: selectedState ? c.accentSoft : c.card2,
      borderWidth: 1, borderColor: selectedState ? c.accent2 : c.line, justifyContent: 'center', maxWidth: '100%' }}>
    <Text style={{ color: selectedState ? c.accent2 : c.fg, fontSize: 14, lineHeight: 24, fontWeight: '700' }}>{label}</Text>
  </Pressable>;

  return <StudyRecallContext.Provider value={{selected: selectedMap, revealed, toggle, report}}>
    <View style={{ flex: 1 }}>
      <ScrollView ref={scroll} style={{ flex: 1 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets contentContainerStyle={{ padding: 16, paddingTop: 12, paddingBottom: 40 }}
        scrollEventThrottle={250} onScroll={e => { if (restored.current) onScrollPosition?.(Math.max(0, e.nativeEvent.contentOffset.y)); }}
        onContentSizeChange={(_, height) => { if (!restored.current && height > 0) { restored.current = true; scroll.current?.scrollTo({ y: initialScrollOffset, animated: false }); } }}>
        {body ? <>
          <Text accessibilityRole="header" style={{ color: c.fg, fontSize: 23, lineHeight: 35, fontWeight: '800', marginBottom: 12 }}>{title}</Text>
          <Text style={{ color: c.muted, fontSize: 14, lineHeight: 24, marginBottom: 16 }}>要点をつかむ → 図・具体例で理解 → クイズで確認</Text>
          <EmphasisLegend />
          {candidates.length > 0 ? <View style={{ borderWidth: 1, borderColor: c.line, borderRadius: 14, padding: 14, backgroundColor: c.card, gap: 12, marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {button('本文を読む', () => setActive(false), !active)}
              {button('暗記クイズ', () => { setActive(true); setRevealed(new Set()); }, active)}
            </View>
            <Text style={{ color: c.muted, fontSize: 14, lineHeight: 24 }}>{active ? '空欄を頭の中で答え、タップして確認。もう一度タップすると隠せます。' : '読んだ後は「暗記クイズ」で重要な語句・数値を思い出せます。'}</Text>
            {active ? <>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {(Object.keys(RECALL_LABELS) as (RecallCategory | 'all')[]).filter(key => key === 'all' || candidates.some(b => b.category === key)).map(key => <React.Fragment key={key}>
                  {button(RECALL_LABELS[key], () => { setCategory(key); setRound(0); setRevealed(new Set()); }, category === key)}
                </React.Fragment>)}
              </View>
              <Text style={{ color: c.muted, fontSize: 13, lineHeight: 22 }}>1回に最大10か所。見出し・図・具体例はヒントとして読めます。</Text>
            </> : null}
          </View> : null}
          {sections.some(s => s.title) ? <View style={{ backgroundColor: c.card2, borderRadius: 12, marginBottom: 16, padding: 12 }}>
            <Pressable accessibilityRole="button" accessibilityLabel="このレッスンの目次" accessibilityState={{ expanded: outline }} onPress={() => setOutline(v => !v)} style={{ minHeight: 44, justifyContent: 'center' }}>
              <Text style={{ color: c.fg, fontSize: 15, lineHeight: 25, fontWeight: '700' }}>このレッスンの目次 {outline ? '−' : '＋'}{checks > 0 ? ` · 確認${checks}問` : ''}</Text>
            </Pressable>
            {outline ? sections.filter(s => s.title).map(s => <Pressable key={s.start} accessibilityRole="button" accessibilityLabel={s.title + 'へ移動'} onPress={() => jump(s.start)} style={{ minHeight: 44, paddingVertical: 10 }}>
              <Text style={{ color: c.accent2, fontSize: 15, lineHeight: 25 }}>{s.title} ↓</Text>
            </Pressable>) : null}
          </View> : null}
          <View onLayout={e => { bodyY.current = e.nativeEvent.layout.y; }}>
            <Markdown key={body} body={body} hideTitle onLessonLink={onLessonLink} onSectionLayout={(index, y) => { positions.current[index] = y; }} />
          </View>
          {checks > 0 ? <View style={{ marginVertical: 16, borderWidth: 1, borderColor: c.line, backgroundColor: c.card, borderRadius: 14, padding: 16, gap: 8 }}>
            <Text accessibilityRole="header" style={{ color: c.fg, fontSize: 17, lineHeight: 28, fontWeight: '800' }}>このレッスンの確認状況</Text>
            <Text accessibilityLiveRegion="polite" style={{ color: c.fg, fontSize: 15, lineHeight: 27 }}>{`${Object.keys(results).length} / ${checks}問を確認`}</Text>
            <Text style={{ color: c.muted, fontSize: 14, lineHeight: 25 }}>{`選択問題の正解 ${Object.values(results).filter(v => v === 'correct').length}　自己確認できた ${Object.values(results).filter(v => v === 'self').length}\n見直したい ${Object.values(results).filter(v => v === 'review').length}　解説のみ確認 ${Object.values(results).filter(v => v === 'seen').length}`}</Text>
            <Text style={{ color: c.muted, fontSize: 13, lineHeight: 23 }}>メモと確認状況は、レッスンを移動するとリセットされます。暗記クイズの答え表示数は、正解数には含めません。</Text>
          </View> : null}
        </> : null}
        {children}
      </ScrollView>
      {active && selected.length > 0 ? <View style={{ padding: 10, borderTopWidth: 1, borderColor: c.line, backgroundColor: c.panel, gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <Text accessibilityLiveRegion="polite" style={{ color: ink, fontSize: 14, lineHeight: 23, fontWeight: '800' }}>答えの表示 {opened} / {selected.length}</Text>
          {button('本文へ', () => setActive(false), undefined, '暗記クイズを終了')}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {button(allOpen ? 'すべて隠す' : 'すべて表示', () => setRevealed(allOpen ? new Set() : new Set(selected.map(b => b.id))), undefined, allOpen ? 'すべて隠す' : '答えをすべて表示')}
          {!allOpen ? button('次の空欄', () => {
            const blank = selected.find(b => !revealed.has(b.id));
            if (!blank) return;
            const index = Number(blank.field.match(/^b(\d+)/)?.[1]);
            const section = sections.filter(s => s.start <= index).at(-1);
            if (section) jump(section.start);
          }, undefined, '次の空欄へ') : null}
          {poolSize > selected.length ? button('別の出題', () => { setRound(v => v + 1); setRevealed(new Set()); }) : null}
        </View>
      </View> : null}
    </View>
  </StudyRecallContext.Provider>;
}
