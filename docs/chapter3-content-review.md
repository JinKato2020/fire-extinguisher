# 第3章 教材改訂記録（2026-11-06）

正本はアプリディレクトリの外にある `../教材解説/教材_第3章_機械に関する基礎的知識.md` と `../教材解説/第3章_図表データ.md`。本文・表は正本を編集し、JSONは生成スクリプトで再生成した。

用語集は `../教材解説/用語集.md` を正本へ移行し、`tools/gen_glossary.py` で全90語を生成する。本文との食い違いを防ぐため、第3章の9語（モーメント・フックの法則・ヤング率・気体の3法則・熱量・比熱・炭素鋼）を訂正した。ID・関連語・図の対応と、残り81語は変更していない。

## 内容と学習の流れ

- 導入・既存6Lesson・独立した復習の8項目。既存のLessonキーと順番を保持した。
- 各Lessonに目標・具体例・確認問題3問、章末に復習8問、計26問。答えを隠して考え、解説から該当Lessonへ戻れる。
- 質量と力、面積・体積の換算、垂直距離、静止摩擦力と最大値、応力と荷重、比例限度と弾性限度、ゲージ圧力と絶対圧力を区別して説明。
- 気体の例題は℃からK、ゲージ圧力から絶対圧力への換算を両方実演。一定量・理想気体の条件と、液体・気体共存時の適用限界を明記。
- 鋳鉄を炭素量6.67%までの材料とする説明を削除し、鋼との区分・実際の性質に整理。熱処理、非鉄金属、浸炭・表面処理も保持・補足した。
- はんだを鉛入りに限定しない説明、ニッケルを含まないステンレス鋼があること、材料・処理条件による違いを明記。
- 出題頻度・難易度・失点原因の根拠のない断定を削除。科目の問題数は公式案内に従い免除なし5問とした。

## 読みやすさと図表

- 固定幅のコード欄に入っていた公式を、折り返せる本文・色付き囲み・手順カードへ変更。
- 7表を見直し、単位換算・気体の条件・合金・公式の4表を追加。11表すべてを正本からテキストと比較用JPEGへ生成。第1・2章の41表を保持。
- 長い表は展開・検索ができる。検索欄の文言を、法令の用途表にも機械の単位表にも合う「項目・キーワードで検索」へ変更。
- 既存イラスト33枚を点検。教材本文は20枚に整理し、重複する導入・装飾図など13枚の参照を外した。画像ファイル自体は残している。
- 修正したイラストは3枚。`ch3_f05` は平行四辺形の対辺と合力の矢印、`ch3_f24` はフックの法則の条件を「比例限度内」に訂正、`ch3_f22` は用語集で使うせん断応力の矢印を切断面に平行に修正。
- 本文で使う20枚の内訳は修正2枚・継続使用18枚。せん断応力図の修正は用語集にも反映される。
- 画像は既存画像を参照した built-in image_gen の編集モードで作成。採用したPNGは `chapter3-review/masters/`、配信用JPEGは `assets/figures/`。生成後は形式変換のみ行った。
- [実行した画像編集プロンプト](chapter3-review/image-prompts.md)を保存した。
- 正本の `bodyV2` と、旧版向けの標準Markdown `body` を生成。教材とJSの受信順が前後しても読める。

## 検証

- TypeScript型検査と既存の第1・2章検査、全6章の正本・JSON一致を確認。
- `tools/test_ch3_content.ts`：8項目、26問、復習先、数値例の再計算、11表の全セルと正本の一致、31図表参照、旧画面向け本文を検査。
- 実コンポーネントを使うブラウザー表示で32画面（8項目×2テーマ×2幅）と、文字150%の18画面を確認。横方向のはみ出し・答えの初期表示なし。
- 26問の解答開閉、11表の全セル表示・展開・拡大、検索・該当なし表示、復習導線・解答状態のリセットを確認。
- 実機上の目視確認はこの検証に含まない。検証コードとJSON結果は `tmp/ch3-ui/`、確認用画像は本記録に添付。
- iOS向け `expo export` 成功（814モジュール）。生成の再実行で本文・表・画像・同梱データが同じになること、manifest全242ファイルのハッシュを確認。
- 第1・2・4・5・6章のJSONと、公開済み第1・2章のテキスト表41点が変更されていないことを確認。

## 表示サンプル

- [章一覧](chapter3-review/list-light.png)
- [計算手順・明るい背景](chapter3-review/calculation-light.png)
- [計算手順・暗い背景](chapter3-review/calculation-dark.png)
- [表の読みやすい表示](chapter3-review/table-light.png)
- [解説・復習への導線](chapter3-review/check-dark.png)

## 主な確認資料

- [消防試験研究センター：試験科目及び問題数](https://www.shoubo-shiken.or.jp/shoubou/annai/subject.html)
- [NMIJ：国際単位系](https://unit.aist.go.jp/nmij/info/redefinition/)
- [OpenStax：静的つり合い](https://openstax.org/books/university-physics-volume-1/pages/12-1-conditions-for-static-equilibrium)、[摩擦](https://openstax.org/books/university-physics-volume-1/pages/6-2-friction)、[弾性と塑性](https://openstax.org/books/university-physics-volume-1/pages/12-4-elasticity-and-plasticity)
- [OpenStax：圧力](https://openstax.org/books/university-physics-volume-1/pages/14-2-measuring-pressure)、[理想気体](https://openstax.org/books/university-physics-volume-2/pages/2-1-molecular-model-of-an-ideal-gas)
- [日本金属学会：金属の性質](https://jimm.jp/around_metal/properties_03.html)、[伊藤熱処理：熱処理の定義](https://www.inetu.jp/pages/15/)
- [TLV：鋳造と鍛造](https://www.tlv.com/ja-jp/steam-info/steam-theory/other/1611casting-forging)、[日本鉄鋼連盟：鋳造用銑](https://www.jisf.or.jp/knowledge/variety/sonota.html)
- [ステンレス協会：特長](https://www.jssa.gr.jp/contents/about_stainless/key_properties/)、[日本アルミニウム協会：化学的性質](https://www.aluminum.or.jp/use/materialdb/e/)
- [千住金属工業：はんだ合金カタログ](https://www.senju.com/en/download/pdf/2025_soldering_materials_catalogue.pdf)

## 配信状態

第3章はコミット `90c3bc1419fd81969ee7b532e1305020bc85b242` で2026-11-06に本番公開済み。

- [教材・図表のR2配信](https://github.com/JinKato2020/fire-extinguisher/actions/runs/42151596319)：対象コミットで成功。
- [iOS production OTA](https://expo.dev/accounts/jinkato1914/projects/fire6-exam-app/updates/0a174a4f-75e8-4754-846d-1c7709e6d7bc)：runtime `1.1.0`、update `01a1aeb9-73ac-7c8b-9e42-3952acd00ac1`。
- 配信先manifestの242ファイルが一致。第2章公開時から変更された15ファイルを実際に取得し、SHA-256一致を確認した。
