# -*- coding: utf-8 -*-
"""公式教材(教材\\N章_*.txt)の【図】マーカーを棚卸しして figures.json の種(カタログ)を作る。
- 1【図】= 1エントリ。asset=chN_fNN、caption=図タイトル、anchor=タイトル(本文突合用の初期値)。
- prompt は「タイトル＋共通スタイル文」で下書き(ChatGPTへそのまま渡せる叩き台)。
- 既存 figures.json があれば、同じ caption のエントリの手入力(anchor/labels/legend/prompt/source)を引き継ぐ。
使い方: python figures-tools/gen_figures_catalog.py   (fire6-exam-app 直下で実行)
※これは「種」。どの図を実際に描くかは人が取捨選択し、anchor を本文(chN.json)の見出し語に合わせること。
"""
import json, os, re, glob

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)                     # fire6-exam-app
PROJ = os.path.dirname(APP)                     # 消防設備士6類
SRC_DIR = os.path.join(PROJ, "教材")            # 公式転記版(【図】付き)
OUT = os.path.join(HERE, "figures.json")

STYLE_A = "白背景の3Dレンダ調、やや斜めの立体視、金属=スチール〜ネイビーの陰影と光沢、ゴム・強調・注意=赤、影とグラデで立体感。部品名・寸法・例示数値を図中に日本語で明記(誤字なし)。引出線はくの字(エルボ型)で水平段の高さをそろえる。フラット線画・淡い水色ベタ塗りは禁止。横長・1図1枚。"
STYLE_B = "2Dで最適化(3Dにしない)。白背景、スチールブルー＋強調赤、日本語ラベルを図中に明記、引出線はくの字。表は普通の罫線表、グラフは直交軸にラベルと単位。横長・1図1枚。"

# 立体物(A)っぽいキーワード。該当すれば3Dレンダ調、それ以外は概念・数理(B)。
A_KEYS = ["消火器", "ノズル", "レバー", "ホース", "サイホン", "サイフォン", "ボンベ", "容器",
          "構造", "断面", "内部", "本体", "弁", "キャップ", "ホーン", "工具", "器具", "部品"]


def pick_style(title: str) -> str:
    return STYLE_A if any(k in title for k in A_KEYS) else STYLE_B


def load_prev():
    if not os.path.exists(OUT):
        return {}
    try:
        cfg = json.load(open(OUT, encoding="utf-8"))
        return {f["caption"]: f for f in cfg.get("figures", [])}
    except Exception:
        return {}


def main():
    prev = load_prev()
    figures = []
    for n in range(1, 7):
        hits = glob.glob(os.path.join(SRC_DIR, f"{n}章_*.txt"))
        if not hits:
            continue
        text = open(hits[0], encoding="utf-8").read()
        idx = 0
        for line in text.splitlines():
            m = re.match(r"\s*【図】(.+)", line)
            if not m:
                continue
            idx += 1
            raw = m.group(1).strip()
            # 「タイトル：説明」なら左=caption、全体=prompt材料
            caption = re.split(r"[：:(（]", raw, 1)[0].strip() or raw
            asset = f"ch{n}_f{idx:02d}"
            if caption in prev:                 # 手入力を引き継ぐ
                e = dict(prev[caption]); e["asset"] = asset; e["chapter"] = n
                figures.append(e); continue
            figures.append({
                "asset": asset,
                "chapter": n,
                "anchor": caption,              # ← 本文(chN.json)の見出し語に手で合わせる
                "position": 1,
                "source": None,                 # drop_dir に置いた元PNG名。無指定なら <asset>.png を自動取込
                "caption": caption,
                "legend": [],
                "labels": [],
                "draw": False,                  # 実際に描く図だけ true にする(取捨選択用)
                "prompt": f"{raw}。{pick_style(raw)}",
            })
    cfg = {
        "_about": "消防6類 図の正本。build_figures.py で content/chapters/chN.json 本文へ反映。手順=README_図の仕組み.md",
        "_howto": "①draw:true にした図の prompt を ChatGPT に渡して作図 → ②生成PNGを drop_dir に <asset>.png で保存 → ③anchor を本文の見出し語に合わせる → ④python figures-tools/build_figures.py → ⑤配信は『消防6類 コンテンツ配信』ワークフロー。",
        "style_a_3d": STYLE_A,
        "style_b_2d": STYLE_B,
        "drop_dir": "C:/Users/jwpsa/Documents/desktop/claude/消防設備士6類/教材画像",
        "resources_dir": "C:/Users/jwpsa/Documents/desktop/claude/消防設備士6類/fire6-exam-app/assets/figures",
        "content_dir": "C:/Users/jwpsa/Documents/desktop/claude/消防設備士6類/fire6-exam-app/content/chapters",
        "index_json": "C:/Users/jwpsa/Documents/desktop/claude/消防設備士6類/fire6-exam-app/content/index.json",
        "img_max_px": 1000,
        "jpeg_quality": 85,
        "figures": figures,
    }
    json.dump(cfg, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    by_ch = {}
    for f in figures:
        by_ch[f["chapter"]] = by_ch.get(f["chapter"], 0) + 1
    print("figures=", len(figures), " 章別=", dict(sorted(by_ch.items())))
    print("out:", OUT)


if __name__ == "__main__":
    main()
