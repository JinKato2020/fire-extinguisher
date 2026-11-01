import assert from 'node:assert/strict';
import { enrollLaunchAccess, parseLaunchGrant, parseLaunchPolicy } from '../src/data/launchAccessRules';
import { canAttemptReview, feedbackDue, FEEDBACK_INTERVAL_MS, StudyExposure } from '../src/data/feedbackRules';

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
const firstUse = new Date(2026, 10, 1, 23, 59).getTime();
const thirdDay = new Date(2026, 10, 3).getTime();
const schedule = { firstUsedAt: firstUse, lastOfferedAt: null, reviewAttempts: [] };
assert.equal(feedbackDue(schedule, firstUse), false);
assert.equal(feedbackDue(schedule, thirdDay - 1), false);
assert.equal(feedbackDue(schedule, thirdDay), true);
const offered = { ...schedule, lastOfferedAt: thirdDay + 3600000 };
assert.equal(feedbackDue(offered, offered.lastOfferedAt + FEEDBACK_INTERVAL_MS - 1), false);
assert.equal(feedbackDue(offered, offered.lastOfferedAt + FEEDBACK_INTERVAL_MS), true);
assert.equal(FEEDBACK_INTERVAL_MS, 7 * 86400000);
const shortStudy = new StudyExposure(0, true);
assert.equal(shortStudy.finish(59999), false);
const fullStudy = new StudyExposure(0, true);
assert.equal(fullStudy.finish(60000), true);
const pausedStudy = new StudyExposure(0, true);
pausedStudy.setActive(30000, false);
pausedStudy.setActive(900000, true);
assert.equal(pausedStudy.finish(929999), false); // Background time never counts.
const resumedStudy = new StudyExposure(0, true);
resumedStudy.setActive(30000, false);
resumedStudy.setActive(900000, true);
assert.equal(resumedStudy.finish(930000), true); // Foreground portions accumulate.
assert.equal(canAttemptReview([now - 1, now - 2], now), true);
assert.equal(canAttemptReview([now - 1, now - 2, now - 3], now), false);
assert.equal(canAttemptReview([now - 366 * 86400000, now - 1, now - 2], now), true);
console.log('PASS: permanent installed grant, later paid cohort, offline behavior, third-day start, weekly interval, 60-second foreground study checkpoints and annual review cap');
