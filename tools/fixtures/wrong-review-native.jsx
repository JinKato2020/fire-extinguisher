// Browser hosts for the review regression test. Native layout/touch dispatch still needs device QA.
import React from 'react';
const flatten = value => Array.isArray(value) ? Object.assign({}, ...value.map(flatten)) : value || {};
function style(value) {
  const result = { ...flatten(typeof value === 'function' ? value({ pressed: false }) : value) };
  for (const [key, first, second] of [['paddingHorizontal','paddingLeft','paddingRight'],['paddingVertical','paddingTop','paddingBottom'],['marginHorizontal','marginLeft','marginRight'],['marginVertical','marginTop','marginBottom']]) {
    if (result[key] !== undefined) { result[first] = result[second] = result[key]; delete result[key]; }
  }
  const scale = Number(new URLSearchParams(location.search).get('scale') || 1);
  if (typeof result.fontSize === 'number') result.fontSize *= scale;
  if (typeof result.lineHeight === 'number') result.lineHeight = result.lineHeight * scale + 'px';
  if (result.borderWidth) result.borderStyle = 'solid';
  for (const edge of ['Top','Right','Bottom','Left']) if (result['border' + edge + 'Width']) result['border' + edge + 'Style'] = 'solid';
  for (const key of ['shadowOffset','shadowColor','shadowOpacity','shadowRadius','elevation']) delete result[key];
  return result;
}
const base = { display: 'flex', flexDirection: 'column', flexShrink: 0, position: 'relative', minWidth: 0, minHeight: 0, borderWidth: 0 };
function aria(p) {
  return { role: p.accessibilityRole === 'header' ? 'heading' : p.accessibilityRole,
    'aria-label': p.accessibilityLabel, 'aria-hidden': p.accessibilityElementsHidden,
    'aria-disabled': p.accessibilityState?.disabled };
}
export function View(p) {
  const ref = React.useRef(null);
  React.useEffect(() => { if (ref.current) ref.current.__pan = p.__pan; }, [p.__pan]);
  return <div ref={ref} {...aria(p)} data-pan={p.__pan ? 'true' : undefined}
    style={{ ...base, pointerEvents: p.pointerEvents, ...style(p.style) }}>{p.children}</div>;
}
export function Text(p) { return <span {...aria(p)} style={{ display:'block', whiteSpace:'pre-wrap', overflowWrap:'anywhere', ...style(p.style) }}>{p.children}</span>; }
export function Pressable(p) { return <button {...aria(p)} disabled={p.disabled} onClick={p.onPress}
  style={{ ...base, background:'transparent', textAlign:'left', font:'inherit', padding:0, cursor:'pointer', ...style(p.style) }}>{p.children}</button>; }
export function ScrollView(p) { return <div data-scroll="true" style={{ ...base, flexShrink:1,
  overflowY:p.horizontal?'hidden':'auto', overflowX:p.horizontal?'auto':'hidden', ...style(p.style) }}>
  <div style={{ ...base, ...style(p.contentContainerStyle) }}>{p.children}</div></div>; }
export function Modal(p) { return p.visible ? <div role="dialog" style={{ ...base, position:'fixed', inset:0, zIndex:100 }}>{p.children}</div> : null; }
export function Image(p) { return <img src={p.source?.uri || p.source} alt={p.accessibilityLabel || ''} style={{ objectFit:'contain', ...style(p.style) }} />; }
export function TextInput(p) { return <input {...aria(p)} value={p.value} readOnly={!p.editable} onChange={e=>p.onChangeText?.(e.target.value)} />; }
export const StyleSheet = { create: value => value };
export const PanResponder = { create: callbacks => ({ panHandlers: { __pan: callbacks } }) };
