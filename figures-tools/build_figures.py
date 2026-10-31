# -*- coding: utf-8 -*-
"""図の正本(figures.json)を content/chapters/chN.json の本文(Markdown)へ反映するパイプライン。
- drop_dir の元PNGを縮小・JPEG化して resources_dir(assets/figures) に <asset>.jpg で配置。
- 画像がある図だけ、本文に図マーカー `[[fig:asset|caption]]` を挿入/更新。
    ・既に同as_setのマーカーがあれば置換(冪等)。
    ・無ければ anchor を探す: 「【図】…anchor…」行があればその行を置換 / 見出し等にanchorを含む行があれば直後へ挿入。
    ・anchorが本文で見つからなければ警告してスキップ(本文は壊さない)。
- 画像が未生成の図はスキップ(スロットを作らない)。再実行しても安全。
使い方: python figures-tools/build_figures.py   (fire6-exam-app 直下で実行)
※ 反映後、同梱/配信へ乗せるには: python tools/gen_bundled.py && python tools/content_manifest.py
   実機配信は GitHub Actions「消防6類 コンテンツ配信 (R2/OTA)」を手動実行。
"""
import argparse, json, os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
CFG = json.load(open(os.path.join(HERE, "figures.json"), encoding="utf-8"))
DROP = CFG["drop_dir"]; RES = CFG["resources_dir"]
CONTENT_DIR = CFG["content_dir"]; INDEX = CFG["index_json"]
MAXPX = CFG.get("img_max_px", 1000); Q = CFG.get("jpeg_quality", 85)
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--images-only', action='store_true', help='画像だけ変換。本文JSONは変更しない')
args = parser.parse_args()
os.makedirs(RES, exist_ok=True)


def process_source(src, asset):
    # New review masters may be stored inside the repository for reproducibility.
    p = src if os.path.isabs(src) else os.path.join(os.path.dirname(HERE), src)
    if not os.path.exists(p):
        p = os.path.join(DROP, src)
    if not os.path.exists(p):
        return False
    im = Image.open(p)
    if im.mode in ("RGBA", "LA", "P"):
        bg = Image.new("RGB", im.size, (255, 255, 255))
        rgba = im.convert("RGBA"); bg.paste(rgba, mask=rgba.split()[-1]); im = bg
    else:
        im = im.convert("RGB")
    im.thumbnail((MAXPX, MAXPX), Image.Resampling.LANCZOS)
    im.save(os.path.join(RES, asset + ".jpg"), "JPEG", quality=Q, subsampling=0, optimize=True)
    return True


def img_exists(asset):
    return any(os.path.exists(os.path.join(RES, asset + ext)) for ext in (".jpg", ".png"))


# 章番号 → chN.json のフルパス
idx = json.load(open(INDEX, encoding="utf-8"))
chfile = {}
for m in idx["chapters"]:
    # file は "content/chapters/chN.json"。basename を content_dir に付け直す。
    chfile[str(m["no"])] = os.path.join(CONTENT_DIR, os.path.basename(m["file"]))

processed = applied = skipped = warned = 0
dirty = {}  # path -> data（まとめて保存）

for f in CFG["figures"]:
    asset = f["asset"]
    # 元PNGの候補: source指定 → <asset>.png → <asset>.jpg
    for cand in [c for c in (f.get("source"), asset + ".png", asset + ".jpg") if c]:
        if process_source(cand, asset):
            processed += 1
            break
    if not img_exists(asset):
        skipped += 1
        continue

    if args.images_only:
        continue

    path = chfile.get(str(f["chapter"]))
    if not path or not os.path.exists(path):
        print("!! chapter file not found:", f["chapter"], "for", asset); warned += 1; continue
    data = dirty.get(path) or json.load(open(path, encoding="utf-8"))
    dirty[path] = data
    lines = (data.get("body") or "").split("\n")
    caption = f.get("caption", "")
    marker = f"[[fig:{asset}|{caption}]]"
    anchor = (f.get("anchor") or "").strip()

    # ① 既存マーカーを置換（冪等）
    mi = next((i for i, ln in enumerate(lines) if ln.strip().startswith(f"[[fig:{asset}")), None)
    if mi is not None:
        lines[mi] = marker; data["body"] = "\n".join(lines); applied += 1; continue

    if not anchor:
        print("!! anchor 未設定:", asset, "→ 挿入スキップ(画像のみ配置)"); warned += 1; continue

    # ②「【図】…anchor…」行を置換
    zi = next((i for i, ln in enumerate(lines)
               if ln.strip().startswith("【図】") and anchor in ln), None)
    if zi is not None:
        lines[zi] = marker; data["body"] = "\n".join(lines); applied += 1; continue

    # ③ anchor を含む行（見出し等）の直後へ挿入
    ai = next((i for i, ln in enumerate(lines) if anchor in ln), None)
    if ai is not None:
        lines.insert(ai + 1, marker); data["body"] = "\n".join(lines); applied += 1; continue

    print("!! anchor 不一致:", asset, repr(anchor), "→ 挿入スキップ"); warned += 1

for path, data in dirty.items():
    json.dump(data, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

print(f"processed(画像変換)={processed}  applied(本文へ反映)={applied}  "
      f"skipped(画像未生成)={skipped}  warned(anchor等で未挿入)={warned}")
print("次: python tools/gen_bundled.py && python tools/content_manifest.py → 配信ワークフロー")
