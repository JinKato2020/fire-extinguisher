# 消防6類アプリ 図の仕組み（クレーン方式を移植）

**作図＝ChatGPT（画像生成）／実装・配置・配信＝このツール群。** Claudeは図を手描きしない。

## 全体の流れ
1. **描く図を選ぶ** … `figures.json` の各エントリの `"draw": true` にする（公式教材の【図】123件を種として自動カタログ化済み）。
2. **作図（ChatGPT）** … そのエントリの `"prompt"` を ChatGPT に渡して画像生成。スタイルは `style_a_3d`(立体物) / `style_b_2d`(概念・数理) に準拠。ラベル（部品名・寸法）は**図中に日本語で焼き込む**。
3. **PNGを置く** … 生成PNGを `drop_dir`（= `消防設備士6類\教材画像\`）に **`<asset>.png`** の名前で保存（例 `ch4_f03.png`）。別名なら `"source"` にファイル名を書く。
4. **anchorを合わせる** … `"anchor"` を、その図を入れたい**本文(chN.json)の見出し語や既存の【図】タイトル**に一致するよう手で調整。
5. **反映** … `python figures-tools/build_figures.py`
   - PNG→縮小JPEG化して `assets/figures/<asset>.jpg` に配置。
   - 本文(`content/chapters/chN.json`)に図マーカー `[[fig:asset|caption]]` を挿入/更新。
   - 画像が無い図・anchor不一致は安全にスキップ（本文を壊さない）。
6. **同梱＆指紋更新** … `python tools/gen_bundled.py && python tools/content_manifest.py`
7. **配信** … GitHub Actions **「消防6類 コンテンツ配信 (R2/OTA)」** を手動実行 → 画像(`figures/*`)と本文がR2へ。ユーザーの次回起動で反映（ビルド・審査不要）。
   - ※ `Markdown`描画や`contentOta`等の**画面コード**を変えた場合のみ `eas update`（または土台ビルド）が別途必要。図の追加だけならR2配信で足りる。

## 配信・表示のしくみ（fire6特有）
- 本文は `content/chapters/chN.json` の `body`(Markdown)。描画は App.tsx の軽量 `Markdown`。
- 図は **R2配信のみ**（テキストと違い端末同梱しない）。マーカー `[[fig:asset|caption]]` を見つけると、
  OTAキャッシュにDL済みの `figures/<asset>.jpg` を URI で表示。未DL時は「図は準備中」枠。
- OTA対象キー: `content/*`（本文）＋ `figures/*`（画像）。`isOtaTarget` と `loadCache` で処理。

## ファイル
- `figures.json` … 図の正本（1図1エントリ）。`gen_figures_catalog.py` で公式【図】から再生成も可。
- `gen_figures_catalog.py` … 公式教材の【図】を棚卸ししてカタログ(種)を作る。手入力(anchor/labels/prompt/source)は caption 一致で引き継ぐ。
- `build_figures.py` … 画像変換＋本文へマーカー反映（冪等・安全スキップ）。
- `make_grid.py` … ラベル座標読み取り用グリッド（規格合わせ。本アプリはラベルオーバーレイ非実装＝ChatGPTが焼き込む）。

## figures.json 1エントリ
```
{
  "asset": "ch4_f03",          // 画像の基本名(=保存JPEG名)。英小文字+数字
  "chapter": 4,                 // 章番号 → content/chapters/ch4.json
  "anchor": "蓄圧式消火器の構造", // 本文のこの語を含む行の直後／同名の【図】行を置換
  "position": 1,
  "source": null,               // drop_dir の元PNG名。null なら <asset>.png を自動取込
  "caption": "蓄圧式消火器の内部構造",
  "legend": [],                 // 参考メモ（アプリ表示は caption のみ）
  "labels": [],                 // 参考メモ（座標オーバーレイ非実装）
  "draw": false,                // 実際に描く図だけ true（取捨選択用）
  "prompt": "蓄圧式消火器の断面…（＋共通スタイル文）"
}
```

## 注意
- Windows の Python は `C:/...` 形式パス。日本語パスOK（UTF-8で読み書き）。
- 図を増やすと配信容量が増える。横長・白背景・1図1枚、長辺1000pxへ縮小(JPEG q85)で軽量化済み。
- 本文を壊さない設計：anchorが本文に無ければ挿入せず警告のみ。まず `draw:true`＋PNG＋anchor を数枚で試す。
