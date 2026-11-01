import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Linking, Platform } from 'react-native';
import * as StoreReview from 'expo-store-review';
import * as Application from 'expo-application';
import { canAttemptReview, feedbackDue, type FeedbackSchedule } from './feedbackRules';

const KEY = 'fire6:feedback:v1';
export const SUPPORT_EMAIL = 'contact@safa-lang.com';
export const APP_REVIEW_URL = 'https://apps.apple.com/app/id6823598014?action=write-review';
let schedule: FeedbackSchedule | null = null;
let busy = false;

export async function initFeedback(): Promise<void> {
  if (schedule) return;
  try {
    const raw = JSON.parse(await AsyncStorage.getItem(KEY) ?? 'null');
    if (raw && Number.isFinite(raw.firstUsedAt)
      && (raw.lastOfferedAt === null || Number.isFinite(raw.lastOfferedAt))
      && Array.isArray(raw.reviewAttempts) && raw.reviewAttempts.every((at: unknown) => typeof at === 'number' && Number.isFinite(at))) {
      schedule = raw;
    }
  } catch { /* Missing or invalid state restarts the initial three-day schedule. */ }
  if (!schedule) {
    schedule = { firstUsedAt: Date.now(), lastOfferedAt: null, reviewAttempts: [] };
    try { await AsyncStorage.setItem(KEY, JSON.stringify(schedule)); } catch { /* Retry at next learning checkpoint. */ }
  }
}

/** Called only at a learning checkpoint, independently of score or confidence. */
export async function offerFeedback(): Promise<boolean> {
  if (busy) return false;
  busy = true;
  try {
    await initFeedback();
    const now = Date.now();
    if (!schedule || !feedbackDue(schedule, now)) return false;
    const attemptReview = canAttemptReview(schedule.reviewAttempts, now) && await StoreReview.isAvailableAsync().catch(() => false);
    const next = { ...schedule, lastOfferedAt: now,
      reviewAttempts: attemptReview ? [...schedule.reviewAttempts, now] : schedule.reviewAttempts };
    // Persist before prompting so a remount/double effect cannot repeat the request.
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
    schedule = next;
    if (attemptReview) await StoreReview.requestReview().catch(() => {});
    return true;
  } catch { return false; }
  finally { busy = false; }
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
  try { await Linking.openURL(APP_REVIEW_URL); }
  catch { Alert.alert('App Storeを開けませんでした', '時間をおいて、もう一度お試しください。'); }
}

export async function feedbackDevToolsAvailable(): Promise<boolean> {
  if (__DEV__) return true;
  // On iOS this native module reports false specifically for a TestFlight receipt.
  if (Platform.OS !== 'ios') return false;
  try { return !(await StoreReview.isAvailableAsync()); } catch { return false; }
}

/** Diagnostic only: never changes the weekly interval or annual attempt counter. */
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
