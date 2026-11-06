export type MarkdownBlock = {
  type: string;
  text: string;
  rows?: string[][];
  tone?: 'important' | 'warning' | 'note';
  title?: string;
  answer?: string;
  items?: string[];
  choice?: { options: string[]; correct: number; prompt: string };
};

/** Callout markers live in the canonical Markdown, not in generated JSON or UI heuristics. */
export function parseMarkdown(body: string): MarkdownBlock[] {
  const lines = body.replace(/\r\n/g, '\n').split('\n');
  const out: MarkdownBlock[] = [];
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i].trimEnd();
    if (!ln.trim()) continue;
    const studyBlock = ln.match(/^:::(check|steps)\s+(.+)$/);
    if (studyBlock) {
      const content: string[] = [];
      let end = i + 1;
      while (end < lines.length && lines[end].trim() !== ':::') content.push(lines[end++]);
      if (end === lines.length) throw new Error('学習ブロックの閉じ記号 ::: がありません: ' + studyBlock[2]);
      i = end;
      if (studyBlock[1] === 'check') {
        const choiceLine = content[0]?.match(/^@choice: ([1-4])$/);
        if (content.some(line => line.includes('@choice')) && (!choiceLine || content.slice(1).some(line => line.includes('@choice')))) throw new Error('選択問題の正解指定が不正です: ' + studyBlock[2]);
        if (choiceLine) content.shift();
        const divider = content.findIndex(line => line.trim() === '---');
        const question = content.slice(0, divider).join('\n').trim();
        const answer = content.slice(divider + 1).join('\n').trim();
        if (divider < 1 || !question || !answer) throw new Error('確認問題には問題文・---・解答が必要です: ' + studyBlock[2]);
        let choice: MarkdownBlock['choice'];
        if (choiceLine) {
          const options = [...question.matchAll(/^([1-4])\. (.+)$/gm)];
          const correct = Number(choiceLine[1]) - 1;
          const prompt = question.replace(/^[1-4]\. .+$/gm, '').trim();
          if (!prompt || options.length < 2 || options.length > 4 || correct >= options.length || options.some((m, n) => Number(m[1]) !== n + 1)) throw new Error('選択肢と正解番号が不正です: ' + studyBlock[2]);
          choice = { options: options.map(m => m[2]), correct, prompt };
        }
        out.push({ type: 'check', title: studyBlock[2], text: question, answer, ...(choice ? { choice } : {}) });
      } else {
        const items = content.filter(line => line.trim()).map(line => line.replace(/^\d+\.\s+/, ''));
        out.push({ type: 'steps', title: studyBlock[2], text: '', items });
      }
      continue;
    }
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
      const text = (marker ? quote.slice(1) : quote).join('\n');
      if (!text.trim()) continue;
      out.push({ type: 'quote', text,
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
