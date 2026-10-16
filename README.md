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

## まだ入れていないもの（将来）
- Android 対応（CAEの `build-android` ジョブ移植）
- コンテンツOTA（R2配信）／課金（RevenueCat）／学習進捗の保存
- 2〜6章の解説、問題・模試・成績画面の中身
