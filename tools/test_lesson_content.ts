import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseMarkdown } from '../src/ui/markdown';
import { parseLessons } from '../src/ui/lessons';

assert.equal(parseMarkdown('> [!IMPORTANT] Empty\n\nText').some(b => b.type === 'quote'), false);
assert.throws(() => parseMarkdown(':::check Q\nQuestion\n---\nAnswer'), /閉じ記号/);
assert.throws(() => parseMarkdown(':::check Q\nQuestion\n:::'), /解答/);
const check = parseMarkdown(':::check Q\r\nQuestion\r\n---\r\nAnswer\r\n:::')[0];
assert.equal(check.text, 'Question');
assert.equal(check.answer, 'Answer');
assert.deepEqual(parseMarkdown(':::steps Flow\n1. A\n2. B\n:::')[0].items, ['A', 'B']);

const data = JSON.parse(fs.readFileSync('content/chapters/ch1.json', 'utf8'));
const body = data.bodyV2;
assert.equal(typeof body, 'string');
assert.ok(!data.body.includes(':::'));
assert.equal((data.body.match(/^#### 問/gm) || []).length, 40);
assert.equal((data.body.match(/^> \[!NOTE\] 解答・解説/gm) || []).length, 40);
// Both delivery orders are safe: old JS sees regular Markdown; new JS prefers bodyV2.
assert.deepEqual([...data.body.matchAll(/^\[\[fig:([^|]+)/gm)].map(m => m[1]), [...body.matchAll(/^\[\[fig:([^|]+)/gm)].map(m => m[1]));
const lessons = parseLessons(body);
assert.equal(lessons.length, 19); // Intro, 17 lessons, separately reachable review.
assert.equal(lessons[0].key, 'intro');
assert.equal(lessons.at(-1)?.key, 'review');
for (let n = 1; n <= 17; n++) {
  assert.equal(lessons[n].key, 'l' + (n - 1));
  assert.equal(parseMarkdown(lessons[n].body).filter(b => b.type === 'check').length, 2);
  assert.ok(lessons[n].body.includes('### 具体例で考える'));
}
const review = parseMarkdown(lessons.at(-1)!.body);
assert.equal(review.filter(b => b.type === 'check').length, 6);
for (const block of parseMarkdown(body).filter(b => b.type === 'check')) {
  assert.ok(block.answer?.trim());
  assert.ok(!block.text.includes('**答え：'), 'Answers must not leak into the question');
}
for (const block of review.filter(b => b.type === 'check')) {
  const refs = block.answer!.match(/→ Lesson ([\d・]+)/)![1].split('・').map(Number);
  for (const ref of refs) assert.ok(lessons.some(l => new RegExp('^Lesson\\s+0*' + ref + '\\s').test(l.label)));
}

// Generated card cells must be exactly the canonical table cells, with no missing rows.
const source = fs.readFileSync('../教材解説/第1章_図表データ.md', 'utf8').replace(/\r\n/g, '\n');
const tables = JSON.parse(fs.readFileSync('content/lesson-tables.json', 'utf8'));
const matches = [...source.matchAll(/^## (ch1_t\d+)\|([^\n]+)\n\n(.*?)(?=^## |$(?![\s\S]))/gms)];
assert.equal(matches.length, 26);
assert.equal(Object.keys(tables).filter(key => key.startsWith('ch1_')).length, 26);
for (const [, id, title, text] of matches) {
  const rows = text.split('\n').filter(line => line.startsWith('|')).map(line => line.split('|').slice(1, -1).map(s => s.trim()))
    .filter(row => !row.every(cell => /^:?-+:?$/.test(cell)));
  assert.equal(tables[id].title, title);
  assert.deepEqual(tables[id].headers, rows[0]);
  assert.deepEqual(tables[id].rows, rows.slice(1));
  assert.equal([...body.matchAll(new RegExp('^\\[\\[fig:' + id + '_(?:full|\\d+)\\|', 'gm'))].length, 1, 'Each complete table renders once');
}
for (let n = 2; n <= 6; n++) {
  const other = JSON.parse(fs.readFileSync(`content/chapters/ch${n}.json`, 'utf8')).body;
  assert.equal(parseLessons(other).filter(l => /^l\d+$/.test(l.key)).length, (other.match(/^## Lesson /gm) || []).length);
}
console.log('PASS: 19 entries, 40 hidden-answer checks, valid review links, 26 complete canonical tables, existing chapters preserved');
