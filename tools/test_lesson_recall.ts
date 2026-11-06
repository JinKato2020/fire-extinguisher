import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseMarkdown } from '../src/ui/markdown';
import { parseLessons } from '../src/ui/lessons';
import { chooseRecall, recallCandidates, recallInField, readingSections, unmask } from '../src/ui/recall';

const sample = '先に**{{圧力::key}}**、次に{{10秒以上::num}}。{{以上::trap}}';
assert.equal(unmask(sample), '先に**圧力**、次に10秒以上。以上');
assert.deepEqual(recallInField(sample, 'b1').map(b => b.start), [4, 20, 35]);
const mixed = parseMarkdown('### {{見出し::key}}\n\n> - **{{用語::key}}**\n\n1. {{30::num}}\n\n{{用語::key}}と{{条件::trap}}');
const pool = recallCandidates(mixed);
assert.deepEqual(pool.map(b => b.answer), ['用語', '30', '条件']);
assert.equal(pool[0].id, 'b1:q0:3');
assert.equal(pool[1].id, 'b2:0');
assert.deepEqual(chooseRecall(pool, 'trap', 0).map(b => b.answer), ['条件']);
assert.deepEqual(chooseRecall(pool, 'num', 10).map(b => b.answer), ['30']);
const many = Array.from({length: 30}, (_, i) => ({id: String(i), field: 'f' + Math.floor(i / 3), answer: String(i), category: 'key' as const, start: i}));
assert.equal(chooseRecall(many, 'all', 0).length, 10);
assert.ok(chooseRecall(many, 'all', 0).filter(b => b.field === 'f0').length <= 2);
assert.notDeepEqual(chooseRecall(many, 'all', 0), chooseRecall(many, 'all', 1));
assert.deepEqual(chooseRecall([], 'all', 9), []);
for (const malformed of [
  '@choice: 5\nQuestion\n1. A\n2. B', '@choice: 1\n1. A\n2. B',
  '@choice: 3\nQuestion\n1. A\n2. B', '@choice: 1\nQuestion\n1. A\n3. B',
  'Question\n@choice: 1\n1. A\n2. B',
]) assert.throws(() => parseMarkdown(`:::check Invalid\n${malformed}\n---\nAnswer\n:::`));
const multi = parseMarkdown(':::check 記述\n1. 名称は？\n2. 理由は？\n---\n1はA、2はB。\n:::')[0];
assert.equal(multi.choice, undefined, 'Numbered subquestions must remain written responses');

let lessons = 0, blanks = 0, choices = 0, checks = 0;
const perChapter: object[] = [];
for (let n = 1; n <= 6; n++) {
  const data = JSON.parse(fs.readFileSync(`content/chapters/ch${n}.json`, 'utf8'));
  const blocks = parseMarkdown(data.bodyV3);
  const entries = parseLessons(data.bodyV3);
  assert.deepEqual(entries.map(l => l.key), parseLessons(data.bodyV2).map(l => l.key));
  for (const body of [data.bodyV2, data.body]) assert.ok(!/\{\{|\}\}|@choice/.test(body), 'Old readers must never display authoring syntax');
  assert.ok(!data.body.includes(':::'));
  assert.equal(data.bodyV2, unmask(data.bodyV3).replace(/^@choice: [1-4]\n/gm, ''));
  const source = fs.readdirSync('../教材解説').find(f => f.startsWith(`教材_第${n}章_`))!;
  assert.equal(fs.readFileSync(`../教材解説/${source}`, 'utf8').replace(/\r\n/g, '\n'), data.bodyV3);
  assert.deepEqual(blocks.filter(b => b.type === 'fig').map(b => b.text), parseMarkdown(data.bodyV2).filter(b => b.type === 'fig').map(b => b.text));
  let count = 0;
  for (const lesson of entries) {
    const bs = parseMarkdown(lesson.body), candidates = recallCandidates(bs), sections = readingSections(bs);
    assert.equal(sections.flatMap(s => s.blocks).length + sections.filter(s => s.title).length, bs.length);
    if (/^l\d+$/.test(lesson.key)) {
      lessons++; assert.ok(candidates.length >= 4, `ch${n}/${lesson.key}: insufficient recall practice`);
      assert.ok(bs.some(b => b.type === 'check'));
    } else assert.equal(candidates.length, 0, 'Introductions and review questions remain readable');
    for (const b of candidates) {
      assert.ok(b.answer.length <= 35, 'Keep useful surrounding context');
      const index = Number(b.field.match(/^b(\d+)/)![1]);
      assert.ok(!sections.find(s => s.blocks.some(item => item.index === index))?.title?.startsWith('具体例'), 'Examples remain hints');
    }
    for (const category of ['all', 'key', 'num', 'trap'] as const) {
      const selected = chooseRecall(candidates, category, 0);
      assert.ok(selected.length <= 10);
      assert.equal(new Set(selected.map(b => b.id)).size, selected.length);
      for (const field of new Set(selected.map(b => b.field))) assert.ok(selected.filter(b => b.field === field).length <= 2);
    }
    count += candidates.length;
  }
  const qs = blocks.filter(b => b.type === 'check');
  for (const b of qs) {
    if (!b.choice) continue;
    assert.ok(b.choice.prompt && b.choice.correct < b.choice.options.length);
    const token = b.answer!.match(/^\*\*答え[：:]\s*([1-4①②③④○×])/u)![1];
    const actual = '○×'.includes(token) ? (token === '○' ? 0 : 1) : '①②③④'.includes(token) ? '①②③④'.indexOf(token) : Number(token) - 1;
    assert.equal(b.choice.correct, actual, `${n}: ${b.title} answer mismatch`);
  }
  checks += qs.length; choices += qs.filter(b => b.choice).length; blanks += count;
  perChapter.push({chapter:n, lessons:entries.length - 2, blanks:count, checks:qs.length, choices:qs.filter(b => b.choice).length});
}
assert.equal(lessons, 49); assert.equal(blanks, 357); assert.equal(checks, 195); assert.equal(choices, 42);
console.table(perChapter);
console.log('PASS: 49 lessons, 357 authored recall cues, 195 checks, correct choice metadata, stable navigation and both legacy formats');
