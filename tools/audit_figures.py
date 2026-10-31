"""Check lesson figures and produce a reproducible review inventory/gallery.

Run from fire6-exam-app after image/content/manifest generation.
This checks integrity and known corrected calculations; visual/technical findings
are documented in docs/image-review/index.html, not inferred from file hashes.
"""
from pathlib import Path
from PIL import Image
import csv, hashlib, html, json, re

APP = Path(__file__).resolve().parents[1]
OUT = APP / 'docs/image-review'
OUT.mkdir(parents=True, exist_ok=True)
manifest = json.loads((APP / 'content/_manifest.json').read_text(encoding='utf8'))
catalog = json.loads((APP / 'figures-tools/figures.json').read_text(encoding='utf8'))
figures = {f['asset']: f for f in catalog['figures']}
findings = {
    'ch3_f03': '作用線と力の矢印を同一直線上に修正。3つの作用位置を比較。',
    'ch2_f05': '最大1/3を減らすことを明示。6−2=4、条件・11階以上の除外を表示。',
    'ch2_t07_01': '「1/3まで減少」を「最大1/3を減らせる」に明確化。',
    'ch4_t01_01': '四要素の表に欠けていた抑制消火を追加。',
    'ch4_t14_01': '絶対圧へ換算して温度別ゲージ圧を再計算。仮定を明示。',
    'ch6_t03_01': 'ねずみ色＋赤の代表例にハロン1301・1211を記載。',
}
records = []
for n in range(1, 7):
    md_path = next((APP.parent / '教材解説').glob(f'教材_第{n}章_*.md'))
    body = md_path.read_text(encoding='utf8')
    data = json.loads((APP / f'content/chapters/ch{n}.json').read_text(encoding='utf8'))
    assert data['body'] == body, f'ch{n}: Markdown/JSON mismatch'
    for asset, caption in re.findall(r'\[\[fig:([^|\]]+)\|([^\]]*)\]\]', body):
        path = APP / 'assets/figures' / f'{asset}.jpg'
        with Image.open(path) as im:
            im.load()
            w, h = im.size
        key = f'figures/{asset}.jpg'
        payload = path.read_bytes()
        assert manifest['files'][key]['sha256'] == hashlib.sha256(payload).hexdigest(), key
        assert manifest['files'][key]['size'] == len(payload), key
        # Ensure source resolution was retained, not merely enlarged from old JPEGs.
        if asset in figures:
            source = Path(figures[asset]['source'])
            if not source.is_absolute(): source = APP / source
            with Image.open(source) as master:
                expected = master.copy()
                expected.thumbnail((catalog['img_max_px'],) * 2, Image.Resampling.LANCZOS)
                assert (w, h) == expected.size, asset
        records.append({'chapter': n, 'asset': asset, 'caption': caption, 'width': w,
                        'height': h, 'bytes': len(payload),
                        'review': findings.get(asset, '一覧目視の一次確認。表は元データから再生成、図はPNG正本から高精細化。'),
                        'phone_preview_height_358px': round(358 * h / w)})

unique = {r['asset']: r for r in records}
assert len(unique) == 209, f'Unexpected active asset count: {len(unique)}'
assert sum(bool(re.match(r'ch\d+_f\d+', a)) for a in unique) == 113
assert sum(bool(re.match(r'ch\d+_t\d+', a)) for a in unique) == 96

# This example uses absolute pressure for p/T, then converts back to gauge.
table = (APP.parent / '教材解説/第4章_図表データ.md').read_text(encoding='utf8')
for temp, expected in [(0, .842), (-20, .773), (-30, .738)]:
    pressure = (0.98 + .101325) * (temp + 273.15) / 313.15 - .101325
    assert abs(pressure - expected) < .0005
    assert f'約{expected:.3f}MPa' in table
assert '**抑制消火**' in table
assert '最大3分の1を減らせる' in (APP.parent / '教材解説/第2章_図表データ.md').read_text(encoding='utf8')

rows = list(unique.values())
with (OUT / 'inventory.csv').open('w', encoding='utf-8-sig', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=list(rows[0]))
    writer.writeheader(); writer.writerows(rows)

cards = []
for r in rows:
    a = r['asset']; url = f'../../assets/figures/{a}.jpg'
    cards.append(f'<article data-chapter="{r["chapter"]}"><h3>{a} · {html.escape(r["caption"])}</h3>'
                 f'<a href="{url}"><img loading="lazy" src="{url}" alt="{html.escape(r["caption"])}"></a>'
                 f'<p>{r["width"]}×{r["height"]} · {r["bytes"]//1024}KB</p>'
                 f'<p>{html.escape(r["review"])}</p></article>')
summary = {'activeFigures': 113, 'activeTables': 96, 'activeAssets': len(unique),
           'publicDeploymentPerformed': False, 'physicalDeviceVerification': False,
           'imagegenMode': 'built-in', 'correctedAssets': findings,
           'checks': ['all JPEGs decode', 'all markers resolve', 'source resolution retained',
                      'all image manifest hashes match', 'all chapter JSON matches Markdown',
                      'absolute/gauge pressure calculation verified']}
