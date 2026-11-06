import assert from 'node:assert/strict';
import fs from 'node:fs';
import { getGlossary, searchTerms, normalizeTermSearch, freeTermIds } from '../src/data/glossary';
import { getChapters } from '../src/data/chapters';
import { parseLessons } from '../src/ui/lessons';
import { setOverrides } from '../src/data/contentStore';

const terms = getGlossary();
assert.equal(terms.length, 106);
assert.deepEqual(['1','2','3','4','5','6'].map(ch => terms.filter(t => t.chapter === ch).length), [16,10,21,31,17,11]);
for (const t of terms) {
  assert.ok(t.summary && t.explanation && t.example && t.caution && t.reading, t.id);
  assert.ok(t.summary.length <= 65, 'A short definition should remain scannable: '+t.id);
  assert.ok(!/###|\[!|:::/u.test(t.def), 'Legacy clients must receive plain text');
  assert.ok(t.def.includes(t.summary!) && t.def.includes(t.explanation!));
  const lesson = parseLessons(getChapters().find(ch => ch.no === t.chapter)!.body!).find(l => l.key === 'l'+(t.lesson!-1));
  assert.ok(lesson, 'Missing lesson: '+t.id);
  for (const name of t.related ?? []) assert.ok(terms.some(x => x.term === name) && name !== t.term);
  if (t.figure) {
    assert.ok(t.figureCaption);
    assert.ok(fs.existsSync('assets/figures/'+t.figure+'.jpg'));
  }
}
assert.equal(freeTermIds(terms).size, 36);
for (const ch of ['1','2','3','4','5','6']) {
  const chapter = terms.filter(t => t.chapter === ch);
  assert.ok(chapter.slice(0,6).every(t => freeTermIds(terms).has(t.id)));
  assert.ok(chapter.slice(6).every(t => !freeTermIds(terms).has(t.id)));
}
assert.equal(normalizeTermSearch('ＣＯ₂ カタカナ ｶﾀｶﾅ'), 'co2 かたかな かたかな');
assert.equal(searchTerms(terms,'  サイホンカン  ')[0].id, 'siphon-kan');
assert.equal(searchTerms(terms,'ｻｲﾌｫﾝ管')[0].id, 'siphon-kan');
assert.equal(searchTerms(terms,'co₂消火器')[0].id, 'nisanka-tanso-shokaki');
assert.equal(searchTerms(terms,'Ａ火災')[0].id, 'a-kasai');
assert.ok(searchTerms(terms,'単位　ひずみ').some(t => t.id === 'hizumi'));
assert.equal(searchTerms(terms,'未定義検索文字列').length, 0);
assert.equal(searchTerms(terms,'　').length, terms.length);
// A valid old OTA file still works, and content changes are not cached in the accessor.
setOverrides({'content/glossary.json': {version:1,terms:[{id:'legacy',term:'旧用語',chapter:'1',def:'旧版の説明。'}]}});
assert.equal(searchTerms(getGlossary(),'旧版')[0].id,'legacy');
setOverrides({});
assert.equal(getGlossary().length,106);
console.log('PASS: 106 structured terms, lesson/figure/related links, access boundaries, Japanese search and legacy OTA');
