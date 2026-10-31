import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { parseMarkdown } from '../src/ui/markdown';

const sample = parseMarkdown('# Title\r\n\r\n> [!WARNING] 注意点\r\n> **強調**\r\n>\r\n> - first\r\n> - second\r\n\r\n#### Small heading\r\n\r\nParagraph\r\ncontinued\r\n\r\nNext paragraph\r\n\r\n| A | B |\r\n| -- | -- |\r\n| a | b |\r\n\r\n[[fig:test|Caption]]\r\n\r\n```\r\n> literal\r\n```');
assert.equal(sample.filter(b => b.type === 'quote').length, 1);
assert.equal(sample[1].tone, 'warning');
assert.equal(sample[1].title, '注意点');
assert.equal(sample[1].text, '**強調**\n\n- first\n- second');
assert.equal(sample[2].type, 'h4');
assert.deepEqual(sample.filter(b => b.type === 'p').map(b => b.text), ['Paragraph\ncontinued', 'Next paragraph']);
assert.deepEqual(sample.find(b => b.type === 'table')?.rows, [['A', 'B'], ['a', 'b']]);
assert.equal(sample.find(b => b.type === 'fig')?.text, 'test\u0001Caption');
assert.equal(sample.at(-1)?.text, '> literal');

// The canonical Markdown, rather than the previous commit, defines current content.
for (let n = 1; n <= 6; n++) {
  const path = `content/chapters/ch${n}.json`;
  const body: string = JSON.parse(readFileSync(path, 'utf8')).body;
  const source = readdirSync('../教材解説').find(name => name.startsWith(`教材_第${n}章_`) && name.endsWith('.md'))!;
  const old = readFileSync(`../教材解説/${source}`, 'utf8').replace(/\r\n/g, '\n');
  assert.equal(body, old, `Chapter ${n}: JSON differs from canonical Markdown`);
  const blocks = parseMarkdown(body);
  assert.ok(blocks.some(b => b.tone === 'important'), `Chapter ${n}: important points missing`);
  assert.equal(blocks.filter(b => b.type === 'fig').length, (body.match(/^\[\[fig:/gm) || []).length);
  assert.equal(blocks.filter(b => b.type === 'h2' && /^Lesson\s/.test(b.text)).length, (old.match(/^## Lesson\s/gm) || []).length);
  assert.equal(blocks.filter(b => b.type === 'h4').length, (body.match(/^#### /gm) || []).length);
  console.log(`Chapter ${n}: text, figures, headings and callouts OK`);
}
console.log('Markdown checks passed');
