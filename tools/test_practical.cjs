const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { transformSync } = require('esbuild');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
function load(file, mocks = {}) {
  const module = { exports: {} };
  vm.runInNewContext(transformSync(fs.readFileSync(file, 'utf8'), {
    loader: file.endsWith('.tsx') ? 'tsx' : 'ts', format: 'cjs',
  }).code, { module, exports: module.exports, Date, require(name) {
    if (name in mocks) return mocks[name]; throw new Error(name);
  } });
  return module.exports;
}
const rules = load('src/data/practical.ts');
const sets = Array.from({ length: 12 }, (_, i) => JSON.parse(fs.readFileSync(`content/questions/mock${i + 1}.json`, 'utf8')));
const ids = new Set();
let groups = 0, parts = 0;
for (const qs of sets) {
  assert.equal(qs.length, 35);
  assert.equal(qs.filter(q => q.practical).length, 5);
  for (const q of qs) {
    assert.equal(ids.has(q.id), false); ids.add(q.id);
    assert.ok(q.choices[q.answer]); // A valid legacy fallback remains for old clients.
    if (!q.practical) continue;
    groups++; parts += q.practical.parts.length;
    assert.ok(q.id.endsWith('-practical-v2')); // Revised questions must not reuse old answer history.
    assert.ok(q.practical.image.includes('viewBox="0 0 600 400"'));
    assert.ok(q.practical.parts.length >= 2);
    assert.ok(q.practical.parts.some(p => p.kind === 'text'));
    assert.ok(q.practical.parts.some(p => p.kind === 'symbol'));
    const draft = {};
    for (const part of q.practical.parts) {
      assert.equal(rules.partCorrect(part, ''), false);
      for (const answer of part.answers) assert.equal(rules.partCorrect(part, answer), true);
      if (part.kind === 'symbol') {
        const symbols = part.options.map(option => option.symbol);
        assert.equal(new Set(symbols).size, symbols.length);
        assert.equal(symbols.filter(symbol => rules.partCorrect(part, symbol)).length, 1);
      }
      draft[part.id] = part.answers[0];
    }
    assert.equal(rules.gradePractical(q, draft).earned, rules.practicalTotal(q));
    delete draft[q.practical.parts[0].id];
    assert.equal(rules.gradePractical(q, draft).earned, rules.practicalTotal(q) - 1);
  }
}
assert.equal(groups, 60);
assert.equal(rules.partCorrect({ answers: ['3kg'] }, '３ ｋｇ'), true);
assert.equal(rules.partCorrect({ answers: ['3'] }, '3.5'), false);
assert.equal(rules.partCorrect({ answers: ['安全栓'] }, '安全栓なし'), false);
const reason = sets[0].find(q => q.practical).practical.parts.find(p => p.rubric);
assert.equal(rules.assessPart(reason, '本体容器内に常時圧力を蓄える。').earned, 1);
assert.equal(rules.assessPart(reason, '本体容器内に常時圧力を蓄える。').needsReview, true);
assert.equal(rules.assessPart(reason, 'あらかじめ容器の内部にガスの圧力を蓄え、ガスの力で薬剤を押し出す。').earned, 2);
assert.equal(rules.assessPart(reason, reason.answers[0] + 'という説明は間違いです。').earned, 0);
assert.equal(rules.assessPart(reason, '圧力・容器・ガス・薬剤').earned, 0); // Keyword salad is not an explanation.
assert.equal(rules.assessPart(reason, '別の言い回しで説明した文章').needsReview, true);
assert.equal(rules.assessPart(reason, '').needsReview, false);
const qs = sets[0];
const perfect = Object.fromEntries(qs.map(q => [q.id, { earned: q.practical ? rules.practicalTotal(q) : 1, total: q.practical ? rules.practicalTotal(q) : 1 }]));
assert.equal(rules.practicePassed(qs, perfect), true);
const noPractical = Object.fromEntries(qs.map(q => [q.id, { ...perfect[q.id], earned: q.practical ? 0 : 1 }]));
assert.equal(rules.practicePassed(qs, noPractical), false); // Passing written alone never passes practical.
const noLaw = Object.fromEntries(qs.map(q => [q.id, { ...perfect[q.id], earned: ['1', '2'].includes(q.chapter) ? 0 : perfect[q.id].earned }]));
assert.equal(rules.practicePassed(qs, noLaw), false); // Subject minimum cannot be hidden by an overall percentage.
assert.equal(rules.sectionScores(qs, {}).practicalEarned, 0); // Timeout/unanswered subquestions score zero.
const actualPerfect = Object.fromEntries(qs.map(q => [q.id, q.practical ? rules.gradePractical(q, Object.fromEntries(q.practical.parts.map(p => [p.id, p.answers[0]]))) : { earned: 1, total: 1 }]));
const summary = rules.assessmentSummary(qs, actualPerfect);
assert.equal(summary.reviewCount, 0);
for (const entry of Object.values(summary.categories)) assert.equal(entry.earned, entry.total);
assert.equal(rules.assessmentSummary(qs, {}).categories.reason.earned, 0);
assert.ok(rules.assessmentSummary(qs, {}).categories.reason.total > 0);
const nameAnswers = new Set(sets.flatMap(set => set.flatMap(q => q.practical?.parts.filter(p => p.id === 'name').map(p => p.answers[0]) ?? [])));
for (const name of ['安全栓', '指示圧力計', 'ホース', 'ノズル', '本体容器', 'レバー', 'クランプ台', 'キャップスパナ', 'はかり', '標準圧力計']) assert.ok(nameAnswers.has(name), name);
for (const set of sets) {
  assert.equal(set.filter(q => !q.practical).length, 30);
  for (const q of set.filter(q => !q.practical)) assert.equal(q.choices.length, 4);
  assert.deepEqual(Object.fromEntries(['1','2','3','4','5','6'].map(ch => [ch,set.filter(q => q.chapter === ch).length])), {'1':6,'2':4,'3':5,'4':9,'5':6,'6':5});
}

