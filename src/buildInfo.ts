// アプリのビルド番号。GitHub Actions のビルド時に、実際の番号(1+コミット数=
// iOS CFBundleVersion と同一値)へ自動で上書きされる。
// ローカル(未ビルド)では 'dev' のまま。設定画面のバージョン表示に使う。
export const BUILD_NUMBER = 'dev';
