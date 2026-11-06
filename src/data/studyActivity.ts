import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'fire6:study-activity:v1';
export const HERO_IDS = ['anime', 'photo', 'calm', 'classic', 'none'] as const;
export type HeroId = typeof HERO_IDS[number];
export type ActivityKind = 'lessons' | 'terms' | 'checks';
export type ReadingPosition = { chapterNo: string; lessonKey: string; label: string; offset: number; bodyTag: string; at: number };
type Day = Record<ActivityKind, string[]>;
type State = { hero: HeroId; resume: ReadingPosition | null; days: Record<string, Day>; readLessons: string[] };
let state: State = { hero: 'anime', resume: null, days: {}, readLessons: [] };
let loading: Promise<void> | null = null;
let queue: Promise<unknown> = Promise.resolve();
let revision = 0;
const listeners = new Set<() => void>();
export function localDay(at = Date.now()): string {
  const d = new Date(at);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function bodyTag(body: string): string {
  let hash = 2166136261;
  for (let i = 0; i < body.length; i++) hash = Math.imul(hash ^ body.charCodeAt(i), 16777619);
  return String(hash >>> 0);
}
function emit() { revision++; listeners.forEach(fn => fn()); }
export function subscribeActivity(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }
export function activityRevision() { return revision; }
export function activityState(): Readonly<State> { return state; }
const ids = (v: unknown): string[] => Array.isArray(v) ? [...new Set(v.filter((id): id is string => typeof id === 'string' && id.length < 300))] : [];
export function initActivity(): Promise<void> {
  if (!loading) loading = (async () => {
    try {
      const raw = JSON.parse(await AsyncStorage.getItem(KEY) ?? 'null');
      if (raw && typeof raw === 'object') {
        if (HERO_IDS.includes(raw.hero)) state.hero = raw.hero;
        const r = raw.resume;
        if (r && /^[1-6]$/.test(r.chapterNo) && typeof r.lessonKey === 'string' && typeof r.label === 'string'
          && typeof r.bodyTag === 'string' && Number.isFinite(r.offset) && r.offset >= 0 && Number.isFinite(r.at)) state.resume = r;
        if (raw.days && typeof raw.days === 'object') for (const day of Object.keys(raw.days).sort().slice(-120)) {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
          const v = raw.days[day];
          if (v && typeof v === 'object') state.days[day] = { lessons: ids(v.lessons), terms: ids(v.terms), checks: ids(v.checks) };
        }
        state.readLessons = ids(raw.readLessons);
      }
    } catch { /* A damaged local record does not prevent studying. */ }
    emit();
  })();
  return loading;
}
function change(update: () => void): Promise<void> {
  const work = queue.then(async () => {
    await initActivity(); update(); emit();
    try { await AsyncStorage.setItem(KEY, JSON.stringify(state)); } catch { /* Keep the current session usable. */ }
  });
  queue = work.catch(() => {});
  return work;
}
export function setHero(hero: HeroId): Promise<void> { return change(() => { if (HERO_IDS.includes(hero)) state.hero = hero; }); }
export function rememberLesson(position: ReadingPosition): Promise<void> { return change(() => { state.resume = position; }); }
export function recordActivity(kind: ActivityKind, id: string, at = Date.now()): Promise<void> {
  return change(() => {
    const key = localDay(at);
    const day = state.days[key] ??= { lessons: [], terms: [], checks: [] };
    if (!day[kind].includes(id)) day[kind].push(id);
    if (kind === 'lessons' && !state.readLessons.includes(id)) state.readLessons.push(id);
    for (const old of Object.keys(state.days).sort().slice(0, -120)) delete state.days[old];
  });
}
export function recentActivity(count: number, answers: { date: string; count: number }[], now = Date.now()) {
  const base = new Date(now);
  return Array.from({ length: count }, (_, i) => {
    const date = localDay(new Date(base.getFullYear(), base.getMonth(), base.getDate() - count + i + 1).getTime());
    const day = state.days[date];
    const lessons = day?.lessons.length ?? 0, terms = day?.terms.length ?? 0;
    const checks = (day?.checks.length ?? 0) + (answers.find(d => d.date === date)?.count ?? 0);
    return { date, lessons, terms, checks, active: lessons + terms + checks > 0 };
  });
}
