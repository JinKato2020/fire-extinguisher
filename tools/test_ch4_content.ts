import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseMarkdown } from '../src/ui/markdown';
import { parseLessons } from '../src/ui/lessons';

const data = JSON.parse(fs.readFileSync('content/chapters/ch4.json', 'utf8'));
const body: string = data.bodyV2;
const lessons = parseLessons(body);
assert.deepEqual(lessons.map(l => l.key), ['intro', ...Array.from({length: 12}, (_, i) => `l${i}`), 'review']);
const checks = lessons.flatMap((lesson, i) => {
  const blocks = parseMarkdown(lesson.body).filter(b => b.type === 'check');
  assert.equal(blocks.length, i === 0 ? 0 : i === 13 ? 10 : 3);
  if (i > 0 && i < 13) assert.ok(lesson.body.includes('### 具体例で考える'));
  for (const b of blocks) {
    assert.ok(b.answer?.trim());
    assert.ok(!b.text.includes('**答え：'));
    for (const n of b.answer!.match(/→ Lesson ([\d・]+)/)![1].split('・').map(Number)) {
      assert.ok(lessons.some(l => new RegExp('^Lesson\\s+0*' + n + '\\s').test(l.label)));
    }
  }
  return blocks;
});
assert.equal(checks.length, 46);
assert.equal((data.body.match(/^> \[!NOTE\] 解答・解説/gm) || []).length, 46);
assert.ok(!data.body.includes(':::'));
for (const unwanted of ['要原本確認', '```', '[[fig:ch4_f17|']) assert.ok(!body.includes(unwanted));

const source = fs.readFileSync('../教材解説/第4章_図表データ.md', 'utf8').replace(/\r\n/g, '\n');
const tables = JSON.parse(fs.readFileSync('content/lesson-tables.json', 'utf8'));
const entries = [...source.matchAll(/^## (ch4_t\d+)\|([^\n]+)\n\n(.*?)(?=^## |$(?![\s\S]))/gms)];
assert.equal(entries.length, 21);
assert.equal(Object.keys(tables).filter(k => k.startsWith('ch4_')).length, 21);
for (const [, id, title, text] of entries) {
  const rows = text.split('\n').filter(l => l.startsWith('|')).map(l => l.split('|').slice(1, -1).map(c => c.trim()))
    .filter(row => !row.every(cell => /^:?-+:?$/.test(cell)));
  assert.equal(tables[id].title, title);
  assert.deepEqual(tables[id].headers, rows[0]);
  assert.deepEqual(tables[id].rows, rows.slice(1));
  assert.equal([...body.matchAll(new RegExp('^\\[\\[fig:' + id + '_(?:full|\\d+)\\|', 'gm'))].length, 1);
}
// Independently transcribed from FDMA inspection procedure, appendix 1:
// water/strong-liquid/mechanical-foam pressurized & chemical-foam: all / >=10%;
// gas-pressurized powder & stored-pressure: sample / >=50% of sample.
assert.deepEqual(tables.ch4_t20.rows.slice(0, 4).map((r: string[]) => r.slice(1)), [
  ['**全数**', '**全数の10%以上**'], ['**全数**', '**全数の10%以上**'],
  ['**抜取り可能**', '**抜取り数の50%以上**'], ['**抜取り可能**', '**抜取り数の50%以上**'],
]);
assert.deepEqual(tables.ch4_t10.rows.map((r: string[]) => r[1]), ['**1.5以上**', '**0.9以上**', '**0.7以上**']);
assert.ok(checks.find(c => c.title === '問3　充てん比の計算')!.answer!.startsWith(`**答え：${6 / 4}で`));
assert.ok(checks.find(c => c.title === '問3　過充てんの判定')!.answer!.includes(`6÷5＝${6 / 5}`));
assert.ok(checks.find(c => c.title === '問2　放射試料の母数')!.answer!.startsWith(`**答え：${Math.ceil(2 * .5)}本`));
assert.ok(checks.find(c => c.title === '問7　全数確認する加圧式の放射数')!.answer!.startsWith(`**答え：${Math.ceil(20 * .1)}本`));
for (const [i, t] of [0, -20, -30].entries()) {
  const p = (0.98 + 0.101325) * (t + 273.15) / 313.15 - 0.101325;
  assert.ok(tables.ch4_t14.rows[i + 1][1].includes(p.toFixed(3)));
}
const figures = (s: string) => [...s.matchAll(/^\[\[fig:([^|]+)/gm)].map(m => m[1]);
assert.deepEqual(figures(data.body), figures(body));
assert.equal(figures(body).filter(id => id.startsWith('ch4_f')).length, 21);
for (const id of figures(body)) assert.ok(fs.existsSync(`assets/figures/${id}.jpg`), id);
const glossary = fs.readFileSync('content/glossary.json', 'utf8');
assert.ok(!glossary.includes('ch4_f17'));
console.log('PASS: chapter 4: 14 entries, 46 checks, 21 canonical tables, 21 diagrams; sampling, filling ratio and pressure calculations verified');
