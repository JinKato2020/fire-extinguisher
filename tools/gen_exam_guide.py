"""Generate the overview from its canonical Markdown; never hand-edit the JSON."""
from pathlib import Path
import argparse
import json

APP = Path(__file__).resolve().parents[1]
SOURCE = APP.parent / '教材解説' / '試験総合解説.md'
OUT = APP / 'content' / 'exam-guide.json'

def generate(text):
    first, body = text.strip().split('\n', 1)
    if not first.startswith('概要：'):
        raise ValueError('概要の指定が必要です')
    stats = json.loads(first.removeprefix('概要：'))
    if not isinstance(stats, list) or len(stats) != 3 or any(
        not isinstance(item, dict) or set(item) != {'label', 'value', 'unit', 'detail'} or
        not all(isinstance(v, str) and v for v in item.values()) for item in stats
    ):
        raise ValueError('概要は3項目の短い文字列で指定してください')
    if not body.strip().startswith('# 試験の総合解説'):
        raise ValueError('総合解説の見出しが必要です')
    return {'schema': 1, 'stats': stats, 'body': body.strip() + '\n'}

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    data = generate(SOURCE.read_text(encoding='utf8'))
    if args.check:
        if not OUT.exists() or json.loads(OUT.read_text(encoding='utf8')) != data:
            raise SystemExit('FAIL: overview JSON differs from canonical Markdown')
        print('PASS: overview matches canonical Markdown')
    else:
        OUT.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
        print('Generated content/exam-guide.json from canonical Markdown')
