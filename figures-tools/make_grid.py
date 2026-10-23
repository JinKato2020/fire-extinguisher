# -*- coding: utf-8 -*-
"""ラベル座標を読み取るためのグリッド重ね画像を作る（クレーンと同規格）。
出力: figure-tools/_grids/<asset>.jpg (0〜10の目盛り=相対位置×10)。
figures.json の labels に {"x":0〜1,"y":0〜1,"text":"…"} を書く時の座標読み取り用。
※ fire6アプリ本体はラベルのオーバーレイ描画は行わず、ラベルはChatGPTが図中へ日本語で焼き込む方針。
   本ツールは規格合わせ＆（必要時の）座標メモ用。
使い方: python figures-tools/make_grid.py            全図
        python figures-tools/make_grid.py ch4_f01    指定の図だけ"""
import json, os, sys
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__))
CFG = json.load(open(os.path.join(HERE, "figures.json"), encoding="utf-8"))
RES = CFG["resources_dir"]; OUT = os.path.join(HERE, "_grids"); os.makedirs(OUT, exist_ok=True)
want = set(sys.argv[1:])


def src(asset):
    for e in (".jpg", ".png"):
        p = os.path.join(RES, asset + e)
        if os.path.exists(p):
            return p
    return None


n = 0
for f in CFG["figures"]:
    a = f["asset"]
    if want and a not in want:
        continue
    p = src(a)
    if not p:
        continue
    im = Image.open(p).convert("RGB")
    W = 620; H = int(im.height * W / im.width); im = im.resize((W, H))
    dr = ImageDraw.Draw(im)
    for i in range(1, 10):
        x = int(W * i / 10); dr.line([(x, 0), (x, H)], fill=(180, 180, 255)); dr.text((x + 1, 1), str(i), fill=(200, 0, 0))
        y = int(H * i / 10); dr.line([(0, y), (W, y)], fill=(180, 180, 255)); dr.text((1, y + 1), str(i), fill=(200, 0, 0))
    q = 55
    o = os.path.join(OUT, a + ".jpg")
    while q >= 20:
        im.save(o, "JPEG", quality=q)
        if os.path.getsize(o) <= 95000:
            break
        q -= 5
    n += 1; print("grid", a, im.size)
print("done", n, "grids ->", OUT)
