import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Image,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, G } from 'react-native-svg';
import { BUILD_NUMBER } from './src/buildInfo';
import { initContent } from './src/data/initContent';
import { getChapters, type Chapter } from './src/data/chapters';
import { getQuizSets, getQuestions, getAllQuestions, type Question, type QuizSet } from './src/data/questions';
import { loadHistory, recordAnswer, selectReview } from './src/data/history';

// 参考画像「ミッドナイトキャンパス」から採取した配色
const C = {
  bg: '#060e1a',
  app: '#0a1524',
  card: '#101e33',
  card2: '#0e1a2c',
  line: 'rgba(255,255,255,0.08)',
  fg: '#eef3f9',
  muted: '#95a7bd',
  muted2: '#6f8299',
  red: '#d8383d',
  redDark: '#b32a30',
  teal: '#3ad7a6',
};

type TabKey = 'home' | 'learn' | 'mock' | 'score' | 'set';

// 章一覧(Chapter型)は src/data/chapters.ts(content/index.json 起点)から取得する。OTAで差し替え可能。

// ---- アイコン(react-native-svg) ----
function Icon({ name, size = 23, color = C.muted2 }: { name: string; size?: number; color?: string }) {
  const p = { stroke: color, strokeWidth: 1.8, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const vb = '0 0 24 24';
  switch (name) {
    case 'home':
      return <Svg width={size} height={size} viewBox={vb}><Path {...p} d="M3 11.5 12 4l9 7.5" /><Path {...p} d="M5 10v10h14V10" /></Svg>;
    case 'book':
      return <Svg width={size} height={size} viewBox={vb}><Path {...p} d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v15H5.5A1.5 1.5 0 0 0 4 20.5z" /><Path {...p} d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v15h5.5A1.5 1.5 0 0 1 20 20.5z" /></Svg>;
    case 'search':
      return <Svg width={size} height={size} viewBox={vb}><Circle {...p} cx={11} cy={11} r={7} /><Path {...p} d="m20 20-3.2-3.2" /></Svg>;
    case 'doc':
      return <Svg width={size} height={size} viewBox={vb}><Path {...p} d="M6 3h9l3 3v15H6z" /><Path {...p} d="M9 9h6M9 13h6M9 17h4" /></Svg>;
    case 'refresh':
      return <Svg width={size} height={size} viewBox={vb}><Path {...p} d="M21 12a9 9 0 1 1-3-6.7" /><Path {...p} d="M21 4v4h-4" /></Svg>;
    case 'bars':
      return <Svg width={size} height={size} viewBox={vb}><Path {...p} d="M5 20V10M12 20V4M19 20v-6" /></Svg>;
    case 'gear':
      return <Svg width={size} height={size} viewBox={vb}><Circle {...p} cx={12} cy={12} r={3} /><Path {...p} d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" /></Svg>;
    default:
      return null;
  }
}

function Ring({ pct }: { pct: number }) {
  const r = 34, c = 2 * Math.PI * r;
  const off = c * (1 - pct / 100);
  return (
    <View style={{ width: 92, height: 92, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={92} height={92} viewBox="0 0 92 92" style={{ position: 'absolute' }}>
        <Circle cx={46} cy={46} r={r} stroke="rgba(255,255,255,0.09)" strokeWidth={9} fill="none" />
        <G rotation={-90} origin="46, 46">
          <Circle cx={46} cy={46} r={r} stroke={C.teal} strokeWidth={9} fill="none"
            strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} />
        </G>
      </Svg>
      <Text style={styles.ringVal}>{pct}%</Text>
      <Text style={styles.ringLbl}>学習進捗</Text>
    </View>
  );
}

function Tag({ label, kind }: { label: string; kind: NonNullable<Chapter['tagKind']> }) {
  const map = {
    hard: ['rgba(216,56,61,0.16)', '#ff9ea1'],
    mid: ['rgba(240,180,80,0.14)', '#f3c67a'],
    easy: ['rgba(58,215,166,0.14)', '#7ee9c8'],
    done: ['rgba(58,215,166,0.16)', '#7ee9c8'],
  }[kind];
  return (
    <View style={[styles.tag, { backgroundColor: map[0] }]}>
      <Text style={[styles.tagTxt, { color: map[1] }]}>{label}</Text>
    </View>
  );
}

// ---- 軽量マークダウン表示 ----
function Markdown({ body }: { body: string }) {
  const blocks = useMemo(() => {
    const lines = body.split('\n');
    const out: { type: string; text: string }[] = [];
    let inCode = false; let code: string[] = [];
    const strip = (s: string) => s.replace(/\*\*(.+?)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1');
    for (const raw of lines) {
      const ln = raw.replace(/\s+$/, '');
      if (ln.trim().startsWith('```')) {
        if (inCode) { out.push({ type: 'code', text: code.join('\n') }); code = []; }
        inCode = !inCode; continue;
      }
      if (inCode) { code.push(raw); continue; }
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
        if (b.type === 'gap') return <View key={i} style={{ height: 8 }} />;
        if (b.type === 'hr') return <View key={i} style={styles.hr} />;
        if (b.type === 'h1') return <Text key={i} style={styles.mdH1}>{b.text}</Text>;
        if (b.type === 'h2') return <Text key={i} style={styles.mdH2}>{b.text}</Text>;
        if (b.type === 'h3') return <Text key={i} style={styles.mdH3}>{b.text}</Text>;
        if (b.type === 'quote') return <View key={i} style={styles.quote}><Text style={styles.quoteTxt}>{b.text}</Text></View>;
        if (b.type === 'code') return <View key={i} style={styles.code}><Text style={styles.codeTxt}>{b.text}</Text></View>;
        if (b.type === 'table') return <Text key={i} style={styles.tableTxt}>{b.text}</Text>;
        if (b.type === 'li') return <Text key={i} style={styles.mdP}>{'・' + b.text}</Text>;
        return <Text key={i} style={styles.mdP}>{b.text}</Text>;
      })}
    </View>
  );
}

function HomeScreen({ onGo }: { onGo: (t: TabKey) => void }) {
  const { width } = useWindowDimensions();
  const heroW = Math.min(width, 440);
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
      <View>
        <Image source={require('./assets/hero.jpg')} style={{ width: heroW, height: heroW * (888 / 853) }} resizeMode="cover" />
        <View style={styles.heroFade} pointerEvents="none" />
      </View>

      <View style={styles.pad}>
        <View style={styles.stats}>
          <View style={styles.statsTop}>
            <Ring pct={38} />
            <View style={styles.statNums}>
              <View style={styles.stat}>
                <Text style={styles.statLbl}>解いた問題</Text>
                <Text style={styles.statNum}>240<Text style={styles.statUnit}> 問</Text></Text>
              </View>
              <View style={styles.vdiv} />
              <View style={styles.stat}>
                <Text style={styles.statLbl}>正答率</Text>
                <Text style={styles.statNum}>78<Text style={styles.statUnit}> %</Text></Text>
              </View>
            </View>
          </View>
          <View style={styles.bar}><View style={styles.barFill} /></View>
          <Text style={styles.tip}>コツコツが、合格への一番の近道です。</Text>
        </View>

        <Pressable style={({ pressed }) => [styles.cta, pressed && styles.pressed]} onPress={() => onGo('learn')}>
          <Text style={styles.ctaTxt}>学習を始める</Text>
          <Text style={styles.ctaArw}>›</Text>
        </Pressable>

        <View style={styles.grid}>
          <MenuTile icon="book" title="教材" sub={'基礎から\nしっかり学ぶ'} onPress={() => onGo('learn')} />
          <MenuTile icon="search" teal title="鑑別トレーニング" sub={'見分ける力を\n身につける'} onPress={() => onGo('mock')} />
          <MenuTile icon="doc" teal title="模擬試験" sub={'本番形式で\n実力を試す'} onPress={() => onGo('mock')} />
          <MenuTile icon="refresh" title="弱点復習" sub={'苦手を克服して\n得点力を上げる'} onPress={() => onGo('score')} />
        </View>
      </View>
    </ScrollView>
  );
}

function MenuTile({ icon, title, sub, teal, onPress }: { icon: string; title: string; sub: string; teal?: boolean; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.tile, pressed && styles.pressed]} onPress={onPress}>
      <View style={[styles.tileIco, teal ? styles.tileIcoTeal : styles.tileIcoRed]}>
        <Icon name={icon} size={20} color={teal ? '#7ee9c8' : '#ff9ea1'} />
      </View>
      <Text style={styles.tileTitle}>{title}</Text>
      <Text style={styles.tileSub}>{sub}</Text>
      <Text style={styles.tileGo}>›</Text>
    </Pressable>
  );
}

