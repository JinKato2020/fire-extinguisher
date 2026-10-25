"""第1章の図表を再作図する (Pillow)。

初回のみ --init で正本の表を図マーカーへ移行。
以後は 教材解説/第1章_図表データ.md を編集して本スクリプトを実行し、
続けて tools/gen_content_json.py 1 を実行する。JSONは直接編集しない。
フォントは --font で日本語TrueTypeフォントを指定できる。
"""
import argparse
from pathlib import Path
import re
from PIL import Image, ImageDraw, ImageFont

APP = Path(__file__).resolve().parents[1]
MD = APP.parent / '教材解説' / '教材_第1章_消防関係法令(共通).md'
SOURCE = MD.parent / '第1章_図表データ.md'
OUT = APP / 'assets' / 'figures'
MASTER = APP.parent / '図' / '第1章' / '表'
TABLE = re.compile(r'^\|.*(?:\n\|.*)*', re.M)


def clean(text):
    return re.sub(r'\*\*|`', '', text)


def wrap(text, font, width):
    lines, line = [], ''
    for char in clean(text):
        if line and font.getlength(line + char) > width:
            lines.append(line)
            line = ''
        line += char
    return lines + [line]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--init', action='store_true')
    parser.add_argument('--font', default='C:/Windows/Fonts/meiryo.ttc')
    args = parser.parse_args()
    body = MD.read_text(encoding='utf-8')
    if args.init:
        if SOURCE.exists():
            parser.error('図表データは既に存在します。通常実行してください。')
        entries = []
        for n, match in enumerate(TABLE.finditer(body), 1):
            headings = re.findall(r'^#{2,3} (.+)$', body[:match.start()], re.M)
            title = headings[-1] if headings else '試験制度'
            entries.append(f'## ch1_t{n:02d}|{title}\n\n{match[0]}\n')
        SOURCE.write_text('# 第1章 図表の元データ\n\n'
                          '表の文言はこのファイルで修正し、tools/build_ch1_tables.py で再作図します。\n'
                          '元の表の内容を保持しています。法令内容の改訂は行っていません。\n\n'
                          + '\n'.join(entries), encoding='utf-8')
        n = 0
        def replace(match):
            nonlocal n
            n += 1
            return f'[[fig:ch1_t{n:02d}|仮]]'
        body = TABLE.sub(replace, body)

    font = ImageFont.truetype(args.font, 27)
    bold = ImageFont.truetype(args.font, 31)
    titlefont = ImageFont.truetype(args.font, 34)
    OUT.mkdir(parents=True, exist_ok=True)
    MASTER.mkdir(parents=True, exist_ok=True)
    count = 0
    for asset, title, table in re.findall(r'^## (ch1_t\d+)\|([^\n]+)\n\n(.*?)(?=^## |\Z)', SOURCE.read_text(encoding='utf-8'), re.M | re.S):
        rows = [[c.strip() for c in line.split('|')[1:-1]]
                for line in table.splitlines() if line.startswith('|')]
        rows = [r for r in rows if not all(re.fullmatch(r':?-+:?', c) for c in r)]
        headers, data = rows[0], rows[1:]
        widths = {1: [1136], 2: [400, 736], 3: [250, 440, 446], 4: [190, 320, 400, 226]}[len(headers)]
        # 用途区分は用途欄を広くして、特定欄も明示する。
        if headers == ['項', '用途(代表例)', '特定']:
            widths = [190, 790, 156]
        def layout(row, face):
            cells = [wrap(c, face, w - 28) for c, w in zip(row, widths)]
            return cells, max(map(len, cells)) * 41 + 28
        head, hh = layout(headers, bold)
        pages, page, used = [], [], 0
        for row in data:
            cells, height = layout(row, font)
            if page and used + height > 590 - hh:
                pages.append(page)
                page, used = [], 0
            page.append((cells, height))
            used += height
        if page:
            pages.append(page)
        markers = []
        for p, page in enumerate(pages, 1):
            name = f'{asset}_{p:02d}'
            caption = f'{title}（{p}/{len(pages)}）' if len(pages) > 1 else title
            titles = wrap(caption, titlefont, 1136)
            top = 25 + len(titles) * 48 + 15
            height = max(750, top + hh + sum(h for _, h in page) + 65)
            im = Image.new('RGB', (1200, height), '#ffffff')
            draw = ImageDraw.Draw(im)
            for i, line in enumerate(titles):
                draw.text((32, 20 + i * 48), line, font=titlefont, fill='#153852')
            y = top
            for ri, (cells, h) in enumerate([(head, hh)] + page):
                x = 32
                for lines, w in zip(cells, widths):
                    draw.rectangle((x, y, x+w, y+h), fill='#153852' if ri == 0 else ('#edf5fa' if ri % 2 else '#ffffff'), outline='#cedbe5', width=2)
                    for j, line in enumerate(lines):
                        draw.text((x+14, y+12+j*41), line, font=bold if ri == 0 else font, fill='white' if ri == 0 else '#182e40')
                    x += w
                y += h
            draw.text((32, height-44), '第1章 消防関係法令（共通）', font=font, fill='#566c7d')
            im.save(MASTER / f'{name}.png')
            im.save(OUT / f'{name}.jpg', quality=95, subsampling=0)
            markers.append(f'[[fig:{name}|{caption}]]')
            count += 1
        pattern = rf'^\[\[fig:{asset}(?:_\d+)?\|[^\n]*\]\](?:\n\n\[\[fig:{asset}_\d+\|[^\n]*\]\])*'
        body, replaced = re.subn(pattern, '\n\n'.join(markers), body, flags=re.M)
        if replaced != 1:
            raise ValueError(f'{asset}: 正本の対応マーカーが見つからない、または重複')
    MD.write_text(body, encoding='utf-8')
    print(f'Generated {count} figures. Next: python tools/gen_content_json.py 1')


if __name__ == '__main__':
    main()
