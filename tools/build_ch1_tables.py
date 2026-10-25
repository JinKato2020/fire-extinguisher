"""章の図表を再作図する (Pillow)。引数なしは従来どおり第1章。

初回のみ --init で正本の表を図マーカーへ移行。
例: python tools/build_ch1_tables.py 2 3 4 5 6
以後は 教材解説/第N章_図表データ.md を編集して本スクリプトを実行し、
続けて tools/gen_content_json.py で対象章を再生成。JSONは直接編集しない。
フォントは --font で日本語TrueTypeフォントを指定できる。
"""
import argparse
from pathlib import Path
import re
from PIL import Image, ImageDraw, ImageFont

APP = Path(__file__).resolve().parents[1]
OUT = APP / 'assets' / 'figures'
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


def build_chapter(chapter, args):
    md = next((APP.parent / '教材解説').glob(f'教材_第{chapter}章_*.md'))
    source = md.parent / f'第{chapter}章_図表データ.md'
    master = APP.parent / '図' / f'第{chapter}章' / '表'
    chapter_title = md.read_text(encoding='utf-8').splitlines()[0].lstrip('# ')
    prefix = f'ch{chapter}_t'
    MD, SOURCE, MASTER = md, source, master
    body = MD.read_text(encoding='utf-8')
    if args.init:
        if SOURCE.exists():
            raise ValueError('図表データは既に存在します。--init を外して実行してください。')
        entries = []
        for n, match in enumerate(TABLE.finditer(body), 1):
            headings = re.findall(r'^#{2,3} (.+)$', body[:match.start()], re.M)
            title = headings[-1] if headings else '試験制度'
            entries.append(f'## {prefix}{n:02d}|{title}\n\n{match[0]}\n')
        SOURCE.write_text(f'# 第{chapter}章 図表の元データ\n\n'
                          '表の文言はこのファイルで修正し、tools/build_ch1_tables.py で再作図します。\n'
                          '元の表の内容を保持しています。教材内容の改訂は行っていません。\n\n'
                          + '\n'.join(entries), encoding='utf-8')
        n = 0
        def replace(match):
            nonlocal n
            n += 1
            return f'[[fig:{prefix}{n:02d}|仮]]'
        body = TABLE.sub(replace, body)
        lines = body.split('\n')
        lines.insert(1, '\n図表はタップすると全画面で拡大できます。右上の「×」で本文に戻れます。')
        body = '\n'.join(lines)

    font = ImageFont.truetype(args.font, 27)
    bold = ImageFont.truetype(args.font, 31)
    titlefont = ImageFont.truetype(args.font, 34)
    OUT.mkdir(parents=True, exist_ok=True)
    MASTER.mkdir(parents=True, exist_ok=True)
    count = 0
    for asset, title, table in re.findall(rf'^## ({prefix}\d+)\|([^\n]+)\n\n(.*?)(?=^## |\Z)', SOURCE.read_text(encoding='utf-8'), re.M | re.S):
        rows = [[c.strip() for c in line.split('|')[1:-1]]
                for line in table.splitlines() if line.startswith('|')]
        rows = [r for r in rows if not all(re.fullmatch(r':?-+:?', c) for c in r)]
        headers, data = rows[0], rows[1:]
        if any(len(row) != len(headers) for row in data):
            raise ValueError(f'{asset}: 列数が一致しません')
        # 横に広い表は行名を繰り返して列を分割する。
        # 7列表は区分・細区分の2列を共通にする。
        keep = 2 if len(headers) == 7 else 1
        column_groups = [list(range(len(headers)))] if len(headers) <= 4 else [
            list(range(keep)) + list(range(start, min(start + 4 - keep, len(headers))))
            for start in range(keep, len(headers), 4 - keep)
        ]
        pages = []
        for indices in column_groups:
            group_headers = [headers[i] for i in indices]
            group_data = [[row[i] for i in indices] for row in data]
            pages.extend(layout_pages(group_headers, group_data, font, bold))
        markers = []
        for p, (head, hh, page, widths) in enumerate(pages, 1):
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
            draw.text((32, height-44), chapter_title, font=font, fill='#566c7d')
            im.save(MASTER / f'{name}.png')
            im.save(OUT / f'{name}.jpg', quality=95, subsampling=0)
            markers.append(f'[[fig:{name}|{caption}]]')
            count += 1
        pattern = rf'^\[\[fig:{asset}(?:_\d+)?\|[^\n]*\]\](?:\n\n\[\[fig:{asset}_\d+\|[^\n]*\]\])*'
        body, replaced = re.subn(pattern, '\n\n'.join(markers), body, flags=re.M)
        if replaced != 1:
            raise ValueError(f'{asset}: 正本の対応マーカーが見つからない、または重複')
    MD.write_text(body, encoding='utf-8')
    print(f'Chapter {chapter}: Generated {count} figures. Next: python tools/gen_content_json.py {chapter}')


def layout_pages(headers, data, font, bold):
    widths = {1: [1136], 2: [400, 736], 3: [250, 440, 446], 4: [300, 278, 279, 279]}[len(headers)]
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
    return [(head, hh, page, widths) for page in pages]

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('chapters', type=int, nargs='*', default=[1], choices=range(1, 7))
    parser.add_argument('--init', action='store_true')
    parser.add_argument('--font', default='C:/Windows/Fonts/meiryo.ttc')
    args = parser.parse_args()
    for chapter in args.chapters:
        build_chapter(chapter, args)


if __name__ == '__main__':
    main()
