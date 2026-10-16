// 起動時のコンテンツ初期化。App() のレンダー前に一度だけ呼ぶ。
//  1) 端末キャッシュ（前回DLした差し替え分）を読み込み、override にセット
//  2) 裏で最新を取り込む（起動は待たせない）。更新があれば "この起動中に" onApplied で画面へ反映。
import { setOverrides } from './contentStore';
import { loadCache, syncContent } from './contentOta';

async function applyCache(): Promise<void> {
  try {
    const cached = await loadCache();
    setOverrides(cached.content);
  } catch {
    setOverrides({});
  }
}

// onApplied: 裏の同期で新しいコンテンツを取り込み、この起動中に反映したときに呼ばれる（再描画用）。
export async function initContent(onApplied?: () => void): Promise<void> {
  await applyCache();
  onApplied?.();  // 同梱＋キャッシュを反映した時点で一度描画
  void syncContent().then(async (r) => {
    if (!r || r.updated <= 0) return;  // 更新なしなら何もしない
    await applyCache();                // 取り込んだ差分を同セッションで反映
    onApplied?.();                     // 画面へ「反映した」と通知（再描画）
  }).catch(() => {});
}
