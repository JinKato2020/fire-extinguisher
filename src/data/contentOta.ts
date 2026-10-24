// コンテンツOTA本体：棚(Cloudflare R2)から「変わったファイルだけ」落として端末キャッシュへ保存する。
// 読込は起動時に loadCache() でキャッシュを読み、その後 syncContent() が裏で最新を取り込む。
// 取り込みで更新があれば initContent の onApplied が同じ起動中に画面へ反映する（＝2回起動は不要）。
// CAE/JLPT の ota 方式を fire6 へ移植（fire6 は図を使わずテキストのみ＝content/*.json が対象）。
//
// SDK54 は expo-file-system/legacy を使う（新APIは default import が無反応になる罠があるため）。
import * as FileSystem from 'expo-file-system/legacy';
import bundledManifest from '../../content/_manifest.json';

// 配信元＝共通ドメイン＋アプリIDのパス区切り（量産方針）。CAEと同じバケットに fire6/ prefix で相乗り。
const APP_ID = 'fire6';
const BASE = `https://content.safa-lang.com/${APP_ID}/`;

// 保存先は documentDirectory(恒久領域)。cacheDirectory はOSが空き容量不足で勝手に削除するため使わない。
const DIR = FileSystem.documentDirectory + `${APP_ID}-content/`;
const SHA_PATH = DIR + '_shas.json';
const BUNDLE_TAG_PATH = DIR + '_bundle.tag';

// OTA対象＝テキスト(content/*.json)＋図(figures/*.jpg|png)。
const isOtaTarget = (key: string): boolean => key.startsWith('content/') || key.startsWith('figures/');

/** 図キー figures/ch1_f01.jpg → asset名 ch1_f01（拡張子・ディレクトリを除く）。 */
function figureAsset(key: string): string {
  const base = key.split('/').pop() || key;
  return base.replace(/\.(jpg|jpeg|png)$/i, '');
}

const enc = (key: string): string => encodeURIComponent(key); // キー→安全なローカル名
type ManifestFiles = Record<string, { sha256: string; size?: number }>;
type ManifestLike = { files: ManifestFiles };

/** 同梱manifestの識別子。ビルドで土台が変わると値が変わる＝古いキャッシュを土台に混ぜない判定に使う。 */
function bundleTag(): string {
  const files = ((bundledManifest as ManifestLike).files) ?? {};
  const s = Object.keys(files).sort().map((k) => k + ':' + files[k].sha256).join('|');
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(16);
}

async function readJson<T>(uri: string, fallback: T): Promise<T> {
  try { return JSON.parse(await FileSystem.readAsStringAsync(uri)) as T; } catch { return fallback; }
}

async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
}

/** リモートmanifestと「今持っているsha」を比べ、変わった/新規のOTA対象キーだけ返す。 */
function diffKeys(remote: ManifestLike, have: Record<string, string>): string[] {
  return Object.keys(remote.files)
    .filter(isOtaTarget)
    .filter((k) => have[k] !== remote.files[k].sha256);
}

/** 今、端末が実際に持っているsha一覧＝同梱(土台)を土台に、タグ一致時のみキャッシュを重ねる。 */
async function effectiveShas(cachedShas: Record<string, string>): Promise<Record<string, string>> {
  const bundled = ((bundledManifest as ManifestLike).files) ?? {};
  const base: Record<string, string> = {};
  // 図(figures/)は require 同梱しない＝端末には存在しない。manifestに載っていても
  // 土台shaへ混ぜると「もう持っている」と誤判定してDLをスキップし、本文で永遠に「準備中」になる。
  // そこで図キーは土台に入れず、未DLの間は必ず diff に出てDLされるようにする。
  for (const k of Object.keys(bundled)) if (!k.startsWith('figures/')) base[k] = bundled[k].sha256;
  const storedTag = await FileSystem.readAsStringAsync(BUNDLE_TAG_PATH).catch(() => '');
  return storedTag === bundleTag() ? { ...base, ...cachedShas } : base;
}

export type CacheLoad = {
  content: Record<string, unknown>;      // content/キー → parsed JSON
  figures: Record<string, string>;       // 図asset名 → ローカルファイルURI
};

/** 起動時：端末キャッシュ済みの差し替え分を読む（無ければ空）。ネット不要・高速。 */
export async function loadCache(): Promise<CacheLoad> {
  const empty: CacheLoad = { content: {}, figures: {} };
  try {
    const info = await FileSystem.getInfoAsync(DIR);
    if (!info.exists) return empty;
    // ビルド(土台)が更新されていたら古いキャッシュは使わない（土台優先）。直後に syncContent が取り直す。
    const storedTag = await FileSystem.readAsStringAsync(BUNDLE_TAG_PATH).catch(() => '');
    if (storedTag !== bundleTag()) return empty;
    const names = await FileSystem.readDirectoryAsync(DIR);
    const out: CacheLoad = { content: {}, figures: {} };
    for (const name of names) {
      if (name === '_shas.json' || name === '_bundle.tag') continue;
      const key = decodeURIComponent(name);
      if (key.startsWith('content/')) {
        const text = await FileSystem.readAsStringAsync(DIR + name).catch(() => '');
        if (!text) continue;
        try { out.content[key] = JSON.parse(text); } catch { /* 壊れは飛ばす */ }
      } else if (key.startsWith('figures/')) {
        out.figures[figureAsset(key)] = DIR + name;   // 画像はパースせずURIだけ持つ
      }
    }
    return out;
  } catch { return empty; }
}

/** 裏で最新を取り込む：棚のmanifestと差分を取り、変わったファイルだけDLしてキャッシュ保存。 */
export async function syncContent(): Promise<{ updated: number }> {
  try {
    await ensureDir();
    // 目次(_manifest.json)は毎回「今の最新」を掴む必要がある（古いCDNキャッシュを掴むと誤判定）。
    // そこで毎回ユニークなURL(?t=時刻)＋no-store で必ず最新の目次を取る。
    const remoteText = await fetchTextTimeout(BASE + `_manifest.json?t=${Date.now()}`, 8000);
    if (!remoteText) return { updated: 0 };
    const remote = JSON.parse(remoteText) as ManifestLike;
    const cachedShas = await readJson<Record<string, string>>(SHA_PATH, {});
    const have = await effectiveShas(cachedShas);
    const need = diffKeys(remote, have);
    let updated = 0;
    const CONCURRENCY = 6;
    for (let i = 0; i < need.length; i += CONCURRENCY) {
      const batch = need.slice(i, i + CONCURRENCY);
      const oks = await Promise.all(batch.map(async (key) => {
        const local = DIR + enc(key);
        // 実ファイルも、中身が変わると値が変わる指紋(sha)を ?v= に付けて古いキャッシュを避ける。
        const url = BASE + key + '?v=' + remote.files[key].sha256;
        const res = await FileSystem.downloadAsync(url, local).catch(() => null);
        return res && res.status === 200 ? key : null;
      }));
      for (const key of oks) {
        if (key) { cachedShas[key] = remote.files[key].sha256; updated++; }
      }
    }
    await FileSystem.writeAsStringAsync(SHA_PATH, JSON.stringify(cachedShas)).catch(() => {});
    await FileSystem.writeAsStringAsync(BUNDLE_TAG_PATH, bundleTag()).catch(() => {});
    return { updated };
  } catch { return { updated: 0 }; }
}

async function fetchTextTimeout(url: string, ms: number): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    const r = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
    clearTimeout(t);
    if (!r.ok) return null;
    return await r.text();
  } catch { return null; }
}
