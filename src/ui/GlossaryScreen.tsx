import React, { useMemo, useState } from 'react';
import { Keyboard, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { getGlossary, freeTermIds, searchTerms, type Term } from '../data/glossary';
import { getFigureUri } from '../data/contentStore';
import { isFavTerm, toggleFavTerm } from '../data/bookmarks';
import type { Chapter } from '../data/chapters';
import { CHAPTER_SHORT } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { parseLessons } from './lessons';
import { LessonFigure } from './LessonFigure';
import { ImageZoom } from './ImageZoom';
import { useStudyFeedback } from './useStudyFeedback';

type LessonTarget = { chapterNo: string; lessonIdx: number };
type Props = {
  onBump: () => void; ver: number; favInit?: boolean; pro: boolean; onPaywall: () => void;
  chapters: Chapter[];
  renderLesson: (target: LessonTarget, onBack: () => void, onNav: (no: string, idx: number) => void) => React.ReactNode;
};

export function GlossaryScreen({ onBump, ver, favInit, pro, onPaywall, chapters, renderLesson }: Props) {
  const { c } = useTheme();
  const [query, setQuery] = useState('');
  const [chapter, setChapter] = useState<string | null>(favInit ? 'fav' : null);
  const [history, setHistory] = useState<string[]>([]);
  const [lesson, setLesson] = useState<LessonTarget | null>(null);
  const [, refresh] = useState(0);
  const terms = useMemo(() => getGlossary(), [ver]);
  const free = useMemo(() => freeTermIds(terms), [terms]);
  const canRead = (t: Term) => pro || free.has(t.id);
  const favorites = terms.filter(t => isFavTerm(t.term));
  const scope = chapter === 'fav' ? favorites : chapter ? terms.filter(t => t.chapter === chapter) : terms;
  const results = searchTerms(scope, query);
  const visible = results.filter(canRead);
  const showList = chapter !== null || !!query.trim();
  const current = terms.find(t => t.id === history[history.length - 1]);
  // Reading related terms is one study session. A prompt can occur on leaving it,
  // never merely because a different term was opened.
  useStudyFeedback('terms', !lesson && (current ? canRead(current) : showList && visible.length > 0));
  const open = (t: Term) => {
    Keyboard.dismiss();
    if (!canRead(t)) { onPaywall(); return; }
    setHistory(prev => prev.includes(t.id) ? prev.slice(0, prev.indexOf(t.id) + 1) : [...prev, t.id]);
  };
  const changed = () => { refresh(n => n + 1); onBump(); };
  const button = (label: string, action: () => void) => <Pressable accessibilityRole="button" onPress={action}
    style={{ minHeight: 44, paddingHorizontal: 12, paddingVertical: 10, justifyContent: 'center' }}>
    <Text style={{ color: c.accent2, fontSize: 15, lineHeight: 23, fontWeight: '700' }}>{label}</Text>
  </Pressable>;
  const locked = results.length - visible.length;
  const title = chapter === 'fav' ? 'お気に入り' : chapter ? `第${chapter}章 ${CHAPTER_SHORT[chapter]}` : '用語集';

  return <View style={{ flex: 1 }}>
    {/* Keep the list mounted: returning from a term preserves search and scroll. */}
    <View style={{ flex: 1, display: current || lesson ? 'none' : 'flex' }}>
      {chapter ? button('‹ 用語集に戻る', () => { setChapter(null); setQuery(''); }) : null}
      <ScrollView key={chapter ?? 'all'} style={{ flex: 1 }} keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 12 }}>
        <Text accessibilityRole="header" style={{ color: c.fg, fontSize: 25, lineHeight: 35, fontWeight: '800' }}>{title}</Text>
        <Text style={{ color: c.muted, fontSize: 14, lineHeight: 23 }}>用語をタップして、解説・具体例を確認。☆で復習したい用語を保存できます。</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: c.card, borderWidth: 1, borderColor: c.line, borderRadius: 12 }}>
          <TextInput accessibilityLabel={chapter ? 'この一覧の用語を検索' : '全章の用語を検索'} value={query} onChangeText={setQuery}
            placeholder="用語・よみ・別名で検索" placeholderTextColor={c.muted} returnKeyType="search" onSubmitEditing={Keyboard.dismiss}
            autoCorrect={false} style={{ flex: 1, minWidth: 0, minHeight: 48, padding: 12, color: c.fg, fontSize: 16 }} />
          {query ? <Pressable onPress={() => setQuery('')} accessibilityRole="button" accessibilityLabel="検索をクリア"
            style={{ minHeight: 48, minWidth: 44, justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: c.muted, fontSize: 22 }}>×</Text></Pressable> : null}
        </View>
        {showList ? <>
          <Text accessibilityLiveRegion="polite" style={{ color: c.muted, fontSize: 14, lineHeight: 22 }}>{`${results.length}語${locked ? `（閲覧できる用語 ${visible.length}語）` : ''}`}</Text>
          {results.length === 0 ? <Text style={{ color: c.muted, fontSize: 16, lineHeight: 28, paddingVertical: 16 }}>
            {query.trim() ? '一致する用語がありません。短い言葉や、ひらがなでも検索できます。' : 'まだお気に入りがありません。用語の☆をタップすると、ここに集まります。'}
          </Text> : null}
          {visible.map(t => <View key={t.id} style={{ flexDirection: 'row', backgroundColor: c.card, borderWidth: 1, borderColor: c.line, borderRadius: 14 }}>
            <Pressable onPress={() => open(t)} accessibilityRole="button" accessibilityLabel={`${t.term}の解説を読む`}
              style={{ flex: 1, minWidth: 0, padding: 16, gap: 5 }}>
              {!chapter || chapter === 'fav' ? <Text style={{ color: c.muted, fontSize: 12, lineHeight: 19 }}>第{t.chapter}章 · {CHAPTER_SHORT[t.chapter]}</Text> : null}
              <Text style={{ color: c.fg, fontSize: 19, lineHeight: 29, fontWeight: '800' }}>{t.term}</Text>
              {t.reading ? <Text style={{ color: c.muted, fontSize: 13, lineHeight: 21 }}>{t.reading}</Text> : null}
              <Text style={{ color: c.fg, fontSize: 15, lineHeight: 25 }}>{t.summary || t.def.split(/\n|。/)[0] + '。'}</Text>
              <Text style={{ color: c.accent2, fontSize: 13, lineHeight: 22 }}>解説を読む ›</Text>
            </Pressable>
            <Favorite term={t} onChange={changed} />
          </View>)}
          {locked > 0 ? <View style={{ padding: 16, backgroundColor: c.card, borderRadius: 12 }}>
            <Text style={{ color: c.fg, fontSize: 16, lineHeight: 26 }}>ほかの{locked}語はProで閲覧できます。</Text>
            {button('Proの内容を確認', onPaywall)}
          </View> : null}
        </> : <>
          {button(`★ お気に入り · ${favorites.length}語`, () => setChapter('fav'))}
          {['1', '2', '3', '4', '5', '6'].map(no => <Pressable key={no} accessibilityRole="button"
            accessibilityLabel={`第${no}章 ${CHAPTER_SHORT[no]}の用語`} onPress={() => setChapter(no)}
            style={{ borderWidth: 1, borderColor: c.line, backgroundColor: c.card, borderRadius: 14, padding: 16, gap: 6 }}>
            <Text style={{ color: c.fg, fontSize: 18, lineHeight: 28, fontWeight: '700' }}>第{no}章　{CHAPTER_SHORT[no]} ›</Text>
            <Text style={{ color: c.muted, fontSize: 14, lineHeight: 22 }}>{terms.filter(t => t.chapter === no).length}語</Text>
          </Pressable>)}
        </>}
      </ScrollView>
    </View>
    {/* Keeping each visited detail mounted also preserves position on related-term back. */}
    {history.map((id, i) => {
      const term = terms.find(t => t.id === id);
      if (!term) return null;
      return <View key={id} style={{ flex: 1, display: i === history.length - 1 && !lesson ? 'flex' : 'none' }}>
        {button(i ? '‹ 前の用語に戻る' : '‹ 一覧に戻る', () => setHistory(prev => prev.slice(0, -1)))}
        {canRead(term) ? <TermDetail term={term} terms={terms} chapters={chapters} onRelated={open} onChange={changed}
          onLesson={setLesson} /> : button('Proの内容を確認', onPaywall)}
      </View>;
    })}
    {lesson ? renderLesson(lesson, () => setLesson(null), (chapterNo, lessonIdx) => setLesson({ chapterNo, lessonIdx })) : null}
  </View>;
}

