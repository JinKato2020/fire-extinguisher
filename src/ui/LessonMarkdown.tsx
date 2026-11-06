import React, { useMemo, useState } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import { useTheme, useStyles } from '../theme/ThemeContext';
import { getContent, getFigureUri } from '../data/contentStore';
import { ImageZoom } from './ImageZoom';
import { LessonFigure } from './LessonFigure';
import { parseMarkdown } from './markdown';
import { Inline, StudyCheck, StudySteps, StudyTable, type StudyTableData } from './StudyBlocks';

const rich = (text: string) => <Inline text={text} />;

// ---- 軽量マークダウン表示 ----
export function Markdown({ body, onLessonLink }: { body: string; onLessonLink?: (lesson: number) => void }) {
  const { c, resolved } = useTheme();
  const s = useStyles();
  const { width } = useWindowDimensions();
  const imgW = Math.min(width, 440) - 32;
  const blocks = useMemo(() => parseMarkdown(body), [body]);
  const tables = getContent<Record<string, StudyTableData>>('content/lesson-tables.json') ?? {};
  const [zoomUri, setZoomUri] = useState<string | null>(null);

  return (
    <View>
      {blocks.map((b, i) => {
        if (b.type === 'fig') {
          const [asset, cap] = b.text.split('\u0001');
          const uri = getFigureUri(asset);
          const table = tables[asset.replace(/_(?:full|\d+)$/, '')];
          if (table) return <StudyTable key={asset} table={table} uri={uri} onZoom={setZoomUri} />;
          return <LessonFigure key={i} uri={uri} caption={cap} width={imgW} onZoom={setZoomUri} />;
        }
        if (b.type === 'check') return <StudyCheck key={i + b.text} title={b.title!} question={b.text} answer={b.answer!} onLessonLink={onLessonLink} />;
        if (b.type === 'steps') return <StudySteps key={i} title={b.title!} items={b.items!} />;
        if (b.type === 'figpending') return <Text key={i} style={{ color: c.faint, fontSize: 12, marginVertical: 4 }}>{'【図】' + b.text}</Text>;
        if (b.type === 'gap') return <View key={i} style={{ height: 8 }} />;
        if (b.type === 'hr') return <View key={i} style={s.hr} />;
        if (b.type === 'h1') return <Text key={i} accessibilityRole="header" style={s.mdH1}>{rich(b.text)}</Text>;
        if (b.type === 'h2') return <Text key={i} accessibilityRole="header" style={s.mdH2}>{rich(b.text)}</Text>;
        if (b.type === 'h3') return <Text key={i} accessibilityRole="header" style={s.mdH3}>{rich(b.text)}</Text>;
        if (b.type === 'h4') return <Text key={i} accessibilityRole="header" style={s.mdH4}>{rich(b.text)}</Text>;
        if (b.type === 'quote') {
          const ink = b.tone === 'warning' ? (resolved === 'light' ? '#B3321E' : c.warn) : b.tone === 'important' ? (resolved === 'light' ? '#167443' : c.good) : (resolved === 'light' ? '#215A80' : '#9BCBF2');
          const bg = b.tone === 'warning' ? c.warnSoft : b.tone === 'important' ? c.goodSoft : (resolved === 'light' ? '#EAF2F9' : '#192B3B');
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

