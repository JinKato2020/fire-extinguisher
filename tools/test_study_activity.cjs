const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const { transformSync } = require('esbuild');
function load(storage) {
  const module = { exports: {} };
  vm.runInNewContext(transformSync(fs.readFileSync('src/data/studyActivity.ts','utf8'), {loader:'ts',format:'cjs'}).code,
    {module,exports:module.exports,Date,require:()=>({async getItem(k){return storage.get(k)??null},async setItem(k,v){storage.set(k,v)}})});
  return module.exports;
}
(async()=>{
  const storage=new Map(), api=load(storage);
  await Promise.all([api.initActivity(),api.initActivity()]);
  assert.equal(api.activityState().hero,'anime');
  await Promise.all([api.setHero('classic'),api.recordActivity('lessons','1:l0'),api.recordActivity('terms','a-kasai'),api.recordActivity('checks','1:l0:q0')]);
  await api.recordActivity('lessons','1:l0');
  const day=api.localDay();
  const today=api.recentActivity(7,[{date:day,count:2}]).at(-1);
  assert.equal(today.lessons,1);assert.equal(today.terms,1);assert.equal(today.checks,3);
  const position={chapterNo:'4',lessonKey:'l2',label:'Lesson 03',offset:345,bodyTag:api.bodyTag('body'),at:Date.now()};
  await api.rememberLesson(position);
  const restart=load(storage);await restart.initActivity();
  assert.equal(restart.activityState().hero,'classic');assert.equal(restart.activityState().resume.offset,345);
  assert.notEqual(api.bodyTag('body'),api.bodyTag('updated body'));
  const old=Date.now()-130*86400000;
  for(let i=0;i<125;i++)await api.recordActivity('lessons',`1:${i}`,old+i*86400000);
  assert.ok(Object.keys(api.activityState().days).length<=120);
  assert.ok(api.activityState().readLessons.includes('1:0')); // Lifetime reading progress survives daily pruning.
  const broken=load(new Map([['fire6:study-activity:v1','{"hero":"invalid","resume":{},"days":{"bad":{}},"readLessons":42}']]));
  await broken.initActivity();assert.equal(broken.activityState().hero,'anime');assert.equal(broken.activityState().resume,null);
  console.log('PASS: hero and reading position persist; daily deduplication, exam/check totals, history pruning and corrupt-data fallback');
})().catch(e=>{console.error(e);process.exitCode=1});
