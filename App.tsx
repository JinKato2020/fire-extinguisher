import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, Image, TextInput,
  useWindowDimensions, PanResponder, Alert, ActivityIndicator, Modal, Switch,
} from 'react-native';
import type { PurchasesPackage } from 'react-native-purchases';
import { initPurchases, isProActive, subscribePro, getProPackage, purchasePro, restorePro, canUseFreePreview, isFreePreviewEnabled, setFreePreviewEnabled } from './src/data/purchases';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BUILD_NUMBER } from './src/buildInfo';
import { initContent } from './src/data/initContent';
import { getChapters, type Chapter } from './src/data/chapters';
import { getFigureUri } from './src/data/contentStore';
import { ImageZoom } from './src/ui/ImageZoom';
import { LessonFigure } from './src/ui/LessonFigure';
import { parseMarkdown } from './src/ui/markdown';
import { getQuizSets, getQuestions, getAllQuestions, type Question, type QuizSet } from './src/data/questions';
import { loadHistory, recordAnswer, selectReview, overallStats, getRec } from './src/data/history';
import { getGlossary, type Term } from './src/data/glossary';
import {
  loadBookmarks, isBookmarked, toggleBookmark, bookmarkedIds, bookmarkCount,
  isFavTerm, toggleFavTerm,
} from './src/data/bookmarks';
import { loadExamDate, getExamDate, setExamDate, daysLeft, examDateText } from './src/data/examDate';
import {
  loadStats, bumpDaily, chapterStats, currentAccMap, recentDaily, studyStreak,
  recordSnapshotIfNeeded, snapAsOf,
} from './src/data/stats';
import { ThemeProvider, useTheme, useStyles } from './src/theme/ThemeContext';
import type { Mode } from './src/theme/ThemeContext';
import { CHAPTER_SHORT, subjectColor, type Colors } from './src/theme/colors';
import { SvgXml, Svg, Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { Icon, Ring, Tag, RadarChart, StreakBars, Segmented, type RadarAxis, type RadarSeries } from './src/ui/components';
import { RELATION_MAPS } from './src/data/relationMaps.generated';

type TabKey = 'home' | 'learn' | 'terms' | 'mock' | 'set';
type ModalKey = 'bookmarks' | 'relation' | 'guide' | 'examdate' | 'paywall' | null;

const QLABEL = ['1', '2', '3', '4', '5'];
const pad2 = (n: number) => String(n).padStart(2, '0');

function tagColors(kind: NonNullable<Chapter['tagKind']>, c: Colors): { bg: string; fg: string } {
  switch (kind) {
    case 'hard': return { bg: c.warnSoft, fg: c.warn };
    case 'mid': return { bg: 'rgba(224,163,46,0.16)', fg: '#E0A32E' };
    case 'easy': return { bg: c.goodSoft, fg: c.good };
    case 'done': return { bg: c.goodSoft, fg: c.good };
  }
}

function rich(text: string): React.ReactNode {
  return text.split(/(\*\*.+?\*\*|`[^`]+`)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <Text key={i} style={{ fontWeight: '800' }}>{part.slice(2, -2)}</Text>
      : part.startsWith('`') && part.endsWith('`') ? part.slice(1, -1) : part);
}

// ---- 軽量マークダウン表示 ----
function Markdown({ body }: { body: string }) {
  const { c } = useTheme();
  const s = useStyles();
  const { width } = useWindowDimensions();
  const imgW = Math.min(width, 440) - 32;
  const blocks = useMemo(() => parseMarkdown(body), [body]);
  const [zoomUri, setZoomUri] = useState<string | null>(null);

  return (
    <View>
      {blocks.map((b, i) => {
        if (b.type === 'fig') {
          const [asset, cap] = b.text.split('\u0001');
          const uri = getFigureUri(asset);
          return <LessonFigure key={i} uri={uri} caption={cap} width={imgW} onZoom={setZoomUri} />;
        }
        if (b.type === 'figpending') return <Text key={i} style={{ color: c.faint, fontSize: 12, marginVertical: 4 }}>{'【図】' + b.text}</Text>;
        if (b.type === 'gap') return <View key={i} style={{ height: 8 }} />;
        if (b.type === 'hr') return <View key={i} style={s.hr} />;
        if (b.type === 'h1') return <Text key={i} style={s.mdH1}>{rich(b.text)}</Text>;
        if (b.type === 'h2') return <Text key={i} style={s.mdH2}>{rich(b.text)}</Text>;
        if (b.type === 'h3') return <Text key={i} style={s.mdH3}>{rich(b.text)}</Text>;
        if (b.type === 'h4') return <Text key={i} style={s.mdH4}>{rich(b.text)}</Text>;
        if (b.type === 'quote') {
          const ink = b.tone === 'warning' ? c.warn : b.tone === 'important' ? c.good : c.accent;
          const bg = b.tone === 'warning' ? c.warnSoft : b.tone === 'important' ? c.goodSoft : c.accentSoft;
          return <View key={i} style={[s.quote, { borderColor: ink, backgroundColor: bg }]}>
            {b.title ? <Text style={[s.quoteTitle, { color: ink }]}>{b.title}</Text> : null}
            {b.text.split('\n').map((line, j) => line ? <Text key={j} style={s.quoteTxt}>{rich(line.replace(/^[-*] /, '・'))}</Text> : <View key={j} style={{ height: 6 }} />)}
          </View>;
        }
        if (b.type === 'code') return <View key={i} style={s.code}><Text style={s.codeTxt}>{b.text}</Text></View>;
        if (b.type === 'table' && b.rows) {
          const rows = b.rows;
          return (
            <View key={i} style={s.table}>
              {rows.map((r, ri) => (
                <View key={ri} style={[s.tableRow, ri === 0 && s.tableHeadRow, ri === rows.length - 1 && { borderBottomWidth: 0 }]}>
                  {r.map((cell, ci) => (
                    <View key={ci} style={[s.tableCell, ci > 0 && s.tableCellDiv]}>
                      <Text style={[s.tableCellTxt, ri === 0 && s.tableHeadTxt]}>{rich(cell)}</Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          );
        }
        if (b.type === 'li' || b.type === 'ol') return <View key={i} style={s.mdList}>
          <Text style={s.mdListMark}>{b.type === 'li' ? '・' : b.text.match(/^\d+\./)?.[0]}</Text>
          <Text style={s.mdListBody}>{rich(b.type === 'li' ? b.text : b.text.replace(/^\d+\. /, ''))}</Text>
        </View>;
        return <Text key={i} style={s.mdP}>{rich(b.text)}</Text>;
      })}
      {zoomUri ? <ImageZoom uri={zoomUri} onClose={() => setZoomUri(null)} /> : null}
    </View>
  );
}

// ---- 分野別レーダー(現在+2週前+1ヶ月前) ----
function SubjectRadar({ compact }: { compact?: boolean }) {
  const { c } = useTheme();
  const s = useStyles();
  const stats = chapterStats();
  const answered = Object.values(stats).reduce((a, x) => a + x.answered, 0);
  if (answered === 0) {
    return <Text style={s.radarEmpty}>{'問題を解くと、分野ごとの実力が\nここにレーダーで表示されます。'}</Text>;
  }
  const axes: RadarAxis[] = ['1', '2', '3', '4', '5', '6'].map((k) => ({
    key: k, label: CHAPTER_SHORT[k], color: subjectColor(k, c),
  }));
  const cur = currentAccMap();
  const w2 = snapAsOf(14);
  const m1 = snapAsOf(30);
  const series: RadarSeries[] = [];
  if (m1) series.push({ map: m1, color: c.faint, dotted: true, width: 1.5 });
  if (w2) series.push({ map: w2, color: c.muted, dashed: true, width: 1.5 });
  series.push({ map: cur, color: c.accent, width: 2.4 });

  return (
    <View style={{ alignItems: 'center' }}>
      <RadarChart axes={axes} series={series} size={compact ? 210 : 240} />
      <View style={s.radarLegend}>
        <View style={s.legendItem}><View style={[s.legendDash, { borderTopColor: c.accent, width: 16 }]} /><Text style={s.legendTxt}>現在</Text></View>
        {w2 ? <View style={s.legendItem}><View style={[s.legendDash, { borderColor: c.muted, borderStyle: 'dashed', width: 16 }]} /><Text style={s.legendTxt}>2週前</Text></View> : null}
        {m1 ? <View style={s.legendItem}><View style={[s.legendDash, { borderColor: c.faint, borderStyle: 'dotted', width: 16 }]} /><Text style={s.legendTxt}>1ヶ月前</Text></View> : null}
        <View style={s.legendItem}><View style={[s.legendDash, { borderTopColor: c.good, borderStyle: 'dashed', width: 16 }]} /><Text style={s.legendTxt}>合格目安60%</Text></View>
      </View>
    </View>
  );
}

// ---- ホーム ----
function HomeScreen({ onGo, onModal, onFavTerms, ver }: { onGo: (t: TabKey) => void; onModal: (m: ModalKey) => void; onFavTerms: () => void; ver: number }) {
  const { c, resolved } = useTheme();
  const s = useStyles();
  const { width } = useWindowDimensions();
  const heroW = Math.min(width, 440);

  const stats = useMemo(() => overallStats(), [ver]);
  const left = useMemo(() => daysLeft(), [ver]);
  const dateText = useMemo(() => examDateText(), [ver]);
  const streak = useMemo(() => studyStreak(), [ver]);
  const recent = useMemo(() => recentDaily(14), [ver]);
  const bmCount = useMemo(() => bookmarkCount(), [ver]);
  const cs = useMemo(() => chapterStats(), [ver]);
  const answeredAny = stats.answered > 0;
  const weak = Object.values(cs).some((x) => x.answered > 0 && x.acc <= 40);
  const allPass = answeredAny && !weak && stats.accuracy >= 60;
  const guideImg = resolved === 'light'
    ? require('./assets/examguide-light.png')
    : require('./assets/examguide-dark.png');

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
      <View>
        <Image source={require('./assets/hero.jpg')} style={{ width: heroW, height: heroW * (888 / 853) }} resizeMode="cover" />
        {/* ヒーロー下端を背景色へグラデーションで溶け込ませる(クレーン流儀) */}
        <View style={s.heroFade} pointerEvents="none">
          <Svg width="100%" height="100%">
            <Defs>
              <LinearGradient id="heroFade" x1="0" y1="0" x2="0" y2="1">
                {/* 上側は透明のまま消火器を見せ、下端だけ勾配強め(急)で背景へ溶かす */}
                <Stop offset="0" stopColor={c.bg} stopOpacity={0} />
                <Stop offset="0.4" stopColor={c.bg} stopOpacity={0} />
                <Stop offset="0.82" stopColor={c.bg} stopOpacity={0.92} />
                <Stop offset="1" stopColor={c.bg} stopOpacity={1} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#heroFade)" />
          </Svg>
        </View>
      </View>

      <View style={s.pad}>
        {/* 試験日カウントダウン */}
        <Pressable style={({ pressed }) => [s.countCard, pressed && s.pressed]} onPress={() => onModal('examdate')}>
          <Icon name="calendar" size={30} color={c.accent} />
          <View style={s.countLeft}>
            <Text style={s.countLabel}>試験日まで</Text>
            {left === null ? (
              <Text style={[s.countBig, { marginTop: 4 }]}>日付を設定</Text>
            ) : left >= 0 ? (
              <View style={s.countRow}><Text style={s.countNum}>{left}</Text><Text style={s.countUnit}>日</Text></View>
            ) : (
              <Text style={[s.countBig, { marginTop: 4 }]}>試験おつかれさま</Text>
            )}
            <Text style={s.countSub}>{dateText ?? 'タップして試験日を登録'}</Text>
          </View>
          <View style={s.countSetBtn}><Text style={s.countSetTxt}>設定</Text></View>
        </Pressable>

        {/* 分野別レーダー */}
        <View style={s.radarCard}>
          <View style={s.radarHead}>
            <Text style={s.cardTitle}>分野ごとの実力</Text>
            {answeredAny ? (
              <View style={[s.radarBadge, { backgroundColor: allPass ? c.goodSoft : c.warnSoft }]}>
                <Text style={[s.radarBadgeTxt, { color: allPass ? c.good : c.warn }]}>{allPass ? '合格圏' : '弱点あり'}</Text>
              </View>
            ) : null}
          </View>
          <SubjectRadar compact />
          {answeredAny ? <Text style={s.radarHelp}>各分野40%以上・全体60%以上が合格の目安です。40%以下の分野は要注意。</Text> : null}
        </View>

        {/* メニュー6カード(2列×3段) */}
        <View style={s.grid}>
          <MenuTile icon="book" title="教材で学ぶ" sub={'基礎から\nしっかり学ぶ'} onPress={() => onGo('learn')} />
          <MenuTile icon="terms" title="用語" sub={'重要用語を\n確認する'} onPress={() => onGo('terms')} />
          <MenuTile icon="doc" title="模試試験" sub={'本番形式で\n実力を試す'} onPress={() => onGo('mock')} />
          <MenuTile icon="map" title="相関図" sub={'用語のつながり\nを見る'} onPress={() => onModal('relation')} />
          <MenuTile icon="star" title="お気に入りの用語" sub={'★をつけた\n用語を見返す'} onPress={onFavTerms} />
          <MenuTile icon="bookmark" title="ブックマーク" sub={'気になる問題を\n見返す'} badge={bmCount > 0 ? String(bmCount) : undefined} onPress={() => onModal('bookmarks')} />
        </View>

        {/* 試験総合解説カード */}
        <Pressable style={({ pressed }) => [s.guideCard, pressed && s.pressed]} onPress={() => onModal('guide')}>
          <Image source={guideImg} style={s.guideImg} resizeMode="cover" />
          {/* 下側だけグラデーション(画像の上部は明るいまま・文字は下で読める) */}
          <View style={s.guideScrim} pointerEvents="none">
            <Svg width="100%" height="100%">
              <Defs>
                <LinearGradient id="guideFade" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor="#000" stopOpacity={0} />
                  <Stop offset="1" stopColor="#000" stopOpacity={0.62} />
                </LinearGradient>
              </Defs>
              <Rect x="0" y="0" width="100%" height="100%" fill="url(#guideFade)" />
            </Svg>
          </View>
          <View style={s.guideOverlay}>
            <Text style={s.guideEyebrow}>EXAM GUIDE</Text>
            <Text style={s.guideTitle}>試験の総合解説</Text>
            <Text style={s.guideSub}>出題のしくみ・合格基準・学び方(公式情報ベース)</Text>
          </View>
        </Pressable>

        {/* 学習ストリーク */}
        <View style={s.streakCard}>
          <View style={s.streakTop}>
            <View>
              <Text style={s.streakLbl}>学習の継続</Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                <Text style={s.streakNum}>{streak}</Text><Text style={s.streakLbl}>日連続</Text>
              </View>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={s.streakLbl}>のべ解答</Text>
              <Text style={s.streakNum}>{stats.answered}</Text>
            </View>
          </View>
          <StreakBars data={recent} />
          <View style={s.streakAxis}><Text style={s.streakAxisTxt}>14日前</Text><Text style={s.streakAxisTxt}>今日</Text></View>
          <Text style={s.streakHelp}>解いた問題数の推移。毎日つづけて、連続日数をのばそう。</Text>
        </View>

        <View style={s.motiv}>
          <View style={s.motivRule}>
            <View style={s.motivLine} />
            <Icon name="flame" size={15} color={c.accent} />
            <View style={s.motivLine} />
          </View>
          <Text style={s.motivMain}>最初の一本で、火を制す。</Text>
          <Text style={s.motivKicker}>THE FIRST LINE OF DEFENSE</Text>
        </View>
      </View>
    </ScrollView>
  );
}

function MenuTile({ icon, title, sub, onPress, badge, soon }: { icon: string; title: string; sub: string; onPress: () => void; badge?: string; soon?: boolean }) {
  const { c } = useTheme();
  const s = useStyles();
  return (
    <Pressable style={({ pressed }) => [s.tile, pressed && s.pressed]} onPress={onPress}>
      <View style={s.tileIco}><Icon name={icon} size={20} color={c.accent} /></View>
      <Text style={s.tileTitle}>{title}</Text>
      <Text style={s.tileSub}>{sub}</Text>
      {badge ? <View style={s.tileBadge}><Text style={s.tileBadgeTxt}>{badge}</Text></View> : null}
      {soon ? <View style={s.tileSoon}><Text style={s.tileSoonTxt}>準備中</Text></View> : null}
      <Text style={s.tileGo}>›</Text>
    </Pressable>
  );
}

// ---- 教材(章一覧 / リーダー) ----
// 章本文を「## Lesson NN」見出しでレッスンに分割(先頭の導入部は「はじめに・準備」)。
type Lesson = { key: string; label: string; body: string };
function parseLessons(body: string): Lesson[] {
  if (!body) return [];
  const lines = body.split('\n');
  const idxs: number[] = [];
  lines.forEach((ln, i) => { if (/^##\s+Lesson\s/i.test(ln.trim())) idxs.push(i); });
  if (idxs.length === 0) return [{ key: 'all', label: '本文', body }];
  const out: Lesson[] = [];
  const intro = lines.slice(0, idxs[0]).join('\n').trim();
  if (intro) out.push({ key: 'intro', label: 'はじめに・準備', body: intro });
  for (let k = 0; k < idxs.length; k++) {
    const start = idxs[k];
    const end = k + 1 < idxs.length ? idxs[k + 1] : lines.length;
    const head = lines[start].trim().replace(/^##\s+/, '');
    out.push({ key: 'l' + k, label: head, body: lines.slice(start, end).join('\n') });
  }
  return out;
}

// ---- Pro誘導カード(無料範囲の先で表示) ----
function ProCut({ onPaywall, title, sub }: { onPaywall: () => void; title: string; sub: string }) {
  const { c } = useTheme();
  const s = useStyles();
  return (
    <Pressable onPress={onPaywall} style={({ pressed }) => [s.proCut, pressed && s.pressed]}>
      <View style={s.proCutIcon}><Icon name="flame" size={22} color={c.accent} /></View>
      <Text style={s.proCutTitle}>{title}</Text>
      <Text style={s.proCutSub}>{sub}</Text>
      <View style={s.proCutBtn}><Text style={s.proCutBtnTxt}>Proにアップグレード ›</Text></View>
    </Pressable>
  );
}

// 無料で読めるレッスン数(導入は常に無料。全章ともLesson5まで無料)。
function freeLessonEntries(_chapterNo: string, lessons: Lesson[]): number {
  const base = lessons[0]?.key === 'intro' ? 1 : 0;
  const n = 5;
  return base + n;
}

function LearnScreen({ chapters, onOpen }: { chapters: Chapter[]; onOpen: (c: Chapter) => void }) {
  const { c } = useTheme();
  const s = useStyles();
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
      <View style={s.pad}>
        <View style={s.viewHead}>
          <Text style={s.eyebrow}>STUDY</Text>
          <Text style={s.viewH2}>教材</Text>
          <Text style={s.viewSub}>章を選んで、読んで学ぶ。難しい章ほど解説を厚くしています。</Text>
        </View>
        <View style={{ gap: 10, marginTop: 16 }}>
          {chapters.map((ch) => {
            const tk = ch.tag && ch.tagKind ? tagColors(ch.tagKind, c) : null;
            return (
              <Pressable key={ch.no} style={({ pressed }) => [s.ch, pressed && s.pressed]} onPress={() => onOpen(ch)}>
                <View style={s.chNo}><Text style={s.chNoTxt}>{ch.no}</Text></View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                    <Text style={s.chTitle}>{ch.title}</Text>
                    {ch.tag && tk ? <Tag label={ch.tag} color={tk.fg} bg={tk.bg} /> : null}
                  </View>
                  <Text style={s.chSub}>{ch.sub}</Text>
                </View>
                <Text style={s.chGo}>›</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

// ---- レッスン選択画面(章の中のレッスン一覧。左右スワイプで隣の章へ) ----
function LessonListScreen({ chapter, chapters, onOpenLesson, onBack, onNavChapter, pro, onPaywall }: { chapter: Chapter; chapters: Chapter[]; onOpenLesson: (i: number) => void; onBack: () => void; onNavChapter: (no: string) => void; pro: boolean; onPaywall: () => void }) {
  const s = useStyles();
  const lessons = useMemo(() => parseLessons(chapter.body ?? ''), [chapter.body]);
  const freeCount = freeLessonEntries(chapter.no, lessons);
  const idx = chapters.findIndex((x) => x.no === chapter.no);
  const prev = idx > 0 ? chapters[idx - 1] : null;
  const next = idx >= 0 && idx < chapters.length - 1 ? chapters[idx + 1] : null;
  const navRef = useRef<{ prev: Chapter | null; next: Chapter | null; go: (no: string) => void }>({ prev, next, go: onNavChapter });
  navRef.current = { prev, next, go: onNavChapter };
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 24 && Math.abs(g.dx) > Math.abs(g.dy) * 1.8,
      onPanResponderRelease: (_e, g) => {
        const { prev: p, next: n, go } = navRef.current;
        if (g.dx <= -60 && n) go(n.no);
        else if (g.dx >= 60 && p) go(p.no);
      },
    }),
  ).current;

  return (
    <View style={{ flex: 1 }} {...pan.panHandlers}>
      <View style={s.readerBar}>
        <Pressable onPress={onBack} hitSlop={10} style={({ pressed }) => [s.backBtn, pressed && s.pressed]}>
          <Text style={s.backTxt}>‹ 章の選択</Text>
        </Pressable>
        <Text style={s.qProgress} numberOfLines={1}>{'第' + chapter.no + '章 ' + chapter.title}</Text>
      </View>
      <ScrollView key={chapter.no} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
        <View style={s.pad}>
          <View style={s.viewHead}>
            <Text style={s.eyebrow}>{'CHAPTER ' + chapter.no}</Text>
            <Text style={s.viewH2}>{chapter.title}</Text>
            <Text style={s.viewSub}>レッスンを選んで読み進めましょう。左右スワイプで隣の章へ移動できます。</Text>
          </View>
          {lessons.length === 0 ? (
            <View style={s.soon}><Text style={s.soonBig}>準備中</Text><Text style={s.soonTxt}>{'第' + chapter.no + '章の解説はこれから追加します。'}</Text></View>
          ) : (
            <View style={{ gap: 10, marginTop: 16 }}>
              {lessons.map((l, i) => {
                const locked = !pro && i >= freeCount;
                return (
                  <Pressable key={l.key} style={({ pressed }) => [s.ch, locked && s.chLocked, pressed && s.pressed]} onPress={() => (locked ? onPaywall() : onOpenLesson(i))}>
                    <View style={s.chNo}><Text style={s.chNoTxt}>{i + 1}</Text></View>
                    <View style={{ flex: 1, minWidth: 0 }}><Text style={s.chTitle} numberOfLines={2}>{l.label}</Text></View>
                    {locked ? <View style={s.proPill}><Text style={s.proPillTxt}>Pro</Text></View> : <Text style={s.chGo}>›</Text>}
                  </Pressable>
                );
              })}
            </View>
          )}
          <View style={s.readerNav}>
            <Pressable disabled={!prev} onPress={() => prev && onNavChapter(prev.no)} style={({ pressed }) => [s.readerNavBtn, !prev && s.btnDisabled, pressed && s.pressed]}>
              {prev ? <><Text style={s.readerNavTxt}>‹ 前の章</Text><Text style={s.readerNavSub} numberOfLines={1}>{prev.title}</Text></> : null}
            </Pressable>
            <Pressable disabled={!next} onPress={() => next && onNavChapter(next.no)} style={({ pressed }) => [s.readerNavBtn, { alignItems: 'flex-end' }, !next && s.btnDisabled, pressed && s.pressed]}>
              {next ? <><Text style={s.readerNavTxt}>次の章 ›</Text><Text style={s.readerNavSub} numberOfLines={1}>{next.title}</Text></> : null}
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// ---- レッスン本文(左右スワイプで隣のレッスンへ。章をまたいで連続) ----
function LessonReader({ chapters, chapterNo, lessonIdx, onBack, onNav, pro, onPaywall }: { chapters: Chapter[]; chapterNo: string; lessonIdx: number; onBack: () => void; onNav: (chapterNo: string, lessonIdx: number) => void; pro: boolean; onPaywall: () => void }) {
  const s = useStyles();
  const chapter = chapters.find((x) => x.no === chapterNo) ?? null;
  const lessons = useMemo(() => parseLessons(chapter?.body ?? ''), [chapter?.body]);
  const safeIdx = Math.max(0, Math.min(lessonIdx, lessons.length - 1));
  const lesson = lessons[safeIdx] ?? null;
  const locked = !pro && safeIdx >= freeLessonEntries(chapterNo, lessons);
  const chIdx = chapters.findIndex((x) => x.no === chapterNo);

  const prevTarget = (() => {
    if (safeIdx > 0) return { no: chapterNo, i: safeIdx - 1 };
    for (let k = chIdx - 1; k >= 0; k--) { const ls = parseLessons(chapters[k].body ?? ''); if (ls.length) return { no: chapters[k].no, i: ls.length - 1 }; }
    return null;
  })();
  const nextTarget = (() => {
    if (safeIdx < lessons.length - 1) return { no: chapterNo, i: safeIdx + 1 };
    for (let k = chIdx + 1; k < chapters.length; k++) { const ls = parseLessons(chapters[k].body ?? ''); if (ls.length) return { no: chapters[k].no, i: 0 }; }
    return null;
  })();

  const navRef = useRef<{ prev: { no: string; i: number } | null; next: { no: string; i: number } | null; go: (no: string, i: number) => void }>({ prev: prevTarget, next: nextTarget, go: onNav });
  navRef.current = { prev: prevTarget, next: nextTarget, go: onNav };
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 24 && Math.abs(g.dx) > Math.abs(g.dy) * 1.8,
      onPanResponderRelease: (_e, g) => {
        const { prev: p, next: n, go } = navRef.current;
        if (g.dx <= -60 && n) go(n.no, n.i);
        else if (g.dx >= 60 && p) go(p.no, p.i);
      },
    }),
  ).current;

  return (
    <View style={{ flex: 1 }} {...pan.panHandlers}>
      <View style={s.readerBar}>
        <Pressable onPress={onBack} hitSlop={10} style={({ pressed }) => [s.backBtn, pressed && s.pressed]}>
          <Text style={s.backTxt}>‹ レッスン一覧</Text>
        </Pressable>
        <Text style={s.qProgress} numberOfLines={1}>{(chapter ? '第' + chapter.no + '章' : '') + (lessons.length ? '・' + (safeIdx + 1) + '/' + lessons.length : '')}</Text>
      </View>
      <ScrollView key={chapterNo + '-' + safeIdx} style={{ flex: 1 }} contentContainerStyle={[s.pad, { paddingBottom: 40, paddingTop: 6 }]} showsVerticalScrollIndicator={false}>
        {locked
          ? <ProCut onPaywall={onPaywall} title="このレッスンはProで" sub={'無料で読めるレッスンの先です。Proですべてのレッスン・用語・相関図・模試が解放されます。'} />
          : lesson ? <Markdown body={lesson.body} /> : <View style={s.soon}><Text style={s.soonBig}>準備中</Text></View>}
        <View style={s.readerNav}>
          <Pressable disabled={!prevTarget} onPress={() => prevTarget && onNav(prevTarget.no, prevTarget.i)} style={({ pressed }) => [s.readerNavBtn, !prevTarget && s.btnDisabled, pressed && s.pressed]}>
            {prevTarget ? <Text style={s.readerNavTxt}>‹ 前のレッスン</Text> : null}
          </Pressable>
          <Pressable disabled={!nextTarget} onPress={() => nextTarget && onNav(nextTarget.no, nextTarget.i)} style={({ pressed }) => [s.readerNavBtn, { alignItems: 'flex-end' }, !nextTarget && s.btnDisabled, pressed && s.pressed]}>
            {nextTarget ? <Text style={s.readerNavTxt}>次のレッスン ›</Text> : null}
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

// ---- 用語集 ----
function GlossaryScreen({ onBump, ver, favInit, pro, onPaywall }: { onBump: () => void; ver: number; favInit?: boolean; pro: boolean; onPaywall: () => void }) {
  const { c } = useTheme();
  const s = useStyles();
  const [q, setQ] = useState('');
  // sel: null = 章の選択画面 / '1'〜'6' = その章 / 'fav' = お気に入り
  const [sel, setSel] = useState<string | null>(favInit ? 'fav' : null);
  const terms = useMemo(() => getGlossary(), [ver]);
  // 無料は各章の先頭6語まで(Proで全解放)
  const posInCh = useMemo(() => {
    const m: Record<string, number> = {}; const cnt: Record<string, number> = {};
    for (const t of terms) { const k = t.chapter; const n = cnt[k] ?? 0; m[t.id] = n; cnt[k] = n + 1; }
    return m;
  }, [terms]);
  const canSee = (t: Term) => pro || (posInCh[t.id] ?? 99) < 6;
  const chapters = ['1', '2', '3', '4', '5', '6'];
  const chCount = (k: string) => terms.filter((t) => t.chapter === k).length;
  const favCount = terms.filter((t) => isFavTerm(t.term)).length;

  // ---- 章の選択画面 ----
  if (sel === null) {
    const nq = q.trim();
    const results = nq
      ? terms.filter((t) => t.term.includes(nq) || (t.reading ?? '').includes(nq) || t.def.includes(nq))
      : [];
    return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 28 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={s.pad}>
          <View style={s.viewHead}>
            <Text style={s.eyebrow}>GLOSSARY</Text>
            <Text style={s.viewH2}>用語集</Text>
            <Text style={s.viewSub}>章を選ぶと、その章の重要用語が見られます。★でお気に入りに登録できます。</Text>
          </View>
          {/* 用語検索窓(お気に入りの上・全章から検索) */}
          <View style={s.search}>
            <Icon name="search" size={18} color={c.faint} />
            <TextInput
              style={s.searchInput}
              placeholder="用語を検索（全章から）"
              placeholderTextColor={c.faint}
              value={q}
              onChangeText={setQ}
              returnKeyType="search"
            />
            {q ? <Pressable onPress={() => setQ('')} hitSlop={8}><Text style={{ color: c.faint, fontSize: 15, fontWeight: '800' }}>✕</Text></Pressable> : null}
          </View>
          {nq ? (
            results.length ? (
              <View style={{ marginTop: 10 }}>
                {results.filter(canSee).map((t) => <TermCard key={t.id} term={t} onBump={onBump} />)}
                {!pro && results.some((t) => !canSee(t)) ? <ProCut onPaywall={onPaywall} title="ほかの用語はProで" sub={'無料は各章の先頭6語まで。Proで全用語を検索・閲覧できます。'} /> : null}
              </View>
            ) : (
              <Text style={[s.viewSub, { marginTop: 16 }]}>{`「${q}」に一致する用語は見つかりませんでした。`}</Text>
            )
          ) : (
            <View style={{ gap: 10, marginTop: 16 }}>
              <Pressable style={({ pressed }) => [s.ch, pressed && s.pressed]} onPress={() => setSel('fav')}>
                <View style={s.chNo}><Text style={s.chNoTxt}>★</Text></View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.chTitle}>お気に入りの用語</Text>
                  <Text style={s.chSub}>{favCount > 0 ? `★をつけた用語 ${favCount}語` : 'まだ登録がありません'}</Text>
                </View>
                <Text style={s.chGo}>›</Text>
              </Pressable>
              {chapters.map((k) => (
                <Pressable key={k} style={({ pressed }) => [s.ch, pressed && s.pressed]} onPress={() => setSel(k)}>
                  <View style={s.chNo}><Text style={s.chNoTxt}>{k}</Text></View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.chTitle}>{CHAPTER_SHORT[k]}</Text>
                    <Text style={s.chSub}>{`重要用語 ${chCount(k)}語`}</Text>
                  </View>
                  <Text style={s.chGo}>›</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    );
  }

  // ---- 章 / お気に入りの用語一覧 ----
  const title = sel === 'fav' ? 'お気に入りの用語' : `第${sel}章 ${CHAPTER_SHORT[sel]}`;
  const list = terms.filter((t) => {
    if (sel === 'fav') { if (!isFavTerm(t.term)) return false; }
    else if (t.chapter !== sel) return false;
    if (q.trim()) {
      const needle = q.trim();
      if (!(t.term.includes(needle) || (t.reading ?? '').includes(needle) || t.def.includes(needle))) return false;
    }
    return true;
  });

  return (
    <View style={{ flex: 1 }}>
      <View style={s.readerBar}>
        <Pressable onPress={() => { setSel(null); setQ(''); }} hitSlop={10} style={({ pressed }) => [s.backBtn, pressed && s.pressed]}>
          <Text style={s.backTxt}>‹ 章の選択</Text>
        </Pressable>
        <Text style={s.qProgress}>{title}</Text>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 28 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={s.pad}>
          <View style={s.search}>
            <Icon name="search" size={18} color={c.faint} />
            <TextInput
              style={s.searchInput}
              placeholder="用語・よみ・説明で検索"
              placeholderTextColor={c.faint}
              value={q}
              onChangeText={setQ}
            />
          </View>

          {list.length === 0 ? (
            <Text style={[s.radarEmpty, { marginTop: 24 }]}>
              {sel === 'fav' ? '★をつけた用語がここに集まります。' : '該当する用語がありません。'}
            </Text>
          ) : (
            <>
              {list.filter(canSee).map((t) => (
                <TermCard key={t.id} term={t} onBump={onBump} />
              ))}
              {!pro && sel !== 'fav' && list.some((t) => !canSee(t)) ? (
                <ProCut onPaywall={onPaywall} title={`残り${list.filter((t) => !canSee(t)).length}語はProで`} sub={'無料は各章の先頭6語まで。Proでこの章の全用語が読めます。'} />
              ) : null}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function TermCard({ term, onBump }: { term: Term; onBump: () => void }) {
  const { c } = useTheme();
  const s = useStyles();
  const fav = isFavTerm(term.term);
  const figUri = term.figure ? getFigureUri(term.figure) : null;
  const [zoomFig, setZoomFig] = useState(false);
  return (
    <View style={s.termCard}>
      <View style={s.termTop}>
        <View style={{ flex: 1 }}>
          <Text style={s.termWord}>{term.term}</Text>
          {term.reading ? <Text style={s.termReading}>{term.reading}</Text> : null}
        </View>
        <Pressable hitSlop={8} onPress={() => { void toggleFavTerm(term.term).then(onBump); }}>
          <Text style={[s.heart, { color: fav ? c.accent : c.faint }]}>{fav ? '★' : '☆'}</Text>
        </Pressable>
      </View>
      <Text style={s.termDef}>{term.def}</Text>
      {figUri ? <Pressable onPress={() => setZoomFig(true)}><Image source={{ uri: figUri }} style={s.termFig} resizeMode="contain" /></Pressable> : null}
      {zoomFig && figUri ? <ImageZoom uri={figUri} onClose={() => setZoomFig(false)} /> : null}
      {term.related && term.related.length > 0 ? (
        <Text style={s.termRel}>{'関連: ' + term.related.join('、')}</Text>
      ) : null}
    </View>
  );
}

// ---- 模試・成績 ----
// 無料=模試①②、Pro=模試③〜⑧＋弱点復習(買い切りProで解放)。
const FREE_MOCK_COUNT = 1;

// その模試の問題群に対する現在の成績(最新の正誤で集計)。
function mockStat(questions: Question[]) {
  let answered = 0, correct = 0;
  const perCh: Record<string, [number, number]> = {};
  const wrong: Question[] = [];
  for (const q of questions) {
    const r = getRec(q.id);
    if (!r || r.seen === 0) continue;
    answered++;
    const ok = r.lastCorrect ? 1 : 0;
    correct += ok;
    const e = perCh[q.chapter] ?? [0, 0];
    e[0] += ok; e[1] += 1; perCh[q.chapter] = e;
    if (!r.lastCorrect) wrong.push(q);
  }
  const pct = answered > 0 ? Math.round((correct / answered) * 100) : 0;
  return { answered, correct, pct, total: questions.length, perCh, wrong };
}

// ---- 成績を確認する(クレーン同等の結果画面) ----
function MockResult({ set, onBack, onBump }: { set: QuizSet; onBack: () => void; onBump: () => void }) {
  const { c } = useTheme();
  const s = useStyles();
  const [detail, setDetail] = useState<Question | null>(null);
  const qs = useMemo(() => getQuestions(set.file), [set.file]);
  const st = mockStat(qs);
  if (detail) return <QuestionDetail question={detail} onBack={() => setDetail(null)} onBump={onBump} />;
  const pass = st.pct >= 60;
  const chapters = Object.keys(st.perCh).sort();
  const weak = chapters
    .map((ch) => { const [cc, aa] = st.perCh[ch]; return { ch, p: aa ? Math.round((cc / aa) * 100) : 0 }; })
    .filter((x) => x.p < 70)
    .sort((a, b) => a.p - b.p);
  return (
    <View style={{ flex: 1 }}>
      <View style={s.readerBar}>
        <Pressable onPress={onBack} hitSlop={10} style={({ pressed }) => [s.backBtn, pressed && s.pressed]}><Text style={s.backTxt}>‹ 模試一覧</Text></Pressable>
        <Text style={s.qProgress} numberOfLines={1}>{set.title} 成績</Text>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={[s.pad, { paddingBottom: 40 }]} showsVerticalScrollIndicator={false}>
        {st.answered === 0 ? (
          <View style={s.soon}><Text style={s.soonBig}>未受験</Text><Text style={s.soonTxt}>この模試はまだ解いていません。「試験を始める」から挑戦しましょう。</Text></View>
        ) : (
          <>
            <View style={s.resultHero}>
              <Ring pct={st.pct} label="得点率" />
              <Text style={[s.verdict, pass ? s.vOk : s.vNg, { marginTop: 10, textAlign: 'center' }]}>
                {pass ? '合格ライン(60%)を超えています。順調です！' : '合格ラインまであと少し。弱点を復習しましょう。'}
              </Text>
            </View>
            <View style={s.statRow}>
              <View style={s.statCell}><Text style={s.statCellV}>{st.correct}/{st.answered}</Text><Text style={s.statCellK}>正答数</Text></View>
              <View style={s.statCell}><Text style={[s.statCellV, { color: c.accent }]}>{st.pct}%</Text><Text style={s.statCellK}>得点率</Text></View>
              <View style={s.statCell}><Text style={s.statCellV}>{st.total - st.answered}</Text><Text style={s.statCellK}>未解答</Text></View>
            </View>
            <Text style={s.sectionHead}>分野別の正答率</Text>
            <View style={s.barBox}>
              {chapters.map((ch) => {
                const [cc, aa] = st.perCh[ch];
                const p = aa ? Math.round((cc / aa) * 100) : 0;
                return (
                  <View key={ch} style={s.barRow}>
                    <Text style={s.barLabel}>{CHAPTER_SHORT[ch]}</Text>
                    <View style={s.barTrack}><View style={[s.barFill, { width: `${p}%` as `${number}%`, backgroundColor: p >= 60 ? c.good : c.accent }]} /></View>
                    <Text style={s.barPct}>{p}%</Text>
                  </View>
                );
              })}
            </View>
            {weak.length ? (
              <>
                <Text style={s.sectionHead}>弱点分析</Text>
                <View style={{ gap: 10 }}>
                  {weak.map((w) => (
                    <View key={w.ch} style={s.weakCard}>
                      <View style={[s.mockPill, s.mockPillWarn]}><Text style={[s.mockPillTxt, s.mockPillWarnTxt]}>{CHAPTER_SHORT[w.ch]}</Text></View>
                      <Text style={s.weakTxt}>{'正答率 ' + w.p + '%。この分野を重点的に復習しましょう。'}</Text>
                    </View>
                  ))}
                </View>
              </>
            ) : null}
            {st.wrong.length ? (
              <>
                <Text style={s.sectionHead}>{'間違えた問題（' + st.wrong.length + '問）'}</Text>
                <View style={{ gap: 10 }}>
                  {st.wrong.map((q) => (
                    <Pressable key={q.id} onPress={() => setDetail(q)} style={({ pressed }) => [s.wrongCard, pressed && s.pressed]}>
                      <View style={[s.mockPill, s.mockPillWarn, { alignSelf: 'flex-start' }]}><Text style={[s.mockPillTxt, s.mockPillWarnTxt]}>要復習</Text></View>
                      <Text style={s.wrongStem} numberOfLines={2}>{q.stem}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}
            <Pressable onPress={onBack} style={({ pressed }) => [s.submitBtn, { marginTop: 20 }, pressed && s.pressed]}><Text style={s.submitTxt}>完了</Text></Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function MockScoreScreen({ onBump, pro, onPaywall }: { onBump: () => void; pro: boolean; onPaywall: () => void }) {
  const [session, setSession] = useState<{ title: string; questions: Question[] } | null>(null);
  const [resultSet, setResultSet] = useState<QuizSet | null>(null);
  const { c } = useTheme();
  const s = useStyles();

  if (session) {
    return <QuizPlayer title={session.title} questions={session.questions} onExit={() => { setSession(null); onBump(); }} onBump={onBump} />;
  }
  if (resultSet) {
    return <MockResult set={resultSet} onBack={() => { setResultSet(null); onBump(); }} onBump={onBump} />;
  }

  const sets = getQuizSets();
  const all = getAllQuestions();
  const { weak } = selectReview(all.map((qq) => qq.id));
  const stats = overallStats();

  const startSet = (set: QuizSet, locked: boolean) => {
    if (locked) { onPaywall(); return; }
    setSession({ title: set.title, questions: getQuestions(set.file) });
  };
  const startReview = () => {
    if (!pro) { onPaywall(); return; }
    const { weak: w, unseen } = selectReview(all.map((qq) => qq.id));
    const order = [...w, ...unseen];
    const byId: Record<string, Question> = {};
    for (const qq of all) byId[qq.id] = qq;
    setSession({ title: '弱点復習', questions: order.map((id) => byId[id]).filter(Boolean) });
  };

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
      <View style={s.pad}>
        <View style={s.viewHead}>
          <Text style={s.eyebrow}>PRACTICE & SCORE</Text>
          <Text style={s.viewH2}>模試・成績</Text>
          <Text style={s.viewSub}>本番形式で解いて、分野ごとの実力と弱点をチェック。</Text>
        </View>

        {/* 成績サマリ */}
        <View style={s.scoreTop}>
          <Ring pct={stats.accuracy} label="正答率" />
          <View style={s.statNums}>
            <View style={s.stat}>
              <Text style={s.statLbl}>解いた問題</Text>
              <Text style={s.statNum}>{stats.answered}<Text style={s.statUnit}> 問</Text></Text>
            </View>
            <View style={s.vdiv} />
            <View style={s.stat}>
              <Text style={s.statLbl}>正解</Text>
              <Text style={s.statNum}>{stats.correct}<Text style={s.statUnit}> 問</Text></Text>
            </View>
          </View>
        </View>

        {/* Proアップグレード導線(未購入時のみ) */}
        {!pro ? (
          <Pressable onPress={onPaywall} style={({ pressed }) => [s.upgradeCard, pressed && s.pressed]}>
            <View style={s.upgradeIcon}><Icon name="flame" size={20} color={c.accent} /></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.upgradeTitle}>Proですべての機能を解放</Text>
              <Text style={s.upgradeSub}>②以降の模試・弱点復習・教材の全レッスン・全用語・相関図</Text>
            </View>
            <Text style={s.chGo}>›</Text>
          </Pressable>
        ) : null}

        {/* 弱点復習 */}
        <Pressable
          disabled={pro && weak.length === 0}
          onPress={startReview}
          style={({ pressed }) => [s.reviewBtn, pro && weak.length === 0 && s.btnDisabled, pressed && s.pressed]}
        >
          <View style={s.reviewBtnHead}>
            <Text style={s.reviewBtnTitle}>弱点復習</Text>
            {!pro ? <View style={s.proPill}><Text style={s.proPillTxt}>Pro</Text></View> : null}
          </View>
          <Text style={s.reviewBtnSub}>
            {!pro ? 'Proで解放 ・ 誤答や自信なしを集中復習' : (weak.length > 0 ? `要復習 ${weak.length} 問` : '誤答・自信なしが貯まると出題されます')}
          </Text>
        </Pressable>

        <Text style={s.sectionHead}>問題セット</Text>
        {!pro ? <Text style={s.mockHint}>模試①は無料。②以降はProで解放できます。</Text> : null}
        <View style={{ gap: 12 }}>
          {sets.map((set, i) => {
            const locked = i >= FREE_MOCK_COUNT && !pro;
            const st = mockStat(getQuestions(set.file));
            const taken = st.answered > 0;
            return (
              <View key={set.id} style={[s.mockCard, locked && s.chLocked]}>
                <View style={s.mockHead}>
                  <View style={s.mockNo}><Text style={s.mockNoNum}>{i + 1}</Text><Text style={s.mockNoUnit}>回</Text></View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.mockTitle} numberOfLines={1}>{set.title}</Text>
                    <Text style={s.mockMeta}>{'全' + st.total + '問 ・ 本番形式'}</Text>
                    <View style={s.mockPillRow}>
                      {locked ? (
                        <View style={[s.mockPill, s.mockPillPro]}><Text style={[s.mockPillTxt, s.mockPillProTxt]}>PROで解放</Text></View>
                      ) : taken ? (
                        <View style={[s.mockPill, st.pct >= 60 ? s.mockPillPass : s.mockPillWarn]}><Text style={[s.mockPillTxt, st.pct >= 60 ? s.mockPillPassTxt : s.mockPillWarnTxt]}>{'受験済 ' + st.pct + '点'}</Text></View>
                      ) : (
                        <View style={[s.mockPill, s.mockPillNew]}><Text style={[s.mockPillTxt, s.mockPillNewTxt]}>未受験</Text></View>
                      )}
                    </View>
                  </View>
                </View>
                <View style={s.mockBtns}>
                  <Pressable onPress={() => startSet(set, locked)} style={({ pressed }) => [s.mockStart, pressed && s.pressed]}>
                    <Text style={s.mockStartTxt}>{locked ? '🔒 試験を始める' : '試験を始める'}</Text>
                  </Pressable>
                  <Pressable disabled={!taken} onPress={() => setResultSet(set)} style={({ pressed }) => [s.mockReview, !taken && s.mockReviewOff, pressed && s.pressed]}>
                    <Text style={[s.mockReviewTxt, !taken && s.mockReviewTxtOff]}>成績を確認する</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

function QuizPlayer({ title, questions, onExit, onBump }: { title: string; questions: Question[]; onExit: () => void; onBump: () => void }) {
  const { c } = useTheme();
  const s = useStyles();
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [lowConf, setLowConf] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [finished, setFinished] = useState(false);

  if (questions.length === 0) {
    return (
      <View style={{ flex: 1 }}>
        <View style={s.readerBar}>
          <Pressable onPress={onExit} hitSlop={10} style={({ pressed }) => [s.backBtn, pressed && s.pressed]}>
            <Text style={s.backTxt}>‹ 一覧へ</Text>
          </Pressable>
        </View>
        <View style={s.soon}><Text style={s.soonBig}>対象なし</Text><Text style={s.soonTxt}>いま出題できる問題がありません。</Text></View>
      </View>
    );
  }

  const reset = () => { setIdx(0); setSelected(null); setRevealed(false); setLowConf(false); setCorrectCount(0); setFinished(false); };

  if (finished) {
    const pct = Math.round((correctCount / questions.length) * 100);
    return (
      <View style={{ flex: 1 }}>
        <View style={s.readerBar}>
          <Pressable onPress={onExit} hitSlop={10} style={({ pressed }) => [s.backBtn, pressed && s.pressed]}>
            <Text style={s.backTxt}>‹ 一覧へ</Text>
          </Pressable>
        </View>
        <View style={s.soon}>
          <Text style={s.soonTitle}>おつかれさまでした</Text>
          <Text style={s.resultBig}>{correctCount} / {questions.length} 問正解</Text>
          <Text style={s.soonTxt}>正答率 {pct}%</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
            <Pressable onPress={reset} style={({ pressed }) => [s.ghostBtn, pressed && s.pressed]}><Text style={s.ghostBtnTxt}>もう一度</Text></Pressable>
            <Pressable onPress={onExit} style={({ pressed }) => [s.submitBtn, { paddingHorizontal: 22 }, pressed && s.pressed]}><Text style={s.submitTxt}>終了</Text></Pressable>
          </View>
        </View>
      </View>
    );
  }

  const q = questions[idx];
  const isLast = idx === questions.length - 1;
  const marked = isBookmarked(q.id);

  const submit = () => {
    if (selected === null) return;
    const ok = selected === q.answer;
    if (ok) setCorrectCount((x) => x + 1);
    void recordAnswer(q.id, ok, lowConf).then(() => bumpDaily()).then(() => recordSnapshotIfNeeded()).then(onBump);
    setRevealed(true);
  };
  const next = () => {
    if (isLast) { setFinished(true); return; }
    setIdx((i) => i + 1); setSelected(null); setRevealed(false); setLowConf(false);
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={s.readerBar}>
        <Pressable onPress={onExit} hitSlop={10} style={({ pressed }) => [s.backBtn, pressed && s.pressed]}>
          <Text style={s.backTxt}>‹ 一覧へ</Text>
        </Pressable>
        <Text style={s.qProgress}>{title}　{idx + 1} / {questions.length}</Text>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={[s.pad, { paddingBottom: 40, paddingTop: 8 }]} showsVerticalScrollIndicator={false}>
        {q.topic ? <Text style={s.qTopic}>{q.topic}</Text> : null}
        <Text style={s.qStem}>{q.stem}</Text>
        <View style={{ gap: 9, marginTop: 14 }}>
          {q.choices.map((ch, i) => {
            const chosen = selected === i;
            const isCorrect = i === q.answer;
            const st = [
              s.choice,
              revealed && isCorrect ? s.choiceCorrect : null,
              revealed && !isCorrect && chosen ? s.choiceWrong : null,
              !revealed && chosen ? s.choiceSel : null,
            ];
            return (
              <Pressable key={i} disabled={revealed} onPress={() => setSelected(i)} style={st}>
                <Text style={s.choiceNum}>{QLABEL[i]}</Text>
                <Text style={s.choiceTxt}>{ch}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* ブックマーク */}
        <Pressable
          onPress={() => { void toggleBookmark(q.id).then(onBump); }}
          style={[s.bmBtn, marked && s.bmBtnOn]}
        >
          <Icon name="bookmark" size={15} color={marked ? c.accent : c.muted} />
          <Text style={[s.bmBtnTxt, marked && s.bmBtnTxtOn]}>{marked ? 'ブックマーク済み' : 'ブックマーク'}</Text>
        </Pressable>

        {!revealed ? (
          <>
            <Pressable onPress={() => setLowConf((v) => !v)} style={({ pressed }) => [s.confToggle, lowConf && s.confOn, pressed && s.pressed]}>
              <Text style={[s.confTxt, lowConf && s.confTxtOn]}>{(lowConf ? '☑ ' : '☐ ') + '自信なし（復習に回す）'}</Text>
            </Pressable>
            <Pressable disabled={selected === null} onPress={submit} style={({ pressed }) => [s.submitBtn, selected === null && s.btnDisabled, pressed && s.pressed]}>
              <Text style={s.submitTxt}>解答する</Text>
            </Pressable>
          </>
        ) : (
          <View style={s.explainBox}>
            <Text style={[s.verdict, selected === q.answer ? s.vOk : s.vNg]}>
              {selected === q.answer ? '◯ 正解' : '✕ 不正解'}（正解：{QLABEL[q.answer]}）
            </Text>
            {q.explain ? <Text style={s.explainTxt}>{q.explain}</Text> : null}
            {selected !== null && selected !== q.answer && q.whyWrong && q.whyWrong[selected]
              ? <Text style={s.whyWrong}>{'あなたの選択（' + QLABEL[selected] + '）：' + q.whyWrong[selected]}</Text>
              : null}
            <Pressable onPress={next} style={({ pressed }) => [s.submitBtn, { marginTop: 14 }, pressed && s.pressed]}>
              <Text style={s.submitTxt}>{isLast ? '結果を見る' : '次の問題 ›'}</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ---- 設定 ----
function SettingsScreen({ onModal, onSync, syncing, pro }: { onModal: (m: ModalKey) => void; onSync: () => void; syncing: boolean; pro: boolean }) {
  const { c, mode, setMode } = useTheme();
  const s = useStyles();
  const dateText = examDateText();
  const [restoring, setRestoring] = useState(false);
  const [showDev, setShowDev] = useState(isFreePreviewEnabled());
  const [freePreview, setFreePreview] = useState(isFreePreviewEnabled());
  const doRestore = async () => {
    if (restoring) return;
    setRestoring(true);
    try {
      const ok = await restorePro();
      Alert.alert(ok ? '復元しました' : '購入が見つかりません', ok ? 'Proが有効になりました。' : '復元できる購入がありませんでした。');
    } catch {
      Alert.alert('復元できませんでした', '時間をおいて、もう一度お試しください。');
    } finally { setRestoring(false); }
  };
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
      <View style={s.pad}>
        <View style={s.viewHead}>
          <Text style={s.eyebrow}>SETTINGS</Text>
          <Text style={s.viewH2}>設定</Text>
        </View>

        <View style={s.setGroup}>
          <Text style={s.setGroupTitle}>Pro</Text>
          {pro ? (
            <View style={s.setRow}>
              <Text style={s.setLabel}>ステータス</Text>
              <Text style={[s.setValue, { color: c.good }]}>購入済み</Text>
            </View>
          ) : (
            <Pressable style={({ pressed }) => [s.setRow, pressed && s.pressed]} onPress={() => onModal('paywall')}>
              <Text style={s.setLabel}>Proにアップグレード</Text>
              <Text style={[s.setValue, { color: c.accent }]}>全機能を解放 ›</Text>
            </Pressable>
          )}
          <Pressable disabled={restoring || freePreview} style={({ pressed }) => [s.setRow, pressed && s.pressed, (restoring || freePreview) && s.btnDisabled]} onPress={doRestore}>
            <Text style={s.setLabel}>購入を復元</Text>
            <Text style={s.setValue}>{restoring ? '復元中…' : '実行 ›'}</Text>
          </Pressable>
        </View>

        <View style={s.setGroup}>
          <Text style={s.setGroupTitle}>表示</Text>
          <View style={[s.setRow, { flexDirection: 'column', alignItems: 'stretch', gap: 12 }]}>
            <Text style={s.setLabel}>外観</Text>
            <Segmented<Mode>
              options={[{ key: 'system', label: 'システム' }, { key: 'light', label: 'ライト' }, { key: 'dark', label: 'ダーク' }]}
              value={mode}
              onChange={setMode}
            />
          </View>
        </View>

        <View style={s.setGroup}>
          <Text style={s.setGroupTitle}>学習</Text>
          <Pressable style={({ pressed }) => [s.setRow, pressed && s.pressed]} onPress={() => onModal('examdate')}>
            <Text style={s.setLabel}>試験日</Text>
            <Text style={s.setValue}>{dateText ?? '未設定 ›'}</Text>
          </Pressable>
          <Pressable style={({ pressed }) => [s.setRow, pressed && s.pressed]} onPress={() => onModal('guide')}>
            <Text style={s.setLabel}>試験の総合解説</Text>
            <Text style={s.setValue}>見る ›</Text>
          </Pressable>
        </View>

        <View style={s.setGroup}>
          <Text style={s.setGroupTitle}>データ</Text>
          <Pressable disabled={syncing} style={({ pressed }) => [s.setRow, pressed && s.pressed, syncing && s.btnDisabled]} onPress={onSync}>
            <Text style={s.setLabel}>教材・問題を更新</Text>
            <Text style={s.setValue}>{syncing ? '更新中…' : '今すぐ確認 ›'}</Text>
          </Pressable>
        </View>

        <View style={s.setGroup}>
          <Text style={s.setGroupTitle}>アプリについて</Text>
          <Pressable style={s.setRow} delayLongPress={1500} onLongPress={() => { if (canUseFreePreview()) setShowDev(true); }}>
            <Text style={s.setLabel}>バージョン</Text>
            <Text style={s.setValue}>Build {BUILD_NUMBER}</Text>
          </Pressable>
        </View>
        {showDev && canUseFreePreview() ? <View style={s.setGroup}>
          <Text style={s.setGroupTitle}>開発用（テスト購入）</Text>
          <View style={s.setRow}>
            <Text style={s.setLabel}>無料ユーザーとして確認</Text>
            <Switch accessibilityLabel="無料ユーザーとして確認" value={freePreview} onValueChange={value => {
              setFreePreviewEnabled(value);
              setFreePreview(isFreePreviewEnabled());
            }} />
          </View>
          <Text style={[s.radarEmpty, { marginTop: 8 }]}>購入履歴を残したまま、無料版の表示と制限を確認します。オフにするかアプリを完全に終了すると、本来の購入状態に戻ります。購入ボタンからテスト購入に進めます。購入成功時は無料確認を解除します。</Text>
        </View> : null}
      </View>
    </ScrollView>
  );
}

// ---- モーダル: ブックマーク一覧 ----
function BookmarksScreen({ onClose, onBump }: { onClose: () => void; onBump: () => void }) {
  const s = useStyles();
  const [detail, setDetail] = useState<Question | null>(null);
  const all = getAllQuestions();
  const ids = new Set(bookmarkedIds());
  const list = all.filter((q) => ids.has(q.id));

  if (detail) return <QuestionDetail question={detail} onBack={() => setDetail(null)} onBump={onBump} />;

  return (
    <View style={{ flex: 1 }}>
      <View style={s.modalBar}>
        <Pressable onPress={onClose} hitSlop={10} style={({ pressed }) => [s.backBtn, pressed && s.pressed]}><Text style={s.backTxt}>‹ 閉じる</Text></Pressable>
        <Text style={s.modalTitle}>ブックマーク</Text>
        <View style={{ width: 56 }} />
      </View>
      {list.length === 0 ? (
        <View style={s.soon}><Text style={s.soonBig}>まだありません</Text><Text style={s.soonTxt}>問題を解くときに「ブックマーク」を押すと、ここに集まります。</Text></View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={[s.pad, { paddingTop: 12, paddingBottom: 28, gap: 10 }]} showsVerticalScrollIndicator={false}>
          {list.map((q) => (
            <Pressable key={q.id} style={({ pressed }) => [s.ch, pressed && s.pressed]} onPress={() => setDetail(q)}>
              <View style={s.chNo}><Text style={s.chNoTxt}>{q.chapter}</Text></View>
              <View style={{ flex: 1, minWidth: 0 }}>
                {q.topic ? <Text style={s.chSub}>{q.topic}</Text> : null}
                <Text style={s.chTitle} numberOfLines={2}>{q.stem}</Text>
              </View>
              <Text style={s.chGo}>›</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function QuestionDetail({ question: q, onBack, onBump }: { question: Question; onBack: () => void; onBump: () => void }) {
  const { c } = useTheme();
  const s = useStyles();
  const marked = isBookmarked(q.id);
  const [, setTick] = useState(0);
  return (
    <View style={{ flex: 1 }}>
      <View style={s.modalBar}>
        <Pressable onPress={onBack} hitSlop={10} style={({ pressed }) => [s.backBtn, pressed && s.pressed]}><Text style={s.backTxt}>‹ 戻る</Text></Pressable>
        <Text style={s.modalTitle}>問題</Text>
        <View style={{ width: 56 }} />
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={[s.pad, { paddingTop: 10, paddingBottom: 40 }]} showsVerticalScrollIndicator={false}>
        {q.topic ? <Text style={s.qTopic}>{q.topic}</Text> : null}
        <Text style={s.qStem}>{q.stem}</Text>
        <View style={{ gap: 9, marginTop: 14 }}>
          {q.choices.map((ch, i) => (
            <View key={i} style={[s.choice, i === q.answer && s.choiceCorrect]}>
              <Text style={s.choiceNum}>{QLABEL[i]}</Text>
              <Text style={s.choiceTxt}>{ch}</Text>
            </View>
          ))}
        </View>
        <View style={s.explainBox}>
          <Text style={[s.verdict, s.vOk]}>正解：{QLABEL[q.answer]}</Text>
          {q.explain ? <Text style={s.explainTxt}>{q.explain}</Text> : null}
        </View>
        <Pressable
          onPress={() => { void toggleBookmark(q.id).then(() => { setTick((t) => t + 1); onBump(); }); }}
          style={[s.bmBtn, marked && s.bmBtnOn]}
        >
          <Icon name="bookmark" size={15} color={marked ? c.accent : c.muted} />
          <Text style={[s.bmBtnTxt, marked && s.bmBtnTxtOn]}>{marked ? 'ブックマーク解除' : 'ブックマーク'}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

// ---- モーダル: 相関図(章ごとの相関図を表示・タップで全画面ズーム) ----
function RelationMapScreen({ onClose, pro, onPaywall }: { onClose: () => void; pro: boolean; onPaywall: () => void }) {
  const { resolved } = useTheme();
  const s = useStyles();
  const { width, height } = useWindowDimensions();
  const [ch, setCh] = useState<string>('1');
  const [zoom, setZoom] = useState(false);

  const chapters = ['1', '2', '3', '4', '5', '6'];
  const AR = 3400 / 2200; // SVGの viewBox 比(横/縦)
  const svg = useMemo(() => {
    const m = RELATION_MAPS[ch];
    return m ? (resolved === 'light' ? m.light : m.dark) : '';
  }, [ch, resolved]);

  const thumbW = Math.min(width - 32, 520);
  const thumbH = Math.round(thumbW / AR);
  const fullW = Math.min(width, 440);
  const fullH = Math.round(fullW / AR);

  return (
    <View style={{ flex: 1 }}>
      <View style={s.modalBar}>
        <Pressable onPress={onClose} hitSlop={10} style={({ pressed }) => [s.backBtn, pressed && s.pressed]}><Text style={s.backTxt}>‹ 閉じる</Text></Pressable>
        <Text style={s.modalTitle}>相関図</Text>
        <View style={{ width: 56 }} />
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={[s.pad, { paddingBottom: 40 }]} showsVerticalScrollIndicator={false}>
        <View style={{ marginTop: 12 }}>
          <Segmented options={chapters.map((k) => ({ key: k, label: CHAPTER_SHORT[k] }))} value={ch} onChange={setCh} />
        </View>
        <Text style={[s.cardTitle, { marginTop: 16 }]}>{'第' + ch + '章 ' + CHAPTER_SHORT[ch]}</Text>
        <Text style={s.relHint}>6つのテーマから、役割としくみを整理した図です。図をタップすると全画面で拡大できます。</Text>
        {(!pro && !['1', '2', '3'].includes(ch)) ? (
          <ProCut onPaywall={onPaywall} title="この章の相関図はProで" sub={'無料は第1〜3章。Proで全6章の相関図が見られます。'} />
        ) : (
          <Pressable onPress={() => setZoom(true)} style={({ pressed }) => [s.relThumb, { width: thumbW, height: thumbH }, pressed && s.pressed]}>
            {svg ? <SvgXml xml={svg} width={thumbW} height={thumbH} /> : null}
            <View style={s.relZoomHint}><Text style={s.relZoomHintTxt}>タップで拡大</Text></View>
          </Pressable>
        )}
      </ScrollView>
      {zoom ? (
        <View style={s.relFull}>
          <View style={s.relFullBar}>
            <Text style={s.relFullHint}>ピンチで拡大・指でスクロール</Text>
            <Pressable onPress={() => setZoom(false)} hitSlop={12} style={({ pressed }) => [pressed && s.pressed]}><Text style={s.relFullClose}>✕ 閉じる</Text></Pressable>
          </View>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ alignItems: 'center', justifyContent: 'center', minHeight: height - 120, minWidth: fullW }}
            maximumZoomScale={5}
            minimumZoomScale={1}
            centerContent
            bouncesZoom
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
          >
            {svg ? <SvgXml xml={svg} width={fullW} height={fullH} /> : null}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

// ---- モーダル: 試験総合解説 ----
function ExamGuideScreen({ onClose }: { onClose: () => void }) {
  const { resolved } = useTheme();
  const s = useStyles();
  const img = resolved === 'light' ? require('./assets/examguide-light.png') : require('./assets/examguide-dark.png');
  const Stat = ({ k, v }: { k: string; v: string }) => (
    <View style={s.guideStat}><Text style={s.guideStatK}>{k}</Text><Text style={s.guideStatV}>{v}</Text></View>
  );
  return (
    <View style={{ flex: 1 }}>
      <View style={s.modalBar}>
        <Pressable onPress={onClose} hitSlop={10} style={({ pressed }) => [s.backBtn, pressed && s.pressed]}><Text style={s.backTxt}>‹ 閉じる</Text></Pressable>
        <Text style={s.modalTitle}>試験の総合解説</Text>
        <View style={{ width: 56 }} />
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <View style={{ borderRadius: 0, overflow: 'hidden' }}>
          <Image source={img} style={{ width: '100%', height: 170 }} resizeMode="cover" />
        </View>
        <View style={s.pad}>
          <Text style={s.guideH}>消防設備士 乙種第6類とは</Text>
          <Text style={s.guideBody}>消火器の整備・点検を行うための国家資格です。乙種は受験資格の制限がなく、誰でも受験できます。</Text>

          <Text style={s.guideH}>出題のしくみ</Text>
          <Stat k="筆記（合計）" v="30 問" />
          <Stat k="　消防関係法令（共通）" v="6 問" />
          <Stat k="　消防関係法令（第6類）" v="4 問" />
          <Stat k="　基礎的知識（機械）" v="5 問" />
          <Stat k="　構造・機能・整備（機械）" v="9 問" />
          <Stat k="　構造・機能・整備（規格）" v="6 問" />
          <Stat k="実技（鑑別等）" v="5 問" />
          <Stat k="試験時間" v="1時間45分" />

          <Text style={s.guideH}>形式と合格基準</Text>
          <Text style={s.guideLi}>・筆記：四肢択一のマークシート</Text>
          <Text style={s.guideLi}>・実技：写真・イラスト・図面等による記述式</Text>
          <Text style={s.guideLi}>・合格基準：筆記は各科目40%以上かつ全体60%以上、さらに実技60%以上</Text>

          <Text style={s.guideH}>合格への学び方</Text>
          <Text style={s.guideLi}>① 教材で各章の基礎を読む</Text>
          <Text style={s.guideLi}>② 用語集で重要用語を固める</Text>
          <Text style={s.guideLi}>③ 模試で本番形式に慣れる</Text>
          <Text style={s.guideLi}>④ 弱点復習で間違いを潰す</Text>

          <Text style={s.guideLink}>出典：消防試験研究センター（www.shoubo-shiken.or.jp）</Text>
        </View>
      </ScrollView>
    </View>
  );
}

// ---- モーダル: 試験日の設定 ----
function Stepper({ label, value, onDec, onInc }: { label: string; value: string; onDec: () => void; onInc: () => void }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 6 }}>
      <Text style={{ color: c.fg, fontSize: 15, fontWeight: '700' }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Pressable hitSlop={10} onPress={onDec} style={{ width: 40, height: 40, borderRadius: 10, borderWidth: 1, borderColor: c.line, backgroundColor: c.card2, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: c.fg, fontSize: 22, fontWeight: '900' }}>−</Text></Pressable>
        <Text style={{ color: c.fg, fontSize: 18, fontWeight: '900', minWidth: 54, textAlign: 'center' }}>{value}</Text>
        <Pressable hitSlop={10} onPress={onInc} style={{ width: 40, height: 40, borderRadius: 10, borderWidth: 1, borderColor: c.line, backgroundColor: c.card2, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: c.fg, fontSize: 22, fontWeight: '900' }}>＋</Text></Pressable>
      </View>
    </View>
  );
}

function ExamDateScreen({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const s = useStyles();
  const init = getExamDate();
  const now = new Date();
  const [y, setY] = useState(init ? +init.split('-')[0] : now.getFullYear());
  const [m, setM] = useState(init ? +init.split('-')[1] : now.getMonth() + 1);
  const [d, setD] = useState(init ? +init.split('-')[2] : now.getDate());

  const daysInMonth = new Date(y, m, 0).getDate();
  const dd = Math.min(d, daysInMonth);

  const save = () => { void setExamDate(`${y}-${pad2(m)}-${pad2(dd)}`).then(() => { onSaved(); onClose(); }); };
  const clear = () => { void setExamDate(null).then(() => { onSaved(); onClose(); }); };

  return (
    <View style={{ flex: 1 }}>
      <View style={s.modalBar}>
        <Pressable onPress={onClose} hitSlop={10} style={({ pressed }) => [s.backBtn, pressed && s.pressed]}><Text style={s.backTxt}>‹ 閉じる</Text></Pressable>
        <Text style={s.modalTitle}>試験日の設定</Text>
        <View style={{ width: 56 }} />
      </View>
      <View style={[s.pad, { paddingTop: 18 }]}>
        <View style={s.card}>
          <Stepper label="年" value={`${y}`} onDec={() => setY((v) => Math.max(now.getFullYear() - 1, v - 1))} onInc={() => setY((v) => Math.min(now.getFullYear() + 3, v + 1))} />
          <Stepper label="月" value={`${m}`} onDec={() => setM((v) => (v <= 1 ? 12 : v - 1))} onInc={() => setM((v) => (v >= 12 ? 1 : v + 1))} />
          <Stepper label="日" value={`${dd}`} onDec={() => setD(() => (dd <= 1 ? daysInMonth : dd - 1))} onInc={() => setD(() => (dd >= daysInMonth ? 1 : dd + 1))} />
        </View>
        <Pressable onPress={save} style={({ pressed }) => [s.submitBtn, pressed && s.pressed]}><Text style={s.submitTxt}>{`${y}年${m}月${dd}日 を試験日にする`}</Text></Pressable>
        <Pressable onPress={clear} style={({ pressed }) => [s.ghostBtn, { marginTop: 10 }, pressed && s.pressed]}><Text style={s.ghostBtnTxt}>試験日をクリア</Text></Pressable>
      </View>
    </View>
  );
}

// ---- モーダル: Pro(買い切り)ペイウォール ----
function PaywallScreen({ onClose, onBump }: { onClose: () => void; onBump: () => void }) {
  const { c } = useTheme();
  const s = useStyles();
  const [pkg, setPkg] = useState<PurchasesPackage | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    void getProPackage().then((p) => { if (alive) { setPkg(p); setLoading(false); } });
    return () => { alive = false; };
  }, []);

  const price = pkg?.product?.priceString ?? '';

  const buy = async () => {
    if (!pkg || busy) return;
    setBusy(true);
    try {
      const ok = await purchasePro(pkg);
      if (ok) { onBump(); Alert.alert('ありがとうございます', 'Proが有効になりました。すべての機能が使えます。'); onClose(); }
    } catch {
      Alert.alert('購入できませんでした', '時間をおいて、もう一度お試しください。');
    } finally { setBusy(false); }
  };
  const restore = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const ok = await restorePro();
      if (ok) { onBump(); Alert.alert('復元しました', 'Proが有効になりました。'); onClose(); }
      else Alert.alert('購入が見つかりません', '復元できる購入がありませんでした。');
    } catch {
      Alert.alert('復元できませんでした', '時間をおいて、もう一度お試しください。');
    } finally { setBusy(false); }
  };

  const features = [
    '模試②以降をすべて解放(本番形式 全12回)',
    '教材の全レッスン・用語集の全用語・全章の相関図を解放',
    '弱点復習で、誤答や自信なしを集中特訓',
    '買い切り・1回のお支払いでずっと使える',
  ];

  return (
    <View style={{ flex: 1 }}>
      <View style={s.modalBar}>
        <Pressable onPress={onClose} hitSlop={10} style={({ pressed }) => [s.backBtn, pressed && s.pressed]}><Text style={s.backTxt}>‹ 閉じる</Text></Pressable>
        <Text style={s.modalTitle}>Pro</Text>
        <View style={{ width: 56 }} />
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={[s.pad, { paddingBottom: 40 }]} showsVerticalScrollIndicator={false}>
        <View style={s.payHero}>
          <View style={s.payHeroIcon}><Icon name="flame" size={30} color={c.accent} /></View>
          <Text style={s.payTitle}>Proにアップグレード</Text>
          <Text style={s.paySub}>模試・教材・用語・相関図・弱点復習まで、全機能を解放して合格へ。</Text>
        </View>

        <View style={s.payCard}>
          {features.map((f, i) => (
            <View key={i} style={s.payLi}>
              <Text style={s.payCheck}>✓</Text>
              <Text style={s.payLiTxt}>{f}</Text>
            </View>
          ))}
        </View>

        {loading ? (
          <View style={{ paddingVertical: 24, alignItems: 'center' }}><ActivityIndicator color={c.accent} /></View>
        ) : pkg ? (
          <Pressable onPress={buy} disabled={busy} style={({ pressed }) => [s.payBuy, busy && s.btnDisabled, pressed && s.pressed]}>
            {busy ? <ActivityIndicator color="#fff" /> : (
              <Text style={s.payBuyTxt}>{price ? `${price} で購入（買い切り）` : 'Proを購入（買い切り）'}</Text>
            )}
          </Pressable>
        ) : (
          <Text style={[s.radarEmpty, { marginTop: 16 }]}>いま商品を読み込めませんでした。通信環境を確認して、もう一度お試しください。</Text>
        )}

        <Pressable onPress={restore} disabled={busy} style={({ pressed }) => [s.payRestore, pressed && s.pressed]}>
          <Text style={s.payRestoreTxt}>購入を復元</Text>
        </Pressable>

        <Text style={s.payNote}>お支払いは App Store を通じて行われます。買い切り（非消耗型）のため自動更新はありません。同じ Apple ID なら「購入を復元」で再び有効にできます。</Text>
      </ScrollView>
    </View>
  );
}

// ---- タブバー ----
function TabBar({ tab, onTab, insetBottom }: { tab: TabKey; onTab: (t: TabKey) => void; insetBottom: number }) {
  const { c } = useTheme();
  const s = useStyles();
  const items: { key: TabKey; icon: string; label: string }[] = [
    { key: 'home', icon: 'home', label: 'ホーム' },
    { key: 'learn', icon: 'book', label: '教材' },
    { key: 'terms', icon: 'terms', label: '用語' },
    { key: 'mock', icon: 'doc', label: '模試・成績' },
    { key: 'set', icon: 'gear', label: '設定' },
  ];
  return (
    <View style={[s.tabbar, { paddingBottom: insetBottom || 6 }]}>
      {items.map((it) => {
        const active = it.key === tab;
        return (
          <Pressable key={it.key} style={s.tab} onPress={() => onTab(it.key)}>
            {active ? <View style={s.tabDot} /> : null}
            <Icon name={it.icon} size={22} color={active ? c.accent : c.faint} />
            <Text style={[s.tabLabel, { color: active ? c.accent : c.faint }]}>{it.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Main() {
  const { c, resolved } = useTheme();
  const s = useStyles();
  const insets = useSafeAreaInsets();
  const [contentVersion, setContentVersion] = useState(0);
  const [dataVersion, setDataVersion] = useState(0);
  const [tab, setTab] = useState<TabKey>('home');
  const [termsFav, setTermsFav] = useState(false);
  const [openNo, setOpenNo] = useState<string | null>(null);
  const [lessonIdx, setLessonIdx] = useState<number | null>(null);
  const [modal, setModal] = useState<ModalKey>(null);
  const [syncing, setSyncing] = useState(false);
  const [pro, setPro] = useState(isProActive());
  const { width } = useWindowDimensions();

  const bump = () => setDataVersion((v) => v + 1);

  useEffect(() => {
    void (async () => {
      await Promise.all([loadHistory(), loadBookmarks(), loadExamDate(), loadStats()]);
      bump();
      await recordSnapshotIfNeeded();
    })();
    initContent(() => setContentVersion((v) => v + 1));
  }, []);

  useEffect(() => {
    const unsub = subscribePro(() => setPro(isProActive()));
    void initPurchases();
    return unsub;
  }, []);

  const chapters = useMemo(() => getChapters(), [contentVersion]);
  const openChapter = openNo ? (chapters.find((x) => x.no === openNo) ?? null) : null;

  const goTab = (t: TabKey) => { setTab(t); if (t !== 'learn') { setOpenNo(null); setLessonIdx(null); } if (t === 'terms') setTermsFav(false); };
  const goFavTerms = () => { setOpenNo(null); setLessonIdx(null); setTermsFav(true); setTab('terms'); };

  const doSync = () => {
    if (syncing) return;
    setSyncing(true);
    initContent(() => setContentVersion((v) => v + 1));
    setTimeout(() => setSyncing(false), 2500);
  };

  const showModal = modal !== null;
  const topPad = (tab === 'home' && !openChapter && !showModal) ? 0 : insets.top;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={[s.appCol, { width: Math.min(width, 440) }]}>
        <View style={{ flex: 1, paddingTop: topPad }}>
          {showModal ? (
            <>
              {modal === 'bookmarks' && <BookmarksScreen onClose={() => setModal(null)} onBump={bump} />}
              {modal === 'relation' && <RelationMapScreen onClose={() => setModal(null)} pro={pro} onPaywall={() => { setModal('paywall'); }} />}
              {modal === 'guide' && <ExamGuideScreen onClose={() => setModal(null)} />}
              {modal === 'examdate' && <ExamDateScreen onClose={() => setModal(null)} onSaved={bump} />}
              {modal === 'paywall' && <PaywallScreen onClose={() => setModal(null)} onBump={bump} />}
            </>
          ) : (
            <>
              {tab === 'home' && <HomeScreen onGo={goTab} onModal={setModal} onFavTerms={goFavTerms} ver={dataVersion} />}
              {tab === 'learn' && (openChapter
                ? (lessonIdx === null
                    ? <LessonListScreen chapter={openChapter} chapters={chapters} onOpenLesson={(i) => setLessonIdx(i)} onBack={() => setOpenNo(null)} onNavChapter={(no) => { setOpenNo(no); setLessonIdx(null); }} pro={pro} onPaywall={() => setModal('paywall')} />
                    : <LessonReader chapters={chapters} chapterNo={openChapter.no} lessonIdx={lessonIdx} onBack={() => setLessonIdx(null)} onNav={(no, i) => { setOpenNo(no); setLessonIdx(i); }} pro={pro} onPaywall={() => setModal('paywall')} />)
                : <LearnScreen chapters={chapters} onOpen={(x) => { setOpenNo(x.no); setLessonIdx(null); }} />)}
              {tab === 'terms' && <GlossaryScreen onBump={bump} ver={dataVersion} favInit={termsFav} pro={pro} onPaywall={() => setModal('paywall')} />}
              {tab === 'mock' && <MockScoreScreen onBump={bump} pro={pro} onPaywall={() => setModal('paywall')} />}
              {tab === 'set' && <SettingsScreen onModal={setModal} onSync={doSync} syncing={syncing} pro={pro} />}
            </>
          )}
        </View>
        {!showModal ? <TabBar tab={tab} onTab={goTab} insetBottom={insets.bottom} /> : null}
      </View>
      <StatusBar style={resolved === 'dark' ? 'light' : 'dark'} />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <Main />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
