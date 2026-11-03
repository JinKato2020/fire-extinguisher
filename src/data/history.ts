// 学習履歴・自信度を端末ローカル(AsyncStorage)に保存する。サーバもAIも不要。
// 問題ごとに「出題回数・正解回数・直近の正誤・直近で自信なし・最終日時」を記録し、
// 弱点復習（誤答／自信なし／未出題）の抽出に使う。
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Points } from './practical';

const KEY = 'fire6:history:v1';

export type Rec = {
  seen: number;          // 出題回数
  correct: number;       // 正解回数
  lastCorrect: boolean;  // 直近が正解だったか
  lastLowConf: boolean;  // 直近で「自信なし」だったか
  lastAt: string;        // 最終回答日時(ISO)
  lastPoints?: Points; // 鑑別の要点別部分点・評価区分（練習用）
};

type HistoryMap = Record<string, Rec>;

let cache: HistoryMap = {};
let loaded = false;

/** 起動時に一度だけ呼ぶ。保存済み履歴をメモリに読み込む。 */
export async function loadHistory(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as HistoryMap) : {};
  } catch {
    cache = {};
  }
  loaded = true;
}

async function persist(): Promise<void> {
  try { await AsyncStorage.setItem(KEY, JSON.stringify(cache)); } catch { /* 保存失敗は無視 */ }
}

/** 1問の回答を記録する。 */
export async function recordAnswer(qid: string, correct: boolean, lowConf: boolean, points?: Points): Promise<void> {
  const prev = getRec(qid) ?? { seen: 0, correct: 0, lastCorrect: false, lastLowConf: false, lastAt: '' };
  cache[qid] = {
    seen: prev.seen + 1,
    correct: prev.correct + (correct ? 1 : 0),
    lastCorrect: correct,
    lastLowConf: lowConf,
    lastAt: new Date().toISOString(),
    ...(points ? { lastPoints: points } : {}),
  };
  await persist();
}

export function getRec(qid: string): Rec | undefined {
  const rec = cache[qid];
  // Older clients can download the compatible choice fallback before their JS updates.
  // Those answers do not contain subquestion points and cannot grade the new format.
  if (/-practical-v\d+$/.test(qid) && !rec?.lastPoints) return undefined;
  if (/-practical-v2$/.test(qid) && rec?.lastPoints?.evaluationVersion !== 2) return undefined;
  return rec;
}

/** 弱点か？ = 一度でも解いて、直近が誤答 または 自信なし。 */
export function isWeak(qid: string): boolean {
  const r = getRec(qid);
  if (!r || r.seen === 0) return false;
  return !r.lastCorrect || r.lastLowConf;
}

/** 与えられた問題IDのうち、弱点（誤答/自信なし）と未出題を返す。 */
export function selectReview(qids: string[]): { weak: string[]; unseen: string[] } {
  const weak: string[] = [];
  const unseen: string[] = [];
  for (const id of qids) {
    const r = getRec(id);
    if (!r || r.seen === 0) unseen.push(id);
    else if (!r.lastCorrect || r.lastLowConf) weak.push(id);
  }
  return { weak, unseen };
}

/** 全体の学習状況（ホーム等の表示用）。 */
export function overallStats(): { answered: number; correct: number; accuracy: number } {
  const recs = Object.keys(cache).map(getRec).filter((r): r is Rec => !!r);
  const answered = recs.reduce((a, r) => a + r.seen, 0);
  const correct = recs.reduce((a, r) => a + r.correct, 0);
  const accuracy = answered > 0 ? Math.round((correct / answered) * 100) : 0;
  return { answered, correct, accuracy };
}

export function isLoaded(): boolean { return loaded; }
