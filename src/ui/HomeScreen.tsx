import React from 'react';
import { Image, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { activityState, recentActivity, setHero, type HeroId } from '../data/studyActivity';
import { useActivity } from './useStudyActivity';
import { parseLessons } from './lessons';
import type { Chapter } from '../data/chapters';
import { isLaunchFreeActive } from '../data/launchAccess';
import { recentDaily } from '../data/stats';
import { daysLeft, examDateText } from '../data/examDate';
import { bookmarkCount } from '../data/bookmarks';
import { openAppReview, openRequestEmail } from '../data/feedback';
import { Segmented } from './components';
import type { Mode } from '../theme/ThemeContext';
import { noteFeedbackInteraction } from '../data/studyFeedback';

export const HEROES: { id: HeroId; title: string; description: string; image?: ImageSourcePropType }[] = [
  { id: 'anime', title: 'アニメ', description: '親しみのある点検スタッフ', image: require('../../assets/heroes/anime.png') },
  { id: 'photo', title: '実写', description: '学んだ先の仕事を身近に', image: require('../../assets/heroes/photo.png') },
  { id: 'calm', title: '風景', description: '灯りのともる街で、落ち着いて', image: require('../../assets/heroes/calm.png') },
  { id: 'classic', title: 'これまでの画像', description: '使い慣れた消防設備士の表紙', image: require('../../assets/hero.jpg') },
  { id: 'none', title: '画像なし', description: '文字と学習の入口をすっきり' },
];

function Hero({ id }: { id: HeroId }) {
  const { c, resolved } = useTheme();
  const selected = HEROES.find(h => h.id === id) ?? HEROES[0];
  if (id === 'classic') return <View style={{ borderRadius: 18, overflow: 'hidden', backgroundColor: '#0A1524' }}>
    <Image source={selected.image!} accessibilityLabel="消防設備士 乙種第6類 試験対策。知識が、街を守る力になる。"
      style={{ width: '100%', height: 230 }} resizeMode="contain" />
  </View>;
  return <View style={{ borderRadius: 18, overflow: 'hidden', backgroundColor: c.card2, minHeight: id === 'none' ? 130 : 180, padding: 18, justifyContent: 'center' }}>
    {selected.image ? <Image source={selected.image} accessible={false} style={{ position: 'absolute', width: '100%', height: '100%', top: 0, left: 0 }} resizeMode="cover" /> : null}
    <View style={{ maxWidth: selected.image ? '75%' : '100%', alignSelf: 'flex-start', padding: 12, borderRadius: 12,
      backgroundColor: selected.image ? (resolved === 'light' ? 'rgba(255,255,255,0.94)' : 'rgba(12,14,18,0.94)') : 'transparent' }}>
      <Text accessibilityRole="header" style={{ color: c.fg, fontSize: 23, lineHeight: 34, fontWeight: '800' }}>今日の一歩が、{ '\n' }自信に変わる。</Text>
      <Text style={{ color: c.muted, fontSize: 13, lineHeight: 22, marginTop: 7 }}>知識で、安心を支える。</Text>
    </View>
  </View>;
}

type Props = {
  chapters: Chapter[]; ver: number;
  onGo: (tab: 'home' | 'learn' | 'terms' | 'mock' | 'set') => void;
  onResume: (chapterNo: string, lessonIdx: number) => void;
  onAppearance: () => void; onFavTerms: () => void; onBookmarks: () => void;
  onRelation: () => void; onGuide: () => void; onExamDate: () => void; onLicense: () => void;
};
export function HomeScreen(props: Props) {
  const { c, resolved } = useTheme();
  const { fontScale } = useWindowDimensions();
  useActivity();
  const state = activityState();
  const all = props.chapters.flatMap(ch => parseLessons(ch.body ?? '').map((lesson, idx) => ({ chapterNo: ch.no, lesson, idx })));
  const resume = all.find(item => item.chapterNo === state.resume?.chapterNo && item.lesson.key === state.resume?.lessonKey);
  const start = resume ?? all.find(item => /^l\d+$/.test(item.lesson.key)) ?? all[0];
  const days = recentActivity(7, recentDaily(7));
  const today = days[days.length - 1];
  const studied = all.filter(item => /^l\d+$/.test(item.lesson.key) && state.readLessons.includes(`${item.chapterNo}:${item.lesson.key}`)).length;
  const total = all.filter(item => /^l\d+$/.test(item.lesson.key)).length;
  const left = daysLeft();
  const goodInk = resolved === 'light' ? '#246547' : '#81D9A4';
  const card = { backgroundColor: c.card, borderWidth: 1, borderColor: c.line, borderRadius: 18, padding: 16, gap: 10 } as const;
  const text = { color: c.fg, fontSize: 16, lineHeight: 27 } as const;
  const small = { color: c.muted, fontSize: 13, lineHeight: 22 } as const;
  const row = (label: string, onPress: () => void) => <Pressable accessibilityRole="button" onPress={onPress}
    style={({ pressed }) => ({ minHeight: 48, paddingVertical: 12, opacity: pressed ? 0.7 : 1 })}>
    <Text style={{ ...text, color: c.accent2, fontWeight: '600' }}>{label} ›</Text>
  </Pressable>;
  return <ScrollView style={{ flex: 1 }} onScroll={noteFeedbackInteraction} scrollEventThrottle={200} contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 16 }}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <Text accessibilityRole="header" style={{ ...text, fontSize: 20, lineHeight: 30, fontWeight: '800' }}>消防設備士 乙6</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="ホームの画像と外観を変更" onPress={props.onAppearance} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 }}>
        <Text style={{ ...small, color: c.accent2, fontWeight: '700' }}>画像・外観を変更</Text>
      </Pressable>
    </View>
    <Hero id={state.hero} />
    {isLaunchFreeActive() ? <Pressable accessibilityRole="button" onPress={props.onLicense} style={{ ...card, backgroundColor: c.goodSoft, padding: 12, gap: 3 }}>
      <Text style={{ ...text, color: goodInk, fontSize: 14, lineHeight: 24, fontWeight: '700' }}>✓ 無料ライセンス適用済み</Text>
      <Text style={{ ...small, color: goodInk }}>教材も模試も、すべて利用できます。詳細 ›</Text>
    </Pressable> : null}
    <View style={card}>
      <Text style={small}>{resume ? (Date.now() - (state.resume?.at ?? 0) > 7 * 86400000 ? 'また、ここから始めましょう' : '前回の続き') : 'まずは、ひとつ読んでみよう'}</Text>
      <Text style={{ ...text, fontSize: 20, lineHeight: 31, fontWeight: '800' }}>{start?.lesson.label.replace(/^Lesson\s+\d+\s*/, '') || '教材で基礎から学ぶ'}</Text>
      {start ? <Text style={small}>第{start.chapterNo}章 · {start.lesson.label.match(/^Lesson\s+\d+/)?.[0] ?? '教材'}</Text> : null}
      <Pressable accessibilityRole="button" onPress={() => start ? props.onResume(start.chapterNo, start.idx) : props.onGo('learn')}
        style={({ pressed }) => ({ minHeight: 50, backgroundColor: '#B13238', borderRadius: 12, padding: 13, alignItems: 'center', opacity: pressed ? 0.8 : 1 })}>
        <Text style={{ ...text, color: '#FFFFFF', fontWeight: '800' }}>{resume ? '続きから学ぶ' : '第1章から始める'} →</Text>
      </Pressable>
    </View>
    <View style={card}>
      <Text accessibilityRole="header" style={{ ...text, fontWeight: '800' }}>今日の積み重ね</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {[[today.lessons, '項目', '教材を閲覧'], [today.terms, '語', '用語を閲覧'], [today.checks, '問', '解答・自己確認']].map(([count, unit, label]) => <View key={label} style={{ flex: 1, minWidth: 0, gap: 5 }}>
          <Text style={{ color: c.fg, fontSize: 25, lineHeight: 36, fontWeight: '800' }}>{count}<Text style={{ fontSize: 12 }}> {unit}</Text></Text>
          <Text style={small}>{label}</Text>
        </View>)}
      </View>
      <View style={{ backgroundColor: c.goodSoft, padding: 12, borderRadius: 12, gap: 10 }}>
        <Text style={{ ...small, color: goodInk, fontWeight: '700' }}>この7日間で {days.filter(d => d.active).length} 日取り組みました</Text>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {days.map(day => <View key={day.date} accessible accessibilityLabel={`${day.date} ${day.active ? '学習の記録あり' : '記録なし'}`} style={{ flex: 1, alignItems: 'center', gap: 3 }}>
            <Text style={{ color: goodInk, fontSize: 18, lineHeight: 28 }}>{day.active ? '●' : '○'}</Text>
            <Text style={{ color: goodInk, fontSize: 11, lineHeight: 19 }}>{Number(day.date.slice(-2))}</Text>
          </View>)}
        </View>
      </View>
      <Text style={{ ...small, fontSize: 12 }}>教材・用語は30秒以上の閲覧後、画面を離れると記録。同じ項目は1日1回で、理解度を示す数ではありません。</Text>
    </View>
    <Text accessibilityRole="header" style={{ ...text, fontWeight: '800' }}>自分のペースで学ぶ</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {[
        ['教材', '図解とクイズで、基礎から', () => props.onGo('learn')],
        ['用語', '意味・具体例を確かめる', () => props.onGo('terms')],
        ['模試・成績', '本番形式で力を試す', () => props.onGo('mock')],
        ['相関図', '知識のつながりを見る', props.onRelation],
      ].map(([title, sub, action]) => <Pressable key={String(title)} accessibilityRole="button" onPress={action as () => void}
        style={({ pressed }) => ({ ...card, width: fontScale > 1.3 ? '100%' : '48%', flexGrow: 1, opacity: pressed ? 0.7 : 1 })}>
        <Text style={{ ...text, color: c.accent2, fontWeight: '800' }}>{title as string} ›</Text><Text style={small}>{sub as string}</Text>
      </Pressable>)}
    </View>
    <View style={card}>
      {row('★ お気に入りの用語', props.onFavTerms)}
      {row(`問題ブックマーク${bookmarkCount() ? ` · ${bookmarkCount()}件` : ''}`, props.onBookmarks)}
    </View>
    <View style={card}>
      <Text style={{ ...text, fontWeight: '800' }}>{left === null ? '試験日を決めて、見通しをつけよう' : left < 0 ? '試験、おつかれさまでした' : `試験まで、あと${left}日`}</Text>
      <Text style={small}>{examDateText() ?? '日付を登録すると、残り日数を確認できます。'}</Text>
      {row(left === null ? '試験日を登録' : '試験日を変更', props.onExamDate)}
    </View>
    <View style={card}>
      <Text style={{ ...text, fontWeight: '800' }}>少しずつ、教材をひと巡り</Text>
      <Text style={text}>閲覧したレッスン {studied} / {total}</Text>
      <View accessible accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: total || 1, now: studied }} style={{ height: 8, backgroundColor: c.card2, borderRadius: 4 }}>
        <View style={{ height: 8, width: `${total ? studied / total * 100 : 0}%`, backgroundColor: c.accent2, borderRadius: 4 }} />
      </View>
      <Text style={small}>正答率や復習したい問題は「模試・成績」で確認できます。</Text>
      {row('成績・復習を見る', () => props.onGo('mock'))}
      {row('試験の総合解説', props.onGuide)}
    </View>
    {row('このアプリについて・感想を送る', () => props.onGo('set'))}
  </ScrollView>;
}

