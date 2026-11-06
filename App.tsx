import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, Image, TextInput,
  useWindowDimensions, PanResponder, Alert, ActivityIndicator, Modal, Switch, AppState,
} from 'react-native';
import type { PurchasesPackage } from 'react-native-purchases';
import { initPurchases, isProActive, subscribePro, getProPackage, purchasePro, restorePro, canUseFreePreview, isFreePreviewEnabled, setFreePreviewEnabled } from './src/data/purchases';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BUILD_NUMBER } from './src/buildInfo';
import * as Application from 'expo-application';
import { initLaunchAccess, isLaunchFreeActive, launchAccessStatus } from './src/data/launchAccess';
import { initFeedback, openAppReview, feedbackDevToolsAvailable, triggerReviewForDevelopment } from './src/data/feedback';
import { FeedbackCard } from './src/ui/FeedbackCard';
import { useStudyFeedback } from './src/ui/useStudyFeedback';
import { startStudyFeedback, blockStudyFeedback, noteFeedbackInteraction } from './src/data/studyFeedback';
import { ExamDateScreen, DeveloperMessage } from './src/ui/HomeScreen';
import { ExamGuideScreen } from './src/ui/ExamGuideScreen';
import { activityState, bodyTag, initActivity, rememberLesson } from './src/data/studyActivity';
import { useReadingActivity } from './src/ui/useStudyActivity';
import { PracticalAssessment } from './src/ui/PracticalAssessment';
import { PracticalQuestion } from './src/ui/PracticalQuestion';
import { assessmentSummary, type Points, questionStem, sectionScores, practicePassed } from './src/data/practical';
import { ExamAttempt, type ExamAnswer } from './src/data/examAttempt';
import { EXAM_DURATION_SECONDS, remainingSeconds, formatExamTime } from './src/data/examTiming';
import { initContent } from './src/data/initContent';
import { getChapters, type Chapter } from './src/data/chapters';
import { getFigureUri } from './src/data/contentStore';
import { ImageZoom } from './src/ui/ImageZoom';
import { LessonStudy } from './src/ui/LessonStudy';
import { parseLessons, type Lesson } from './src/ui/lessons';
import { getQuizSets, getQuestions, getAllQuestions, type Question, type QuizSet } from './src/data/questions';
import { loadHistory, recordAnswer, selectReview, overallStats, getRec } from './src/data/history';
import { GlossaryScreen } from './src/ui/GlossaryScreen';
import {
  loadBookmarks, isBookmarked, toggleBookmark, bookmarkedIds, bookmarkCount,
} from './src/data/bookmarks';
import { loadExamDate, daysLeft, examDateText } from './src/data/examDate';
import {
  loadStats, bumpDaily, chapterStats, currentAccMap, recentDaily, studyStreak,
  recordSnapshotIfNeeded, snapAsOf,
} from './src/data/stats';
import { ThemeProvider, useTheme, useStyles } from './src/theme/ThemeContext';
import type { Mode } from './src/theme/ThemeContext';
import { CHAPTER_SHORT, subjectColor, type Colors } from './src/theme/colors';
import { Svg, Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { Icon, Ring, Tag, RadarChart, StreakBars, Segmented, type RadarAxis, type RadarSeries } from './src/ui/components';
import { RelationMapScreen } from './src/ui/RelationMapScreen';

type TabKey = 'home' | 'learn' | 'terms' | 'mock' | 'set';
type ModalKey = 'bookmarks' | 'relation' | 'guide' | 'paywall' | 'examdate' | null;

const QLABEL = ['1', '2', '3', '4', '5'];

function tagColors(kind: NonNullable<Chapter['tagKind']>, c: Colors): { bg: string; fg: string } {
  switch (kind) {
    case 'hard': return { bg: c.warnSoft, fg: c.warn };
    case 'mid': return { bg: 'rgba(224,163,46,0.16)', fg: '#E0A32E' };
    case 'easy': return { bg: c.goodSoft, fg: c.good };
    case 'done': return { bg: c.goodSoft, fg: c.good };
  }
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

// ---- 教材(章一覧 / リーダー) ----
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
    <ScrollView style={{ flex: 1 }} onScroll={noteFeedbackInteraction} scrollEventThrottle={200} contentContainerStyle={{ paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
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
        <Pressable accessibilityRole="button" accessibilityLabel="試験日を設定" style={({ pressed }) => [s.countCard, pressed && s.pressed]} onPress={() => onModal('examdate')}>
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
        <Pressable accessibilityRole="button" accessibilityLabel="試験の総合解説" style={({ pressed }) => [s.guideCard, pressed && s.pressed]} onPress={() => onModal('guide')}>
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
    <Pressable accessibilityRole="button" accessibilityLabel={title} style={({ pressed }) => [s.tile, pressed && s.pressed]} onPress={onPress}>
      <View style={s.tileIco}><Icon name={icon} size={20} color={c.accent} /></View>
      <Text style={s.tileTitle}>{title}</Text>
      <Text style={s.tileSub}>{sub}</Text>
      {badge ? <View style={s.tileBadge}><Text style={s.tileBadgeTxt}>{badge}</Text></View> : null}
      {soon ? <View style={s.tileSoon}><Text style={s.tileSoonTxt}>準備中</Text></View> : null}
      <Text style={s.tileGo}>›</Text>
    </Pressable>
  );
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
          <Text style={s.viewSub}>要点をつかみ、図と具体例で理解し、クイズで確かめましょう。</Text>
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
  const reviewIdx = lessons.findIndex(l => l.key === 'review');
  const reviewChecks = (lessons[reviewIdx]?.body.match(/^:::check /gm) || []).length;
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
          {reviewIdx >= 0 ? <Pressable accessibilityRole="button"
            onPress={() => { if (!pro && reviewIdx >= freeCount) onPaywall(); else onOpenLesson(reviewIdx); }}
            style={({ pressed }) => [s.readerNavBtn, { marginTop: 16, flex: 0 }, pressed && s.pressed]}>
            <Text style={s.readerNavTxt}>試験前チェックへ ›</Text>
            <Text style={[s.readerNavSub, { fontSize: 13, lineHeight: 22 }]}>{`${reviewChecks}問の確認と、数値・例外の振り返り`}</Text>
          </Pressable> : null}
          {lessons.length === 0 ? (
            <View style={s.soon}><Text style={s.soonBig}>準備中</Text><Text style={s.soonTxt}>{'第' + chapter.no + '章の解説はこれから追加します。'}</Text></View>
          ) : (
            <View style={{ gap: 10, marginTop: 16 }}>
              {lessons.map((l, i) => {
                const locked = !pro && i >= freeCount;
                return (
                  <Pressable key={l.key} style={({ pressed }) => [s.ch, locked && s.chLocked, pressed && s.pressed]} onPress={() => (locked ? onPaywall() : onOpenLesson(i))}>
                    <View style={s.chNo}><Text style={s.chNoTxt}>{l.key === 'intro' ? '序' : l.key === 'review' ? '復' : l.label.match(/^Lesson\s+(\d+)/i)?.[1] ?? i + 1}</Text></View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={s.chTitle}>{l.label.replace(/^Lesson\s+\d+\s+/i, '')}</Text>
                      {(l.body.match(/^:::check /gm) || []).length ? <Text style={[s.chSub, { marginTop: 5 }]}>{`確認問題 ${(l.body.match(/^:::check /gm) || []).length}問`}</Text> : null}
                    </View>
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
function LessonReader({ chapters, chapterNo, lessonIdx, onBack, onNav, pro, onPaywall, backLabel = 'レッスン一覧' }: { chapters: Chapter[]; chapterNo: string; lessonIdx: number; onBack: () => void; onNav: (chapterNo: string, lessonIdx: number) => void; pro: boolean; onPaywall: () => void; backLabel?: string }) {
  const s = useStyles();
  const chapter = chapters.find((x) => x.no === chapterNo) ?? null;
  const lessons = useMemo(() => parseLessons(chapter?.body ?? ''), [chapter?.body]);
  const safeIdx = Math.max(0, Math.min(lessonIdx, lessons.length - 1));
  const lesson = lessons[safeIdx] ?? null;
  const locked = !pro && safeIdx >= freeLessonEntries(chapterNo, lessons);
  useStudyFeedback('lesson:' + chapterNo + ':' + safeIdx, !locked && !!lesson);
  const studyId = chapterNo + ':' + (lesson?.key ?? '');
  useReadingActivity('lessons', studyId, !locked && !!lesson);
  const tag = useMemo(() => bodyTag(lesson?.body ?? ''), [lesson?.body]);
  const initialOffset = useMemo(() => {
    const r = activityState().resume;
    return r?.chapterNo === chapterNo && r.lessonKey === lesson?.key && r.bodyTag === tag ? r.offset : 0;
  }, [chapterNo, lesson?.key, tag]);
  const offset = useRef(initialOffset);
  useEffect(() => {
    if (locked || !lesson) return;
    offset.current = initialOffset;
    const save = () => { void rememberLesson({ chapterNo, lessonKey: lesson.key, label: lesson.label, offset: offset.current, bodyTag: tag, at: Date.now() }); };
    save();
    const sub = AppState.addEventListener('change', state => { if (state !== 'active') save(); });
    return () => { sub.remove(); save(); };
  }, [chapterNo, lesson?.key, tag, locked]);
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
          <Text style={s.backTxt}>{'‹ ' + backLabel}</Text>
        </Pressable>
        <Text style={s.qProgress} numberOfLines={1}>{(chapter ? '第' + chapter.no + '章' : '') + (lessons.length ? '・' + (safeIdx + 1) + '/' + lessons.length : '')}</Text>
      </View>
      <LessonStudy key={chapterNo + '-' + safeIdx} studyId={studyId} initialScrollOffset={initialOffset} onScrollPosition={y => { offset.current = y; }} body={!locked ? lesson?.body : undefined} onLessonLink={number => {
        const target = lessons.findIndex(l => new RegExp('^Lesson\\s+0*' + number + '\\s').test(l.label));
        if (target >= 0) onNav(chapterNo, target);
      }}>
        {locked
          ? <ProCut onPaywall={onPaywall} title="このレッスンはProで" sub={'無料で読めるレッスンの先です。Proですべてのレッスン・用語・相関図・模試が解放されます。'} />
          : lesson ? null : <View style={s.soon}><Text style={s.soonBig}>準備中</Text></View>}
        {!locked && lesson?.key !== 'review' && lessons.some(l => l.key === 'review') ? <Pressable accessibilityRole="button"
          onPress={() => onNav(chapterNo, lessons.findIndex(l => l.key === 'review'))}
          style={({ pressed }) => [s.readerNavBtn, { marginTop: 20, flex: 0 }, pressed && s.pressed]}>
          <Text style={s.readerNavTxt}>この章の試験前チェックへ ›</Text>
        </Pressable> : null}
        <View style={s.readerNav}>
          <Pressable disabled={!prevTarget} onPress={() => prevTarget && onNav(prevTarget.no, prevTarget.i)} style={({ pressed }) => [s.readerNavBtn, !prevTarget && s.btnDisabled, pressed && s.pressed]}>
            {prevTarget ? <Text style={s.readerNavTxt}>‹ 前のレッスン</Text> : null}
          </Pressable>
          <Pressable disabled={!nextTarget} onPress={() => nextTarget && onNav(nextTarget.no, nextTarget.i)} style={({ pressed }) => [s.readerNavBtn, { alignItems: 'flex-end' }, !nextTarget && s.btnDisabled, pressed && s.pressed]}>
            {nextTarget ? <Text style={s.readerNavTxt}>次のレッスン ›</Text> : null}
          </Pressable>
        </View>
      </LessonStudy>
    </View>
  );
}

// ---- 用語集 ----
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
  const points = Object.fromEntries(questions.map(q => {
    const r = getRec(q.id);
    return [q.id, r?.lastPoints ?? { earned: r?.lastCorrect ? 1 : 0, total: 1 }];
  }));
  return { answered, correct, pct, total: questions.length, perCh, wrong, assessment: assessmentSummary(questions, points), scores: sectionScores(questions, points), passed: practicePassed(questions, points) };
}

// ---- 成績を確認する(クレーン同等の結果画面) ----
function MockResult({ set, onBack, onBump }: { set: QuizSet; onBack: () => void; onBump: () => void }) {
  const { c } = useTheme();
  const s = useStyles();
  const [detail, setDetail] = useState<Question | null>(null);
  const qs = useMemo(() => getQuestions(set.file), [set.file]);
  const st = mockStat(qs);
  if (detail) return <QuestionDetail question={detail} onBack={() => setDetail(null)} onBump={onBump} />;
  const pass = st.passed;
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
              <Ring pct={st.pct} label="全問正解率" />
              <Text style={[s.verdict, pass ? s.vOk : s.vNg, { marginTop: 10, textAlign: 'center' }]}>
                {st.assessment.reviewCount ? '文章の自己確認を含む参考評価です' : pass ? '練習用の合格目安を満たしています' : '分野別・鑑別の得点を確認して復習しましょう'}
              </Text>
            </View>
            <View style={s.statRow}>
              <View style={s.statCell}><Text style={s.statCellV}>{st.correct}/{st.answered}</Text><Text style={s.statCellK}>正答数</Text></View>
              <View style={s.statCell}><Text style={[s.statCellV, { color: c.accent }]}>{st.pct}%</Text><Text style={s.statCellK}>大問の全問正解率</Text></View>
              <View style={s.statCell}><Text style={s.statCellV}>{st.total - st.answered}</Text><Text style={s.statCellK}>未解答</Text></View>
            </View>
            <Text style={s.guideBody}>筆記：{st.scores.writtenEarned}/{st.scores.writtenTotal}問・{st.scores.writtenPct ?? 0}%</Text>
            {st.scores.practicalTotal ? <Text style={s.guideBody}>鑑別：{st.scores.practicalEarned}/{st.scores.practicalTotal}点・{st.scores.practicalPct ?? 0}%（練習用採点）</Text> : null}
            <Text style={s.guideBody}>鑑別は名称・数値・記号各1点、文章説明は要点ごとに1点。本番の配点・採点基準とは異なります。</Text>
            <PracticalAssessment summary={st.assessment} />
            <Text style={s.sectionHead}>分野別の正答率（大問単位）</Text>
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
                      <Text style={s.wrongStem} numberOfLines={2}>{questionStem(q)}</Text>
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
  const [session, setSession] = useState<{ title: string; questions: Question[]; limitSeconds?: number } | null>(null);
  const [resultSet, setResultSet] = useState<QuizSet | null>(null);
  const { c } = useTheme();
  const s = useStyles();

  if (session) {
    return <QuizPlayer title={session.title} questions={session.questions} limitSeconds={session.limitSeconds} onExit={() => { setSession(null); onBump(); }} onBump={onBump} />;
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
    Alert.alert('模試の制限時間', '本番は筆記・実技を合わせて105分（科目免除なし）。アプリは筆記30問（四肢択一）と鑑別5大問（図・記述・記号選択）です。解説は提出後に表示します。105分モードでは時間切れで自動提出します。', [
      { text: '105分で開始', onPress: () => setSession({ title: set.title, questions: getQuestions(set.file), limitSeconds: EXAM_DURATION_SECONDS }) },
      { text: '時間制限なし', onPress: () => setSession({ title: set.title, questions: getQuestions(set.file) }) },
      { text: 'キャンセル', style: 'cancel' },
    ]);
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
          <Text style={s.viewSub}>105分の時間制限つき・時間制限なしを選んで、実力と弱点をチェック。</Text>
        </View>

        {isLaunchFreeActive() ? <View style={[s.card, { marginTop: 16 }]}>
          <Text style={s.cardTitle}>全機能を無料で利用できます</Text>
          <Text style={s.cardSub}>無料開放期間中の利用者は、このインストールで期限なく使えます。</Text>
        </View> : null}

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
                        <View style={[s.mockPill, st.passed ? s.mockPillPass : s.mockPillWarn]}><Text style={[s.mockPillTxt, st.passed ? s.mockPillPassTxt : s.mockPillWarnTxt]}>{'筆記 ' + (st.scores.writtenPct ?? 0) + '%・鑑別 ' + (st.scores.practicalPct ?? 0) + '%'}</Text></View>
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

function QuizPlayer({ title, questions, limitSeconds, onExit, onBump }: { title: string; questions: Question[]; limitSeconds?: number; onExit: () => void; onBump: () => void }) {
  const { c } = useTheme();
  const s = useStyles();
  const [idx, setIdx] = useState(0);
  const attempt = useRef(new ExamAttempt(questions, limitSeconds ? Date.now() + limitSeconds * 1000 : null));
  const [, redraw] = useState(0);
  const [result, setResult] = useState<Record<string, Points> | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(limitSeconds ?? null);
  const [saving, setSaving] = useState(false);
  const [reviewIdx, setReviewIdx] = useState<number | null>(null);
  const finished = result !== null;
  useStudyFeedback('quiz:' + title, !finished && questions.length > 0);

  const finish = (timeout = false) => {
    const current = attempt.current;
    if (current.result) return;
    const points = current.finish();
    setRemaining(remainingSeconds(current.deadline, Date.now()));
    setTimedOut(timeout); setResult(points); setSaving(true);
    void (async () => {
      try {
        // Save only once, after submission. Navigation never reveals or records a grade.
        for (const q of questions) {
          const p = points[q.id];
          await recordAnswer(q.id, p.earned === p.total, !!current.answers[q.id]?.flagged, p);
        }
        await bumpDaily();
        await recordSnapshotIfNeeded();
        onBump();
      } finally { setSaving(false); }
    })();
  };
  const finishRef = useRef(finish);
  finishRef.current = finish;
  useEffect(() => {
    if (finished || questions.length === 0) return;
    const tick = () => {
      const left = remainingSeconds(attempt.current.deadline, Date.now());
      setRemaining(left);
      if (left === 0) finishRef.current(true);
    };
    tick();
    const timer = setInterval(tick, 1000);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') tick(); });
    return () => { clearInterval(timer); subscription.remove(); };
  }, [finished, questions.length]);

  const expired = () => {
    if (!attempt.current.expired(Date.now())) return false;
    finish(true); return true;
  };
  const submit = () => {
    if (finished || expired()) return;
    const unanswered = questions.filter(q => !attempt.current.answered(q.id)).length;
    Alert.alert('解答を提出しますか？', `未解答は${unanswered}問です。提出後は変更できません。終了後に正誤と解説を確認できます。`, [
      { text: '見直す', style: 'cancel' },
      { text: '提出して採点', onPress: () => { if (!expired()) finish(false); } },
    ]);
  };
  const exit = () => {
    if (finished || questions.length === 0) { if (!saving) onExit(); return; }
    submit();
  };
  const reset = () => {
    if (saving) return;
    attempt.current = new ExamAttempt(questions, limitSeconds ? Date.now() + limitSeconds * 1000 : null);
    setIdx(0); setResult(null); setTimedOut(false); setReviewIdx(null); setRemaining(limitSeconds ?? null);
  };
  const navigate = (index: number) => { if (!expired()) setIdx(index); };

  if (!questions.length) return <View style={s.soon}><Text style={s.soonBig}>対象なし</Text><Pressable onPress={onExit}><Text style={s.backTxt}>‹ 一覧へ</Text></Pressable></View>;
  if (result) {
    const scores = sectionScores(questions, result);
    const answered = questions.filter(q => attempt.current.answered(q.id)).length;
    const review = reviewIdx === null ? null : questions[reviewIdx];
    return <View style={{ flex: 1 }}>
      <View style={s.readerBar}><Pressable disabled={saving} onPress={onExit}><Text style={s.backTxt}>‹ 一覧へ</Text></Pressable></View>
      <ScrollView contentContainerStyle={[s.pad, { paddingBottom: 40 }]} keyboardShouldPersistTaps="handled">
        <Text style={s.viewH2}>{timedOut ? '制限時間になりました' : '採点結果'}</Text>
        <Text style={s.guideBody}>解答済み {answered}問・未解答 {questions.length - answered}問</Text>
        {scores.writtenTotal ? <Text style={s.guideBody}>筆記：{scores.writtenEarned}/{scores.writtenTotal}問・{scores.writtenPct}%</Text> : null}
        {scores.practicalTotal ? <Text style={s.guideBody}>鑑別：{scores.practicalEarned}/{scores.practicalTotal}点・{scores.practicalPct}%（参考採点）</Text> : null}
        <Text style={s.guideBody}>未解答は0点です。時間切れの場合は、直前まで入力した解答を採点しています。</Text>
        {limitSeconds ? <Text style={s.guideBody}>所要時間 {formatExamTime(Math.min(limitSeconds, limitSeconds - (remaining ?? 0)))}</Text> : null}
        <PracticalAssessment summary={assessmentSummary(questions, result)} />
        <Text style={[s.guideH, { marginTop: 20 }]}>解答・解説を確認</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {questions.map((q, i) => <Pressable key={q.id} onPress={() => setReviewIdx(i)} accessibilityLabel={`問${i + 1}の解説`} style={[s.ghostBtn, { minWidth: 48 }]}><Text style={s.ghostBtnTxt}>{i + 1}{result[q.id].earned === result[q.id].total ? ' ◯' : ' △'}</Text></Pressable>)}
        </View>
        {review ? <View style={[s.card, { marginTop: 16 }]}>
          <Text style={s.cardTitle}>問{reviewIdx! + 1}</Text><Text style={s.qStem}>{questionStem(review)}</Text>
          {review.practical ? <PracticalQuestion practical={review.practical} draft={attempt.current.answers[review.id]?.text ?? {}} review /> : <>
            {review.choices.map((choice, i) => <Text key={i} style={s.guideBody}>{QLABEL[i]}　{choice}</Text>)}
            <Text style={[s.guideBody, { marginTop: 12 }]}>あなたの解答：{attempt.current.answers[review.id]?.choice === undefined ? '未解答' : QLABEL[attempt.current.answers[review.id].choice!]}</Text>
            <Text style={s.verdict}>正解：{QLABEL[review.answer]}</Text>
            <Text style={s.guideBody}>{review.explain}</Text>
            {attempt.current.answers[review.id]?.choice !== undefined && attempt.current.answers[review.id].choice !== review.answer ? <Text style={s.guideBody}>{review.whyWrong?.[attempt.current.answers[review.id].choice!]}</Text> : null}
          </>}
        </View> : null}
        <Text style={s.guideBody}>{saving ? '成績を保存しています…' : '成績を保存しました。'}</Text>
        <Pressable disabled={saving} onPress={reset} style={[s.submitBtn, { marginTop: 18 }]}><Text style={s.submitTxt}>もう一度受験する</Text></Pressable>
      </ScrollView>
    </View>;
  }
  const q = questions[idx];
  const answer = attempt.current.answers[q.id] ?? {};
  const update = (patch: Partial<ExamAnswer>) => {
    if (expired()) return;
    if (attempt.current.update(q.id, patch, Date.now())) redraw(n => n + 1);
  };
  return <View style={{ flex: 1 }}>
    <View style={s.readerBar}>
      <Pressable onPress={exit}><Text style={s.backTxt}>終了・提出</Text></Pressable>
      <Text style={s.qProgress}>{title}　{idx + 1}/{questions.length}</Text>
    </View>
    <View style={[s.quizTimerBar, remaining !== null && remaining <= 600 && s.quizTimerWarning]}>
      <Text accessibilityRole="timer" style={s.quizTimerText}>{remaining === null ? '時間制限なし' : `残り ${formatExamTime(remaining)}`}</Text>
      <Text style={s.quizTimerHint}>採点・解説は提出後。解答は提出まで変更できます。</Text>
    </View>
    <ScrollView contentContainerStyle={[s.pad, { paddingBottom: 40 }]} keyboardShouldPersistTaps="handled">
      <Text style={s.guideBody}>問題番号から移動できます。✓ 解答あり／★ 見直し</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 12 }}>
        {questions.map((item, i) => <Pressable key={item.id} onPress={() => navigate(i)} accessibilityLabel={`問${i + 1}${attempt.current.answered(item.id) ? ' 解答あり' : ' 未解答'}`} style={[s.ghostBtn, i === idx && { borderColor: c.accent }, { minWidth: 44 }]}><Text style={s.ghostBtnTxt}>{i + 1}{attempt.current.answers[item.id]?.flagged ? '★' : attempt.current.answered(item.id) ? '✓' : ''}</Text></Pressable>)}
      </View>
      <Text style={s.qStem}>問{idx + 1}　{questionStem(q)}</Text>
      {q.practical ? <PracticalQuestion key={q.id} practical={q.practical} draft={answer.text ?? {}} onChange={(id, value) => update({ text: { ...attempt.current.answers[q.id]?.text, [id]: value } })} /> : <View style={{ gap: 9, marginTop: 14 }}>
        {q.choices.map((choice, i) => <Pressable key={i} onPress={() => update({ choice: i })} accessibilityRole="radio" accessibilityState={{ checked: answer.choice === i }} style={[s.choice, answer.choice === i && s.choiceSel]}><Text style={s.choiceNum}>{QLABEL[i]}</Text><Text style={s.choiceTxt}>{choice}</Text></Pressable>)}
        <Pressable onPress={() => update({ choice: undefined })}><Text style={s.backTxt}>解答を取り消す</Text></Pressable>
      </View>}
      <Pressable onPress={() => update({ flagged: !answer.flagged })} style={[s.confToggle, answer.flagged && s.confOn]}><Text style={s.confTxt}>{answer.flagged ? '☑' : '☐'} あとで見直す</Text></Pressable>
      <View style={{ flexDirection: 'row', gap: 10, marginVertical: 16 }}>
        <Pressable disabled={idx === 0} onPress={() => navigate(idx - 1)} style={[s.ghostBtn, idx === 0 && s.btnDisabled]}><Text style={s.ghostBtnTxt}>‹ 前の問題</Text></Pressable>
        {idx < questions.length - 1 ? <Pressable onPress={() => navigate(idx + 1)} style={s.ghostBtn}><Text style={s.ghostBtnTxt}>次の問題 ›</Text></Pressable> : null}
      </View>
      <Pressable onPress={submit} style={s.submitBtn}><Text style={s.submitTxt}>提出して採点</Text></Pressable>
    </ScrollView>
  </View>;
}

// ---- 設定 ----
function SettingsScreen({ onModal, onSync, syncing, pro }: { onModal: (m: ModalKey) => void; onSync: () => void; syncing: boolean; pro: boolean }) {
  const { c, mode, setMode, resolved } = useTheme();
  const s = useStyles();
  const [restoring, setRestoring] = useState(false);
  const [showDev, setShowDev] = useState(isFreePreviewEnabled());
  const [freePreview, setFreePreview] = useState(isFreePreviewEnabled());
  const [feedbackDev, setFeedbackDev] = useState(__DEV__);
  const [requestPreview, setRequestPreview] = useState(false);
  useEffect(() => {
    let mounted = true;
    void feedbackDevToolsAvailable().then(available => { if (mounted) setFeedbackDev(available); });
    return () => { mounted = false; };
  }, []);
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
          <Text style={s.setGroupTitle}>利用状態</Text>
          {pro ? (
            <View style={s.setRow}>
              <Text style={s.setLabel}>ステータス</Text>
              <Text style={[s.setValue, { color: resolved === 'light' ? '#246547' : '#81D9A4' }]}>{isLaunchFreeActive() ? '無料開放（期限なし）' : '購入済み'}</Text>
            </View>
          ) : (
            <Pressable style={({ pressed }) => [s.setRow, pressed && s.pressed]} onPress={() => onModal('paywall')}>
              <Text style={s.setLabel}>Proにアップグレード</Text>
              <Text style={[s.setValue, { color: c.accent }]}>全機能を解放 ›</Text>
            </Pressable>
          )}
          {isLaunchFreeActive() ? <Text style={[s.guideBody, { padding: 12 }]}>無料開放期間中に利用を開始したため、このインストールでは全機能を期限なく使えます。削除・再インストール・機種変更後の引き継ぎはできません。評価やメール送信は利用条件ではありません。</Text> : null}
          {launchAccessStatus() !== 'ready' ? <Pressable style={s.setRow} onPress={() => { void initLaunchAccess(); }}>
            <Text style={s.setLabel}>{launchAccessStatus() === 'checking' ? '無料開放の対象を確認中…' : '無料開放の対象を再確認'}</Text>
          </Pressable> : null}
          <Pressable disabled={restoring || freePreview} style={({ pressed }) => [s.setRow, pressed && s.pressed, (restoring || freePreview) && s.btnDisabled]} onPress={doRestore}>
            <Text style={s.setLabel}>購入を復元</Text>
            <Text style={s.setValue}>{restoring ? '復元中…' : '実行 ›'}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" style={({ pressed }) => [s.setRow, pressed && s.pressed]} onPress={() => { void openAppReview(); }}>
            <Text style={s.setLabel}>アプリを評価する</Text>
            <Text style={s.setValue}>App Store ›</Text>
          </Pressable>
        </View>

        <View style={s.setGroup}>
          <Text style={s.setGroupTitle}>アプリについて</Text>
          <DeveloperMessage />
          <Pressable style={s.setRow} delayLongPress={1500} onLongPress={() => { if (feedbackDev || canUseFreePreview()) setShowDev(true); }}>
            <Text style={s.setLabel}>バージョン</Text>
            <Text style={s.setValue}>{Application.nativeApplicationVersion ?? "開発版"} · Build {Application.nativeBuildVersion ?? BUILD_NUMBER}</Text>
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

        {showDev && (feedbackDev || canUseFreePreview()) ? <View style={s.setGroup}>
          <Text style={s.setGroupTitle}>開発用</Text>
          {feedbackDev ? <>
            <Pressable accessibilityRole="button" style={s.setRow} onPress={() => { void triggerReviewForDevelopment(); }}>
              <Text style={s.setLabel}>評価画面を表示</Text><Text style={s.setValue}>テスト ›</Text>
            </Pressable>
            <Pressable accessibilityRole="button" style={s.setRow} onPress={() => setRequestPreview(true)}>
              <Text style={s.setLabel}>リクエスト画面を表示</Text><Text style={s.setValue}>テスト ›</Text>
            </Pressable>
            <Text style={[s.guideBody, { padding: 12 }]}>表示予定日を待たずに確認できます。通常の表示間隔には影響しません。Appleの標準評価画面はTestFlightでは表示されません。</Text>
          </> : null}
          {canUseFreePreview() ? <><View style={s.setRow}>
            <Text style={s.setLabel}>無料ユーザーとして確認</Text>
            <Switch accessibilityLabel="無料ユーザーとして確認" value={freePreview} onValueChange={value => {
              setFreePreviewEnabled(value);
              setFreePreview(isFreePreviewEnabled());
            }} />
          </View>
          <Text style={[s.radarEmpty, { marginTop: 8 }]}>購入履歴を残したまま、無料版の表示と制限を確認します。オフにするかアプリを完全に終了すると、本来の購入状態に戻ります。購入ボタンからテスト購入に進めます。購入成功時は無料確認を解除します。</Text>
          </> : null}
        </View> : null}
        <Modal visible={requestPreview && feedbackDev} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setRequestPreview(false)}>
          <View style={{ flex: 1, backgroundColor: c.bg }}>
            <View style={s.modalBar}>
              <Pressable accessibilityRole="button" onPress={() => setRequestPreview(false)} style={s.backBtn}><Text style={s.backTxt}>‹ 閉じる</Text></Pressable>
              <Text style={s.modalTitle}>リクエスト画面の確認</Text>
            </View>
            <ScrollView contentContainerStyle={{ padding: 20 }}>
              <Text style={s.guideBody}>開発用プレビューです。メールボタンは実際にメールアプリを開きます。送信はご自身で行ってください。</Text>
              {requestPreview ? <FeedbackCard preview onDismiss={() => setRequestPreview(false)} /> : null}
            </ScrollView>
          </View>
        </Modal>
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
                <Text style={s.chTitle} numberOfLines={2}>{questionStem(q)}</Text>
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
  useStudyFeedback('question:' + q.id, true);
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
        <Text style={s.qStem}>{questionStem(q)}</Text>
        {q.practical ? <PracticalQuestion practical={q.practical} draft={getRec(q.id)?.lastPoints?.answers ?? {}} review /> : <><View style={{ gap: 9, marginTop: 14 }}>
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
        </>}
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

  if (isLaunchFreeActive() || launchAccessStatus() !== 'ready') {
    const free = isLaunchFreeActive();
    return <View style={{ flex: 1 }}>
      <View style={s.modalBar}><Pressable onPress={onClose} style={s.backBtn}><Text style={s.backTxt}>‹ 閉じる</Text></Pressable></View>
      <View style={[s.pad, { marginTop: 24 }]}>
        <Text style={s.viewH2}>{free ? '全機能を無料で利用できます' : '無料開放の対象を確認'}</Text>
        <Text style={[s.guideBody, { marginTop: 12 }]}>{free ? 'このインストールでは期限なく利用できます。購入は必要ありません。削除・再インストール・機種変更後の引き継ぎはできません。' : '初回の対象確認には通信が必要です。通信環境を確認して再試行してください。確認が終わるまで購入は行いません。'}</Text>
        {!free ? <Pressable onPress={() => { void initLaunchAccess(); }} style={s.submitBtn}><Text style={s.submitTxt}>再確認する</Text></Pressable> : null}
        <Pressable onPress={restore} style={s.payRestore}><Text style={s.payRestoreTxt}>購入を復元</Text></Pressable>
      </View>
    </View>;
  }

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
  useEffect(() => startStudyFeedback(), []);
  useEffect(() => { if (modal !== null || tab === 'set') return blockStudyFeedback(); }, [modal, tab]);
  const { width } = useWindowDimensions();

  const bump = () => setDataVersion((v) => v + 1);

  useEffect(() => {
    void (async () => {
      await Promise.all([loadHistory(), loadBookmarks(), loadExamDate(), loadStats(), initActivity()]);
      bump();
      await recordSnapshotIfNeeded();
    })();
    initContent(() => setContentVersion((v) => v + 1));
  }, []);

  useEffect(() => {
    const unsub = subscribePro(() => { setPro(isProActive()); bump(); });
    void initPurchases();
    void initFeedback();
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
    void initLaunchAccess();
    setTimeout(() => setSyncing(false), 2500);
  };

  const showModal = modal !== null;
  const topPad = insets.top;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }} onTouchStart={noteFeedbackInteraction}>
      <View style={[s.appCol, { width: Math.min(width, 440) }]}>
        <View style={{ flex: 1, paddingTop: topPad }}>
          {showModal ? (
            <>
              {modal === 'bookmarks' && <BookmarksScreen onClose={() => setModal(null)} onBump={bump} />}
              {modal === 'relation' && <RelationMapScreen onClose={() => setModal(null)} pro={pro} onPaywall={() => { setModal('paywall'); }} chapters={chapters}
                renderLesson={(target, onBack, onNav) => <LessonReader backLabel="相関図に戻る" chapters={chapters} chapterNo={target.chapterNo} lessonIdx={target.lessonIdx}
                  onBack={onBack} onNav={onNav} pro={pro} onPaywall={() => setModal('paywall')} />} />}
              {modal === 'examdate' && <ExamDateScreen onClose={() => setModal(null)} onSaved={bump} />}
              {modal === 'guide' && <ExamGuideScreen onClose={() => setModal(null)} />}
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
              {tab === 'terms' && <GlossaryScreen onBump={bump} ver={contentVersion} favInit={termsFav} pro={pro} onPaywall={() => setModal('paywall')} chapters={chapters}
                renderLesson={(target, onBack, onNav) => <LessonReader backLabel="用語に戻る" chapters={chapters} chapterNo={target.chapterNo} lessonIdx={target.lessonIdx}
                  onBack={onBack} onNav={onNav} pro={pro} onPaywall={() => setModal('paywall')} />} />}
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
