import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import React from 'react';
const { renderToStaticMarkup } = require('react-dom/server');
import { transformSync } from 'esbuild';
import content from '../docs/relation-maps/structure.json';
import { RELATION_MAPS } from '../src/data/relationMaps.generated';
import { light, dark, CHAPTER_SHORT } from '../src/theme/colors';

// Render the real screen with small RN host adapters; exercise its actual callbacks.
const app = fs.readFileSync('App.tsx', 'utf8');
const component = app.slice(app.indexOf('function RelationMapScreen('), app.indexOf('// ---- モーダル: 試験総合解説'));
function screen(ch: string, pro: boolean, theme: 'light' | 'dark', width = 390) {
  const state: any[] = [ch, false, 3];
  let cursor = 0;
  const buttons: any[] = [], svgs: any[] = [];
  const colors = theme === 'light' ? light : dark;
  const stylesModule = { exports: {} as any };
  vm.runInNewContext(transformSync(fs.readFileSync('src/ui/styles.ts', 'utf8'), { loader: 'ts', format: 'cjs' }).code, {
    module: stylesModule, exports: stylesModule.exports,
    require: () => ({ StyleSheet: { create: (x: any) => x, absoluteFillObject: { position: 'absolute', inset: 0 } } }),
  });
  const styles = stylesModule.exports.makeStyles(colors);
  const flatten = (value: any): any => Array.isArray(value) ? Object.assign({}, ...value.map(flatten)) : value || {};
  const host = ({ children, style }: any) => {
    const s = { ...flatten(typeof style === 'function' ? style({ pressed: false }) : style) };
    if (s.paddingHorizontal !== undefined) { s.paddingLeft = s.paddingRight = s.paddingHorizontal; delete s.paddingHorizontal; }
    if (s.paddingVertical !== undefined) { s.paddingTop = s.paddingBottom = s.paddingVertical; delete s.paddingVertical; }
    delete s.elevation;
    if (typeof s.lineHeight === 'number') s.lineHeight += 'px';
    return React.createElement('div', { style: { position: 'relative', ...s } }, children);
  };
  const module: { exports: any } = { exports: {} };
  vm.runInNewContext(transformSync(component + '\nmodule.exports = RelationMapScreen;', { loader: 'tsx', format: 'cjs' }).code, {
    module, React, RELATION_MAP_CONTENT: content, RELATION_MAPS, CHAPTER_SHORT,
    useTheme: () => ({ resolved: theme, c: colors }), useStyles: () => styles,
    useWindowDimensions: () => ({ width }), useMemo: (fn: () => any) => fn(),
    useState: () => { const i = cursor++; return [state[i], (v: any) => { state[i] = v; }]; },
    View: host, Text: host,
    ScrollView: ({ children, style, contentContainerStyle }: any) => host({ style, children: host({ style: contentContainerStyle, children }) }),
    Pressable: (p: any) => { buttons.push(p); return host(p); },
    Segmented: () => null, ProCut: () => React.createElement('div', null, 'LOCKED'),
    SvgXml: (p: any) => { svgs.push(p); return React.createElement('div', { dangerouslySetInnerHTML: { __html: p.xml.replace('width="3400" height="2200"', `width="${p.width}" height="${p.height}"`) } }); },
  });
  return {
    render() { cursor = 0; buttons.length = 0; svgs.length = 0; return renderToStaticMarkup(React.createElement(module.exports as React.ComponentType<any>, { pro, onClose() {}, onPaywall() {} })); },
    state, buttons, svgs,
  };
}

assert.equal(content.chapters.length, 6);
for (const m of content.chapters) {
  const ch = String(m.chapter);
  assert.equal(m.branches.length, 6);
  for (const theme of ['light', 'dark'] as const) {
    const path = `assets/relation-maps/chapter${ch}_relation_map${theme === 'dark' ? '-dark' : ''}.svg`;
    assert.equal(RELATION_MAPS[ch][theme], fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n'));
    const view = screen(ch, true, theme);
    const html = view.render();
    // Inspect the text cards independently of embedded SVG text.
    const cards = html.slice(html.lastIndexOf('項目で読む'));
    for (const b of m.branches) for (const t of b.topics) {
      assert.ok(cards.includes(t.name));
      for (const line of t.lines) assert.ok(cards.includes(line));
    }
    view.buttons.find((b) => b.accessibilityLabel === '相関図を拡大する').onPress();
    view.render();
    assert.equal(view.svgs.at(-1).width, 2550);
    view.buttons.find((b) => b.children?.props?.children === '全体').onPress();
    view.render();
    assert.equal(view.svgs.at(-1).width, 358);
    assert.ok(view.buttons.find((b) => b.children?.props?.children === '− 縮小').disabled);
    view.state[2] = 4; view.render();
    assert.ok(view.buttons.find((b) => b.children?.props?.children === '＋ 拡大').disabled);
    const free = screen(ch, false, theme);
    const freeHtml = free.render();
    assert.equal(freeHtml.includes('LOCKED'), m.chapter > 3);
    assert.equal(freeHtml.includes('項目で読む'), m.chapter <= 3);
    if (m.chapter > 3) {
      free.state[1] = true; free.render();
      assert.equal(free.svgs.length, 0, 'locked chapters must not leak through fullscreen');
    }
  }
}
fs.mkdirSync('tmp', { recursive: true });
for (const theme of ['light', 'dark'] as const) {
  const html = screen('3', true, theme).render();
  fs.writeFileSync(`tmp/relation-map-${theme}.html`, `<meta charset="utf-8"><style>body{margin:0;background:${theme === 'light' ? light.bg : dark.bg};font-family:Arial,sans-serif}div{box-sizing:border-box}svg{display:block}</style>${html}`);
}
console.log('PASS: all 6 chapters / 2 themes, 108 readable topics, access gating, zoom controls, SVG registry consistency');
