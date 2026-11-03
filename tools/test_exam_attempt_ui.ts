import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import React from 'react';
const { renderToStaticMarkup } = require('react-dom/server');
import { transformSync } from 'esbuild';
import { ExamAttempt } from '../src/data/examAttempt';
import { sectionScores, assessmentSummary, questionStem } from '../src/data/practical';
import { remainingSeconds, formatExamTime } from '../src/data/examTiming';
const source = fs.readFileSync('App.tsx', 'utf8');
const component = source.slice(source.indexOf('function QuizPlayer('), source.indexOf('// ---- 設定 ----'));
const questions = JSON.parse(fs.readFileSync('content/questions/mock1.json', 'utf8'));
function render(index: number, submitted: boolean) {
  let state = 0, ref = 0;
  const attempt = new ExamAttempt(questions, null);
  const points = submitted ? attempt.finish() : null;
  const host = ({ children }: any) => React.createElement('div', null, children);
  const module = { exports: {} as any };
  vm.runInNewContext(transformSync(component + '\nmodule.exports = QuizPlayer;', { loader: 'tsx', format: 'cjs' }).code, {
    module, React, ExamAttempt, Date, questions, sectionScores, assessmentSummary, questionStem, remainingSeconds, formatExamTime,
    useTheme: () => ({ c: {} }), useStyles: () => ({}), useStudyFeedback: () => {}, useEffect: () => {},
    useState: (value: any) => { const i = state++; return [i === 0 ? index : i === 2 ? points : i === 6 && submitted ? index : value, () => {}]; },
    useRef: (value: any) => ({ current: ref++ === 0 ? attempt : value }),
    View: host, Text: host, ScrollView: host, Pressable: host, QLABEL: ['1','2','3','4'],
    PracticalAssessment: host,
    PracticalQuestion: (props: any) => React.createElement('div', null, props.review || props.revealed ? 'PRACTICAL_EXPLANATION' : 'PRACTICAL_INPUT_ONLY'),
  });
  return renderToStaticMarkup(React.createElement(module.exports, { title: '模試', questions, onExit() {}, onBump() {} }));
}
for (let i = 0; i < questions.length; i++) {
  const active = render(i, false);
  assert.ok(!active.includes('正解：'));
  assert.ok(!active.includes('PRACTICAL_EXPLANATION'));
  assert.ok(active.includes('提出して採点'));
}
assert.ok(render(0, true).includes('正解：'));
assert.ok(render(30, true).includes('PRACTICAL_EXPLANATION'));
console.log('PASS: actual QuizPlayer hides written/practical explanations in all 35 questions; review unlocks only after submission');
