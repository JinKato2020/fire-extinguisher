// 用語集データのアクセサ。content/glossary.json(同梱＋OTA override)から引く。
import { getContent } from './contentStore';

export type Term = {
  id: string;
  term: string;
  reading?: string;
  chapter: string;      // "1".."6"
  def: string;
  related?: string[];
  figure?: string;      // 関連する教材図版の asset名(例 ch1_f05)。OTAで取得して表示。
  summary?: string;
  explanation?: string;
  example?: string;
  caution?: string;
  aliases?: string[];
  lesson?: number;
  figureCaption?: string;
};

type GlossaryFile = { version?: number; terms: Term[] };

/** 全用語を返す。無ければ空配列。 */
export function getGlossary(): Term[] {
  const g = getContent<GlossaryFile>('content/glossary.json');
  return Array.isArray(g?.terms) ? g!.terms : [];
}

/** 見出し語から用語を引く(関連語ジャンプ用)。 */
export function findTerm(term: string): Term | undefined {
  return getGlossary().find((t) => t.term === term);
}

/** Japanese readings, width variants, CO₂, and Latin case share one search form. */
export function normalizeTermSearch(value: string): string {
  return value.normalize('NFKC').toLowerCase().replace(/[ァ-ヶ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}

export function searchTerms(terms: Term[], query: string): Term[] {
  const needle = normalizeTermSearch(query).trim();
  if (!needle) return terms;
  const words = needle.split(/\s+/);
  const score = (t: Term) => {
    const titles = [t.term, t.reading ?? '', ...(t.aliases ?? [])].map(normalizeTermSearch);
    return titles.includes(needle) ? 0 : titles.some(s => s.startsWith(needle)) ? 1 : 2;
  };
  return terms.filter(t => {
    const haystack = normalizeTermSearch([t.term, t.reading, ...(t.aliases ?? []), t.def,
      t.summary, t.explanation, t.example, t.caution].filter(Boolean).join(' '));
    return words.every(word => haystack.includes(word));
  }).sort((a, b) => score(a) - score(b));
}

/** Keep the existing first-six-per-chapter access policy, including related links. */
export function freeTermIds(terms: Term[]): Set<string> {
  const counts: Record<string, number> = {};
  return new Set(terms.filter(t => (counts[t.chapter] = (counts[t.chapter] ?? 0) + 1) <= 6).map(t => t.id));
}
