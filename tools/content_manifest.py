# tools/content_manifest.py — コンテンツOTA用 manifest 生成（CAEの量産共通ツールを fire6 へ移植）
#
# 役割: アプリに載る content/*.json 全ファイルの sha256 と size を _manifest.json に書き出す。
#   ・アプリ本体はこの _manifest.json を「同梱baseline」として import する（bundleTag判定に使用）。
#   ・同じ _manifest.json を配信先 content.safa-lang.com/fire6/ にも置く。
#   ・端末は「配信manifestのsha」と「手持ちsha」を比べ、変わったファイルだけDLする。
#
# 使い方: python tools/content_manifest.py   （fire6-exam-app 直下で実行）

import hashlib
import json
import os
import sys
from datetime import datetime, timezone

# ---- CONFIG（新アプリではここだけ変える）--------------------------------
APP_ID = "fire6"
# (manifestキーのprefix, ソースの実ディレクトリ, 対象拡張子)
SOURCES = [
    ("content", "content", (".json",)),  # テキスト: content/ 以下をそのままのキーで
    # 図を使う場合は次を足す: ("figures", "assets/figures", (".png", ".jpg")),
]
MANIFEST_OUT = "content/_manifest.json"
EXCLUDE_BASENAMES = {"_manifest.json"}
# ------------------------------------------------------------------------


def sha256_of(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def collect(root: str):
    files = {}
    for key_prefix, src_rel, exts in SOURCES:
        src_dir = os.path.join(root, src_rel)
        if not os.path.isdir(src_dir):
            print(f"[warn] ソース無し: {src_rel}", file=sys.stderr)
            continue
        for dirpath, _dirs, names in os.walk(src_dir):
            for name in sorted(names):
                if name in EXCLUDE_BASENAMES:
                    continue
                if not name.lower().endswith(exts):
                    continue
                full = os.path.join(dirpath, name)
                rel = os.path.relpath(full, src_dir).replace(os.sep, "/")
                key = f"{key_prefix}/{rel}"
                files[key] = {"sha256": sha256_of(full), "size": os.path.getsize(full)}
    return files


def main():
    root = os.getcwd()
    files = collect(root)
    manifest = {
        "appId": APP_ID,
        "schema": 1,
        "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "files": dict(sorted(files.items())),
    }
    out_path = os.path.join(root, MANIFEST_OUT)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        f.write("\n")

    total_mb = sum(v["size"] for v in files.values()) / 1024 / 1024
    print(f"appId={APP_ID}  files={len(files)}  total={total_mb:.2f}MB")
    print(f"out: {out_path}  ({os.path.getsize(out_path)/1024:.0f}KB)")


if __name__ == "__main__":
    main()
