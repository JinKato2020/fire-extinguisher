export const FEEDBACK_INTERVAL_MS = 4 * 24 * 60 * 60 * 1000;
export type FeedbackSchedule = { firstUsedAt: number; lastOfferedAt: number | null; reviewAttempts: number[] };
export function feedbackDue(schedule: FeedbackSchedule, now: number): boolean {
  return now - (schedule.lastOfferedAt ?? schedule.firstUsedAt) >= FEEDBACK_INTERVAL_MS;
}
export function canAttemptReview(attempts: number[], now: number): boolean {
  return attempts.filter(at => at > now - 365 * 24 * 60 * 60 * 1000).length < 3;
}
