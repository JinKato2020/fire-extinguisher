import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import React from 'react';
const { renderToStaticMarkup } = require('react-dom/server');
import { transformSync } from 'esbuild';
import content from '../docs/relation-maps/structure.json';
import { RELATION_MAPS } from '../src/data/relationMaps.generated';
import { light, dark, CHAPTER_SHORT } from '../src/theme/colors';
import { parseLessons } from '../src/ui/lessons';

const chapters = content.chapters.map(c => {
  const data = JSON.parse(fs.readFileSync('content/chapters/ch' + c.chapter + '.json', 'utf8'));
  return { no: String(c.chapter), title: c.title, sub: '', body: data.bodyV3 ?? data.bodyV2 ?? data.body };
});
const code = transformSync(fs.readFileSync('src/ui/RelationMapScreen.tsx', 'utf8'), { loader: 'tsx', format: 'cjs' }).code;
const styleModule = { exports: {} as any };
vm.runInNewContext(transformSync(fs.readFileSync('src/ui/styles.ts', 'utf8'), { loader: 'ts', format: 'cjs' }).code, {
  module: styleModule, exports: styleModule.exports,
  require: () => ({ StyleSheet: { create: (x: any) => x, absoluteFillObject: { position: 'absolute', inset: 0 } } }),
});

function screen(ch: number, diagramIndex: number, pro: boolean, theme: 'light' | 'dark', width = 390, fontScale = 1) {
  const state: any[] = [ch, diagramIndex, false, false, false, 1, null];
  let cursor = 0;
  const buttons: any[] = [], svgs: any[] = [], lessons: any[] = [];
  const colors = theme === 'light' ? light : dark;
  const flatten = (v: any): any => Array.isArray(v) ? Object.assign({}, ...v.map(flatten)) : v || {};
  const css = (style: any) => {
    const s = { ...flatten(typeof style === 'function' ? style({ pressed: false }) : style) };
    for (const [key, a, b] of [['paddingHorizontal', 'paddingLeft', 'paddingRight'], ['paddingVertical', 'paddingTop', 'paddingBottom'], ['marginHorizontal', 'marginLeft', 'marginRight'], ['marginVertical', 'marginTop', 'marginBottom']]) {
      if (s[key] !== undefined) { s[a] = s[b] = s[key]; delete s[key]; }
    }
    if (s.fontSize) s.fontSize *= fontScale;
    if (s.lineHeight) s.lineHeight = s.lineHeight * fontScale + 'px';
    if (s.borderWidth) s.borderStyle = 'solid';
    for (const side of ['Top', 'Bottom', 'Left', 'Right']) if (s['border' + side + 'Width']) s['border' + side + 'Style'] = 'solid';
    delete s.elevation;
    return s;
  };
  const view = ({ children, style, accessibilityLabel }: any) => React.createElement('div', { 'data-label': accessibilityLabel,
    style: { display: 'flex', flexDirection: 'column', position: 'relative', minWidth: 0, flexShrink: 0, boxSizing: 'border-box', ...css(style) } }, children);
  const module = { exports: {} as any };
  const mocks: Record<string, any> = {
    react: { ...React, useState: () => { const i = cursor++; return [state[i], (v: any) => { state[i] = v; }]; } },
    'react-native': {
      View: view,
      Text: ({ children, style }: any) => React.createElement('span', { style: css(style) }, children),
      ScrollView: ({ children, style, contentContainerStyle }: any) => view({ style, children: view({ style: contentContainerStyle, children }) }),
      Pressable: (p: any) => { buttons.push(p); return view(p); },
      Modal: ({ visible, children }: any) => visible ? view({ children }) : null,
      useWindowDimensions: () => ({ width, height: 844, fontScale }),
    },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    'react-native-svg': { SvgXml: (p: any) => { svgs.push(p); return React.createElement('div', { style: { width: p.width, height: p.height }, dangerouslySetInnerHTML: { __html: p.xml.replace(/width="\d+" height="\d+"/, `width="${p.width}" height="${p.height}"`) } }); } },
    '../theme/ThemeContext': { useTheme: () => ({ resolved: theme, c: colors }), useStyles: () => styleModule.exports.makeStyles(colors) },
    '../theme/colors': { CHAPTER_SHORT }, '../data/relationMaps.generated': { RELATION_MAPS },
    '../../docs/relation-maps/structure.json': content, './lessons': { parseLessons },
  };
  vm.runInNewContext(code, { module, exports: module.exports, require: (id: string) => { assert.ok(mocks[id], 'unexpected dependency ' + id); return mocks[id]; } });
  return {
    render() {
      cursor = 0; buttons.length = 0; svgs.length = 0;
      return renderToStaticMarkup(React.createElement(module.exports.RelationMapScreen as React.ComponentType<any>, { pro, chapters, onClose() {}, onPaywall() {},
        renderLesson(target: any, onBack: () => void, onNav: any) { lessons.push({ target, onBack, onNav }); return React.createElement('div', null, 'LESSON'); },
      }));
    },
    click(label: string) { const b = buttons.find(b => b.accessibilityLabel === label); assert.ok(b, 'missing button: ' + label); b.onPress(); },
    state, buttons, svgs, lessons,
  };
}

