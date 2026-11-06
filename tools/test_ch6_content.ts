import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseMarkdown } from '../src/ui/markdown';
import { parseLessons } from '../src/ui/lessons';

const data = JSON.parse(fs.readFileSync('content/chapters/ch6.json', 'utf8'));
const body: string = data.bodyV2;
const lessons = parseLessons(body);
assert.deepEqual(lessons.map(l => l.key), ['intro', 'l0', 'l1', 'l2', 'review']);
const checks = lessons.flatMap((lesson, i) => {
  const blocks = parseMarkdown(lesson.body).filter(b => b.type === 'check');
  assert.equal(blocks.length, [0, 4, 4, 6, 10][i]);
  if (i > 0 && i < 4) assert.ok(lesson.body.includes('### 具体例で考える'));
  for (const b of blocks) {
    assert.ok(b.answer?.trim());
    assert.ok(!b.text.includes('**答え：'));
    for (const n of b.answer!.match(/→ Lesson ([\d・]+)/)![1].split('・').map(Number)) {
      assert.ok(lessons.some(l => new RegExp('^Lesson\\s+0*' + n + '\\s').test(l.label)));
    }
  }
  return blocks;
});
assert.equal(checks.length, 24);
assert.equal((data.body.match(/^> \[!NOTE\] 解答・解説/gm) || []).length, 24);
assert.ok(!data.body.includes(':::'));
for (const block of parseMarkdown(body)) assert.ok(!/\[![A-Z]+\]/.test(block.text), 'Callout markup leaked into visible text');
for (const unwanted of ['要原本確認', '市販テキスト', '満点を取れる', 'すべて連鎖的に落とします', 'ここでは断定しません']) assert.ok(!body.includes(unwanted));

const source = fs.readFileSync('../教材解説/第6章_図表データ.md', 'utf8').replace(/\r\n/g, '\n');
const tables = JSON.parse(fs.readFileSync('content/lesson-tables.json', 'utf8'));
const entries = [...source.matchAll(/^## (ch6_t\d+)\|([^\n]+)\n\n(.*?)(?=^## |$(?![\s\S]))/gms)];
assert.equal(entries.length, 12);
assert.equal(Object.keys(tables).filter(k => k.startsWith('ch6_')).length, 12);
for (const [, id, title, text] of entries) {
  const rows = text.split('\n').filter(l => l.startsWith('|')).map(l => l.split('|').slice(1, -1).map(c => c.trim()))
    .filter(row => !row.every(cell => /^:?-+:?$/.test(cell)));
  assert.equal(tables[id].title, title);
  assert.deepEqual(tables[id].headers, rows[0]);
  assert.deepEqual(tables[id].rows, rows.slice(1));
  assert.equal([...body.matchAll(new RegExp('^\\[\\[fig:' + id + '_(?:full|\\d+)\\|', 'gm'))].length, 1);
}

// Independent oracles for numerical exercises and the formerly incorrect boundaries.
const answer = (title: string) => checks.find(c => c.title === title)!.answer!;
assert.ok(answer('問3　圧力の基準を換える').startsWith(`**答え：${(0.8 + 0.1).toFixed(2)}MPa。`));
assert.ok(answer('問4　総質量から薬剤量を求める').startsWith(`**答え：${(12.4 - 7.2).toFixed(1)}kg。`));
assert.ok(answer('練習04　名称・対象・網目の計算').includes(`3は${8 * 3 / 4}mm以下。`));
assert.ok(answer('練習05　圧力・倍率・材質').includes('2は0.7〜0.98MPa'));
assert.ok(answer('練習06　工具・測定器・質量差').includes(`2は${(13.6 - 7.8).toFixed(1)}kg。`));
assert.ok(answer('問5　網目の合計面積').startsWith(`**答え：${15 * 30}mm²以上。`));
assert.ok(answer('問8　圧力の単位換算').startsWith(`**答え：${0.85 * 1000}kPa。`));
assert.ok(answer('問9　充てん比').startsWith(`**答え：${12 / 8}L/kg。`));
assert.ok(answer('問10　仕事の計算').startsWith(`**答え：${50 * 0.4}J。`));
assert.ok(answer('問3　大型の境界').startsWith('**答え：満たします。'));
assert.equal(tables.ch6_t11.rows.at(-1)[1], '**20kg以上**');
assert.ok(tables.ch6_t04.rows.some((r: string[]) => r[0] === '**ろ過網**' && r[1].includes('手動ポンプ式の水') && r[1].includes('ガラスびん')));
assert.ok(tables.ch6_t10.rows[4][2].includes('60%以上'));
assert.ok(tables.ch6_t01.rows[1][1].includes('二酸化炭素・ハロン1301'));
const exercises = checks.filter(c => c.title?.startsWith('練習'));
assert.equal(exercises.length, 6);
assert.equal(exercises.reduce((n, c) => n + (c.text.match(/^\d+\. /gm) || []).length, 0), 19);
assert.ok(exercises.filter(c => c.text.includes('記号で')).length >= 2);
const figures = (s: string) => [...s.matchAll(/^\[\[fig:([^|]+)/gm)].map(m => m[1]);
assert.deepEqual(figures(data.body), figures(body));
assert.deepEqual(figures(body).filter(id => id.startsWith('ch6_f')).sort(), Array.from({ length: 25 }, (_, i) => `ch6_f${String(i + 1).padStart(2, '0')}`));
for (const id of figures(body)) assert.ok(fs.existsSync(`assets/figures/${id}.jpg`), id);
console.log('PASS: chapter 6: 5 entries, 24 answer groups, 6 exercises / 19 subquestions, 12 canonical tables, 25 illustrations; classification, thresholds and calculations checked');
