import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, PanResponder, Pressable, Text, View } from 'react-native';
import type { GestureResponderEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { boundZoom, fitImage, zoomAround, type Size, type Zoom } from './zoomGeometry';

const INITIAL: Zoom = { scale: 1, x: 0, y: 0 };

// Avoid UIScrollView's native zoom: keep the decoded image and viewport size
// fixed, and only transform the image inside a clipped, bounded viewport.
export function ImageZoom({ uri, onClose }: { uri: string; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [natural, setNatural] = useState<Size | null>(null);
  const [failed, setFailed] = useState(false);
  const [viewport, setViewport] = useState<Size>({ width: 1, height: 1 });
  const [zoom, setZoom] = useState<Zoom>(INITIAL);
  const viewRef = useRef<View>(null);
  const offset = useRef({ x: 0, y: 0 });
  const current = useRef(zoom);
  const imageSize = natural ? fitImage(natural, viewport) : viewport;
  const dimensions = useRef({ image: imageSize, viewport });
  dimensions.current = { image: imageSize, viewport };
  const lastTap = useRef(0);
  const gesture = useRef({ count: 0, start: INITIAL, distance: 1, focal: { x: 0, y: 0 }, pinched: false });
  const apply = (next: Zoom) => {
    const d = dimensions.current;
    const value = boundZoom(next, d.image, d.viewport);
    current.current = value;
    setZoom(value);
  };
  useEffect(() => {
    let active = true;
    Image.getSize(uri, (width, height) => {
      if (active && width > 0 && height > 0) setNatural({ width, height });
    }, () => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [uri]);
  const sample = (e: GestureResponderEvent) => {
    const touches = e.nativeEvent.touches;
    if (!touches.length) return null;
    const a = touches[0], b = touches[1] ?? a;
    const v = dimensions.current.viewport;
    return {
      count: touches.length,
      distance: Math.max(1, Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY)),
      focal: { x: (a.pageX + b.pageX) / 2 - offset.current.x - v.width / 2,
        y: (a.pageY + b.pageY) / 2 - offset.current.y - v.height / 2 },
    };
  };
  const begin = (e: GestureResponderEvent) => {
    const p = sample(e);
    if (p) gesture.current = { ...p, start: current.current, pinched: gesture.current.pinched || p.count > 1 };
  };
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: e => { gesture.current.pinched = false; begin(e); },
    onPanResponderMove: e => {
      const p = sample(e), g = gesture.current;
      if (!p) return;
      if (p.count !== g.count) { begin(e); return; }
      if (p.count > 1) {
        g.pinched = true;
        apply(zoomAround(g.start, g.start.scale * p.distance / g.distance, g.focal, p.focal));
      } else apply({ ...g.start, x: g.start.x + p.focal.x - g.focal.x, y: g.start.y + p.focal.y - g.focal.y });
    },
    onPanResponderRelease: (_e, g) => {
      if (!gesture.current.pinched && Math.hypot(g.dx, g.dy) < 8) {
        const now = Date.now();
        if (now - lastTap.current < 300) {
          apply(current.current.scale > 1 ? INITIAL : zoomAround(current.current, 2.5, gesture.current.focal));
          lastTap.current = 0;
        } else lastTap.current = now;
      } else lastTap.current = 0;
    },
    onPanResponderTerminationRequest: () => false,
    onPanResponderTerminate: () => { lastTap.current = 0; },
  })).current;
  const button = (label: string, action: () => void, accessibilityLabel = label) => (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={action}
      style={{ minHeight: 44, minWidth: 44, paddingHorizontal: 12, justifyContent: 'center', alignItems: 'center', borderRadius: 8, backgroundColor: '#29333e' }}>
      <Text style={{ color: '#fff', fontSize: 16 }}>{label}</Text>
    </Pressable>
  );
  return (
    <Modal visible animationType="fade" onRequestClose={onClose} supportedOrientations={['portrait', 'landscape']}>
      <View style={{ flex: 1, backgroundColor: '#080b10', paddingTop: insets.top, paddingBottom: insets.bottom }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8 }}>
          {button('−', () => apply(zoomAround(current.current, current.current.scale / 1.5, { x: 0, y: 0 })), '縮小')}
          {button('＋', () => apply(zoomAround(current.current, current.current.scale * 1.5, { x: 0, y: 0 })), '拡大')}
          {button('全体', () => apply(INITIAL), '全体に戻す')}
          <View style={{ flex: 1 }} />
          {button('閉じる', onClose)}
        </View>
        <Text style={{ color: '#b5c0cc', fontSize: 12, textAlign: 'center', paddingBottom: 8 }}>2本指で拡大・1本指で移動／ダブルタップで拡大・全体</Text>
        <View ref={viewRef} style={{ flex: 1, overflow: 'hidden' }} {...pan.panHandlers}
          onLayout={e => {
            const { width, height } = e.nativeEvent.layout;
            setViewport({ width: Math.max(1, width), height: Math.max(1, height) });
            apply(INITIAL);
            viewRef.current?.measureInWindow((x, y) => { offset.current = { x, y }; });
          }}>
          {failed ? <Text style={{ color: '#fff', padding: 24 }}>画像を読み込めません。閉じて教材を更新してください。</Text>
            : natural ? <View pointerEvents="none" style={{ position: 'absolute', width: imageSize.width, height: imageSize.height,
                left: (viewport.width - imageSize.width) / 2, top: (viewport.height - imageSize.height) / 2,
                transform: [{ translateX: zoom.x }, { translateY: zoom.y }, { scale: zoom.scale }] }}>
                <Image source={{ uri }} resizeMode="contain" onError={() => setFailed(true)} style={{ width: '100%', height: '100%' }} />
              </View> : <ActivityIndicator color="#fff" style={{ flex: 1 }} />}
        </View>
      </View>
    </Modal>
  );
}
