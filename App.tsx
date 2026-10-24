import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, Image, TextInput,
  useWindowDimensions, PanResponder, Alert, ActivityIndicator, Modal,
} from 'react-native';
import type { PurchasesPackage } from 'react-native-purchases';
import { initPurchases, isProActive, subscribePro, getProPackage, purchasePro, restorePro } from './src/data/purchases';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BUILD_NUMBER } from './src/buildInfo';
import { initContent } from './src/data/initContent';
import { getChapters, type Chapter } from './src/data/chapters';
import { getFigureUri } from './src/data/contentStore';
import { getQuizSets, getQuestions, getAllQuestions, type Question, type QuizSet } from './src/data/questions';
import { loadHistory, recordAnswer, selectReview, overallStats } from './src/data/history';
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

// ---- 軽量マークダウン表示 ----
function Markdown({ body }: { body: string }) {
  const { c } = useTheme();
  const s = useStyles();
  const { width } = useWindowDimensions();
  const imgW = Math.min(width - 32, 560);
  const blocks = useMemo(() => {
    const lines = body.split('\n');
    const out: { type: string; text: string; rows?: string[][] }[] = [];
    let inCode = false; let code: string[] = [];
    let tbl: string[][] | null = null;
    const strip = (x: string) => x.replace(/\*\*(.+?)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1');
    const flushTbl = () => { if (tbl && tbl.length) out.push({ type: 'table', text: '', rows: tbl }); tbl = null; };
    for (const raw of lines) {
      const ln = raw.replace(/\s+$/, '');
      if (ln.trim().startsWith('```')) {
        flushTbl();
        if (inCode) { out.push({ type: 'code', text: code.join('\n') }); code = []; }
        inCode = !inCode; continue;
      }
      if (inCode) { code.push(raw); continue; }
      // 表(| ... |): 連続する行をまとめて1つの表ブロックにする(区切り行 |---| は除外)
      if (ln.startsWith('|')) {
        const cells = ln.split('|').slice(1, -1).map((x) => strip(x.trim()));
        const isSep = cells.length > 0 && cells.every((x) => x === '' || /^:?-{2,}:?$/.test(x.replace(/\s/g, '')));
        if (!isSep) (tbl = tbl ?? []).push(cells);
        continue;
      }
      flushTbl();
      const fig = ln.trim().match(/^\[\[fig:([^|\]]+)\|?([^\]]*)\]\]$/);
      if (fig) { out.push({ type: 'fig', text: fig[1] + '\u0001' + (fig[2] || '') }); continue; }
      if (ln.trim().startsWith('【図】')) { out.push({ type: 'figpending', text: ln.trim().slice(3) }); continue; }
      if (ln === '') { out.push({ type: 'gap', text: '' }); continue; }
      if (ln.startsWith('### ')) { out.push({ type: 'h3', text: strip(ln.slice(4)) }); continue; }
      if (ln.startsWith('## ')) { out.push({ type: 'h2', text: strip(ln.slice(3)) }); continue; }
      if (ln.startsWith('# ')) { out.push({ type: 'h1', text: strip(ln.slice(2)) }); continue; }
      if (ln.startsWith('> ')) { out.push({ type: 'quote', text: strip(ln.slice(2)) }); continue; }
      if (/^[-*] /.test(ln.trim())) { out.push({ type: 'li', text: strip(ln.trim().slice(2)) }); continue; }
      if (/^---+$/.test(ln.trim())) { out.push({ type: 'hr', text: '' }); continue; }
      out.push({ type: 'p', text: strip(ln) });
    }
    flushTbl();
    return out;
  }, [body]);
  const [zoomUri, setZoomUri] = useState<string | null>(null);

  return (
    <View>
      {blocks.map((b, i) => {
        if (b.type === 'fig') {
          const [asset, cap] = b.text.split('\u0001');
          const uri = getFigureUri(asset);
          return (
            <View key={i} style={{ marginVertical: 10 }}>
              {uri
                ? <Pressable onPress={() => setZoomUri(uri)}><Image source={{ uri }} style={{ width: imgW, height: imgW / 1.6, backgroundColor: '#fff', borderRadius: 8 }} resizeMode="contain" /></Pressable>
                : <View style={{ width: imgW, height: imgW / 1.6, borderRadius: 8, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: c.faint, fontSize: 12 }}>図は準備中</Text>
                  </View>}
              {cap ? <Text style={{ color: c.muted, fontSize: 12, marginTop: 4 }}>{'図：' + cap}</Text> : null}
            </View>
          );
        }
        if (b.type === 'figpending') return <Text key={i} style={{ color: c.faint, fontSize: 12, marginVertical: 4 }}>{'【図】' + b.text}</Text>;
        if (b.type === 'gap') return <View key={i} style={{ height: 8 }} />;
        if (b.type === 'hr') return <View key={i} style={s.hr} />;
        if (b.type === 'h1') return <Text key={i} style={s.mdH1}>{b.text}</Text>;
        if (b.type === 'h2') return <Text key={i} style={s.mdH2}>{b.text}</Text>;
        if (b.type === 'h3') return <Text key={i} style={s.mdH3}>{b.text}</Text>;
        if (b.type === 'quote') return <View key={i} style={s.quote}><Text style={s.quoteTxt}>{b.text}</Text></View>;
        if (b.type === 'code') return <View key={i} style={s.code}><Text style={s.codeTxt}>{b.text}</Text></View>;
        if (b.type === 'table' && b.rows) {
          const rows = b.rows;
          return (
            <View key={i} style={s.table}>
              {rows.map((r, ri) => (
                <View key={ri} style={[s.tableRow, ri === 0 && s.tableHeadRow, ri === rows.length - 1 && { borderBottomWidth: 0 }]}>
                  {r.map((cell, ci) => (
                    <View key={ci} style={[s.tableCell, ci > 0 && s.tableCellDiv]}>
                      <Text style={[s.tableCellTxt, ri === 0 && s.tableHeadTxt]}>{cell}</Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          );
        }
        if (b.type === 'li') return <Text key={i} style={s.mdP}>{'・' + b.text}</Text>;
        return <Text key={i} style={s.mdP}>{b.text}</Text>;
      })}
      {zoomUri ? <ImageZoom uri={zoomUri} onClose={() => setZoomUri(null)} /> : null}
    </View>
  );
}

// ---- 画像の全画面ズーム(タップで拡大・右上×で閉じる。ピンチ/ドラッグ可) ----
function ImageZoom({ uri, onClose }: { uri: string; onClose: () => void }) {
  const s = useStyles();
  const { width, height } = useWindowDimensions();
  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={s.zoomRoot}>
        <View style={s.zoomBar}>
          <Pressable onPress={onClose} hitSlop={14} style={({ pressed }) => [s.zoomClose, pressed && s.pressed]}>
            <Text style={s.zoomCloseTxt}>✕</Text>
          </Pressable>
        </View>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center' }}
          maximumZoomScale={5}
          minimumZoomScale={1}
          centerContent
          bouncesZoom
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
        >
          <Image source={{ uri }} style={{ width, height: height * 0.82 }} resizeMode="contain" />
        </ScrollView>
      </View>
    </Modal>
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
                <Stop offset="0" stopColor={c.bg} stopOpacity={0} />
                <Stop offset="0.6" stopColor={c.bg} stopOpacity={0.96} />
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
            const dn = tagColors('done', c);
            return (
              <Pressable key={ch.no} style={({ pressed }) => [s.ch, pressed && s.pressed]} onPress={() => onOpen(ch)}>
                <View style={s.chNo}><Text style={s.chNoTxt}>{ch.no}</Text></View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                    <Text style={s.chTitle}>{ch.title}</Text>
                    {ch.tag && tk ? <Tag label={ch.tag} color={tk.fg} bg={tk.bg} /> : null}
                    {ch.body ? <Tag label="解説あり" color={dn.fg} bg={dn.bg} /> : null}
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

function Reader({ chapter, chapters, onBack, onNavigate }: { chapter: Chapter; chapters: Chapter[]; onBack: () => void; onNavigate: (no: string) => void }) {
  const s = useStyles();
  const idx = chapters.findIndex((x) => x.no === chapter.no);
  const prev = idx > 0 ? chapters[idx - 1] : null;
  const nextCh = idx >= 0 && idx < chapters.length - 1 ? chapters[idx + 1] : null;

  // スワイプ(左右)で隣の章へ。最新の遷移先は ref 経由で読む(PanResponder 自体は固定)。
  const navRef = useRef<{ prev: Chapter | null; next: Chapter | null; go: (no: string) => void }>({ prev, next: nextCh, go: onNavigate });
  navRef.current = { prev, next: nextCh, go: onNavigate };
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
          <Text style={s.backTxt}>‹ 教材一覧</Text>
        </Pressable>
        <Text style={s.qProgress} numberOfLines={1}>{'第' + chapter.no + '章 ' + chapter.title}</Text>
      </View>
      <ScrollView key={chapter.no} style={{ flex: 1 }} contentContainerStyle={[s.pad, { paddingBottom: 40, paddingTop: 6 }]} showsVerticalScrollIndicator={false}>
        {chapter.body
          ? <Markdown body={chapter.body} />
          : <View style={s.soon}><Text style={s.soonBig}>準備中</Text><Text style={s.soonTxt}>{'第' + chapter.no + '章「' + chapter.title + '」の解説はこれから追加します。'}</Text></View>}
        <View style={s.readerNav}>
          <Pressable disabled={!prev} onPress={() => prev && onNavigate(prev.no)} style={({ pressed }) => [s.readerNavBtn, !prev && s.btnDisabled, pressed && s.pressed]}>
            {prev ? <><Text style={s.readerNavTxt}>‹ 前の章</Text><Text style={s.readerNavSub} numberOfLines={1}>{prev.title}</Text></> : null}
          </Pressable>
          <Pressable disabled={!nextCh} onPress={() => nextCh && onNavigate(nextCh.no)} style={({ pressed }) => [s.readerNavBtn, { alignItems: 'flex-end' }, !nextCh && s.btnDisabled, pressed && s.pressed]}>
            {nextCh ? <><Text style={s.readerNavTxt}>次の章 ›</Text><Text style={s.readerNavSub} numberOfLines={1}>{nextCh.title}</Text></> : null}
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

// ---- 用語集 ----
function GlossaryScreen({ onBump, ver, favInit }: { onBump: () => void; ver: number; favInit?: boolean }) {
  const { c } = useTheme();
  const s = useStyles();
  const [q, setQ] = useState('');
  // sel: null = 章の選択画面 / '1'〜'6' = その章 / 'fav' = お気に入り
  const [sel, setSel] = useState<string | null>(favInit ? 'fav' : null);
  const terms = useMemo(() => getGlossary(), [ver]);
  const chapters = ['1', '2', '3', '4', '5', '6'];
  const chCount = (k: string) => terms.filter((t) => t.chapter === k).length;
  const favCount = terms.filter((t) => isFavTerm(t.term)).length;

  // ---- 章の選択画面 ----
  if (sel === null) {
    return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
        <View style={s.pad}>
          <View style={s.viewHead}>
            <Text style={s.eyebrow}>GLOSSARY</Text>
            <Text style={s.viewH2}>用語集</Text>
            <Text style={s.viewSub}>章を選ぶと、その章の重要用語が見られます。★でお気に入りに登録できます。</Text>
          </View>
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
          ) : list.map((t) => (
            <TermCard key={t.id} term={t} onBump={onBump} />
          ))}
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
const FREE_MOCK_COUNT = 2;

function MockScoreScreen({ onBump, pro, onPaywall }: { onBump: () => void; pro: boolean; onPaywall: () => void }) {
  const [session, setSession] = useState<{ title: string; questions: Question[] } | null>(null);
  const { c } = useTheme();
  const s = useStyles();

  if (session) {
    return <QuizPlayer title={session.title} questions={session.questions} onExit={() => { setSession(null); onBump(); }} onBump={onBump} />;
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
              <Text style={s.upgradeTitle}>Proで全8回＋弱点復習を解放</Text>
              <Text style={s.upgradeSub}>模試③〜⑧と弱点復習がすべて使えます</Text>
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
        {!pro ? <Text style={s.mockHint}>模試①②は無料。③〜⑧はProで解放できます。</Text> : null}
        <View style={{ gap: 10 }}>
          {sets.map((set, i) => {
            const locked = i >= FREE_MOCK_COUNT && !pro;
            return (
              <Pressable key={set.id} style={({ pressed }) => [s.ch, locked && s.chLocked, pressed && s.pressed]} onPress={() => startSet(set, locked)}>
                <View style={s.chNo}><Text style={s.chNoTxt}>{set.chapter}</Text></View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.chTitle}>{set.title}</Text>
                  <Text style={s.chSub}>{'筆記 ' + set.count + ' 問'}</Text>
                </View>
                {locked ? <View style={s.proPill}><Text style={s.proPillTxt}>Pro</Text></View> : <Text style={s.chGo}>›</Text>}
              </Pressable>
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
              <Text style={[s.setValue, { color: c.accent }]}>全8回＋弱点復習 ›</Text>
            </Pressable>
          )}
          <Pressable disabled={restoring} style={({ pressed }) => [s.setRow, pressed && s.pressed, restoring && s.btnDisabled]} onPress={doRestore}>
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
          <View style={s.setRow}>
            <Text style={s.setLabel}>バージョン</Text>
            <Text style={s.setValue}>Build {BUILD_NUMBER}</Text>
          </View>
        </View>
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
function RelationMapScreen({ onClose }: { onClose: () => void }) {
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
        <Pressable onPress={() => setZoom(true)} style={({ pressed }) => [s.relThumb, { width: thumbW, height: thumbH }, pressed && s.pressed]}>
          {svg ? <SvgXml xml={svg} width={thumbW} height={thumbH} /> : null}
          <View style={s.relZoomHint}><Text style={s.relZoomHintTxt}>タップで拡大</Text></View>
        </Pressable>
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
      if (ok) { onBump(); Alert.alert('ありがとうございます', 'Proが有効になりました。すべての模試と弱点復習が使えます。'); onClose(); }
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
    '模試③〜⑧を解放(＝本番形式 全8回)',
    '弱点復習で、誤答や自信なしを集中特訓',
    '買い切り・1回のお支払いでずっと使える',
    '教材・用語・相関図は無料のまま',
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
          <Text style={s.paySub}>本番形式の模試を全8回＋弱点復習で、合格をぐっと近づける。</Text>
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

  const goTab = (t: TabKey) => { setTab(t); if (t !== 'learn') setOpenNo(null); if (t === 'terms') setTermsFav(false); };
  const goFavTerms = () => { setOpenNo(null); setTermsFav(true); setTab('terms'); };

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
              {modal === 'relation' && <RelationMapScreen onClose={() => setModal(null)} />}
              {modal === 'guide' && <ExamGuideScreen onClose={() => setModal(null)} />}
              {modal === 'examdate' && <ExamDateScreen onClose={() => setModal(null)} onSaved={bump} />}
              {modal === 'paywall' && <PaywallScreen onClose={() => setModal(null)} onBump={bump} />}
            </>
          ) : (
            <>
              {tab === 'home' && <HomeScreen onGo={goTab} onModal={setModal} onFavTerms={goFavTerms} ver={dataVersion} />}
              {tab === 'learn' && (openChapter
                ? <Reader chapter={openChapter} chapters={chapters} onBack={() => setOpenNo(null)} onNavigate={(no) => setOpenNo(no)} />
                : <LearnScreen chapters={chapters} onOpen={(x) => setOpenNo(x.no)} />)}
              {tab === 'terms' && <GlossaryScreen onBump={bump} ver={dataVersion} favInit={termsFav} />}
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
