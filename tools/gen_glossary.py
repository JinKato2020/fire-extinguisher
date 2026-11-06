"""用語集.mdを正本としてcontent/glossary.jsonを生成。--checkは差分のみ確認。"""
from pathlib import Path
import json
import re
import sys

APP = Path(__file__).resolve().parents[1]
SOURCE = APP.parent / '教材解説' / '用語集.md'
TARGET = APP / 'content' / 'glossary.json'
FIELDS = {'用語': 'term', '読み': 'reading', '章': 'chapter', '関連': 'related', '図': 'figure',
          '別名': 'aliases', '教材': 'lesson', '図の説明': 'figureCaption'}
SECTIONS = {'ひとことで': 'summary', '解説': 'explanation', '具体例': 'example', '間違えやすい点': 'caution'}


def generate(body):
    version = re.search(r'^版：(\d+)$', body, re.M)
    if not version:
        raise ValueError('用語集の版がありません')
    terms, ids = [], set()
    for match in re.finditer(r'^## ([^\n]+)\n(.*?)(?=^## |\Z)', body, re.M | re.S):
        ident, section = match.groups()
        chunks = re.split(r'^### ([^\n]+)\n', section, flags=re.M)
        metadata = chunks[0]
        authored = {}
        for heading, value in zip(chunks[1::2], chunks[2::2]):
            if heading not in SECTIONS or SECTIONS[heading] in authored or not value.strip():
                raise ValueError(f'{ident}: 不明・重複・空の見出し: {heading}')
            authored[SECTIONS[heading]] = value.strip()
        if not re.fullmatch(r'[a-z0-9-]+', ident) or ident in ids or not authored.get('explanation'):
            raise ValueError(f'ID重複・不正、または解説なし: {ident}')
        ids.add(ident)
        term = {'id': ident}
        for line in metadata.strip().splitlines():
            label, colon, value = line.partition('：')
            if label not in FIELDS or not colon or FIELDS[label] in term:
                raise ValueError(f'{ident}: 不明または重複した項目: {line}')
            term[FIELDS[label]] = json.loads(value) if label in ('関連', '別名', '教材') else value
        if not term.get('term') or term.get('chapter') not in {'1', '2', '3', '4', '5', '6'}:
            raise ValueError(f'{ident}: 用語名・章が不正')
        for field in ('related', 'aliases'):
            if field in term and (not isinstance(term[field], list) or not all(isinstance(v, str) and v.strip() for v in term[field]) or len(term[field]) != len(set(term[field]))):
                raise ValueError(f'{ident}: {field}が不正')
        if 'lesson' in term:
            if type(term['lesson']) is not int or term['lesson'] < 1:
                raise ValueError(f'{ident}: 教材番号が不正')
            chapter = json.loads((APP / 'content' / 'chapters' / f'ch{term["chapter"]}.json').read_text(encoding='utf-8'))
            lesson_numbers = re.findall(r'^## Lesson (\d+) ', chapter.get('bodyV3', chapter.get('bodyV2', chapter['body'])), re.M)
            if term['lesson'] not in map(int, lesson_numbers):
                raise ValueError(f'{ident}: 復習先のレッスンが存在しません')
        if term.get('figure') and not (APP / 'assets' / 'figures' / (term['figure'] + '.jpg')).is_file():
            raise ValueError(f'{ident}: 図が存在しません')
        if bool(term.get('figure')) != bool(term.get('figureCaption')) and int(version[1]) >= 2:
            raise ValueError(f'{ident}: 図と図の説明は一組で指定してください')
        if int(version[1]) >= 2 and not all(authored.get(k) for k in ('summary', 'explanation', 'example')):
            raise ValueError(f'{ident}: 短い定義・解説・具体例が必要です')
        term.update(authored)
        # Old clients still render def as plain text; do not leak section markup.
        term['def'] = '\n\n'.join(filter(None, [authored.get('summary'), authored['explanation'],
            '具体例：' + authored['example'] if authored.get('example') else '',
            '注意：' + authored['caution'] if authored.get('caution') else '']))
        terms.append(term)
    if not terms:
        raise ValueError('用語がありません')
    names = {t['term'] for t in terms}
    if len(names) != len(terms):
        raise ValueError('見出し語が重複しています')
    for term in terms:
        if any(r not in names or r == term['term'] for r in term.get('related', [])):
            raise ValueError(f'{term["id"]}: 関連語が未定義、または自分自身です')
    return {'version': int(version[1]), 'terms': terms}


if __name__ == '__main__':
    data = generate(SOURCE.read_text(encoding='utf-8'))
    if '--check' in sys.argv:
        if data != json.loads(TARGET.read_text(encoding='utf-8')):
            sys.exit('glossary.json differs from canonical Markdown')
        print(f'PASS: {len(data["terms"])} glossary entries match canonical Markdown')
    else:
        TARGET.write_text(json.dumps(data, ensure_ascii=False) + '\n', encoding='utf-8', newline='\n')
        print(f'Generated {len(data["terms"])} glossary entries from canonical Markdown')
