// 消防試験研究センター「試験の方法」。乙種・科目免除なし。
// https://www.shoubo-shiken.or.jp/shoubou/annai/way.html
export const EXAM_DURATION_SECONDS = 105 * 60;

// Absolute deadlines keep time while the app is in the background.
export function remainingSeconds(deadline: number | null, now: number): number | null {
  return deadline === null ? null : Math.max(0, Math.ceil((deadline - now) / 1000));
}

export function formatExamTime(seconds: number): string {
  const value = Math.max(0, Math.floor(seconds));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}
