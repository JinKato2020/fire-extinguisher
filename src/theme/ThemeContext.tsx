// テーマ(ライト/ダーク)の文脈。設定画面の外観(システム/ライト/ダーク)を AsyncStorage に保存し、
// 現在のスキームに応じた Colors と、それで生成した StyleSheet を各画面へ配る。
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, dark, light } from './colors';
import { makeStyles } from '../ui/styles';

export type Mode = 'system' | 'light' | 'dark';
const AKEY = 'fire6:appearance:v1';

type Ctx = {
  mode: Mode;
  setMode: (m: Mode) => void;
  resolved: 'light' | 'dark';
  c: Colors;
};

const ThemeCtx = createContext<Ctx | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const sys = useColorScheme(); // 'light' | 'dark' | null
  const [mode, setModeState] = useState<Mode>('system');

  useEffect(() => {
    (async () => {
      try {
        const v = await AsyncStorage.getItem(AKEY);
        if (v === 'light' || v === 'dark' || v === 'system') setModeState(v);
      } catch { /* 無視 */ }
    })();
  }, []);

  const setMode = useCallback((m: Mode) => {
    setModeState(m);
    AsyncStorage.setItem(AKEY, m).catch(() => {});
  }, []);

  const resolved: 'light' | 'dark' = mode === 'system' ? (sys === 'light' ? 'light' : 'dark') : mode;
  const c = resolved === 'light' ? light : dark;

  const value = useMemo(() => ({ mode, setMode, resolved, c }), [mode, setMode, resolved, c]);
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme(): Ctx {
  const v = useContext(ThemeCtx);
  if (!v) throw new Error('useTheme must be used within ThemeProvider');
  return v;
}

export type AppStyles = ReturnType<typeof makeStyles>;

/** 現在のテーマで生成した StyleSheet を返す(テーマ変更時に再生成)。 */
export function useStyles(): AppStyles {
  const { c } = useTheme();
  return useMemo(() => makeStyles(c), [c]);
}
