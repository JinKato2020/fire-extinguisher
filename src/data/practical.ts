import type { Question, PracticalPart } from './questions';

export function normalizeShortAnswer(value: string): string {
  return value.normalize('NFKC').toLowerCase().replace(/[\s、。・]/g, '');
}
export function partCorrect(part: PracticalPart, value: string): boolean {
  const normalized = normalizeShortAnswer(value);
  return normalized.length > 0 && part.answers.some(answer => normalizeShortAnswer(answer) === normalized);
}
export function gradePractical(q: Question, draft: Record<string, string>) {
  const parts = q.practical?.parts ?? [];
  const earned = parts.filter(part => partCorrect(part, draft[part.id] ?? '')).length;
  return { earned, total: parts.length };
}
export function questionStem(q: Question): string { return q.practical?.stem ?? q.stem; }
export function sectionScores(questions: Question[], points: Record<string, { earned: number; total: number }>) {
  let writtenEarned = 0, writtenTotal = 0, practicalEarned = 0, practicalTotal = 0;
  for (const q of questions) {
    if (q.practical) {
      practicalTotal += q.practical.parts.length;
      practicalEarned += Math.min(q.practical.parts.length, Math.max(0, points[q.id]?.earned ?? 0));
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
