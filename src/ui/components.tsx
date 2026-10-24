// テーマ対応の共通ビジュアル部品(アイコン/リング/タグ/レーダー/ストリーク棒/セグメント)。
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import Svg, { Circle, Path, G, Line, Polygon, Text as SvgText } from 'react-native-svg';
import { useTheme, useStyles } from '../theme/ThemeContext';
import type { Colors } from '../theme/colors';

// ---- アイコン(react-native-svg の線画) ----
export function Icon({ name, size = 23, color }: { name: string; size?: number; color?: string }) {
  const { c } = useTheme();
  const col = color ?? c.faint;
  const p = { stroke: col, strokeWidth: 1.8, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const vb = '0 0 24 24';
  switch (name) {
    case 'home':
      return <Svg width={size} height={size} viewBox={vb}><Path {...p} d="M3 11.5 12 4l9 7.5" /><Path {...p} d="M5 10v10h14V10" /></Svg>;
    case 'book':
      return <Svg width={size} height={size} viewBox={vb}><Path {...p} d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v15H5.5A1.5 1.5 0 0 0 4 20.5z" /><Path {...p} d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v15h5.5A1.5 1.5 0 0 1 20 20.5z" /></Svg>;
    case 'terms':
      return <Svg width={size} height={size} viewBox={vb}><Path {...p} d="M5 4h11a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2z" /><Path {...p} d="M9 8h6M9 12h6" /></Svg>;
    case 'search':
      return <Svg width={size} height={size} viewBox={vb}><Circle {...p} cx={11} cy={11} r={7} /><Path {...p} d="m20 20-3.2-3.2" /></Svg>;
    case 'doc':
      return <Svg width={size} height={size} viewBox={vb}><Path {...p} d="M6 3h9l3 3v15H6z" /><Path {...p} d="M9 9h6M9 13h6M9 17h4" /></Svg>;
    case 'refresh':
      return <Svg width={size} height={size} viewBox={vb}><Path {...p} d="M21 12a9 9 0 1 1-3-6.7" /><Path {...p} d="M21 4v4h-4" /></Svg>;
    case 'bars':
      return <Svg width={size} height={size} viewBox={vb}><Path {...p} d="M5 20V10M12 20V4M19 20v-6" /></Svg>;
    case 'gear':
      return <Svg width={size} height={size} viewBox={vb}><Circle {...p} cx={12} cy={12} r={3} /><Path {...p} d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" /></Svg>;
    case 'star':
      return <Svg width={size} height={size} viewBox={vb}><Path {...p} d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17.9 6.6 20l1-6.1-4.4-4.3 6.1-.9z" /></Svg>;
    case 'bookmark':
      return <Svg width={size} height={size} viewBox={vb}><Path {...p} d="M6 3h12v18l-6-4-6 4z" /></Svg>;
    case 'map':
      return <Svg width={size} height={size} viewBox={vb}><Circle {...p} cx={7} cy={7} r={2.4} /><Circle {...p} cx={17} cy={17} r={2.4} /><Circle {...p} cx={17} cy={7} r={2.4} /><Path {...p} d="M9 8.5 15 15M9 7h5.5M17 9.4v5.2" /></Svg>;
    case 'calendar':
      return <Svg width={size} height={size} viewBox={vb}><Path {...p} d="M4 6h16v15H4z" /><Path {...p} d="M4 10h16M8 3v4M16 3v4" /></Svg>;
    case 'target':
      return <Svg width={size} height={size} viewBox={vb}><Circle {...p} cx={12} cy={12} r={8} /><Circle {...p} cx={12} cy={12} r={3.5} /></Svg>;
    default:
      return null;
  }
}

// ---- 学習進捗リング ----
export function Ring({ pct, label }: { pct: number; label?: string }) {
  const { c } = useTheme();
  const s = useStyles();
  const r = 34, circ = 2 * Math.PI * r;
  const off = circ * (1 - Math.max(0, Math.min(100, pct)) / 100);
  return (
    <View style={{ width: 92, height: 92, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={92} height={92} viewBox="0 0 92 92" style={{ position: 'absolute' }}>
        <Circle cx={46} cy={46} r={r} stroke={c.raise} strokeWidth={9} fill="none" />
        <G rotation={-90} origin="46, 46">
          <Circle cx={46} cy={46} r={r} stroke={c.good} strokeWidth={9} fill="none" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={off} />
        </G>
      </Svg>
      <Text style={s.ringVal}>{pct}%</Text>
      <Text style={s.ringLbl}>{label ?? '学習進捗'}</Text>
    </View>
  );
}

export function Tag({ label, color, bg }: { label: string; color: string; bg: string }) {
  const s = useStyles();
  return (
    <View style={[s.tag, { backgroundColor: bg }]}>
      <Text style={[s.tagTxt, { color }]}>{label}</Text>
    </View>
  );
}

// ---- 分野別レーダー(自前描画) ----
export type RadarAxis = { key: string; label: string; color: string };
export type RadarSeries = { map: Record<string, number>; color: string; dashed?: boolean; dotted?: boolean; width?: number };

export function RadarChart({ axes, series, size = 220 }: { axes: RadarAxis[]; series: RadarSeries[]; size?: number }) {
  const { c } = useTheme();
  const cx = size / 2, cy = size / 2;
  const R = size / 2 - 30;
  const n = axes.length;
  const angle = (i: number) => (-90 + (360 / n) * i) * (Math.PI / 180);
  const pt = (i: number, ratio: number) => {
    const a = angle(i);
    return [cx + R * ratio * Math.cos(a), cy + R * ratio * Math.sin(a)] as const;
  };
  const rings = [0.25, 0.5, 0.75, 1.0];

  const polyPoints = (map: Record<string, number>) =>
    axes.map((ax, i) => {
      const v = Math.max(0, Math.min(100, map[ax.key] ?? 0)) / 100;
      const [x, y] = pt(i, v);
      return `${x},${y}`;
    }).join(' ');

  return (
    <Svg width={size} height={size}>
      {/* 目盛りリング(多角形) */}
      {rings.map((rr, k) => (
        <Polygon
          key={'g' + k}
          points={axes.map((_, i) => { const [x, y] = pt(i, rr); return `${x},${y}`; }).join(' ')}
          fill="none"
          stroke={c.line}
          strokeWidth={1}
        />
      ))}
      {/* 合格目安ライン(全体60%) */}
      <Polygon
        points={axes.map((_, i) => { const [x, y] = pt(i, 0.6); return `${x},${y}`; }).join(' ')}
        fill="none"
        stroke={c.good}
        strokeWidth={1.2}
        strokeDasharray="4 4"
      />
      {/* 軸線 */}
      {axes.map((_, i) => { const [x, y] = pt(i, 1); return <Line key={'a' + i} x1={cx} y1={cy} x2={x} y2={y} stroke={c.line} strokeWidth={1} />; })}
      {/* データ系列 */}
      {series.map((sr, si) => (
        <Polygon
          key={'s' + si}
          points={polyPoints(sr.map)}
          fill="none"
          stroke={sr.color}
          strokeWidth={sr.width ?? 2}
          strokeDasharray={sr.dotted ? '1 4' : sr.dashed ? '5 4' : undefined}
          strokeLinejoin="round"
        />
      ))}
      {/* 軸ラベル */}
      {axes.map((ax, i) => {
        const [x, y] = pt(i, 1.16);
        return (
          <SvgText key={'t' + i} x={x} y={y + 4} fill={ax.color} fontSize={10} fontWeight="700" textAnchor="middle">
            {ax.label}
          </SvgText>
        );
      })}
    </Svg>
  );
}

// ---- 学習ストリーク棒グラフ ----
export function StreakBars({ data }: { data: { date: string; count: number }[] }) {
  const s = useStyles();
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <View style={s.streakBars}>
      {data.map((d, i) => {
        const h = d.count > 0 ? 6 + Math.round((d.count / max) * 34) : 4;
        return <View key={i} style={[s.streakBar, { height: h }, d.count > 0 && s.streakBarOn]} />;
      })}
    </View>
  );
}

// ---- セグメントコントロール ----
export function Segmented<T extends string>({ options, value, onChange }: { options: { key: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const s = useStyles();
  return (
    <View style={s.segmented}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable key={o.key} onPress={() => onChange(o.key)} style={[s.seg, on && s.segOn]}>
            <Text style={[s.segTxt, on && s.segTxtOn]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export type { Colors };
