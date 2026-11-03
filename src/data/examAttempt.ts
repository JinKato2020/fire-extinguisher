import type { Question } from './questions';
import { gradePractical, type Points } from './practical';

export type ExamAnswer = { choice?: number; text?: Record<string, string>; flagged?: boolean };
export class ExamAttempt {
  answers: Record<string, ExamAnswer> = {};
  result: Record<string, Points> | null = null;
  constructor(readonly questions: Question[], readonly deadline: number | null) {}
  expired(now: number) { return this.deadline !== null && now >= this.deadline; }
  update(id: string, patch: Partial<ExamAnswer>, now: number): boolean {
    if (this.result || this.expired(now) || !this.questions.some(q => q.id === id)) return false;
    this.answers[id] = { ...this.answers[id], ...patch };
    return true;
  }
  answered(id: string): boolean {
    const a = this.answers[id];
    return a?.choice !== undefined || Object.values(a?.text ?? {}).some(v => v.trim().length > 0);
  }
  finish(): Record<string, Points> {
    if (this.result) return this.result;
    this.result = Object.fromEntries(this.questions.map(q => {
      const a = this.answers[q.id];
      return [q.id, q.practical ? gradePractical(q, a?.text ?? {}) : { earned: a?.choice === q.answer ? 1 : 0, total: 1 }];
    }));
    return this.result;
  }
}
