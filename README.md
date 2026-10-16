# 消防設備士6類 学習アプリ (fire6-exam-app)

CAE・JLPTと同じ方式（**Expo(React Native/TypeScript)** を **GitHub Actions 上で `expo prebuild`→`xcodebuild`→TestFlight(altool)** でビルド）の iOSアプリ。参考デザイン「ミッドナイトキャンパス」に沿ったホーム画面を実装。

- バンドルID（iOS）: `com.safa.FE`
- リポジトリ想定: `JinKato2020/fire6-exam-app`
- まずは **iOS先行**（Androidは将来、CAEの `build-android` ジョブを移植して追加）

## 画面構成（現状）
- **ホーム**: ヒーロー写真＋学習進捗ドーナツ(38%)・解いた問題(240)・正答率(78%)＋「学習を始める」＋2×2メニュー。※数値は仮データ。
- **下タブ**: ホーム / 学習 / 模試 / 成績 / 設定（タップで切替）。
- **学習タブ**: 教材6章の一覧。第3章「機械に関する基礎的知識」は解説テキストを同梱済み（タップで読める）。他章は「準備中」。
- 模試 / 成績 / 設定 は骨組み（プレースホルダー）。

## ローカル開発
```bash
npm install
npx expo start        # Expo Go もしくは開発ビルドで確認
npm run tsc           # 型チェック
```

## ビルド（TestFlight 提出）
CAEと同じく、ローカルの起動スクリプトから GitHub Actions を叩く。
```powershell
pwsh tools/build_fire6.ps1            # iOSビルド → TestFlight 提出
pwsh tools/build_fire6.ps1 -NoSubmit  # ビルドのみ
pwsh tools/build_fire6.ps1 -ForceIos  # 1日上限ガードを無視
```
- Build番号 = `1 + commit数`（CIが CFBundleVersion と設定画面表示に反映）。
- **1日ビルド上限ガード**（Apple error 90382対策）を CI に実装済み（既定: 1日5回で提出ブロック）。

## 「鍵（署名）」について — CAE/JLPTと同じものを使う
iOSの署名は EAS managed ではなく、**証明書／プロファイルを GitHub Secrets に base64 で入れ、CIで組み立てる**方式。

| Secret 名 | 中身 | 新アプリでの扱い |
|---|---|---|
| `IOS_DIST_CERT_BASE64` | Apple Distribution 証明書(.p12)のbase64 | **CAE/JLPTと同じ値を再登録**（アカウント共通） |
| `IOS_DIST_CERT_PASSWORD` | 上記.p12のパスワード | 同上 |
| `IOS_TEAM_ID` | Apple Team ID（7PM6FU3AB5） | 同上 |
| `APP_STORE_CONNECT_KEY_ID` | ASC APIキーID | 同上 |
| `APP_STORE_CONNECT_ISSUER_ID` | ASC Issuer ID | 同上 |
| `APP_STORE_CONNECT_API_KEY_BASE64` | ASC APIキー(.p8)のbase64 | 同上 |
| `IOS_PROVISIONING_PROFILE_FIRE6_BASE64` | **com.safa.FE 専用**のプロビジョニングプロファイル | **新規発行が必要**（唯一の新規） |

> つまり「鍵（証明書・ASC APIキー）」はそのまま流用でき、**新バンドルID用のプロファイル1枚だけ新規**。

## あなた（本人）がやる作業
不可逆・アカウント権限が要るため、以下はご自身で。
1. **App Store Connect**: `com.safa.FE` で App を新規作成 → 同バンドルIDの**プロビジョニングプロファイルを新規発行** → base64化して Secret `IOS_PROVISIONING_PROFILE_FIRE6_BASE64` に登録。
2. **GitHub**: `JinKato2020/fire6-exam-app` を作成（public推奨＝Actions無料）。この `fire6-exam-app/` 一式を push。
3. **Secrets登録**: 上表のうち証明書3種＋ASC APIキー3種は CAE/JLPT と同じ値を再登録。プロファイルのみ新規。
4. 以上が済んだら `pwsh tools/build_fire6.ps1` で TestFlight まで出せる。

