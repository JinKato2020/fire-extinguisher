import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, Image, TextInput,
  useWindowDimensions,
} from 'react-native';
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
import { Icon, Ring, Tag, RadarChart, StreakBars, Segmented, type RadarAxis, type RadarSeries } from './src/ui/components';

type TabKey = 'home' | 'learn' | 'terms' | 'mock' | 'set';
type ModalKey = 'bookmarks' | 'relation' | 'guide' | 'examdate' | null;

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
    const out: { type: string; text: string }[] = [];
    let inCode = false; let code: string[] = [];
    const strip = (x: string) => x.replace(/\*\*(.+?)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1');
    for (const raw of lines) {
      const ln = raw.replace(/\s+$/, '');
      if (ln.trim().startsWith('```')) {
        if (inCode) { out.push({ type: 'code', text: code.join('\n') }); code = []; }
        inCode = !inCode; continue;
      }
      if (inCode) { code.push(raw); continue; }
      const fig = ln.trim().match(/^\[\[fig:([^|\]]+)\|?([^\]]*)\]\]$/);
      if (fig) { out.push({ type: 'fig', text: fig[1] + '\u0001' + (fig[2] || '') }); continue; }
      if (ln.trim().startsWith('【図】')) { out.push({ type: 'figpending', text: ln.trim().slice(3) }); continue; }
      if (ln === '') { out.push({ type: 'gap', text: '' }); continue; }
      if (ln.startsWith('### ')) { out.push({ type: 'h3', text: strip(ln.slice(4)) }); continue; }
      if (ln.startsWith('## ')) { out.push({ type: 'h2', text: strip(ln.slice(3)) }); continue; }
      if (ln.startsWith('# ')) { out.push({ type: 'h1', text: strip(ln.slice(2)) }); continue; }
      if (ln.startsWith('> ')) { out.push({ type: 'quote', text: strip(ln.slice(2)) }); continue; }
      if (ln.startsWith('|')) { out.push({ type: 'table', text: ln.replace(/\|/g, '  ').trim() }); continue; }
      if (/^[-*] /.test(ln.trim())) { out.push({ type: 'li', text: strip(ln.trim().slice(2)) }); continue; }
      if (/^---+$/.test(ln.trim())) { out.push({ type: 'hr', text: '' }); continue; }
      out.push({ type: 'p', text: strip(ln) });
    }
    return out;
  }, [body]);

  return (
    <View>
      {blocks.map((b, i) => {
        if (b.type === 'fig') {
          const [asset, cap] = b.text.split('\u0001');
          const uri = getFigureUri(asset);
          return (
            <View key={i} style={{ marginVertical: 10 }}>
              {uri
                ? <Image source={{ uri }} style={{ width: imgW, height: imgW / 1.6, backgroundColor: '#fff', borderRadius: 8 }} resizeMode="contain" />
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
        if (b.type === 'table') return <Text key={i} style={s.tableTxt}>{b.text}</Text>;
        if (b.type === 'li') return <Text key={i} style={s.mdP}>{'・' + b.text}</Text>;
        return <Text key={i} style={s.mdP}>{b.text}</Text>;
      })}
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
function HomeScreen({ onGo, onModal, ver }: { onGo: (t: TabKey) => void; onModal: (m: ModalKey) => void; ver: number }) {
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
  const guideImg = resolved === 'light'
    ? require('./assets/examguide-light.png')
    : require('./assets/examguide-dark.png');

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
      <View>
        <Image source={require('./assets/hero.jpg')} style={{ width: heroW, height: heroW * (888 / 853) }} resizeMode="cover" />
        <View style={s.heroFade} pointerEvents="none" />
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
          <Text style={[s.cardTitle, { alignSelf: 'flex-start' }]}>分野ごとの実力</Text>
          <SubjectRadar compact />
        </View>

        {/* メニュー6カード */}
        <View style={s.grid}>
          <MenuTile icon="book" title="教材" sub={'基礎から\nしっかり学ぶ'} onPress={() => onGo('learn')} />
          <MenuTile icon="doc" title="模試・成績" sub={'本番形式で\n実力を試す'} onPress={() => onGo('mock')} />
          <MenuTile icon="refresh" title="弱点復習" sub={'苦手を\n克服する'} onPress={() => onGo('mock')} />
          <MenuTile icon="terms" title="用語集" sub={'重要用語を\n確認する'} onPress={() => onGo('terms')} />
          <MenuTile icon="map" title="相関図" sub={'用語のつながり\nを見る'} soon onPress={() => onModal('relation')} />
          <MenuTile icon="bookmark" title="ブックマーク" sub={'気になる問題を\n見返す'} badge={bmCount > 0 ? String(bmCount) : undefined} onPress={() => onModal('bookmarks')} />
        </View>

        {/* 試験総合解説カード */}
        <Pressable style={({ pressed }) => [s.guideCard, pressed && s.pressed]} onPress={() => onModal('guide')}>
          <Image source={guideImg} style={s.guideImg} resizeMode="cover" />
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
        </View>

        <Text style={s.footer}>コツコツが、合格への一番の近道です。</Text>
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

function Reader({ chapter, onBack }: { chapter: Chapter; onBack: () => void }) {
  const s = useStyles();
  return (
    <View style={{ flex: 1 }}>
      <View style={s.readerBar}>
        <Pressable onPress={onBack} hitSlop={10} style={({ pressed }) => [s.backBtn, pressed && s.pressed]}>
          <Text style={s.backTxt}>‹ 教材一覧</Text>
        </Pressable>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={[s.pad, { paddingBottom: 40, paddingTop: 6 }]} showsVerticalScrollIndicator={false}>
        {chapter.body
          ? <Markdown body={chapter.body} />
          : <View style={s.soon}><Text style={s.soonBig}>準備中</Text><Text style={s.soonTxt}>{'第' + chapter.no + '章「' + chapter.title + '」の解説はこれから追加します。'}</Text></View>}
      </ScrollView>
    </View>
  );
}

// ---- 用語集 ----
function GlossaryScreen({ onBump, ver }: { onBump: () => void; ver: number }) {
  const { c } = useTheme();
  const s = useStyles();
  const [q, setQ] = useState('');
  const [ch, setCh] = useState<string>('all');
  const [favOnly, setFavOnly] = useState(false);
  const terms = useMemo(() => getGlossary(), [ver]);

  const chips = [{ key: 'all', label: 'すべて' }, ...['1', '2', '3', '4', '5', '6'].map((k) => ({ key: k, label: CHAPTER_SHORT[k] }))];
  const filtered = terms.filter((t) => {
    if (ch !== 'all' && t.chapter !== ch) return false;
    if (favOnly && !isFavTerm(t.term)) return false;
    if (q.trim()) {
      const needle = q.trim();
      if (!(t.term.includes(needle) || (t.reading ?? '').includes(needle) || t.def.includes(needle))) return false;
    }
    return true;
  });

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 28 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={s.pad}>
        <View style={s.viewHead}>
          <Text style={s.eyebrow}>GLOSSARY</Text>
          <Text style={s.viewH2}>用語集</Text>
          <Text style={s.viewSub}>消火器と法令の重要用語をまとめました。★でお気に入りに登録できます。</Text>
        </View>

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

        <View style={s.chipRow}>
          {chips.map((cp) => (
            <Pressable key={cp.key} onPress={() => setCh(cp.key)} style={[s.chip, ch === cp.key && s.chipOn]}>
              <Text style={[s.chipTxt, ch === cp.key && s.chipTxtOn]}>{cp.label}</Text>
            </Pressable>
          ))}
          <Pressable onPress={() => setFavOnly((v) => !v)} style={[s.chip, favOnly && s.chipOn]}>
            <Text style={[s.chipTxt, favOnly && s.chipTxtOn]}>★ お気に入り</Text>
          </Pressable>
        </View>

        {filtered.length === 0 ? (
          <Text style={[s.radarEmpty, { marginTop: 24 }]}>該当する用語がありません。</Text>
        ) : filtered.map((t) => (
          <TermCard key={t.id} term={t} onBump={onBump} />
        ))}
      </View>
    </ScrollView>
  );
}

function TermCard({ term, onBump }: { term: Term; onBump: () => void }) {
  const { c } = useTheme();
  const s = useStyles();
  const fav = isFavTerm(term.term);
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
      {term.related && term.related.length > 0 ? (
        <Text style={s.termRel}>{'関連: ' + term.related.join('、')}</Text>
      ) : null}
    </View>
  );
}

// ---- 模試・成績 ----
function MockScoreScreen({ onBump }: { onBump: () => void }) {
  const [session, setSession] = useState<{ title: string; questions: Question[] } | null>(null);
  const s = useStyles();

  if (session) {
    return <QuizPlayer title={session.title} questions={session.questions} onExit={() => { setSession(null); onBump(); }} onBump={onBump} />;
  }

  const sets = getQuizSets();
  const all = getAllQuestions();
  const { weak } = selectReview(all.map((qq) => qq.id));
  const stats = overallStats();

  const startSet = (set: QuizSet) => setSession({ title: set.title, questions: getQuestions(set.file) });
  const startReview = () => {
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

        {/* 分野別レーダー */}
        <View style={s.radarCard}>
          <Text style={[s.cardTitle, { alignSelf: 'flex-start' }]}>分野ごとの実力</Text>
          <SubjectRadar />
        </View>

        {/* 弱点復習 */}
        <Pressable
          disabled={weak.length === 0}
          onPress={startReview}
          style={({ pressed }) => [s.reviewBtn, weak.length === 0 && s.btnDisabled, pressed && s.pressed]}
        >
          <Text style={s.reviewBtnTitle}>弱点復習</Text>
          <Text style={s.reviewBtnSub}>{weak.length > 0 ? `要復習 ${weak.length} 問` : '誤答・自信なしが貯まると出題されます'}</Text>
        </Pressable>

        <Text style={s.sectionHead}>問題セット</Text>
        <View style={{ gap: 10 }}>
          {sets.map((set) => (
            <Pressable key={set.id} style={({ pressed }) => [s.ch, pressed && s.pressed]} onPress={() => startSet(set)}>
              <View style={s.chNo}><Text style={s.chNoTxt}>{set.chapter}</Text></View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.chTitle}>{set.title}</Text>
                <Text style={s.chSub}>{'筆記 ' + set.count + ' 問'}</Text>
              </View>
              <Text style={s.chGo}>›</Text>
            </Pressable>
          ))}
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
function SettingsScreen({ onModal, onSync, syncing }: { onModal: (m: ModalKey) => void; onSync: () => void; syncing: boolean }) {
  const { mode, setMode } = useTheme();
  const s = useStyles();
  const dateText = examDateText();
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
      <View style={s.pad}>
        <View style={s.viewHead}>
          <Text style={s.eyebrow}>SETTINGS</Text>
          <Text style={s.viewH2}>設定</Text>
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

// ---- モーダル: 相関図(準備中) ----
function RelationMapScreen({ onClose }: { onClose: () => void }) {
  const s = useStyles();
  return (
    <View style={{ flex: 1 }}>
      <View style={s.modalBar}>
        <Pressable onPress={onClose} hitSlop={10} style={({ pressed }) => [s.backBtn, pressed && s.pressed]}><Text style={s.backTxt}>‹ 閉じる</Text></Pressable>
        <Text style={s.modalTitle}>相関図</Text>
        <View style={{ width: 56 }} />
      </View>
      <View style={s.soon}>
        <Icon name="map" size={40} />
        <Text style={s.soonTitle}>相関図は準備中です</Text>
        <Text style={s.soonTxt}>{'章ごとの重要用語のつながりを図でまとめた「相関図」を、次のアップデートで追加します。'}</Text>
      </View>
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
  const [openNo, setOpenNo] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalKey>(null);
  const [syncing, setSyncing] = useState(false);
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

  const chapters = useMemo(() => getChapters(), [contentVersion]);
  const openChapter = openNo ? (chapters.find((x) => x.no === openNo) ?? null) : null;

  const goTab = (t: TabKey) => { setTab(t); if (t !== 'learn') setOpenNo(null); };

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
            </>
          ) : (
            <>
              {tab === 'home' && <HomeScreen onGo={goTab} onModal={setModal} ver={dataVersion} />}
              {tab === 'learn' && (openChapter
                ? <Reader chapter={openChapter} onBack={() => setOpenNo(null)} />
                : <LearnScreen chapters={chapters} onOpen={(x) => setOpenNo(x.no)} />)}
              {tab === 'terms' && <GlossaryScreen onBump={bump} ver={dataVersion} />}
              {tab === 'mock' && <MockScoreScreen onBump={bump} />}
              {tab === 'set' && <SettingsScreen onModal={setModal} onSync={doSync} syncing={syncing} />}
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
