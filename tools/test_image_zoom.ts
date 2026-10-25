import assert from 'node:assert/strict';
import { boundZoom, fitImage, MAX_ZOOM, zoomAround } from '../src/ui/zoomGeometry';

const start = { scale: 2, x: -120, y: 80 };
const focal = { x: 70, y: -45 };
const moved = { x: 100, y: -20 };
const next = zoomAround(start, 3, focal, moved);
// The image point under the fingers must stay under them while pinching/moving.
assert.equal((focal.x - start.x) / start.scale, (moved.x - next.x) / next.scale);
assert.equal((focal.y - start.y) / start.scale, (moved.y - next.y) / next.scale);
assert.equal(zoomAround(start, 100, focal).scale, MAX_ZOOM);
assert.equal(zoomAround(start, 0.01, focal).scale, 1);

for (const viewport of [{ width: 390, height: 650 }, { width: 844, height: 300 }]) {
  for (const natural of [{ width: 3144, height: 1421 }, { width: 1510, height: 2264 }, { width: 1200, height: 750 }]) {
    const image = fitImage(natural, viewport);
    assert.ok(image.width <= viewport.width + 1e-8);
    assert.ok(image.height <= viewport.height + 1e-8);
    for (const scale of [0.1, 1, 1.5, 3, 5, 100]) {
      const result = boundZoom({ scale, x: 100000, y: -100000 }, image, viewport);
      assert.ok(result.scale >= 1 && result.scale <= MAX_ZOOM);
      assert.ok(Math.abs(result.x) <= Math.max(0, (image.width * result.scale - viewport.width) / 2));
      assert.ok(Math.abs(result.y) <= Math.max(0, (image.height * result.scale - viewport.height) / 2));
      const reset = boundZoom({ scale: 1, x: result.x, y: result.y }, image, viewport);
      assert.ok(Math.abs(reset.x) < 1e-8 && Math.abs(reset.y) < 1e-8);
    }
    let zoom = { scale: 1, x: 0, y: 0 };
    for (let i = 0; i < 1000; i++) {
      zoom = boundZoom(zoomAround(zoom, i % 2 ? 0.1 : 100, focal, moved), image, viewport);
      assert.ok(Object.values(zoom).every(Number.isFinite));
    }
  }
}
console.log('PASS: pinch focus, pan bounds, zoom limits, portrait/landscape fit and 6000 repeated pinch operations');
