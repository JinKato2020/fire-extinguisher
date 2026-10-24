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
