import type { MarkdownBlock } from './markdown';

export type RecallCategory = 'key' | 'num' | 'trap';
export type RecallBlank = { id: string; field: string; answer: string; category: RecallCategory; start: number };
export const RECALL_LABELS = { all: 'すべて', key: '用語・式', num: '数値', trap: '条件・例外' };
export const RECALL_LIMIT = 10;
export const markerPattern = () => /\{\{([^{}\n]+?)::(key|num|trap)\}\}/g;
export const unmask = (raw: string) => raw.replace(markerPattern(), '$1');

export function recallInField(text: string, field: string): RecallBlank[] {
  return [...text.matchAll(markerPattern())].map(m => ({ id: `${field}:${m.index}`, field, answer: m[1], category: m[2] as RecallCategory, start: m.index! }));
}

/** Only explicitly authored prose is eligible; headings, images and quiz answers remain clues. */
export function recallCandidates(blocks: MarkdownBlock[]): RecallBlank[] {
  const seen = new Set<string>();
  return blocks.flatMap((b, i) => {
    if (b.type === 'quote') return b.text.split('\n').flatMap((line, j) => recallInField(line.replace(/^[-*] /, '・'), `b${i}:q${j}`));
    if (['p', 'li', 'ol'].includes(b.type)) return recallInField(b.type === 'ol' ? b.text.replace(/^\d+\. /, '') : b.text, `b${i}`);
    return [];
  }).filter(blank => {
    const key = blank.answer.normalize('NFKC').replace(/\s/g, '').toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}

export function chooseRecall(pool: RecallBlank[], category: RecallCategory | 'all', round: number): RecallBlank[] {
  const eligible = pool.filter(b => category === 'all' || b.category === category);
  const counts: Record<string, number> = {};
  const result: RecallBlank[] = [];
  for (let i = 0; i < eligible.length && result.length < RECALL_LIMIT; i++) {
    const b = eligible[(i + Math.max(0, round)) % eligible.length];
    if ((counts[b.field] ?? 0) >= 2) continue;
    counts[b.field] = (counts[b.field] ?? 0) + 1; result.push(b);
  }
  return result;
}

export type ReadingSection = { start: number; title?: string; kind: 'concept' | 'example' | 'check'; blocks: { block: MarkdownBlock; index: number }[] };
export function readingSections(blocks: MarkdownBlock[]): ReadingSection[] {
  const sections: ReadingSection[] = [];
  blocks.forEach((block, index) => {
    if (block.type === 'h3') {
      sections.push({ start: index, title: block.text, kind: /^具体例/.test(block.text) ? 'example' : /確認問題/.test(block.text) ? 'check' : 'concept', blocks: [] });
    } else {
      if (!sections.length || (block.type === 'h2' && sections.at(-1)?.title)) sections.push({ start: index, kind: 'concept', blocks: [] });
      sections[sections.length - 1].blocks.push({ block, index });
    }
  });
  return sections;
}
