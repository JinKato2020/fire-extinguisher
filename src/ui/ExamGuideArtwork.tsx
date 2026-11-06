import React from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import { Artwork } from './Artwork';

/** The original guide illustrations, shared by the home entry and the guide itself. */
export function ExamGuideArtwork({ dark = true, link = false }: { dark?: boolean; link?: boolean }) {
  const { width, fontScale } = useWindowDimensions();
  const enlarged = fontScale > 1.3;
  const fg = dark ? '#FFFFFF' : '#182B40';
  const label = <View style={enlarged ? { padding: 18, gap: 8 } : { position: 'absolute', left: 18, top: 0, bottom: 0, width: '53%', justifyContent: 'center', gap: 6 }}>
    <Text style={{ color: dark ? '#F2CB8D' : '#7B4D22', fontSize: 10, lineHeight: 16, fontWeight: '800', letterSpacing: 1.5 }}>EXAM GUIDE</Text>
    <Text style={{ color: fg, fontSize: width < 360 ? 19 : 23, lineHeight: width < 360 ? 26 : 31, fontWeight: '800' }}>{enlarged ? '試験の総合解説' : '試験の\n総合解説'}{link ? <Text style={{ color: dark ? '#F2CB8D' : '#7B4D22', fontSize: 20 }}> ↗</Text> : null}</Text>
  </View>;
  return <View style={{ backgroundColor: dark ? '#152232' : '#F4F6F7' }}>
    <Artwork source={dark ? require('../../assets/examguide-dark.png') : require('../../assets/examguide-light.png')} ratio={2020 / 778}>
      {!enlarged ? label : null}
    </Artwork>
    {enlarged ? label : null}
  </View>;
}
