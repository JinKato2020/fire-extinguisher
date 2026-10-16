# tools/gen_bundled.py — src/data/bundled.generated.ts を作る（CAEの量産共通ツールを fire6 へ移植）
#
# 役割: content/*.json を「アプリ同梱の土台データ(BUNDLED)」として require で登録する TS を自動生成。
#       キーは manifest と同じ相対パス。Metro が JSON をバンドルするので、オフラインでも読める。
# 使い方: python tools/gen_bundled.py   （fire6-exam-app 直下で実行）

import os

ROOT = os.getcwd()
CONTENT_DIR = os.path.join(ROOT, "content")
OUT = os.path.join(ROOT, "src", "data", "bundled.generated.ts")
EXCLUDE = {"_manifest.json"}

keys = []
for dirpath, _dirs, names in os.walk(CONTENT_DIR):
    for name in sorted(names):
        if name in EXCLUDE or not name.lower().endswith(".json"):
            continue
        full = os.path.join(dirpath, name)
        rel = os.path.relpath(full, CONTENT_DIR).replace(os.sep, "/")
        keys.append(f"content/{rel}")
keys.sort()

lines = [
    "// 自動生成（tools/gen_bundled.py）。手で編集しない。",
    "// アプリ本体に同梱する content/*.json の登録表（＝OTA前の土台データ）。",
    "// キーは manifest と同じ相対パス。値は require（Metro が JSON をバンドルする）。",
    "export const BUNDLED: Record<string, unknown> = {",
]
for k in keys:
    rel = k[len("content/"):]  # content/ を剥がして ../../content/ に付け直す
    lines.append(f"  '{k}': require('../../content/{rel}'),")
lines.append("};")

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w", encoding="utf-8", newline="\n") as f:
    f.write("\n".join(lines) + "\n")

print(f"bundled keys={len(keys)} -> {OUT}")
