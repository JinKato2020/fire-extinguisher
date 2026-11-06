"""Generate focused, labelled relationship diagrams from the canonical Markdown.

Author ../教材解説/相関図.md. docs/relation-maps/source.md is its versioned snapshot
and the fallback for clean checkouts. JSON / SVG / PNG / TS are generated only.
"""
from pathlib import Path
from html import escape
import argparse, json, re, subprocess, sys
from PIL import ImageFont

R = Path(__file__).resolve().parents[1]
DOCS = R / 'docs/relation-maps'
ASSETS = R / 'assets/relation-maps'
CANONICAL = R.parent / '教材解説/相関図.md'
SNAPSHOT = DOCS / 'source.md'
WIDTH, NODE_W, GAP = 720, 312, 112
FONT = 'C:/Windows/Fonts/meiryo.ttc'
metrics = []

def write(path, text):
    path.write_text(text, encoding='utf8', newline='\n')

def wrap(text, size, available, bold=False):
    font = ImageFont.truetype(FONT.replace('meiryo.', 'meiryob.') if bold else FONT, size)
    if '\n' in text:
        lines = text.split('\n')
        assert len(lines) <= 2 and all(font.getlength(line) <= available for line in lines), text
        return lines
    lines = ['']
    for char in text:
        if font.getlength(lines[-1] + char) > available:
            lines.append(char)
        else:
            lines[-1] += char
    assert len(lines) <= 2, (text, lines)
    if len(lines) == 2:
        # Balance Japanese labels instead of leaving one orphan character.
        for split in sorted(range(1, len(text)), key=lambda i: abs(len(text) / 2 - i)):
            if max(font.getlength(text[:split]), font.getlength(text[split:])) <= available:
                return [text[:split], text[split:]]
    return lines

def validate(chapter):
    topics = {t['id']: t for t in chapter['topics']}
    covered = set()
    assert len(topics) == len(chapter['topics'])
    body_path = R.parent / chapter['source']
    if body_path.exists():
        body = body_path.read_text(encoding='utf8')
        for t in topics.values():
            for ref in t['references']:
                assert ref in body, (chapter['chapter'], ref)
    diagram_ids = set()
    for diagram in chapter['diagrams']:
        assert diagram['id'] not in diagram_ids
        diagram_ids.add(diagram['id'])
        nodes = {n['id']: n for n in diagram['nodes']}
        assert len(nodes) == len(diagram['nodes'])
        positions = set()
        for n in nodes.values():
            assert n['col'] in ('l', 'c', 'r') and n['row'] >= 0
            assert (n['row'], n['col']) not in positions
            positions.add((n['row'], n['col']))
            assert n['kind'] in ('concept', 'condition', 'result')
        for row, col in positions:
            assert col != 'c' or not ({(row, 'l'), (row, 'r')} & positions)
        incoming = {id: 0 for id in nodes}
        pairs = set()
        for edge in diagram['edges']:
            a, b = edge['source'], edge['target']
            assert a in nodes and b in nodes and a != b
            assert (a, b) not in pairs
            pairs.add((a, b))
            assert nodes[b]['row'] == nodes[a]['row'] + 1, (diagram['id'], edge)
            # Crossing opposing diagonals would imply a misleading relationship.
            assert {nodes[a]['col'], nodes[b]['col']} != {'l', 'r'}
            assert edge['label'].strip()
            incoming[b] += 1
        roots = [id for id, count in incoming.items() if not count]
        assert len(roots) == 1 and nodes[roots[0]]['row'] == 0
        reachable = set(roots)
        for _ in nodes:
            reachable.update(b for a, b in pairs if a in reachable)
        assert reachable == set(nodes), (diagram['id'], 'orphan node')
        assert set(diagram['topicIds']) <= topics.keys()
        covered.update(diagram['topicIds'])
    assert covered == topics.keys(), (chapter['chapter'], 'topic coverage')

