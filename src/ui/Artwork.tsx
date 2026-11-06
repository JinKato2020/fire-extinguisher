import React, { useState } from 'react';
import { Image, View, useWindowDimensions, type ImageSourcePropType } from 'react-native';
import { artworkBounds } from './artworkLayout';

/** Measure the actual column, including split-screen and rotation, never the asset's pixel size. */
export function Artwork({ source, ratio, maxHeight = Infinity, background = 'transparent', label, children }: {
  source: ImageSourcePropType; ratio: number; maxHeight?: number; background?: string;
  label?: string; children?: React.ReactNode;
}) {
  const { width } = useWindowDimensions();
  const [measured, setMeasured] = useState<number | null>(null);
  const bounds = artworkBounds(measured ?? Math.max(0, Math.min(width, 440) - 40), ratio, maxHeight);
  return <View onLayout={event => setMeasured(event.nativeEvent.layout.width)}
    style={{ width: '100%', height: bounds.height, overflow: 'hidden', backgroundColor: background }}>
    <Image source={source} accessible={!!label} accessibilityLabel={label} resizeMode="contain"
      style={{ width: bounds.width, height: bounds.height }} />
    {children}
  </View>;
}
