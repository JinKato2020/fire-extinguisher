// 試験日(ユーザーが設定)を端末ローカルに保存し、残り日数を計算する。
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'fire6:examDate:v1'; // "YYYY-MM-DD" または null

let cache: string | null = null;
let loaded = false;

export async function loadExamDate(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    cache = raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
  } catch {
    cache = null;
  }
  loaded = true;
}

export function getExamDate(): string | null { return cache; }

export async function setExamDate(ymd: string | null): Promise<void> {
  cache = ymd && /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd : null;
  try {
    if (cache) await AsyncStorage.setItem(KEY, cache);
    else await AsyncStorage.removeItem(KEY);
  } catch { /* 無視 */ }
}

/** 今日(端末ローカル日付)起点の残り日数。未設定なら null。当日=0、過ぎていれば負。 */
export function daysLeft(): number | null {
  if (!cache) return null;
  const [y, m, d] = cache.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  const now = new Date();
  const a = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((a - b) / 86400000);
}

/** 表示用の整形("2026年11月9日(日)")。 */
export function examDateText(): string | null {
  if (!cache) return null;
  const [y, m, d] = cache.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const w = ['日', '月', '火', '水', '木', '金', '土'][dt.getDay()];
  return `${y}年${m}月${d}日(${w})`;
}

export function isExamDateLoaded(): boolean { return loaded; }
