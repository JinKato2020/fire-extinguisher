export type Zoom = { scale: number; x: number; y: number };
export type Size = { width: number; height: number };
export const MAX_ZOOM = 5;
export const fitImage = (image: Size, viewport: Size): Size => {
  const ratio = Math.min(viewport.width / image.width, viewport.height / image.height);
  return { width: image.width * ratio, height: image.height * ratio };
};
export function boundZoom(zoom: Zoom, image: Size, viewport: Size): Zoom {
  const scale = Math.max(1, Math.min(MAX_ZOOM, zoom.scale));
  const maxX = Math.max(0, (image.width * scale - viewport.width) / 2);
  const maxY = Math.max(0, (image.height * scale - viewport.height) / 2);
  return { scale, x: Math.max(-maxX, Math.min(maxX, zoom.x)), y: Math.max(-maxY, Math.min(maxY, zoom.y)) };
}
export function zoomAround(start: Zoom, scale: number, from: { x: number; y: number }, to = from): Zoom {
  scale = Math.max(1, Math.min(MAX_ZOOM, scale));
  const ratio = scale / start.scale;
  return { scale, x: to.x - (from.x - start.x) * ratio, y: to.y - (from.y - start.y) * ratio };
}
