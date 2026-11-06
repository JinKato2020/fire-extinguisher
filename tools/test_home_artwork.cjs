const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const { transformSync } = require('esbuild');
function load(file, dependencies) {
  const module = { exports: {} };
  vm.runInNewContext(transformSync(fs.readFileSync(file, 'utf8'), { loader: file.endsWith('tsx') ? 'tsx' : 'ts', format: 'cjs', jsx: 'transform' }).code,
    { module, exports: module.exports, require: id => dependencies[id] });
  return module.exports;
}
const layout = load('src/ui/artworkLayout.ts', {});
let windowWidth = 390, measured = null;
const React = { createElement: (type, props, ...children) => ({ type, props, children }), useState: () => [measured, value => { measured = value; }] };
const native = { Image: 'Image', View: 'View', useWindowDimensions: () => ({ width: windowWidth }) };
const { Artwork } = load('src/ui/Artwork.tsx', { react: React, 'react-native': native, './artworkLayout': layout });
let checks = 0;
for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1024, height: 1366 }]) {
  windowWidth = viewport.width;
  for (const source of [{ width: 1774, height: 887 }, { width: 853, height: 888 }, { width: 2020, height: 778 }]) {
    for (const column of [null, 140, 280, 350, 400]) {
      if (column !== null && column > Math.min(viewport.width, 440) - 40) continue;
      measured = column;
      const maxHeight = layout.heroHeightLimit(viewport.height);
      const render = () => Artwork({ source, ratio: source.width / source.height, maxHeight });
      let tree = render(), image = tree.children[0];
      // This is the default/style merge used by RN Image.ios.js, including Metro asset metadata.
      let effective = { width: source.width, height: source.height, ...image.props.style };
      assert.equal(typeof effective.width, 'number'); assert.equal(typeof effective.height, 'number');
      assert.ok(effective.width <= Math.min(viewport.width, 440));
      assert.ok(effective.height <= maxHeight);
      assert.equal(effective.height, tree.props.style.height);
      assert.equal(image.props.resizeMode, 'contain');
      // Resize/split-screen must use the measured column, not the old viewport or original image.
      tree.props.onLayout({ nativeEvent: { layout: { width: 216 } } });
      tree = render(); image = tree.children[0];
      assert.equal(image.props.style.width, 216);
      assert.ok(image.props.style.height <= maxHeight);
      checks++;
    }
  }
}
console.log('PASS: ' + checks + ' native asset/default-size and measured-column cases; rotation, portrait art and thumbnails remain bounded');
