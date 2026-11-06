import assert from 'node:assert/strict';
import { enrollLaunchAccess, parseLaunchGrant, parseLaunchPolicy } from '../src/data/launchAccessRules';
import { feedbackDue, FEEDBACK_INTERVAL_MS, StudyExposure } from '../src/data/feedbackRules';

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
const schedule = { firstUsedAt: firstUse, lastOfferedAt: null, reviewAttempts: [], studySessions: [firstUse, firstUse + 60000, firstUse + 120000] };
assert.equal(feedbackDue(schedule, firstUse), false);
assert.equal(feedbackDue(schedule, thirdDay - 1), false);
assert.equal(feedbackDue(schedule, thirdDay), true);
const offered = { ...schedule, lastOfferedAt: thirdDay + 3600000, studySessions: [thirdDay + 7200000, thirdDay + 86400000, thirdDay + 90000000] };
assert.equal(feedbackDue(offered, offered.lastOfferedAt + FEEDBACK_INTERVAL_MS - 1), false);
assert.equal(feedbackDue(offered, offered.lastOfferedAt + FEEDBACK_INTERVAL_MS), true);
assert.equal(FEEDBACK_INTERVAL_MS, 10 * 86400000);
const shortStudy = new StudyExposure(0, true);
assert.equal(shortStudy.finish(29999), false);
const fullStudy = new StudyExposure(0, true);
assert.equal(fullStudy.finish(30000), true);
const pausedStudy = new StudyExposure(0, true);
pausedStudy.setActive(15000, false);
pausedStudy.setActive(900000, true);
assert.equal(pausedStudy.finish(914999), false); // Background time never counts.
const resumedStudy = new StudyExposure(0, true);
resumedStudy.setActive(15000, false);
resumedStudy.setActive(900000, true);
assert.equal(resumedStudy.finish(915000), true); // Foreground portions accumulate.
console.log('PASS: permanent installed grant, later paid cohort, offline behavior, third-day start, 10-day interval and new learning, 30-second foreground study checkpoints');

assert.equal(feedbackDue({...schedule, studySessions: []}, thirdDay), false);
assert.equal(feedbackDue({...offered, studySessions: [thirdDay + 7200000]}, thirdDay + 20 * 86400000), false);