function Favorite({ term, onChange }: { term: Term; onChange: () => void }) {
  const { c } = useTheme();
  const fav = isFavTerm(term.term);
  return <Pressable accessibilityRole="button" accessibilityLabel={`${term.term}をお気に入り${fav ? 'から削除' : 'に追加'}`}
    accessibilityState={{ selected: fav }} onPress={() => { void toggleFavTerm(term.term).then(onChange); }}
    style={{ minWidth: 48, minHeight: 48, padding: 10, alignSelf: 'flex-start', alignItems: 'center', justifyContent: 'center' }}>
    <Text style={{ color: fav ? c.accent2 : c.muted, fontSize: 26 }}>{fav ? '★' : '☆'}</Text>
  </Pressable>;
}

function TermDetail({ term: t, terms, chapters, onRelated, onChange, onLesson }: {
  term: Term; terms: Term[]; chapters: Chapter[]; onRelated: (t: Term) => void; onChange: () => void; onLesson: (t: LessonTarget) => void;
}) {
  const { c, resolved } = useTheme();
  const [imageWidth, setImageWidth] = useState(0);
  const [zoom, setZoom] = useState<string | null>(null);
  const chapter = chapters.find(ch => ch.no === t.chapter);
  const lessons = parseLessons(chapter?.body ?? '');
  const lessonIdx = t.lesson ? lessons.findIndex(l => l.key === 'l' + (t.lesson! - 1)) : -1;
  const section = (title: string, text: string | undefined, kind: 'plain' | 'blue' | 'green' | 'red') => {
    if (!text) return null;
    const dark = resolved === 'dark';
    const ink = kind === 'blue' ? (dark ? '#8DC9F4' : '#225D84') : kind === 'green' ? (dark ? '#84D6AD' : '#216444') : kind === 'red' ? (dark ? '#FFB6A8' : '#9E3627') : c.fg;
    const bg = kind === 'blue' ? (dark ? '#152B3C' : '#EBF5FC') : kind === 'green' ? (dark ? '#172E26' : '#EFF8F2') : kind === 'red' ? (dark ? '#38221F' : '#FFF2ED') : 'transparent';
    return <View style={{ padding: 16, borderRadius: 12, backgroundColor: bg, borderLeftWidth: kind === 'plain' ? 0 : 4, borderLeftColor: ink, gap: 8 }}>
      <Text accessibilityRole="header" style={{ color: ink, fontSize: 15, lineHeight: 24, fontWeight: '800' }}>{title}</Text>
      <Text style={{ color: c.fg, fontSize: 16, lineHeight: 28 }}>{text}</Text>
    </View>;
  };
  return <>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 14 }}>
      <Text style={{ color: c.muted, fontSize: 13, lineHeight: 22 }}>第{t.chapter}章 · {CHAPTER_SHORT[t.chapter]}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
          <Text accessibilityRole="header" style={{ color: c.fg, fontSize: 25, lineHeight: 37, fontWeight: '800' }}>{t.term}</Text>
          {t.reading ? <Text style={{ color: c.muted, fontSize: 14, lineHeight: 23 }}>{t.reading}</Text> : null}
        </View><Favorite term={t} onChange={onChange} />
      </View>
      {t.aliases?.length ? <Text style={{ color: c.muted, fontSize: 13, lineHeight: 23 }}>別名・検索の手がかり：{t.aliases.join('、')}</Text> : null}
      {section('ひとことで', t.summary, 'blue')}
      {section('解説', t.explanation || t.def, 'plain')}
      {t.figure ? <View onLayout={e => setImageWidth(Math.max(1, e.nativeEvent.layout.width))}>
        {imageWidth > 0 ? <LessonFigure uri={getFigureUri(t.figure)} caption={t.figureCaption || t.term} width={imageWidth} captionSize={14} onZoom={setZoom} /> : null}
      </View> : null}
      {section('具体例', t.example, 'green')}
      {section('間違えやすい点', t.caution, 'red')}
      {t.related?.length ? <View style={{ gap: 8 }}>
        <Text accessibilityRole="header" style={{ color: c.fg, fontSize: 16, lineHeight: 26, fontWeight: '800' }}>つながる用語</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {t.related.map(name => terms.find(other => other.term === name)).filter((other): other is Term => !!other).map(other =>
            <Pressable key={other.id} accessibilityRole="button" onPress={() => onRelated(other)}
              style={{ minHeight: 44, maxWidth: '100%', paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: c.line, borderRadius: 10, backgroundColor: c.card }}>
              <Text style={{ color: c.accent2, fontSize: 15, lineHeight: 24 }}>{other.term} ›</Text>
            </Pressable>)}
        </View>
      </View> : null}
      {lessonIdx >= 0 ? <Pressable accessibilityRole="button" accessibilityLabel="関連する教材を読む"
        onPress={() => onLesson({ chapterNo: t.chapter, lessonIdx })}
        style={{ borderWidth: 1, borderColor: c.line, borderRadius: 12, padding: 16, minHeight: 48, gap: 6 }}>
        <Text style={{ color: c.accent2, fontSize: 16, lineHeight: 26, fontWeight: '800' }}>教材で詳しく学ぶ ›</Text>
        <Text style={{ color: c.muted, fontSize: 14, lineHeight: 24 }}>第{t.chapter}章 · {lessons[lessonIdx].label}</Text>
      </Pressable> : null}
    </ScrollView>
    {zoom ? <ImageZoom uri={zoom} onClose={() => setZoom(null)} /> : null}
  </>;
}
