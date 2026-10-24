// ブックマーク(問題)と、用語のお気に入りを端末ローカル(AsyncStorage)に保存する。
import AsyncStorage from '@react-native-async-storage/async-storage';

const QKEY = 'fire6:bookmarks:v1';   // 問題ID配列
const TKEY = 'fire6:favterms:v1';    // お気に入り用語(見出し語)配列

let qset = new Set<string>();
let tset = new Set<string>();
let loaded = false;

export async function loadBookmarks(): Promise<void> {
  try {
    const [q, t] = await Promise.all([AsyncStorage.getItem(QKEY), AsyncStorage.getItem(TKEY)]);
    qset = new Set(q ? (JSON.parse(q) as string[]) : []);
    tset = new Set(t ? (JSON.parse(t) as string[]) : []);
  } catch {
    qset = new Set(); tset = new Set();
  }
  loaded = true;
}

async function persistQ(): Promise<void> {
  try { await AsyncStorage.setItem(QKEY, JSON.stringify([...qset])); } catch { /* 無視 */ }
}
async function persistT(): Promise<void> {
  try { await AsyncStorage.setItem(TKEY, JSON.stringify([...tset])); } catch { /* 無視 */ }
}

// ---- 問題ブックマーク ----
export function isBookmarked(qid: string): boolean { return qset.has(qid); }
export async function toggleBookmark(qid: string): Promise<boolean> {
  if (qset.has(qid)) qset.delete(qid); else qset.add(qid);
  await persistQ();
  return qset.has(qid);
}
export function bookmarkedIds(): string[] { return [...qset]; }
export function bookmarkCount(): number { return qset.size; }

// ---- 用語お気に入り ----
export function isFavTerm(term: string): boolean { return tset.has(term); }
export async function toggleFavTerm(term: string): Promise<boolean> {
  if (tset.has(term)) tset.delete(term); else tset.add(term);
  await persistT();
  return tset.has(term);
}
export function favTermList(): string[] { return [...tset]; }

export function isBookmarksLoaded(): boolean { return loaded; }
