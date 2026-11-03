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
    assert.ok(q.id.endsWith('-practical-v1')); // Never mix old choice-only scores into the new practical grade.
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
    assert.equal(rules.gradePractical(q, draft).earned, q.practical.parts.length);
    delete draft[q.practical.parts[0].id];
    assert.equal(rules.gradePractical(q, draft).earned, q.practical.parts.length - 1);
  }
}
assert.equal(groups, 60);
assert.equal(rules.partCorrect({ answers: ['3kg'] }, '３ ｋｇ'), true);
assert.equal(rules.partCorrect({ answers: ['3'] }, '3.5'), false);
assert.equal(rules.partCorrect({ answers: ['安全栓'] }, '安全栓なし'), false);
const qs = sets[0];
const perfect = Object.fromEntries(qs.map(q => [q.id, { earned: q.practical?.parts.length ?? 1, total: q.practical?.parts.length ?? 1 }]));
assert.equal(rules.practicePassed(qs, perfect), true);
const noPractical = Object.fromEntries(qs.map(q => [q.id, { ...perfect[q.id], earned: q.practical ? 0 : 1 }]));
assert.equal(rules.practicePassed(qs, noPractical), false); // Passing written alone never passes practical.
const noLaw = Object.fromEntries(qs.map(q => [q.id, { ...perfect[q.id], earned: ['1', '2'].includes(q.chapter) ? 0 : perfect[q.id].earned }]));
assert.equal(rules.practicePassed(qs, noLaw), false); // Subject minimum cannot be hidden by an overall percentage.
assert.equal(rules.sectionScores(qs, {}).practicalEarned, 0); // Timeout/unanswered subquestions score zero.

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
  'react-native': { View: host('div'), Text: host('div'), Pressable: host('div'), ScrollView: host('div'), TextInput: host('input'), Modal: ({ visible, children }) => visible ? children : null },
  'react-native-svg': { SvgXml: ({ xml, height }) => React.createElement('div', { style: { height }, dangerouslySetInnerHTML: { __html: xml.replace('<svg ', '<svg width="100%" height="100%" ') } }) },
  '../data/practical': rules,
  '../theme/ThemeContext': { useTheme: () => ({ c: theme }), useStyles: () => styles.makeStyles(theme) },
});
const practical = qs.find(q => q.practical).practical;
const render = props => renderToStaticMarkup(React.createElement(PracticalQuestion, { practical, ...props }));
const initial = render({});
assert.ok(initial.includes('<svg'));
assert.ok(initial.includes('<input'));
assert.ok(!initial.includes('◯ 正解'));
assert.ok(!initial.includes('解答例：'));
const answered = render({ revealed: true, draft: Object.fromEntries(practical.parts.map(p => [p.id, p.answers[0]])) });
assert.ok(answered.includes('◯ 正解'));
assert.ok(render({ review: true }).includes('解答例'));
assert.ok(!render({ review: true }).includes('<input'));
theme = colors.dark;
const dark = render({});
fs.mkdirSync('tmp', { recursive: true });
fs.writeFileSync('tmp/practical-ui-preview.html', `<!doctype html><meta charset="utf-8"><style>*{box-sizing:border-box}body{font-family:Meiryo,sans-serif;background:#e8edf2;margin:20px}main{display:flex;gap:24px}section{width:390px;padding:16px;border-radius:18px;background:#f4f6f9}section:last-child{background:#0c0e12;color:white}h1{font-size:22px}svg{max-width:100%}input{width:100%}</style><h1>実装コンポーネントの表示確認（実機撮影ではありません）</h1><main><section><h2>解答前</h2>${initial}</section><section><h2>採点後</h2>${answered}</section><section><h2>ダーク表示</h2>${dark}</section></main>`);

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
  console.log(`PASS: 12 mocks, ${groups} image groups/${parts} subquestions, aliases, partial credit, separate section scoring, history persistence and actual component rendering`);
})().catch(error => { console.error(error); process.exitCode = 1; });
