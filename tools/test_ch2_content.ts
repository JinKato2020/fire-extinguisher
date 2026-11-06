import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseMarkdown } from '../src/ui/markdown';
import { parseLessons } from '../src/ui/lessons';

const data = JSON.parse(fs.readFileSync('content/chapters/ch2.json', 'utf8'));
const body = data.bodyV2;
const lessons = parseLessons(body);
assert.equal(lessons.length, 7); // intro, five stable lesson IDs, independent review
assert.deepEqual(lessons.map(l => l.key), ['intro', 'l0', 'l1', 'l2', 'l3', 'l4', 'review']);
let totalChecks = 0;
for (let index = 1; index < lessons.length; index++) {
  const checks = parseMarkdown(lessons[index].body).filter(b => b.type === 'check');
  assert.equal(checks.length, index === 6 ? 8 : 3);
  if (index < 6) assert.ok(lessons[index].body.includes('### 具体例で考える'));
  for (const check of checks) {
    assert.ok(check.answer?.trim());
    assert.ok(!check.text.includes('**答え：'));
    for (const ref of check.answer!.match(/→ Lesson ([\d・]+)/)![1].split('・').map(Number)) {
      assert.ok(lessons.some(l => new RegExp('^Lesson\\s+0*' + ref + '\\s').test(l.label)));
    }
  }
  totalChecks += checks.length;
}
assert.equal(totalChecks, 23);
assert.ok(!data.body.includes(':::'));
assert.equal((data.body.match(/^#### 問/gm) || []).length, totalChecks);
assert.equal((data.body.match(/^> \[!NOTE\] 解答・解説/gm) || []).length, totalChecks);
assert.deepEqual([...data.body.matchAll(/^\[\[fig:([^|]+)/gm)].map(m => m[1]), [...body.matchAll(/^\[\[fig:([^|]+)/gm)].map(m => m[1]));

const source = fs.readFileSync('../教材解説/第2章_図表データ.md', 'utf8').replace(/\r\n/g, '\n');
const tables = JSON.parse(fs.readFileSync('content/lesson-tables.json', 'utf8'));
const matches = [...source.matchAll(/^## (ch2_t\d+)\|([^\n]+)\n\n(.*?)(?=^## |$(?![\s\S]))/gms)];
assert.equal(matches.length, 15);
assert.equal(Object.keys(tables).filter(key => key.startsWith('ch2_')).length, 15);
for (const [, id, title, text] of matches) {
  const rows = text.split('\n').filter(line => line.startsWith('|')).map(line => line.split('|').slice(1, -1).map(s => s.trim()))
    .filter(row => !row.every(cell => /^:?-+:?$/.test(cell)));
  assert.equal(tables[id].title, title);
  assert.deepEqual(tables[id].headers, rows[0]);
  assert.deepEqual(tables[id].rows, rows.slice(1));
  assert.equal([...body.matchAll(new RegExp('^\\[\\[fig:' + id + '_(?:full|\\d+)\\|', 'gm'))].length, 1);
}

// Independent oracle: 消防法施行令 別表第二, e-Gov law ID 336CO0000000037.
// All 195 cells checked against the current law XML on 2026-11-06.
// Columns: 水(棒/霧), 強化液(棒/霧), 泡, CO2, ハロゲン, 粉末(りん酸/炭酸/その他), 水槽, 砂, ひる石.
const official = [
  '1111100100100', '0101011110000', '0000000011011',
  '1111100100111', '0000000011011', '1111111110111',
  '1111100100111', '0000000011011', '1111100000111',
  '0001111110011', '1111100000111', '1111100100111',
  '1111111110111', '0001111110011', '1111100100100',
];
assert.equal(tables.ch2_t09.headers.length, 14);
assert.deepEqual(tables.ch2_t09.rows.map((row: string[]) => row.slice(1).map(cell => cell.replace(/\*\*/g, '') === '○' ? '1' : '0').join('')), official);
for (const match of body.matchAll(/^\[\[fig:([^|]+)/gm)) assert.ok(fs.existsSync(`assets/figures/${match[1]}.jpg`), match[1]);
assert.ok(!body.includes('要原本確認'));
assert.ok(!body.includes('書き起こし'));
console.log('PASS: chapter 2 has 7 entries, 23 checks, 15 complete canonical tables, 195 verified legal matrix cells, readable legacy fallback');
