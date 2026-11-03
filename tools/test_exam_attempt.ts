import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ExamAttempt } from '../src/data/examAttempt';
import type { Question } from '../src/data/questions';
const questions = JSON.parse(fs.readFileSync('content/questions/mock1.json', 'utf8')) as Question[];
const exam = new ExamAttempt(questions, 1000);
const written = questions[0];
const practical = questions.find(q => q.practical)!;
assert.equal(exam.update(written.id, { choice: (written.answer + 1) % 4 }, 10), true);
assert.equal(exam.result, null); // No grading while navigating/answering.
assert.equal(exam.update(written.id, { choice: written.answer, flagged: true }, 20), true);
assert.equal(exam.answers[written.id].choice, written.answer); // Revisiting preserves the latest answer.
assert.equal(exam.update(written.id, { choice: undefined }, 30), true);
assert.equal(exam.answered(written.id), false);
exam.update(written.id, { choice: written.answer }, 40);
const draft = Object.fromEntries(practical.practical!.parts.map(p => [p.id, p.answers[0]]));
assert.equal(exam.update(practical.id, { text: draft }, 999), true);
assert.equal(exam.update(practical.id, { text: {} }, 1000), false); // Late keyboard events cannot erase/alter answers.
assert.equal(exam.expired(1000), true);
const result = exam.finish();
assert.equal(Object.keys(result).length, 35);
assert.equal(result[written.id].earned, 1);
assert.equal(result[practical.id].earned, result[practical.id].total); // Includes current text even without Next.
assert.equal(result[questions[1].id].earned, 0); // Skipped questions count as zero.
assert.equal(exam.finish(), result); // Timer + confirmation race submits once.
assert.equal(exam.update(written.id, { choice: 3 }, 10), false); // Locked after submission.
assert.equal(new ExamAttempt(questions, null).expired(Number.MAX_SAFE_INTEGER), false);
const retry = new ExamAttempt(questions, 2000);
assert.deepEqual(retry.answers, {});
assert.equal(retry.result, null);
console.log('PASS: deferred grading, navigation edits, clear answer, current text at timeout, deadline lock, skipped answers, single submission, retry');
