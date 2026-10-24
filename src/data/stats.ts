// 分野別の成績集計・学習ストリーク・時系列スナップショット。
// 履歴(history.ts)と問題(questions.ts)を突き合わせて分野別正答率を出し、
// 1日1回スナップショットを保存して「2週前・1ヶ月前」との比較(レーダー)に使う。
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAllQuestions } from './questions';
import { getRec } from './history';

const DAILY_KEY = 'fire6:daily:v1'; // { "YYYY-MM-DD": 解答数 }
const SNAP_KEY = 'fire6:snap:v1';   // [{ d:"YYYY-MM-DD", ch:{ "1":acc,... } }]

type DailyMap = Record<string, number>;
type Snap = { d: string; ch: Record<string, number> };

let daily: DailyMap = {};
let snaps: Snap[] = [];
let loaded = false;

function ymd(dt: Date): string {
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export async function loadStats(): Promise<void> {
  try {
    const [d, s] = await Promise.all([AsyncStorage.getItem(DAILY_KEY), AsyncStorage.getItem(SNAP_KEY)]);
    daily = d ? (JSON.parse(d) as DailyMap) : {};
    snaps = s ? (JSON.parse(s) as Snap[]) : [];
  } catch {
    daily = {}; snaps = [];
  }
  loaded = true;
}

// ---- 分野別正答率(現在値。履歴から都度算出) ----
export type ChStat = { answered: number; correct: number; acc: number };

export function chapterStats(): Record<string, ChStat> {
  const out: Record<string, ChStat> = {};
  for (const q of getAllQuestions()) {
    const r = getRec(q.id);
    if (!r || r.seen === 0) continue;
    const o = out[q.chapter] ?? { answered: 0, correct: 0, acc: 0 };
    o.answered += r.seen;
    o.correct += r.correct;
    out[q.chapter] = o;
  }
  for (const k of Object.keys(out)) {
    out[k].acc = out[k].answered > 0 ? Math.round((out[k].correct / out[k].answered) * 100) : 0;
  }
  return out;
}

/** 現在の分野別正答率マップ(chapter→acc%)。 */
export function currentAccMap(): Record<string, number> {
  const st = chapterStats();
  const m: Record<string, number> = {};
  for (const k of Object.keys(st)) m[k] = st[k].acc;
  return m;
}

// ---- 学習ストリーク / 直近N日 ----
export async function bumpDaily(): Promise<void> {
  const k = ymd(new Date());
  daily[k] = (daily[k] ?? 0) + 1;
  try { await AsyncStorage.setItem(DAILY_KEY, JSON.stringify(daily)); } catch { /* 無視 */ }
}

/** 直近n日(古い→新しい)の解答数配列。 */
export function recentDaily(n: number): { date: string; count: number }[] {
  const out: { date: string; count: number }[] = [];
  const base = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const dt = new Date(base.getFullYear(), base.getMonth(), base.getDate() - i);
    const k = ymd(dt);
    out.push({ date: k, count: daily[k] ?? 0 });
  }
  return out;
}

/** 今日(または昨日)から連続して解答した日数。 */
export function studyStreak(): number {
  let streak = 0;
  const base = new Date();
  // 今日が0でも、昨日まで続いていれば昨日起点で数える
  const start = (daily[ymd(base)] ?? 0) > 0 ? 0 : 1;
  for (let i = start; i < 400; i++) {
    const dt = new Date(base.getFullYear(), base.getMonth(), base.getDate() - i);
    if ((daily[ymd(dt)] ?? 0) > 0) streak++;
    else break;
  }
  return streak;
}

// ---- スナップショット(時系列比較) ----
/** 今日のスナップショットを記録(1日1回、当日分は上書き)。解答があった日だけ残す。 */
export async function recordSnapshotIfNeeded(): Promise<void> {
  const acc = currentAccMap();
  if (Object.keys(acc).length === 0) return; // まだ実績なし
  const today = ymd(new Date());
  const idx = snaps.findIndex((s) => s.d === today);
  const snap: Snap = { d: today, ch: acc };
  if (idx >= 0) snaps[idx] = snap;
  else snaps.push(snap);
  // 古い物を間引く(最大120件)
  if (snaps.length > 120) snaps = snaps.slice(snaps.length - 120);
  try { await AsyncStorage.setItem(SNAP_KEY, JSON.stringify(snaps)); } catch { /* 無視 */ }
}

/** daysAgo 日前“以前”で最も新しいスナップショット(無ければ null)。 */
export function snapAsOf(daysAgo: number): Record<string, number> | null {
  const base = new Date();
  const target = ymd(new Date(base.getFullYear(), base.getMonth(), base.getDate() - daysAgo));
  let best: Snap | null = null;
  for (const s of snaps) {
    if (s.d <= target && (!best || s.d > best.d)) best = s;
  }
  return best ? best.ch : null;
}

export function isStatsLoaded(): boolean { return loaded; }
