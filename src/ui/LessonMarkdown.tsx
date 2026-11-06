import React, { useMemo, useState } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import { useTheme, useStyles } from '../theme/ThemeContext';
import { getContent, getFigureUri } from '../data/contentStore';
import { ImageZoom } from './ImageZoom';
import { LessonFigure } from './LessonFigure';
import { parseMarkdown } from './markdown';
import { Inline, StudyCheck, StudySteps, StudyTable, type StudyTableData } from './StudyBlocks';
import { readingSections } from './recall';
import type { MarkdownBlock } from './markdown';

const rich = (text: string, field?: string) => <Inline text={text} field={field} />;

// ---- 軽量マークダウン表示 ----
export function Markdown({ body, onLessonLink, hideTitle = false, onSectionLayout }: { body: string; onLessonLink?: (lesson: number) => void; hideTitle?: boolean; onSectionLayout?: (index: number, y: number) => void }) {
  const { c, resolved } = useTheme();
  const s = useStyles();
  const blocks = useMemo(() => parseMarkdown(body), [body]);
  const sections = useMemo(() => readingSections(blocks), [blocks]);
  const tables = getContent<Record<string, StudyTableData>>('content/lesson-tables.json') ?? {};
  const [zoomUri, setZoomUri] = useState<string | null>(null);

  const renderBlock = (b: MarkdownBlock, i: number) => {
        if (hideTitle && i === 0 && (b.type === 'h1' || b.type === 'h2')) return null;
        if (b.type === 'fig') {
          const [asset, cap] = b.text.split('\u0001');
          const uri = getFigureUri(asset);
          const table = tables[asset.replace(/_(?:full|\d+)$/, '')];
          if (table) return <StudyTable key={asset} table={table} uri={uri} onZoom={setZoomUri} />;
          return <ResponsiveFigure key={i} uri={uri} caption={cap} onZoom={setZoomUri} />;
        }
        if (b.type === 'check') return <StudyCheck key={i + b.text} title={b.title!} question={b.text} answer={b.answer!} choice={b.choice} checkId={'check'+i} onLessonLink={onLessonLink} />;
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
            {b.text.split('\n').map((line, j) => line ? <Text key={j} style={s.quoteTxt}>{rich(line.replace(/^[-*] /, '・'), `b${i}:q${j}`)}</Text> : <View key={j} style={{ height: 6 }} />)}
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
          <Text style={s.mdListBody}>{rich(b.type === 'li' ? b.text : b.text.replace(/^\d+\. /, ''), `b${i}`)}</Text>
        </View>;
        return <Text key={i} style={s.mdP}>{rich(b.text, `b${i}`)}</Text>;
  };
  return <View>
    {sections.map(section => {
      if (!section.title) return <View key={section.start}>{section.blocks.map(({block, index}) => renderBlock(block, index))}</View>;
      const example = section.kind === 'example', check = section.kind === 'check';
      const ink = example ? (resolved === 'light' ? '#225D84' : '#9BCBF2') : check ? c.accent2 : c.fg;
      return <View key={section.start} onLayout={e => onSectionLayout?.(section.start, e.nativeEvent.layout.y)}
        style={{ marginTop: 12, marginBottom: 12, padding: check ? 0 : 16, borderRadius: 16,
          backgroundColor: check ? 'transparent' : example ? (resolved === 'light' ? '#EBF5FC' : '#152B3C') : c.card,
          borderWidth: check ? 0 : 1, borderColor: example ? ink : c.line }}>
        <Text style={{ color: example || check ? ink : c.muted, fontSize: 12, lineHeight: 21, fontWeight: '700', marginBottom: 6 }}>{example ? '使って理解する' : check ? '思い出して定着させる' : '理解する'}</Text>
        <Text accessibilityRole="header" style={{ color: ink, fontSize: 19, lineHeight: 30, fontWeight: '800', marginBottom: 16 }}>{section.title}</Text>
        {section.blocks.map(({block, index}) => renderBlock(block, index))}
      </View>;
    })}
      {zoomUri ? <ImageZoom uri={zoomUri} onClose={() => setZoomUri(null)} /> : null}
    </View>;
}


function ResponsiveFigure({uri, caption, onZoom}: {uri: string | null; caption: string; onZoom: (uri: string) => void}) {
  const {width} = useWindowDimensions();
  const [available, setAvailable] = useState(Math.max(1, Math.min(width, 440)-64));
  return <View onLayout={e => { if (e.nativeEvent.layout.width > 0) setAvailable(e.nativeEvent.layout.width); }}>
    <LessonFigure uri={uri} caption={caption} width={available} captionSize={14} onZoom={onZoom} />
  </View>;
}
