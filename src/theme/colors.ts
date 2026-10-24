// ライト/ダークのカラートークン。クレーンアプリ(Theme.swift)のトークン体系を踏襲しつつ、
// アクセントは消火器の赤(消防設備士のブランド)に差し替えている。
// 画面側は useTheme() で現在のスキームの Colors を受け取り、makeStyles(c) で StyleSheet を生成する。

export type Colors = {
  bg: string;       // 画面の地
  panel: string;    // タブバー/ヘッダ等の面
  card: string;     // カード
  card2: string;    // 一段沈んだ面(説明ボックス等)
  raise: string;    // 少し持ち上がった面
  line: string;     // 罫線・枠
  fg: string;       // 主要テキスト
  muted: string;    // 副次テキスト
  faint: string;    // さらに薄いテキスト/アイコン
  accent: string;   // アクセント(赤)
  accent2: string;  // アクセント濃淡
  good: string;     // 正解・合格(緑)
  warn: string;     // 警告・不正解(橙赤)
  onAccent: string; // アクセント地の上の文字
  overlayCard: string; // 画像カード上のグラデ代替(半透明の黒)
  accentSoft: string;  // アクセントの淡い塗り(選択状態など)
  goodSoft: string;    // 正解の淡い塗り
  warnSoft: string;    // 不正解の淡い塗り
};

export const dark: Colors = {
  bg: '#0C0E12',
  panel: '#14171E',
  card: '#191D25',
  card2: '#1F242E',
  raise: '#232936',
  line: '#2A303C',
  fg: '#EEF1F6',
  muted: '#9AA4B4',
  faint: '#6B7483',
  accent: '#E5484D',
  accent2: '#FF8A8E',
  good: '#3EC27A',
  warn: '#FF6A52',
  onAccent: '#FFFFFF',
  overlayCard: 'rgba(6,10,18,0.46)',
  accentSoft: 'rgba(229,72,77,0.16)',
  goodSoft: 'rgba(62,194,122,0.14)',
  warnSoft: 'rgba(255,106,82,0.14)',
};

export const light: Colors = {
  bg: '#F4F6F9',
  panel: '#FFFFFF',
  card: '#FFFFFF',
  card2: '#EFF2F6',
  raise: '#E7EBF1',
  line: '#D6DBE3',
  fg: '#1A1D22',
  muted: '#5A6472',
  faint: '#8A93A1',
  accent: '#D8383D',
  accent2: '#B32A30',
  good: '#1E9E57',
  warn: '#DE432A',
  onAccent: '#FFFFFF',
  overlayCard: 'rgba(10,18,30,0.34)',
  accentSoft: 'rgba(216,56,61,0.10)',
  goodSoft: 'rgba(30,158,87,0.12)',
  warnSoft: 'rgba(222,67,42,0.10)',
};

// 分野(chapter "1".."6")ごとの色。レーダー軸やタグの色分けに使う。
export function subjectColor(ch: string, c: Colors): string {
  switch (ch) {
    case '1': return '#5AA9E6'; // 法令共通
    case '2': return '#6FBF73'; // 法令類別
    case '3': return '#E0A32E'; // 機械基礎
    case '4': return c.accent;  // 構造機能整備
    case '5': return '#B07CE8'; // 規格
    case '6': return '#39C4C0'; // 実技
    default: return c.muted;
  }
}

// 分野の短縮ラベル(レーダー軸など)。
export const CHAPTER_SHORT: Record<string, string> = {
  '1': '法令共通',
  '2': '法令類別',
  '3': '機械基礎',
  '4': '構造機能',
  '5': '規格',
  '6': '実技',
};