## コンテンツ配信（R2 / OTA）— CAEと同じ方式
教材（`content/*.json`）は**アプリ同梱**しつつ、**Cloudflare R2 経由で審査なし・ビルドなしに差し替え**できる。CAE/JLPTと同じ量産方式で、1つのR2バケットに **`fire6/` プレフィックスで相乗り**する。

- アプリ側 BASE: `https://content.safa-lang.com/fire6/`（CAEと同じドメイン＝同じバケット）
- 仕組み: `tools/content_manifest.py` が全ファイルの sha256 台帳 `content/_manifest.json` を作る → 端末は起動時に配信側 manifest と手持ち sha を比べ、**変わった章だけDL**（`src/data/contentOta.ts`）。同梱baseline（`src/data/bundled.generated.ts`）があるのでオフラインでも読める。

### 教材を直したいとき（審査・ビルド不要）
```bash
# 1) 教材解説mdを直す → content/*.json を作り直す（生成器は scratchpad/gen_content_json.py）
python tools/content_manifest.py     # 指紋台帳を再生成（CIでも自動実行される）
python tools/gen_bundled.py          # 同梱baselineを更新（次の土台ビルド用）
```
→ そのうえで GitHub Actions の **「消防6類 コンテンツ配信 (R2 / OTA)」** を手動実行するだけ。ユーザーの次回起動で反映。

### 必要 Secrets（R2・4個）— CAEと同じ値を再登録
| Secret 名 | 中身 |
|---|---|
| `R2_ACCESS_KEY_ID` | Cloudflare R2 のアクセスキーID |
| `R2_SECRET_ACCESS_KEY` | 同シークレット |
| `R2_ENDPOINT` | R2 の S3 互換エンドポイント |
| `R2_BUCKET` | バケット名（CAEと同じバケットでよい） |

> **重要**: OTAの“仕組み”はビルドに焼き込まれるため、**この機構を入れた「土台ビルド」を1本出してから**でないとOTA配信は効かない。

## コードのOTA（EAS Update）— 画面・ロジックを審査/ビルドなしで更新
教材などの「コンテンツ」はR2で配るが、**画面やロジック（JS/TS）**はR2では運べない。これは **EAS Update**（CAEと同じ）で配る。

- Expoプロジェクト: `@jinkato1914/fire6-exam-app`（projectId は app.json の `extra.eas.projectId`）
- 仕組み: `app.json` の `updates.url`＋`runtimeVersion: "1.0.0"`＋`requestHeaders.expo-channel-name: "production"`。土台ビルド（**1004以降＝expo-updates入り**）を入れたアプリが、起動時に最新JSを取得して差し替える。
- 発行:
```powershell
pwsh tools/update_fire6.ps1 "変更内容のメモ"
# 中身: CI=1 npx eas update --branch production --platform ios --message "..."
```
> **注意**: 必ず `--platform ios`（app.json に `web` があるため `all` だと web依存で export 失敗）。反映は**実機アプリの再起動**時。土台ビルドに expo-updates が入っている必要がある（1002/1003は未搭載、**1004以降が対象**）。

### 使い分け早見
| 変えたもの | 配信方法 |
|---|---|
| 問題・教材・図（`content/*.json`） | GitHub Actions「消防6類 コンテンツ配信 (R2/OTA)」 |
| 画面・ロジック（`App.tsx` などJS/TS） | `pwsh tools/update_fire6.ps1 "..."`（EAS Update） |
| ネイティブ依存の追加・アイコン変更など | TestFlightビルド（`pwsh tools/build_fire6.ps1`） |

## まだ入れていないもの（将来）
- Android 対応（CAEの `build-android` ジョブ移植）
- 課金（RevenueCat）／学習進捗の保存
- 問題・模試・成績画面の中身
