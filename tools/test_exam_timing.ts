import assert from 'node:assert/strict';
import { EXAM_DURATION_SECONDS, formatExamTime, remainingSeconds } from '../src/data/examTiming';

const start = 100000;
const deadline = start + EXAM_DURATION_SECONDS * 1000;
assert.equal(EXAM_DURATION_SECONDS, 6300);
assert.equal(remainingSeconds(deadline, start), 6300);
assert.equal(formatExamTime(6300), '105:00');
assert.equal(formatExamTime(600), '10:00');
assert.equal(formatExamTime(59), '0:59');
assert.equal(remainingSeconds(deadline, deadline - 1), 1);
assert.equal(remainingSeconds(deadline, deadline), 0);
assert.equal(remainingSeconds(deadline, deadline + 5000), 0);
// Returning after 104 minutes in background leaves one minute, regardless of ticks.
assert.equal(remainingSeconds(deadline, start + 104 * 60 * 1000), 60);
assert.equal(remainingSeconds(null, deadline + 10000000), null);
// A fresh attempt receives the full duration again.
const retry = deadline + 10000;
assert.equal(remainingSeconds(retry + EXAM_DURATION_SECONDS * 1000, retry), 6300);
console.log('PASS: 105-minute duration, background elapsed time, deadline boundaries, untimed mode, retry');
