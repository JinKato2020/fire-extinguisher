import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Linking, Platform } from 'react-native';
import * as StoreReview from 'expo-store-review';
import * as Application from 'expo-application';
import { feedbackDue, type FeedbackSchedule } from './feedbackRules';

const KEY = 'fire6:feedback:v1';
export const SUPPORT_EMAIL = 'contact@safa-lang.com';
export const APP_REVIEW_URL = 'https://apps.apple.com/app/id6823598014?action=write-review';
let schedule: FeedbackSchedule | null = null;
let loading: Promise<void> | null = null;
let work: Promise<unknown> = Promise.resolve();
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const result = work.then(fn); work = result.catch(() => {}); return result;
}

export async function initFeedback(): Promise<void> {
  if (!loading) loading = loadFeedback();
  return loading;
}
async function loadFeedback(): Promise<void> {
  try {
    const raw = JSON.parse(await AsyncStorage.getItem(KEY) ?? 'null');
    if (raw && Number.isFinite(raw.firstUsedAt)
      && (raw.lastOfferedAt === null || Number.isFinite(raw.lastOfferedAt))
      && Array.isArray(raw.reviewAttempts) && raw.reviewAttempts.every((at: unknown) => typeof at === 'number' && Number.isFinite(at))) {
      schedule = { ...raw, studySessions: Array.isArray(raw.studySessions) ? raw.studySessions.filter((at: unknown) => typeof at === 'number' && Number.isFinite(at)) : [] };
    }
  } catch { /* Missing or invalid state restarts the initial three-day schedule. */ }
  if (!schedule) {
    schedule = { firstUsedAt: Date.now(), lastOfferedAt: null, reviewAttempts: [], studySessions: [] };
    try { await AsyncStorage.setItem(KEY, JSON.stringify(schedule)); } catch { /* Retry at next learning checkpoint. */ }
  }
}

export function recordFeedbackStudy(at = Date.now()): Promise<void> {
  return serial(async () => {
    await initFeedback();
    if (!schedule) return;
    schedule = { ...schedule, studySessions: [...(schedule.studySessions ?? []), at].slice(-100) };
    try { await AsyncStorage.setItem(KEY, JSON.stringify(schedule)); } catch { /* Keep current-session progress. */ }
  });
}

/** Requests are not displays or submissions. StoreKit controls those, including its annual display limit. */
export function offerFeedback(stillEligible = () => true): Promise<boolean> {
  return serial(async () => {
    try {
    await initFeedback();
    const now = Date.now();
    if (!schedule || !stillEligible() || !feedbackDue(schedule, now)) return false;
    if (!(await StoreReview.isAvailableAsync().catch(() => false)) || !stillEligible()) return false;
    const next = { ...schedule, lastOfferedAt: now, studySessions: [], reviewAttempts: [...schedule.reviewAttempts, now].slice(-100) };
    // Persist before prompting so a remount/double effect cannot repeat the request.
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
    schedule = next;
    if (!stillEligible()) return false;
    await StoreReview.requestReview().catch(() => {});
    return true;
  } catch { return false; }
  });
}

export async function openRequestEmail(): Promise<void> {
  const subject = '消防設備士6類へのご意見・ご要望';
  const version = Application.nativeApplicationVersion ?? '不明';
  const build = Application.nativeBuildVersion ?? '不明';
  const body = `ご意見・ご要望をご記入ください。\n\n\nアプリ：消防設備士6類 ${version} (${build})\n`;
  try {
    await Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  } catch {
    Alert.alert('メールアプリを開けませんでした', `メールアプリを設定するか、${SUPPORT_EMAIL} へご意見・ご要望をお送りください。`);
  }
}

/** Persistent user action opens the product page, independently of the automatic schedule. */
export async function openAppReview(): Promise<void> {
  try {
    await Linking.openURL(APP_REVIEW_URL);
    await serial(async () => {
      await initFeedback();
      if (!schedule) return;
      // A link opening is only a cooldown, never proof that a review was posted.
      schedule = { ...schedule, lastOfferedAt: Date.now(), studySessions: [] };
      try { await AsyncStorage.setItem(KEY, JSON.stringify(schedule)); } catch { /* Keep cooldown in memory. */ }
    });
  }
  catch { Alert.alert('App Storeを開けませんでした', '時間をおいて、もう一度お試しください。'); }
}

export async function feedbackDevToolsAvailable(): Promise<boolean> {
  if (__DEV__) return true;
  // On iOS this native module reports false specifically for a TestFlight receipt.
  if (Platform.OS !== 'ios') return false;
  try { return !(await StoreReview.isAvailableAsync()); } catch { return false; }
}

/** Diagnostic only: never changes the automatic request schedule. */
export async function triggerReviewForDevelopment(): Promise<void> {
  if (!(await feedbackDevToolsAvailable())) return;
  try {
    if (!(await StoreReview.isAvailableAsync())) {
      Alert.alert('TestFlightでは表示されません', 'Appleの仕様により、TestFlightではアプリ内の標準評価画面を表示できません。開発ビルドで確認するか、設定の「アプリを評価する」からApp Storeを開いてください。');
      return;
    }
    await StoreReview.requestReview();
  } catch { Alert.alert('評価画面を表示できませんでした', '開発ビルドの実機でお試しください。'); }
}
