import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
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

// Reformatting must preserve the teaching text, figures and Lesson boundaries.
const normalize = (s: string) => s.replace(/^> \[!(IMPORTANT|WARNING|NOTE)\].*$/gm, '')
  .replace(/^> \*\*💡 ここが出る\*\*\s*$/gm, '')
  .replace(/^> ?/gm, '').replace(/〔ここが大事〕/g, '').replace(/\s/g, '');
for (let n = 1; n <= 6; n++) {
  const path = `content/chapters/ch${n}.json`;
  const body: string = JSON.parse(readFileSync(path, 'utf8')).body;
  const old: string = JSON.parse(execFileSync('git', ['show', `HEAD:${path}`], { encoding: 'utf8', maxBuffer: 1024 * 1024 })).body;
  assert.ok(normalize(body) === normalize(old), `Chapter ${n}: teaching text changed`);
  const blocks = parseMarkdown(body);
  assert.ok(blocks.some(b => b.tone === 'important'), `Chapter ${n}: important points missing`);
  assert.equal(blocks.filter(b => b.type === 'fig').length, (body.match(/^\[\[fig:/gm) || []).length);
  assert.equal(blocks.filter(b => b.type === 'h2' && /^Lesson\s/.test(b.text)).length, (old.match(/^## Lesson\s/gm) || []).length);
  assert.equal(blocks.filter(b => b.type === 'h4').length, (body.match(/^#### /gm) || []).length);
  console.log(`Chapter ${n}: text, figures, headings and callouts OK`);
}
console.log('Markdown checks passed');
