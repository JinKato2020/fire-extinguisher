export type Lesson = { key: string; label: string; body: string };

/** Keep existing Lesson keys/order; an authored review heading gets its own entry. */
export function parseLessons(body: string): Lesson[] {
  if (!body) return [];
  const lines = body.replace(/\r\n/g, '\n').split('\n');
  const starts: number[] = [];
  lines.forEach((line, i) => { if (/^##\s+(?:Lesson\s|復習(?:\s|$))/i.test(line.trim())) starts.push(i); });
  if (!starts.length) return [{ key: 'all', label: '本文', body }];
  const out: Lesson[] = [];
  const intro = lines.slice(0, starts[0]).join('\n').trim();
  if (intro) out.push({ key: 'intro', label: 'はじめに・準備', body: intro });
  let lesson = 0;
  starts.forEach((start, i) => {
    const label = lines[start].trim().replace(/^##\s+/, '');
    const review = /^復習(?:\s|$)/.test(label);
    out.push({ key: review ? 'review' : 'l' + lesson++, label, body: lines.slice(start, starts[i + 1] ?? lines.length).join('\n') });
  });
  return out;
}
