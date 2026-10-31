export type MarkdownBlock = {
  type: string;
  text: string;
  rows?: string[][];
  tone?: 'important' | 'warning' | 'note';
  title?: string;
};

/** Callout markers live in the canonical Markdown, not in generated JSON or UI heuristics. */
export function parseMarkdown(body: string): MarkdownBlock[] {
  const lines = body.replace(/\r\n/g, '\n').split('\n');
  const out: MarkdownBlock[] = [];
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i].trimEnd();
    if (!ln.trim()) continue;
    if (ln.trimStart().startsWith('```')) {
      const code: string[] = [];
      while (++i < lines.length && !lines[i].trimStart().startsWith('```')) code.push(lines[i]);
      out.push({ type: 'code', text: code.join('\n') });
      continue;
    }
    if (ln.startsWith('>')) {
      const quote: string[] = [];
      do { quote.push(lines[i].replace(/^> ?/, '').trimEnd()); i++; } while (i < lines.length && lines[i].startsWith('>'));
      i--;
      const marker = quote[0].match(/^\[!(IMPORTANT|WARNING|NOTE)\](?:\s+(.+))?$/);
      out.push({ type: 'quote', text: (marker ? quote.slice(1) : quote).join('\n'),
        tone: marker?.[1] === 'IMPORTANT' ? 'important' : marker?.[1] === 'WARNING' ? 'warning' : 'note',
        title: marker ? marker[2] || ({ IMPORTANT: '重要ポイント', WARNING: '注意点', NOTE: '補足' }[marker[1]]) : undefined });
      continue;
    }
    if (ln.startsWith('|')) {
      const rows: string[][] = [];
      do {
        const cells = lines[i].trimEnd().split('|').slice(1, -1).map(x => x.trim());
        if (cells.length && !cells.every(x => /^:?-{2,}:?$/.test(x.replace(/\s/g, '')))) rows.push(cells);
        i++;
      } while (i < lines.length && lines[i].startsWith('|'));
      i--;
      if (rows.length) out.push({ type: 'table', text: '', rows });
      continue;
    }
    const fig = ln.trim().match(/^\[\[fig:([^|\]]+)\|?([^\]]*)\]\]$/);
    if (fig) { out.push({ type: 'fig', text: fig[1] + '\u0001' + (fig[2] || '') }); continue; }
    if (ln.trim().startsWith('【図】')) { out.push({ type: 'figpending', text: ln.trim().slice(3) }); continue; }
    const heading = ln.match(/^(#{1,4})\s+(.+)$/);
    if (heading) { out.push({ type: 'h' + heading[1].length, text: heading[2] }); continue; }
    if (/^---+$/.test(ln.trim())) { out.push({ type: 'hr', text: '' }); continue; }
    if (/^\s*[-*] /.test(ln)) { out.push({ type: 'li', text: ln.trim().slice(2) }); continue; }
    if (/^\s*\d+\. /.test(ln)) { out.push({ type: 'ol', text: ln.trim() }); continue; }
    // Soft-wrapped source lines belong to the same paragraph.
    const prev = out[out.length - 1];
    if (i > 0 && lines[i - 1].trim() && prev?.type === 'p') prev.text += '\n' + ln;
    else out.push({ type: 'p', text: ln });
  }
  return out;
}