(OUT / 'checks.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2)+'\n', encoding='utf8')
report = '''<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>教材画像レビュー 2026-11-01</title><style>
body{font:16px/1.8 system-ui,sans-serif;color:#193549;background:#f3f6f8;margin:0;padding:24px;max-width:1400px;margin:auto}
h1{font-size:28px}section,article{background:white;border:1px solid #d2dfe7;border-radius:12px;padding:20px;margin-bottom:20px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(330px,1fr));gap:16px}h3{font-size:16px}img{width:100%;height:auto}a{color:#075b9b}
li{margin:8px 0}.note{border-left:5px solid #bd6a10}select{padding:10px;font-size:16px}
</style><h1>消防設備士6類 教材画像レビュー</h1><p>2026-11-01 · 本文の図113点＋表96点＝209点。相関図はライト／ダーク12点を別途一覧確認。</p>
<section><h2>修正した内容</h2><ul>
<li>作用線の図：力の方向と作用線が一致していなかったため、同一直線上の矢印に修正。</li>
<li>スプリンクラーの緩和：最大1/3を「減らす」意味と、6−2=4の例を明示。対応する表も修正。</li>
<li>温度と圧力：ゲージ圧に大気圧を足してから気体の法則を適用。温度別の値・計算の仮定・本文を修正。</li>
<li>消火の四要素の表：抑制消火の行を追加。</li>
<li>ねずみ色＋赤の消火器：未記入の代表例にハロン1301・1211を補足。</li>
</ul><h2>読みやすさ</h2><ul>
<li>図113点はPNG正本から長辺最大2400px・JPEG品質95・色差間引きなしで再出力。低解像度JPEGの引き伸ばしは行わない。</li>
<li>表96点は編集可能な元データから再生成。比較用の全体表は維持し、短い表の固定750pxの空白を除去。</li>
<li>アプリの本文では画像本来の縦横比で表示。長い表が横長枠で縮小される問題を修正。</li>
<li>拡大操作を文字で案内。タブレットでも画像を本文の幅に収める。</li>
</ul></section>
<section class="note"><h2>レビューの範囲</h2><p>全209点の一覧目視で、文字・矢印・図の内容と説明の整合を一次確認し、疑義のある図は個別に拡大して確認した。表は正本の図表データとの生成上の一致も確認した。法令の全条文照合、全製品の実構造との照合、専門家による監修、実機確認を完了したものではない。写真風の構造図・器具図は学習用の模式図であり、メーカーの整備手順図を代替しない。</p>
<p>相関図12点は既存SVGのため拡大時の解像度劣化はない。一覧で重大な欠落・交差は見つからず、今回の作図変更対象外。</p>
<p>ローカルの修正。コミット・プッシュ・OTA配信は今回実行していない。</p></section>
<section><h2>根拠・再確認先</h2><ul>
<li><a href="https://laws.e-gov.go.jp/law/336M50000008006">消防法施行規則</a> 第7・8条：能力単位の減少と適応性・有効範囲・11階以上の除外。</li>
<li><a href="https://www.nra.go.jp/data/000442472.pdf">原子力規制委員会掲載資料の消防法施行規則第8条抜粋</a>：三分の一までを減少した数値。</li>
<li><a href="https://laws.e-gov.go.jp/law/341M50000400050">容器保安規則</a> 第10条：液化炭酸ガスは緑色、その他の種類の高圧ガスはねずみ色。例外規定あり。</li>
<li><a href="https://www.city.hakodate.hokkaido.jp/docs/2021090700029/">函館市・防災管理者が必要な対象物</a>：複合用途の対象階と対象用途床面積の考え方。</li>
</ul><p>修正した2図のPNG正本は <a href="masters/ch3_f03.png">作用線</a>・<a href="masters/ch2_f05.png">緩和</a>。<a href="prompts.json">画像生成プロンプト</a>／<a href="inventory.csv">全画像台帳CSV</a>／<a href="checks.json">機械検証結果</a></p></section>
<h2>全画像一覧（クリックで原寸）</h2><label>章 <select id="chapter"><option value="all">全章</option>'''
report += ''.join(f'<option value="{n}">第{n}章</option>' for n in range(1,7))
report += '</select></label><div class="grid">'+''.join(cards)+'''</div><script>
document.querySelector('#chapter').onchange=e=>document.querySelectorAll('article').forEach(el=>el.hidden=e.target.value!=='all'&&el.dataset.chapter!==e.target.value);
</script></html>'''
(OUT / 'index.html').write_text(report, encoding='utf8')
print(f'PASS: {len(unique)} active figures, source sizes, manifest, Markdown/JSON, pressure calculation.')
print(f'Report: {OUT / "index.html"}')
