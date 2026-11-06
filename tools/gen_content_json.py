# -*- coding: utf-8 -*-
r"""教材解説(..\..\教材解説\教材_第N章_*.md)を正本として content/chapters/chN.json を再生成する。
- no/title は content/index.json から引く。新記法がある章は bodyV2=正本全文、body=旧画面互換版。
- 旧 scratchpad\gen_content_json.py の代替(リポジトリ常設版)。
使い方: python tools/gen_content_json.py            全章
        python tools/gen_content_json.py --check     再生成せず現JSONとの差分だけ確認
        python tools/gen_content_json.py 1 4          指定章だけ
"""
import json, os, sys, glob, re

ROOT = os.getcwd()                                  # fire6-exam-app 直下で実行
PROJ = os.path.dirname(ROOT)                        # 消防設備士6類
MD_DIR = os.path.join(PROJ, "教材解説")
IDX = os.path.join(ROOT, "content", "index.json")
OUT_DIR = os.path.join(ROOT, "content", "chapters")

args = [a for a in sys.argv[1:] if not a.startswith("--")]
CHECK = "--check" in sys.argv
want = set(int(a) for a in args) if args else set(range(1, 7))

idx = json.load(open(IDX, encoding="utf-8"))
meta = {str(m["no"]): m for m in idx["chapters"]}


def md_path(n: int):
    hits = glob.glob(os.path.join(MD_DIR, f"教材_第{n}章_*.md"))
    return hits[0] if hits else None


def legacy_markdown(body: str) -> str:
    """Old OTA readers only understand regular Markdown, not interactive blocks."""
    def convert(match):
        kind, title, text = match.groups()
        if kind == 'steps':
            return f'#### {title}\n\n{text.strip()}\n'
        question, separator, answer = text.partition('\n---\n')
        if not separator or not answer.strip():
            raise ValueError(f'確認問題の解答がありません: {title}')
        quote = '\n'.join('> ' + line for line in answer.strip().splitlines())
        return f'#### {title}\n\n{question.strip()}\n\n> [!NOTE] 解答・解説\n{quote}\n'
    converted = re.sub(r'^:::(check|steps) ([^\n]+)\n(.*?)^:::[ \t]*$', convert, body, flags=re.M | re.S)
    if re.search(r'^:::', converted, re.M):
        raise ValueError('旧画面用に変換できない学習ブロックがあります')
    return converted


changed = same = missing = 0
for n in range(1, 7):
    if n not in want:
        continue
    m = meta.get(str(n))
    p = md_path(n)
    if not m or not p:
        print(f"[warn] 章{n}: index/md 不足"); missing += 1; continue
    body = open(p, encoding="utf-8").read()
    data = {"no": str(n), "title": m["title"], "body": body}
    if re.search(r'^:::(check|steps) ', body, re.M):
        data['bodyV2'] = body  # Canonical Markdown, read by the enhanced lesson UI.
        data['body'] = legacy_markdown(body)  # Safe even when content arrives before JS OTA.
    out = os.path.join(OUT_DIR, f"ch{n}.json")
    new = json.dumps(data, ensure_ascii=False) + "\n"  # 既存JSONと同じ整形(compact+改行)
    old = open(out, encoding="utf-8").read() if os.path.exists(out) else None
    if old == new:
        same += 1; continue
    changed += 1
    if CHECK:
        print(f"[diff] ch{n}.json は md と不一致(再生成で更新される)")
    else:
        open(out, "w", encoding="utf-8", newline="\n").write(new)
        print(f"[write] ch{n}.json ← {os.path.basename(p)} ({len(body)}字)")

print(f"{'check' if CHECK else 'done'}: changed={changed} same={same} missing={missing}")
if CHECK and (changed or missing):
    sys.exit(1)
