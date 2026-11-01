export const FEEDBACK_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
export const STUDY_FEEDBACK_MIN_MS = 60 * 1000;
export type FeedbackSchedule = { firstUsedAt: number; lastOfferedAt: number | null; reviewAttempts: number[] };
export function feedbackDue(schedule: FeedbackSchedule, now: number): boolean {
  if (schedule.lastOfferedAt !== null) return now - schedule.lastOfferedAt >= FEEDBACK_INTERVAL_MS;
  // Count the first local date of use as day one. DST does not shift the third day.
  const thirdDay = new Date(schedule.firstUsedAt);
  thirdDay.setHours(0, 0, 0, 0);
  thirdDay.setDate(thirdDay.getDate() + 2);
  return now >= thirdDay.getTime();
}
/** Count only foreground exposure; finishing a short session never qualifies. */
export class StudyExposure {
  private elapsed = 0;
  private since: number | null = null;
  constructor(now: number, active: boolean) { if (active) this.since = now; }
  setActive(now: number, active: boolean): void {
    if (this.since !== null) this.elapsed += Math.max(0, now - this.since);
    this.since = active ? now : null;
  }
  finish(now: number): boolean {
    this.setActive(now, false);
    return this.elapsed >= STUDY_FEEDBACK_MIN_MS;
  }
}
export function canAttemptReview(attempts: number[], now: number): boolean {
  return attempts.filter(at => at > now - 365 * 24 * 60 * 60 * 1000).length < 3;
}