def render(chapter, diagram, dark):
    rows = max(n['row'] for n in diagram['nodes']) + 1
    labels = {n['id']: (wrap(n['label'], 34, NODE_W - 30, True), wrap(n['hint'], 27, NODE_W - 30)) for n in diagram['nodes']}
    node_heights = {id: max(148, 132 + (len(title) - 1) * 54 + (len(hint) - 1) * 44) for id, (title, hint) in labels.items()}
    row_heights = [max(node_heights[n['id']] for n in diagram['nodes'] if n['row'] == row) for row in range(rows)]
    row_y = [24 + sum(row_heights[:row]) + row * GAP for row in range(rows)]
    height = 48 + sum(row_heights) + (rows - 1) * GAP
    bg, fg, muted, border, edge = ('#191D25', '#EEF1F6', '#B7C2D0', '#506078', '#91A7BE') if dark else ('#FFFFFF', '#1F3446', '#53677A', '#C9D6E3', '#58738D')
    colors = {'concept': '#8EC5EE' if dark else '#246A9C', 'condition': '#F3C37E' if dark else '#996010', 'result': '#83D5BB' if dark else '#16785B'}
    title = f'第{chapter["chapter"]}章：{diagram["question"]}'
    desc = '。'.join(next(n['label'] for n in diagram['nodes'] if n['id'] == e['source']) + 'から、' + e['label'] + '、' + next(n['label'] for n in diagram['nodes'] if n['id'] == e['target']) for e in diagram['edges'])
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{WIDTH}" height="{height}" viewBox="0 0 {WIDTH} {height}" role="img" aria-labelledby="title desc">', f'<title id="title">{escape(title)}</title>', f'<desc id="desc">{escape(desc)}</desc>', f'<rect width="{WIDTH}" height="{height}" fill="{bg}"/>', '<g font-family="Meiryo, Noto Sans CJK JP, sans-serif">']
    coords = {n['id']: (dict(l=24, c=204, r=384)[n['col']], row_y[n['row']]) for n in diagram['nodes']}
    heights = {n['id']: row_heights[n['row']] for n in diagram['nodes']}

    def text(x, y, value, size, color, weight=500, available=330):
        measured = ImageFont.truetype(FONT.replace('meiryo.', 'meiryob.') if weight >= 700 else FONT, size).getlength(value)
        assert measured <= available, (diagram['id'], value, measured, available)
        metrics.append(dict(chapter=chapter['chapter'], diagram=diagram['id'], theme='dark' if dark else 'light', text=value, fontSize=size, width=round(measured, 2), available=available))
        out.append(f'<text x="{x}" y="{y}" text-anchor="middle" font-size="{size}" font-weight="{weight}" fill="{color}">{escape(value)}</text>')

    # Orthogonal arrows with explicit relationships. Branch labels sit on separate
    # lanes; merge labels sit before the join, so their meaning stays unambiguous.
    for link in diagram['edges']:
        sx, sy = coords[link['source']]; tx, ty = coords[link['target']]
        sx += NODE_W / 2; tx += NODE_W / 2; sy += heights[link['source']]
        merging = sx != tx and tx == WIDTH / 2
        bus = sy + GAP * (0.70 if merging else 0.30)
        out.append(f'<path d="M {sx} {sy + 2} V {bus} H {tx} V {ty - 16}" fill="none" stroke="{edge}" stroke-width="3.5" stroke-linejoin="round"/>')
        out.append(f'<path d="M {tx - 8} {ty - 19} L {tx} {ty - 5} L {tx + 8} {ty - 19} Z" fill="{edge}"/>')
    for link in diagram['edges']:
        sx, sy = coords[link['source']]; tx, ty = coords[link['target']]
        sx += NODE_W / 2; tx += NODE_W / 2; sy += heights[link['source']]
        merging = sx != tx and tx == WIDTH / 2
        x = sx if merging else tx
        y = sy + GAP * (0.32 if merging else 0.64)
        label = link['label']; w = ImageFont.truetype(FONT, 28).getlength(label) + 24
        out.append(f'<rect x="{x - w / 2}" y="{y - 30}" width="{w}" height="48" rx="8" fill="{bg}"/>')
        text(x, y + 3, label, 28, muted)
    for node in diagram['nodes']:
        x, y = coords[node['id']]; color = colors[node['kind']]; node_h = heights[node['id']]
        out.append(f'<g id="node-{node["id"]}">')
        out.append(f'<rect x="{x}" y="{y}" width="{NODE_W}" height="{node_h}" rx="16" fill="{bg}" stroke="{border}" stroke-width="2"/>')
        out.append(f'<path d="M {x + 2} {y + 22} V {y + node_h - 22}" stroke="{color}" stroke-width="6" stroke-linecap="round"/>')
        title, hint = labels[node['id']]
        offset = (node_h - node_heights[node['id']]) / 2
        for i, line in enumerate(title): text(x + NODE_W / 2, y + offset + 48 + i * 54, line, 34, color, 700, NODE_W - 30)
        for i, line in enumerate(hint): text(x + NODE_W / 2, y + offset + 102 + (len(title) - 1) * 54 + i * 44, line, 27, fg, available=NODE_W - 30)
        out.append('</g>')
    out.append('</g></svg>')
    return '\n'.join(out) + '\n', height

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--svg-only', action='store_true')
    parser.add_argument('--browser', default='C:/Program Files/Google/Chrome/Application/chrome.exe')
    args = parser.parse_args()
    body = (CANONICAL if CANONICAL.exists() else SNAPSHOT).read_text(encoding='utf8')
    chapters = [json.loads(block) for block in re.findall(r'```json\s*\n(.*?)\n```', body, re.S)]
    assert [c['chapter'] for c in chapters] == list(range(1, 7))
    write(SNAPSHOT, body)
    outputs = []
    for chapter in chapters:
        validate(chapter)
        for i, diagram in enumerate(chapter['diagrams']):
            diagram['asset'] = f'chapter{chapter["chapter"]}_' + ('relation_map' if i == 0 else diagram['id'])
            for dark in (False, True):
                xml, height = render(chapter, diagram, dark)
                path = ASSETS / (diagram['asset'] + ('-dark' if dark else '') + '.svg')
                write(path, xml)
                outputs.append((path, height))
            diagram['width'], diagram['height'] = WIDTH, height
    write(DOCS / 'structure.json', json.dumps(dict(format='labelled-relationships-v2', source='教材解説/相関図.md', chapters=chapters), ensure_ascii=False, indent=2) + '\n')
    write(DOCS / 'text-layout-validation.json', json.dumps(dict(textCount=len(metrics), allWithinBounds=True, text=metrics), ensure_ascii=False, indent=2) + '\n')
    if not args.svg_only:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as pw:
            browser = pw.chromium.launch(executable_path=args.browser, headless=True)
            page = browser.new_page()
            for path, height in outputs:
                page.set_viewport_size(dict(width=WIDTH, height=height))
                page.set_content('<style>html,body{margin:0;padding:0}</style>' + path.read_text(encoding='utf8'))
                page.evaluate('document.fonts.ready')
                page.screenshot(path=str(path.with_suffix('.png')))
            browser.close()
    subprocess.run([sys.executable, str(R / 'tools/gen_relmaps.py')], cwd=R, check=True)
    print(f'Generated {len(outputs) // 2} relationship diagrams / {len(outputs)} themed SVGs; all topics covered')

if __name__ == '__main__': main()
