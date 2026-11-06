/** Both dimensions override the intrinsic dimensions Metro attaches to local images. */
export function artworkBounds(width: number, ratio: number, maxHeight: number) {
  const safeWidth = Math.max(0, Number.isFinite(width) ? width : 0);
  const safeRatio = Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
  return { width: safeWidth, height: Math.max(0, Math.min(safeWidth / safeRatio, maxHeight)) };
}

export function heroHeightLimit(windowHeight: number) {
  return Math.min(240, Math.max(120, windowHeight * 0.29));
}
