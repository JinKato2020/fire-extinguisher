export type EmphasisKind = 'key' | 'num' | 'trap';
export type EmphasisHints = Partial<Record<EmphasisKind, string[]>>;
export function emphasisStyle(dark: boolean, kind: EmphasisKind) {
  const color = kind === 'num' ? (dark ? '#84DBAF' : '#186347') : kind === 'trap' ? (dark ? '#FFB0B0' : '#A72B32') : (dark ? '#8CC9FF' : '#185A92');
  const backgroundColor = kind === 'num' ? (dark ? '#20362C' : '#EDF5F0') : kind === 'trap' ? (dark ? '#38262A' : '#FBEFF0') : (dark ? '#1D2D40' : '#EDF3F9');
  return { color, backgroundColor, fontWeight: '800' as const };
}
/** Only author-selected phrases, at most three short spans; never color an entire paragraph. */
export function emphasisRuns(text: string, hints: EmphasisHints = {}) {
  const candidates = (['trap', 'num', 'key'] as const).flatMap(kind => (hints[kind] ?? []).map(word => ({ start: text.indexOf(word), end: text.indexOf(word) + word.length, word, kind })))
    .filter(item => item.start >= 0 && item.word.length > 0 && item.word.length <= 32);
  const picked: typeof candidates = [];
  let budget = Math.max(6, Math.floor(text.length * 0.35));
  for (const item of candidates) {
    if (picked.length >= 3 || item.word.length > budget || picked.some(p => item.start < p.end && item.end > p.start)) continue;
    picked.push(item); budget -= item.word.length;
  }
  picked.sort((a, b) => a.start - b.start);
  const runs: { text: string; kind?: EmphasisKind }[] = [];
  let offset = 0;
  for (const p of picked) { if (p.start > offset) runs.push({ text: text.slice(offset, p.start) }); runs.push({ text: p.word, kind: p.kind }); offset = p.end; }
  if (offset < text.length) runs.push({ text: text.slice(offset) });
  return runs;
}