function LearnScreen({ chapters, onOpen }: { chapters: Chapter[]; onOpen: (c: Chapter) => void }) {
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
      <View style={styles.pad}>
        <View style={styles.viewHead}>
          <Text style={styles.eyebrow}>STUDY</Text>
          <Text style={styles.viewH2}>学習 ― 教材</Text>
          <Text style={styles.viewSub}>章を選んで、読んで学ぶ。難しい章ほど解説を厚くしています。</Text>
        </View>
        <View style={{ gap: 10, marginTop: 16 }}>
          {chapters.map((c) => (
            <Pressable key={c.no} style={({ pressed }) => [styles.ch, pressed && styles.pressed]} onPress={() => onOpen(c)}>
              <View style={styles.chNo}><Text style={styles.chNoTxt}>{c.no}</Text></View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                  <Text style={styles.chTitle}>{c.title}</Text>
                  {c.tag && c.tagKind ? <Tag label={c.tag} kind={c.tagKind} /> : null}
                  {c.body ? <Tag label="解説あり" kind="done" /> : null}
                </View>
                <Text style={styles.chSub}>{c.sub}</Text>
              </View>
              <Text style={styles.chGo}>›</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

function Reader({ chapter, onBack }: { chapter: Chapter; onBack: () => void }) {
  return (
    <View style={{ flex: 1 }}>
      <View style={styles.readerBar}>
        <Pressable onPress={onBack} hitSlop={10} style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}>
          <Text style={styles.backTxt}>‹ 教材一覧</Text>
        </Pressable>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.pad, { paddingBottom: 40, paddingTop: 6 }]} showsVerticalScrollIndicator={false}>
        {chapter.body
          ? <Markdown body={chapter.body} />
          : <View style={styles.soon}><Text style={styles.soonBig}>準備中</Text><Text style={styles.soonTxt}>{'第' + chapter.no + '章「' + chapter.title + '」の解説はこれから追加します。'}</Text></View>}
      </ScrollView>
    </View>
  );
}

function Placeholder({ emoji, title, desc }: { emoji: string; title: string; desc: string }) {
  return (
    <View style={styles.soon}>
      <Text style={{ fontSize: 40, opacity: 0.5 }}>{emoji}</Text>
      <Text style={styles.soonTitle}>{title}</Text>
      <Text style={styles.soonTxt}>{desc}</Text>
    </View>
  );
}

function TabBar({ tab, onTab, insetBottom }: { tab: TabKey; onTab: (t: TabKey) => void; insetBottom: number }) {
  const items: { key: TabKey; icon: string; label: string }[] = [
    { key: 'home', icon: 'home', label: 'ホーム' },
    { key: 'learn', icon: 'book', label: '学習' },
    { key: 'mock', icon: 'doc', label: '模試' },
    { key: 'score', icon: 'bars', label: '成績' },
    { key: 'set', icon: 'gear', label: '設定' },
  ];
  return (
    <View style={[styles.tabbar, { paddingBottom: insetBottom || 6 }]}>
      {items.map((it) => {
        const active = it.key === tab;
        return (
          <Pressable key={it.key} style={styles.tab} onPress={() => onTab(it.key)}>
            {active ? <View style={styles.tabDot} /> : null}
            <Icon name={it.icon} size={23} color={active ? C.red : C.muted2} />
            <Text style={[styles.tabLabel, { color: active ? C.red : C.muted2 }]}>{it.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---- 問題演習（模試タブ） ----
const QLABEL = ['1', '2', '3', '4', '5'];

function QuizFlow() {
  const [session, setSession] = useState<{ title: string; questions: Question[] } | null>(null);

  if (session) {
    return <QuizPlayer title={session.title} questions={session.questions} onExit={() => setSession(null)} />;
  }

  const sets = getQuizSets();
  const all = getAllQuestions();
  const { weak } = selectReview(all.map((q) => q.id));

  const startSet = (s: QuizSet) => setSession({ title: s.title, questions: getQuestions(s.file) });
  const startReview = () => {
    const { weak: w, unseen } = selectReview(all.map((q) => q.id));
    const order = [...w, ...unseen];
    const byId: Record<string, Question> = {};
    for (const q of all) byId[q.id] = q;
    setSession({ title: '弱点復習', questions: order.map((id) => byId[id]).filter(Boolean) });
  };

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
      <View style={styles.pad}>
        <View style={styles.viewHead}>
          <Text style={styles.eyebrow}>PRACTICE</Text>
          <Text style={styles.viewH2}>問題演習</Text>
          <Text style={styles.viewSub}>章ごとに解いて、間違えた問題や「自信なし」は弱点復習でもう一度。</Text>
        </View>

        <Pressable
          disabled={weak.length === 0}
          onPress={startReview}
          style={({ pressed }) => [styles.reviewBtn, weak.length === 0 && styles.btnDisabled, pressed && styles.pressed]}
        >
          <Text style={styles.reviewBtnTitle}>弱点復習</Text>
          <Text style={styles.reviewBtnSub}>{weak.length > 0 ? `要復習 ${weak.length} 問` : '誤答・自信なしが貯まると出題されます'}</Text>
        </Pressable>

        <View style={{ gap: 10, marginTop: 14 }}>
          {sets.map((s) => (
            <Pressable key={s.id} style={({ pressed }) => [styles.ch, pressed && styles.pressed]} onPress={() => startSet(s)}>
              <View style={styles.chNo}><Text style={styles.chNoTxt}>{s.chapter}</Text></View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.chTitle}>{s.title}</Text>
                <Text style={styles.chSub}>{'筆記 ' + s.count + ' 問'}</Text>
              </View>
              <Text style={styles.chGo}>›</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

function QuizPlayer({ title, questions, onExit }: { title: string; questions: Question[]; onExit: () => void }) {
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [lowConf, setLowConf] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [finished, setFinished] = useState(false);

  if (questions.length === 0) {
    return (
      <View style={{ flex: 1 }}>
        <View style={styles.readerBar}>
          <Pressable onPress={onExit} hitSlop={10} style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}>
            <Text style={styles.backTxt}>‹ 問題一覧</Text>
          </Pressable>
        </View>
        <View style={styles.soon}><Text style={styles.soonBig}>対象なし</Text><Text style={styles.soonTxt}>いま出題できる問題がありません。</Text></View>
      </View>
    );
  }

  const reset = () => { setIdx(0); setSelected(null); setRevealed(false); setLowConf(false); setCorrectCount(0); setFinished(false); };

  if (finished) {
    const pct = Math.round((correctCount / questions.length) * 100);
    return (
      <View style={{ flex: 1 }}>
        <View style={styles.readerBar}>
          <Pressable onPress={onExit} hitSlop={10} style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}>
            <Text style={styles.backTxt}>‹ 問題一覧</Text>
          </Pressable>
        </View>
        <View style={styles.soon}>
          <Text style={styles.soonTitle}>おつかれさまでした</Text>
          <Text style={styles.resultBig}>{correctCount} / {questions.length} 問正解</Text>
          <Text style={styles.soonTxt}>正答率 {pct}%</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
            <Pressable onPress={reset} style={({ pressed }) => [styles.ghostBtn, pressed && styles.pressed]}><Text style={styles.ghostBtnTxt}>もう一度</Text></Pressable>
            <Pressable onPress={onExit} style={({ pressed }) => [styles.submitBtn, { paddingHorizontal: 22 }, pressed && styles.pressed]}><Text style={styles.submitTxt}>終了</Text></Pressable>
          </View>
        </View>
      </View>
    );
  }

  const q = questions[idx];
  const isLast = idx === questions.length - 1;

  const submit = () => {
    if (selected === null) return;
    const ok = selected === q.answer;
    if (ok) setCorrectCount((c) => c + 1);
    void recordAnswer(q.id, ok, lowConf);
    setRevealed(true);
  };
  const next = () => {
    if (isLast) { setFinished(true); return; }
    setIdx((i) => i + 1); setSelected(null); setRevealed(false); setLowConf(false);
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.readerBar}>
        <Pressable onPress={onExit} hitSlop={10} style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}>
          <Text style={styles.backTxt}>‹ 問題一覧</Text>
        </Pressable>
        <Text style={styles.qProgress}>{title}　{idx + 1} / {questions.length}</Text>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.pad, { paddingBottom: 40, paddingTop: 8 }]} showsVerticalScrollIndicator={false}>
        {q.topic ? <Text style={styles.qTopic}>{q.topic}</Text> : null}
        <Text style={styles.qStem}>{q.stem}</Text>
        <View style={{ gap: 9, marginTop: 14 }}>
          {q.choices.map((c, i) => {
            const chosen = selected === i;
            const isCorrect = i === q.answer;
            const st = [
              styles.choice,
              revealed && isCorrect ? styles.choiceCorrect : null,
              revealed && !isCorrect && chosen ? styles.choiceWrong : null,
              !revealed && chosen ? styles.choiceSel : null,
            ];
            return (
              <Pressable key={i} disabled={revealed} onPress={() => setSelected(i)} style={st}>
                <Text style={styles.choiceNum}>{QLABEL[i]}</Text>
                <Text style={styles.choiceTxt}>{c}</Text>
              </Pressable>
            );
          })}
        </View>

        {!revealed ? (
          <>
            <Pressable onPress={() => setLowConf((v) => !v)} style={({ pressed }) => [styles.confToggle, lowConf && styles.confOn, pressed && styles.pressed]}>
              <Text style={[styles.confTxt, lowConf && styles.confTxtOn]}>{(lowConf ? '☑ ' : '☐ ') + '自信なし（復習に回す）'}</Text>
            </Pressable>
            <Pressable disabled={selected === null} onPress={submit} style={({ pressed }) => [styles.submitBtn, selected === null && styles.btnDisabled, pressed && styles.pressed]}>
              <Text style={styles.submitTxt}>解答する</Text>
            </Pressable>
          </>
        ) : (
          <View style={styles.explainBox}>
            <Text style={[styles.verdict, selected === q.answer ? styles.vOk : styles.vNg]}>
              {selected === q.answer ? '◯ 正解' : '✕ 不正解'}（正解：{QLABEL[q.answer]}）
            </Text>
            {q.explain ? <Text style={styles.explainTxt}>{q.explain}</Text> : null}
            {selected !== null && selected !== q.answer && q.whyWrong && q.whyWrong[selected]
              ? <Text style={styles.whyWrong}>{'あなたの選択（' + QLABEL[selected] + '）：' + q.whyWrong[selected]}</Text>
              : null}
            <Pressable onPress={next} style={({ pressed }) => [styles.submitBtn, { marginTop: 14 }, pressed && styles.pressed]}>
              <Text style={styles.submitTxt}>{isLast ? '結果を見る' : '次の問題 ›'}</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function Main() {
  const insets = useSafeAreaInsets();
  const [contentVersion, setContentVersion] = useState(0);
  const [tab, setTab] = useState<TabKey>('home');
  const [openNo, setOpenNo] = useState<string | null>(null);
  const { width } = useWindowDimensions();

  // 起動時にコンテンツ初期化（同梱＋前回キャッシュを反映→裏でR2から最新を取り込み、更新あれば再描画）。
  useEffect(() => {
    void loadHistory();
    initContent(() => setContentVersion((v) => v + 1));
  }, []);
  const chapters = useMemo(() => getChapters(), [contentVersion]);
  const openChapter = openNo ? (chapters.find((c) => c.no === openNo) ?? null) : null;

  const goTab = (t: TabKey) => { setTab(t); if (t !== 'learn') setOpenNo(null); };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={[styles.appCol, { width: Math.min(width, 440) }]}>
        <View style={{ flex: 1, paddingTop: tab === 'home' && !openChapter ? 0 : insets.top }}>
          {tab === 'home' && <HomeScreen onGo={goTab} />}
          {tab === 'learn' && (openChapter
            ? <Reader chapter={openChapter} onBack={() => setOpenNo(null)} />
            : <LearnScreen chapters={chapters} onOpen={(c) => setOpenNo(c.no)} />)}
          {tab === 'mock' && <QuizFlow />}
          {tab === 'score' && <Placeholder emoji="📊" title="成績" desc={'学習進捗・正答率・弱点の推移をここに表示します。\n(この画面はこれから作ります)'} />}
          {tab === 'set' && <Placeholder emoji="⚙️" title="設定" desc={'表示・通知・学習リマインドなど。\nビルド番号: ' + BUILD_NUMBER} />}
        </View>
        <TabBar tab={tab} onTab={goTab} insetBottom={insets.bottom} />
      </View>
      <StatusBar style="light" />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Main />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  appCol: { flex: 1, alignSelf: 'center', backgroundColor: C.app },
  pad: { paddingHorizontal: 16 },

  // 問題演習
  reviewBtn: { marginTop: 16, backgroundColor: '#15283f', borderWidth: 1, borderColor: 'rgba(58,215,166,0.35)', borderRadius: 14, padding: 15 },
  reviewBtnTitle: { color: C.teal, fontSize: 16, fontWeight: '900' },
  reviewBtnSub: { color: C.muted, fontSize: 12, marginTop: 3 },
  qProgress: { color: C.muted, fontSize: 13, fontWeight: '700' },
  qTopic: { color: C.teal, fontSize: 12, fontWeight: '800', marginBottom: 6 },
  qStem: { color: C.fg, fontSize: 17, lineHeight: 26, fontWeight: '700' },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 13 },
  choiceSel: { borderColor: C.red, backgroundColor: '#1a2234' },
  choiceCorrect: { borderColor: C.teal, backgroundColor: 'rgba(58,215,166,0.12)' },
  choiceWrong: { borderColor: C.red, backgroundColor: 'rgba(216,56,61,0.12)' },
  choiceNum: { color: C.muted, fontSize: 13, fontWeight: '900', width: 20, textAlign: 'center' },
  choiceTxt: { color: C.fg, fontSize: 15, flex: 1, lineHeight: 21 },
  confToggle: { marginTop: 16, alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: C.line },
  confOn: { borderColor: C.teal, backgroundColor: 'rgba(58,215,166,0.1)' },
  confTxt: { color: C.muted, fontSize: 13, fontWeight: '700' },
  confTxtOn: { color: C.teal },
  submitBtn: { marginTop: 16, backgroundColor: C.red, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  submitTxt: { color: '#fff', fontSize: 15, fontWeight: '900' },
  btnDisabled: { opacity: 0.4 },
  ghostBtn: { borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 22, alignItems: 'center' },
  ghostBtnTxt: { color: C.fg, fontSize: 15, fontWeight: '800' },
  explainBox: { marginTop: 18, backgroundColor: C.card2, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 15 },
  verdict: { fontSize: 15, fontWeight: '900', marginBottom: 8 },
  vOk: { color: C.teal },
  vNg: { color: '#ff8488' },
  explainTxt: { color: C.fg, fontSize: 14, lineHeight: 22 },
  whyWrong: { color: C.muted, fontSize: 13, lineHeight: 21, marginTop: 8 },
  resultBig: { color: C.fg, fontSize: 30, fontWeight: '900', marginTop: 10 },

  heroFade: { position: 'absolute', left: 0, right: 0, bottom: -1, height: 110, backgroundColor: 'transparent' },

  // stats
  stats: { marginTop: -58, backgroundColor: '#11223a', borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 16 },
  statsTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  ringVal: { color: C.fg, fontSize: 22, fontWeight: '900' },
  ringLbl: { color: C.muted, fontSize: 10, marginTop: 1 },
  statNums: { flex: 1, flexDirection: 'row', gap: 10 },
  stat: { flex: 1 },
  statLbl: { color: C.muted, fontSize: 11, marginBottom: 2 },
  statNum: { color: C.fg, fontWeight: '900', fontSize: 26 },
  statUnit: { color: C.muted, fontSize: 13, fontWeight: '700' },
  vdiv: { width: 1, backgroundColor: C.line, marginVertical: 2 },
  bar: { height: 6, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.08)', marginTop: 14, marginBottom: 10, overflow: 'hidden' },
  barFill: { height: 6, width: '38%', borderRadius: 99, backgroundColor: C.teal },
  tip: { color: C.muted, fontSize: 12 },

  // cta
  cta: { marginTop: 16, backgroundColor: C.red, borderRadius: 40, paddingVertical: 17, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  ctaTxt: { color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: 1 },
  ctaArw: { color: '#fff', fontSize: 20, position: 'absolute', right: 22 },
  pressed: { opacity: 0.85 },

  // grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 14 },
  tile: { width: '47.5%', flexGrow: 1, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 14, minHeight: 116 },
  tileIco: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  tileIcoRed: { backgroundColor: 'rgba(216,56,61,0.14)' },
  tileIcoTeal: { backgroundColor: 'rgba(58,215,166,0.14)' },
  tileTitle: { color: C.fg, fontSize: 16, fontWeight: '900', marginTop: 2 },
  tileSub: { color: C.muted, fontSize: 11.5, lineHeight: 17, marginTop: 4 },
  tileGo: { position: 'absolute', right: 12, bottom: 10, color: C.muted2, fontSize: 15 },

  // learn
  viewHead: { paddingTop: 18 },
  eyebrow: { color: C.teal, fontSize: 11, letterSpacing: 3, fontWeight: '700' },
  viewH2: { color: C.fg, fontSize: 24, fontWeight: '900', marginTop: 4 },
  viewSub: { color: C.muted, fontSize: 13, marginTop: 2 },
  ch: { flexDirection: 'row', alignItems: 'center', gap: 13, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 13 },
  chNo: { width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: C.line },
  chNoTxt: { color: C.fg, fontWeight: '900', fontSize: 15 },
  chTitle: { color: C.fg, fontSize: 14.5, fontWeight: '700' },
  chSub: { color: C.muted, fontSize: 11.5, marginTop: 2 },
  chGo: { color: C.muted2, fontSize: 16 },
  tag: { borderRadius: 99, paddingHorizontal: 7, paddingVertical: 2, marginLeft: 6 },
  tagTxt: { fontSize: 10, fontWeight: '700' },

  // reader
  readerBar: { paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.line },
  backBtn: { alignSelf: 'flex-start', paddingVertical: 4, paddingHorizontal: 6 },
  backTxt: { color: C.teal, fontSize: 14, fontWeight: '700' },
  mdH1: { color: C.fg, fontSize: 22, fontWeight: '900', marginTop: 10, marginBottom: 4 },
  mdH2: { color: C.fg, fontSize: 18, fontWeight: '900', marginTop: 16, marginBottom: 2 },
  mdH3: { color: C.fg, fontSize: 15, fontWeight: '700', marginTop: 10 },
  mdP: { color: '#d6e0ec', fontSize: 14.5, lineHeight: 23 },
  quote: { borderLeftWidth: 3, borderLeftColor: C.teal, backgroundColor: 'rgba(58,215,166,0.07)', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, marginVertical: 4 },
  quoteTxt: { color: '#cfe8df', fontSize: 14, lineHeight: 22 },
  code: { backgroundColor: '#07101d', borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 12, marginVertical: 6 },
  codeTxt: { color: '#bcd3ea', fontSize: 13, lineHeight: 20, fontFamily: 'Courier' },
  tableTxt: { color: '#c3d2e2', fontSize: 13, lineHeight: 21, fontFamily: 'Courier' },
  hr: { height: 1, backgroundColor: C.line, marginVertical: 12 },

  // placeholder / soon
  soon: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 40 },
  soonBig: { color: C.fg, fontSize: 22, fontWeight: '900' },
  soonTitle: { color: C.fg, fontSize: 20, fontWeight: '900' },
  soonTxt: { color: C.muted, fontSize: 13, textAlign: 'center', lineHeight: 20 },

  // tab bar
  tabbar: { flexDirection: 'row', backgroundColor: '#0b1626', borderTopWidth: 1, borderTopColor: C.line },
  tab: { flex: 1, alignItems: 'center', paddingTop: 9, paddingBottom: 8, gap: 4 },
  tabDot: { position: 'absolute', top: 0, left: '50%', marginLeft: -10, width: 20, height: 3, borderRadius: 3, backgroundColor: C.red },
  tabLabel: { fontSize: 10.5, fontWeight: '500' },
});
