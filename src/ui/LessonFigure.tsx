import React, { useEffect, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

/** Preserve natural proportions: tall tables must not shrink inside a landscape slot. */
export function LessonFigure({ uri, caption, width, onZoom }: {
  uri: string | null; caption: string; width: number; onZoom: (uri: string) => void;
}) {
  const { c } = useTheme();
  const [ratio, setRatio] = useState(1.5);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    setRatio(1.5);
    setFailed(false);
    if (uri) Image.getSize(uri, (w, h) => {
      if (active && w > 0 && h > 0) setRatio(w / h);
    }, () => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [uri]);
  const imageStyle = { width, height: width / ratio, backgroundColor: '#fff', borderRadius: 10 };
  return <View style={{ marginVertical: 12, alignSelf: 'center', maxWidth: '100%' }}>
    {uri && !failed ? <Pressable onPress={() => onZoom(uri)} accessibilityRole="button"
      accessibilityLabel={`${caption || '図表'}を全画面で拡大`} accessibilityHint="拡大後はピンチ操作で文字や矢印を確認できます">
      <Image source={{ uri }} style={imageStyle} resizeMode="contain"
        onLoad={e => { const { width: w, height: h } = e.nativeEvent.source; if (w > 0 && h > 0) setRatio(w / h); }}
        onError={() => setFailed(true)} />
      <Text style={{ color: c.accent, fontSize: 12, lineHeight: 20, fontWeight: '700', marginTop: 5 }}>タップして拡大・ピンチで細部を確認</Text>
    </Pressable> : <View style={[imageStyle, { borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center' }]}>
      <Text style={{ color: c.muted, fontSize: 13 }}>{failed ? '図を読み込めませんでした' : '図は準備中'}</Text>
    </View>}
    {caption ? <Text style={{ color: c.muted, fontSize: 12, lineHeight: 20, marginTop: 4 }}>{'図：' + caption}</Text> : null}
  </View>;
}
