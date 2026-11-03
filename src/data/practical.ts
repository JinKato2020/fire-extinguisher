import type { Question, PracticalPart } from './questions';

export function normalizeShortAnswer(value: string): string {
  return value.normalize('NFKC').toLowerCase().replace(/[\s、。・]/g, '');
}
export function partCorrect(part: PracticalPart, value: string): boolean {
  if (part.rubric) {
    const result = assessPart(part, value);
    return result.earned === result.total;
  }
  const normalized = normalizeShortAnswer(value);
  return normalized.length > 0 && part.answers.some(answer => normalizeShortAnswer(answer) === normalized);
}
export type Category = 'name' | 'calculation' | 'reason' | 'selection';
export type Points = { earned: number; total: number; evaluationVersion?: number;
  answers?: Record<string, string>;
  reviewCount?: number; categories?: Partial<Record<Category, { earned: number; total: number }>> };
export const categoryLabels: Record<Category, string> = { name: '名称の記述', calculation: '計算の記述', reason: '理由・働きの説明', selection: '記号選択' };
export function categoryOf(part: PracticalPart): Category {
  return part.category ?? (part.rubric ? 'reason' : part.kind === 'symbol' ? 'selection' : 'name');
}
export function partTotal(part: PracticalPart): number { return part.rubric?.criteria.length ?? 1; }
export function practicalTotal(q: Question): number { return q.practical?.parts.reduce((n, p) => n + partTotal(p), 0) ?? 0; }

/** Transparent local rules, not semantic/AI grading. Unmatched prose needs human review. */
export function assessPart(part: PracticalPart, value: string) {
  const normalized = normalizeShortAnswer(value);
  if (!part.rubric) return { earned: partCorrect(part, value) ? 1 : 0, total: 1, needsReview: false, criteria: [] as { label: string; matched: boolean }[] };
  // Negated statements can contain every expected word. Ask for self-review
  // rather than award points for the opposite explanation.
  const contradiction = /(ない|ません|不要|無関係|誤り|間違い)/u.test(normalized)
    || part.rubric.contradictions.some(pattern => new RegExp(pattern, 'u').test(normalized));
  const criteria = part.rubric.criteria.map(item => ({ label: item.label,
    matched: !contradiction && item.patterns.some(pattern => new RegExp(pattern, 'u').test(normalized)) }));
  const earned = criteria.filter(item => item.matched).length;
  return { earned, total: criteria.length, needsReview: normalized.length > 0 && (contradiction || earned < criteria.length), criteria };
}
export function gradePractical(q: Question, draft: Record<string, string>) {
  const parts = q.practical?.parts ?? [];
  const result: Points = { earned: 0, total: 0, reviewCount: 0, evaluationVersion: 2, categories: {}, answers: { ...draft } };
  for (const part of parts) {
    const scored = assessPart(part, draft[part.id] ?? '');
    result.earned += scored.earned; result.total += scored.total;
    if (scored.needsReview) result.reviewCount!++;
    const category = categoryOf(part);
    const entry = result.categories![category] ?? { earned: 0, total: 0 };
    entry.earned += scored.earned; entry.total += scored.total; result.categories![category] = entry;
  }
  return result;
}
export function assessmentSummary(questions: Question[], points: Record<string, Points>) {
  const categories = Object.fromEntries(Object.keys(categoryLabels).map(key => [key, { earned: 0, total: 0 }])) as Record<Category, { earned: number; total: number }>;
  let reviewCount = 0;
  for (const q of questions) {
    for (const part of q.practical?.parts ?? []) categories[categoryOf(part)].total += partTotal(part);
    for (const key of Object.keys(categories) as Category[]) categories[key].earned += points[q.id]?.categories?.[key]?.earned ?? 0;
    reviewCount += points[q.id]?.reviewCount ?? 0;
  }
  return { categories, reviewCount };
}
export function questionStem(q: Question): string { return q.practical?.stem ?? q.stem; }
export function sectionScores(questions: Question[], points: Record<string, { earned: number; total: number }>) {
  let writtenEarned = 0, writtenTotal = 0, practicalEarned = 0, practicalTotal = 0;
  for (const q of questions) {
    if (q.practical) {
      const total = q.practical.parts.reduce((n, p) => n + partTotal(p), 0);
      practicalTotal += total;
      practicalEarned += Math.min(total, Math.max(0, points[q.id]?.earned ?? 0));
    } else {
      writtenTotal++;
      writtenEarned += Math.min(1, Math.max(0, points[q.id]?.earned ?? 0));
    }
  }
  return { writtenEarned, writtenTotal, practicalEarned, practicalTotal,
    writtenPct: writtenTotal ? Math.round(100 * writtenEarned / writtenTotal) : null,
    practicalPct: practicalTotal ? Math.round(100 * practicalEarned / practicalTotal) : null };
}

/** A practice guide only: official practical subquestion weights are not public. */
export function practicePassed(questions: Question[], points: Record<string, { earned: number; total: number }>): boolean {
  const score = sectionScores(questions, points);
  if (score.writtenTotal && score.writtenEarned / score.writtenTotal < 0.6) return false;
  if (score.practicalTotal && score.practicalEarned / score.practicalTotal < 0.6) return false;
  for (const chapters of [['1', '2'], ['3'], ['4', '5']]) {
    const subject = questions.filter(q => !q.practical && chapters.includes(q.chapter));
    if (subject.length && subject.reduce((sum, q) => sum + (points[q.id]?.earned ?? 0), 0) / subject.length < 0.4) return false;
  }
  return questions.length > 0;
}
