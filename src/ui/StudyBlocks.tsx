import React, { useMemo, useState } from 'react';
import { Alert, Linking, Pressable, Text, TextInput, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { useStudyRecall } from './StudyRecallContext';
import type { MarkdownBlock } from './markdown';
import { emphasisStyle, type EmphasisKind } from './emphasis';

/** Only authored HTTPS links are interactive; emphasis remains native scalable text. */
export function Inline({ text, field, offset = 0 }: { text: string; field?: string; offset?: number }) {
  const { c, resolved } = useTheme();
  const recall = useStudyRecall();
  let cursor = 0;
  return <>{text.split(/(\*\*.+?\*\*|\{\{[^{}\n]+?::(?:key|num|trap)\}\}|`[^`]+`|\[[^\]]+\]\(https:\/\/[^\s)]+\))/g).map((part, i) => {
    const start = cursor; cursor += part.length;
    const blank = part.match(/^\{\{(.+?)::(key|num|trap)\}\}$/);
    if (blank) {
      const id = `${field}:${offset + start}`;
      const selected = field ? recall?.selected.get(id) : undefined;
      const shown = recall?.revealed.has(id);
      const number = selected && recall ? [...recall.selected.keys()].indexOf(id) + 1 : 0;
      if (selected) return <Text key={i} accessibilityRole="button"
        accessibilityLabel={shown ? `空欄${number}の答え ${blank[1]}。タップで隠す` : `空欄${number}、${blank[2] === 'num' ? '数値' : blank[2] === 'trap' ? '条件・例外' : '用語・式'}の答えを表示`}
        onPress={() => recall?.toggle(id)} style={{ color: c.accent2, backgroundColor: c.accentSoft, fontWeight: '800', textDecorationLine: 'underline' }}>
        {shown ? `【${blank[1]}】` : `【${number} ${blank[2] === 'num' ? '数値' : blank[2] === 'trap' ? '条件' : '用語'}？】`}
      </Text>;
      return <Text key={i} style={blank[1].length <= 32 ? emphasisStyle(resolved === 'dark', blank[2] as EmphasisKind) : { fontWeight: '800' }}>{blank[1]}</Text>;
    }
    const link = part.match(/^\[([^\]]+)\]\((https:\/\/[^\s)]+)\)$/);
    if (link) return <Text key={i} accessibilityRole="link" style={{ color: c.accent2, textDecorationLine: 'underline' }}
      onPress={() => Linking.openURL(link[2]).catch(() => Alert.alert('リンクを開けませんでした', '通信環境を確認して、もう一度お試しください。'))}>{link[1]}</Text>;
    if (part.startsWith('**') && part.endsWith('**')) return <Text key={i} style={part.length <= 28 && !part.includes('{{') ? emphasisStyle(resolved === 'dark', 'key') : { fontWeight: '800' }}><Inline text={part.slice(2, -2)} field={field} offset={offset + start + 2} /></Text>;
    return part.startsWith('`') && part.endsWith('`') ? part.slice(1, -1) : part;
  })}</>;
}

export type StudyTableData = { title: string; headers: string[]; rows: string[][] };

type TableProps = { table: StudyTableData; uri: string | null; onZoom: (uri: string) => void };

export function isApplicabilityMatrix(table: StudyTableData) {
  return table.headers.length > 6 && table.rows.length > 0 && table.rows.every(row =>
    row.length === table.headers.length && row.slice(1).every(cell => /^(○|－)$/.test(cell.replace(/\*\*/g, ''))));
}

export function StudyTable(props: TableProps) {
  return isApplicabilityMatrix(props.table) ? <StudyMatrix {...props} /> : <StudyTableCards {...props} />;
}

/** A wide legal matrix stays readable without shrinking text or hiding columns. */
function StudyMatrix({ table, uri, onZoom }: TableProps) {
  const { c, resolved } = useTheme();
  const [selected, setSelected] = useState(0);
  const [choosing, setChoosing] = useState(false);
  const [query, setQuery] = useState('');
  const row = table.rows[selected] ?? table.rows[0];
  const clean = (text: string) => text.replace(/\*\*/g, '');
  const needle = query.trim().normalize('NFKC').toLocaleLowerCase();
  const options = table.rows.map((cells, index) => ({ label: clean(cells[0]), index }))
    .filter(option => option.label.normalize('NFKC').toLocaleLowerCase().includes(needle));
  const yes = table.headers.slice(1).filter((_, index) => clean(row[index + 1]) === '○');
  const no = table.headers.slice(1).filter((_, index) => clean(row[index + 1]) === '－');
  return <View style={{ marginVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: c.line, backgroundColor: c.card, padding: 14, gap: 12 }}>
    <Text accessibilityRole="header" style={{ color: c.fg, fontSize: 16, lineHeight: 27, fontWeight: '800' }}>{table.title}</Text>
    <Text style={{ color: c.muted, fontSize: 14, lineHeight: 24 }}>対象物を1つ選ぶと、消火器具の適応性を確認できます。</Text>
    <Text style={{ color: c.fg, fontSize: 17, lineHeight: 28, fontWeight: '800' }}><Inline text={row[0]} /></Text>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: choosing }} accessibilityLabel="適応性を確認する対象物を選ぶ"
      onPress={() => { setChoosing(value => !value); setQuery(''); }}
      style={({ pressed }) => ({ minHeight: 48, padding: 12, borderRadius: 10, backgroundColor: c.accentSoft, opacity: pressed ? 0.7 : 1 })}>
      <Text style={{ color: c.accent2, fontSize: 15, lineHeight: 24, fontWeight: '700', textAlign: 'center' }}>{choosing ? '対象物の一覧を閉じる −' : '対象物を変更する ＋'}</Text>
    </Pressable>
    {choosing ? <View style={{ gap: 8 }}>
      <TextInput value={query} onChangeText={setQuery} accessibilityLabel="適応性表の対象物を検索" placeholder="例：電気、第4類、指定可燃物"
        placeholderTextColor={c.muted} returnKeyType="search"
        style={{ color: c.fg, backgroundColor: c.card2, borderColor: c.line, borderWidth: 1, borderRadius: 10, padding: 12, minHeight: 48, fontSize: 16 }} />
      {!options.length ? <Text accessibilityLiveRegion="polite" style={{ color: c.muted, fontSize: 15, lineHeight: 25 }}>一致する対象物がありません。</Text> : null}
      {options.map(option => <Pressable key={option.index} accessibilityRole="button" accessibilityState={{ selected: selected === option.index }}
        onPress={() => { setSelected(option.index); setChoosing(false); setQuery(''); }}
        style={({ pressed }) => ({ minHeight: 48, padding: 12, borderWidth: 1, borderColor: selected === option.index ? c.accent2 : c.line,
          borderRadius: 10, backgroundColor: c.card2, opacity: pressed ? 0.7 : 1 })}>
        <Text style={{ color: c.fg, fontSize: 16, lineHeight: 27 }}>{option.label}{selected === option.index ? ' ✓' : ''}</Text>
      </Pressable>)}
    </View> : null}
    <View accessibilityLiveRegion="polite" style={{ gap: 12 }}>
      <View style={{ backgroundColor: c.goodSoft, borderRadius: 10, padding: 12, gap: 6 }}>
        <Text style={{ color: resolved === 'light' ? '#167443' : c.good, fontWeight: '800', fontSize: 15, lineHeight: 25 }}>○ 適応する</Text>
        {yes.map(label => <Text key={label} style={{ color: c.fg, fontSize: 16, lineHeight: 27 }}>・{label}</Text>)}
      </View>
      <View style={{ backgroundColor: c.card2, borderRadius: 10, padding: 12, gap: 6 }}>
        <Text style={{ color: c.fg, fontWeight: '800', fontSize: 15, lineHeight: 25 }}>－ 適応の表示なし</Text>
        {no.map(label => <Text key={label} style={{ color: c.fg, fontSize: 16, lineHeight: 27 }}>・{label}</Text>)}
      </View>
    </View>
    {uri ? <Pressable onPress={() => onZoom(uri)} accessibilityRole="button" accessibilityLabel={table.title + 'の全体表を拡大'}
      style={({ pressed }) => ({ minHeight: 48, padding: 12, opacity: pressed ? 0.7 : 1 })}>
      <Text style={{ color: c.accent2, fontSize: 14, lineHeight: 24, fontWeight: '700', textAlign: 'center' }}>全体表を拡大 ↗</Text>
    </Pressable> : null}
  </View>;
}

function StudyTableCards({ table, uri, onZoom }: TableProps) {
  const { c } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const large = table.rows.length > 6;
  const needle = query.trim().normalize('NFKC').toLocaleLowerCase();
  const filtered = useMemo(() => table.rows.filter(row => !needle || row.join(' ').normalize('NFKC').toLocaleLowerCase().includes(needle)), [table, needle]);
  const visible = large && !expanded && !needle ? filtered.slice(0, 3) : filtered;
  return <View style={{ marginVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: c.line, backgroundColor: c.card, padding: 14, gap: 12 }}>
    <Text accessibilityRole="header" style={{ color: c.fg, fontSize: 16, lineHeight: 26, fontWeight: '800' }}><Inline text={table.title.replace(/^\d+\.\s+/, '')} /></Text>
    {table.rows.length > 10 ? <TextInput accessibilityLabel={table.title + 'の項目を検索'} value={query} onChangeText={setQuery}
      placeholder="項目・キーワードで検索" placeholderTextColor={c.muted} returnKeyType="search"
      style={{ color: c.fg, backgroundColor: c.card2, borderColor: c.line, borderWidth: 1, borderRadius: 10, padding: 12, minHeight: 48, fontSize: 16 }} /> : null}
    {large ? <Text accessibilityLiveRegion="polite" style={{ color: c.muted, fontSize: 13, lineHeight: 21 }}>{needle ? `${filtered.length}件の検索結果` : `${visible.length} / ${table.rows.length}項目を表示`}</Text> : null}
    {visible.map((row, ri) => <View key={ri} style={{ backgroundColor: c.card2, borderRadius: 10, padding: 12, gap: 8 }}>
      <Text style={{ color: c.fg, fontSize: 16, lineHeight: 27, fontWeight: '700' }}><Inline text={row[0]} /></Text>
      {row.slice(1).map((cell, ci) => <View key={ci} style={{ gap: 2 }}>
        <Text style={{ color: c.muted, fontSize: 13, lineHeight: 21 }}>{table.headers[ci + 1]}</Text>
        <Text style={{ color: c.fg, fontSize: 16, lineHeight: 27 }}><Inline text={cell || '―'} /></Text>
      </View>)}
    </View>)}
    {!filtered.length ? <Text style={{ color: c.muted, fontSize: 15, lineHeight: 25 }}>一致する項目がありません。別のキーワードで検索してください。</Text> : null}
    {large && !expanded && !needle ? <Pressable onPress={() => setExpanded(true)} accessibilityRole="button" accessibilityState={{ expanded: false }}
      style={({ pressed }) => ({ padding: 12, minHeight: 48, borderRadius: 10, backgroundColor: c.accentSoft, opacity: pressed ? 0.7 : 1 })}>
      <Text style={{ color: c.accent2, fontSize: 15, lineHeight: 24, fontWeight: '700', textAlign: 'center' }}>{`全${table.rows.length}項目を読む ＋`}</Text>
    </Pressable> : null}
    {uri ? <Pressable onPress={() => onZoom(uri)} accessibilityRole="button" accessibilityLabel={table.title + 'の全体表を拡大'}
      style={({ pressed }) => ({ minHeight: 44, paddingVertical: 10, opacity: pressed ? 0.7 : 1 })}>
      <Text style={{ color: c.accent2, fontSize: 14, lineHeight: 24, fontWeight: '700', textAlign: 'center' }}>全体表を拡大 ↗</Text>
    </Pressable> : <Text style={{ color: c.muted, fontSize: 12, lineHeight: 20 }}>比較用の画像はコンテンツ取得後に拡大できます。</Text>}
  </View>;
}

export function StudyCheck({ title, question, answer, choice, checkId = title, onLessonLink }: { title: string; question: string; answer: string; choice?: MarkdownBlock['choice']; checkId?: string; onLessonLink?: (lesson: number) => void }) {
  const { c, resolved } = useTheme();
  const recall = useStudyRecall();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [memo, setMemo] = useState('');
  const [self, setSelf] = useState<'self' | 'review' | null>(null);
  const answerInk = resolved === 'light' ? '#167443' : c.good;
  const warnInk = resolved === 'light' ? '#A93226' : '#FFB3A6';
  const links = onLessonLink ? answer.match(/→ Lesson ([\d・]+)/)?.[1].split('・').map(Number) ?? [] : [];
  const submit = () => {
    if (selected === null || !choice) return;
    setSubmitted(true); setOpen(true);
    recall?.report(checkId, selected === choice.correct ? 'correct' : 'review');
  };
  return <View style={{ borderWidth: 1, borderColor: c.line, borderRadius: 14, backgroundColor: c.card, padding: 16, marginBottom: 16, gap: 12 }}>
    <Text style={{ color: c.muted, fontSize: 13, lineHeight: 22 }}>{choice ? '選んで確認' : '自分の言葉で確認'}</Text>
    <Text accessibilityRole="header" style={{ color: c.accent2, fontWeight: '800', fontSize: 15, lineHeight: 25 }}>{title}</Text>
    {(choice?.prompt ?? question).split('\n').map((line, i) => <Text key={i} style={{ color: c.fg, fontSize: 16, lineHeight: 28 }}><Inline text={line} /></Text>)}
    {choice ? <View accessibilityRole="radiogroup" accessibilityLabel={title + 'の選択肢'} style={{ gap: 8 }}>
      {choice.options.map((option, index) => <Pressable key={index} accessibilityRole="radio" accessibilityLabel={`${index + 1} ${option}`}
        accessibilityState={{ checked: selected === index, disabled: submitted }} disabled={submitted} onPress={() => setSelected(index)}
        style={{ minHeight: 48, borderWidth: selected === index ? 2 : 1, borderColor: selected === index ? c.accent2 : c.line,
          backgroundColor: submitted && index === choice.correct ? c.goodSoft : selected === index ? c.accentSoft : c.card2, borderRadius: 10, padding: 12 }}>
        <Text style={{ color: c.fg, fontSize: 16, lineHeight: 27 }}><Inline text={`${index + 1}. ${option}`} />{submitted && index === choice.correct ? '　✓ 正解' : ''}</Text>
      </Pressable>)}
      {!submitted ? <Pressable accessibilityRole="button" accessibilityLabel={title + 'の回答を確認'} disabled={selected === null}
        accessibilityState={{ disabled: selected === null }} onPress={submit}
        style={{ minHeight: 48, padding: 12, borderRadius: 10, backgroundColor: c.accentSoft, opacity: selected === null ? 0.45 : 1 }}>
        <Text style={{ color: c.accent2, fontSize: 16, lineHeight: 26, textAlign: 'center', fontWeight: '800' }}>回答を確認する</Text>
      </Pressable> : <>
        <Text accessibilityLiveRegion="polite" style={{ color: selected === choice.correct ? answerInk : warnInk, fontSize: 16, lineHeight: 27, fontWeight: '800' }}>{selected === choice.correct ? '✓ 正解です。理由も確認しましょう。' : 'もう一度整理しましょう。下の解説で違いを確認できます。'}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={title + 'をもう一度解く'} onPress={() => { setSelected(null); setSubmitted(false); setOpen(false); recall?.report(checkId, null); }} style={{ minHeight: 44, paddingVertical: 10 }}>
          <Text style={{ color: c.accent2, fontSize: 15, lineHeight: 24 }}>もう一度解く ↻</Text>
        </Pressable>
      </>}
    </View> : <>
      <Text style={{ color: c.muted, fontSize: 14, lineHeight: 24 }}>頭の中で答えるか、短くメモしてから解説を開きましょう。</Text>
      <TextInput multiline accessibilityLabel={title + 'の回答メモ'} value={memo} onChangeText={setMemo} placeholder="回答メモ（任意）" placeholderTextColor={c.muted}
        style={{ minHeight: 80, padding: 12, textAlignVertical: 'top', color: c.fg, backgroundColor: c.card2, borderRadius: 10, borderWidth: 1, borderColor: c.line, fontSize: 16, lineHeight: 27 }} />
    </>}
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={title + (open ? 'の解答・解説を閉じる' : 'の解答・解説を開く')}
      onPress={() => { if (!open && !submitted && !self) recall?.report(checkId, 'seen'); setOpen(v => !v); }} style={({ pressed }) => ({ backgroundColor: c.accentSoft, padding: 12, minHeight: 48, borderRadius: 10, opacity: pressed ? 0.7 : 1 })}>
      <Text style={{ color: c.accent2, fontSize: 15, lineHeight: 24, fontWeight: '700', textAlign: 'center' }}>{open ? '解答・解説を閉じる −' : '解答・解説を開く ＋'}</Text>
    </Pressable>
    {open ? <View style={{ borderLeftWidth: 3, borderLeftColor: answerInk, backgroundColor: c.goodSoft, padding: 12, borderRadius: 8 }}>
      <Text style={{ color: c.fg, fontSize: 16, lineHeight: 28 }}><Inline text={links.length ? answer.replace(/→ Lesson [\d・]+/, '').trim() : answer} /></Text>
      {!choice ? <View style={{ marginTop: 12, gap: 8 }}>
        <Text style={{ color: c.muted, fontSize: 14, lineHeight: 24 }}>解答例と比べて自己確認してください。メモの自動採点は行いません。</Text>
        {(['self', 'review'] as const).map(result => <Pressable key={result} accessibilityRole="button" accessibilityState={{ selected: self === result }}
          onPress={() => { setSelf(result); recall?.report(checkId, result); }} style={{ minHeight: 48, padding: 12, borderWidth: 1, borderColor: self === result ? c.accent2 : c.line, borderRadius: 10, backgroundColor: c.card }}>
          <Text style={{ color: c.fg, fontSize: 15, lineHeight: 25 }}>{self === result ? '✓ ' : ''}{result === 'self' ? '要点を説明できた' : 'もう一度見直したい'}</Text>
        </Pressable>)}
      </View> : null}
      {links.map(number => <Pressable key={number} accessibilityRole="button" onPress={() => onLessonLink?.(number)} style={{ minHeight: 44, paddingTop: 12 }}>
        <Text style={{ color: c.accent2, fontSize: 15, lineHeight: 25, fontWeight: '700' }}>{`Lesson ${String(number).padStart(2, '0')}で復習する ›`}</Text>
      </Pressable>)}
    </View> : null}
  </View>;
}

export function StudySteps({ title, items }: { title: string; items: string[] }) {
  const { c, resolved } = useTheme();
  const ink = resolved === 'light' ? '#153852' : '#9BCBF2';
  return <View style={{ borderWidth: 1, borderColor: c.line, borderRadius: 14, padding: 14, marginVertical: 12, backgroundColor: c.card }}>
    <Text accessibilityRole="header" style={{ color: ink, fontSize: 16, lineHeight: 27, fontWeight: '800', marginBottom: 14 }}>{title}</Text>
    {items.map((item, i) => <React.Fragment key={i}>
      {i ? <Text accessibilityElementsHidden importantForAccessibility="no" style={{ color: ink, textAlign: 'center', fontSize: 24, lineHeight: 32 }}>↓</Text> : null}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, backgroundColor: c.card2, borderRadius: 10 }}>
        <Text style={{ color: ink, fontSize: 16, lineHeight: 27, fontWeight: '800' }}>{i + 1}</Text>
        <Text style={{ flex: 1, color: c.fg, fontSize: 16, lineHeight: 27 }}><Inline text={item} /></Text>
      </View>
    </React.Fragment>)}
  </View>;
}
