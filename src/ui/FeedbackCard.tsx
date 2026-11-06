import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { openRequestEmail } from '../data/feedback';
import { useStyles } from '../theme/ThemeContext';

export function FeedbackCard({ active = true, preview = false, onDismiss }: { active?: boolean; preview?: boolean; onDismiss?: () => void }) {
  const [visible, setVisible] = useState(preview);
  const s = useStyles();
  useEffect(() => {
    if (preview) setVisible(true);
  }, [active, preview]);
  if (!active || !visible) return null;
  return <View style={[s.card, { marginTop: 18, alignSelf: 'stretch' }]}>
    <Text style={s.cardTitle}>ご意見・ご要望をお寄せください</Text>
    <Text style={[s.guideBody, { marginTop: 6 }]}>欲しい機能や教材の改善点をメールで送れます。送信は任意です。</Text>
    <Pressable accessibilityRole="button" onPress={() => { void openRequestEmail(); }} style={[s.submitBtn, { marginTop: 10 }]}>
      <Text style={s.submitTxt}>要望をメールで送る</Text>
    </Pressable>
    <Pressable accessibilityRole="button" onPress={() => { setVisible(false); onDismiss?.(); }} style={{ padding: 12, alignSelf: 'center' }}>
      <Text style={s.backTxt}>今は送らない</Text>
    </Pressable>
  </View>;
}