export function HomeAppearance({ onClose }: { onClose: () => void }) {
  const { c, mode, setMode } = useTheme();
  useActivity();
  const current = activityState().hero;
  return <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 16 }}>
    <Pressable accessibilityRole="button" onPress={onClose} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: c.accent2, fontSize: 16 }}>‹ 戻る</Text></Pressable>
    <Text accessibilityRole="header" style={{ color: c.fg, fontSize: 24, lineHeight: 36, fontWeight: '800' }}>ホームの画像と外観</Text>
    <Text style={{ color: c.muted, fontSize: 14, lineHeight: 24 }}>好きな雰囲気で、学びを続けよう。いつでも変更できます。</Text>
    <Hero id={current} />
    <View accessibilityRole="radiogroup" accessibilityLabel="ヒーロー画像" style={{ gap: 10 }}>
      {HEROES.map(hero => <Pressable key={hero.id} accessibilityRole="radio" accessibilityState={{ checked: current === hero.id }}
        onPress={() => { void setHero(hero.id); }} style={{ borderWidth: 1, borderColor: current === hero.id ? c.accent2 : c.line, backgroundColor: current === hero.id ? c.accentSoft : c.card, borderRadius: 14, padding: 12, gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {hero.image ? <Image source={hero.image} accessible={false} style={{ width: 76, height: 64, borderRadius: 8, backgroundColor: '#0A1524' }} resizeMode={hero.id === 'classic' ? 'contain' : 'cover'} /> : null}
          <View style={{ flex: 1, gap: 4 }}><Text style={{ color: c.fg, fontSize: 17, lineHeight: 28, fontWeight: '700' }}>{current === hero.id ? '✓ ' : ''}{hero.title}</Text>
            <Text style={{ color: c.muted, fontSize: 13, lineHeight: 22 }}>{hero.description}</Text></View>
        </View>
      </Pressable>)}
    </View>
    <Text style={{ color: c.fg, fontSize: 18, lineHeight: 29, fontWeight: '700' }}>配色</Text>
    <Segmented<Mode> options={[{ key: 'system', label: '端末に合わせる' }, { key: 'light', label: 'ライト' }, { key: 'dark', label: 'ダーク' }]} value={mode} onChange={setMode} />
    <Text style={{ color: c.muted, fontSize: 13, lineHeight: 22 }}>画像と配色は、この端末に保存されます。</Text>
  </ScrollView>;
}

export function DeveloperMessage() {
  const { c } = useTheme();
  const paragraph = { color: c.fg, fontSize: 15, lineHeight: 27 } as const;
  return <View style={{ padding: 16, gap: 14 }}>
    <Text style={{ color: c.accent2, fontSize: 13, lineHeight: 22, fontWeight: '700' }}>開発者から</Text>
    <Text style={{ ...paragraph, fontSize: 19, lineHeight: 30, fontWeight: '800' }}>使ってくださり、ありがとうございます。</Text>
    <Text style={paragraph}>図解や解説を見直しながら、学びやすい教材を目指して改善を続けています。</Text>
    <Text style={paragraph}>使ってみた率直な感想を、App Storeでお聞かせください。これから受験する方が教材を選ぶ参考になり、開発を続ける励みにもなります。</Text>
    <Text style={{ ...paragraph, textAlign: 'right' }}>safa</Text>
    {[[ 'App Storeで評価する', openAppReview ], [ 'ご意見・ご要望を送る', openRequestEmail ]].map(([label, action]) => <Pressable key={String(label)} accessibilityRole="button" onPress={() => { void (action as () => Promise<void>)(); }}
      style={{ minHeight: 48, paddingVertical: 12, borderTopWidth: 1, borderColor: c.line }}><Text style={{ ...paragraph, color: c.accent2, fontWeight: '700' }}>{label as string} ↗</Text></Pressable>)}
    <Text style={{ color: c.muted, fontSize: 13, lineHeight: 22 }}>評価とお問い合わせは、どちらも任意です。</Text>
  </View>;
}
