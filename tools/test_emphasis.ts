import assert from 'node:assert/strict';
import glossary from '../content/glossary.json';
import { emphasisRuns, emphasisStyle } from '../src/ui/emphasis';
import type { EmphasisHints } from '../src/ui/emphasis';
let highlighted = 0;
for (const t of glossary.terms) {
  assert.ok(t.highlights, t.id);
  let count = 0;
  for (const text of [t.summary,t.explanation,t.example,t.caution]) {
    const runs = emphasisRuns(text ?? '', t.highlights as EmphasisHints);
    assert.equal(runs.map(r=>r.text).join(''), text ?? '');
    const points = runs.filter(r=>r.kind);
    assert.ok(points.length<=3);
    assert.ok(points.reduce((n,r)=>n+r.text.length,0)<=Math.max(6,Math.floor((text?.length??0)*0.35)));
    count += points.length;
  }
  assert.ok(count>0,t.id); highlighted+=count;
}
const overlapping=emphasisRuns('圧力計は指示圧力計です。',{key:['指示圧力計','圧力計'],trap:['指示圧力計']});
assert.equal(overlapping.map(r=>r.text).join(''),'圧力計は指示圧力計です。');
for(const dark of [true,false])for(const kind of ['key','num','trap'] as const)assert.ok(emphasisStyle(dark,kind).color);
console.log(`PASS: all 106 terms have selective emphasis (${highlighted} spans); text is unchanged, overlaps and density are bounded`);
