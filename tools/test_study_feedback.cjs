const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { transformSync } = require('esbuild');
function load(file, mocks, extras = {}) {
  const module = { exports: {} };
  vm.runInNewContext(transformSync(fs.readFileSync(file, 'utf8'), { loader: 'ts', format: 'cjs' }).code,
    { module, exports: module.exports, require: name => mocks[name], ...extras });
  return module.exports;
}
let now = 0, sequence = 0, offers = 0, shown = 0;
const timers = new Map(), changes = new Set();
const AppState = { currentState: 'active', addEventListener(_event, fn) {
  changes.add(fn); return { remove() { changes.delete(fn); } };
} };
const api = load('src/data/studyFeedback.ts', {
  'react-native': { AppState }, './feedback': { async offerFeedback() { offers++; return true; } },
}, {
  setTimeout(fn, delay) { const id = ++sequence; timers.set(id, { at: now + delay, fn }); return id; },
  clearTimeout(id) { timers.delete(id); },
});
async function advance(ms) {
  now += ms;
  for (const [id, timer] of timers) if (timer.at <= now) { timers.delete(id); timer.fn(); }
  await Promise.resolve();
}
function foreground(active) {
  AppState.currentState = active ? 'active' : 'background';
  for (const fn of changes) fn(AppState.currentState);
}
(async () => {
  const unsubscribe = api.subscribeStudyFeedback(() => shown++);
  const short = api.beginStudyFeedback(); short(false);
  await advance(400); assert.equal(offers, 0);
  const quiz = api.beginStudyFeedback();
  await advance(60000); assert.equal(offers, 0); // Never during a test, regardless of elapsed time.
  quiz(true); // Partial exit qualifies; no question-count/completion requirement.
  await advance(399); assert.equal(offers, 0);
  await advance(1); assert.equal(offers, 1); assert.equal(shown, 1);
  quiz(true); await advance(400); assert.equal(offers, 1); // Cleanup cannot duplicate an exit.
  const lesson = api.beginStudyFeedback(); lesson(true);
  const nextQuiz = api.beginStudyFeedback();
  await advance(120000); assert.equal(offers, 1); // A pending request never interrupts another test.
  nextQuiz(false); await advance(400); assert.equal(offers, 2);
  const paused = api.beginStudyFeedback(); foreground(false); paused(true);
  await advance(10000); assert.equal(offers, 2);
  foreground(true); await advance(400); assert.equal(offers, 3);
  unsubscribe();

  // The React hook ends exposure only on cleanup/completion, not on a timeout.
  const rules = load('src/data/feedbackRules.ts', {});
  let cleanup, qualified = null;
  class Clock extends Date { static now() { return now; } }
  const hook = load('src/ui/useStudyFeedback.ts', {
    react: { useEffect(fn) { cleanup = fn(); } }, 'react-native': { AppState },
    '../data/feedbackRules': rules,
    '../data/studyFeedback': { beginStudyFeedback() { return value => { qualified = value; }; } },
  }, { Date: Clock });
  hook.useStudyFeedback('quiz', true);
  await advance(30000); foreground(false);
  await advance(900000); foreground(true);
  await advance(30000); assert.equal(qualified, null);
  cleanup(); assert.equal(qualified, true);
  qualified = null;
  hook.useStudyFeedback('terms', true);
  await advance(59999); cleanup(); assert.equal(qualified, false);
  console.log('PASS: foreground exposure, 60-second threshold, partial quiz exit, no in-test prompts, navigation deferral and duplicate cleanup');
})().catch(error => { console.error(error); process.exitCode = 1; });