// Render the actual component through lightweight HTML host adapters for content/visual QA.
function style(value) {
  const result = Object.assign({}, ...[value].flat(10).filter(Boolean));
  if (result.lineHeight) result.lineHeight += 'px';
  if (result.paddingHorizontal != null) { result.paddingLeft = result.paddingRight = result.paddingHorizontal; delete result.paddingHorizontal; }
  if (result.paddingVertical != null) { result.paddingTop = result.paddingBottom = result.paddingVertical; delete result.paddingVertical; }
  if (result.marginVertical != null) { result.marginTop = result.marginBottom = result.marginVertical; delete result.marginVertical; }
  delete result.alignSelf;
  return result;
}
const host = tag => ({ children, style: styles, value, placeholder, editable, ...props }) => React.createElement(tag, {
  style: style(styles), defaultValue: value, placeholder, readOnly: editable === false,
  'aria-label': props.accessibilityLabel, role: props.accessibilityRole,
}, children);
const colors = load('src/theme/colors.ts');
const styles = load('src/ui/styles.ts', { 'react-native': { StyleSheet: { create: s => s } } });
let theme = colors.light;
const { PracticalQuestion } = load('src/ui/PracticalQuestion.tsx', {
  react: React,
  'react-native': { Image: ({ source, style: st }) => React.createElement('img', { src: source, style: style(st) }), View: host('div'), Text: host('div'), Pressable: host('div'), ScrollView: host('div'), TextInput: props => props.multiline ? host('textarea')(props) : host('input')(props), Modal: ({ visible, children }) => visible ? children : null },
  'react-native-svg': { SvgXml: ({ xml, height }) => React.createElement('div', { style: { height }, dangerouslySetInnerHTML: { __html: xml.replace('<svg ', '<svg width="100%" height="100%" ') } }) },
  '../data/practical': rules,
  '../data/practicalImages': { practicalImages: Object.fromEntries(['powder','co2','gauges','cap','tools','fires'].map(key => [key, '../assets/figures/practical_' + key + '.jpg'])) },
  '../theme/ThemeContext': { useTheme: () => ({ c: theme }), useStyles: () => styles.makeStyles(theme) },
});
const practical = qs.find(q => q.practical).practical;
const render = props => renderToStaticMarkup(React.createElement(PracticalQuestion, { practical, ...props }));
const initial = render({});
assert.ok(initial.includes('<img'));
assert.ok(initial.includes('<input'));
assert.ok(!initial.includes('◯ 正解'));
assert.ok(!initial.includes('解答例：'));
assert.ok(!initial.includes('常時、容器内に圧力を蓄える')); // Do not leak the rubric before submission.
const answered = render({ revealed: true, draft: Object.fromEntries(practical.parts.map(p => [p.id, p.answers[0]])) });
assert.ok(answered.includes('◯ 正解'));
assert.ok(render({ review: true }).includes('解答例'));
assert.ok(!render({ review: true }).includes('<input'));
assert.ok(render({ review: true, draft: { reason: '保存した説明文' } }).includes('保存した説明文'));
const { PracticalAssessment } = load('src/ui/PracticalAssessment.tsx', { react: React, 'react-native': { View: host('div'), Text: host('div') }, '../data/practical': rules, '../theme/ThemeContext': { useStyles: () => styles.makeStyles(theme) } });
const report = renderToStaticMarkup(React.createElement(PracticalAssessment, { summary }));
assert.ok(report.includes('理由・働きの説明'));
assert.ok(report.includes('文章の自己確認：'));
theme = colors.dark;
const dark = render({});
fs.mkdirSync('tmp', { recursive: true });
fs.writeFileSync('tmp/practical-ui-preview.html', `<!doctype html><meta charset="utf-8"><style>*{box-sizing:border-box}body{font-family:Meiryo,sans-serif;background:#e8edf2;margin:20px}main{display:flex;gap:24px}section{width:390px;padding:16px;border-radius:18px;background:#f4f6f9}section:last-child{background:#0c0e12;color:white}h1{font-size:22px}svg{max-width:100%}input,textarea,img{width:100%}</style><h1>実装コンポーネントの表示確認（実機撮影ではありません）</h1><main><section><h2>解答前</h2>${initial}</section><section><h2>採点後</h2>${answered}${report}</section><section><h2>ダーク表示</h2>${dark}</section></main>`);

