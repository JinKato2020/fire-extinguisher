import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseMarkdown } from '../src/ui/markdown';
import { parseLessons } from '../src/ui/lessons';

const data = JSON.parse(fs.readFileSync('content/chapters/ch3.json', 'utf8'));
const body: string = data.bodyV2;
const lessons = parseLessons(body);
assert.deepEqual(lessons.map(l => l.key), ['intro', 'l0', 'l1', 'l2', 'l3', 'l4', 'l5', 'review']);
const checks = lessons.flatMap((lesson, index) => {
  const list = parseMarkdown(lesson.body).filter(b => b.type === 'check');
  assert.equal(list.length, index === 0 ? 0 : index === 7 ? 8 : 3);
  if (index > 0 && index < 7) assert.ok(lesson.body.includes('### 具体例で考える'));
  for (const check of list) {
    assert.ok(check.answer?.trim());
    assert.ok(!check.text.includes('**答え：'));
    for (const number of check.answer!.match(/→ Lesson ([\d・]+)/)![1].split('・').map(Number)) {
      assert.ok(lessons.some(l => new RegExp('^Lesson\\s+0*' + number + '\\s').test(l.label)));
    }
  }
  return list;
});
assert.equal(checks.length, 26);
assert.ok(!data.body.includes(':::'));
assert.equal((data.body.match(/^> \[!NOTE\] 解答・解説/gm) || []).length, 26);
assert.ok(!body.includes('要原本確認'));
assert.ok(!body.includes('```'), 'Formulae must reflow as text, not fixed-width code');

// Independently recompute the examples that distinguish correct units/conditions.
const review = checks.slice(-8);
const expected = [6 * 9.8, 2000 / (0.5 * 100), 80 * (25 / 100), 0.2 * 150 * 4,
  300 / 5, 1000 * 9.8 * 0.2, (0.8 + 0.1) * (57 + 273) / (27 + 273) - 0.1];
const units = ['N', 'MPa', 'N·m', 'J', 'MPa', 'Pa', 'MPa'];
expected.forEach((value, i) => assert.ok(review[i].answer!.startsWith(`**答え：${Number(value.toFixed(8))} ${units[i]}。**`)));
assert.ok(checks.find(c => c.title === '問2　静止摩擦力と最大値')!.answer!.includes('摩擦力は20 N'));
assert.ok(checks.find(c => c.title === '問3　フックの法則の条件')!.answer!.includes('比例限度内'));

const source = fs.readFileSync('../教材解説/第3章_図表データ.md', 'utf8').replace(/\r\n/g, '\n');
const tables = JSON.parse(fs.readFileSync('content/lesson-tables.json', 'utf8'));
const entries = [...source.matchAll(/^## (ch3_t\d+)\|([^\n]+)\n\n(.*?)(?=^## |$(?![\s\S]))/gms)];
assert.equal(entries.length, 11);
assert.equal(Object.keys(tables).filter(key => key.startsWith('ch3_')).length, 11);
assert.equal(Object.keys(tables).filter(key => key.startsWith('ch1_')).length, 26);
assert.equal(Object.keys(tables).filter(key => key.startsWith('ch2_')).length, 15);
for (const [, id, title, text] of entries) {
  const rows = text.split('\n').filter(line => line.startsWith('|')).map(line => line.split('|').slice(1, -1).map(s => s.trim()))
    .filter(row => !row.every(cell => /^:?-+:?$/.test(cell)));
  assert.equal(tables[id].title, title);
  assert.deepEqual(tables[id].headers, rows[0]);
  assert.deepEqual(tables[id].rows, rows.slice(1));
  assert.equal([...body.matchAll(new RegExp('^\\[\\[fig:' + id + '_(?:full|\\d+)\\|', 'gm'))].length, 1);
}
const figures = (text: string) => [...text.matchAll(/^\[\[fig:([^|]+)/gm)].map(m => m[1]);
assert.deepEqual(figures(data.body), figures(body));
assert.equal(figures(body).filter(id => id.startsWith('ch3_f')).length, 20);
for (const id of figures(body)) assert.ok(fs.existsSync(`assets/figures/${id}.jpg`), id);
console.log('PASS: chapter 3 has 8 entries, 26 checks with verified calculations, 11 canonical tables, 20 diagrams, readable legacy fallback');
