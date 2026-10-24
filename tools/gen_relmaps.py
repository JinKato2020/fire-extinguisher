# 相関図SVG(章ごと・ライト/ダーク)を 1本の TS モジュールへ埋め込む。
# 画像(PNG)ではなく SVG文字列を同梱し、react-native-svg の SvgXml で描く
# ＝ 20KB程度/枚で無劣化ズーム、OTA不要で必ず表示される。
import json, pathlib

base = pathlib.Path('assets/relation-maps')
out = {}
for ch in '123456':
    light = (base / f'chapter{ch}_relation_map.svg').read_text(encoding='utf-8')
    dark = (base / f'chapter{ch}_relation_map-dark.svg').read_text(encoding='utf-8')
    out[ch] = {'light': light, 'dark': dark}

ts = (
    '// 自動生成（tools/gen_relmaps.py）。assets/relation-maps/*.svg を同梱用に文字列化したもの。\n'
    '// 手で編集しない。元SVGを直したら python tools/gen_relmaps.py で再生成する。\n'
    'export const RELATION_MAPS: Record<string, { light: string; dark: string }> = '
    + json.dumps(out, ensure_ascii=False)
    + ';\n'
)
dst = pathlib.Path('src/data/relationMaps.generated.ts')
dst.write_text(ts, encoding='utf-8')
total = sum(len(v['light']) + len(v['dark']) for v in out.values())
print(f'wrote {dst} ({total} bytes of svg, {len(out)} chapters)')
