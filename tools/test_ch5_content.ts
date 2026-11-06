import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseMarkdown } from '../src/ui/markdown';
import { parseLessons } from '../src/ui/lessons';

const data = JSON.parse(fs.readFileSync('content/chapters/ch5.json', 'utf8'));
const body: string = data.bodyV2;
const lessons = parseLessons(body);
assert.deepEqual(lessons.map(l => l.key), ['intro', ...Array.from({ length: 6 }, (_, i) => `l${i}`), 'review']);
const checks = lessons.flatMap((lesson, i) => {
  const blocks = parseMarkdown(lesson.body).filter(b => b.type === 'check');
  assert.equal(blocks.length, i === 0 ? 0 : i === 7 ? 12 : 4);
  if (i > 0 && i < 7) assert.ok(lesson.body.includes('### 具体例で考える'));
  for (const b of blocks) {
    assert.ok(b.answer?.trim());
    assert.ok(!b.text.includes('**答え：'));
    for (const n of b.answer!.match(/→ Lesson ([\d・]+)/)![1].split('・').map(Number)) {
      assert.ok(lessons.some(l => new RegExp('^Lesson\\s+0*' + n + '\\s').test(l.label)));
    }
  }
  return blocks;
});
assert.equal(checks.length, 36);
assert.equal((data.body.match(/^> \[!NOTE\] 解答・解説/gm) || []).length, 36);
assert.ok(!data.body.includes(':::'));
for (const unwanted of ['要原本確認', '市販テキスト', '㊿', '現行製品なし', '確実な得点源']) assert.ok(!body.includes(unwanted));

const source = fs.readFileSync('../教材解説/第5章_図表データ.md', 'utf8').replace(/\r\n/g, '\n');
const tables = JSON.parse(fs.readFileSync('content/lesson-tables.json', 'utf8'));
const entries = [...source.matchAll(/^## (ch5_t\d+)\|([^\n]+)\n\n(.*?)(?=^## |$(?![\s\S]))/gms)];
assert.equal(entries.length, 23);
assert.equal(Object.keys(tables).filter(k => k.startsWith('ch5_')).length, 23);
for (const [, id, title, text] of entries) {
  const rows = text.split('\n').filter(l => l.startsWith('|')).map(l => l.split('|').slice(1, -1).map(c => c.trim()))
    .filter(row => !row.every(cell => /^:?-+:?$/.test(cell)));
  assert.equal(tables[id].title, title);
  assert.deepEqual(tables[id].headers, rows[0]);
  assert.deepEqual(tables[id].rows, rows.slice(1));
  assert.equal([...body.matchAll(new RegExp('^\\[\\[fig:' + id + '_(?:full|\\d+)\\|', 'gm'))].length, 1);
}

// Independent numeric oracles from the regulation: avoid the former 1/4-turn error,
// mixing different pressure tests, and rounding B capability instead of flooring it.
const answer = (title: string) => checks.find(c => c.title === title)!.answer!;
assert.ok(answer('問1　A火災の能力単位').startsWith(`**答え：${2 * 3 + 1}。`));
assert.ok(answer('問2　B火災の端数処理').startsWith(`**答え：${Math.floor((8 + 3 + 2 + 2) / 2)}。`));
assert.ok(answer('問6　バルブを全開にする角度').startsWith(`**答え：${1 + 1 / 4}回転、${(1 + 1 / 4) * 360}°。`));
assert.ok(answer('問3　ろ過網の計算').startsWith(`**答え：${8 * 3 / 4}mm以下、1,500mm²以上。`));
assert.ok(answer('問7　ろ過網の面積').startsWith(`**答え：${12 * 30}mm²。`));
assert.ok(answer('問10　小型窒素容器の試験').startsWith(`**答え：${12 * 5 / 3}MPaを2分間。`));
assert.ok(answer('問1　泡の量').startsWith(`**答え：${6 * 5}L。`));
assert.ok(answer('問1　半径と直径').startsWith(`**答え：${1.5 * 2}cm。`));
assert.ok(answer('問2　100cm³ちょうどの封板').includes('破壊されてはいけない'));
assert.ok(answer('問3　住宅用の放射量').startsWith('**答え：85%以上。'));
assert.deepEqual(tables.ch5_t23.rows.map((r: string[]) => r.slice(1).map(c => c.replace(/\*\*/g, ''))), [
  ['P×2.0', 'P×1.6', 'P×2.7'], ['P×1.6', 'P×1.3', 'P×2.1'],
  ['P×1.5', 'P×1.2', 'P×2.0'], ['P×1.2', 'P×1.0', 'P×1.6'],
  ['Q×2.0', 'Q×1.6', 'Q×3.0'], ['Q×1.6', 'Q×1.3', 'Q×2.4'],
]);
const figures = (s: string) => [...s.matchAll(/^\[\[fig:([^|]+)/gm)].map(m => m[1]);
assert.deepEqual(figures(data.body), figures(body));
assert.equal(figures(body).filter(id => id.startsWith('ch5_f')).length, 5);
for (const id of figures(body)) assert.ok(fs.existsSync(`assets/figures/${id}.jpg`), id);
console.log('PASS: chapter 5: 8 entries, 36 checks, 23 canonical tables, 5 illustrations; capability, pressure, valve and filter calculations verified');
