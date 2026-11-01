import assert from 'node:assert/strict';
import { enrollLaunchAccess, parseLaunchGrant, parseLaunchPolicy } from '../src/data/launchAccessRules';
import { canAttemptReview, feedbackDue, FEEDBACK_INTERVAL_MS } from '../src/data/feedbackRules';

const now = Date.UTC(2026, 10, 1);
const open = { schema: 1 as const, campaignId: 'launch-free-2026-11', enrollmentOpen: true };
const closed = { ...open, enrollmentOpen: false };
const grant = enrollLaunchAccess(null, open, now)!;
assert.ok(grant);
assert.equal(enrollLaunchAccess(grant, closed, now + 1000000000), grant);
assert.equal(enrollLaunchAccess(grant, null, now), grant); // Existing rights work offline.
assert.equal(enrollLaunchAccess(null, closed, now), null); // Later newcomers use IAP.
assert.equal(enrollLaunchAccess(null, null, now), null); // No stale/offline new grants.
assert.equal(parseLaunchPolicy({ ...open, enrollmentOpen: 'true' }), null);
assert.equal(parseLaunchGrant({ ...grant, grantedAt: 'invalid' }), null);
const schedule = { firstUsedAt: now, lastOfferedAt: null, reviewAttempts: [] };
assert.equal(feedbackDue(schedule, now), false);
assert.equal(feedbackDue(schedule, now + FEEDBACK_INTERVAL_MS - 1), false);
assert.equal(feedbackDue(schedule, now + FEEDBACK_INTERVAL_MS), true);
assert.equal(feedbackDue({ ...schedule, lastOfferedAt: now + FEEDBACK_INTERVAL_MS }, now + FEEDBACK_INTERVAL_MS + 1000), false);
assert.equal(canAttemptReview([now - 1, now - 2], now), true);
assert.equal(canAttemptReview([now - 1, now - 2, now - 3], now), false);
assert.equal(canAttemptReview([now - 366 * 86400000, now - 1, now - 2], now), true);
console.log('PASS: permanent installed grant, later paid cohort, offline behavior, four-day interval and annual review cap');
