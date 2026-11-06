import React, { useEffect, useState } from 'react';
import { AppState, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { activityState, localDay, recentActivity, setHero, type HeroId } from '../data/studyActivity';
import { useActivity } from './useStudyActivity';
import { parseLessons } from './lessons';
import type { Chapter } from '../data/chapters';
import { isLaunchFreeActive } from '../data/launchAccess';
import { recentDaily } from '../data/stats';
import { daysLeft, examDateText } from '../data/examDate';
import { bookmarkCount } from '../data/bookmarks';
import { openRequestEmail } from '../data/feedback';
import { Icon } from './components';
import { ExamDateEditor } from './ExamDateEditor';
import { noteFeedbackInteraction } from '../data/studyFeedback';
import { Artwork } from './Artwork';
import { ExamGuideArtwork } from './ExamGuideArtwork';
import { heroHeightLimit } from './artworkLayout';

export const HEROES: { id: HeroId; title: string; image?: ImageSourcePropType; ratio?: number }[] = [
  { id: 'anime', title: 'アニメ', image: require('../../assets/heroes/anime.png'), ratio: 2 },
  { id: 'photo', title: '実写', image: require('../../assets/heroes/photo.png'), ratio: 2 },
  { id: 'calm', title: '風景', image: require('../../assets/heroes/calm.png'), ratio: 2 },
  { id: 'classic', title: 'これまでの画像', image: require('../../assets/hero.jpg'), ratio: 853 / 888 },
  { id: 'none', title: '画像なし' },
];
/** Explicit bounds avoid native Image retaining the bundled asset's 887px height. */
export function HeroImage({ id }: { id: HeroId }) {
  const { height, fontScale } = useWindowDimensions();
  const hero = HEROES.find(h => h.id === id) ?? HEROES[0];
  return hero.image ? <Artwork source={hero.image} ratio={hero.ratio!} maxHeight={heroHeightLimit(height)} background="#152232"
    label={hero.id === 'classic' ? '消防設備士 乙種第6類 試験対策' : hero.title + 'のホーム画像'}>
    {hero.id !== 'classic' && fontScale <= 1.3 && height >= 600 ? <View style={{ position: 'absolute', left: 18, top: 20, width: '45%', gap: 8 }}>
      <View style={{ width: 24, height: 3, borderRadius: 2, backgroundColor: hero.id === 'calm' ? '#F2CB8D' : '#B13238' }} />
      <Text style={{ color: hero.id === 'calm' ? '#FFFFFF' : '#182B40', fontSize: 18, lineHeight: 28, fontWeight: '800' }}>{'今日の一歩を、\n合格の力に。'}</Text>
    </View> : null}
  </Artwork> : null;
}
type Props = {
  chapters: Chapter[]; ver: number; onGo: (tab: 'home' | 'learn' | 'terms' | 'mock' | 'set') => void;
  onResume: (chapterNo: string, lessonIdx: number) => void; onAppearance: () => void;
  onFavTerms: () => void; onBookmarks: () => void; onRelation: () => void; onGuide: () => void; onLicense: () => void;
};
export function HomeScreen(props: Props) {
  const { c, resolved } = useTheme();
  const { fontScale } = useWindowDimensions();
  const [activity, setActivity] = useState(false), [tools, setTools] = useState(false);
  const [, setDay] = useState(localDay);
  useEffect(() => {
    const tick = () => { if (AppState.currentState === 'active') setDay(localDay()); };
    const timer = setInterval(tick, 60_000);
    const sub = AppState.addEventListener('change', tick);
    return () => { clearInterval(timer); sub.remove(); };
  }, []);
  useActivity();
  const state = activityState();
  const all = props.chapters.flatMap(ch => parseLessons(ch.body ?? '').map((lesson, idx) => ({ chapterNo: ch.no, lesson, idx })));
  const resume = all.find(item => item.chapterNo === state.resume?.chapterNo && item.lesson.key === state.resume?.lessonKey);
  const start = resume ?? all.find(item => /^l\d+$/.test(item.lesson.key)) ?? all[0];
  const days = recentActivity(7, recentDaily(7)), today = days[days.length - 1], left = daysLeft();
  const stackedCountdown = fontScale > 1.3 || (left !== null && left >= 100);
  const studied = all.filter(item => /^l\d+$/.test(item.lesson.key) && state.readLessons.includes(item.chapterNo + ':' + item.lesson.key)).length;
  const total = all.filter(item => /^l\d+$/.test(item.lesson.key)).length;
  const good = resolved === 'light' ? '#246547' : '#81D9A4';
  const text = { color: c.fg, fontSize: 16, lineHeight: 26 } as const;
  const small = { color: c.muted, fontSize: 12, lineHeight: 21 } as const;
  const row = (title: string, action: () => void, icon: string) => <Pressable accessibilityRole="button" onPress={action}
    style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, minHeight: 48, opacity: pressed ? 0.6 : 1 })}>
    <Icon name={icon} size={20} color={c.muted} /><Text style={{ ...text, flex: 1 }}>{title}</Text><Text style={{ ...text, color: c.muted }}>›</Text>
  </Pressable>;
  return <ScrollView style={{ flex: 1 }} onScroll={noteFeedbackInteraction} scrollEventThrottle={200} contentContainerStyle={{ padding: 20, paddingTop: 12, paddingBottom: 28 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Icon name="flame" size={22} color={c.accent2} />
        <Text accessibilityRole="header" style={{ ...text, fontSize: 18, fontWeight: '800' }}>消防設備士 <Text style={{ color: c.muted, fontSize: 13 }}>乙6</Text></Text></View>
      {isLaunchFreeActive() ? <Pressable accessibilityRole="button" accessibilityLabel="無料ライセンスの利用状態" onPress={props.onLicense} style={{ minHeight: 44, justifyContent: 'center' }}>
        <Text style={{ ...small, color: good, fontWeight: '700' }}>✓ 全機能無料</Text></Pressable> : null}
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel={'ホームを編集：画像と試験日。' + (left === null ? '試験日未設定' : (left > 0 ? '試験まであと' + left + '日。' : left === 0 ? '今日は試験当日。' : '試験は終了しました。') + examDateText())} onPress={props.onAppearance}
      style={({ pressed }) => ({ borderRadius: 22, overflow: 'hidden', backgroundColor: '#152232', opacity: pressed ? 0.85 : 1 })}>
      <HeroImage id={state.hero} />
      <View style={{ padding: 20, paddingTop: 17, gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <Text style={{ color: '#F2CB8D', fontSize: 12, lineHeight: 21, fontWeight: '700', flex: 1 }}>{left === null ? '合格へ、目標を決めよう' : left < 0 ? '試験、おつかれさまでした' : left === 0 ? '今日は試験当日' : '試験まで、あと'}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><Icon name="gear" size={14} color="#C5D0DD" /><Text style={{ color: '#C5D0DD', fontSize: 11, lineHeight: 19 }}>編集</Text></View>
        </View>
        <View style={{ flexDirection: stackedCountdown ? 'column' : 'row', alignItems: stackedCountdown ? 'flex-start' : 'flex-end', gap: 10 }}>
          {left !== null && left >= 0 ? <Text accessibilityLabel={left === 0 ? '試験当日' : 'あと' + left + '日'}
            adjustsFontSizeToFit minimumFontScale={0.6} numberOfLines={1}
            style={{ color: '#FFFFFF', fontSize: String(left).length >= 4 ? 58 : 76, lineHeight: String(left).length >= 4 ? 68 : 84, fontWeight: '800', fontVariant: ['tabular-nums'], letterSpacing: -2, flexShrink: 1 }}>
            {left}<Text style={{ color: '#F2CB8D', fontSize: 22, fontWeight: '700', letterSpacing: 0 }}> 日</Text></Text>
            : <Text style={{ color: '#FFFFFF', fontSize: 23, lineHeight: 34, fontWeight: '800', flex: 1 }}>{left === null ? '試験日を登録する →' : 'ここまでの学びを、\n次の力に。'}</Text>}
          {left !== null ? <View style={{ flex: stackedCountdown ? undefined : 1, gap: 4, paddingBottom: 6 }}>
            <Text style={{ color: '#C5D0DD', fontSize: 11, lineHeight: 19 }}>{examDateText()}</Text>
            {left >= 0 ? <Text style={{ color: '#FFFFFF', fontSize: 11, lineHeight: 19 }}>{left === 0 ? '落ち着いて、いつもどおり。' : '一つずつ、確かな知識へ。'}</Text> : null}
          </View> : null}
        </View>
        {left === null ? <Text style={{ color: '#C5D0DD', fontSize: 12, lineHeight: 21 }}>画像も試験日も、ここから変更できます。</Text> : null}
      </View>
    </Pressable>
    <View style={{ marginTop: 22, marginBottom: 18 }}>
      <Text style={{ ...small, fontWeight: '700', marginBottom: 9 }}>{resume ? '前回の続きから' : '今日の一歩'}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={resume ? '続きから学ぶ' : '第1章から始める'} onPress={() => start ? props.onResume(start.chapterNo, start.idx) : props.onGo('learn')}
        style={({ pressed }) => ({ backgroundColor: c.card, borderWidth: 1, borderColor: c.line, borderLeftWidth: 4, borderLeftColor: '#B13238', borderRadius: 18, padding: 16, gap: 5, opacity: pressed ? 0.85 : 1 })}>
        {start ? <Text style={{ color: c.muted, fontSize: 12, lineHeight: 21 }}>第{start.chapterNo}章 · {start.lesson.label.match(/^Lesson\s+\d+/)?.[0] ?? '教材'}</Text> : null}
        <Text style={{ color: c.fg, fontSize: 18, lineHeight: 28, fontWeight: '800' }}>{start?.lesson.label.replace(/^Lesson\s+\d+\s*/, '') || '教材で基礎から学ぶ'}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 5 }}>
          <Text style={{ color: c.accent2, fontSize: 14, lineHeight: 24, fontWeight: '700' }}>{resume ? '続きから学ぶ' : '第1章から始める'}</Text>
          <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#B13238', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#FFFFFF', fontSize: 20 }}>→</Text></View>
        </View>
      </Pressable>
    </View>
    <View style={{ flexDirection: fontScale > 1.4 ? 'column' : 'row', gap: 12, marginBottom: 18 }}>
      {([['用語を復習', 'terms', 'terms'], ['模試に挑戦', 'doc', 'mock']] as const).map(([title, icon, tab]) => <Pressable key={tab} accessibilityRole="button" onPress={() => props.onGo(tab)}
        style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, borderRadius: 14, padding: 14, minHeight: 60, opacity: pressed ? 0.6 : 1 })}>
        <Icon name={icon} size={22} color={c.accent2} /><Text style={{ ...text, fontSize: 14, fontWeight: '700', flex: 1 }}>{title}</Text>
      </Pressable>)}
    </View>
    <View style={{ borderTopWidth: 1, borderBottomWidth: 1, borderColor: c.line, paddingVertical: 4 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="学習記録の詳細" accessibilityState={{ expanded: activity }} onPress={() => setActivity(v => !v)}
        style={{ minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 }}>
        <View style={{ flex: 1 }}><Text style={{ ...text, fontSize: 14, fontWeight: '700' }}>今日の記録</Text><Text style={small}>{today.active ? '教材 ' + today.lessons + ' · 用語 ' + today.terms + ' · 解答 ' + today.checks : '小さな積み重ねを、ここに。'}</Text></View>
        <Text style={{ ...small, color: good }}>7日間で {days.filter(d => d.active).length} 日</Text><Text style={{ ...text, color: c.muted }}>{activity ? '−' : '＋'}</Text>
      </Pressable>
      {activity ? <View style={{ paddingVertical: 12, gap: 12 }}>
        <View style={{ flexDirection: 'row', gap: 4 }}>{days.map(day => <View key={day.date} accessible accessibilityLabel={day.date + (day.active ? ' 学習あり' : ' 記録なし')} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
          <Text style={{ color: good, fontSize: 18, lineHeight: 26 }}>{day.active ? '●' : '○'}</Text><Text style={small}>{Number(day.date.slice(-2))}</Text></View>)}</View>
        <Text style={{ ...text, fontSize: 14 }}>閲覧したレッスン <Text style={{ fontWeight: '800' }}>{studied} / {total}</Text></Text>
        <Text style={small}>教材・用語は30秒以上の閲覧後に記録。同じ項目は1日1回です。解答には自己確認を含み、理解度や正解数を示すものではありません。</Text>
        {row('成績・復習を見る', () => props.onGo('mock'), 'bars')}
      </View> : null}
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel="試験の総合解説" onPress={props.onGuide}
      style={({ pressed }) => ({ marginVertical: 20, borderRadius: 18, overflow: 'hidden', backgroundColor: '#152232', opacity: pressed ? 0.85 : 1 })}>
      <ExamGuideArtwork link />
      <View style={{ paddingHorizontal: 18, paddingVertical: 12, borderTopWidth: 1, borderColor: '#334253' }}><Text style={{ color: '#D2DCE6', fontSize: 12, lineHeight: 21 }}>出題形式・合格ライン・時間配分を確認</Text></View>
    </Pressable>
    <View style={{ borderTopWidth: 1, borderColor: c.line }}>
      <Pressable accessibilityRole="button" accessibilityLabel="学習ツールを開く" accessibilityState={{ expanded: tools }} onPress={() => setTools(v => !v)} style={{ flexDirection: 'row', minHeight: 52, alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ ...text, fontSize: 14, color: c.muted }}>学習ツール</Text><Text style={{ ...text, color: c.muted }}>{tools ? '−' : '＋'}</Text>
      </Pressable>
      {tools ? <View>{row('相関図', props.onRelation, 'map')}{row('お気に入りの用語', props.onFavTerms, 'star')}{row('問題ブックマーク' + (bookmarkCount() ? ' · ' + bookmarkCount() + '件' : ''), props.onBookmarks, 'bookmark')}</View> : null}
    </View>
  </ScrollView>;
}
export function HomeAppearance({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { c } = useTheme();
  const [, setRevision] = useState(0);
  useActivity();
  const current = activityState().hero;
  return <View style={{ flex: 1 }}>
    <View style={{ paddingHorizontal: 20, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderColor: c.line }}>
      <Text accessibilityRole="header" style={{ color: c.fg, fontSize: 20, lineHeight: 30, fontWeight: '800', flex: 1 }}>ホームを編集</Text>
      <Pressable accessibilityRole="button" onPress={onClose} style={{ minHeight: 44, padding: 10, justifyContent: 'center' }}><Text style={{ color: c.accent2, fontSize: 16, fontWeight: '700' }}>完了</Text></Pressable>
    </View>
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 36, gap: 18 }}>
      <Text style={{ color: c.muted, fontSize: 13, lineHeight: 23 }}>試験日と画像は、選ぶと保存されます。</Text>
      <ExamDateEditor onSaved={() => { setRevision(v => v + 1); onSaved(); }} />
      <Text accessibilityRole="header" style={{ color: c.fg, fontSize: 18, lineHeight: 29, fontWeight: '800', marginTop: 8 }}>ホームの画像</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel="ヒーロー画像" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {HEROES.map(hero => <Pressable key={hero.id} accessibilityRole="radio" accessibilityState={{ checked: current === hero.id }} onPress={() => { void setHero(hero.id); }}
          style={{ width: '47%', flexGrow: 1, borderWidth: current === hero.id ? 2 : 1, borderColor: current === hero.id ? c.accent2 : c.line, borderRadius: 14, overflow: 'hidden', backgroundColor: c.card }}>
          {hero.image ? <Artwork source={hero.image} ratio={2} background={hero.id === 'classic' ? '#152232' : c.card2} />
            : <View style={{ aspectRatio: 2, alignItems: 'center', justifyContent: 'center' }}><Icon name="book" color={c.muted} size={28} /></View>}
          <Text style={{ color: c.fg, fontSize: 14, lineHeight: 24, fontWeight: '700', padding: 10 }}>{current === hero.id ? '✓ ' : ''}{hero.title}</Text>
        </Pressable>)}
      </View>
    </ScrollView>
  </View>;
}
export function DeveloperMessage() {
  const { c } = useTheme();
  return <View style={{ padding: 16, gap: 10 }}>
    <Text style={{ color: c.fg, fontSize: 16, lineHeight: 27, fontWeight: '700' }}>使ってくださり、ありがとうございます。</Text>
    <Text style={{ color: c.muted, fontSize: 14, lineHeight: 25 }}>図解や解説を見直しながら、改善を続けています。率直な感想が、次に学ぶ方の参考に、開発を続ける励みにもなります。</Text>
    <Pressable accessibilityRole="button" onPress={() => { void openRequestEmail(); }} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ color: c.accent2, fontSize: 15, lineHeight: 25, fontWeight: '700' }}>ご意見・ご要望を送る ↗</Text></Pressable>
    <Text style={{ color: c.muted, fontSize: 12, lineHeight: 21 }}>safa · 評価もお問い合わせも任意です。</Text>
  </View>;
}
