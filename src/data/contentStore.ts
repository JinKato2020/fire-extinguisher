// コンテンツの「差し替え表」。OTAで落としたデータ(override)を優先し、無ければ同梱(BUNDLED)を返す。
// キーは manifest と同じ相対パス（例 content/index.json / content/chapters/ch1.json）。
// これで「直した章はOTA版・直していない章は同梱版」をファイル単位で切り替えられる。
import { BUNDLED } from './bundled.generated';

let overrides: Record<string, unknown> = {};

/** 起動時に、端末キャッシュから読んだ差し替え分をまとめてセットする。 */
export function setOverrides(files: Record<string, unknown> | null | undefined): void {
  overrides = files ?? {};
}

/** キーでコンテンツを引く。override（OTA）優先 → BUNDLED（同梱）→ null。 */
export function getContent<T = unknown>(key: string): T | null {
  if (Object.prototype.hasOwnProperty.call(overrides, key)) return overrides[key] as T;
  if (Object.prototype.hasOwnProperty.call(BUNDLED, key)) return BUNDLED[key] as T;
  return null;
}
