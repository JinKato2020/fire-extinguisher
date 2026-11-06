"""用語集.mdを正本としてcontent/glossary.jsonを生成。--checkは差分のみ確認。"""
from pathlib import Path
import json
import re
import sys

APP = Path(__file__).resolve().parents[1]
SOURCE = APP.parent / '教材解説' / '用語集.md'
TARGET = APP / 'content' / 'glossary.json'
FIELDS = {'用語': 'term', '読み': 'reading', '章': 'chapter', '関連': 'related', '図': 'figure'}


def generate(body):
    version = re.search(r'^版：(\d+)$', body, re.M)
    if not version:
        raise ValueError('用語集の版がありません')
    terms, ids = [], set()
    for match in re.finditer(r'^## ([^\n]+)\n(.*?)(?=^## |\Z)', body, re.M | re.S):
        ident, section = match.groups()
        metadata, separator, definition = section.partition('\n### 解説\n')
        if not re.fullmatch(r'[a-z0-9-]+', ident) or ident in ids or not separator or not definition.strip():
            raise ValueError(f'ID重複・不正、または解説なし: {ident}')
        ids.add(ident)
        term = {'id': ident}
        for line in metadata.strip().splitlines():
            label, colon, value = line.partition('：')
            if label not in FIELDS or not colon or FIELDS[label] in term:
                raise ValueError(f'{ident}: 不明または重複した項目: {line}')
            term[FIELDS[label]] = json.loads(value) if label == '関連' else value
        if not term.get('term') or term.get('chapter') not in {'1', '2', '3', '4', '5', '6'}:
            raise ValueError(f'{ident}: 用語名・章が不正')
        if 'related' in term and (not isinstance(term['related'], list) or not all(isinstance(v, str) for v in term['related'])):
            raise ValueError(f'{ident}: 関連語が不正')
        if term.get('figure') and not (APP / 'assets' / 'figures' / (term['figure'] + '.jpg')).is_file():
            raise ValueError(f'{ident}: 図が存在しません')
        term['def'] = definition.strip()
        terms.append({key: term[key] for key in ('id', 'term', 'reading', 'chapter', 'def', 'related', 'figure') if key in term})
    if not terms:
        raise ValueError('用語がありません')
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