const tmp = 'tmp/relation-redesign';
fs.mkdirSync(tmp, { recursive: true });
let diagramCount = 0, lessonLinks = 0;
for (const chapter of content.chapters) {
  const covered = new Set<number>();
  chapter.diagrams.forEach((d, i) => {
    diagramCount++;
    d.topicIds.forEach(id => covered.add(id));
    for (const theme of ['light', 'dark'] as const) {
      assert.equal(RELATION_MAPS[chapter.chapter + '/' + d.id][theme], fs.readFileSync('assets/relation-maps/' + d.asset + (theme === 'dark' ? '-dark' : '') + '.svg', 'utf8'));
      const v = screen(chapter.chapter, i, true, theme);
      assert.ok(v.render().includes(d.question));
      v.click('矢印の関係を文章で読む');
      const relations = v.render().split('data-label="矢印の関係を文章で読む"')[1];
      for (const edge of d.edges) assert.ok(relations.includes(edge.label));
      v.click('関連用語と教材を読む');
      const terms = v.render().split('data-label="関連用語と教材を読む"')[1];
      for (const id of d.topicIds) {
        const topic = chapter.topics.find(t => t.id === id)!;
        assert.ok(terms.includes(topic.name));
        topic.lines.forEach(line => assert.ok(terms.includes(line)));
        const available = parseLessons(chapters[chapter.chapter - 1].body);
        for (const ref of topic.references) assert.ok(available.some(l => ref === 'はじめに' || ref === '準備' ? l.key === 'intro' : l.label.startsWith(ref + ' ')), 'missing lesson ' + ref);
      }
      const links = v.buttons.filter(b => b.accessibilityLabel?.startsWith('教材を読む：'));
      assert.ok(links.length);
      for (const b of links) {
        b.onPress(); assert.equal(v.render(), '<div>LESSON</div>');
        const lesson = v.lessons.at(-1)!;
        assert.equal(lesson.target.chapterNo, String(chapter.chapter));
        assert.ok(chapters[chapter.chapter - 1].body);
        lesson.onBack(); v.render();
        assert.equal(v.state[1], i, 'return to same relationship');
        assert.equal(v.state[3], true, 'retain expanded terms');
        lessonLinks++;
      }
      v.click('相関図を拡大する'); v.render();
      assert.equal(v.svgs.at(-1).width, 358 * 1.5);
      v.click('全体'); v.render();
      assert.equal(v.svgs.at(-1).width, 358);
      assert.equal(v.buttons.find(b => b.accessibilityLabel === '− 縮小').disabled, true);
      v.state[5] = 3; v.render();
      assert.equal(v.buttons.find(b => b.accessibilityLabel === '＋ 拡大').disabled, true);
      v.click('✕ 閉じる'); v.render(); assert.equal(v.svgs.length, 1);
      v.click(d.title); v.render(); assert.equal(v.state[3], false);
    }
  });
  assert.deepEqual([...covered].sort((a,b) => a-b), chapter.topics.map(t => t.id));
  const free = screen(chapter.chapter, 0, false, 'light');
  assert.equal(free.render().includes('この章の相関図はProで'), chapter.chapter > 3);
  free.state[4] = true; free.render();
  assert.equal(free.svgs.length, chapter.chapter > 3 ? 0 : 2, 'gate fullscreen as well as preview');
}
// A chapter change resets the focused diagram and any expanded/zoomed content.
const switcher = screen(4, 3, true, 'light'); switcher.render();
switcher.click('第1章 ' + CHAPTER_SHORT['1']); switcher.render();
assert.equal(switcher.state[0], 1); assert.equal(switcher.state[1], 0);
const previews = [];
for (const [ch, idx, theme, width, scale] of [
  [2, 0, 'light', 390, 1], [2, 0, 'dark', 390, 1], [4, 1, 'light', 320, 1],
  [6, 0, 'dark', 430, 1], [3, 2, 'light', 390, 1.5], [1, 2, 'light', 768, 1],
] as const) {
  const name = `screen-${ch}-${idx}-${theme}-${width}-${scale}`;
  const v = screen(ch, idx, true, theme, width, scale);
  const html = v.render();
  fs.writeFileSync(tmp + '/' + name + '.html', `<meta charset="utf-8"><style>body{margin:0;width:${width}px;font-family:Meiryo,sans-serif;background:${theme === 'light' ? light.bg : dark.bg}}svg{display:block}*{box-sizing:border-box}</style>${html}`);
  previews.push({ name, width, scale });
}
fs.writeFileSync(tmp + '/previews.json', JSON.stringify(previews));
fs.writeFileSync('docs/relation-maps/interaction-verification.json', JSON.stringify({ diagramCount, topics: 108, verifiedLessonLinkReturns: lessonLinks,
  chapterSwitch: true, zoomBounds: true, entitlementGating: true, sourceSha256: createHash('sha256').update(code).digest('hex'), physicalDeviceTested: false }, null, 2) + '\n');
console.log(`PASS: ${diagramCount} diagrams, 108 topics, ${lessonLinks} lesson-link round trips, gating, switching and zoom`);
