export const FEEDBACK_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
export const LESSON_FEEDBACK_READING_MS = 15 * 1000;
export type FeedbackSchedule = { firstUsedAt: number; lastOfferedAt: number | null; reviewAttempts: number[] };
export function feedbackDue(schedule: FeedbackSchedule, now: number): boolean {
  if (schedule.lastOfferedAt !== null) return now - schedule.lastOfferedAt >= FEEDBACK_INTERVAL_MS;
  // Count the first local date of use as day one. DST does not shift the third day.
  const thirdDay = new Date(schedule.firstUsedAt);
  thirdDay.setHours(0, 0, 0, 0);
  thirdDay.setDate(thirdDay.getDate() + 2);
  return now >= thirdDay.getTime();
}
export function lessonFeedbackReady(elapsedMs: number, viewport: number, content: number, offset: number): boolean {
  return elapsedMs >= LESSON_FEEDBACK_READING_MS && viewport > 0 && content > 0
    && viewport + Math.max(0, offset) >= content - 80;
}
export function canAttemptReview(attempts: number[], now: number): boolean {
  return attempts.filter(at => at > now - 365 * 24 * 60 * 60 * 1000).length < 3;
}