(async () => {
  let saved;
  const history = load('src/data/history.ts', { '@react-native-async-storage/async-storage': {
    async setItem(_key, value) { saved = value; }, async getItem() { return saved ?? null; },
  } });
  await history.recordAnswer('practical-test', false, false, { earned: 1, total: 3 });
  await history.loadHistory();
  assert.equal(history.getRec('practical-test').lastPoints.earned, 1);
  assert.equal(history.getRec('practical-test').seen, 1);
  assert.equal(history.isWeak('practical-test'), true);
  await history.recordAnswer('written-test', true, false);
  assert.equal(history.getRec('written-test').lastCorrect, true);
  await history.recordAnswer('old-client-practical-v1', true, false);
  assert.equal(history.getRec('old-client-practical-v1'), undefined);
  assert.equal(history.selectReview(['old-client-practical-v1']).unseen.length, 1);
  await history.recordAnswer('old-client-practical-v1', false, false, { earned: 1, total: 2 });
  assert.equal(history.getRec('old-client-practical-v1').seen, 1);
  assert.equal(history.getRec('old-client-practical-v1').lastPoints.total, 2);
  await history.recordAnswer('old-client-practical-v2', true, false, { earned: 2, total: 2 });
  assert.equal(history.getRec('old-client-practical-v2'), undefined); // Old JS cannot supply the new rubric version.
  const evaluation = rules.gradePractical(qs.find(q => q.practical), { reason: '本体容器内に常時圧力を蓄える。' });
  await history.recordAnswer('old-client-practical-v2', false, false, evaluation);
  await history.loadHistory();
  assert.equal(history.getRec('old-client-practical-v2').seen, 1);
  assert.equal(history.getRec('old-client-practical-v2').lastPoints.reviewCount, 1);
  assert.equal(history.getRec('old-client-practical-v2').lastPoints.categories.reason.earned, 1);
  assert.equal(history.getRec('old-client-practical-v2').lastPoints.answers.reason, '本体容器内に常時圧力を蓄える。');
  console.log(`PASS: 12 mocks, ${groups} image groups/${parts} subquestions, aliases, partial credit, separate section scoring, history persistence and actual component rendering`);
})().catch(error => { console.error(error); process.exitCode = 1; });
