// 学習タブに出す「章一覧」を、同梱(BUNDLED)＋OTA override から組み立てる。
// 以前は App.tsx に CHAPTERS をベタ書きしていたが、OTA配信に載せるため content/index.json 起点にした。
import { getContent } from './contentStore';

export type Chapter = {
  no: string; title: string; sub: string;
  tag?: string; tagKind?: 'hard' | 'mid' | 'easy' | 'done'; body?: string;
};

type IndexEntry = {
  no: string; title: string; sub: string;
  tag?: string; tagKind?: Chapter['tagKind']; file: string;
};
type IndexFile = { chapters: IndexEntry[] };

/** content/index.json（章メタ）＋ 各 content/chapters/chN.json（本文）から Chapter[] を作る。 */
export function getChapters(): Chapter[] {
  const idx = getContent<IndexFile>('content/index.json');
  const list = idx?.chapters ?? [];
  return list.map((m) => {
    const data = getContent<{ body?: string }>(m.file);
    return { no: m.no, title: m.title, sub: m.sub, tag: m.tag, tagKind: m.tagKind, body: data?.body };
  });
}
